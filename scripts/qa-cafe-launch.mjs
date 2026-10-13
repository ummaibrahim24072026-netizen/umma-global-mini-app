import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { loadCafeOrders } from '../supabase/functions/cafe-kitchen/order-list.ts';
import { sandboxCanAdvance } from '../supabase/functions/cafe-kitchen/sandbox-policy.ts';

// In-memory PostgREST double: no network, Telegram notifications or live writes.
const rows = Array.from({length:335}, (_,i)=>({
  id:String(i).padStart(4,'0'), status:i<130?'completed':'pending',
  created_at:new Date(2026,0,1,0,i).toISOString(), location_id:i===334?'other':'cafe',
  courier_telegram_id:7, order_type:'delivery',
}));
function client(fail=false) { return { from(table) {
  assert.equal(table,'cafe_orders');
  let data=[...rows], ordering=[], max=Infinity;
  const q={
    select(){return q;},
    in(key,values){data=data.filter(r=>values.includes(r[key]));return q;},
    eq(key,value){data=data.filter(r=>r[key]===value);return q;},
    gt(key,value){data=data.filter(r=>r[key]>value);return q;},
    not(key,op,value){assert.equal(op,'in');const values=value.slice(1,-1).split(',');data=data.filter(r=>!values.includes(r[key]));return q;},
    order(key,{ascending}){ordering.push([key,ascending]);return q;},
    limit(value){max=value;return q;},
    then(resolve){data.sort((a,b)=>{for(const [key,asc] of ordering){const cmp=String(a[key]).localeCompare(String(b[key]));if(cmp)return asc?cmp:-cmp;}return 0;});return Promise.resolve(fail?{data:null,error:{message:'offline'}}:{data:data.slice(0,max),error:null}).then(resolve);}
  };return q;
} }; }
const listed=await loadCafeOrders(client(),{locationIds:['cafe'],courierId:7});
assert.equal(listed.data.filter(r=>r.status==='pending').length,204);
assert.equal(listed.data.filter(r=>r.status==='completed').length,100);
assert.ok(listed.data.some(r=>r.id==='0333'));
assert.ok(!listed.data.some(r=>r.location_id==='other'));
const empty=await loadCafeOrders(client(),{locationIds:[],courierId:null});
assert.deepEqual(empty.data,[]);
const deniedCourier=await loadCafeOrders(client(),{locationIds:['cafe'],courierId:8});
assert.deepEqual(deniedCourier.data,[]);
assert.equal((await loadCafeOrders(client(true),{locationIds:null,courierId:null})).error.message,'offline');
console.log('PASS active orders survive >100 closed orders, pagination, branch/courier scope and network failure');

// Execute the real staff submit handler with injected UI/API dependencies.
const source=readFileSync('js/cafe/kitchen.js','utf8');
const start=source.indexOf('  let staffOrderSubmitting = false;');
const end=source.indexOf('\n  renderStaffCart();',start);
assert.ok(start>0&&end>start);
async function submitScenario({method='cash',paymentFails=false,creationFails=false}={}) {
  let submitHandler, creations=0, payments=0, sent;
  const elements=Object.fromEntries(Object.entries({
    staffOrderForm:'',staffOrderLocation:'cafe',staffOrderType:method==='courier'?'delivery':'pickup',staffOrderCustomerName:'Гость',
    staffOrderAddress:method==='courier'?'Test address':'',staffOrderPayment:method,staffPaymentTiming:'now',staffCashReceived:'150000',
    staffOrderNote:'',staffOrderMessage:'',staffOrderSubmit:'',
  }).map(([id,value])=>[id,{value,hidden:false,textContent:'',focus(){},reset(){},addEventListener(event,fn){submitHandler=fn;}}]));
  const cart=new Map([['product',{product:{id:'product',price_vnd:120000},quantity:1}]]);
  const context={
    byId:id=>elements[id]||null,staffCart:cart,staffLocationIds:['cafe'],editingBillId:null,orders:[],
    window:{ummaRole:'super_admin',Telegram:{WebApp:{initData:'test-signature'}}},
    document:{querySelectorAll:()=>[],addEventListener(){}}, STAFF_ORDER_URL:'mock://create',
    staffOrderAmount:()=>120000,staffMoney:String,setStaffOrderMode(){},renderStaffCart(){},loadOrders:async()=>{},
    fetch:async(url,options)=>{creations++;sent=JSON.parse(options.body);if(creationFails)throw new Error('offline');return {ok:true,json:async()=>({ok:true,order:{id:'created',orderNumber:1,totalVnd:120000}})};},
    api:async payload=>{assert.equal(payload.action,'updatePayment');payments++;if(paymentFails)throw new Error('offline after creation');return {ok:true};},
  };
  context.window.ummaCafeRequests={request:(url,payload)=>context.fetch(url,{body:JSON.stringify(payload)})};
  vm.runInNewContext(source.slice(start,end),context);
  await submitHandler({preventDefault(){}});
  if(paymentFails){assert.equal(cart.size,0);assert.equal(elements.staffOrderSubmit.disabled,true);assert.match(elements.staffOrderMessage.textContent,/Не оформляйте повторный заказ/);await submitHandler({preventDefault(){}});assert.equal(creations,1);}
  if(creationFails){assert.equal(cart.size,1);assert.equal(payments,0);}
  if(!creationFails){assert.equal(sent.paymentTiming,'now');assert.equal(sent.paymentMethod,method==='courier'?'cash':method);}
  return {creations,payments};
}
await submitScenario({paymentFails:true});
await submitScenario({creationFails:true});
await submitScenario();
assert.equal((await submitScenario({method:'courier'})).payments,0);
console.log('PASS payment failure cannot resubmit a committed order; pre-creation failure retains cart; payment timing serialized');

for(const table of [1,2,3,4,5,6]) {
  const fnSource=source.slice(source.indexOf('  function tableNumberForOrder'),source.indexOf('  function updateTableAvailability'));
  const scope={selectedStaffCafeId:()=> 'cafe',orders:[]};
  vm.runInNewContext(fnSource,scope);
  const order={id:'bill',customer_name:`Стол №${table}`,order_type:'dine_in',payment_status:'pending',status:'preparing',location_id:'cafe',created_at:'2026-01-01'};
  assert.equal(scope.openBillForTable(table,[order]).id,'bill');
  for(const change of [{payment_status:'paid'},{status:'completed'},{status:'cancelled'},{location_id:'other'}])assert.equal(scope.openBillForTable(table,[{...order,...change}]),null);
}
console.log('PASS all six tables route to unpaid active bills only, isolated by cafe');

for(const role of ['manager','cashier','kitchen','waiter','courier']) {
  for(const status of ['completed','cancelled'])assert.equal(sandboxCanAdvance(role,{status,payment_status:'pending'},'preparing'),false);
  assert.equal(sandboxCanAdvance(role,{status:'new',payment_status:'paid'},'completed'),false);
  assert.equal(sandboxCanAdvance(role,{status:'ready',payment_status:'paid'},'cancelled'),false);
}
assert.equal(sandboxCanAdvance('kitchen',{status:'confirmed',payment_status:'pending'},'preparing'),true);
assert.equal(sandboxCanAdvance('manager',{status:'new',payment_status:'pending'},'ready'),false);
assert.equal(sandboxCanAdvance('waiter',{status:'ready',payment_status:'pending'},'completed'),false);
assert.equal(sandboxCanAdvance('waiter',{status:'ready',payment_status:'paid',order_type:'delivery',delivery_status:'picked_up'},'completed'),false);
assert.equal(sandboxCanAdvance('waiter',{status:'ready',payment_status:'paid',order_type:'dine_in'},'completed'),true);
console.log('PASS sandbox transition guards: no reopening, skipped preparation, unpaid completion or paid cancellation');

// Courier cash is collected at the door; checkout labels must not imply payment now.
const syncSource=source.slice(source.indexOf('  function syncStaffPaymentOptions'),source.indexOf('  function setStaffOrderMode'));
for(const methodValue of ['courier','cash']) {
 const now={textContent:''},later={},courier={};
 const elements={staffOrderType:{value:'delivery'},staffPaymentTiming:{value:'now',querySelector:s=>s.includes('later')?later:now},staffOrderPayment:{value:methodValue,querySelector:()=>courier},staffOrderSubmit:{textContent:''},staffPaymentNowFields:{},staffPaymentTimingHint:{}};
 const context={byId:id=>elements[id],editingBillId:null,refreshStaffCashFields(){}};
 vm.runInNewContext(syncSource+';syncStaffPaymentOptions();',context);
 assert.equal(now.textContent,methodValue==='courier'?'При получении — курьеру':'Оплата сразу');
 assert.equal(elements.staffOrderSubmit.textContent,methodValue==='courier'?'Оформить доставку — оплата при получении':'Оформить заказ и подтвердить оплату');
}
console.log('PASS courier checkout labels show payment at delivery and reset on cash selection');
