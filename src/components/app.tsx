'use client';
import { Header, Footer, Empty, useQuery } from './ui';
import type { Settings } from '@/lib/types';
import { Home, Catalog, CourseDetail, Enrollment, Login, About, Contact } from './public';
import { Account, MyCourses, Notes, QuizView, Study } from './study';
import { Admin } from './admin';
export function App({path}:{path:string[]}){const [area,id,sub,qid]=path;const settings=useQuery<Settings>('settings');const preview=!!settings.data?.preview_mode;const gated=preview&&['enroll','login','auth','contact','account','my-courses','notes','learn','admin'].includes(area);return <><Header preview={preview}/><main id="main">{gated?<div className="container section"><Empty title="هذه نسخة معاينة للقراءة فقط">سيتاح التسجيل والدخول والمحتوى الكامل بعد إطلاق المنصة.</Empty></div>:!area?<Home/>:area==='courses'?id?<CourseDetail id={id}/>:<Catalog/>:area==='enroll'?<Enrollment id={id}/>:area==='login'?<Login/>:area==='auth'?<Login verify/>:area==='about'?<About/>:area==='contact'?<Contact/>:area==='account'?<Account/>:area==='my-courses'?<MyCourses/>:area==='notes'?<Notes/>:area==='learn'?sub==='quiz'?<QuizView courseId={id} id={qid}/>:<Study id={id}/>:area==='admin'?<Admin path={path}/>:<Empty title="لا تملك صلاحية الوصول"/>}</main>{!['admin','learn'].includes(area)&&<Footer/>}</>;}
