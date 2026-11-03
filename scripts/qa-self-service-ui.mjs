import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const html=readFileSync('index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
const tick=()=>new Promise(r=>setTimeout(r,15));
for(const canPay of [true,false]){
 const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://qa.invalid'}),w=dom.window,d=w.document;
 const order={id:'qa-self-service',location_id:'qa-cafe',order_number:123,status:'pending',order_type:'pickup',requires_prepayment:true,payment_status:'pending',payment_method:'cash',total_vnd:90000,staffRole:canPay?'cashier':'kitchen',canAcceptPayments:canPay,cafe_order_items:[{product_name_ru:'Шурпа',quantity:1,line_total_vnd:90000}]};
 let alerted=[];w.ummaKitchenLive={update:items=>{alerted=items;},notice:()=>''};
 const requests=[];w.Telegram={WebApp:{initData:'synthetic'}};w.ummaRole='employee';w.AbortSignal=AbortSignal;
 w.fetch=async(url,opt)=>{const b=JSON.parse(opt.body);requests.push(b);if(b.action==='list')return new Response(JSON.stringify({ok:true,orders:[order],staffRole:order.staffRole,locationIds:['qa-cafe'],locations:[{id:'qa-cafe',name:'QA',self_service_enabled:true}],couriers:[]}));if(b.action==='updatePayment'){assert.equal(canPay,true);assert.equal(b.tenderedAmountVnd,100000);assert.equal(b.changeGivenVnd,10000);order.payment_status='paid';order.status='preparing';return new Response(JSON.stringify({ok:true,order:{paymentStatus:'paid',status:'preparing'}}));}if(b.action==='updateStatus'){assert.equal(order.payment_status,'paid');order.status=b.status;return new Response(JSON.stringify({ok:true,order:{status:order.status}}));}throw Error(b.action);};
 w.eval(readFileSync('js/cafe/kitchen.js','utf8'));await w.ummaKitchen.refresh();await tick();
 const root=d.getElementById('cafeKitchenOrders');
 assert.equal(root.querySelector('[data-new-status="preparing"]'),null);
 if(!canPay){assert.equal(alerted.length,0,'unpaid order does not notify preparation-only kitchen');assert.equal(root.querySelector('[data-kitchen-order]'),null);w.close();continue;}
 const pay=root.querySelector('[data-payment-status="paid"]');assert.ok(pay);assert.match(root.textContent,/Ожидает оплаты у кассира/);assert.equal(pay.closest('details'),null);assert.equal(d.getElementById('staffTablePicker').hidden,true);
 pay.click();const input=d.getElementById('cashPayTendered');input.value='80000';input.dispatchEvent(new w.Event('input'));assert.equal(d.getElementById('cashPayConfirm').disabled,true);
 input.value='100000';input.dispatchEvent(new w.Event('input'));d.getElementById('cashPayConfirm').click();await tick();await tick();
 assert.equal(requests.filter(b=>b.action==='updatePayment').length,1);assert.equal(root.querySelector('[data-payment-status="paid"]'),null);assert.ok(root.querySelector('[data-new-status="ready"]'));assert.match(root.textContent,/Оплачено/);
 root.querySelector('[data-new-status="ready"]').click();await tick();await tick();assert.ok(root.querySelector('[data-new-status="completed"]'));
 root.querySelector('[data-new-status="completed"]').click();await tick();await tick();assert.equal(order.status,'completed');assert.equal(root.querySelector('[data-kitchen-order]'),null);
 w.close();
}
console.log('PASS self-service UI: cashier queue, visible cash button, no unpaid preparation, exact cash/change, paid→ready→issued, table-free checkout and kitchen isolation.');
