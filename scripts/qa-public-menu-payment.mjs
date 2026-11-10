import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {paymentFor} from '../supabase/functions/cafe-my-orders/payment.ts';
const read=p=>readFileSync(p,'utf8'),html=read('menu/index.html');
const product={id:'def936dc-6c57-4b06-ac32-cdf6a736c238',sku:'UMMA-CAFE-SHURPA',name_ru:'Шурпа',name_en:'Shurpa',price_vnd:90000};
const item={name_ru:'Шурпа',name_en:'Shurpa',quantity:2,unitPriceVnd:45000,lineTotalVnd:90000};
for(const method of ['cash','qr']){
 let created=0,calls=[],lost=true,paid=false;
 const base={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',orderNumber:98765,totalVnd:90000,paymentMethod:method,paymentStatus:'pending',status:'pending',items:[item]};
 const payment=paymentFor({id:base.id,order_number:98765,total_vnd:90000,location_id:'e22788bd-4734-4b3a-911e-ba103d52617a',payment_method:'qr',payment_status:'pending',currency:'VND',status:'pending'});
 const dom=new JSDOM(html,{url:'https://example.com/menu/',runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){
  w.localStorage.setItem('umma-menu-language','ru');w.AbortSignal=AbortSignal;
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  w.HTMLCanvasElement.prototype.getContext=()=>({fillRect(){},set fillStyle(v){}});w.HTMLCanvasElement.prototype.toDataURL=()=> 'data:image/png;base64,AA==';
  w.eval(read('js/cafe/public-menu-i18n.js'));w.eval(read('js/vendor/qrcode-generator.js'));w.eval(read('js/cafe/public-menu-extras.js'));
  w.fetch=async(url,options)=>{if(!options?.body)return new Response(JSON.stringify({ok:true,products:[product]}));const b=JSON.parse(options.body);calls.push(b);if(b.action==='create'){created++;if(lost){lost=false;throw Error('Simulated lost response');}return new Response(JSON.stringify({ok:true,order:base,payment:method==='qr'?payment:null}));}return new Response(JSON.stringify({ok:true,order:{...base,status:paid?'ready':'preparing',paymentStatus:paid?'paid':'pending',cashReceipt:paid&&method==='cash'?{tenderedVnd:100000,changeVnd:10000}:null},payment:method==='qr'&&!paid?payment:null}));};
 }});
 const w=dom.window,d=w.document;await new Promise(r=>setTimeout(r,20));
 d.querySelector('[data-change="1"]').click();d.getElementById('openCart').click();d.querySelector('[name=paymentMethod][value='+method+']').checked=true;
 const submit=()=>d.getElementById('form').dispatchEvent(new w.Event('submit',{cancelable:true}));submit();await new Promise(r=>setTimeout(r,20));assert.ok(d.getElementById('result').textContent.includes('Не удалось'));submit();await new Promise(r=>setTimeout(r,30));
 assert.equal(created,2);assert.equal(calls[0].requestKey,calls[1].requestKey);assert.equal(calls[0].paymentMethod,method);assert.equal(d.getElementById('success').hidden,false);assert.equal(d.getElementById('guestPayment').hidden,method!=='qr');assert.ok(d.getElementById('paymentState').textContent.includes(method==='qr'?'QR':'наличными'));
 const receiptLines=d.getElementById('receiptDetails');
 assert.equal(receiptLines.hidden,false);
 assert.match(receiptLines.textContent,/Шурпа2 × 45\D?000.*90\D?000/);
 assert.equal(d.getElementById('receiptCash').hidden,true);
 if(method==='qr'){assert.equal(d.getElementById('paymentBank').options.length,6);assert.ok(d.getElementById('paymentQr').src.startsWith('data:image/png'));d.getElementById('paymentBank').value='mb';d.getElementById('paymentBank').dispatchEvent(new w.Event('change'));const url=new URL(d.getElementById('openBank').href);assert.equal(url.searchParams.get('am'),'90000');assert.equal(url.searchParams.get('ba'),'1062679069@vcb');assert.equal(url.searchParams.get('tn'),'UMMA 98765');}
 for(const code of Object.keys(w.ummaMenuI18n.languages)){w.ummaMenuI18n.setLanguage(code);for(const key of ['Язык','На главный экран','Способ оплаты','Наличные','По QR-коду','Ваш банк','Открыть банк','Сохранить QR','Ожидаем оплату по QR','Получено наличными','Сдача','Стоимость блюд','Стоимость доставки','Скидка'])if(code!=='ru')assert.ok(!/[А-Яа-яЁё]/.test(w.ummaMenuI18n.t(key)),code+': '+key);}
 w.ummaMenuI18n.setLanguage('ru');paid=true;d.dispatchEvent(new w.Event('visibilitychange'));await new Promise(r=>setTimeout(r,20));assert.equal(d.getElementById('paymentState').textContent,'Оплачено');assert.equal(d.getElementById('guestPayment').hidden,true);assert.equal(d.getElementById('orderState').textContent,'Заказ готов');assert.equal(calls.filter(x=>/paid|confirm/.test(x.action)).length,0);assert.ok(JSON.parse(w.sessionStorage.getItem('umma-menu-receipt')).requestKey);
 assert.equal(d.getElementById('receiptCash').hidden,method!=='cash');
 if(method==='cash'){
  assert.match(d.getElementById('receiptTendered').textContent,/100\D?000/);
  assert.match(d.getElementById('receiptChange').textContent,/10\D?000/);
  assert.equal(JSON.parse(w.localStorage.getItem('umma-menu-receipt')).cashReceipt.changeVnd,10000);
 }
 d.getElementById('newOrder').click();d.getElementById('installApp').click();assert.equal(d.getElementById('installHelp').hidden,false);dom.window.close();
}
console.log('PASS public guest cash/QR: retry key, method, bank/amount/reference, local QR, 12-language labels, live preparation/payment status, receipt recovery and install guidance.');
// Exercise the deployed handler code: guest capabilities, server totals and payment scope.
const {stripTypeScriptTypes}=await import('node:module');const vm=await import('node:vm');const {webcrypto}=await import('node:crypto');
let handler,rpcCalls=[],allowStatus=true,receiptReads=0,storedMethod='qr',storedStatus='pending';
const receiptQuery={
 select(){return this;},
 eq(field,value){if(field==='id')assert.equal(value,order.id);return this;},
 order(){return this;},limit(){return this;},
 async maybeSingle(){return {data:{
  subtotal_vnd:90000,delivery_fee_vnd:0,discount_vnd:0,total_vnd:90000,payment_method:storedMethod,payment_status:storedStatus,status:'pending',
  cafe_order_items:[{product_name_ru:item.name_ru,product_name_en:item.name_en,quantity:2,unit_price_vnd:45000,line_total_vnd:90000}],
  cafe_payment_receipts:[{tendered_amount_vnd:90000,change_given_vnd:0,internal_note:'private'}],
 }};},
};
const order={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',orderNumber:10,totalVnd:90000,paymentMethod:'qr',paymentStatus:'pending',status:'pending'};
const db={from(table){assert.equal(table,'cafe_orders');receiptReads++;return receiptQuery;},rpc:async(name,args)=>{rpcCalls.push({name,args});return name==='cafe_guest_order_status'?allowStatus?{data:{ok:true,order:{...order,location_id:'e22788bd-4734-4b3a-911e-ba103d52617a',payment_method:'qr',payment_status:'pending',currency:'VND'}}}:{error:{message:'denied'}}:{data:{ok:true,order:{...order,paymentMethod:args.p_payment_method}}};}};
vm.runInNewContext(stripTypeScriptTypes(read('supabase/functions/cafe-guest-order/index.ts').replace(/^import .*;\n/gm,'')),{Deno:{serve:fn=>handler=fn,env:{get:()=> 'synthetic-test'}},createClient:()=>db,paymentFor,crypto:webcrypto,TextEncoder,URL,Response,console});
const payload={action:'create',requestKey:'12345678-1234-4123-8123-123456789abc',locationId:'e22788bd-4734-4b3a-911e-ba103d52617a',items:[{productId:product.id,quantity:1}],paymentMethod:'qr',amount:1,account:'wrong',paymentStatus:'paid'};
const req=b=>handler(new Request('https://qa.invalid',{method:'POST',body:JSON.stringify(b)}));
let response=await req(payload),body=await response.json();assert.equal(response.status,201);assert.equal(body.payment.amount,90000);assert.equal(body.payment.account,'1062679069');assert.equal(body.order.paymentStatus,'pending');assert.equal(body.order.cashReceipt,null);assert.deepEqual(body.order.items,[item]);assert.equal(rpcCalls[0].name,'submit_cafe_guest_order_v3');assert.equal(rpcCalls[0].args.p_payment_method,'qr');
response=await req({...payload,paymentMethod:'card'});assert.equal(response.status,400);assert.equal(rpcCalls.length,1);
storedMethod='cash';response=await req({...payload,paymentMethod:'cash'});body=await response.json();assert.equal(body.payment,null);
storedMethod='qr';response=await req({action:'status',requestKey:payload.requestKey,orderId:order.id});body=await response.json();assert.equal(response.status,200);assert.equal(body.payment.amount,90000);assert.equal(body.order.location_id,undefined);
storedMethod='cash';storedStatus='paid';
response=await req({action:'status',requestKey:payload.requestKey,orderId:order.id});
body=await response.json();assert.deepEqual(body.order.cashReceipt,{tenderedVnd:90000,changeVnd:0});assert.equal(body.payment,null);
const readsBeforeDenial=receiptReads;
allowStatus=false;response=await req({action:'status',requestKey:payload.requestKey,orderId:order.id});assert.equal(response.status,404);assert.equal(receiptReads,readsBeforeDenial);assert.equal((await response.json()).payment,undefined);
console.log('PASS guest endpoint: server-only amount/account/status, cash compatibility, bank method validation, receipt capability and private-field omission.');
