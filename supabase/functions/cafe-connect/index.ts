import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.99.1';
import webpush from 'npm:web-push@3.6.7';
import {sha256,verifyWebStaffSession} from '../_shared/web-staff-auth.ts';
import {verifyTelegramInitData} from '../cafe-kiosk/auth.ts';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'content-type,x-umma-push-key','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
const uuid=(s:unknown)=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
function subscriptionValid(s:any){try{const u=new URL(s.endpoint);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com','wns2-par02p.wns.windows.com'].includes(u.hostname)&&u.href.length<4096&&/^[A-Za-z0-9_-]{87}$/.test(s.keys?.p256dh||'')&&/^[A-Za-z0-9_-]{22}$/.test(s.keys?.auth||'');}catch{return false;}}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});if(req.method!=='POST')return reply({ok:false},405);
 try{
  const raw=await req.text();if(raw.length>14000)return reply({ok:false},413);const b=JSON.parse(raw);
  if(!['join','list','read','preferences','send','staffList','staffThread','staffRead','staffReply','staffCampaign','staffAudience','visit','dispatch','news'].includes(b.action))return reply({ok:false},400);
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const rpc=async(name:string,args:any={})=>{const r=await db.rpc(name,args);if(r.error)throw Error(r.error.message);return r.data;};
  if(b.action==='news')return reply(await rpc('cafe_connect',{p_action:'news'}));
  if(b.action==='dispatch'){
   const config=await rpc('cafe_push_config');if(!config||req.headers.get('x-umma-push-key')!==config.dispatchKey)return reply({ok:false},403);
   const jobs=await rpc('cafe_connect',{p_action:'lease'});let sent=0;
   await Promise.all(jobs.map(async(j:any)=>{let success=false,gone=false;try{if(!subscriptionValid(j.subscription))gone=true;else{await webpush.sendNotification(j.subscription,JSON.stringify({eventId:j.messageId,kind:'connect',title:j.title||'UMMA',body:j.body}),{TTL:86400,urgency:'normal',timeout:8000,vapidDetails:{subject:'https://ummaibrahim24072026-netizen.github.io/umma-global-mini-app/',publicKey:config.publicKey,privateKey:config.privateKey}});success=true;sent++;}}catch(e:any){gone=[404,410].includes(e.statusCode);}
    await rpc('cafe_connect',{p_action:'finish',p_data:{id:j.id,lease:j.lease,success,gone,subscription:j.subscription}});
   }));return reply({ok:true,sent});
  }
  let actor:null|number=null,hash='';
  if(b.action.startsWith('staff')){
   if(typeof b.initData!=='string')return reply({ok:false},401);
   actor=b.initData.startsWith('web:')?await verifyWebStaffSession(db,b.initData):await verifyTelegramInitData(b.initData,Deno.env.get('TELEGRAM_BOT_TOKEN')!);
  }else{
   if(typeof b.token!=='string'||!/^[a-f0-9]{64}$/.test(b.token))return reply({ok:false},401);
   hash=await sha256(b.token);
   if(b.action==='join'){
    const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
    if(!await rpc('cafe_web_rate_allow',{p_identity:await sha256('connect-join:'+ip)}))return reply({ok:false,error:'Слишком много попыток. Повторите позже.'},429);
   }
  }
  if(b.action==='visit'){
   if(typeof b.point!=='string'||!/^[a-zA-Z0-9_-]{0,80}$/.test(b.point)||typeof b.installed!=='boolean')return reply({ok:false},400);
   if(('orderId'in b||'requestKey'in b)&&(!uuid(b.orderId)||!uuid(b.requestKey)))return reply({ok:false},400);
   return reply(await rpc('cafe_menu_visit',{p_hash:hash,p_point:b.point,p_installed:b.installed,p_order_id:b.orderId??null,p_request_key:b.requestKey??null}));
  }
  if(b.action==='staffAudience'){
   if(!['all','new','returning','regular','viewed','push'].includes(b.segment)||!Number.isInteger(b.offset)||b.offset<0||b.offset>100000)return reply({ok:false},400);
   return reply(await rpc('cafe_menu_audience',{p_actor:actor,p_segment:b.segment,p_offset:b.offset}));
  }
  const data:any={};
  if(['staffThread','staffRead','staffReply'].includes(b.action)){if(!uuid(b.clientId))return reply({ok:false},400);data.clientId=b.clientId;}
  if(['send','staffReply','staffCampaign'].includes(b.action)){
   if(typeof b.body!=='string'||!b.body.trim()||b.body.length>2000||!uuid(b.requestKey))return reply({ok:false,error:'Введите сообщение до 2000 символов.'},400);
   data.body=b.body.trim();data.requestKey=b.requestKey;
  }
  if(b.action==='staffCampaign'){
   if(typeof b.title!=='string'||!b.title.trim()||b.title.length>100||typeof b.language!=='string'||!/^(all|[a-z]{2})$/.test(b.language))return reply({ok:false},400);
   data.title=b.title.trim();data.language=b.language;data.installedOnly=b.installedOnly===true;data.publicNews=b.publicNews===true;
  }
  if(['read','staffRead'].includes(b.action)){
   if(typeof b.before!=='string'||!Number.isFinite(Date.parse(b.before)))return reply({ok:false},400);data.before=new Date(b.before).toISOString();
  }
  if(b.action==='preferences'){
   if(typeof b.name==='string')data.name=b.name.slice(0,80);
   if(typeof b.language==='string'&&/^[a-z]{2}$/.test(b.language))data.language=b.language;
   if(typeof b.promotions==='boolean')data.promotions=b.promotions;
   if('subscription'in b){if(b.subscription!==null&&!subscriptionValid(b.subscription))return reply({ok:false},400);data.subscription=b.subscription;}
  }
  return reply(await rpc('cafe_connect',{p_action:b.action,p_hash:hash,p_actor:actor,p_data:data}));
 }catch(e){const msg=String(e);const denied=/Access denied|Web (session|access)|Telegram|signature|Channel unavailable|credential/i.test(msg);return reply({ok:false,error:denied?'Откройте связь с UMMA заново или войдите в рабочий кабинет.':/Please wait/.test(msg)?'Подождите минуту перед повторной отправкой.':'Не удалось выполнить действие. Повторите попытку.'},denied?403:400);}
});
