import { z } from 'zod';
import { currentUser, requireUser } from './auth';
import { Env, Row, all, body, emailSchema, fail, first, hash, id, json, now, parseJson, rateLimit, required, run } from './core';
export function courseDto(c:Row) { return {...c,objectives:parseJson(c.objectives,[])}; }
export async function catalogRoute(req:Request,env:Env,path:string[]) {
  const url=new URL(req.url);
  if(path[0]==='settings'&&req.method==='GET') return json({...await first(env,'SELECT * FROM settings WHERE id=1'),preview_mode:env.PREVIEW_MODE==='1'});
  if(path[0]==='contact'&&req.method==='POST') { const data=await body(req,z.object({name:required(120),email:emailSchema,message:required(5000)})); await rateLimit(env,'contact:'+await hash(req.headers.get('cf-connecting-ip')??'local'),5,3600); await run(env,'INSERT INTO contact_messages(id,name,email,message,created_at) VALUES(?,?,?,?,?)',id(),data.name,data.email,data.message,now()); return json({message:'وصلت رسالتك إلى إدارة المنصة.'},201); }
  if(path[0]==='my-courses'&&req.method==='GET') { const user=await requireUser(req,env); const courses=await all(env,'SELECT c.* FROM courses c JOIN grants g ON g.course_id=c.id WHERE g.email=? AND g.active=1 AND c.published=1 AND c.deleted_at IS NULL ORDER BY g.granted_at DESC',user.email); const requests=await all(env,'SELECT r.id,r.course_id,r.status,r.created_at,c.title FROM enrollment_requests r JOIN courses c ON c.id=r.course_id WHERE r.email=? AND c.deleted_at IS NULL ORDER BY r.created_at DESC',user.email); return json({courses:courses.map(courseDto),requests}); }
  if(path[0]==='courses'&&req.method==='GET') {
    if(path[1]) {
      const c=await first(env,'SELECT * FROM courses WHERE id=? AND published=1 AND deleted_at IS NULL',path[1]); if(!c) fail(404,'الكورس غير موجود أو غير منشور.');
      const sections=await all(env,`SELECT s.id,s.title,s.position,COUNT(i.id) AS count FROM sections s JOIN content_items i ON i.section_id=s.id AND i.hidden=0 AND i.published=1 WHERE s.course_id=? AND s.hidden=0 GROUP BY s.id ORDER BY s.position`,path[1]);
      const user=await currentUser(req,env);
      const request=user?await first(env,'SELECT status FROM enrollment_requests WHERE email=? AND course_id=?',user.email,path[1]):null;
      const granted=user?!!await first(env,'SELECT id FROM grants WHERE email=? AND course_id=? AND active=1',user.email,path[1]):false;
      return json({course:courseDto(c),sections,request,granted:granted||user?.role==='admin'});
    }
    const q=(url.searchParams.get('q')??'').slice(0,200); const subject=(url.searchParams.get('subject')??'').slice(0,100); const level=(url.searchParams.get('level')??'').slice(0,100); const page=Math.max(1,Math.min(100000,Number(url.searchParams.get('page'))||1));
    const order=({'newest':'updated_at DESC','price_asc':'price ASC','price_desc':'price DESC','title':'title ASC'} as Record<string,string>)[url.searchParams.get('sort')??'newest']??'updated_at DESC';
    const where="published=1 AND deleted_at IS NULL AND (title LIKE ? OR summary LIKE ? OR instructor LIKE ?) AND (?='' OR subject=?) AND (?='' OR level=?)";
    const args=[`%${q}%`,`%${q}%`,`%${q}%`,subject,subject,level,level];
    const courses=await all(env,`SELECT * FROM courses WHERE ${where} ORDER BY ${order} LIMIT 12 OFFSET ?`,...args,(page-1)*12);
    const total=await first<{n:number}>(env,`SELECT COUNT(*) n FROM courses WHERE ${where}`,...args);
    const subjects=await all(env,"SELECT DISTINCT subject FROM courses WHERE published=1 AND deleted_at IS NULL AND subject<>'' ORDER BY subject");
    const levels=await all(env,"SELECT DISTINCT level FROM courses WHERE published=1 AND deleted_at IS NULL AND level<>'' ORDER BY level");
    return json({courses:courses.map(courseDto),total:total?.n??0,page,subjects:subjects.map(r=>r.subject),levels:levels.map(r=>r.level)});
  }
  if(path[0]==='enroll'&&req.method==='POST') {
    const data=await body(req,z.object({course_id:required(),name:required(120),email:emailSchema}));
    if(!await first(env,'SELECT id FROM courses WHERE id=? AND published=1 AND deleted_at IS NULL',data.course_id)) fail(404,'الكورس غير متاح للتسجيل.');
    await rateLimit(env,'enroll:'+await hash(req.headers.get('cf-connecting-ip')??'local'),20,3600);
    await run(env,'INSERT INTO enrollment_requests(id,course_id,name,email,created_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(course_id,email) DO NOTHING',id(),data.course_id,data.name,data.email,now(),now());
    return json({message:'تم استلام طلبك. إذا كان لديك طلب سابق لهذا الكورس فسيُحتفظ به. الوصول يُفعّل يدويًا بعد مراجعة المشرف، ويمكنك متابعة الحالة بتسجيل الدخول.'},201);
  }
  fail(404,'المسار غير موجود.');
}
