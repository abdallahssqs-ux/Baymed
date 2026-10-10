'use client';
import { Header, Footer, Empty } from './ui';
import { Home, Catalog, CourseDetail, Enrollment, Login, About, Contact } from './public';
import { Account, MyCourses, Notes, QuizView, Study } from './study';
import { Admin } from './admin';
export function App({path}:{path:string[]}){const [area,id,sub,qid]=path;return <><Header/><main id="main">{!area?<Home/>:area==='courses'?id?<CourseDetail id={id}/>:<Catalog/>:area==='enroll'?<Enrollment id={id}/>:area==='login'?<Login/>:area==='auth'?<Login verify/>:area==='about'?<About/>:area==='contact'?<Contact/>:area==='account'?<Account/>:area==='my-courses'?<MyCourses/>:area==='notes'?<Notes/>:area==='learn'?sub==='quiz'?<QuizView courseId={id} id={qid}/>:<Study id={id}/>:area==='admin'?<Admin path={path}/>:<Empty title="لا تملك صلاحية الوصول"/>}</main>{!['admin','learn'].includes(area)&&<Footer/>}</>;}
