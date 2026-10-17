import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {randomUUID,createHmac} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {JSDOM,VirtualConsole} from 'jsdom';
import {verifyTelegramInitData} from '../supabase/functions/delivery-chat/auth.ts';
import {translateMessage,transcribeMessage,speakMessage,validMedia,freeTranslation,translationChunks} from '../supabase/functions/delivery-chat/translation.ts';
const db=new PGlite(),order=randomUUID(),cafe=randomUUID();
const q=(s,a=[])=>db.query(s,a);
try{
 await db.exec(readFileSync('tests/fixtures/supabase-public-schema.sql','utf8'));
 await db.exec('create role anon;create role authenticated;create role service_role;create schema storage;create table storage.objects(bucket_id text,name text,metadata jsonb);');
 await db.exec("create schema umma_private; create table umma_private.cafe_notifications(id uuid default gen_random_uuid(),order_id uuid,recipient bigint,workspace text,kind text,title text,send_to_bot boolean);");
 await db.exec(readFileSync('supabase/proposals/delivery-chat.sql','utf8'));
 await q("insert into telegram_users(telegram_id,role,language_code) values(10,'user','ru'),(20,'employee','vi'),(30,'user','en'),(40,'employee','en')");
 await q("insert into locations(id,name,location_type) values($1,'Isolated test cafe','cafe')",[cafe]);
 await q("insert into cafe_orders(id,location_id,customer_telegram_id,courier_telegram_id,order_type,delivery_status,delivery_address) values($1,$2,10,20,'delivery','courier_assigned','Isolated test address')",[order,cafe]);
 const action=async(actor,act,body={},id=order)=>(await q('select delivery_chat_action($1,$2,$3,$4) v',[actor,act,id,JSON.stringify(body)])).rows[0].v;
 assert.equal((await action(10,'list',{language:'ru'})).context.peerLanguage,'vi');
 assert.equal((await action(20,'list',{language:'ja'})).context.language,'ja');assert.equal((await action(10,'list')).context.peerLanguage,'ja');
 await assert.rejects(action(30,'list'),/CHAT_ACCESS/);await assert.rejects(action(10,'list',{},randomUUID()),/CHAT_ACCESS/);
 const payload={kind:'text',text:'Я у входа <script>alert(1)</script>',requestKey:randomUUID()};
 const first=await action(10,'send',payload),replay=await action(10,'send',payload);assert.equal(first.message.id,replay.message.id);assert.equal(replay.replayed,true);
 await assert.rejects(action(10,'send',{...payload,text:'Different'}),/CHAT_KEY_REUSED/);
 const recipient=await action(20,'list');assert.equal(recipient.messages.length,1);assert.equal(recipient.messages[0].own,false);assert.equal(recipient.messages[0].body,payload.text);
 assert.ok((await action(10,'list')).messages[0].read_at);
 let claim=await action(20,'claim',{messageId:first.message.id});assert.equal(claim.claimed,true);assert.equal(claim.translation.language,'ja');assert.equal((await action(20,'claim',{messageId:first.message.id})).claimed,false);
 await assert.rejects(action(10,'claim',{messageId:first.message.id}),/CHAT_ACCESS/);
 await assert.rejects(action(20,'complete',{messageId:first.message.id,lease:randomUUID(),translatedText:'入口にいます。'}),/CHAT_LEASE/);
 await action(20,'complete',{messageId:first.message.id,lease:claim.translation.lease,translatedText:'入口にいます。'});
 assert.equal((await action(20,'list')).messages[0].translation.body,'入口にいます。');assert.equal((await action(20,'claim',{messageId:first.message.id})).claimed,false);
 const reply=await action(20,'send',{kind:'text',text:'到着しました',requestKey:randomUUID()});const replyClaim=await action(10,'claim',{messageId:reply.message.id});assert.equal(replyClaim.translation.language,'ru');
 let retryClaim=replyClaim;
 for(let i=0;i<3;i++){
  if(!retryClaim.claimed)retryClaim=await action(10,'claim',{messageId:reply.message.id});
  await action(10,'fail',{messageId:reply.message.id,lease:retryClaim.translation.lease});
  await q("update umma_private.delivery_chat_translations set leased_until=clock_timestamp()-interval '1 second' where message_id=$1",[reply.message.id]);
  if(i<2)retryClaim=await action(10,'claim',{messageId:reply.message.id});
 }
 assert.equal((await action(10,'claim',{messageId:reply.message.id})).claimed,false,'automatic retries are bounded');
 retryClaim=await action(10,'claim',{messageId:reply.message.id,forceRetry:true});assert.equal(retryClaim.claimed,true,'recipient can retry after provider credit is restored');
 await action(10,'complete',{messageId:reply.message.id,lease:retryClaim.translation.lease,translatedText:'Я приехал.'});
 assert.equal((await action(10,'claim',{messageId:reply.message.id,forceRetry:true})).claimed,false,'manual retry cannot rebill a ready translation');
 const prepare=await action(10,'prepare',{kind:'photo',mime:'image/png',size:8,text:'Вход',requestKey:randomUUID()});
 assert.equal((await action(20,'list')).messages.length,2,'unconfirmed attachments are hidden');
 await assert.rejects(action(10,'finish',{messageId:prepare.message.id}),/CHAT_UPLOAD/);
 await q("insert into storage.objects values('delivery-chat',$1,$2)",[prepare.message.object_path,JSON.stringify({size:9,mimetype:'image/png'})]);
 await assert.rejects(action(10,'finish',{messageId:prepare.message.id}),/CHAT_UPLOAD/);
 await q('update storage.objects set metadata=$1',[JSON.stringify({size:8,mimetype:'image/png'})]);
 await action(10,'finish',{messageId:prepare.message.id});await action(10,'finish',{messageId:prepare.message.id});
 assert.equal((await action(20,'list')).messages.length,3);
 assert.equal(Number((await q("select count(*) n from umma_private.cafe_notifications where kind='chat'")).rows[0].n),3,'retries do not duplicate notifications');
 await assert.rejects(action(10,'prepare',{kind:'photo',mime:'text/html',size:8,text:'',requestKey:randomUUID()}),/CHAT_INPUT/);
 await assert.rejects(action(10,'prepare',{kind:'video',mime:'video/mp4',size:20971521,text:'',requestKey:randomUUID()}),/CHAT_INPUT/);
 await q('update cafe_orders set courier_telegram_id=40 where id=$1',[order]);await assert.rejects(action(20,'list'),/CHAT_ACCESS/);assert.equal((await action(40,'list')).messages.length,0,'replacement courier does not inherit private previous conversation');
 await assert.rejects(action(40,'media',{messageId:prepare.message.id}),/CHAT_ACCESS/);
 await q('update cafe_orders set courier_telegram_id=20,status=\'completed\' where id=$1',[order]);
 assert.equal((await action(10,'list')).context.canSend,false);await assert.rejects(action(10,'send',{...payload,requestKey:randomUUID()}),/CHAT_CLOSED/);assert.equal((await action(10,'send',payload)).replayed,true,'acknowledgement replay remains safe after closure');
 for(const role of ['anon','authenticated'])assert.equal((await q("select has_function_privilege($1,'delivery_chat_action(bigint,text,uuid,jsonb)','execute') v",[role])).rows[0].v,false);
 await q("update cafe_orders set status='pending' where id=$1",[order]);
 for(let i=0;i<18;i++)await action(10,'send',{kind:'text',text:'rate test',requestKey:randomUUID()});
 await assert.rejects(action(10,'send',{kind:'text',text:'rate test',requestKey:randomUUID()}),/CHAT_RATE/);
 assert.equal(validMedia(new Uint8Array([137,80,78,71,13,10,26,10]),'image/png'),true);assert.equal(validMedia(new TextEncoder().encode('<script>'),'image/png'),false);
 const calls=[];const provider=async(url,options)=>{calls.push({url,options});if(url.endsWith('/responses'))return new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({translatedText:'Tôi đang ở lối vào.'})}]}]}));if(url.endsWith('/transcriptions'))return new Response(JSON.stringify({text:'Я у входа.'}));return new Response(new Uint8Array([255,251,1]));};
 const original=await transcribeMessage('fake-local-test',new Blob(['synthetic voice']),'voice.webm',provider);assert.equal(await translateMessage('fake-local-test',original,'vi',provider),'Tôi đang ở lối vào.');assert.equal((await speakMessage('fake-local-test','Tôi đang ở lối vào.','vi',provider)).size,3);
 assert.equal(JSON.parse(calls[1].options.body).store,false);assert.equal(JSON.parse(calls[2].options.body).response_format,'mp3');
 await assert.rejects(translateMessage('fake','text','vi',async()=>new Response('limited',{status:429})),/provider 429/);
 // Keyless provider: Cyrillic/emoji byte limits, direction, quota and output validation.
 const freeCalls=[],freeProvider=async(url,options)=>{const u=new URL(url);freeCalls.push(u);assert.equal(u.origin,'https://api.mymemory.translated.net');assert.equal(u.pathname,'/get');assert.ok(new TextEncoder().encode(u.searchParams.get('q')).length<=500);assert.equal(options.redirect,'error');return new Response(JSON.stringify({responseStatus:200,quotaFinished:false,responseData:{translatedText:'Tôi ở lối vào.'}}));};
 assert.equal(await translateMessage('','Я у входа.','vi',freeProvider,'ru'),'Tôi ở lối vào.');assert.equal(freeCalls[0].searchParams.get('langpair'),'ru|vi');
 assert.equal(await freeTranslation('hello','en','en',()=>{throw Error('Same language must not call provider');}),'hello');
 const long='Привет 👨‍👩‍👧‍👦 '.repeat(130);for(const chunk of translationChunks(long))assert.ok(new TextEncoder().encode(chunk).length<=480);
 const multiline=await freeTranslation('Первая строка.\n\nВторая строка.','ru','vi',freeProvider);assert.match(multiline,/\n\n/);
 await assert.rejects(freeTranslation('text','en','vi',async()=>new Response(JSON.stringify({responseStatus:403,responseData:{translatedText:'MYMEMORY WARNING'}}))),/quota/);
 await assert.rejects(freeTranslation('text','en','vi',async()=>new Response(JSON.stringify({responseStatus:200,quotaFinished:true,responseData:{translatedText:'quota'}}))),/quota/);
 await assert.rejects(freeTranslation('text','en','vi',async()=>new Response(JSON.stringify({responseStatus:200,responseData:{translatedText:''}}))),/output/);
 await assert.rejects(freeTranslation('text','xx','vi',freeProvider),/input/);
 // Execute the deployed entrypoint against the isolated SQL engine and provider double.
 let handler,notificationRuns=0,dbCalls=0,serverKey='fake';
 const client={from:name=>{assert.equal(name,'cafe_orders');const filters={};const chain={select(){return chain;},eq(key,value){filters[key]=value;return chain;},async maybeSingle(){return {data:(await q('select id from cafe_orders where id=$1 and customer_telegram_id=$2 and courier_telegram_id=$3',[filters.id,filters.customer_telegram_id,filters.courier_telegram_id])).rows[0]||null};}};return chain;},rpc:async(name,args)=>{assert.equal(name,'delivery_chat_action');dbCalls++;try{return {data:await action(args.p_actor,args.p_action,args.p_body,args.p_order),error:null};}catch(e){return {data:null,error:{message:e.message}};}},storage:{from:name=>{assert.equal(name,'delivery-chat');return {
  createSignedUrls:async paths=>({data:paths.map(path=>({path,signedUrl:'https://isolated.invalid/'+path}))}),
  createSignedUploadUrl:async path=>({data:{signedUrl:'https://isolated.invalid/upload/'+path}}),
  createSignedUrl:async path=>({data:{signedUrl:'https://isolated.invalid/'+path}}),download:async()=>({data:new Blob([new Uint8Array([26,69,223,163,0,0,0,0])])}),upload:async()=>({error:null})
 };}}};
 const bot='fake-test-bot-token';
 const signed=id=>{const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id})});const c=[...p].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');p.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(bot).digest()).update(c).digest('hex'));return p.toString();};
 vm.runInNewContext(stripTypeScriptTypes(readFileSync('supabase/functions/delivery-chat/index.ts','utf8')).replace(/^import .*;\n/gm,''),{
  Deno:{serve:fn=>handler=fn,env:{get:key=>({TELEGRAM_BOT_TOKEN:bot,SUPABASE_URL:'https://isolated.invalid',SUPABASE_SERVICE_ROLE_KEY:'fake',OPENAI_API_KEY:serverKey})[key]}},
  createClient:()=>client,verifyTelegramInitData,translateMessage:(k,t,l,send,source)=>translateMessage(k,t,l,source?freeProvider:provider,source),transcribeMessage:(k,b,f)=>transcribeMessage(k,b,f,provider),speakMessage:(k,t,l)=>speakMessage(k,t,l,provider),validMedia,languageNames:{ru:'Russian',vi:'Vietnamese'},dispatchCustomerNotifications:async()=>{notificationRuns++;},fetch:async()=>new Response(new Uint8Array([26,69,223,163,0,0,0,0])),Response,Request,Uint8Array,Map,Set,AbortSignal,Error,crypto,TextEncoder,console
 });
 const post=async(actor,body)=>{const r=await handler(new Request('https://isolated.invalid',{method:'POST',body:JSON.stringify({initData:signed(actor),orderId:order,language:'ru',...body})}));return {status:r.status,data:await r.json()};};
 const beforeAuth=dbCalls;assert.equal((await post(20,{initData:'tampered',action:'list'})).status,401);assert.equal(dbCalls,beforeAuth);
 assert.equal((await post(30,{action:'list'})).status,403);assert.equal((await post(10,{action:'finish',messageId:prepare.message.id})).status,200);
 const voice=await post(20,{action:'prepare',requestKey:randomUUID(),kind:'voice',mime:'audio/webm',text:'',size:8});assert.equal(voice.status,200);assert.ok(voice.data.uploadUrl);
 const pending=(await action(20,'media',{messageId:voice.data.messageId})).message;
 await q("insert into storage.objects values('delivery-chat',$1,$2)",[pending.object_path,JSON.stringify({size:8,mimetype:'audio/webm'})]);
 assert.equal((await post(20,{action:'finish',messageId:pending.id})).status,200);
 const callsBefore=calls.length;assert.equal((await post(10,{action:'translate',messageId:pending.id})).data.state,'ready');assert.equal(calls.length,callsBefore+3,'real entrypoint invokes transcription, translation and speech once');
 assert.equal((await post(10,{action:'translate',messageId:pending.id})).data.state,'ready');assert.equal(calls.length,callsBefore+3,'ready translation cache prevents repeat provider billing');
 const listing=(await post(10,{action:'list'})).data;const rendered=listing.messages.find(m=>m.id===pending.id);assert.ok(rendered.mediaUrl);assert.ok(rendered.translation.audioUrl);assert.equal(rendered.object_path,undefined);assert.equal(rendered.sender,undefined);assert.equal(rendered.translation.lease,undefined);assert.ok(notificationRuns>0);
 serverKey='';
 const keylessMessage=await post(20,{action:'send',requestKey:randomUUID(),kind:'text',text:'Synthetic keyless message',language:'vi'});assert.equal(keylessMessage.status,200);
 const beforeFree=freeCalls.length;const keyless=await post(10,{action:'translate',messageId:keylessMessage.data.messageId});assert.equal(keyless.data.state,'ready','authenticated keyless text uses saved sender language and free provider');
 assert.equal(freeCalls.length,beforeFree+1);assert.equal((await post(10,{action:'list'})).data.translationConfigured,true);
 // Two independent client UIs communicate through the real Edge handler and SQL RPC.
 const linkOrder=randomUUID();await q("insert into telegram_users(telegram_id,role,language_code) values(101,'user','ru'),(202,'employee','vi')");
 await q("insert into cafe_orders(id,location_id,customer_telegram_id,courier_telegram_id,order_type,delivery_status,delivery_address) values($1,$2,101,202,'delivery','courier_assigned','Synthetic linked UI address')",[linkOrder,cafe]);
 const html=readFileSync('index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),windows=[];
 const until=async check=>{for(let i=0;i<200;i++){if(check())return;await new Promise(r=>setTimeout(r,5));}assert.fail('Linked chat UI timed out: '+windows.map(w=>w.document.querySelector('.delivery-chat-dialog')?.textContent).join(' / '));};
 const makeWindow=(actor,lang)=>{const dom=new JSDOM(html,{url:'https://isolated-link.invalid',runScripts:'outside-only',virtualConsole:new VirtualConsole()}),w=dom.window;windows.push(w);Object.defineProperty(w.document,'hidden',{value:false});
 w.crypto.randomUUID=randomUUID;w.AbortSignal.timeout=()=>undefined;w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLMediaElement.prototype.pause=function(){};
 w.Telegram={WebApp:{initData:signed(actor)}};w.ummaI18n={language:lang,t:s=>s,locale:()=>lang};w.fetch=async(url,options)=>handler(new Request('https://isolated.invalid',{method:options.method,body:options.body,headers:options.headers}));
 w.eval(readFileSync('js/cafe/delivery-chat.js','utf8'));const b=w.document.createElement('button');b.dataset.deliveryChat=linkOrder;w.document.body.append(b);b.click();return w;};
 try{
 const customer=makeWindow(101,'ru'),courier=makeWindow(202,'vi');
 await until(()=>!customer.document.querySelector('.chat-compose textarea').disabled&&!courier.document.querySelector('.chat-compose textarea').disabled);
 const sendFrom=(w,text)=>{const input=w.document.querySelector('.chat-compose textarea');input.value=text;input.dispatchEvent(new w.Event('input'));w.document.querySelector('form.chat-compose').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));};
 sendFrom(customer,'Synthetic customer message 13');await until(()=>customer.document.querySelector('.chat-compose textarea').value==='');
 courier.document.dispatchEvent(new courier.Event('visibilitychange'));await until(()=>courier.document.querySelector('.chat-message'));
 assert.match(courier.document.querySelector('.chat-message').textContent,/Synthetic customer message 13|Tôi ở lối vào/);
 sendFrom(courier,'Synthetic courier reply 13');await until(()=>courier.document.querySelector('.chat-compose textarea').value==='');
 customer.document.dispatchEvent(new customer.Event('visibilitychange'));await until(()=>customer.document.querySelectorAll('.chat-message').length===2);
 const linked=await action(101,'list',{language:'ru'},linkOrder);assert.equal(linked.messages.length,2);assert.equal(linked.messages[0].sender,101);assert.equal(linked.messages[1].sender,202);assert.equal(linked.messages[1].recipient,101);
 assert.equal(customer.document.querySelector('.chat-compose [type="submit"]').disabled,false);assert.equal(courier.document.querySelector('.chat-compose [type="submit"]').disabled,false);
 console.log('PASS two linked independent chat UIs: customer sends, courier receives and replies, customer receives; real Edge HMAC and SQL; no live accounts or messages');
 }finally{for(const w of windows){w.ummaDeliveryChat.close();w.close();}}
 await q('update cafe_orders set courier_telegram_id=customer_telegram_id where id=$1',[order]);
 const selfChat=await post(10,{action:'list'});assert.equal(selfChat.status,409);assert.equal(selfChat.data.code,'CHAT_SELF');assert.match(selfChat.data.error,/два разных аккаунта/);
 console.log('PASS private delivery chat: customer/current courier authorization, reassignment isolation, closed chat, idempotent text/media and notifications, verified upload metadata, opposite language preferences, translation cache/lease, attachment MIME/size/rate guards, protected RPC; STT→translation→TTS pipeline with isolated provider double');
}catch(e){console.error({message:e.message,position:e.position,internalPosition:e.internalPosition,internalQuery:e.internalQuery,where:e.where});process.exitCode=1;}finally{await db.close();}
