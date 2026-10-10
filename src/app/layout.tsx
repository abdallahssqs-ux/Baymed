import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/noto-sans-arabic';
import '@fontsource-variable/inter';
import './globals.css';
import { Providers } from '@/components/ui';
export const metadata:Metadata={title:{default:'BayMed | معرفة طبية تُبنى بفهم',template:'%s | BayMed'},description:'منصة تعليمية مستقلة لطلاب الطب الجامعي. كورسات منظّمة، مراجعة أكاديمية، وملاحظات شخصية في مكان واحد.',robots:{index:true,follow:true}};
export default function RootLayout({children}:{children:ReactNode}){return <html lang="ar" dir="rtl" suppressHydrationWarning><body><Providers>{children}</Providers></body></html>;}
