import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const html=readFileSync('index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://synthetic-qa.invalid'}),w=dom.window,d=w.document;
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const makeOrder=(id,status='pending')=>({id,order_number:id,status,order_type:'pickup',payment_status:'pending',payment_method:'cash',staffRole:'kitchen',cafe_order_items:[],total_vnd:50000});
let server=[makeOrder('a'),makeOrder('b')],heldList=null,holdList=false;
const mutations=[];
const result=orders=>({ok:true,orders:structuredClone(orders),staffRole:'kitchen',couriers:[],locations:[]});
w.Telegram={WebApp:{initData:'synthetic'}};w.ummaRole='employee';w.AbortSignal=AbortSignal;
w.fetch=async(url,options)=>{
 const body=JSON.parse(options.body);
 if(body.action==='list'){
  const snapshot=result(server);
  if(holdList){holdList=false;return new Promise(resolve=>{heldList=()=>resolve(new Response(JSON.stringify(snapshot)));});}
  return new Response(JSON.stringify(snapshot));
 }
 if(body.action==='updateStatus')return new Promise(resolve=>mutations.push({body,finish(ok=true){if(ok)server.find(o=>o.id===body.orderId).status=body.status;resolve(new Response(JSON.stringify(ok?{ok:true}:{ok:false,error:'QA rejected transition'}),{status:ok?200:400}));}}));
 throw Error('Unexpected API action '+body.action);
};
const button=id=>d.querySelector('#cafeKitchenOrders [data-order-id="'+id+'"][data-new-status]:not(.kitchen-cancel)');
try {
 w.eval(readFileSync('js/cafe/kitchen.js','utf8'));
 await w.ummaKitchen.refresh();
 const untouched=button('b');
 holdList=true;const stale=w.ummaKitchen.refresh({silent:true});await tick();
 const first=button('a');first.click();
 assert.equal(mutations.length,1,'first tap works while polling is in flight');
 assert.equal(first.disabled,true);assert.equal(first.textContent,'Принимаем…');assert.equal(first.getAttribute('aria-busy'),'true');
 first.click();assert.equal(mutations.length,1,'duplicate tap creates no second mutation');
 heldList();await stale;assert.equal(button('a'),first,'stale polling must not replace the pending button');
 mutations[0].finish();await tick();
 assert.equal(mutations[1].body.status,'preparing','accept proceeds to preparation automatically');
 assert.equal(button('a').disabled,true,'next action stays disabled until confirmed');
 mutations[1].finish();await tick();await tick();
 assert.equal(button('a').dataset.newStatus,'ready');assert.equal(button('a').disabled,false);
 assert.equal(button('b'),untouched,'another order card survives status updates and polling');
 button('a').click();button('b').click();
 assert.equal(mutations.length,4,'different orders do not block each other');
 assert.equal(button('a').textContent,'Подтверждаем готовность…');
 mutations[2].finish(false);mutations[3].finish();await tick();
 mutations[4].finish();await tick();await tick();
 assert.match(d.getElementById('cafeKitchenMessage').textContent,/QA rejected transition/);
 assert.equal(d.getElementById('cafeKitchenMessage').hidden,false,'failure remains visible after render');
 assert.equal(button('a').disabled,false,'failed action can be retried');
 assert.equal(button('a').dataset.newStatus,'ready','failed action never advances local status');
 assert.equal(d.querySelector('[data-new-status="cancelled"]').closest('details').open,false,'secondary actions start collapsed');
 assert.equal(d.getElementById('kitchenTabletToggle').closest('details').open,false,'utilities start collapsed');
 // A partially completed accept resumes at the server-confirmed stage.
 server=[makeOrder('partial')];await w.ummaKitchen.refresh();
 button('partial').click();mutations.at(-1).finish();await tick();
 mutations.at(-1).finish(false);await tick();await tick();
 assert.equal(button('partial').dataset.newStatus,'preparing');
 assert.equal(button('partial').disabled,false);
 assert.match(d.getElementById('cafeKitchenMessage').textContent,/Заказ принят, но начало приготовления не подтверждено/);
 const beforeRetry=mutations.length;button('partial').click();
 assert.equal(mutations.length,beforeRetry+1);assert.equal(mutations.at(-1).body.status,'preparing');
 mutations.at(-1).finish();await tick();await tick();assert.equal(button('partial').dataset.newStatus,'ready');
 console.log('PASS kitchen: first tap during polling, immediate feedback, duplicate suppression, stale-response guard, concurrent orders, persistent errors, unchanged card identity and collapsed secondary controls');
}finally{w.close();}
