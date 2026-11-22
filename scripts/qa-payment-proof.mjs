import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {createHash,createHmac,webcrypto} from 'node:crypto';
import {JSDOM} from 'jsdom';
const read=p=>readFileSync(p,'utf8'),id='11111111-1111-4111-8111-111111111111';
const tick=()=>new Promise(r=>setTimeout(r,5));
async function until(check){for(let i=0;i<100;i++){if(check())return;await tick();}assert.fail('UI did not settle');}
let handler,profile={is_active:true,role:'customer'},staff=null,order={id,location_id:'cafe',customer_telegram_id:42,created_by_telegram_id:42,payment_method:'qr',payment_status:'pending',status:'pending'},proofs=[],uploaded=[],removed=[],signed=[],failInsert=false,failUpload=false;
const guestKey='22222222-2222-4222-8222-222222222222';
const staffToken='f'.repeat(64);
let transferCurrency=null;
const db={async rpc(name,args){
 if(name==='cafe_guest_checkout_payment'){assert.equal(args.p_order_id,id);return {data:{currency:transferCurrency}};}
 assert.equal(name,'cafe_guest_order_status');
 return args.p_request_key===guestKey&&args.p_order_id===id?{data:{order:{id}}}:{error:{}};
},from(table){let insert,filters=[];const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},insert(value){insert=value;return q;},order(){return q;},is(k,v){filters.push([k,v]);return q;},gt(){return q;},limit(){return Promise.resolve({data:proofs.filter(p=>filters.every(([k,v])=>p[k]===v))});},async maybeSingle(){if(table==='cafe_orders')return {data:order};if(table==='cafe_web_sessions')return {data:filters.some(([k,v])=>k==='token_hash'&&v===createHash('sha256').update(staffToken).digest('hex'))?{actor_id:42}:null};if(table==='cafe_web_accounts')return {data:{active:true}};if(table==='telegram_users')return {data:profile};if(table==='cafe_staff')return {data:staff};return {data:proofs.find(p=>filters.every(([k,v])=>p[k]===v))??null};},async single(){if(failInsert)return {error:{}};const proof={...insert,id:'proof-'+proofs.length,created_at:'2026-10-15T20:00:00Z',review_status:'pending'};proofs.unshift(proof);return {data:proof};}};return q;},storage:{from(bucket){assert.equal(bucket,'cafe-transfer-proofs');return {async upload(path,bytes,options){uploaded.push({path,bytes,options});return failUpload?{error:{}}:{};},async remove(paths){removed.push(...paths);return {};},async createSignedUrl(path,seconds,options){signed.push({path,seconds,options});return {data:{signedUrl:'https://zwzojugspldexyyljwpr.supabase.co/storage/v1/object/sign/cafe-transfer-proofs/test?token=synthetic'}};}};}}};
const helper=read('supabase/functions/_shared/web-staff-auth.ts').replace(/^export /gm,'');
const code=stripTypeScriptTypes(helper+'\n'+read('supabase/functions/cafe-transfer-proof/index.ts').replace(/^import .*;\n/gm,''));vm.runInNewContext(code,{Deno:{serve:fn=>handler=fn,env:{get:k=>k==='TELEGRAM_BOT_TOKEN'?'test-token':'synthetic'}},createClient:()=>db,crypto:webcrypto,URLSearchParams,TextEncoder,Response,atob,console:{error(){}}});
const params=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:42})}),check=[...params].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');params.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update('test-token').digest()).update(check).digest('hex'));
const bytes=Buffer.alloc(100,0);bytes.set([137,80,78,71,13,10,26,10]);const base={action:'submit',orderId:id,initData:params.toString(),mimeType:'image/png',base64:bytes.toString('base64'),bankCountry:'RU'};
async function request(body={}){const response=await handler(new Request('https://qa.invalid',{method:'POST',body:JSON.stringify({...base,...body})}));return {status:response.status,data:await response.json()};}
let response=await request();assert.equal(response.status,200);assert.equal(proofs[0].bank_country,'VN','QR country comes from method');assert.equal(order.payment_status,'pending');assert.equal(uploaded[0].options.upsert,false);
response=await request();assert.equal(response.status,200);assert.equal(uploaded.length,1,'retry of identical receipt cannot duplicate it');assert.equal(proofs.length,1);
response=await request({action:'mine'});assert.equal(response.data.proofs.length,1);assert.equal(response.data.proofs[0].status,'pending');assert.equal('file_path' in response.data.proofs[0],false);
order.customer_telegram_id=99;order.created_by_telegram_id=99;assert.equal((await request()).status,403);assert.equal((await request({action:'mine'})).status,403);order.customer_telegram_id=42;
order.status='cancelled';assert.equal((await request()).status,409);order.status='pending';order.payment_status='paid';assert.equal((await request()).status,409);order.payment_status='pending';
assert.equal((await request({mimeType:'text/html'})).status,400);assert.equal((await request({base64:Buffer.alloc(100,1).toString('base64')})).status,400);assert.equal((await request({base64:'A'.repeat(7200001)})).status,400);
assert.equal((await request({initData:'invalid'})).status,401);profile.is_active=false;assert.equal((await request()).status,403);profile.is_active=true;
assert.equal((await request({action:'list'})).status,403);profile.role='employee';assert.equal((await request({action:'list'})).status,403);staff={can_accept_payments:true};response=await request({action:'list'});assert.equal(response.status,200);assert.equal(response.data.proofs.length,1);assert.equal(signed[0].seconds,120);
profile.role='customer';proofs=[];failInsert=true;assert.equal((await request()).status,500);assert.equal(removed.length,1,'failed DB save cleans up private upload');failInsert=false;
order.payment_method='bank_transfer';response=await request();assert.equal(response.status,200);assert.equal(proofs[0].bank_country,'RU');proofs=[];assert.equal((await request({bankCountry:'VN'})).status,400);order.payment_method='cash';assert.equal((await request()).status,400);
// A guest order's receipt key authorizes only its own RUB transfer.
order={...order,customer_telegram_id:null,created_by_telegram_id:null,payment_method:'bank_transfer',rub_payment_kopecks:47943};
const pdf=Buffer.from('%PDF-1.7\n'+' '.repeat(100)).toString('base64');
const guest={action:'guestSubmit',initData:undefined,requestKey:guestKey,mimeType:'application/pdf',base64:pdf,bankCountry:'KZ'};
assert.equal((await request({...guest,requestKey:id})).status,403);
assert.equal((await request({...guest,base64:base.base64})).status,400);
assert.equal((await request(guest)).status,200);
assert.equal(proofs[0].customer_telegram_id,null);
assert.equal(proofs[0].bank_country,'RU');
assert.equal(order.payment_status,'pending');
assert.equal((await request(guest)).data.proofId,proofs[0].id);
assert.equal((await request({...guest,mimeType:'image/png',base64:base.base64})).status,409);
assert.equal((await request({...guest,action:'guestMine'})).data.proofs.length,1);
profile.role='employee';staff={can_accept_payments:false};
const staffReq={action:'list',initData:'web:'+staffToken};
assert.equal((await request(staffReq)).status,403);
staff={can_accept_payments:true};
assert.equal((await request({...staffReq,initData:'web:'+'a'.repeat(64)})).status,401);
assert.equal((await request(staffReq)).data.proofs[0].mimeType,'application/pdf');
assert.equal(signed.at(-1).options.download,'receipt.pdf');
order.payment_status='paid';
assert.equal((await request(guest)).status,409);
order.payment_status='pending';
order.rub_payment_kopecks=null;
for(const [method,currency,country] of [['bank_transfer','KZT','KZ'],['bank_transfer','USDT','CRYPTO'],['qr',null,'VN']]){
 proofs=[];order.payment_method=method;transferCurrency=currency;
 assert.equal((await request(guest)).status,200);
 assert.equal(proofs[0].bank_country,country);
 assert.equal(order.payment_status,'pending');
}
order.payment_method='cash';
assert.equal((await request(guest)).status,403);
// Actual client attachment controls, isolated FileReader and network.
const dom=new JSDOM('<body></body>',{runScripts:'outside-only',url:'https://qa.invalid/'}),w=dom.window,d=w.document;let mode='ok',held,requests=[],mine=[{status:'pending'}];
w.Telegram={WebApp:{initData:'synthetic'}};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};w.HTMLCanvasElement.prototype.getContext=()=>({fillRect(){},set fillStyle(v){}});w.HTMLCanvasElement.prototype.toDataURL=()=> 'data:image/png;base64,AA==';
w.FileReader=class{readAsDataURL(file){this.result='data:'+file.type+';base64,'+base.base64;queueMicrotask(()=>this.onload());}};
const payment={orderId:id,orderNumber:'DEMO',account:'0000000000',bankCode:'vcb',bankName:'Vietcombank',amount:125000,reference:'UMMA DEMO',qrPayload:'UI TEST ONLY'};
w.fetch=async(url,opts)=>{const body=JSON.parse(opts.body);requests.push(body);if(body.action==='paymentDetails')return new Response(JSON.stringify({ok:true,payment}));if(body.action==='mine')return new Response(JSON.stringify({ok:true,proofs:mine}));if(mode==='held')return new Promise(resolve=>held=resolve);if(mode==='fail')return new Response('{"ok":false,"error":"Ошибка сети"}',{status:500});return new Response('{"ok":true,"proofId":"synthetic"}');};
w.eval(read('js/vendor/qrcode-generator.js'));w.eval(read('js/cafe/payment.js'));
await w.ummaCafePayment.show(id);assert.equal(d.querySelector('input[type=file]'),null);let support=d.querySelector('.cafe-payment-support');support.open=true;support.dispatchEvent(new w.Event('toggle'));await until(()=>d.querySelector('.cafe-payment-receipt [role=status]').textContent==='Чек отправлен');
assert.equal(d.querySelector('.cafe-payment-copy'),null);assert.equal(d.querySelector('.cafe-payment-sheet').textContent.includes('Копировать'),false);
assert.equal(support.querySelector('.cafe-payment-receipt button').hidden,true);
mine=[];
await w.ummaCafePayment.show(id);
support=d.querySelector('.cafe-payment-support');
support.open=true;
support.dispatchEvent(new w.Event('toggle'));
const input=d.querySelector('input[type=file]'),send=d.querySelector('.cafe-payment-receipt button');
async function select(type,size){Object.defineProperty(input,'files',{configurable:true,value:[{type,size}]});input.dispatchEvent(new w.Event('change'));await tick();}
await select('application/pdf',100);assert.equal(send.disabled,true);assert.match(d.querySelector('.cafe-payment-receipt').textContent,/до 5 МБ/);
await select('image/png',5242881);assert.equal(send.disabled,true);await select('image/png',100);assert.equal(send.disabled,false);assert.equal(d.querySelector('.cafe-payment-preview').hidden,false);
mode='fail';send.click();await until(()=>send.textContent==='Повторить отправку');assert.equal(send.disabled,false);assert.equal(input.disabled,false);assert.equal(d.querySelector('.cafe-payment-sheet').open,true,'upload failure keeps QR available');
mode='held';send.click();send.click();assert.equal(requests.filter(r=>r.action==='submit').length,2,'one failed attempt plus one held attempt, duplicate tap ignored');assert.equal(send.disabled,true);held(new Response('{"ok":true}'));await until(()=>send.textContent==='Чек отправлен');assert.equal(send.disabled,true);assert.equal(send.hidden,true);assert.equal(d.querySelector('.cafe-payment-sheet').open,true);assert.equal(requests.some(r=>r.action==='updatePayment'),false);
dom.window.close();
// Web guest receipt uses the saved order key and keeps payment pending.
const webHtml=read('menu/index.html');
const webDom=new JSDOM(webHtml,{runScripts:'outside-only',url:'https://qa.invalid/menu/'}),ww=webDom.window,wd=ww.document;
ww.AbortSignal=AbortSignal;
ww.FileReader=w.FileReader;
const webCalls=[];
let savedGuestProof=false;
ww.fetch=async(url,options)=>{
 const b=JSON.parse(options.body);webCalls.push(b);
 if(b.action==='guestMine')return new Response(JSON.stringify({ok:true,proofs:savedGuestProof?[{status:'pending'}]:[]}));
 savedGuestProof=true;
 return new Response(JSON.stringify({ok:true,proofId:'synthetic'}));
};
ww.eval(read('js/cafe/public-menu-extras.js'));
const webOrder={id,requestKey:guestKey,status:'pending',paymentStatus:'pending',paymentMethod:'bank_transfer',payment:{currency:'RUB',kopecks:47943,rate:312,bankName:'Сбер',recipient:'Test',phone:'+70000000000'}};
const ctx={API:'https://qa.invalid/',money:String,t:s=>s,activeReceipts:()=>[]};
ww.ummaGuestExtras.receipt(webOrder,ctx);
assert.equal(wd.getElementById('guestTransferProof').hidden,false);
const receiptView=wd.getElementById('success');
assert.equal(receiptView.hasAttribute('data-proof-sent'),false);
const webInput=wd.getElementById('guestTransferProofFile');
Object.defineProperty(webInput,'files',{value:[{type:'application/pdf',name:'receipt.pdf',size:100}]});
webInput.dispatchEvent(new ww.Event('change'));
await until(()=>wd.getElementById('attachGuestTransferProof').hidden);
const proofStatus=wd.getElementById('guestTransferProofStatus');
assert.equal(proofStatus.textContent,'Чек отправлен');
assert.equal(receiptView.hasAttribute('data-proof-sent'),true);
for(const id of ['guestTransferProofHint','transferCopyStatus','newOrder','receiptHint','syncState']){
 const element=wd.getElementById(id);
 const hiddenNode=id==='receiptHint'?element.closest('.receipt-instructions'):element;
 assert.equal(ww.getComputedStyle(hiddenNode).display,'none',id);
}
assert.equal(ww.getComputedStyle(proofStatus).display,'flex');
assert.equal(webCalls.find(x=>x.action==='guestSubmit').requestKey,guestKey);
assert.equal(webOrder.paymentStatus,'pending');
ww.ummaGuestExtras.receipt({...webOrder,paymentStatus:'paid',payment:null},ctx);
assert.equal(wd.getElementById('guestTransferProof').hidden,true);
assert.equal(receiptView.hasAttribute('data-proof-sent'),false);
ww.ummaGuestExtras.receipt({...webOrder,id:'reopened',payment:{currency:'KZT',amount:1000,account:'+77000000000'}},ctx);
await until(()=>receiptView.hasAttribute('data-proof-sent'));
assert.equal(proofStatus.textContent,'Чек отправлен');
savedGuestProof=false;
for(const [method,details] of [['bank_transfer',{currency:'KZT',amount:1000}],['bank_transfer',{currency:'USDT',amount:5}],['qr',null]]){
 ww.ummaGuestExtras.receipt({...webOrder,id:webOrder.id+String(details?.currency),paymentMethod:method,payment:details},ctx);
 assert.equal(wd.getElementById('guestTransferProof').hidden,false);
}
webDom.window.close();
// Staff can view submitted QR screenshots without changing payment status.
const staffDom=new JSDOM(read('index.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),{runScripts:'outside-only',url:'https://qa.invalid'}),sw=staffDom.window,sd=sw.document;let mutations=0;sw.Telegram={WebApp:{initData:'synthetic'}};sw.ummaRole='employee';sw.HTMLDialogElement.prototype.showModal=function(){this.open=true;};sw.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new sw.Event('close'));};
sw.fetch=async(url,opts)=>{const body=JSON.parse(opts.body);if(url.includes('cafe-transfer-proof'))return new Response(JSON.stringify({ok:true,proofs:[{status:'pending',createdAt:'2026-10-15T20:00:00Z',url:'https://zwzojugspldexyyljwpr.supabase.co/storage/v1/object/sign/cafe-transfer-proofs/demo?token=synthetic'}]}));if(body.action!=='list')mutations++;return new Response(JSON.stringify({ok:true,staffRole:'manager',orders:[{id,order_number:1,status:'pending',order_type:'pickup',payment_status:'pending',payment_method:'qr',canAcceptPayments:true,staffRole:'manager',total_vnd:125000,cafe_order_items:[]}]}));};
sw.eval(read('js/cafe/kitchen.js'));await sw.ummaKitchen.refresh();const button=sd.querySelector('[data-proof-order]');assert.ok(button);button.click();await until(()=>sd.querySelector('.cafe-payment-sheet[open] img'));assert.match(sd.querySelector('.cafe-payment-sheet[open]').textContent,/фактическое поступление/);assert.equal(mutations,0);staffDom.window.close();
console.log('PASS receipt attachment: owner/auth/closed-order guards, VN QR + RU transfer, validation, content deduplication, private 120s review URLs, upload cleanup, preview/retry/double tap, saved status, staff viewer and no automatic payment');

const counterDom=new JSDOM(read('staff.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),{
 runScripts:'outside-only',url:'https://qa.invalid/staff.html',pretendToBeVisual:true,
});
const cw=counterDom.window,cd=cw.document;
cw.AbortSignal=AbortSignal;
cw.scrollTo=()=>{};
cw.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
cw.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new cw.Event('close'));};
const counterOrder={
 id,order_number:451,status:'pending',order_type:'pickup',payment_status:'pending',payment_method:'bank_transfer',
 rub_payment_kopecks:45000,location_id:'cafe',canAcceptPayments:true,staffRole:'cashier',total_vnd:150000,
 created_via:'customer',chat_available:false,requires_prepayment:true,cafe_order_items:[],
};
const proofUrl='https://zwzojugspldexyyljwpr.supabase.co/storage/v1/object/sign/cafe-transfer-proofs/demo?token=synthetic';
let submitted=0,viewRequests=0,attachmentPresent=false;
cw.fetch=async(url,opts)=>{
 const b=JSON.parse(opts?.body||'{}');
 let data={ok:true};
 if(url.endsWith('cafe-menu'))data={ok:true,products:[],inventory:[],locations:[{id:'cafe',name:'UMMA'}]};
 else if(b.action==='me')data={ok:true,user:{id:42,name:'QA',role:'employee'},assignments:[{location_id:'cafe',staff_role:'cashier',can_accept_payments:true}],locations:[{id:'cafe',name:'UMMA'}]};
 else if(url.endsWith('cafe-transfer-proof')){
  assert.equal(b.action,'list');assert.equal(b.orderId,id);assert.equal(b.initData,'web:'+staffToken);
  viewRequests++;
  data.proofs=[
   {status:'pending',createdAt:'2026-10-15T20:00:00Z',url:proofUrl},
   {status:'pending',createdAt:'2026-10-15T20:00:00Z',url:proofUrl,mimeType:'application/pdf'},
  ];
 }else if(b.action==='list')data.orders=[{...counterOrder,requiresGuestPaymentProof:true,hasPendingPaymentProof:b.includePaymentProof&&attachmentPresent&&counterOrder.payment_status==='pending'}];
 else if(b.action==='details')data.counter=false;
 else if(b.action==='updatePayment'){
  assert.equal(b.orderId,id);assert.equal(b.paymentStatus,'paid');assert.equal(b.paymentMethod,'bank_transfer');
  submitted++;
  counterOrder.payment_status='paid';counterOrder.status='confirmed';
  data.order={status:'confirmed',paymentStatus:'paid',paidByTelegramId:42};
 }
 return new Response(JSON.stringify(data));
};
try{
 cw.eval(read('js/cafe/web-session.js'));cw.ummaStaffAuth.save(staffToken);
 cw.eval(read('js/cafe/kitchen.js'));cw.eval(read('js/cafe/web-operations.js'));
 await until(()=>!cd.getElementById('webWorkspace').hidden);
 cd.querySelector('[data-work-mode=pos]').click();
 cd.querySelector('[data-counter-view=orders]').click();
 await until(()=>cd.querySelector('[data-counter-action=pay]'));
 assert.doesNotMatch(cd.getElementById('counterOrderList').textContent,/Чек прикреплён/);
 cd.querySelector('[data-counter-action=pay]').click();
 const open=cd.getElementById('counterOpenProof'),confirm=cd.getElementById('posConfirmQr');
 await until(()=>!confirm.hidden);
 assert.equal(open.textContent,'Проверить чек клиента');
 cd.getElementById('counterPaymentVerified').click();
 assert.equal(confirm.disabled,true,'a bank check alone cannot confirm an order awaiting a receipt');
 attachmentPresent=true;
 cd.dispatchEvent(new cw.Event('umma:fulfillment-realtime'));
 await until(()=>open.textContent==='Открыть чек клиента'&&!confirm.disabled);
 assert.match(cd.getElementById('counterOrderList').textContent,/Чек прикреплён/);
 open.click();open.click();
 await until(()=>cd.querySelector('.cafe-payment-sheet[open] img'));
 assert.equal(viewRequests,1);
 assert.equal(submitted,0);
 const dialog=cd.querySelector('.cafe-payment-sheet[open]');
 assert.match(dialog.getAttribute('aria-label'),/№451/);
 assert.match(dialog.textContent,/Скачать чек PDF/);
 dialog.close();
 confirm.click();confirm.click();
 await until(()=>submitted===1&&cd.getElementById('counterProofActions').hidden);
 assert.match(cd.getElementById('posResult').textContent,/Оплата подтверждена/);
 console.log('PASS counter receipt: order indicator, signed screenshot and PDF, explicit bank verification, exactly one payment confirmation.');
}finally{counterDom.window.close();}
