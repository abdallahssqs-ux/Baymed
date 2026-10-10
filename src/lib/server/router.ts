import { ZodError } from 'zod';
import { Env, HttpError, fail, json, originCheck } from './core';
import { authRoute } from './auth';
import { catalogRoute } from './catalog';
import { adminRoute } from './admin';
import { mediaRoute, uploadRoute } from './media';
import { learningRoute, quizRoute } from './learning';
export async function handle(req:Request,env:Env,path:string[]) { try {
 if(env.PREVIEW_MODE==='1' && (!['GET','HEAD'].includes(req.method)||['admin','uploads','media','learn','notes','lock','quizzes','attempts','my-courses'].includes(path[0]))) fail(503,'هذه نسخة معاينة للقراءة فقط. سيتاح التسجيل والمحتوى الكامل عند إطلاق المنصة.');
 if(!['GET','HEAD'].includes(req.method))originCheck(req,env);
 if(path[0]==='auth')return await authRoute(req,env,path);
 if(path[0]==='admin')return await adminRoute(req,env,path);
 if(path[0]==='uploads')return await uploadRoute(req,env,path);
 if(path[0]==='media'&&['GET','HEAD'].includes(req.method))return await mediaRoute(req,env,path);
 if(['learn','notes','lock'].includes(path[0]))return await learningRoute(req,env,path);
 if(['quizzes','attempts'].includes(path[0]))return await quizRoute(req,env,path);
 return await catalogRoute(req,env,path);
 }catch(e){if(e instanceof HttpError)return json({error:e.message},e.status);if(e instanceof ZodError)return json({error:'راجع الحقول المطلوبة والقيم المدخلة.',fields:e.issues.map(v=>({path:v.path.join('.'),message:v.message}))},400);console.error('BayMed request failed',{path:path.slice(0,2).join('/'),kind:e instanceof Error?e.name:'unknown'});return json({error:'تعذّر إتمام العملية. حاول مجددًا؛ إذا استمرت المشكلة تواصل مع الإدارة.'},500);} }
