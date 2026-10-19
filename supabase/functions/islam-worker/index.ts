import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import * as Adhan from './adhan.js';
import {buildJobs,messageFor} from './queue.ts';
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return new Response('Unauthorized',{status:401});
 const token=(req.headers.get('Authorization')||'').replace(/^Bearer /,'');if(!/^[0-9]{10,12}\.[a-f0-9-]{36}\.[a-f0-9]{64}$/.test(token))return new Response('Unauthorized',{status:401});
 try{
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const auth=await db.rpc('islam_authorize_worker',{p_token:token});if(auth.error||auth.data!==true)return new Response('Unauthorized',{status:401});
  const bot=Deno.env.get('TELEGRAM_BOT_TOKEN');if(!bot)return Response.json({ok:false,error:'Bot unavailable'},{status:503});
  let cursor=0,generated=0,invalid=0;
  for(let page=0;page<100;page++){
   const users=await db.from('islam_telegram_preferences').select('*').eq('enabled',true).gt('telegram_id',cursor).order('telegram_id').limit(100);if(users.error)throw users.error;if(!users.data?.length)break;
   for(const p of users.data){try{const jobs=buildJobs(Adhan,p);if(jobs.length){const saved=await db.from('islam_notification_jobs').upsert(jobs,{onConflict:'telegram_id,local_date,prayer,kind,config_version',ignoreDuplicates:true});if(saved.error)throw saved.error;generated+=jobs.length;}}catch{invalid++;await db.from('islam_telegram_preferences').update({last_error:'Calculation unavailable; check location and date'}).eq('telegram_id',p.telegram_id).eq('version',p.version);}}
   cursor=users.data.at(-1).telegram_id;if(users.data.length<100)break;
  }
  const claim=await db.rpc('islam_claim_notifications');if(claim.error)throw claim.error;let sent=0,uncertain=0;
  for(const job of claim.data||[]){
   const result=await db.from('islam_telegram_preferences').select('*').eq('telegram_id',job.telegram_id).eq('version',job.config_version).eq('enabled',true).maybeSingle();if(result.error)throw result.error;
   const p=result.data;
   const finish=async(values:any)=>{const q=await db.from('islam_notification_jobs').update(values).eq('id',job.id).eq('lease_id',job.lease_id).eq('status','sending');if(q.error)throw q.error;};
   if(!p||job.kind==='before'&&new Date(job.prayer_at)<=new Date()){await finish({status:'cancelled'});continue;}
   try{
    const response=await fetch(`https://api.telegram.org/bot${bot}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:job.telegram_id,text:messageFor(job,p),disable_notification:p.silent}),signal:AbortSignal.timeout(12000)});
    const data=await response.json();
    if(data.ok){await finish({status:'sent',sent_at:new Date().toISOString(),lease_until:null});sent++;}
    else if(data.error_code===403){await finish({status:'failed',last_error:'Bot blocked or chat unavailable'});await db.rpc('islam_save_preferences',{p_actor:job.telegram_id,p_config:{},p_options:{enabled:false,language:p.language}});}
    else if(data.error_code===429&&job.attempts<3){const delay=Math.min(300,Math.max(1,Number(data.parameters?.retry_after)||60));await finish({status:'retry',due_at:new Date(Date.now()+delay*1000).toISOString(),lease_until:null,last_error:'Telegram rate limit'});}
    else await finish({status:'failed',last_error:'Telegram rejected delivery: '+String(data.error_code||response.status)});
   }catch{uncertain++;await finish({status:'uncertain',last_error:'Delivery result unknown; not resent automatically'});}
  }
  // Bound personal data retention. Only opted-in settings survive; old queue rows do not.
  await db.from('islam_notification_jobs').delete().lt('due_at',new Date(Date.now()-7*86400000).toISOString()).neq('status','sending');
  return Response.json({ok:true,generated,invalid,sent,uncertain});
 }catch{return Response.json({ok:false,error:'Prayer worker failed'},{status:503});}
});
