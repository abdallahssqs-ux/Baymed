import { notFound } from 'next/navigation';
import { App } from '@/components/app';
const valid=(p:string[])=>!p.length||(p.length===1&&['courses','login','about','contact','account','my-courses','notes','403','admin'].includes(p[0]))||(p.length===2&&(['courses','enroll','learn'].includes(p[0])||(p[0]==='auth'&&p[1]==='verify')||(p[0]==='admin'&&['courses','requests','grants','users','messages','audit','settings'].includes(p[1]))))||(p.length===3&&p[0]==='admin'&&p[1]==='courses')||(p.length===4&&p[0]==='learn'&&p[2]==='quiz');
export default async function Page({params}:{params:Promise<{path?:string[]}>}){const {path=[]}=await params;if(!valid(path))notFound();return <App path={path}/>;}
