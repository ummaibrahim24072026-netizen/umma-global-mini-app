import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.99.1';
import {verifyTelegramInitData} from './auth.ts';
import {translateMessage,transcribeMessage,speakMessage,validMedia,languageNames} from './translation.ts';
import {dispatchCustomerNotifications} from '../_shared/customer-notifications.ts';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const uuid=(s:unknown)=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const errors:Record<string,string>={CHAT_ACCESS:'Чат доступен только клиенту и назначенному курьеру.',CHAT_CLOSED:'Отправка недоступна: курьер ещё не назначен или доставка завершена.',CHAT_INPUT:'Проверьте сообщение, размер и формат файла.',CHAT_UPLOAD:'Файл ещё не загружен полностью. Повторите отправку.',CHAT_KEY_REUSED:'Повтор запроса отличается от исходного сообщения.',CHAT_RATE:'Слишком много сообщений. Попробуйте немного позже.',CHAT_LEASE:'Перевод уже обрабатывается.'};
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method==='GET')return reply({ok:true,ready:true,translationConfigured:true,voiceTranslationConfigured:!!Deno.env.get('OPENAI_API_KEY'),translationProvider:'mymemory',limits:{photo:8388608,video:20971520,voice:5242880,voiceSeconds:60}});
 if(req.method!=='POST')return reply({ok:false,error:'Method not allowed'},405);
 try{
  const raw=await req.text();if(raw.length>16000)return reply({ok:false,error:errors.CHAT_INPUT},413);const body=JSON.parse(raw);
  const token=Deno.env.get('TELEGRAM_BOT_TOKEN'),url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!token||!url||!service)return reply({ok:false,error:'Server configuration error'},503);
  if(typeof body.initData!=='string'||body.initData.length>10000)return reply({ok:false,error:'Откройте приложение через Telegram'},401);
  const actor=await verifyTelegramInitData(body.initData,token);
  if(!uuid(body.orderId)||!['list','send','prepare','finish','translate'].includes(body.action)||!languageNames[body.language])return reply({ok:false,error:errors.CHAT_INPUT},400);
  const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}}),bucket=db.storage.from('delivery-chat');
  async function rpc(action:string,args:any={}){const r=await db.rpc('delivery_chat_action',{p_actor:actor,p_action:action,p_order:body.orderId,p_body:{...args,language:body.language}});if(r.error)throw Error(r.error.message);return r.data;}
  async function notify(){try{await dispatchCustomerNotifications(db,token!);}catch{console.error('Chat notification deferred');}}
  if(body.action==='list'){
   if(body.before!==undefined&&(!Number.isSafeInteger(body.before)||body.before<1))return reply({ok:false,error:errors.CHAT_INPUT},400);
   const data=await rpc('list',{before:body.before});const paths=[...new Set(data.messages.flatMap((m:any)=>[m.object_path,m.translation?.audio_path].filter(Boolean)))];
   const signed=paths.length?await bucket.createSignedUrls(paths,900):{data:[],error:null};if(signed.error)throw Error('Chat media unavailable');
   const urls=new Map((signed.data||[]).map((s:any)=>[s.path,s.signedUrl]));
   const threadKey=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body.orderId+':'+String(data.context.peer)))),b=>b.toString(16).padStart(2,'0')).join('');
   return reply({ok:true,context:{threadKey,orderNumber:data.context.orderNumber,role:data.context.role,canSend:data.context.canSend,language:data.context.language,peerLanguage:data.context.peerLanguage,waiting:!data.context.peer},translationConfigured:true,voiceTranslationConfigured:!!Deno.env.get('OPENAI_API_KEY'),translationProvider:'mymemory',messages:data.messages.map((m:any)=>({id:m.id,seq:m.seq,own:m.own,kind:m.kind,text:m.body,language:m.source_language,createdAt:m.created_at,readAt:m.read_at,mediaUrl:urls.get(m.object_path)||null,translation:m.translation?{state:m.translation.state,text:m.translation.body,transcript:m.translation.transcript,audioUrl:urls.get(m.translation.audio_path)||null,attempts:m.translation.attempts}:null}))});
  }
  if(body.action==='send'||body.action==='prepare'){
   if(!uuid(body.requestKey)||typeof body.text!=='string'||body.text.length>2000||!['text','photo','video','voice'].includes(body.kind))return reply({ok:false,error:errors.CHAT_INPUT},400);
   if(body.action==='send'&&(body.kind!=='text'||!body.text.trim()))return reply({ok:false,error:errors.CHAT_INPUT},400);
   if(body.action==='prepare'&&(!Number.isInteger(body.size)||body.size<1||body.size>20971520||typeof body.mime!=='string'||body.mime.length>80))return reply({ok:false,error:errors.CHAT_INPUT},400);
   const data=await rpc(body.action,{requestKey:body.requestKey,kind:body.kind,text:body.text,size:body.action==='prepare'?body.size:0,mime:body.action==='prepare'?body.mime:undefined});
   if(data.message.sent_at){await notify();return reply({ok:true,messageId:data.message.id,sent:true,replayed:!!data.replayed});}
   const upload=await bucket.createSignedUploadUrl(data.message.object_path,{upsert:false});if(upload.error)throw Error('Chat upload unavailable');
   return reply({ok:true,messageId:data.message.id,sent:false,uploadUrl:upload.data.signedUrl});
  }
  if(!uuid(body.messageId))return reply({ok:false,error:errors.CHAT_INPUT},400);
  if(body.action==='finish'){
   const data=await rpc('media',{messageId:body.messageId}),m=data.message;
   if(m.sender!==actor)throw Error('CHAT_ACCESS');
   if(!m.sent_at){
    const signed=await bucket.createSignedUrl(m.object_path,60);if(signed.error)throw Error('CHAT_UPLOAD');
    const r=await fetch(signed.data.signedUrl,{headers:{Range:'bytes=0-511'},signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('CHAT_UPLOAD');
    const reader=r.body?.getReader();if(!reader)throw Error('CHAT_UPLOAD');let bytes=new Uint8Array();
    try{while(bytes.length<64){const chunk=await reader.read();if(chunk.done)break;const next=new Uint8Array(Math.min(512,bytes.length+chunk.value.length));next.set(bytes);next.set(chunk.value.subarray(0,next.length-bytes.length),bytes.length);bytes=next;}}finally{await reader.cancel();}
    if(!validMedia(bytes,m.mime))throw Error('CHAT_INPUT');
   }
   await rpc('finish',{messageId:body.messageId});await notify();return reply({ok:true,messageId:body.messageId,sent:true});
  }
  const key=Deno.env.get('OPENAI_API_KEY')||'';if(!key&&(await rpc('media',{messageId:body.messageId})).message.kind==='voice'){return reply({ok:false,code:'TRANSLATION_UNAVAILABLE',error:'Автоперевод пока не подключён. Доступен оригинал сообщения.'},503);}
  const claimed=await rpc('claim',{messageId:body.messageId,forceRetry:body.retry===true});if(!claimed.claimed)return reply({ok:true,state:claimed.state});
  const m=claimed.message,t=claimed.translation;
  try{
   let original=m.body;
   if(m.kind==='voice'){const audio=await bucket.download(m.object_path);if(audio.error)throw Error('Voice unavailable');original=await transcribeMessage(key,audio.data,m.object_path.split('/').pop());}
   const translated=await translateMessage(key||'',original,t.language,fetch,m.kind==='voice'?undefined:m.source_language);let audioPath=null;
   if(m.kind==='voice'){const audio=await speakMessage(key,translated,t.language);audioPath=body.orderId+'/translations/'+m.id+'/'+t.language+'/'+t.lease+'.mp3';const saved=await bucket.upload(audioPath,audio,{contentType:'audio/mpeg',upsert:true});if(saved.error)throw Error('Speech upload unavailable');}
   await rpc('complete',{messageId:m.id,lease:t.lease,translatedText:translated,transcript:m.kind==='voice'?original:null,audioPath});return reply({ok:true,state:'ready'});
  }catch{await rpc('fail',{messageId:m.id,lease:t.lease});return reply({ok:false,code:'TRANSLATION_FAILED',error:'Не удалось перевести сообщение. Оригинал сохранён.'},502);}
 }catch(e){const message=e instanceof Error?e.message:'';if(/Telegram|signature/i.test(message))return reply({ok:false,error:'Не удалось проверить Telegram'},401);if(errors[message])return reply({ok:false,code:message,error:errors[message]},message==='CHAT_ACCESS'?403:message==='CHAT_RATE'?429:409);console.error('Delivery chat request rejected');return reply({ok:false,error:'Не удалось выполнить действие в чате. Повторите попытку.'},400);}
});
