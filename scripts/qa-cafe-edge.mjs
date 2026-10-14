import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { createHmac, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import {dispatchCourierQueue,uploadDeliveryProof} from '../supabase/functions/_shared/courier-workflow.ts';
import {dispatchCustomerNotifications} from '../supabase/functions/_shared/customer-notifications.ts';
import { submitCafeOperation } from '../supabase/functions/_shared/order-operation.ts';
import { loadCafeOrders } from '../supabase/functions/cafe-kitchen/order-list.ts';
import { sandboxCanAdvance } from '../supabase/functions/cafe-kitchen/sandbox-policy.ts';

export async function verifyCafeEdges(db,cafe,product){
  let dbCalls=0,notificationCalls=0;
  const ident=s=>{assert.match(s,/^[a-z_]+$/);return '"'+s+'"';};
  const client={
    rpc:async(name,args)=>{
      dbCalls++;
      const names=Object.keys(args);
      try {const r=await db.query('select '+ident(name)+'('+names.map((n,i)=>ident(n)+' => $'+(i+1)).join(',')+') result',Object.values(args));return {data:r.rows[0].result,error:null};}
      catch(e){return {data:null,error:{message:e.message,code:e.code}};}
    },
    from(table){
      let columns='*',single=false,filters=[],values=[],ordering=[],limit='';
      const run=async()=>{
        dbCalls++;
        try{const r=await db.query('select '+columns+' from '+ident(table)+(filters.length?' where '+filters.join(' and '):'')+(ordering.length?' order by '+ordering.join(','):'')+limit,values);return {data:single?(r.rows[0]||null):r.rows,error:null};}
        catch(e){return {data:null,error:{message:e.message,code:e.code}};}
      };
      const query={
        select(s){columns=s==='*'?'*':s.split(',').map(x=>ident(x.trim())).join(',');return query;},
        eq(field,value){values.push(value);filters.push(ident(field)+'=$'+values.length);return query;},
        neq(field,value){values.push(value);filters.push(ident(field)+'<>$'+values.length);return query;},
        in(field,array){values.push(array);filters.push(ident(field)+'=any($'+values.length+')');return query;},
        order(field,{ascending=true}={}){ordering.push(ident(field)+(ascending?' asc':' desc'));return query;},
        limit(n){assert.ok(Number.isInteger(n));limit=' limit '+n;return query;},
        maybeSingle(){single=true;return run();},
        single(){single=true;return run();},
        then(resolve){return run().then(resolve);},
      };return query;
    },
  };
  const token='local-test-token-only';
  function auth(id){
    const params=new URLSearchParams({user:JSON.stringify({id,first_name:'Synthetic QA'}),auth_date:String(Math.floor(Date.now()/1000))});
    const check=[...params.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');
    const key=createHmac('sha256','WebAppData').update(token).digest();
    params.set('hash',createHmac('sha256',key).update(check).digest('hex'));return params.toString();
  }
  function handler(path){
    let serve;
    const source=stripTypeScriptTypes(readFileSync(path,'utf8')).replace(/^import .*;\n/gm,'');
    vm.runInNewContext(source,{
      Deno:{env:{get:key=>({TELEGRAM_BOT_TOKEN:token,SUPABASE_URL:'http://local-test',SUPABASE_SERVICE_ROLE_KEY:'fake-test-key'})[key]},serve:fn=>serve=fn},
      createClient:()=>client,dispatchCustomerNotifications:(c,t)=>dispatchCustomerNotifications(c,t,async(url)=>{assert.ok(url.startsWith('https://api.telegram.org/bot'));notificationCalls++;return new Response('{"ok":true,"result":{"message_id":123}}');}),submitCafeOperation,loadCafeOrders,sandboxCanAdvance,uploadDeliveryProof,dispatchCourierQueue:(c,t)=>dispatchCourierQueue(c,t,async(url)=>{assert.ok(url.startsWith('https://api.telegram.org/bot'));notificationCalls++;return new Response('{"ok":true}');}),
      crypto,Response,Request,URLSearchParams,TextEncoder,console,
      fetch:async(url)=>{assert.ok(url.startsWith('https://api.telegram.org/bot'));notificationCalls++;return new Response('{"ok":true}');},
    });return serve;
  }
  const create=handler('supabase/functions/create-cafe-order/index.ts');
  const kitchen=handler('supabase/functions/cafe-kitchen/index.ts');
  const myOrders=handler('supabase/functions/cafe-my-orders/index.ts');
  async function post(fn,body){const response=await fn(new Request('http://local-test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));return {status:response.status,data:await response.json()};}
  const beforeTrackingAuth=dbCalls;assert.equal((await post(myOrders,{action:'deliveryTracking',initData:'invalid',orderId:randomUUID()})).status,401);assert.equal(dbCalls,beforeTrackingAuth);
  assert.equal((await post(kitchen,{initData:auth(15),action:'selfCourier',locationId:cafe,enabled:true})).status,403);
  await db.query("insert into cafe_staff(telegram_id,location_id,staff_role,is_active,can_accept_payments) values(10,$1,'waiter',true,true) on conflict(telegram_id,location_id) do nothing",[cafe]);
  const ownerAssignment=(await db.query("select * from cafe_staff where telegram_id=10 and location_id=$1",[cafe])).rows[0];
  const selfOn=await post(kitchen,{initData:auth(10),action:'selfCourier',locationId:cafe,enabled:true});assert.equal(selfOn.status,200);assert.ok(selfOn.data.availability.some(a=>a.location_id===cafe&&a.courier_available));
  assert.equal((await db.query('select cafe_active_courier(10,$1) active',[cafe])).rows[0].active,true);
  assert.equal((await db.query('select role from telegram_users where telegram_id=10')).rows[0].role,'super_admin');
  if(ownerAssignment){const after=(await db.query('select * from cafe_staff where telegram_id=10 and location_id=$1',[cafe])).rows[0];assert.equal(after.staff_role,ownerAssignment.staff_role);assert.equal(after.can_accept_payments,ownerAssignment.can_accept_payments);}
  const ownerDelivery=await post(create,{initData:auth(15),requestKey:randomUUID(),locationId:cafe,items:[{productId:product,quantity:1}],orderType:'delivery',paymentMethod:'courier',deliveryAddress:'Synthetic owner delivery'});assert.equal(ownerDelivery.status,201);
  const claimed=await post(kitchen,{initData:auth(10),action:'respondCourierOffer',orderId:ownerDelivery.data.order.id,accept:true});assert.equal(claimed.status,200);
  const ownerInbox=await post(myOrders,{initData:auth(15),action:'notifications',telegramId:17});assert.equal(ownerInbox.status,200);assert.ok(ownerInbox.data.notifications.some(n=>n.order_id===ownerDelivery.data.order.id&&n.kind==='delivery'));
  const outsiderInbox=await post(myOrders,{initData:auth(17),action:'notifications',telegramId:15});assert.ok(!outsiderInbox.data.notifications.some(n=>n.order_id===ownerDelivery.data.order.id));
  assert.equal((await post(myOrders,{initData:auth(15),action:'readNotifications',ids:['bad']})).status,400);
  const cannotLeave=await post(kitchen,{initData:auth(10),action:'selfCourier',locationId:cafe,enabled:false});assert.equal(cannotLeave.status,400);assert.match(cannotLeave.data.error,/завершите/);
  await db.query("update cafe_orders set status='cancelled' where id=$1",[ownerDelivery.data.order.id]);
  assert.equal((await post(kitchen,{initData:auth(10),action:'selfCourier',locationId:cafe,enabled:false})).status,200);
  assert.equal((await db.query('select cafe_active_courier(10,$1) active',[cafe])).rows[0].active,false);
  console.log('PASS owner self-courier opt-in/out preserves global/staff roles and payment permission, customer denied');
  const body={initData:auth(11),requestKey:randomUUID(),staffOrder:true,locationId:cafe,items:[{productId:product,quantity:1}],orderType:'pickup',paymentMethod:'cash',paymentTiming:'now',customerName:'Edge synthetic guest'};
  const count=dbCalls;
  assert.equal((await post(create,{...body,initData:'invalid'})).status,401);assert.equal(dbCalls,count);
  assert.equal((await post(kitchen,{initData:'invalid',action:'addItems'})).status,401);assert.equal(dbCalls,count);
  const first=await post(create,body);assert.equal(first.status,201);assert.ok(first.data.order.id);
  const repeat=await post(create,body);assert.equal(repeat.data.order.id,first.data.order.id);assert.equal(repeat.data.replayed,true);
  const missing=await post(create,{...body,requestKey:undefined});assert.equal(missing.data.ok,false);
  assert.equal((await post(create,{...body,requestKey:randomUUID(),initData:auth(15)})).data.ok,false);
  assert.equal((await post(create,{...body,paymentMethod:'courier'})).status,400);
  assert.equal((await post(create,{...body,paymentTiming:'later'})).status,400);
  assert.equal((await post(create,{...body,locationId:null})).status,400);
  const courierDelivery=await post(create,{...body,requestKey:randomUUID(),orderType:'delivery',paymentMethod:'courier',deliveryAddress:'QA delivery address'});
  assert.equal(courierDelivery.status,201);
  const deliveryRow=(await db.query('select payment_method,payment_status,delivery_status,payment_timing from cafe_orders where id=$1',[courierDelivery.data.order.id])).rows[0];
  assert.equal(deliveryRow.payment_timing,'on_delivery');assert.equal(deliveryRow.payment_method,'cash');assert.equal(deliveryRow.payment_status,'pending');assert.equal(deliveryRow.delivery_status,'waiting_courier');
  assert.equal((await post(create,{...body,requestKey:randomUUID(),paymentTiming:'on_delivery'})).status,400);
  assert.equal((await post(create,{...body,requestKey:randomUUID(),orderType:'delivery',deliveryAddress:'QA address',paymentMethod:'qr',paymentTiming:'on_delivery'})).status,400);
  const explicitAtDoor=await post(create,{...body,requestKey:randomUUID(),orderType:'delivery',deliveryAddress:'QA address',paymentMethod:'cash',paymentTiming:'on_delivery'});assert.equal(explicitAtDoor.status,201);assert.equal(explicitAtDoor.data.order.paymentTiming,'on_delivery');
  const upfront=await post(create,{...body,requestKey:randomUUID(),orderType:'delivery',deliveryAddress:'QA address',paymentMethod:'cash',paymentTiming:'now'});assert.equal(upfront.status,201);assert.equal(upfront.data.order.paymentTiming,'now');
  const assignedDelivery=await post(kitchen,{initData:auth(11),action:'assignCourier',orderId:courierDelivery.data.order.id,courierTelegramId:20});
  assert.equal(assignedDelivery.status,200);
  const courierNotified=notificationCalls;
  assert.equal((await post(kitchen,{initData:auth(11),action:'assignCourier',orderId:courierDelivery.data.order.id,courierTelegramId:20})).status,200);
  assert.equal(notificationCalls,courierNotified);
  assert.equal((await post(kitchen,{initData:auth(20),action:'updateDelivery',orderId:courierDelivery.data.order.id,deliveryStatus:'picked_up'})).status,400);
  const customer={...body,staffOrder:false,initData:auth(15),requestKey:randomUUID()};
  const newCustomer=await post(create,customer);assert.equal(newCustomer.status,201);
  const notified=notificationCalls;
  const customerRetry=await post(create,customer);assert.equal(customerRetry.status,200);assert.equal(customerRetry.data.order.id,newCustomer.data.order.id);assert.equal(notificationCalls,notified);
  const legacy={...customer,requestKey:undefined,orderType:'delivery',paymentMethod:'courier',paymentTiming:undefined,deliveryAddress:'Synthetic legacy checkout'};
  const legacyFirst=await post(create,legacy);assert.equal(legacyFirst.status,201);assert.equal(legacyFirst.data.order.paymentTiming,'on_delivery');
  const legacyNotified=notificationCalls;
  const legacyRetry=await post(create,legacy);assert.equal(legacyRetry.status,200);assert.equal(legacyRetry.data.order.id,legacyFirst.data.order.id);assert.equal(notificationCalls,legacyNotified);
  const legacyRow=(await db.query('select payment_method,payment_status from cafe_orders where id=$1',[legacyFirst.data.order.id])).rows[0];assert.equal(legacyRow.payment_method,'cash');assert.equal(legacyRow.payment_status,'pending');
  const legacyQr=await post(create,{...legacy,paymentMethod:'qr'});assert.equal(legacyQr.status,201);assert.notEqual(legacyQr.data.order.id,legacyFirst.data.order.id);assert.equal(legacyQr.data.order.paymentTiming,'now');
  const badLegacy=await post(create,{...legacy,requestKey:'broken-key'});assert.equal(badLegacy.status,400);assert.match(badLegacy.data.error,/закройте Mini App/);
  const authCalls=dbCalls;assert.equal((await post(create,{...legacy,initData:'invalid'})).status,401);assert.equal(dbCalls,authCalls);
  console.log('PASS cached customer delivery without key: cash on delivery, QR upfront, stable authenticated replay, no duplicate notifications, malformed key rejected');
  const dine=await post(create,{...body,requestKey:randomUUID(),orderType:'dine_in',paymentTiming:'later',customerName:'Edge add-on guest'});
  const addBody={initData:auth(11),requestKey:randomUUID(),action:'addItems',orderId:dine.data.order.id,items:body.items};
  assert.equal((await post(kitchen,addBody)).data.totalVnd,240000);
  assert.equal((await post(kitchen,addBody)).data.totalVnd,240000);
  assert.equal((await post(kitchen,{...addBody,initData:auth(15)})).status,403);
  const refundOrder=await post(create,{...body,requestKey:randomUUID(),paymentMethod:'qr',customerName:'Edge refund guest'});
  await db.query("select update_cafe_order_payment($1,13,'paid')",[refundOrder.data.order.id]);
  const refundBody={initData:auth(16),action:'refundOrder',orderId:refundOrder.data.order.id,requestKey:randomUUID(),reason:'QA actual Edge refund',payoutConfirmed:true};
  const refundResult=await post(kitchen,refundBody);assert.equal(refundResult.status,200);
  assert.equal((await post(kitchen,refundBody)).data.refund.id,refundResult.data.refund.id);
  assert.equal((await post(kitchen,{...refundBody,reason:'Different reason'})).status,400);
  assert.equal((await post(kitchen,{...refundBody,payoutConfirmed:false})).status,400);
  assert.equal((await post(kitchen,{...refundBody,initData:auth(13)})).status,400);
  const trackingOrder=(await db.query("select id from cafe_orders where customer_telegram_id=15 and delivery_status='delivered' order by created_at desc limit 1")).rows[0];
  if(trackingOrder){assert.equal((await post(myOrders,{initData:auth(15),action:'deliveryTracking',orderId:trackingOrder.id})).data.state,'delivered');assert.equal((await post(myOrders,{initData:auth(11),action:'deliveryTracking',orderId:trackingOrder.id})).status,403);}
  console.log('PASS actual Edge handlers + local PostgreSQL: Telegram HMAC rejection, staff/customer order replay, no duplicate notifications, payment validation and add-on permission/replay');
}
