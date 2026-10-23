import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import {rentalPayment} from './payment.ts';
import {verifyTelegramInitData} from './auth.ts';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{...cors,'Cache-Control':'no-store'}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return reply({ok:false,error:'RENT_METHOD'},405);
 try{
  const raw=await req.text();if(raw.length>40000)return reply({ok:false,error:'RENT_SIZE'},413);
  const body=JSON.parse(raw),action=String(body.action||''),data=body.data||{};
  const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),bot=Deno.env.get('TELEGRAM_BOT_TOKEN');
  if(!url||!key||!bot)return reply({ok:false,error:'RENT_CONFIG'},503);
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  if(action==='catalog'){
   const r=await db.rpc('rent_catalog',{p_start:data.starts_at||null,p_end:data.ends_at||null});
   if(r.error)return reply({ok:false,error:'RENT_DATES'},400);return reply(r.data);
  }
  if(action==='calendar'){
   if(!uuid.test(data.vehicle_id||'')||!/^\d{4}-\d{2}-01$/.test(data.month||''))return reply({ok:false,error:'RENT_DATES'},400);
   const r=await db.rpc('rent_calendar',{p_vehicle:data.vehicle_id,p_month:data.month});if(r.error)throw r.error;return reply(r.data);
  }
  let actor:number;try{actor=await verifyTelegramInitData(body.initData||'',bot);}catch{return reply({ok:false,error:'RENT_AUTH'},401);}
  // Every RPC rechecks active account and manager rights, including retries.
  if(action==='state'){
   const r=await db.rpc('rent_state',{p_actor:actor,p_staff:data.staff===true,p_before:data.before||null});
   if(r.error)throw r.error;return reply(r.data);
  }
  if(action==='detail'){
   if(!uuid.test(data.id||''))return reply({ok:false,error:'RENT_INVALID'},400);
   const r=await db.rpc('rent_detail',{p_actor:actor,p_id:data.id});if(r.error)throw r.error;
   for(const m of r.data.media||[]){const signed=await db.storage.from('rent-evidence').createSignedUrl(m.path,300);if(signed.error)throw signed.error;m.url=signed.data.signedUrl;}
   return reply(r.data);
  }
  if(action==='vehicle_media'){
   const state=await db.rpc('rent_state',{p_actor:actor,p_staff:true});if(state.error)throw state.error;
   const r=await db.from('rent_media').select('*').eq('vehicle_id',data.id).eq('uploaded',true).order('position').order('created_at');if(r.error)throw r.error;return reply({ok:true,media:r.data});
  }
  if(action==='upload_url'){
   const state=await db.rpc('rent_state',{p_actor:actor,p_staff:true});if(state.error)throw state.error;
   const r=await db.from('rent_media').select('id,bucket,path,uploaded,actor_id').eq('id',data.media_id).single();if(r.error)throw r.error;
   if(r.data.uploaded||r.data.actor_id!==actor)return reply({ok:false,error:'RENT_MEDIA'},400);
   const signed=await db.storage.from(r.data.bucket).createSignedUploadUrl(r.data.path,{upsert:false});if(signed.error)throw signed.error;
   return reply({ok:true,url:signed.data.signedUrl});
  }
  if(action==='pay_state'){
   if(!uuid.test(data.id||''))return reply({ok:false,error:'RENT_INVALID'},400);
   const r=await db.rpc('rent_payment_state',{p_actor:actor,p_id:data.id});if(r.error)throw r.error;
   r.data.intents=(r.data.intents||[]).map(rentalPayment);
   for(const p of r.data.proofs||[]){const signed=await db.storage.from('rent-payments').createSignedUrl(p.path,300);if(signed.error)throw signed.error;p.url=signed.data.signedUrl;}
   return reply(r.data);
  }
  if(action==='pay_upload_url'){
   if(!uuid.test(data.proof_id||''))return reply({ok:false,error:'RENT_INVALID'},400);
   const p=await db.from('rent_payment_proofs').select('*').eq('id',data.proof_id).single();if(p.error)throw p.error;
   const i=await db.from('rent_payment_intents').select('booking_id,status').eq('id',p.data.intent_id).single();if(i.error)throw i.error;
   const b=await db.from('rent_bookings').select('customer_id,status').eq('id',i.data.booking_id).single();if(b.error)throw b.error;
   if(b.data.customer_id!==actor||!['confirmed','active','returned'].includes(b.data.status)||!['pending','review'].includes(i.data.status)||p.data.uploaded)return reply({ok:false,error:'RENT_ACCESS'},403);
   const authorized=await db.rpc('rent_payment_state',{p_actor:actor,p_id:i.data.booking_id});if(authorized.error)throw authorized.error;
   const signed=await db.storage.from('rent-payments').createSignedUploadUrl(p.data.path,{upsert:false});if(signed.error)throw signed.error;
   return reply({ok:true,url:signed.data.signedUrl});
  }
  if(!uuid.test(body.request_id||''))return reply({ok:false,error:'RENT_INVALID'},400);
  if(action==='extension_request'){const r=await db.rpc('rent_extension_request',{p_actor:actor,p_request:body.request_id,p_data:data});if(r.error)throw r.error;return reply(r.data);}
  if(['pay_prepare','pay_proof_start','pay_proof_finish','pay_review','pay_void'].includes(action)){
   const r=await db.rpc('rent_payment_operation',{p_actor:actor,p_request:body.request_id,p_action:action,p_data:data});if(r.error)throw r.error;
   if(r.data.intent)r.data.intent=rentalPayment(r.data.intent);return reply(r.data);
  }

  const r=await db.rpc('rent_operation',{p_actor:actor,p_request:body.request_id,p_action:action,p_data:data});if(r.error)throw r.error;
  return reply(r.data);
 }catch(error){
  const msg=String((error as {message?:string})?.message||'');
  const code=msg.match(/RENT_[A-Z_]+/)?.[0];
  return reply({ok:false,error:code||(msg.includes('duplicate key')?'RENT_DUPLICATE':'RENT_UNAVAILABLE')},code==='RENT_ACCESS'?403:400);
 }
});
