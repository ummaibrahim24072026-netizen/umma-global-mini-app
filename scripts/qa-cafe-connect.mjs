import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {JSDOM} from 'jsdom';
import {webcrypto,randomUUID} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
const source=p=>readFileSync(p,'utf8');
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
await db.exec(`select set_config('request.jwt.claims','{"role":"anon"}',false)`);await assert.rejects(rpc('list',a),/Access denied/);
await db.close();
// Browser: no automatic prompt, explicit opt-in, idempotent feedback, literal rendering.
const dom=new JSDOM('<html lang="ru"><body><header></header></body></html>',{url:'https://qa.invalid/app/menu/',runScripts:'outside-only'}),w=dom.window;let prompts=0,calls=[];
w.AbortSignal=AbortSignal;Object.defineProperty(w.crypto,'getRandomValues',{value:a=>webcrypto.getRandomValues(a)});w.crypto.randomUUID=randomUUID;
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.Notification={requestPermission(){prompts++;return Promise.resolve('denied');}};
w.fetch=async(url,init)=>{const data=JSON.parse(init.body);calls.push(data);return new Response(JSON.stringify({ok:true,client:{id:ca,name:'',promotions:false,pushEnabled:false},messages:data.action==='send'?[{id:'m',body:data.body,direction:'customer',created_at:new Date().toISOString()}]:[]}));};
w.eval(source('js/cafe/customer-connect.js'));assert.equal(prompts,0);assert.equal(calls.length,0);w.document.querySelector('button').click();
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
 client.eval(source('js/cafe/customer-connect.js'));
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
// Staff inbox updates the receipt while the current conversation stays open.
{
 const app=new JSDOM('<header></header><main><section id="webMessages"></section></main>',{
  url:'https://qa.invalid/app/staff.html',runScripts:'outside-only',pretendToBeVisual:true
 });
 const staff=app.window;
 staff.AbortSignal=AbortSignal;
 staff.ummaRole='super_admin';
 staff.ummaStaffAuth={credential:()=> 'web:test'};
 let poll;
 staff.setInterval=callback=>{poll=callback;};
 const messages=[
  {direction:'customer',body:'Вопрос',created_at:'2026-11-07T12:00:00Z',read_at:'2026-11-07T12:01:00Z'},
  {direction:'staff',title:'UMMA',body:'Ответ',created_at:'2026-11-07T12:02:00Z',read_at:null}
 ];
 staff.fetch=async(url,init)=>{
  const request=JSON.parse(init.body);
  assert.equal(request.initData,'web:test');
  const client={id:ca,name:'Клиент',unread:0,last_message:'Ответ'};
  return new Response(JSON.stringify(request.action==='staffList'?
   {ok:true,clients:[client],subscribers:0,pushDevices:0}:{ok:true,client,messages}));
 };
 const tick=()=>new Promise(resolve=>setTimeout(resolve,30));
 staff.eval(source('js/cafe/connect-admin.js'));
 staff.document.dispatchEvent(new staff.CustomEvent('umma:staff-tab',{detail:'messages'}));
 await tick();
 staff.document.querySelector('[data-client-thread]').click();
 await tick();
 assert.deepEqual([...staff.document.querySelectorAll('.connect-receipt')].map(n=>n.textContent),['Отправлено']);
 messages[1].read_at='2026-11-07T12:03:00Z';
 await poll();
 await tick();
 assert.match(staff.document.querySelector('.connect-receipt').textContent,/^Прочитано клиентом · .*19:03/);
 staff.close();
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
// Edge: forged operator payloads never choose an actor; malformed subscriptions/URLs fail closed.
let handler;const edgeDb={rpc:async(name,args)=>({data:name==='cafe_web_rate_allow'?true:{ok:true}})};
vm.runInNewContext(stripTypeScriptTypes(source('supabase/functions/cafe-connect/index.ts').replace(/^import .*;\n/gm,'')),{Deno:{env:{get:()=>''},serve:f=>handler=f},createClient:()=>edgeDb,webpush:{},verifyWebStaffSession:async()=>{throw Error('Web session invalid');},verifyTelegramInitData:async()=>{throw Error('Telegram signature');},sha256:async()=>a,crypto:webcrypto,Request,Response,URL,JSON,Promise,Date});
const call=data=>handler(new Request('https://qa.invalid',{method:'POST',body:JSON.stringify(data)}));
assert.equal((await call({action:'staffList',initData:'web:forged',actor:1})).status,403);
assert.equal((await call({action:'preferences',token:a,subscription:{endpoint:'https://127.0.0.1/internal'}})).status,400);
assert.equal((await call({action:'send',token:a,body:'hi',requestKey:'bad'})).status,400);
assert.equal((await call({action:'join',token:a})).status,200);
assert.equal((await call({action:'staffAudience',initData:'web:forged',segment:'all',offset:0})).status,403);
assert.equal((await call({action:'visit',token:a,point:'<invalid>',installed:false})).status,400);
assert.equal((await call({action:'visit',token:a,point:'',installed:false,orderId:firstOrder})).status,400);
assert.equal((await call({action:'visit',token:a,point:'neighbor-cafe-01',installed:false})).status,200);
console.log('PASS customer channel: isolation, owner authorization, idempotent replies/campaigns, consent withdrawal, leased retry/stale ack, private credentials/RLS, explicit browser opt-in, feedback XSS safety and edge validation.');
