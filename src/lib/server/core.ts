import { z } from 'zod';
export interface Env { DB: D1Database; MEDIA: R2Bucket; APP_URL?: string; ADMIN_EMAIL?: string; RESEND_API_KEY?: string; AUTH_EMAIL_FROM?: string; ENVIRONMENT?: string; PREVIEW_MODE?: string; DEV_MAIL_URL?: string }
export type Row = Record<string, unknown>;
export type User = { id: string; email: string; name: string; role: 'admin'|'student'; session_hash: string };
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export function fail(status: number, message: string): never { throw new HttpError(status, message); }
export const now = () => Math.floor(Date.now()/1000);
export const id = () => crypto.randomUUID();
export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const bool = z.boolean().default(false);
export const text = (max=1000) => z.string().trim().max(max);
export const required = (max=200) => text(max).min(1);
export const json = (data: unknown, status=200, headers: HeadersInit={}) => Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...headers}});
export async function body<T>(req: Request, schema: z.ZodType<T>): Promise<T> { if (Number(req.headers.get('content-length')??0)>1_000_000) fail(413,'حجم الطلب أكبر من المسموح.'); let value; try { const raw=await req.text(); if(raw.length>1_000_000) fail(413,'حجم الطلب أكبر من المسموح.'); value=JSON.parse(raw); } catch(e) { if(e instanceof HttpError) throw e; fail(400,'بيانات الطلب غير صالحة.'); } return schema.parse(value); }
export async function first<T=Row>(env:Env, sql:string,...args:unknown[]):Promise<T|null> { return env.DB.prepare(sql).bind(...args).first<T>(); }
export async function all<T=Row>(env:Env,sql:string,...args:unknown[]):Promise<T[]> { return (await env.DB.prepare(sql).bind(...args).all<T>()).results; }
export async function run(env:Env,sql:string,...args:unknown[]) { return env.DB.prepare(sql).bind(...args).run(); }
export async function audit(env:Env,user:User|null,action:string,target:string) { await run(env,'INSERT INTO audit_log VALUES(?,?,?,?,?)',id(),user?.id??null,action,target,now()); }
export async function rateLimit(env:Env,key:string,limit:number,seconds:number) { const t=now(); const row=await first<{count:number}>(env,`INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END,expires_at=CASE WHEN expires_at<=? THEN ? ELSE expires_at END RETURNING count`,key,t+seconds,t,t,t+seconds); if((row?.count??0)>limit) fail(429,'طلبات كثيرة. انتظر قليلًا ثم حاول مجددًا.'); }
export async function hash(value:string) { const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)); return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join(''); }
export function secret() { const b=crypto.getRandomValues(new Uint8Array(32)); return Array.from(b,x=>x.toString(16).padStart(2,'0')).join(''); }
export const isLocal = (req:Request,env:Env) => env.ENVIRONMENT==='development' && ['localhost','127.0.0.1','[::1]'].includes(new URL(req.url).hostname);
export function originCheck(req:Request,env:Env) { const origin=req.headers.get('origin'); const actual=new URL(req.url).origin; const expected=env.APP_URL?new URL(env.APP_URL).origin:actual; if(origin!==expected && !(isLocal(req,env)&&origin===actual)) fail(403,'تعذّر التحقق من مصدر الطلب. أعد تحميل الصفحة.'); if(req.headers.get('sec-fetch-site')==='cross-site') fail(403,'الطلب غير مسموح.'); }
export function parseJson<T>(value:unknown,fallback:T):T { try{return JSON.parse(String(value)) as T;}catch{return fallback;} }
export function safeUrl(value:string) { let url; try { url=new URL(value); }catch{ return false; } const host=url.hostname.toLowerCase(); return url.protocol==='https:' && !url.username && !url.password && host.includes('.') && !host.includes(':') && !['localhost','127.0.0.1'].includes(host) && !/^\d+\./.test(host) && !host.endsWith('.local') && !host.endsWith('.localhost') && !host.endsWith('.internal'); }
export const urlSchema=z.string().max(2048).refine(v=>!v||safeUrl(v),'استخدم رابط HTTPS عامًّا صالحًا.');
