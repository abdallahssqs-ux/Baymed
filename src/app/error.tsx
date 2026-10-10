'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="not-found"><h1>تعذّر تحميل الصفحة.</h1><p>حاول مجددًا. إذا استمرت المشكلة، تواصل مع إدارة المنصة.</p><button className="btn" onClick={reset}>إعادة المحاولة</button></main>;}
