import{JSDOM}from'jsdom';import{readFileSync}from'node:fs';import assert from'node:assert/strict';import{webcrypto}from'node:crypto';
const wh='22222222-2222-4222-8222-222222222222',loc='11111111-1111-4111-8111-111111111111',variant='33333333-3333-4333-8333-333333333333',unit='44444444-4444-4444-8444-444444444444';
const html=readFileSync('index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
const dom=new JSDOM(html,{url:'https://example.test',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document;
w.Telegram={WebApp:{initData:'synthetic-signed-data',initDataUnsafe:{user:{id:12,first_name:'QA'}},ready(){},expand(){},setHeaderColor(){},setBackgroundColor(){},enableClosingConfirmation(){}}};w.ummaI18n={locale:()=> 'ru-RU'};w.TextEncoder=TextEncoder;Object.defineProperty(w.crypto,'subtle',{value:webcrypto.subtle});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
const catalogue={ok:true,categories:[],warehouses:[{id:wh,name:'QA Market',location_id:loc,delivery_fee_vnd:10000,reservation_minutes:15,qr_enabled:true,transfer_enabled:false,location:{city:'Nha Trang',delivery_zone:[[12.2,109.17],[12.3,109.17],[12.3,109.22]]}}],offers:[{warehouse_id:wh,variant_id:variant,sale_mode:'individual_weight',measure:'g',price_vnd:339000,product:{name_ru:'Мясо <script>alert(1)</script>',description_ru:'Checked'},units:[{id:unit,quantity:2780,price_vnd:942420,expires_on:'2099-12-31'}]}]};
catalogue.offers.push({warehouse_id:wh,variant_id:'77777777-7777-4777-8777-777777777777',sale_mode:'individual_weight',measure:'g',price_vnd:null,available_quantity:0,units:[],product:{name_ru:'Огурцы',image_url:'https://example.test/cucumber.jpg'}});
let currentOrders=[],created=0,loss=true,warehouseOpened=0;const calls=[],saved=new Map();
w.fetch=async(url,opt)=>{const b=JSON.parse(opt.body);calls.push(b);let result={ok:true};
 if(b.action==='catalog')result=catalogue;
 else if(b.action==='bootstrap')result={ok:true,isSuperAdmin:false,roles:[{role:'picker',location_id:loc}],warehouses:[]};
 else if(b.action==='quote')result={ok:true,subtotal_vnd:942420,items:b.data.items};
 else if(b.action==='my_orders')result={ok:true,orders:currentOrders};
 else if(b.action==='order_create'){
  if(saved.has(b.request_id))result={...saved.get(b.request_id),replayed:true};else{created++;result={ok:true,order_id:'55555555-5555-4555-8555-555555555555',order_number:1,total_vnd:b.data.expected_total_vnd};saved.set(b.request_id,result);currentOrders=[{id:result.order_id,warehouse_id:wh,order_number:1,total_vnd:result.total_vnd,payment_status:'pending',payment_method:b.data.payment_method,order_type:b.data.order_type,status:'pending',items:[{product_name_ru:'Мясо',quantity:1,line_total_vnd:942420}],allocations:[]}];}
  if(loss){loss=false;throw Error('Response lost');}
 }
 return{ok:true,json:async()=>structuredClone(result)};
};
const tick=async()=>{for(let i=0;i<15;i++)await new Promise(r=>setTimeout(r,0));};
try{
 w.eval(readFileSync('js/core/app.js','utf8'));w.eval(readFileSync('js/market/api.js','utf8'));w.ummaMarket={open(){warehouseOpened++;}};w.eval(readFileSync('js/market/customer.js','utf8'));w.eval(readFileSync('js/core/navigation.js','utf8'));w.eval(readFileSync('js/core/native-shell.js','utf8'));
 d.querySelector('[data-page=market]').click();await tick();assert.equal(d.getElementById('marketShopPage').hidden,false);assert.equal(d.querySelector('.app>main').style.display,'none');assert.equal(d.querySelector('#marketShopPage script'),null);assert.ok(d.getElementById('marketShopPage').textContent.includes('<script>'));
 const preview=[...d.querySelectorAll('.market-product')].find(e=>e.textContent.includes('Огурцы'));assert.ok(preview.textContent.includes('Цена уточняется'));assert.ok(!preview.textContent.includes('₫'));assert.ok(!preview.querySelector('[data-shop-action=add]'));assert.ok(!preview.textContent.includes('Нет в наличии'),'no invented stock status on an unpriced preview');
 d.querySelector('[data-shop-action=warehouse]').click();assert.equal(warehouseOpened,1);
 d.querySelector('[data-shop-action=add]').click();assert.ok(!d.querySelector('.market-shop-cart').hidden);d.querySelector('[data-shop-action=checkout]').click();await tick();const dialog=d.querySelector('.market-checkout');assert.ok(dialog.open);assert.equal(dialog.querySelector('[data-final-total]').textContent.replace(/\D/g,''),'942420');
 const f=dialog.querySelector('form');f.elements.customer_phone.value='+840000000';f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();assert.match(dialog.querySelector('[data-checkout-status]').textContent,/Response lost/);assert.equal(created,1);
 f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();assert.equal(created,1);const submissions=calls.filter(c=>c.action==='order_create');assert.equal(submissions.length,2);assert.equal(submissions[0].request_id,submissions[1].request_id);assert.equal(submissions[0].data.items[0].unit_id,unit);assert.equal(submissions[0].data.expected_total_vnd,942420);assert.equal(d.querySelector('.market-checkout'),null);assert.ok(d.getElementById('marketShopPage').textContent.includes('№1'));
 const stored=w.sessionStorage.getItem('umma-market-requests');assert.ok(!stored?.includes('customer_phone'),'retry storage does not retain customer payloads');
 console.log('PASS Market customer UI: real route, escaped names, exact package and price, checkout, lost-response replay and order display');
}finally{w.close();}
