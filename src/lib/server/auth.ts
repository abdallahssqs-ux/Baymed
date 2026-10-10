import { z } from 'zod';
import { Env, User, all, body, emailSchema, fail, first, hash, id, isLocal, json, now, rateLimit, required, run, secret } from './core';
const COOKIE='baymed_session';
export async function currentUser(req:Request,env:Env):Promise<User|null> { const token=req.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1); if(!token||!/^[a-f0-9]{64}$/.test(token)) return null; return first<User>(env,'SELECT u.id,u.email,u.name,u.role,s.hash AS session_hash FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=? AND s.expires_at>?',await hash(token),now()); }
export async function requireUser(req:Request,env:Env) { const user=await currentUser(req,env); if(!user) fail(401,'سجّل الدخول للمتابعة.'); return user; }
export async function requireAdmin(req:Request,env:Env) { const user=await requireUser(req,env); if(user.role!=='admin') fail(403,'هذه الصفحة مخصصة للمشرف.'); return user; }
const cookie=(token:string,req:Request,maxAge=604800)=>`${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${new URL(req.url).protocol==='https:'?'; Secure':''}`;
export async function authRoute(req:Request,env:Env,path:string[]) {
  const action=path[1];
  if(action==='me'&&req.method==='GET') { const user=await currentUser(req,env); return json({user:user?{id:user.id,email:user.email,name:user.name,role:user.role}:null}); }
  if(action==='request'&&req.method==='POST') {
    const {email}=await body(req,z.object({email:emailSchema}));
    const ip=req.headers.get('cf-connecting-ip')??'local';
    await rateLimit(env,'auth-ip:'+await hash(ip),20,900); await rateLimit(env,'auth-email:'+await hash(email),4,900);
    if(!isLocal(req,env)&&(!env.RESEND_API_KEY||!env.AUTH_EMAIL_FROM||!env.APP_URL)) fail(503,'خدمة البريد غير مهيأة بعد. يرجى التواصل مع إدارة المنصة.');
    const token=secret(); const digest=await hash(token); const t=now();
    await run(env,'INSERT INTO login_tokens(hash,email,expires_at) VALUES(?,?,?)',digest,email,t+900);
    const base=isLocal(req,env)?new URL(req.url).origin:env.APP_URL!;
    const link=new URL('/auth/verify',base); link.hash='token='+token;
    try {
      const payload={from:env.AUTH_EMAIL_FROM??'BayMed <noreply@baymed.test>',to:[email],subject:'رابط الدخول الآمن إلى BayMed',text:`للدخول إلى BayMed افتح هذا الرابط ثم اضغط تأكيد الدخول. ينتهي خلال 15 دقيقة ويُستخدم مرة واحدة.\n${link}\nإذا لم تطلب الرابط فتجاهل هذه الرسالة.`};
      if(isLocal(req,env)&&env.DEV_MAIL_URL) {
        const r=await fetch(env.DEV_MAIL_URL+'/api/v1/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({From:{Email:'noreply@baymed.test',Name:'BayMed'},To:[{Email:email}],Subject:payload.subject,Text:payload.text})}); if(!r.ok) throw new Error('mail failed');
      } else { const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${env.RESEND_API_KEY}`},body:JSON.stringify(payload)}); if(!r.ok) throw new Error('mail failed'); }
    } catch { await run(env,'DELETE FROM login_tokens WHERE hash=?',digest); fail(503,'تعذّر إرسال رابط الدخول الآن. حاول لاحقًا.'); }
    await env.DB.batch([env.DB.prepare('DELETE FROM login_tokens WHERE expires_at<?').bind(t),env.DB.prepare('DELETE FROM sessions WHERE expires_at<?').bind(t),env.DB.prepare('DELETE FROM rate_limits WHERE expires_at<?').bind(t)]);
    return json({message:'أرسلنا رابطًا آمنًا إلى بريدك. صلاحيته 15 دقيقة.'});
  }
  if(action==='verify'&&req.method==='POST') {
    const {token}=await body(req,z.object({token:z.string().regex(/^[a-f0-9]{64}$/)}));
    const value=await first<{email:string}>(env,'DELETE FROM login_tokens WHERE hash=? AND expires_at>? RETURNING email',await hash(token),now());
    if(!value) fail(400,'الرابط منتهي الصلاحية أو مستخدم مسبقًا. اطلب رابطًا جديدًا.');
    const admin=env.ADMIN_EMAIL?.trim().toLowerCase()===value.email;
    await run(env,"INSERT INTO users(id,email,role,created_at) VALUES(?,?,?,?) ON CONFLICT(email) DO NOTHING",id(),value.email,admin?'admin':'student',now());
    if(admin) await run(env,"UPDATE users SET role='admin' WHERE email=?",value.email);
    const user=await first<{id:string;role:string}>(env,'SELECT id,role FROM users WHERE email=?',value.email);
    const session=secret(); await run(env,'INSERT INTO sessions VALUES(?,?,?,?)',await hash(session),user!.id,now()+604800,now());
    return json({ok:true,role:user!.role},200,{'Set-Cookie':cookie(session,req)});
  }
  if(action==='logout'&&req.method==='POST') { const user=await currentUser(req,env); if(user) await run(env,'DELETE FROM sessions WHERE hash=?',user.session_hash); return json({ok:true},200,{'Set-Cookie':cookie('',req,0)}); }
  if(action==='profile'&&req.method==='PATCH') { const user=await requireUser(req,env); const {name}=await body(req,z.object({name:required(120)})); await run(env,'UPDATE users SET name=? WHERE id=?',name,user.id); return json({ok:true}); }
  if(action==='sessions'&&req.method==='GET') { const user=await requireUser(req,env); return json({sessions:await all(env,'SELECT created_at,expires_at,CASE WHEN hash=? THEN 1 ELSE 0 END AS current FROM sessions WHERE user_id=? AND expires_at>?',user.session_hash,user.id,now())}); }
  if(action==='sessions'&&req.method==='DELETE') { const user=await requireUser(req,env); await run(env,'DELETE FROM sessions WHERE user_id=? AND hash<>?',user.id,user.session_hash); return json({ok:true}); }
  fail(404,'المسار غير موجود.');
}
export async function courseAccess(env:Env,user:User,courseId:string) { const c=await first(env,'SELECT * FROM courses WHERE id=? AND deleted_at IS NULL',courseId); if(!c) fail(404,'الكورس غير موجود.'); if(user.role!=='admin') { if(!c.published || !await first(env,'SELECT id FROM grants WHERE email=? AND course_id=? AND active=1',user.email,courseId)) { await rateLimit(env,'denied:'+user.id,60,60); fail(403,'لا تملك صلاحية فعّالة لهذا الكورس. أرسل طلب تسجيل أو تواصل مع المشرف.'); } } return c; }
export async function studyLock(env:Env,user:User) { const t=now(); const lock=await first(env,`INSERT INTO study_locks(user_id,session_hash,expires_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET session_hash=excluded.session_hash,expires_at=excluded.expires_at WHERE study_locks.expires_at<=? OR study_locks.session_hash=? RETURNING user_id`,user.id,user.session_hash,t+90,t,user.session_hash); if(!lock) fail(409,'توجد جلسة دراسة نشطة على جهاز آخر. يمكنك إنهاؤها من صفحة حسابك أو الانتظار 90 ثانية بعد إغلاقها.'); }
