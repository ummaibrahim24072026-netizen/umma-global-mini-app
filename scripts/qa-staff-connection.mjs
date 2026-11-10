import {readFileSync} from 'node:fs';import {stripTypeScriptTypes} from 'node:module';import vm from 'node:vm';import {webcrypto} from 'node:crypto';import {JSDOM} from 'jsdom';import assert from 'node:assert/strict';
const read=p=>readFileSync(p,'utf8'),tick=()=>new Promise(r=>setTimeout(r,20));
const expiredAt=new Date(Date.now()-3600000).toISOString();
const employees=[{actor_id:21,name:'QA Kitchen',login:null,assignments:[{staff_role:'kitchen',location_id:'cafe',locationName:'HALAL UMMA'}],status:'invited'},{actor_id:22,name:'QA Active',login:'qa-kitchen',assignments:[{staff_role:'kitchen',location_id:'cafe',locationName:'HALAL UMMA'}],status:'active'},{actor_id:23,name:'QA Expired',login:null,assignments:[],status:'expired',inviteExpiresAt:expiredAt}];
for(const owner of [true,false]){
 const dom=new JSDOM(read('staff.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),{url:'https://qa.invalid/staff.html?work=messages',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document,calls=[];let board=0,boardMode,unread=true;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.AbortSignal=AbortSignal;w.ummaKitchen={open(...args){board++;boardMode=args;}};w.eval(read('js/cafe/web-session.js'));w.ummaStaffAuth.save('a'.repeat(64));
 w.fetch=async(url,o)=>{const b=JSON.parse(o?.body||'{}');calls.push(b);
 if(url.endsWith('cafe-connect')){
  const msg={id:'qa-message',direction:'customer',body:'Проверка связи',created_at:'2026-11-07T13:08:44Z',read_at:unread?null:'2026-11-07T13:09:00Z'};
  if(b.action==='staffRead')unread=false;
  const result=b.action==='staffList'?{clients:[{id:'customer-id',name:'Гость QA',unread:unread?1:0,last_message:msg.body}],total:1,subscribers:0,pushDevices:0}:b.action==='staffThread'?{client:{id:'customer-id',name:'Гость QA'},messages:[msg]}:{};
  return new Response(JSON.stringify({ok:true,...result}));
 }
 const out=url.endsWith('cafe-menu')?{ok:true,products:[],inventory:[]}:b.action==='me'?{ok:true,user:{id:10,name:'QA',role:owner?'super_admin':'employee'},assignments:owner?[]:[{staff_role:'kitchen',location_id:'cafe',can_accept_payments:false}],locations:[{id:'cafe',name:'HALAL UMMA'}]}:b.action==='staffList'?{ok:true,accounts:[],employees:employees.filter(e=>!calls.some(c=>c.action==='staffDismissExpiredInvite'&&c.actorId===e.actor_id))}:b.action==='inviteExisting'?{ok:true,invite:'b'.repeat(64)}:{ok:true};return new Response(JSON.stringify(out));};
 w.eval(read('js/cafe/web-operations.js'));w.eval(read('js/cafe/connect-media.js'));w.eval(read('js/cafe/connect-composer.js'));w.eval(read('js/cafe/connect-admin.js'));await tick();await tick();assert.equal(d.getElementById('webWorkspace').hidden,false);
 if(owner){
  assert.equal(d.body.dataset.workspace,'messages');
  assert.equal(d.querySelector('#webInboxCount').textContent,'1');
  assert.equal(d.querySelector('#webMessages .work-inbox').hidden,false);
  assert.equal(calls.some(b=>b.action==='staffRead'),false);
  d.querySelector('[data-client-thread]').click();await tick();
  assert.match(d.querySelector('.work-thread').textContent,/Проверка связи/);
  assert.equal(calls.find(b=>b.action==='staffRead').clientId,'customer-id');
  assert.equal(d.querySelector('#webInboxCount').hidden,true);
  d.querySelector('[data-web-tab=pos]').click();
  assert.equal(d.querySelector('#webCashViews').hidden,false);
  d.querySelector('[data-cash-view=cashOrders]').click();
  assert.equal(d.body.dataset.workspace,'cashOrders');
  assert.equal(d.querySelector('[data-web-tab=pos]').getAttribute('aria-current'),'true');
  assert.deepEqual(boardMode,[false,'payment']);
  d.querySelector('[data-web-tab=orders]').click();
  assert.deepEqual(boardMode,[false,'active']);
  d.querySelector('[data-web-tab=admin]').click();await tick();assert.equal(d.querySelectorAll('.staff-account').length,3);
  const search=d.getElementById('webStaffSearch');search.value='qa-kitchen';search.dispatchEvent(new w.Event('input'));
  assert.equal(d.querySelectorAll('.staff-account:not([hidden])').length,1);
  search.value='';search.dispatchEvent(new w.Event('input'));assert.match(d.querySelector('[data-staff-status=invited]').textContent,/Ожидает регистрации/);assert.match(d.querySelector('[data-staff-status=active]').textContent,/qa-kitchen/);assert.equal(d.querySelectorAll('[data-reinvite-staff]').length,2);d.querySelector('[data-reinvite-staff]').click();await tick();assert.equal(calls.find(b=>b.action==='inviteExisting').actorId,21);assert.match(d.getElementById('webInviteLink').href,/#invite=b{64}$/);assert.equal(d.getElementById('webInviteCopy').hidden,false);d.getElementById('webStaffRefresh').click();await tick();assert.ok(calls.filter(b=>b.action==='staffList').length>=3);
   assert.equal(d.querySelectorAll('[data-dismiss-expired-invite]').length,1);
   d.querySelector('[data-staff-status=expired] [data-dismiss-expired-invite] span').click();await tick();
   assert.equal(calls.find(b=>b.action==='staffDismissExpiredInvite').inviteExpiresAt,expiredAt);
   assert.equal(d.querySelector('[data-staff-status=expired]'),null);
   assert.equal(d.querySelectorAll('.staff-account').length,2);
 }else{assert.equal(d.body.dataset.workspace,'orders');assert.equal(board,1);assert.equal(d.querySelector('[data-web-tab=orders]').hidden,false);for(const tab of ['admin','pos','courier','messages'])assert.equal(d.querySelector('[data-web-tab='+tab+']').hidden,true);assert.equal(calls.some(b=>b.action==='staffList'),false);}
 w.close();
}
// Actual Edge handler: active/pending/expired staff are visible only to the owner; no auth secrets returned.
let handler,actor=10;const tables={telegram_users:[{telegram_id:10,first_name:'Owner',role:'super_admin',is_active:true},{telegram_id:21,first_name:'Pending',role:'employee',is_active:true},{telegram_id:22,first_name:'Active',role:'employee',is_active:true},{telegram_id:23,first_name:'Expired',role:'employee',is_active:true}],cafe_staff:[21,22,23].map(telegram_id=>({telegram_id,location_id:'cafe',staff_role:'kitchen',is_active:true})),cafe_web_accounts:[{actor_id:22,login:'qa-kitchen',active:true}],locations:[{id:'cafe',name:'HALAL UMMA'}],cafe_web_invites:[{actor_id:21,expires_at:new Date(Date.now()+3600000).toISOString(),used_at:null},{actor_id:23,expires_at:expiredAt,used_at:null,dismissed_at:null}]};
const db={from(table){let filters=[],update;const q={update(values){update=values;return q;},select(){return q;},eq(k,v){filters.push(x=>x[k]===v);return q;},in(k,values){filters.push(x=>values.map(String).includes(String(x[k])));return q;},is(k,v){filters.push(x=>x[k]===v);return q;},then(resolve,reject){const rows=(tables[table]||[]).filter(x=>filters.every(f=>f(x)));if(update)rows.forEach(row=>Object.assign(row,update));return Promise.resolve({data:rows}).then(resolve,reject);},async maybeSingle(){return {data:(tables[table]||[]).find(x=>filters.every(f=>f(x)))||null};}};return q;}};
vm.runInNewContext(stripTypeScriptTypes(read('supabase/functions/cafe-web/index.ts').replace(/^import .*;\n/gm,'')),{Deno:{serve:f=>handler=f,env:{get:()=> 'qa'}},createClient:()=>db,verifyWebStaffSession:async()=>actor,crypto:webcrypto,TextEncoder,Response,console});
const call=(action='staffList',extra={})=>handler(new Request('https://qa.invalid',{method:'POST',body:JSON.stringify({action,initData:'web:'+'a'.repeat(64),...extra})}));let response=await call(),out=await response.json();assert.equal(response.status,200);assert.equal(out.employees.find(e=>e.actor_id===21).status,'invited');assert.equal(out.employees.find(e=>e.actor_id===22).status,'active');assert.equal(out.employees.find(e=>e.actor_id===23).status,'expired');assert.equal(out.employees[0].assignments[0].locationName,'HALAL UMMA');assert.doesNotMatch(JSON.stringify(out),/token_hash|password_hash|salt/);const dismiss=(actorId,inviteExpiresAt=expiredAt)=>call('staffDismissExpiredInvite',{actorId,inviteExpiresAt});
actor=21;assert.equal((await call()).status,403);assert.equal((await dismiss(23)).status,403);
actor=10;assert.equal((await dismiss(21,tables.cafe_web_invites[0].expires_at)).status,409);
assert.equal((await dismiss(22)).status,409);
assert.equal((await dismiss(23)).status,200);assert.equal((await dismiss(23)).status,200);
out=await (await call()).json();assert.equal(out.employees.some(e=>e.actor_id===23),false);
assert.equal(tables.cafe_staff.find(s=>s.telegram_id===23).is_active,true);
tables.cafe_web_invites.push({actor_id:23,expires_at:new Date(Date.now()+3600000).toISOString(),used_at:null,dismissed_at:null});
assert.equal((await dismiss(23)).status,409);
out=await (await call()).json();assert.equal(out.employees.find(e=>e.actor_id===23).status,'invited');
console.log('PASS kitchen staff connection: pending/active/expired visibility, owner-only listing, reinvite for same employee, no auth secrets, refresh and kitchen-only landing/navigation without Telegram.');
