import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {dispatchCourierQueue} from '../_shared/courier-workflow.ts';
Deno.serve(async(req:Request)=>{
 const secret=Deno.env.get('COURIER_WORKER_SECRET');
 if(!secret||secret.length<32)return new Response('Worker not configured',{status:503});
 const digest=async(value:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
 const [expected,actual]=await Promise.all([digest('Bearer '+secret),digest(req.headers.get('Authorization')||'')]);
 let difference=0;for(let i=0;i<expected.length;i++)difference|=expected[i]^actual[i];
 if(req.method!=='POST'||difference!==0)return new Response('Unauthorized',{status:401});
 try{const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});return Response.json(await dispatchCourierQueue(client,Deno.env.get('TELEGRAM_BOT_TOKEN')!));}
 catch{return Response.json({ok:false,error:'Courier dispatch failed'},{status:500});}
});
