import { getCloudflareContext } from '@opennextjs/cloudflare';
import { handle } from '@/lib/server/router';
import type { Env } from '@/lib/server/core';
export const dynamic='force-dynamic';
async function route(req:Request,{params}:{params:Promise<{path?:string[]}>}) { const {env}=await getCloudflareContext({async:true});return handle(req,env as unknown as Env,(await params).path??[]); }
export {route as GET,route as POST,route as PATCH,route as PUT,route as DELETE,route as HEAD};
