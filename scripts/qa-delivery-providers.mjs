import {JSDOM} from 'jsdom';import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
const dom=new JSDOM(readFileSync('index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),{url:'https://umma.example',runScripts:'outside-only'}),w=dom.window,d=w.document;
try{
 w.ummaI18n={locale:()=> 'ru',field:(p,k)=>p[k+'_ru']};w.Telegram={WebApp:{initData:'synthetic',initDataUnsafe:{user:{id:123}}}};
 w.ummaDeliveryLocation={availability:()=> 'available',setCafeLocation(){},reset(){},setCarrierMode(){},getAddress:()=> 'Точка доставки: 12.27,109.21'};
 let sent;w.ummaCafeRequests={request:async(u,b)=>{sent=b;return {ok:true,json:async()=>({ok:true,order:{id:'order',orderNumber:7,totalVnd:90000}})}}};
 w.fetch=async()=>({ok:true,json:async()=>({ok:true,locations:[{id:'cafe',name:'UMMA'}],products:[{id:'soup',sku:'UMMA-CAFE-SHURPA',name_ru:'Шурпа',price_vnd:90000}]})});
 w.eval(readFileSync('js/delivery/providers.js','utf8'));const p=w.ummaDeliveryProviders;
 assert.equal(p.options('cafe').includes('Grab'),false);assert.equal(p.options('cafe').includes('Maxim'),false);assert.equal(p.options('cafe').includes('Lalamove'),false);
 for(const id of ['grab','maxim','lalamove','unknown'])assert.equal(p.external(id,'cafe'),false);
 assert.deepEqual([...d.getElementById('cafeCarrier').options].map(o=>o.value),['umma']);
 const historic={order_type:'pickup',customer_note:'[UMMA-DELIVERY:grab]\nGrabExpress: курьера оформляет клиент.\nБез лука',status:'pending',payment_status:'paid',order_number:5,delivery_address:'Hotel'};
 assert.equal(p.provider(historic),'grab','existing orders retain their original fulfillment');assert.match(p.card(historic,{name:'UMMA',address:'Scenia Bay'}),/GrabExpress/);
 w.eval(readFileSync('js/cafe/cafe.js','utf8'));await w.ummaCafe.refreshMenu();d.querySelector('[data-add-product]').click();
 const type=d.getElementById('cafeOrderType');type.value='delivery';type.dispatchEvent(new w.Event('change'));
 assert.equal(d.getElementById('cafeCarrierLabel').hidden,true);assert.equal(d.getElementById('cafePaymentMethod').value,'cash');
 d.getElementById('cafeOrderForm').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,10));
 assert.equal(sent.orderType,'delivery');assert.equal(sent.paymentTiming,'on_delivery');assert.equal(sent.customerNote.includes('UMMA-DELIVERY'),false);
 console.log('PASS UMMA-only checkout: no third-party options, hidden redundant selector, real own delivery with cash and historic provider preservation');
}finally{w.close();}
