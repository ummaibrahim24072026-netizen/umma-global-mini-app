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
await db.exec(source('supabase/proposals/cafe-connect-albums.sql'));
await db.exec(source('supabase/proposals/cafe-connect-albums.sql'));
const albumArgs={requestKey:randomUUID(),kind:'album',path:cb+'/'+randomUUID(),body:'Фото и видео'};
const album=await rpc('mediaSend',b,null,albumArgs);
assert.equal((await rpc('mediaSend',b,null,{...albumArgs,path:cb+'/'+randomUUID()})).id,album.id);
assert.equal((await rpc('list',b)).messages.filter(m=>m.media_kind==='album').length,1);
assert.equal((await rpc('staffMediaGet','',1,{clientId:cb,messageId:album.id})).path,albumArgs.path);
await assert.rejects(rpc('mediaGet',a,null,{messageId:album.id}),/Access denied/);
await assert.rejects(rpc('staffMediaSend','',1,{...albumArgs,clientId:cb,requestKey:randomUUID()}));
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
 const credential='a'.repeat(64),reply={id:'staff-reply',direction:'staff',title:'UMMA',body:'Ответ кафе',created_at:'2026-11-07T12:00:00.123456+00:00',read_at:null};
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
  if(request.action==='read'){
   // The edge function truncates the cutoff to millisecond precision.
   const cutoff=new Date(request.before).toISOString();
   if(cutoff>='2026-11-07T12:00:00.124Z')reply.read_at=cutoff;
  }
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
 assert.doesNotMatch(client.document.querySelector('.umma-connect-button').textContent,/1$/);
 assert.deepEqual([...client.document.querySelectorAll('.connect-receipt')].map(n=>n.textContent),['Отправлено']);
 sent.read_at='2026-11-07T12:01:00Z';
 client.dispatchEvent(new client.Event('online'));
 await tick();
 assert.match(client.document.querySelector('.connect-receipt').textContent,/^Прочитано сотрудником · .+$/);
 const enable=[...client.document.querySelectorAll('dialog button')].find(button=>button.textContent==='Включить уведомления о сообщениях и звонках');
 enable.click();
 await tick();
 assert.equal(prompts,1);
 assert.equal(pushEnabled,true);
 assert.equal(enable.hidden,true);
 app.window.close();
}
// The public chat stays on the same screen and recovers after a failed poll.
{
 const app=new JSDOM('<html lang="ru"><body class="public-cafe-menu"><header></header></body></html>',{
  url:'https://qa.invalid/app/menu/?connect=1',runScripts:'outside-only',pretendToBeVisual:true
 });
 const w=app.window;
 const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
 const messages=[{id:'reply',direction:'staff',body:'Hello',created_at:'2026-11-07T12:00:00Z',read_at:'2026-11-07T12:01:00Z'}];
 let offline=false,translationUnavailable=true,translations=0,localTranslations=0;
 w.localStorage.setItem('umma:connect:token:v1','a'.repeat(64));
 w.AbortSignal=AbortSignal;
 w.HTMLDialogElement.prototype.show=w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.ummaLocalTranslate={async translate(){localTranslations++;throw new Error('Local translation should not run');}};
 w.fetch=async(url,{signal,body})=>{
  const payload=JSON.parse(body);
  if(url.endsWith('/cafe-connect-translate')){
   translations++;
   assert.deepEqual(payload,{token:'a'.repeat(64),messageId:'reply',language:'ru'});
   if(translationUnavailable)return new Response(JSON.stringify({ok:false}),{status:503});
   return new Response(JSON.stringify({ok:true,text:'Здравствуйте'}));
  }
  if(payload.action==='hidden'){
   assert.ok(signal instanceof AbortSignal);
   throw new Error('Optional endpoint unavailable');
  }
  if(offline)throw new TypeError('Failed to fetch');
  return new Response(JSON.stringify({ok:true,client:{},messages}));
 };
 loadConnect(w,'customer-connect');
 await w.ummaCustomerConnect.open();
 const dialog=w.document.querySelector('.umma-connect-chat');
 const row=dialog.querySelector('[data-connect-message="reply"]');
 assert.ok(dialog.open);
 assert.equal(w.location.search,'');
 assert.equal(w.sessionStorage.getItem('umma:chat:open'),'1');
 assert.match(row.textContent,/Hello/);
 assert.ok(row.classList.contains('connect-chat-bubble'));
 assert.equal(translations,0);
 const draft=dialog.querySelector('textarea');
 draft.value='Черновик';
 const translate=[...row.querySelectorAll('button')].find(button=>button.textContent==='Перевести');
 translate.click();
 await tick();
 assert.equal(translations,1);
 assert.match(row.textContent,/Перевод временно недоступен/);
 assert.equal(row.querySelector('.connect-translated-text > div').textContent,'Hello');
 assert.ok(dialog.open);
 assert.equal(draft.value,'Черновик');
 assert.equal(translate.disabled,false);
 translationUnavailable=false;
 translate.click();
 await tick();
 assert.equal(translations,2);
 assert.equal(localTranslations,0);
 assert.equal(row.querySelector('.connect-translated-text > div').textContent,'Здравствуйте');
 assert.doesNotMatch(row.textContent,/Перевод временно недоступен/);
 offline=true;
 w.document.dispatchEvent(new w.Event('visibilitychange'));
 await tick();
 assert.ok(dialog.open);
 assert.match(dialog.textContent,/Переподключаемся/);
 assert.equal(draft.value,'Черновик');
 assert.equal(dialog.querySelector('[data-connect-message="reply"]'),row);
 offline=false;
 messages.push({...messages[0],id:'new-reply',body:'New reply'});
 w.dispatchEvent(new w.Event('online'));
 await tick();
 assert.ok(dialog.open);
 assert.match(dialog.textContent,/New reply/);
 assert.doesNotMatch(dialog.textContent,/Переподключаемся/);
 assert.equal(draft.value,'Черновик');
 assert.equal(translations,2);
 assert.equal(localTranslations,0);
 dialog.close();
 assert.equal(w.sessionStorage.getItem('umma:chat:open'),null);
 app.window.close();
}
// The guest records first and uploads only on a separate Send tap.
{
 const app=new JSDOM('<html lang="ru"><body class="public-cafe-menu"><header></header></body></html>',{
  url:'https://qa.invalid/app/menu/',runScripts:'outside-only',pretendToBeVisual:true
 });
 const guest=app.window,credential='a'.repeat(64);
 const writes=[],tracks=[],contexts=[];
 guest.AbortSignal=AbortSignal;
 guest.crypto.randomUUID=randomUUID;
 guest.Blob=Blob;
 guest.URL.createObjectURL=()=> 'blob:https://qa.invalid/preview';
 guest.URL.revokeObjectURL=()=>{};
 guest.HTMLDialogElement.prototype.show=guest.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 guest.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new guest.Event('close'));};
 guest.AudioContext=class{
  state='running';
  constructor(){contexts.push(this);}
  createMediaStreamSource(){return {connect(){}};}
  createAnalyser(){return {getByteTimeDomainData(samples){samples.fill(160);}};}
  async resume(){}
  async close(){this.state='closed';}
 };
 guest.MediaRecorder=class{
  static isTypeSupported(type){return type==='audio/webm';}
  mimeType='audio/webm';
  state='inactive';
  start(){this.state='recording';}
  pause(){this.state='paused';}
  resume(){this.state='recording';}
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
 const menu=guest.document.querySelector('.connect-chat-menu');
 const menuToggle=menu.querySelector('summary');
 assert.equal(menu.open,false);
 menuToggle.click();
 assert.equal(menu.open,true);
 assert.equal(menu.querySelector('.connect-clear-chat').textContent,'Очистить чат');
 const themeButton=menu.querySelector('.connect-theme-menu-button');
 assert.equal(themeButton.textContent,'Тема');
 themeButton.click();
 const picker=guest.document.querySelector('.connect-theme-dialog');
 assert.ok(picker.open);
 assert.equal(menu.open,false);
 assert.equal(picker.querySelectorAll('.connect-theme-choice').length,6);
 assert.equal(picker.querySelector('[aria-pressed=true]').dataset.chatTheme,'light');
 picker.querySelector('[data-chat-theme=blue]').click();
 assert.equal(guest.document.querySelector('.umma-connect-chat').dataset.chatTheme,'blue');
 assert.equal(guest.localStorage.getItem('umma:customer:chat:theme:v1'),'blue');
 assert.equal(guest.document.querySelector('.connect-theme-dialog'),null);
 menuToggle.click();
 assert.equal(guest.document.querySelector('.connect-clear-confirm'),null);
 menuToggle.dispatchEvent(new guest.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
 assert.equal(menu.open,false);
 menuToggle.click();
 guest.document.querySelector('.connect-thread').click();
 assert.equal(menu.open,false);
 menuToggle.click();
 menu.querySelector('.connect-clear-chat').click();
 assert.equal(menu.open,false);
 const confirmation=guest.document.querySelector('.connect-clear-confirm');
 assert.ok(confirmation.open);
 assert.equal(confirmation.querySelector('h3').textContent,'Очистить чат?');
 confirmation.remove();
 const form=guest.document.querySelector('.connect-compose-compact');
 const mic=form.querySelector('.connect-mic');
 const send=form.querySelector('.connect-send');
 const body=form.querySelector('textarea');
 const bar=form.querySelector('.connect-media-tools');
 const attach=form.querySelector('.connect-attach');
 assert.equal(mic.getAttribute('aria-label'),'Записать голосовое');
 assert.equal(send.hidden,true);
 body.value='Текст';
 body.dispatchEvent(new guest.Event('input'));
 assert.equal(mic.hidden,true);
 assert.equal(send.hidden,false);
 body.value='';
 body.dispatchEvent(new guest.Event('input'));
 attach.click();
 assert.equal(attach.getAttribute('aria-expanded'),'true');
 assert.deepEqual([...bar.querySelectorAll('.connect-attachment-action')].map(b=>b.textContent),['Галерея','Камера','Видео']);
 assert.equal(bar.querySelectorAll('input[capture]').length,0);
 assert.equal(bar.querySelector('input[accept^="image/"]').hasAttribute('capture'),false);
 attach.dispatchEvent(new guest.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
 assert.equal(bar.hidden,true);
 const expression=form.querySelector('.connect-expression');
 const panel=form.querySelector('.connect-expression-panel');
 assert.deepEqual([...form.querySelector('.connect-entry').children].map(node=>node.className||node.tagName),
  ['connect-expression','TEXTAREA','connect-attach','connect-circle-button']);
 expression.click();
 assert.equal(panel.hidden,false);
 body.value='АБ';
 body.setSelectionRange(1,1);
 const firstChoice=()=>panel.querySelector('.connect-expression-choices button');
 firstChoice().click();
 assert.equal(body.value,'А😀Б');
 assert.equal(send.hidden,false);
 body.value='';
 body.dispatchEvent(new guest.Event('input'));
 guest.HTMLCanvasElement.prototype.getContext=()=>({
  beginPath(){},arc(){},fill(){},stroke(){},fillText(){}
 });
 guest.HTMLCanvasElement.prototype.toDataURL=()=> 'data:image/png;base64,iVBORw0KGgo=';
 [...panel.querySelectorAll('.connect-expression-tabs button')].find(item=>item.textContent==='Стикеры').click();
 firstChoice().click();
 assert.equal(panel.hidden,true);
 assert.ok(form.querySelector('.connect-media-preview img'));
 assert.equal(send.hidden,false);
 assert.equal(writes.length,0);
 form.querySelector('.connect-media-preview button').click();
 assert.equal(mic.hidden,false);
 const tick=()=>new Promise(resolve=>setTimeout(resolve,20));
 const camera=bar.querySelector('.connect-attachment-camera');
 const cameraPanel=form.querySelector('.connect-camera-panel');
 const cameraVideo=cameraPanel.querySelector('video');
 const shutter=cameraPanel.querySelector('.connect-camera-shutter');
 const choosePhoto=cameraPanel.querySelector('.connect-camera-controls button:first-child');
 const cancelPhoto=cameraPanel.querySelector('.connect-camera-dismiss');
 assert.equal(cameraPanel.querySelectorAll('button svg').length,3);
 const gallery=bar.querySelector('input[accept^="image/"]');
 let galleryOpens=0;
 gallery.addEventListener('click',()=>galleryOpens++);
 cameraVideo.play=async()=>{};
 Object.defineProperties(cameraVideo,{videoWidth:{value:4000,configurable:true},videoHeight:{value:3000,configurable:true}});
 const stickerContext=guest.HTMLCanvasElement.prototype.getContext;
 guest.HTMLCanvasElement.prototype.getContext=()=>({drawImage(source,x,y,width,height){
  assert.equal(source,cameraVideo);
  assert.deepEqual([x,y,width,height],[0,0,1600,1200]);
 }});
 guest.HTMLCanvasElement.prototype.toBlob=(done,type)=>done(new Blob(['synthetic photo'],{type}));
 camera.click();
 await tick();
 assert.equal(cameraPanel.hidden,false);
 assert.equal(shutter.disabled,false);
 shutter.click();
 assert.equal(cameraPanel.hidden,true);
 assert.equal(cameraVideo.srcObject,null);
 assert.equal(tracks.length,1);
 guest.HTMLCanvasElement.prototype.getContext=stickerContext;
 assert.ok(form.querySelector('.connect-media-preview img'));
 assert.equal(writes.length,0);
 form.querySelector('.connect-media-preview button').click();
 bar.querySelector('.connect-attachment-camera').click();
 await tick();
 cancelPhoto.click();
 assert.equal(cameraPanel.hidden,true);
 assert.equal(tracks.length,2);
 const originalMedia=guest.navigator.mediaDevices.getUserMedia;
 guest.navigator.mediaDevices.getUserMedia=async()=>{throw new Error('Permission denied');};
 camera.click();
 await tick();
 assert.equal(shutter.disabled,true);
 assert.match(form.previousElementSibling.textContent,/Камера недоступна/);
 choosePhoto.click();
 assert.equal(galleryOpens,1);
 assert.equal(cameraPanel.hidden,true);
 guest.navigator.mediaDevices.getUserMedia=originalMedia;
 mic.click();
 await tick();
 assert.equal(mic.hidden,true);
 const recorder=form.querySelector('.connect-record-panel');
 assert.equal(recorder.hidden,false);
 const waveform=recorder.querySelector('.connect-record-wave');
 assert.equal(waveform.getAttribute('aria-hidden'),'true');
 await new Promise(resolve=>setTimeout(resolve,160));
 assert.ok(parseInt(waveform.lastElementChild.style.height)>3);
 assert.equal(waveform.firstElementChild.style.height,'3px');
 const pause=recorder.querySelector('.connect-record-pause');
 const discard=recorder.querySelector('.connect-record-delete');
 const sendVoice=recorder.querySelector('.connect-record-send');
 const listen=[...recorder.querySelectorAll('button')].find(button=>button.textContent==='Прослушать');
 pause.click();
 assert.match(pause.textContent,/Продолжить/);
 assert.equal(listen.hidden,false);
 pause.click();
 assert.match(pause.textContent,/Пауза/);
 assert.equal(listen.hidden,true);
 discard.click();
 await tick();
 assert.equal(recorder.hidden,true);
 assert.equal(contexts[0].state,'closed');
 assert.equal(form.querySelector('audio'),null);
 assert.equal(writes.length,0);
 mic.click();
 await tick();
 pause.click();
 listen.click();
 await tick();
 assert.ok(tracks.length);
 assert.equal(contexts[1].state,'closed');
 assert.ok(form.querySelector('.connect-record-preview audio'));
 assert.equal(writes.length,0);
 assert.equal(sendVoice.disabled,false);
 assert.equal(send.hidden,true);
 body.value='Голос';
 sendVoice.click();
 await tick();
 assert.ok(form.querySelector('.connect-record-preview audio'));
 sendVoice.click();
 await tick();
 assert.equal(writes[0].headers['X-Umma-Request'],writes[1].headers['X-Umma-Request']);
 assert.equal(writes[1].headers['X-Umma-Token'],credential);
 assert.equal(writes[1].headers['Content-Type'],'audio/webm');
 assert.ok((await writes[1].body.text()).startsWith('"Голос"\n'));
 assert.equal(form.querySelector('.connect-record-preview audio'),null);
 const submit=()=>form.dispatchEvent(new guest.Event('submit',{cancelable:true}));
 const voice=guest.document.querySelector('.connect-chat-voice');
 assert.ok(voice.querySelector('.connect-public-voice .connect-voice-play'));
 assert.equal(voice.querySelector('.connect-receipt').textContent,'✓');
 assert.equal(voice.querySelector('.connect-receipt').getAttribute('aria-label'),'Отправлено');
 for(const [i,type,element] of [[0,'image/jpeg','img'],[1,'video/mp4','video']]){
  const input=bar.querySelectorAll('input')[i];
  const file=new Blob(['synthetic attachment'],{type});
  Object.defineProperty(input,'files',{value:[file]});
  input.dispatchEvent(new guest.Event('change'));
  assert.ok(form.querySelector('.connect-media-preview '+element));
  assert.equal(send.hidden,false);
  submit();
  await tick();
  assert.equal(writes.at(-1).headers['Content-Type'],type);
  assert.equal(form.querySelector('.connect-media-preview '+element),null);
  assert.equal(mic.hidden,false);
 }
 expression.click();
 firstChoice().click();
 submit();
 await tick();
 assert.equal(writes.at(-1).headers['Content-Type'],'image/png');
 assert.equal(form.querySelector('.connect-media-preview img'),null);
 const startVideo=bar.querySelector('.connect-attachment-video');
 const galleryVideo=bar.querySelector('input[accept^="video/"]');
 let videoPickerOpens=0;
 galleryVideo.addEventListener('click',()=>videoPickerOpens++);
 startVideo.click();
 assert.equal(cameraPanel.hidden,false);
 assert.equal(shutter.disabled,true);
 assert.match(form.previousElementSibling.textContent,/Видеозапись недоступна/);
 choosePhoto.click();
 assert.equal(videoPickerOpens,1);
 guest.navigator.mediaDevices.getUserMedia=async options=>{
  assert.equal(options.audio,true);
  assert.equal(options.video.height.ideal,720);
  return originalMedia();
 };
 guest.MediaRecorder=class extends guest.MediaRecorder{
  static isTypeSupported(type){return type==='video/webm';}
  mimeType='video/webm;codecs=vp8,opus';
  start(timeslice){assert.equal(timeslice,250);super.start();}
 };
 let frameWidth=720,frameHeight=1280,captureSize,drawArgs,drawFrame,updateCountdown;
 let now=0;
 Object.defineProperties(cameraVideo,{
  videoWidth:{get:()=>frameWidth},videoHeight:{get:()=>frameHeight},readyState:{value:2}
 });
 guest.HTMLCanvasElement.prototype.getContext=()=>({
  save(){},restore(){},fillRect(){},
  drawImage(...args){drawArgs=args;}
 });
 guest.HTMLCanvasElement.prototype.captureStream=function(){
  captureSize=[this.width,this.height];
  return {getVideoTracks:()=>[]};
 };
 guest.performance.now=()=>now;
 guest.setInterval=callback=>{updateCountdown=callback;return 1;};
 guest.MediaStream=class{getVideoTracks(){return [];}};
 guest.requestAnimationFrame=callback=>{drawFrame=callback;return 0;};
 guest.cancelAnimationFrame=()=>{};
 const rawMedia=guest.navigator.mediaDevices.getUserMedia;
 guest.navigator.mediaDevices.getUserMedia=async options=>({...await rawMedia(options),getAudioTracks:()=>[]});
 const countdown=cameraPanel.querySelector('[role=timer]');
 const writesBeforeVideo=writes.length, stopsBeforeVideo=tracks.length;
 startVideo.click();
 await tick();
 shutter.click();
 assert.equal(shutter.getAttribute('aria-label'),'Остановить видео');
 assert.equal(shutter.dataset.mode,'recording');
 assert.deepEqual(captureSize,[406,720]);
 assert.equal(drawArgs[0],cameraVideo);
 assert.deepEqual(drawArgs.slice(1),[0.5,0,405,720]);
 assert.equal(countdown.hidden,false);
 assert.equal(countdown.textContent,'Осталось 1:00');
 now+=1000;
 updateCountdown();
 assert.equal(countdown.textContent,'Осталось 0:59');
 frameWidth=1280;frameHeight=720;
 drawFrame();
 assert.deepEqual(captureSize,[406,720]);
 assert.equal(drawArgs[3],406);
 assert.ok(drawArgs[2]>0);
 assert.equal(send.disabled,true);
 cancelPhoto.click();
 await tick();
 assert.equal(tracks.length,stopsBeforeVideo+1);
 assert.equal(countdown.hidden,true);
 assert.equal(form.querySelector('.connect-media-preview video'),null);
 startVideo.click();
 await tick();
 shutter.click();
 assert.deepEqual(captureSize,[720,406]);
 assert.equal(countdown.textContent,'Осталось 1:00');
 shutter.click();
 await tick();
 assert.equal(cameraPanel.hidden,true);
 assert.equal(countdown.hidden,true);
 assert.equal(cameraVideo.srcObject,null);
 assert.equal(tracks.length,stopsBeforeVideo+2);
 assert.ok(form.querySelector('.connect-media-preview video[controls]'));
 assert.equal(writes.length,writesBeforeVideo);
 assert.equal(send.hidden,false);
 submit();
 assert.equal(send.getAttribute('aria-busy'),'true');
 assert.equal(send.hidden,false);
 await Promise.resolve();
 assert.equal(form.previousElementSibling.textContent,'');
 await tick();
 assert.equal(send.hasAttribute('aria-busy'),false);
 assert.equal(writes.length,writesBeforeVideo+1);
 assert.equal(writes.at(-1).headers['Content-Type'],'video/webm');
 guest.navigator.mediaDevices.getUserMedia=async()=>({...await originalMedia(),getAudioTracks:()=>[]});
 camera.click();
 await tick();
 const modes=[...cameraPanel.querySelectorAll('.connect-camera-modes button')];
 assert.deepEqual(modes.map(button=>button.textContent),['Видео','Фото','Видеозаметка']);
 assert.equal(modes[1].getAttribute('aria-pressed'),'true');
 modes[2].click();
 await tick();
 assert.equal(modes[2].getAttribute('aria-pressed'),'true');
 shutter.click();
 assert.equal(modes.every(button=>button.disabled),true);
 assert.deepEqual(captureSize,[480,480]);
 assert.equal(countdown.textContent,'Осталось 1:00');
 shutter.click();
 await tick();
 assert.equal(cameraPanel.hidden,true);
 assert.ok((await writes.at(-1).body.text()).startsWith('"◉ Видеосообщение"\n'));
 guest.close();
}
// Staff inbox updates the receipt while the current conversation stays open.
{
 const app=new JSDOM('<body class="public-cafe-menu"><header></header><main><section id="webMessages"></section></main></body>',{
  url:'https://qa.invalid/app/staff.html',runScripts:'outside-only',pretendToBeVisual:true
 });
 const staff=app.window;
 staff.AbortSignal=AbortSignal;
 staff.ummaRole='super_admin';
 Object.defineProperty(staff.navigator,'language',{value:'vi-VN'});
 staff.ummaLocalTranslate={
  async voice(url,target,source){
   assert.equal(url,'https://qa.invalid/signed');
   assert.equal(target,'vi');
   assert.equal(source,'auto');
   return {status:'ready',text:'Bản dịch',url:null,local:true,transcript:'Вопрос',source:'ru'};
  }
 };
 let staffActor=10;
 staff.ummaStaffAuth={credential:()=> 'web:test',actorId:()=>staffActor};
 staff.HTMLDialogElement.prototype.show=staff.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 staff.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new staff.Event('close'));};
 staff.localStorage.setItem('umma:chat:theme:v1','beige');
 let poll;
 staff.setInterval=callback=>{poll=callback;};
 const messages=[
  {id:'staff-view-question',direction:'customer',body:'Вопрос',media_kind:'voice',created_at:'2026-11-07T12:00:00Z',read_at:'2026-11-07T12:01:00Z'},
  {id:'staff-view-answer',direction:'staff',title:'UMMA',body:'Ответ',created_at:'2026-11-07T12:02:00Z',read_at:null}
 ];
 const avatar='data:image/png;base64,iVBORw0KGgo=';
 let currentAvatar=avatar;
 const mobileRequests=[];
 staff.fetch=async(url,init)=>{
  const request=JSON.parse(init.body);
  assert.equal(request.initData,'web:test');
  mobileRequests.push(request.action);
  const client={id:ca,name:'Клиент',unread:0,last_message:'Ответ'};
  if(request.action==='staffMediaGet'){
   assert.equal(request.clientId,ca);
   assert.ok(['staff-view-question','staff-view-video'].includes(request.messageId));
   return new Response(JSON.stringify({ok:true,url:'https://qa.invalid/signed'}));
  }
  if(request.action==='staffVoice')return Response.json({ok:true,status:'ready',text:'Bản dịch từ máy chủ'});
  if(url.endsWith('/cafe-connect-translate'))return Response.json({ok:true,text:'Перевод текста'});
  return new Response(JSON.stringify(request.action==='staffInbox'?
   {ok:true,clients:[client]}:request.action==='staffInboxDetails'?
   {ok:true,stage:'new',revision:0,orders:[]}:{ok:true,client:request.includeAvatar?{...client,avatar:currentAvatar}:client,messages,voiceTranslation:true}));
 };
 const tick=()=>new Promise(resolve=>setTimeout(resolve,30));
 loadConnect(staff,'connect-admin');
 staff.document.dispatchEvent(new staff.CustomEvent('umma:staff-tab',{detail:'messages'}));
 await tick();
 staff.document.querySelector('[data-client-thread]').click();
 await tick();
 const staffChat=staff.document.getElementById('webMessages');
 const header=staffChat.querySelector('.connect-chat-header');
 const headerAvatar=header.querySelector('.work-chat-avatar');
 const avatarImage=headerAvatar.querySelector('img');
 assert.equal(header.querySelector('h2').textContent,'Клиент');
 assert.equal(headerAvatar.querySelector('span').textContent,'КЛ');
 assert.equal(avatarImage.getAttribute('src'),avatar);
 avatarImage.dispatchEvent(new staff.Event('load'));
 assert.equal(avatarImage.hidden,false);
 const chooseTheme=(chat,theme)=>{
  chat.querySelector('.connect-theme-menu-button').click();
  const picker=staff.document.querySelector('.connect-theme-dialog[open]');
  assert.equal(picker.querySelector('[aria-pressed=true]').dataset.chatTheme,chat.dataset.chatTheme);
  picker.querySelector('[data-chat-theme='+theme+']').click();
 };
 staff.setInterval=()=>{};
 staff.eval(source('js/cafe/customer-connect.js'));
 await staff.ummaCustomerConnect.open();
 const customerChat=staff.document.getElementById('customerChatDialog');
 assert.equal(staffChat.dataset.chatTheme,'light');
 assert.equal(customerChat.dataset.chatTheme,'light');
 chooseTheme(customerChat,'lavender');
 assert.equal(staffChat.dataset.chatTheme,'light');
 chooseTheme(staffChat,'dark');
 assert.equal(customerChat.dataset.chatTheme,'lavender');
 assert.equal(staff.localStorage.getItem('umma:customer:chat:theme:v1'),'lavender');
 const changeStaff=actor=>{
  staffActor=actor;
  staff.document.dispatchEvent(new staff.CustomEvent('umma:staff-ready',{detail:{assignments:[]}}));
 };
 changeStaff(11);
 assert.equal(staffChat.dataset.chatTheme,'light');
 chooseTheme(staffChat,'blue');
 changeStaff(10);
 assert.equal(staffChat.dataset.chatTheme,'dark');
 changeStaff(11);
 assert.equal(staffChat.dataset.chatTheme,'blue');
 assert.equal(customerChat.dataset.chatTheme,'lavender');
 assert.equal(staff.localStorage.getItem('umma:chat:theme:v1'),'beige');
 customerChat.close();
 await tick();
 assert.deepEqual([...staff.document.querySelectorAll('.connect-receipt')].map(n=>n.textContent),['Отправлено']);
 staff.HTMLMediaElement.prototype.load=function(){};
 staff.HTMLMediaElement.prototype.play=async function(){};
 staff.HTMLMediaElement.prototype.pause=function(){};
 staff.document.querySelector('.connect-public-voice button[aria-label^="Воспроизвести"]').click();
 await tick();
 [...staff.document.querySelectorAll('.connect-thread button')].find(b=>b.textContent==='🌐 Перевести голос').click();
 await tick();
 assert.equal(staff.document.querySelector('.connect-voice-translation [lang=vi]').textContent,'Bản dịch');
 assert.match(staff.document.querySelector('.connect-voice-original').textContent,/Вопрос/);
 const audio=staff.document.querySelector('.connect-thread audio');
 assert.equal(audio.src,'https://qa.invalid/signed');
 assert.ok(staff.document.querySelector('input[type=file][accept^="video/"]'));
 assert.ok([...staff.document.querySelectorAll('.work-thread form button')].some(b=>b.getAttribute('aria-label')==='Записать голосовое'));
 messages[1].read_at='2026-11-07T12:03:00Z';
 await poll();
 await tick();
 assert.equal(staff.document.querySelector('.connect-thread audio'),audio);
 assert.match(staff.document.querySelector('.connect-receipt').textContent,/^Прочитано клиентом · .*19:03/);
 header.querySelector('.work-chat-back').click();
 assert.equal(headerAvatar.hidden,true);
 assert.equal(avatarImage.hasAttribute('src'),false);
 currentAvatar=null;
 staff.document.querySelector('[data-client-thread]').click();
 await tick();
 assert.equal(headerAvatar.hidden,false);
 assert.equal(avatarImage.hidden,true);
 assert.equal(headerAvatar.querySelector('span').textContent,'КЛ');
 currentAvatar=avatar;
 await poll();
 await tick();
 assert.equal(avatarImage.getAttribute('src'),avatar);

 // Opening a chat on a phone must not initialize browser models or preload attachments.
 header.querySelector('.work-chat-back').click();
 staff.matchMedia=()=>({matches:true});
 let localCalls=0;
 staff.ummaLocalTranslate={
  translate(){localCalls++;throw Error('Unexpected local model');},
  voice(){localCalls++;throw Error('Unexpected local model');}
 };
 messages.push(
  {id:'staff-view-text',direction:'customer',body:'Mobile translation fixture',created_at:'2026-11-07T12:03:00Z',read_at:'2026-11-07T12:04:00Z'},
  {id:'staff-view-video',direction:'customer',body:'◉ Видеосообщение',media_kind:'video',created_at:'2026-11-07T12:04:00Z',read_at:'2026-11-07T12:05:00Z'}
 );
 mobileRequests.length=0;
 staff.document.querySelector('[data-client-thread]').click();
 await tick();
 const threadPanel=staffChat.querySelector('.work-thread');
 const mobileVoice=threadPanel.querySelector('audio');
 const circle=threadPanel.querySelector('.connect-video-circle');
 assert.equal(mobileVoice.preload,'none');
 assert.equal(mobileVoice.hasAttribute('src'),false);
 assert.equal(circle.querySelector('video').hasAttribute('src'),false);
 assert.equal(mobileRequests.includes('staffMediaGet'),false);
 assert.equal(mobileRequests.includes('staffVoice'),false);
 assert.equal(mobileRequests.includes(undefined),false);
 assert.equal(localCalls,0);
 threadPanel.querySelector('[data-message-id="staff-view-text"] .connect-translated-text button:not([hidden])').click();
 threadPanel.querySelector('.connect-voice-translation button').click();
 circle.querySelector('button').click();
 await tick();
 assert.equal(mobileRequests.includes('staffVoice'),true);
 assert.equal(mobileRequests.includes('staffMediaGet'),true);
 assert.equal(localCalls,0);
 assert.match(threadPanel.textContent,/Bản dịch từ máy chủ/);
 assert.match(threadPanel.textContent,/Перевод текста/);
 header.querySelector('.work-chat-back').click();
 assert.equal(circle.querySelector('video').hasAttribute('src'),false);
 staff.close();
}
// An existing profile photo syncs on menu startup even before the chat loads.
{
 const app=new JSDOM('<input id="profileAvatarFile"><button id="chooseProfileAvatar"></button><button id="removeProfileAvatar"></button><p id="profileAvatarStatus"></p><img id="topbarAvatar"><img id="profileAvatar"><span id="topbarAvatarPlaceholder"></span><span id="profileAvatarPlaceholder"></span>',{url:'https://qa.invalid/menu/',runScripts:'outside-only'});
 const w=app.window,requests=[];
 const avatar='data:image/png;base64,iVBORw0KGgo=';
 w.ummaMenuI18n={t:s=>s};
 w.localStorage.setItem('umma-menu-avatar',avatar);
 w.localStorage.setItem('umma:connect:token:v1',a);
 w.fetch=async(url,init)=>{
  requests.push(JSON.parse(init.body));
  return {ok:requests.length>1,json:async()=>({ok:true})};
 };
 const tick=()=>new Promise(resolve=>setImmediate(resolve));
 w.eval(source('js/cafe/public-menu-avatar.js'));
 await tick();
 assert.deepEqual(requests[0],{action:'avatar',token:a,avatar});
 // Simulate a transient failure, then retry after regaining connectivity.
 w.dispatchEvent(new w.Event('online'));
 await tick();
 assert.deepEqual(requests[1],requests[0]);
 await w.ummaMenuSyncChatAvatar();
 assert.equal(requests.length,2);
 w.document.getElementById('removeProfileAvatar').click();
 await tick();
 assert.deepEqual(requests[2],{action:'avatar',token:a,avatar:null});
 assert.equal(w.localStorage.getItem('umma-menu-avatar-remove'),null);
 w.close();
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
const profilePhoto='data:image/png;base64,iVBORw0KGgo=';
const profilePath=ca+'/profile-avatar';
const avatarObjects=new Map();
const edgeDb={
 rpc:async(name,args)=>({data:name==='cafe_web_rate_allow'?true:
  args.p_action==='mediaPrepare'?{clientId:ca}:
  args.p_action==='mediaSend'?{id:'media-message',path:args.p_data.path}:
  args.p_action==='list'||args.p_action==='staffThread'?{ok:true,client:{id:ca},messages:[]}:
  {ok:true}}),
 storage:{from:()=>({
  upload:async(...args)=>{
   if(args[0]===profilePath)avatarObjects.set(args[0],args[1]);
   else uploaded.push(args);
   return {};
  },
  download:async path=>avatarObjects.has(path)?{data:avatarObjects.get(path)}:{error:{statusCode:'404'}},
  remove:async paths=>{paths.forEach(path=>avatarObjects.delete(path));return {};}
 })}
};
const mediaSources=['supabase/functions/delivery-chat/translation.ts','supabase/functions/cafe-connect/media.ts',
 'supabase/functions/cafe-connect/index.ts'];

vm.runInNewContext(stripTypeScriptTypes(mediaSources.map(source).join('\n').replace(/^import .*;\n/gm,'').replace(/^export /gm,'')),{Deno:{env:{get:()=>''},serve:f=>handler=f},createClient:()=>edgeDb,webpush:{},verifyWebStaffSession:async(db,value)=>{if(value==='web:avatar-staff')return 1;throw Error('Web session invalid');},verifyTelegramInitData:async()=>{throw Error('Telegram signature');},sha256:async()=>a,crypto:webcrypto,Request,Response,URL,JSON,Promise,Date,TextDecoder,Uint8Array,Blob,atob,btoa});
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
const staffPhoto={action:'staffThread',initData:'web:avatar-staff',clientId:ca,includeAvatar:true};
assert.equal((await call({action:'avatar',token:a,avatar:'data:image/png;base64,PHN2Zy8+'})).status,415);
assert.equal((await call({action:'avatar',token:a,clientId:cb,avatar:profilePhoto})).status,200);
assert.deepEqual([...avatarObjects.keys()],[profilePath]);
assert.equal((await call({...staffPhoto,initData:'web:forged'})).status,403);
assert.equal((await (await call(staffPhoto)).json()).client.avatar,profilePhoto);
assert.equal((await (await call({...staffPhoto,includeAvatar:false})).json()).client.avatar,undefined);
assert.equal((await call({action:'avatar',token:a,avatar:null})).status,200);
assert.equal((await (await call(staffPhoto)).json()).client.avatar,null);
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
   assert.equal(init.body.get('model'),'gpt-4o-mini-transcribe');
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
