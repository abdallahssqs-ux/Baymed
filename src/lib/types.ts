export type Course = {id:string;title:string;summary:string;description:string;subject:string;level:string;instructor:string;price:number;objectives:string[];extra:string;cover_id:string|null;preview_id:string|null;preview_url:string|null;preview_description:string;preview_visible:number;published:number;updated_at:number};
export type Section = {id:string;course_id:string;title:string;position:number;hidden:number;layout:string;width:string;collapsed:number};
export type Item = {id:string;course_id:string;section_id:string;title:string;kind:string;body:string;media_id:string|null;external_url?:string|null;position:number;hidden:number;published:number;direction:string;width:string;quiz_id?:string;position_seconds?:number;completed?:number};
export type Question = {id:string;type:'single'|'multiple'|'truefalse'|'clinical'|'best'|'image'|'short';prompt:string;options:string[];correct:number[];accepted:string[];explanation:string;points:number;image_id?:string};
export type Quiz = {id:string;course_id:string;item_id:string;title:string;description:string;questions:Question[];max_attempts:number;duration_minutes:number;shuffle:number;explanation_mode:string;published:number};
export type Profile={id:string;name:string;email:string;role:'admin'|'student'};
export type Note={id:string;title:string;body:string;course_id:string|null;item_id:string|null;created_at:number;updated_at:number};
export type Settings={platform_name:string;tagline:string;about:string;contact_email:string;watermark:number;copy_notice:number};
