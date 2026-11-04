import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';import vm from 'node:vm';import {stripTypeScriptTypes} from 'node:module';import {webcrypto} from 'node:crypto';import {JSDOM} from 'jsdom';import webpush from 'web-push';import {PGlite} from '@electric-sql/pglite';
const source=p=>readFileSync(p,'utf8'),tick=()=>new Promise(r=>setTimeout(r,15));
// Foreground consent, real unread counts, duplicate sound suppression, clearing badges.
{
const dom=new JSDOM('<html lang="ru"><body><div><p id="syncState"></p></div></body></html>',{url:'https://qa.invalid/menu/',runScripts:'outside-only'}),w=dom.window;let sounds=0,requests=0,badge=0;
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
w.AudioContext=class{state='running';currentTime=0;destination={};createOscillator(){return{frequency:{value:0},connect(){},start(){sounds++;},stop(){}};}createGain(){return{gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};}};
w.navigator.setAppBadge=async n=>badge=n;w.navigator.clearAppBadge=async()=>badge=0;
w.Notification={permission:'default',requestPermission(){requests++;return Promise.resolve('denied');}};
w.eval(source('js/cafe/order-alerts.js'));w.eval(source('js/cafe/order-inbox.js'));assert.equal(requests,0);assert.equal(sounds,0);
w.document.querySelector('.umma-order-alerts button').click();await tick();assert.equal(sounds,2); // unsupported push, foreground sound still works
const o={id:'q',orderNumber:90,status:'pending',paymentStatus:'pending'};w.ummaOrderInbox.publish(o);assert.equal(sounds,2);assert.equal(badge,1);
w.ummaOrderInbox.publish({...o,status:'ready',paymentStatus:'paid'});assert.equal(sounds,4);assert.equal(badge,3);w.ummaOrderInbox.publish({...o,status:'ready',paymentStatus:'paid'});assert.equal(sounds,4);
// Pushes can arrive out of order: retain event times, do not regress the latest state.
const eventAt=new Date(Date.now()-100).toISOString();
w.ummaOrderInbox.publish({...o,orderNumber:91,status:'completed',eventId:'done',eventAt,changes:{status:'completed'}});
w.ummaOrderInbox.publish({...o,orderNumber:91,status:'preparing',eventId:'older',eventAt:new Date(Date.now()-60000).toISOString(),changes:{status:'preparing'}});
let stored=JSON.parse(w.localStorage.getItem('umma:order-inbox:v1'));assert.equal(stored.states['91'].status,'completed');const length=stored.messages.length;
w.ummaOrderInbox.publish({...o,orderNumber:91,status:'preparing',eventId:'older',eventAt,changes:{status:'preparing'}});stored=JSON.parse(w.localStorage.getItem('umma:order-inbox:v1'));assert.equal(stored.messages.length,length);
w.ummaOrderInbox.open();w.ummaOrderInbox.open();assert.equal(w.document.querySelectorAll('dialog').length,1);assert.equal(badge,0);assert.equal(w.document.querySelectorAll('dialog li').length,5);w.document.querySelector('dialog').close();assert.ok(w.document.querySelector('.umma-order-alerts'));w.close();
}
// Supported browser: one explicit permission tap, subscription bound to the exact receipt.
{
const dom=new JSDOM('<html lang="ru"><body><div><p id="syncState"></p></div></body></html>',{url:'https://qa.invalid/menu/',runScripts:'outside-only'}),w=dom.window;let permissions=0,subscribes=0;const calls=[];
w.AbortSignal=AbortSignal;w.PushManager=class{};w.Notification={permission:'default',requestPermission(){permissions++;w.Notification.permission='granted';return Promise.resolve('granted');}};
const registration={pushManager:{async getSubscription(){return null;},async subscribe(options){subscribes++;assert.equal(options.userVisibleOnly,true);return{toJSON(){return{endpoint:'https://fcm.googleapis.com/test',keys:{p256dh:'x',auth:'y'}};}};}}};
Object.defineProperty(w.navigator,'serviceWorker',{value:{ready:Promise.resolve(registration),controller:{postMessage(){}},addEventListener(){}}});
w.fetch=async(u,opts)=>{const b=JSON.parse(opts.body);calls.push(b);return new Response(JSON.stringify(b.action==='config'?{ok:true,publicKey:Buffer.alloc(65).toString('base64url')}:{ok:true}));};
w.eval(source('js/cafe/order-alerts.js'));w.ummaOrderAlerts.setOrder({id:'receipt-id',requestKey:'receipt-key'});await tick();assert.equal(permissions,0);assert.equal(calls.length,0);
w.document.querySelector('.umma-order-alerts button').click();await tick();await tick();assert.equal(permissions,1);assert.equal(subscribes,1);assert.equal(calls[1].orderId,'receipt-id');assert.equal(calls[1].requestKey,'receipt-key');assert.equal(calls[1].language,'ru');w.close();
}
// Background push: persistence, deduplication, sound flag, badge, safe click target and clear.
{
const callbacks={},values=new Map(),shown=[],out=[];let badge=0,closed=0;const cache={async match(k){const v=values.get(k);return v?new Response(v):undefined;},async put(k,r){values.set(k,await r.text());}};
const self={registration:{scope:'https://qa.invalid/app/',async showNotification(t,o){shown.push({t,o});},async getNotifications(){return[{data:{umma:true},close(){closed++;}}];}},navigator:{async setAppBadge(n){badge=n;},async clearAppBadge(){badge=0;}},clients:{async matchAll(){return[];},async openWindow(url){out.push(url);}},addEventListener(n,f){callbacks[n]=f;}};
vm.runInNewContext(source('umma-menu-sw.js'),{self,caches:{async open(){return cache;}},URL,Response,Promise,JSON,Math,Number});
async function event(type,obj){let task;callbacks[type]({...obj,waitUntil(p){task=p;}});await task;}
const payload={eventId:'one',title:'Ready',body:'Collect',order:{id:'o',orderNumber:12,status:'ready'}};
await event('push',{data:{json:()=>payload}});assert.equal(shown.length,1);assert.equal(shown[0].o.silent,false);assert.equal(badge,1);await event('push',{data:{json:()=>payload}});assert.equal(shown.length,2);assert.equal(shown[1].o.silent,true);assert.equal(badge,1);
let history;await event('message',{data:{type:'UMMA_GET_HISTORY'},source:{postMessage(m){history=m;}}});assert.equal(history.messages.length,1);
await event('message',{data:{type:'UMMA_BADGE',count:0}});assert.equal(badge,0);assert.equal(closed,1);
await event('notificationclick',{notification:{close(){}}});assert.equal(out[0],'https://qa.invalid/app/menu/?messages=1');
}
// Actual library generates encrypted Web Push request and VAPID signature; no network send.
const keys=webpush.generateVAPIDKeys(),receiver=webpush.generateVAPIDKeys();const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/synthetic',keys:{p256dh:receiver.publicKey,auth:Buffer.alloc(16,9).toString('base64url')}};
const encrypted=webpush.generateRequestDetails(subscription,'{"test":true}',{vapidDetails:{subject:'https://qa.invalid',...keys}});assert.ok(encrypted.body.length>16);assert.match(encrypted.headers.Authorization,/vapid/);
// Edge: private key never public; receipt binding; SSRF denial; dispatch authentication/retries.
{
let handler,registered=0,finished=[],sent=0;const config={...keys,dispatchKey:'server-only'},job={id:'j',lease:'lease',payload:{orderNumber:8,status:'ready',changes:{status:'ready'}},subscription,language:'ru'};let gone=false;
const db={async rpc(name,args){if(name==='cafe_push_config')return{data:config};if(name==='cafe_push_subscribe'){if(args.p_key!=='b'.repeat(8)+'-bbbb-4bbb-8bbb-'+ 'b'.repeat(12))return{error:{}};registered++;return{data:null};}if(name==='cafe_push_lease')return{data:[job]};if(name==='cafe_push_finish'){finished.push(args);return{data:null};}throw Error(name);}};
vm.runInNewContext(stripTypeScriptTypes(source('supabase/functions/cafe-push/index.ts').replace(/^import .*;\n/gm,'')),{Deno:{serve:f=>handler=f,env:{get:()=> 'synthetic'}},createClient:()=>db,webpush:{async sendNotification(s,p,o){sent++;assert.ok(o.vapidDetails.privateKey);if(gone)throw{statusCode:410};}},crypto:webcrypto,URL,Response,console,Set});
const call=async(b,secret)=>{const r=await handler(new Request('https://qa.invalid',{method:'POST',headers:secret?{'x-umma-push-key':secret}:{},body:JSON.stringify(b)}));return{status:r.status,data:await r.json()};};
let r=await call({action:'config'});assert.equal(r.data.publicKey,keys.publicKey);assert.equal(r.data.privateKey,undefined);assert.equal(r.data.dispatchKey,undefined);
r=await call({action:'dispatch'});assert.equal(r.status,403);assert.equal(sent,0);
const request={action:'subscribe',orderId:'a'.repeat(8)+'-aaaa-4aaa-8aaa-'+ 'a'.repeat(12),requestKey:'b'.repeat(8)+'-bbbb-4bbb-8bbb-'+ 'b'.repeat(12),subscription};
assert.equal((await call(request)).status,200);assert.equal(registered,1);assert.equal((await call({...request,subscription:{...subscription,endpoint:'https://127.0.0.1/private'}})).status,400);
assert.equal((await call({...request,requestKey:'c'.repeat(8)+'-cccc-4ccc-8ccc-'+ 'c'.repeat(12)})).status,400);
await call({action:'dispatch'},'server-only');assert.equal(finished[0].p_success,true);gone=true;await call({action:'dispatch'},'server-only');assert.equal(finished[1].p_gone,true);
}
// Real PostgreSQL engine: guest ownership, trigger/no-op/rollback, leases, stale ack, RLS.
{
const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create function auth.role() returns text language sql as $$select 'service_role'::text$$;create schema umma_private;create schema net;create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language sql as $$select 1::bigint$$;create schema cron;create function cron.schedule(text,text,text) returns bigint language sql as $$select 1::bigint$$;create table cafe_orders(id uuid primary key,order_number bigint,status text,payment_status text,delivery_status text);create table umma_private.public_guest_requests(request_key uuid,order_id uuid);`);
await db.exec(source('supabase/proposals/cafe-web-push.sql'));const id='11111111-1111-4111-8111-111111111111',key='22222222-2222-4222-8222-222222222222';
await db.query("insert into cafe_orders values($1,8,'pending','pending','not_applicable')",[id]);await db.query('insert into umma_private.public_guest_requests values($1,$2)',[key,id]);
await assert.rejects(db.query('select cafe_push_subscribe($1,$2,$3)',[id,id,subscription]),/Order unavailable/);await db.query('select cafe_push_subscribe($1,$2,$3)',[id,key,subscription]);await db.query('select cafe_push_subscribe($1,$2,$3)',[id,key,subscription]);
await db.exec("update cafe_orders set status='ready';update cafe_orders set status=status;");let jobs=(await db.query('select cafe_push_lease() jobs')).rows[0].jobs;assert.equal(jobs.length,1);assert.equal((await db.query('select cafe_push_lease() jobs')).rows[0].jobs.length,0);
await db.query('select cafe_push_finish($1,$2,true)',[jobs[0].id,id]);assert.equal((await db.query('select count(*) n from umma_private.cafe_push_jobs where sent_at is not null')).rows[0].n,0);
await db.query('select cafe_push_finish($1,$2,true)',[jobs[0].id,jobs[0].lease]);await db.exec("begin;update cafe_orders set status='completed';rollback;");assert.equal((await db.query('select count(*) n from umma_private.cafe_push_jobs')).rows[0].n,1);
const privileges=(await db.query("select has_function_privilege('anon','cafe_push_config(jsonb)','execute') a,has_table_privilege('authenticated','umma_private.cafe_push_subscriptions','select') b")).rows[0];assert.equal(privileges.a,false);assert.equal(privileges.b,false);await db.close();
}
console.log('PASS order alerts: consent/sound/unread/badge, background history/dedup/click, encrypted VAPID request, capability isolation, SSRF guard, authenticated sender, expired subscriptions, PostgreSQL trigger/rollback/leases/RLS.');

// Regression: newly invited courier can collect own delivery cash without cashier navigation.
{
 const db=new PGlite();await db.exec("create sequence cafe_web_actor_seq start 1000;create table telegram_users(telegram_id bigint primary key,first_name text,role text,is_active boolean);create table locations(id uuid primary key,is_active boolean,location_type text);create table cafe_staff(telegram_id bigint,location_id uuid,staff_role text,can_accept_payments boolean,courier_available boolean,created_by_telegram_id bigint,is_active boolean default true);create table cafe_web_invites(token_hash text,actor_id bigint);create table cafe_web_accounts(actor_id bigint,active boolean);insert into telegram_users values(1,'Owner','super_admin',true);insert into locations values('11111111-1111-4111-8111-111111111111',true,'cafe');");
 await db.exec(source('supabase/proposals/cafe-web-courier-cash.sql'));
 await db.query("select cafe_web_invite_staff(1,'11111111-1111-4111-8111-111111111111','courier','QA','synthetic')");
 const courier=(await db.query('select * from cafe_staff')).rows[0];assert.equal(courier.staff_role,'courier');assert.equal(courier.can_accept_payments,true);assert.equal(courier.courier_available,true);await db.close();
 console.log('PASS new web courier receives cash-collection capability; cashier/POS role remains separate.');
}
