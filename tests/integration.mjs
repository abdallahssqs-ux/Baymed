import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {createServer} from 'node:http';
const base=process.env.BAYMED_TEST_URL??'http://localhost:8787';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) {
  throw new Error('Integration tests must run against a local Cloudflare preview.');
}
// Repeated local runs should exercise the flow, not fail on a previous run's login quota.
execFileSync(fileURLToPath(new URL('../node_modules/.bin/wrangler',import.meta.url)),[
  'd1','execute','baymed-db','--local','--yes','--command',
  "DELETE FROM rate_limits WHERE key LIKE 'auth-ip:%' OR key LIKE 'auth-email:%'",
],{cwd:fileURLToPath(new URL('..',import.meta.url)),env:{...process.env,XDG_CONFIG_HOME:process.env.XDG_CONFIG_HOME??fileURLToPath(new URL('../.cache/config',import.meta.url))},stdio:'pipe'});
let lastMail=null;
const mailSink=createServer((req,res)=>{
  if(req.method!=='POST'||req.url!=='/api/v1/send'){res.writeHead(404).end();return;}
  let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{try{lastMail=JSON.parse(body);res.writeHead(200,{'Content-Type':'application/json'}).end('{}');}catch{res.writeHead(400).end();}});
});
await new Promise(resolve=>mailSink.listen(8025,'127.0.0.1',resolve));
const suffix=Date.now();
const student=`student-${suffix}@baymed.test`;
async function call(path,method='GET',data,cookie){const r=await fetch(base+'/api/'+path,{method,headers:{...(method==='GET'?{}:{Origin:base}),'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:data===undefined?undefined:JSON.stringify(data)});const result=await r.json();return {status:r.status,data:result,cookie:r.headers.get('set-cookie')?.split(';')[0]};}
async function login(email){const request=await call('auth/request','POST',{email});assert.equal(request.status,200,JSON.stringify(request.data));const payload=lastMail;assert.ok(payload?.Text,'mail sink did not receive a login link');const token=new URL(payload.Text.match(/https?:\/\/\S+/)[0]).hash.slice(7);assert.match(token,/^[a-f0-9]{64}$/);const verified=await call('auth/verify','POST',{token});assert.equal(verified.status,200,JSON.stringify(verified.data));assert.ok(verified.cookie?.startsWith('baymed_session='));return verified;}
try {
let r=await call('courses');assert.equal(r.status,200);assert.ok(r.data.courses.length>=1);
const admin=await login(process.env.BAYMED_TEST_ADMIN_EMAIL??'admin@baymed.test');assert.equal(admin.data.role,'admin');
r=await call('admin/courses','POST',{title:'اختبار المنصة',summary:'كورس لاختبار الصلاحيات',description:'اختبار محلي',subject:'اختبار',level:'طب',instructor:'',price:5,objectives:[],extra:'',published:true},admin.cookie);assert.equal(r.status,201,JSON.stringify(r.data));const cid=r.data.id;
r=await call(`admin/courses/${cid}/sections`,'POST',{title:'وحدة الاختبار',position:0,hidden:false,layout:'vertical',width:'full',collapsed:false},admin.cookie);assert.equal(r.status,200,JSON.stringify(r.data));const sid=r.data.id;
r=await call(`admin/courses/${cid}/items`,'POST',{section_id:sid,title:'درس محمي',kind:'text',body:'النص الطبي المحمي',media_id:null,external_url:null,position:0,hidden:false,published:true,direction:'rtl',width:'full'},admin.cookie);assert.equal(r.status,200,JSON.stringify(r.data));
r=await call('enroll','POST',{course_id:cid,name:'طالب اختبار',email:student});assert.equal(r.status,201,JSON.stringify(r.data));
r=await call('learn/'+cid);assert.equal(r.status,401);
const user=await login(student);assert.equal(user.data.role,'student');
r=await call('learn/'+cid,'GET',undefined,user.cookie);assert.equal(r.status,403,'enrollment must not grant access');
r=await call('admin/grants','POST',{email:student,course_id:cid,active:true},admin.cookie);assert.equal(r.status,200,JSON.stringify(r.data));
r=await call('learn/'+cid,'GET',undefined,user.cookie);assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.items.length,1);assert.equal(r.data.items[0].body,'النص الطبي المحمي');
r=await call(`admin/courses/${cid}/sections/${sid}`,'PATCH',{title:'وحدة الاختبار',position:0,hidden:false,layout:'columns',width:'full',collapsed:false},admin.cookie);assert.equal(r.status,200,JSON.stringify(r.data));
r=await call('learn/'+cid,'GET',undefined,user.cookie);assert.equal(r.status,200);assert.equal(r.data.sections[0].layout,'columns');
r=await call('admin/grants','POST',{email:student,course_id:cid,active:false},admin.cookie);assert.equal(r.status,200);
r=await call('learn/'+cid,'GET',undefined,user.cookie);assert.equal(r.status,403,'revocation must take effect immediately');
r=await call('notes','POST',{title:'خاصة',body:'ملاحظة سرية',course_id:null,item_id:null},user.cookie);assert.equal(r.status,201,JSON.stringify(r.data));
r=await call('notes','GET',undefined,admin.cookie);assert.equal(r.status,200);assert.equal(r.data.notes.length,0,'admin must not see student notes');
console.log('PASS: catalog, admin login, content creation, enrollment, denied access, manual grant, revocation, private notes');
// Protected R2 files, quiz grading, private note isolation, and study-session lock.
r=await call('admin/grants','POST',{email:student,course_id:cid,active:true},admin.cookie);assert.equal(r.status,200);
const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n');
r=await call('uploads','POST',{course_id:cid,name:'lecture.pdf',mime:'application/pdf',size:pdf.length},admin.cookie);assert.equal(r.status,201,JSON.stringify(r.data));const mid=r.data.id;
let up=await fetch(`${base}/api/uploads/${mid}/1`,{method:'PUT',headers:{Origin:base,Cookie:admin.cookie},body:pdf});const partBody=await up.text();assert.equal(up.status,200,partBody);const part=JSON.parse(partBody);
r=await call(`uploads/${mid}/complete`,'POST',{parts:[part]},admin.cookie);assert.equal(r.status,200,JSON.stringify(r.data));
r=await call(`admin/courses/${cid}/items`,'POST',{section_id:sid,title:'محاضرة PDF',kind:'pdf',body:'',media_id:mid,external_url:null,position:1,hidden:false,published:true,direction:'rtl',width:'full'},admin.cookie);assert.equal(r.status,200,JSON.stringify(r.data));
let file=await fetch(`${base}/api/media/${mid}`);assert.equal(file.status,401,'paid PDF must not be public');
file=await fetch(`${base}/api/media/${mid}`,{headers:{Cookie:user.cookie}});assert.equal(file.status,200);assert.deepEqual(Buffer.from(await file.arrayBuffer()),pdf);
r=await call(`admin/courses/${cid}/items`,'POST',{section_id:sid,title:'اختبار',kind:'quiz',body:'',media_id:null,external_url:null,position:2,hidden:false,published:true,direction:'rtl',width:'full'},admin.cookie);assert.equal(r.status,200,JSON.stringify(r.data));const itemId=r.data.id;
r=await call(`admin/courses/${cid}/quizzes`,'POST',{item_id:itemId,title:'اختبار طبي',description:'مراجعة قصيرة',questions:[{id:'q1',type:'single',prompt:'ما الإجابة الصحيحة؟',options:['أ','ب'],correct:[1],accepted:[],explanation:'ب هي الصحيحة',points:2}],max_attempts:2,duration_minutes:0,shuffle:false,explanation_mode:'after_submit',published:true},admin.cookie);assert.equal(r.status,200,JSON.stringify(r.data));const quizId=r.data.id;
r=await call('quizzes/'+quizId,'GET',undefined,user.cookie);assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.quiz.questions[0].correct,undefined,'answers must not leak before submission');
r=await call(`quizzes/${quizId}/start`,'POST',undefined,user.cookie);assert.equal(r.status,201,JSON.stringify(r.data));const attemptId=r.data.id;assert.equal(r.data.questions[0].correct,undefined);
r=await call(`attempts/${attemptId}/answers`,'PATCH',{question_id:'q1',answer:[1]},user.cookie);assert.equal(r.status,200,JSON.stringify(r.data));
r=await call(`attempts/${attemptId}/submit`,'POST',undefined,user.cookie);assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.score,2);assert.equal(r.data.result[0].correct,true);
const second=await login(student);r=await call('learn/'+cid,'GET',undefined,second.cookie);assert.equal(r.status,409,'second concurrent session must be blocked');
r=await call('lock','DELETE',undefined,second.cookie);assert.equal(r.status,200);r=await call('learn/'+cid,'GET',undefined,second.cookie);assert.equal(r.status,200);
r=await call('admin/grants','POST',{email:student,course_id:cid,active:false},admin.cookie);assert.equal(r.status,200);file=await fetch(`${base}/api/media/${mid}`,{headers:{Cookie:user.cookie}});assert.equal(file.status,403,'revoked student must lose file access');
const stranger=await login(`stranger-${suffix}@baymed.test`);r=await call('notes','GET',undefined,stranger.cookie);assert.equal(r.status,200);assert.equal(r.data.notes.length,0);
console.log('PASS: private R2 PDF, server quiz grading, hidden answer key, note isolation, session lock, revoked file access');
const video=readFileSync(new URL('./fixtures/preview-sample.mp4',import.meta.url));
r=await call('uploads','POST',{course_id:cid,name:'preview.mp4',mime:'video/mp4',size:video.length},admin.cookie);assert.equal(r.status,201,JSON.stringify(r.data));const videoId=r.data.id;
up=await fetch(`${base}/api/uploads/${videoId}/1`,{method:'PUT',headers:{Origin:base,Cookie:admin.cookie},body:video});const videoPartBody=await up.text();assert.equal(up.status,200,videoPartBody);
r=await call(`uploads/${videoId}/complete`,'POST',{parts:[JSON.parse(videoPartBody)]},admin.cookie);assert.equal(r.status,200,JSON.stringify(r.data));
r=await call(`admin/courses/${cid}/preview`,'PATCH',{media_id:videoId,external_url:null,description:'معاينة مجانية',visible:true},admin.cookie);assert.equal(r.status,200,JSON.stringify(r.data));
r=await call(`courses/${cid}`);assert.equal(r.data.course.preview_id,videoId);assert.equal(r.data.course.preview_visible,1);
file=await fetch(`${base}/api/media/${videoId}`,{headers:{Range:'bytes=0-15'}});assert.equal(file.status,206);assert.deepEqual(Buffer.from(await file.arrayBuffer()),video.subarray(0,16));
r=await call(`admin/courses/${cid}/preview`,'PATCH',{media_id:null,external_url:null,description:'',visible:false},admin.cookie);assert.equal(r.status,200);
file=await fetch(`${base}/api/media/${videoId}`);assert.equal(file.status,401,'unpublished preview must become private');
console.log('PASS: video upload, public preview, byte-range streaming, preview removal');

} finally {mailSink.close();}
