import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.99.1';
import webpush from 'npm:web-push@3.6.7';
import {sha256,verifyWebStaffSession} from '../_shared/web-staff-auth.ts';
import {verifyTelegramInitData} from '../cafe-kiosk/auth.ts';
import {connectMedia} from './media.ts';
import {languageNames,transcribeMessage,translateMessage,speakMessage} from '../delivery-chat/translation.ts';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'content-type,x-umma-push-key,x-umma-token,x-umma-request,x-umma-staff,x-umma-client','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
const uuid=(s:unknown)=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
function subscriptionValid(s:any){try{const u=new URL(s.endpoint);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com','wns2-par02p.wns.windows.com'].includes(u.hostname)&&u.href.length<4096&&/^[A-Za-z0-9_-]{87}$/.test(s.keys?.p256dh||'')&&/^[A-Za-z0-9_-]{22}$/.test(s.keys?.auth||'');}catch{return false;}}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});if(req.method!=='POST')return reply({ok:false},405);
 try{
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const rpc=async(name:string,args:any={})=>{const r=await db.rpc(name,args);if(r.error)throw Error(r.error.message);return r.data;};
  const bucket=db.storage.from('cafe-connect-media');
  const mime=(req.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
  const staffActor=(credential:string)=>credential.startsWith('web:')?verifyWebStaffSession(db,credential):
   verifyTelegramInitData(credential,Deno.env.get('TELEGRAM_BOT_TOKEN')!);
  const voiceKey=Deno.env.get('OPENAI_API_KEY')||'';
  if(req.headers.has('x-umma-request')){
   const token=req.headers.get('x-umma-token')||'',requestKey=req.headers.get('x-umma-request');
   const staff=req.headers.get('x-umma-staff'),clientId=req.headers.get('x-umma-client');
   if(!uuid(requestKey)||(staff?!uuid(clientId):!/^[a-f0-9]{64}$/.test(token)))return reply({ok:false},400);
   const identity=staff?{p_actor:await staffActor(staff)}:{p_hash:await sha256(token)};
   const mediaData={requestKey,clientId};
   const prepare=await rpc('cafe_connect',{p_action:staff?'staffMediaPrepare':'mediaPrepare',...identity,p_data:mediaData});
   if(prepare.id)return reply({ok:true,id:prepare.id});
   const {bytes,kind,body}=await connectMedia(req,mime);
   if(staff&&kind==='photo')return reply({ok:false,code:'MEDIA_FORMAT'},415);
   const path=prepare.clientId+'/'+crypto.randomUUID();
   const upload=await bucket.upload(path,bytes,{contentType:mime,cacheControl:'0',upsert:false});
   if(upload.error)throw Error('MEDIA_UPLOAD');
   const saved=await db.rpc('cafe_connect',{p_action:staff?'staffMediaSend':'mediaSend',...identity,p_data:{...mediaData,body,kind,path}});
   // Delete only after a definitive rejection or when a concurrent request already sent it.
   if((saved.error?.code==='P0001')||(!saved.error&&saved.data.path!==path))await bucket.remove([path]);
   if(saved.error)throw Error(saved.error.message);
   return reply({ok:true,id:saved.data.id});
  }
  const raw=await req.text();if(raw.length>14000)return reply({ok:false},413);const b=JSON.parse(raw);
  if(!['join','list','read','preferences','send','staffList','staffThread','staffRead','staffReply','staffCampaign','staffAudience','visit','dispatch','news','mediaGet','staffMediaGet','voice','staffVoice'].includes(b.action))return reply({ok:false},400);

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
   actor=await staffActor(b.initData);
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
  if(['staffThread','staffRead','staffReply','staffMediaGet','staffVoice'].includes(b.action)){if(!uuid(b.clientId))return reply({ok:false},400);data.clientId=b.clientId;}
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
  if(['mediaGet','staffMediaGet'].includes(b.action)){
   if(!uuid(b.messageId))return reply({ok:false},400);
   data.messageId=b.messageId;
   const media=await rpc('cafe_connect',{p_action:b.action,p_hash:hash,p_actor:actor,p_data:data});
   const signed=await bucket.createSignedUrl(media.path,900);
   if(signed.error)throw Error('MEDIA_UPLOAD');
   return reply({ok:true,url:signed.data.signedUrl});
  }
  if(b.action==='voice'||b.action==='staffVoice'){
   if(!uuid(b.messageId)||typeof b.language!=='string'||!Object.hasOwn(languageNames,b.language))return reply({ok:false},400);
   if(!voiceKey)return reply({ok:true,status:'unavailable'});
   const prefix=b.action==='staffVoice'?'staffVoice':'voice';
   const voiceData={...data,messageId:b.messageId,language:b.language};
   const voiceRpc=(suffix:string,extra={})=>rpc('cafe_connect',{
    p_action:prefix+suffix,p_hash:hash,p_actor:actor,p_data:{...voiceData,...extra}
   });
   const claim=await voiceRpc('Claim');
   let result=claim;
   if(claim.status==='claimed'){
    let audioPath:string|null=null;
    try{
     const original=await bucket.download(claim.path);
     if(original.error)throw Error('Voice unavailable');
     const extension=({'audio/webm':'webm','audio/mp4':'m4a','audio/ogg':'ogg'} as Record<string,string>)[original.data.type.split(';')[0]];
     if(!extension)throw Error('Voice format');
     const transcript=await transcribeMessage(voiceKey,original.data,'voice.'+extension,fetch,'gpt-transcribe');
     const translation=await translateMessage(voiceKey,transcript,b.language);
     if(translation.trim()!==transcript.trim()){
      const audio=await speakMessage(voiceKey,translation,b.language);
      audioPath=claim.path+'/translated-'+b.language+'-'+claim.lease+'.mp3';
      const saved=await bucket.upload(audioPath,audio,{contentType:'audio/mpeg',cacheControl:'0',upsert:false});
      if(saved.error)throw Error('Voice playback unavailable');
     }
     await voiceRpc('Complete',{lease:claim.lease,text:translation,audioPath});
     result={status:'ready',text:translation,audioPath};
    }catch(error){
     console.warn('Connect voice translation failed',String(error).replace(/[^a-zA-Z0-9 _-]/g,'').slice(0,120));
     return reply({ok:true,status:'failed'});
    }
   }
   if(result.status!=='ready')return reply({ok:true,status:result.status});
   if(!result.audioPath)return reply({ok:true,status:'ready',text:result.text,url:null});
   const signed=await bucket.createSignedUrl(result.audioPath,900);
   return reply({ok:true,status:'ready',text:result.text,url:signed.data?.signedUrl||null});
  }
  const result=await rpc('cafe_connect',{p_action:b.action,p_hash:hash,p_actor:actor,p_data:data});
  if(result?.messages)result.voiceTranslation=!!voiceKey;
  return reply(result);
 }catch(e){const msg=String(e);
  const mediaCode=msg.match(/MEDIA_(FORMAT|SIZE|UPLOAD)/)?.[0];
  if(mediaCode)return reply({ok:false,code:mediaCode},mediaCode==='MEDIA_SIZE'?413:mediaCode==='MEDIA_FORMAT'?415:502);
  const denied=/Access denied|Web (session|access)|Telegram|signature|Channel unavailable|credential/i.test(msg);return reply({ok:false,error:denied?'Откройте связь с UMMA заново или войдите в рабочий кабинет.':/Please wait/.test(msg)?'Подождите минуту перед повторной отправкой.':'Не удалось выполнить действие. Повторите попытку.'},denied?403:400);}
});
