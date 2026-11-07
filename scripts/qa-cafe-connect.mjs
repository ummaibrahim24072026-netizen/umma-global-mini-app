import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {JSDOM} from 'jsdom';
import {webcrypto,randomUUID} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
const source=p=>readFileSync(p,'utf8');
const loadConnect=(window,entry)=>{
 window.eval(source('js/cafe/connect-media.js'));
 window.eval(source('js/cafe/connect-composer.js'));
 window.eval(source('js/cafe/'+entry+'.js'));
};
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role;create schema umma_private;create schema net;create schema cron;
create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language sql as $$select 1::bigint$$;
create function cron.schedule(text,text,text) returns bigint language sql as $$select 1::bigint$$;
create table umma_private.cafe_push_config(value jsonb);create table telegram_users(telegram_id bigint,is_active boolean,role text);
insert into telegram_users values(1,true,'super_admin'),(2,true,'employee'),(3,false,'super_admin');
select set_config('request.jwt.claims','{"role":"service_role"}',false);`);
await db.exec(source('supabase/proposals/cafe-connect.sql'));
const rpc=async(action,hash='',actor=null,data={})=>(await db.query('select cafe_connect($1,$2,$3,$4) result',[action,hash,actor,data])).rows[0].result;
const a='a'.repeat(64),b='b'.repeat(64),sub={endpoint:'https://fcm.googleapis.com/synthetic',keys:{p256dh:'x',auth:'y'}};
const ca=(await rpc('join',a)).client.id,cb=(await rpc('join',b)).client.id;
assert.equal((await rpc('join',a)).client.id,ca);
await rpc('preferences',a,null,{promotions:true,language:'ru',subscription:sub});
await rpc('preferences',b,null,{language:'vi',subscription:sub});
await assert.rejects(rpc('staffList','',2),/Access denied/);
await assert.rejects(rpc('staffList','',3),/Access denied/);
await assert.rejects(rpc('list','c'.repeat(64)),/Channel unavailable/);
const key=randomUUID();await rpc('send',a,null,{requestKey:key,body:'<script>feedback</script>'});await rpc('send',a,null,{requestKey:key,body:'retry'});
assert.equal((await rpc('list',a)).messages.length,1);assert.equal((await rpc('list',b)).messages.length,0);
let staff=await rpc('staffList','',1);assert.equal(staff.total,2);assert.equal(staff.subscribers,1);assert.equal(staff.clients.find(c=>c.id===ca).unread,1);
const customerMessage=(await rpc('list',a)).messages[0];
assert.equal(customerMessage.read_at,null);
await rpc('staffRead','',1,{clientId:ca,before:customerMessage.created_at});
const customerReadAt=(await rpc('list',a)).messages[0].read_at;
assert.ok(customerReadAt);
assert.equal((await rpc('staffList','',1)).clients.find(c=>c.id===ca).unread,0);
const reply=randomUUID();await rpc('staffReply','',1,{clientId:ca,requestKey:reply,body:'Reply'});await rpc('staffReply','',1,{clientId:ca,requestKey:reply,body:'Reply'});
assert.equal((await rpc('list',a)).messages.length,2);assert.equal((await rpc('list',b)).messages.length,0);
const staffThread=()=>rpc('staffThread','',1,{clientId:ca});
const staffReply=(await staffThread()).messages[1];
assert.equal(staffReply.read_at,null);
await rpc('read',b,null,{before:staffReply.created_at});
assert.equal((await staffThread()).messages[1].read_at,null);
await rpc('read',a,null,{before:staffReply.created_at});
const staffReadAt=(await staffThread()).messages[1].read_at;
assert.ok(staffReadAt);
await rpc('read',a,null,{before:staffReply.created_at});
assert.deepEqual((await staffThread()).messages.map(message=>message.read_at),[customerReadAt,staffReadAt]);
const campaign={requestKey:randomUUID(),title:'New menu',body:'New dish',language:'all'};
assert.equal((await rpc('staffCampaign','',1,campaign)).recipients,1);assert.equal((await rpc('staffCampaign','',1,campaign)).recipients,1);
assert.equal((await rpc('list',a)).messages.length,3);assert.equal((await rpc('list',b)).messages.length,0);
await rpc('preferences',a,null,{promotions:false});let jobs=await rpc('lease');assert.equal(jobs.length,1); // withdrawn campaigns must never be sent
assert.equal((await rpc('lease')).length,0);await rpc('finish','',null,{id:jobs[0].id,lease:randomUUID(),success:true});
assert.equal((await db.query('select count(*)::int n from umma_private.cafe_connect_jobs where sent_at is not null')).rows[0].n,0);
await rpc('finish','',null,{id:jobs[0].id,lease:jobs[0].lease,success:false,gone:true,subscription:sub});assert.equal((await rpc('list',a)).client.pushEnabled,false);
const p=(await db.query("select has_function_privilege('anon','cafe_connect(text,text,bigint,jsonb)','execute') a,has_table_privilege('authenticated','umma_private.cafe_connect_clients','select') b")).rows[0];assert.equal(p.a,false);assert.equal(p.b,false);
// Audience counts actual sessions separately from contact-channel opt-ins.
await db.exec(`
 create table public.cafe_orders(id uuid primary key);
 create table umma_private.public_guest_requests(order_id uuid,request_key uuid);
`);
await db.exec(source('supabase/proposals/cafe-audience.sql'));
const visit=async(hash,point='',installed=false,id=null,request=null)=>(await db.query(
 'select cafe_menu_visit($1,$2,$3,$4,$5) result',[hash,point,installed,id,request])).rows[0].result;
const audience=async(segment='all',actor=1)=>(await db.query(
 'select cafe_menu_audience($1,$2,0) result',[actor,segment])).rows[0].result;
const guest='c'.repeat(64);
await visit(guest,'neighbor-cafe-01');
await visit(guest,'neighbor-cafe-01');
await visit(a,'',true);
let overview=await audience();
assert.equal(overview.devices,2);
assert.equal(overview.visits,2);
assert.equal(overview.firstTimers,2);
assert.equal(overview.installed,1);
assert.equal(overview.points.find(p=>p.point==='neighbor-cafe-01').devices,1);
assert.equal(overview.guests.find(g=>g.installed).client_id,ca);
assert.equal((await rpc('staffList','',1)).total,2); // anonymous visitor didn't join
await assert.rejects(audience('all',2),/Access denied/);
assert.equal((await db.query("select has_function_privilege('anon','cafe_menu_audience(bigint,text,integer)','execute') allowed")).rows[0].allowed,false);
await db.exec("update umma_private.cafe_menu_visits set last_seen_at=now()-interval '31 minutes'");
assert.equal((await audience('viewed')).matched,2);
assert.equal((await audience()).withoutOrder,2);
await visit(guest,'neighbor-cafe-01');
assert.equal((await audience('returning')).matched,1);
const firstOrder=randomUUID(),secondOrder=randomUUID(),firstProof=randomUUID(),secondProof=randomUUID();
await db.query('insert into public.cafe_orders(id) values($1),($2)',[firstOrder,secondOrder]);
await db.query('insert into umma_private.public_guest_requests values($1,$2),($3,$4)',[firstOrder,firstProof,secondOrder,secondProof]);
await assert.rejects(visit(guest,'neighbor-cafe-01',false,firstOrder,secondProof),/Order unavailable/);
await visit(guest,'neighbor-cafe-01',false,firstOrder,firstProof);
await visit(guest,'neighbor-cafe-01',false,firstOrder,firstProof);
assert.equal((await audience('regular')).matched,0);
await visit(guest,'neighbor-cafe-01',false,secondOrder,secondProof);
assert.equal((await audience('regular')).guests[0].orders,2);
await rpc('preferences',a,null,{promotions:true,subscription:sub});
await rpc('preferences',b,null,{promotions:true,subscription:sub});
await db.exec("update umma_private.cafe_connect_campaigns set created_at=now()-interval '1 minute'");
const installedCampaign={...campaign,requestKey:randomUUID(),installedOnly:true};
assert.equal((await rpc('staffCampaign','',1,installedCampaign)).recipients,1);
assert.equal((await rpc('staffCampaign','',1,installedCampaign)).recipients,1);
assert.equal((await audience('push')).matched,1);
// Public news only includes intentionally published all-customer campaigns.
await db.exec(source('supabase/proposals/cafe-menu-news.sql'));
await db.exec(source('supabase/proposals/cafe-menu-news.sql'));
assert.deepEqual((await rpc('news')).news,[]);
await db.exec("update umma_private.cafe_connect_campaigns set created_at=now()-interval '1 minute'");
const news={requestKey:randomUUID(),title:'New dish',body:'Today',language:'all',publicNews:true};
assert.equal((await rpc('staffCampaign','',1,news)).recipients,2);
assert.equal((await rpc('staffCampaign','',1,news)).recipients,2);
assert.equal((await rpc('news')).news[0].title,'New dish');
await db.exec("update umma_private.cafe_connect_campaigns set created_at=now()-interval '1 minute'");
await rpc('staffCampaign','',1,{...news,requestKey:randomUUID(),language:'vi',title:'Private language campaign'});
await db.exec("update umma_private.cafe_connect_campaigns set created_at=now()-interval '1 minute'");
await rpc('staffCampaign','',1,{...news,requestKey:randomUUID(),installedOnly:true,title:'Private installed campaign'});
assert.deepEqual((await rpc('news')).news.map(item=>item.title),['New dish']);
await db.exec(`
 create schema storage;
 create table storage.buckets(id text,name text,public bool,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(bucket_id text);
 alter table storage.objects enable row level security;
`);
await db.exec(source('supabase/proposals/cafe-connect-media.sql'));
const mediaKey=randomUUID(),mediaPath=ca+'/'+randomUUID();
assert.equal((await rpc('mediaPrepare',a,null,{requestKey:mediaKey})).clientId,ca);
await assert.rejects(rpc('mediaSend',a,null,{requestKey:mediaKey,body:'',kind:'voice',path:cb+'/'+randomUUID()}),/Invalid attachment/);
const attachment=await rpc('mediaSend',a,null,{requestKey:mediaKey,body:'',kind:'voice',path:mediaPath});
assert.equal((await rpc('mediaPrepare',a,null,{requestKey:mediaKey})).id,attachment.id);
assert.equal((await rpc('mediaSend',a,null,{requestKey:mediaKey,body:'',kind:'voice',path:ca+'/'+randomUUID()})).path,mediaPath);
const mediaMessage=(await rpc('list',a)).messages.find(m=>m.id===attachment.id);
assert.equal(mediaMessage.media_kind,'voice');
assert.ok(!('object_path' in mediaMessage));
assert.equal((await rpc('staffList','',1)).clients.find(c=>c.id===ca).last_message,'Голосовое сообщение');
await assert.rejects(rpc('mediaGet',b,null,{messageId:attachment.id}),/Access denied/);
await assert.rejects(rpc('staffMediaGet','',2,{clientId:ca,messageId:attachment.id}),/Access denied/);
await assert.rejects(rpc('staffMediaGet','',1,{clientId:cb,messageId:attachment.id}),/Access denied/);
assert.equal((await rpc('mediaGet',a,null,{messageId:attachment.id})).path,mediaPath);
assert.equal((await rpc('staffMediaGet','',1,{clientId:ca,messageId:attachment.id})).path,mediaPath);
await db.exec(source('supabase/proposals/cafe-connect-replies.sql'));
const staffAttachmentKey=randomUUID(),staffPath=ca+'/'+randomUUID();
const staffArgs={clientId:ca,requestKey:staffAttachmentKey,body:'',kind:'voice',path:staffPath};
await assert.rejects(rpc('staffMediaPrepare','',2,staffArgs),/Access denied/);
assert.equal((await rpc('staffMediaPrepare','',1,staffArgs)).clientId,ca);
const staffAttachment=await rpc('staffMediaSend','',1,staffArgs);
assert.equal((await rpc('staffMediaSend','',1,staffArgs)).id,staffAttachment.id);
assert.equal((await rpc('list',a)).messages.find(m=>m.id===staffAttachment.id).direction,'staff');
assert.equal((await rpc('mediaGet',a,null,{messageId:staffAttachment.id})).path,staffPath);
assert.equal((await rpc('lease')).find(j=>j.messageId===staffAttachment.id).body,'Голосовое сообщение');
const viVoice={messageId:staffAttachment.id,language:'vi'};
await assert.rejects(rpc('voiceClaim',b,null,viVoice),/Access denied/);
await assert.rejects(rpc('staffVoiceClaim','',1,{...viVoice,clientId:ca}),/Access denied/);
const viClaim=await rpc('voiceClaim',a,null,viVoice);
assert.equal(viClaim.status,'claimed');
assert.equal(viClaim.path,staffPath);
assert.equal((await rpc('voiceClaim',a,null,viVoice)).status,'pending');
await assert.rejects(rpc('voiceComplete',a,null,{...viVoice,lease:randomUUID(),text:'Bad'}),/lease expired/);
await rpc('voiceComplete',a,null,{...viVoice,lease:viClaim.lease,text:'Xin chào',audioPath:'translated.mp3'});
assert.deepEqual(await rpc('voiceClaim',a,null,viVoice),{ok:true,status:'ready',text:'Xin chào',audioPath:'translated.mp3'});
assert.equal((await rpc('voiceClaim',a,null,{...viVoice,language:'en'})).status,'claimed');
assert.equal((await rpc('staffVoiceClaim','',1,{clientId:ca,messageId:attachment.id,language:'ru'})).path,mediaPath);
await db.exec(`select set_config('request.jwt.claims','{"role":"anon"}',false)`);await assert.rejects(rpc('list',a),/Access denied/);await assert.rejects(rpc('news'),/Access denied/);
await db.close();
// Browser: no automatic prompt, explicit opt-in, idempotent feedback, literal rendering.
const dom=new JSDOM('<html lang="ru"><body><header></header></body></html>',{url:'https://qa.invalid/app/menu/',runScripts:'outside-only'}),w=dom.window;let prompts=0,calls=[];
w.AbortSignal=AbortSignal;Object.defineProperty(w.crypto,'getRandomValues',{value:a=>webcrypto.getRandomValues(a)});w.crypto.randomUUID=randomUUID;
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.Notification={requestPermission(){prompts++;return Promise.resolve('denied');}};
w.fetch=async(url,init)=>{const data=JSON.parse(init.body);calls.push(data);return new Response(JSON.stringify({ok:true,client:{id:ca,name:'',promotions:false,pushEnabled:false},messages:data.action==='send'?[{id:'m',body:data.body,direction:'customer',created_at:new Date().toISOString()}]:[]}));};
loadConnect(w,'customer-connect');assert.equal(prompts,0);assert.equal(calls.length,0);w.document.querySelector('button').click();
w.document.querySelector('dialog .primary').click();await new Promise(r=>setTimeout(r,40));assert.equal(calls[0].action,'join');assert.equal(calls[0].token.length,64);assert.equal(w.document.querySelector('input[type=checkbox]').checked,false);
w.document.querySelector('textarea').value='<img src=x onerror=alert(1)>';w.document.querySelector('form').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,40));assert.ok(w.document.querySelector('li').textContent.includes('<img'));assert.equal(w.document.querySelector('li img'),null);assert.ok(calls.some(c=>c.action==='send'&&c.requestKey));assert.equal(prompts,0);w.close();
// Installed client: a reply is visible without push and remains unread until the chat opens.
{
 const app=new JSDOM('<html lang="ru"><body><header></header></body></html>',{
  url:'https://qa.invalid/app/menu/',runScripts:'outside-only',pretendToBeVisual:true
 });
 const client=app.window,worker=new client.EventTarget(),badgeUpdates=[];
 const credential='a'.repeat(64),reply={id:'staff-reply',direction:'staff',title:'UMMA',body:'Ответ кафе',created_at:'2026-11-07T12:00:00Z',read_at:null};
 const sent={...reply,id:'customer-message',direction:'customer',body:'Вопрос',created_at:'2026-11-07T11:59:00Z'};
 let pushEnabled=false,prompts=0;
 client.localStorage.setItem('umma:connect:token:v1',credential);
 client.AbortSignal=AbortSignal;
 client.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 client.PushManager=class{};
 client.Notification={permission:'default',async requestPermission(){prompts++;this.permission='granted';return this.permission;}};
 const registration={pushManager:{async getSubscription(){return {toJSON:()=>sub};}}};
 worker.ready=Promise.resolve(registration);
 worker.register=async()=>registration;
 worker.controller={postMessage:m=>badgeUpdates.push(m)};
 Object.defineProperty(client.navigator,'serviceWorker',{value:worker});
 client.fetch=async(url,init)=>{
  const request=JSON.parse(init.body);
  if(request.action==='config')return new Response(JSON.stringify({ok:true,publicKey:Buffer.alloc(65).toString('base64url')}));
  assert.equal(request.token,credential);
  if(request.action==='read'){assert.equal(request.before,reply.created_at);reply.read_at=reply.created_at;}
  if(request.action==='preferences'){assert.deepEqual(request.subscription,sub);pushEnabled=true;}
  return new Response(JSON.stringify({ok:true,client:{name:'',promotions:false,pushEnabled},messages:[sent,reply]}));
 };
 const tick=()=>new Promise(resolve=>setTimeout(resolve,30));
 loadConnect(client,'customer-connect');
 await tick();
 assert.equal(prompts,0);
 assert.equal(badgeUpdates.at(-1).count,1);
 assert.match(client.document.querySelector('.umma-connect-button').textContent,/1$/);
 await client.ummaCustomerConnect.open();
 assert.match(client.document.querySelector('.connect-thread').textContent,/Ответ кафе/);
 assert.equal(badgeUpdates.at(-1).count,0);
 assert.deepEqual([...client.document.querySelectorAll('.connect-receipt')].map(n=>n.textContent),['Отправлено']);
 sent.read_at='2026-11-07T12:01:00Z';
 client.dispatchEvent(new client.Event('online'));
 await tick();
 assert.match(client.document.querySelector('.connect-receipt').textContent,/^Прочитано сотрудником · .+$/);
 const enable=[...client.document.querySelectorAll('dialog button')].find(button=>button.textContent==='Включить уведомления об ответах');
 enable.click();
 await tick();
 assert.equal(prompts,1);
 assert.equal(pushEnabled,true);
 assert.equal(enable.hidden,true);
 app.window.close();
}
// The guest records first and uploads only on a separate Send tap.
{
 const app=new JSDOM('<html lang="ru"><body><header></header></body></html>',{
  url:'https://qa.invalid/app/menu/',runScripts:'outside-only',pretendToBeVisual:true
 });
 const guest=app.window,credential='a'.repeat(64);
 const writes=[],tracks=[];
 guest.AbortSignal=AbortSignal;
 guest.crypto.randomUUID=randomUUID;
 guest.Blob=Blob;
 guest.URL.createObjectURL=()=> 'blob:https://qa.invalid/preview';
 guest.URL.revokeObjectURL=()=>{};
 guest.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 guest.MediaRecorder=class{
  static isTypeSupported(type){return type==='audio/webm';}
  mimeType='audio/webm';
  state='inactive';
  start(){this.state='recording';}
  stop(){
   this.state='inactive';
   this.ondataavailable({data:new Blob([Uint8Array.of(26,69,223,163)])});
   queueMicrotask(()=>this.onstop());
  }
 };
 Object.defineProperty(guest.navigator,'mediaDevices',{value:{getUserMedia:async()=>({
  getTracks:()=>[{stop:()=>tracks.push('stopped')}]
 })}});
 guest.localStorage.setItem('umma:connect:token:v1',credential);
 guest.fetch=async(url,init)=>{
  if(init.body instanceof Blob){
   writes.push(init);
   if(writes.length===1)return new Response('{"ok":false,"code":"MEDIA_UPLOAD"}',{status:502});
   return new Response('{"ok":true,"id":"recording"}');
  }
  const messages=writes.length===2?[{id:'recording',direction:'customer',body:'Голос',
   created_at:'2026-11-07T12:00:00Z',media_kind:'voice'}]:[];
  return new Response(JSON.stringify({ok:true,client:{name:'',promotions:false,pushEnabled:false},messages}));
 };
 loadConnect(guest,'customer-connect');
 await guest.ummaCustomerConnect.open();
 const mic=[...guest.document.querySelectorAll('form button')].find(b=>b.textContent==='Записать голосовое');
 const tick=()=>new Promise(resolve=>setTimeout(resolve,20));
 mic.click();
 await tick();
 assert.equal(mic.textContent,'Остановить запись');
 mic.click();
 await tick();
 assert.ok(tracks.length);
 assert.ok(guest.document.querySelector('.connect-media-preview audio'));
 assert.equal(writes.length,0);
 guest.document.querySelector('textarea').value='Голос';
 const submit=()=>guest.document.querySelector('form').dispatchEvent(new guest.Event('submit',{cancelable:true}));
 submit();
 await tick();
 assert.ok(guest.document.querySelector('.connect-media-preview audio'));
 submit();
 await tick();
 assert.equal(writes[0].headers['X-Umma-Request'],writes[1].headers['X-Umma-Request']);
 assert.equal(writes[1].headers['X-Umma-Token'],credential);
 assert.equal(writes[1].headers['Content-Type'],'audio/webm');
 assert.ok((await writes[1].body.text()).startsWith('"Голос"\n'));
 assert.equal(guest.document.querySelector('.connect-media-preview audio'),null);
 assert.match(guest.document.querySelector('.connect-thread').textContent,/Прослушать голосовое/);
 guest.close();
}
// Staff inbox updates the receipt while the current conversation stays open.
{
 const app=new JSDOM('<header></header><main><section id="webMessages"></section></main>',{
  url:'https://qa.invalid/app/staff.html',runScripts:'outside-only',pretendToBeVisual:true
 });
 const staff=app.window;
 staff.AbortSignal=AbortSignal;
 staff.ummaRole='super_admin';
 Object.defineProperty(staff.navigator,'language',{value:'vi-VN'});
 staff.ummaStaffAuth={credential:()=> 'web:test'};
 let poll;
 staff.setInterval=callback=>{poll=callback;};
 const messages=[
  {id:'staff-view-question',direction:'customer',body:'Вопрос',media_kind:'voice',created_at:'2026-11-07T12:00:00Z',read_at:'2026-11-07T12:01:00Z'},
  {id:'staff-view-answer',direction:'staff',title:'UMMA',body:'Ответ',created_at:'2026-11-07T12:02:00Z',read_at:null}
 ];
 staff.fetch=async(url,init)=>{
  const request=JSON.parse(init.body);
  assert.equal(request.initData,'web:test');
  const client={id:ca,name:'Клиент',unread:0,last_message:'Ответ'};
  if(request.action==='staffVoice'){
   assert.equal(request.language,'vi');
   assert.equal(request.clientId,ca);
   assert.equal(request.messageId,'staff-view-question');
   return new Response(JSON.stringify({ok:true,status:'ready',text:'Bản dịch',url:'https://qa.invalid/translated.mp3'}));
  }
  if(request.action==='staffMediaGet'){
   assert.equal(request.clientId,ca);
   assert.equal(request.messageId,'staff-view-question');
   return new Response(JSON.stringify({ok:true,url:'https://qa.invalid/signed'}));
  }
  return new Response(JSON.stringify(request.action==='staffList'?
   {ok:true,clients:[client],subscribers:0,pushDevices:0}:{ok:true,client,messages,voiceTranslation:true}));
 };
 const tick=()=>new Promise(resolve=>setTimeout(resolve,30));
 loadConnect(staff,'connect-admin');
 staff.document.dispatchEvent(new staff.CustomEvent('umma:staff-tab',{detail:'messages'}));
 await tick();
 staff.document.querySelector('[data-client-thread]').click();
 await tick();
 assert.deepEqual([...staff.document.querySelectorAll('.connect-receipt')].map(n=>n.textContent),['Отправлено']);
 [...staff.document.querySelectorAll('.connect-thread button')].find(b=>b.textContent==='Прослушать голосовое').click();
 await tick();
 [...staff.document.querySelectorAll('.connect-thread button')].find(b=>b.textContent==='Перевод голоса').click();
 await tick();
 assert.equal(staff.document.querySelector('.connect-voice-translation [lang=vi]').textContent,'Bản dịch');
 assert.equal(staff.document.querySelector('.connect-voice-translation audio').src,'https://qa.invalid/translated.mp3');
 const audio=staff.document.querySelector('.connect-thread audio');
 assert.equal(audio.src,'https://qa.invalid/signed');
 assert.ok(staff.document.querySelector('input[type=file][accept^="video/"]'));
 assert.ok([...staff.document.querySelectorAll('.work-thread form button')].some(b=>b.textContent==='Записать голосовое'));
 messages[1].read_at='2026-11-07T12:03:00Z';
 await poll();
 await tick();
 assert.equal(staff.document.querySelector('.connect-thread audio'),audio);
 assert.match(staff.document.querySelector('.connect-receipt').textContent,/^Прочитано клиентом · .*19:03/);
 staff.close();
}
// Installed app: reuse an existing browser grant for a new chat, prompt only on a tap,
// and respect the previous choice for an existing chat or a dismissed setup.
for(const scenario of ['browser','default','granted','denied','existing','dismissed']){
 const app=new JSDOM('<html lang="ru"><body><div id="replyNotificationsSetup" hidden></div></body></html>',{
  url:'https://qa.invalid/app/menu/',runScripts:'outside-only',pretendToBeVisual:true
 });
 const client=app.window,host=client.document.getElementById('replyNotificationsSetup');
 client.AbortSignal=AbortSignal;
 client.matchMedia=()=>({matches:scenario!=='browser'});
 client.PushManager=class{};
 let prompts=0,subscriptions=0;
 client.Notification={
  permission:['granted','existing','dismissed'].includes(scenario)?'granted':scenario==='denied'?'denied':'default',
  async requestPermission(){prompts++;this.permission='granted';return this.permission;}
 };
 if(scenario==='existing')client.localStorage.setItem('umma:connect:token:v1','a'.repeat(64));
 if(scenario==='dismissed')client.localStorage.setItem('umma:reply-notifications:setup-dismissed','1');
 const registration={pushManager:{async getSubscription(){return {toJSON:()=>sub};}}};
 const worker=new client.EventTarget();
 worker.ready=Promise.resolve(registration);worker.register=async()=>registration;
 Object.defineProperty(client.navigator,'serviceWorker',{value:worker});
 client.fetch=async(url,init)=>{
  const request=JSON.parse(init.body);
  if(request.action==='config')return new Response(JSON.stringify({ok:true,publicKey:Buffer.alloc(65).toString('base64url')}));
  if(request.action==='preferences'){
   assert.deepEqual(request.subscription,sub);
   assert.equal('promotions'in request,false);
   subscriptions++;
  }
  return new Response(JSON.stringify({ok:true,client:{name:'',promotions:false,pushEnabled:subscriptions>0},messages:[]}));
 };
 const tick=()=>new Promise(resolve=>setTimeout(resolve,30));
 loadConnect(client,'customer-connect');
 await tick();
 assert.equal(prompts,0,scenario);
 assert.equal(subscriptions,scenario==='granted'?1:0,scenario);
 assert.equal(host.hidden,!['default','existing'].includes(scenario),scenario);
 if(scenario==='default'){
  host.querySelector('button').click();
  await tick();
  assert.equal(prompts,1);
  assert.equal(subscriptions,1);
  assert.equal(host.hidden,true);
 }
 if(scenario==='existing'){
  host.querySelectorAll('button')[1].click();
  assert.equal(host.hidden,true);
  assert.equal(client.localStorage.getItem('umma:reply-notifications:setup-dismissed'),'1');
 }
 app.window.close();
}
const menuDom=new JSDOM('<html lang="ru"><body><header></header></body></html>',{url:'https://qa.invalid/app/menu/',runScripts:'outside-only',pretendToBeVisual:true});
const menu=menuDom.window;
menu.AbortSignal=AbortSignal;
let visitCalls=[];
menu.fetch=async(url,init)=>{visitCalls.push(JSON.parse(init.body));return new Response('{"ok":true}');};
menu.eval(source('js/cafe/menu-audience.js'));
menu.ummaMenuAudience.start('neighbor-cafe-01');
menu.dispatchEvent(new menu.Event('pageshow'));
assert.equal(visitCalls.length,1);
assert.equal(visitCalls[0].point,'neighbor-cafe-01');
assert.equal(visitCalls[0].installed,false);
menu.dispatchEvent(new menu.Event('appinstalled'));
assert.equal(visitCalls[1].installed,true);
menu.ummaMenuAudience.orderPlaced(firstOrder,firstProof);
assert.equal(visitCalls[2].orderId,firstOrder);
assert.ok(visitCalls.every(v=>v.token===visitCalls[0].token));
assert.equal(menu.localStorage.getItem('umma:connect:token:v1'),null);
menu.close();
// The menu shows public news without a chat token, and remembers the local opt-out.
{
 const app=new JSDOM('<html lang="ru"><body><section id="cafeMenuNews" hidden></section></body></html>',{
  url:'https://qa.invalid/app/menu/',runScripts:'outside-only',pretendToBeVisual:true
 });
 const w=app.window,host=w.document.querySelector('section');
 w.AbortSignal=AbortSignal;
 w.fetch=async(url,init)=>{
  assert.deepEqual(JSON.parse(init.body),{action:'news'});
  return new Response(JSON.stringify({ok:true,news:[{title:'Новое блюдо',body:'<img src=x>'}]}));
 };
 w.eval(source('js/cafe/menu-news.js'));
 await new Promise(resolve=>setTimeout(resolve,30));
 assert.equal(host.hidden,false);
 assert.equal(host.querySelector('article').textContent,'Новое блюдо<img src=x>');
 assert.equal(host.querySelector('img'),null);
 const toggle=host.querySelector('button');
 toggle.click();
 assert.equal(host.querySelector('article'),null);
 assert.equal(toggle.getAttribute('aria-expanded'),'false');
 assert.equal(w.localStorage.getItem('umma:menu-news:hidden'),'1');
 toggle.click();
 assert.ok(host.querySelector('article'));
 assert.equal(w.localStorage.getItem('umma:menu-news:hidden'),'0');
 app.window.close();
}
// Edge: forged operator payloads never choose an actor; malformed subscriptions/URLs fail closed.
let handler;
const uploaded=[];
const edgeDb={
 rpc:async(name,args)=>({data:name==='cafe_web_rate_allow'?true:
  args.p_action==='mediaPrepare'?{clientId:ca}:
  args.p_action==='mediaSend'?{id:'media-message',path:args.p_data.path}:
  {ok:true}}),
 storage:{from:()=>({upload:async(...args)=>{uploaded.push(args);return {};}})}
};
const mediaSources=['supabase/functions/delivery-chat/translation.ts','supabase/functions/cafe-connect/media.ts',
 'supabase/functions/cafe-connect/index.ts'];

vm.runInNewContext(stripTypeScriptTypes(mediaSources.map(source).join('\n').replace(/^import .*;\n/gm,'').replace(/^export /gm,'')),{Deno:{env:{get:()=>''},serve:f=>handler=f},createClient:()=>edgeDb,webpush:{},verifyWebStaffSession:async()=>{throw Error('Web session invalid');},verifyTelegramInitData:async()=>{throw Error('Telegram signature');},sha256:async()=>a,crypto:webcrypto,Request,Response,URL,JSON,Promise,Date,TextDecoder,Uint8Array});
const call=data=>handler(new Request('https://qa.invalid',{method:'POST',body:JSON.stringify(data)}));
assert.equal((await call({action:'staffList',initData:'web:forged',actor:1})).status,403);
assert.equal((await call({action:'preferences',token:a,subscription:{endpoint:'https://127.0.0.1/internal'}})).status,400);
assert.equal((await call({action:'send',token:a,body:'hi',requestKey:'bad'})).status,400);
assert.equal((await call({action:'join',token:a})).status,200);
assert.equal((await call({action:'news'})).status,200);
assert.equal((await call({action:'staffAudience',initData:'web:forged',segment:'all',offset:0})).status,403);
assert.equal((await call({action:'visit',token:a,point:'<invalid>',installed:false})).status,400);
assert.equal((await call({action:'visit',token:a,point:'',installed:false,orderId:firstOrder})).status,400);
assert.equal((await call({action:'visit',token:a,point:'neighbor-cafe-01',installed:false})).status,200);
const sendAttachment=(mime,file)=>handler(new Request('https://qa.invalid',{method:'POST',
 headers:{'content-type':mime,'x-umma-token':a,'x-umma-request':randomUUID()},
 body:Buffer.concat([Buffer.from(JSON.stringify('Подпись 🌿')+'\n'),Buffer.from(file)])
}));
for(const [mime,file] of [
 ['image/jpeg',[255,216,255,224]],
 ['video/mp4',[0,0,0,12,102,116,121,112]],
 ['audio/webm',[26,69,223,163]]
]){
 const result=await sendAttachment(mime,file);
 assert.equal(result.status,200);
 assert.equal((await result.json()).id,'media-message');
 assert.equal(uploaded.at(-1)[2].contentType,mime);
 assert.deepEqual(Array.from(uploaded.at(-1)[1]),file);
}
assert.equal((await sendAttachment('image/jpeg',Buffer.from('<svg/>'))).status,415);
assert.equal((await sendAttachment('image/jpeg',Buffer.alloc(8*1024*1024+1))).status,413);
assert.equal(uploaded.length,3);
// The deployed handler chooses the recipient language, translates and caches private AI audio.
const mediaId=randomUUID(),translationLease=randomUUID(),providerCalls=[],voiceRpcs=[];
const translatedKey='qa/translations/vi.mp3';
let completed=false;
const voiceBucket={
 download:async()=>({data:new Blob([Uint8Array.of(26,69,223,163)],{type:'audio/webm'})}),
 upload:async(path,blob,options)=>{assert.match(path,/translated-vi-.*\.mp3$/);assert.equal(options.contentType,'audio/mpeg');return {};},
 createSignedUrl:async path=>({data:{signedUrl:'https://qa.invalid/'+path}})
};
const voiceDb={storage:{from:()=>voiceBucket},rpc:async(name,args)=>{
 voiceRpcs.push(args);
 switch(args.p_action){
 case 'voiceClaim':return {data:completed?{status:'ready',text:'Xin chào',audioPath:translatedKey}:
  {status:'claimed',path:'qa/original',lease:translationLease}};
 case 'voiceComplete':
  assert.equal(args.p_data.text,'Xin chào');assert.equal(args.p_data.lease,translationLease);
  completed=true;return {data:{ok:true}};
 }
 throw Error('Unexpected action '+args.p_action);
}};
vm.runInNewContext(stripTypeScriptTypes(mediaSources.map(source).join('\n').replace(/^import .*;\n/gm,'').replace(/^export /gm,'')),{
 Deno:{env:{get:name=>name==='OPENAI_API_KEY'?'test-secret':''},serve:f=>handler=f},
 createClient:()=>voiceDb,webpush:{},verifyWebStaffSession:async(db,value)=>{assert.equal(value,'web:valid');return 1;},
 sha256:async()=>a,crypto:webcrypto,Request,Response,URL,JSON,Promise,Date,TextDecoder,Uint8Array,FormData,AbortSignal,
 fetch:async(url,init)=>{
  providerCalls.push(url);
  assert.equal(init.headers.Authorization,'Bearer test-secret');
  if(url.endsWith('/transcriptions')){
   assert.equal(init.body.get('model'),'gpt-transcribe');
   assert.equal(init.body.get('file').name,'voice.webm');
   return Response.json({text:'Привет'});
  }
  const request=JSON.parse(init.body);
  if(url.endsWith('/responses')){
   assert.match(request.instructions,/Vietnamese/);
   assert.equal(request.input,'Привет');
   return Response.json({status:'completed',output:[{content:[{type:'output_text',text:'{"translatedText":"Xin chào"}'}]}]});
  }
  assert.equal(request.input,'Xin chào');
  return new Response(new Blob(['audio'],{type:'audio/mpeg'}));
 }
});
const voiceRequest={action:'voice',token:a,messageId:mediaId,language:'vi'};
assert.equal((await (await call(voiceRequest)).json()).text,'Xin chào');
assert.equal((await (await call(voiceRequest)).json()).url,'https://qa.invalid/'+translatedKey);
assert.equal(providerCalls.length,3);
assert.equal(voiceRpcs[0].p_data.language,'vi');
console.log('PASS customer channel: isolation, owner authorization, idempotent replies/campaigns, consent withdrawal, leased retry/stale ack, private credentials/RLS, explicit browser opt-in, feedback XSS safety, media ownership and idempotency, audio draft/retry, edge MIME/size validation, staff media pushes, and private voice translation in the recipient language.');
