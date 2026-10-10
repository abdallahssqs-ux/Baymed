import Link from 'next/link';
export default function NotFound(){return <main className="not-found"><span className="eyebrow">BAYMED / 404</span><h1>هذا المسار لا يقود إلى صفحة.</h1><p>قد يكون الرابط تغيّر، أو أن الصفحة لم تعد متاحة.</p><Link className="btn" href="/">العودة إلى الرئيسية</Link></main>;}
