import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import {verifyCourierPhotoCompletion} from './qa-courier-photo-completion.mjs';
import {verifyCafeCouriers} from './qa-cafe-couriers.mjs';
import {verifyCafeRefunds} from './qa-cafe-refunds.mjs';
import {verifyCafeDelivery} from './qa-cafe-delivery.mjs';
import {verifyCafeNotifications} from './qa-cafe-notifications.mjs';
import {verifyCafeEdges} from './qa-cafe-edge.mjs';

// Real PostgreSQL engine in memory, synthetic rows only. No remote connection.
const db=new PGlite();
const cafe='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const product='33333333-3333-4333-8333-333333333333';
const items=JSON.stringify([{productId:product,quantity:1}]);
const q=(sql,args=[])=>db.query(sql,args);
async function create(name='Test guest',actor=11,location=cafe,type='dine_in') {
  const r=await q('select create_cafe_staff_order($1,$2,$3::jsonb,$4,$5) as result',[actor,location,items,type,name]);
  return r.rows[0].result.order;
}
const state=async id=>(await q('select * from cafe_orders where id=$1',[id])).rows[0];
const advance=(id,status,actor=12)=>q('select update_cafe_order_status($1,$2,$3)',[id,actor,status]);
const add=id=>q('select add_cafe_staff_order_items(11,$1,$2::jsonb)',[id,items]);
const pay=(id,actor=13,tendered=150000,change=30000)=>q("select update_cafe_order_payment_cash($1,$2,'paid',null,$3,$4)",[id,actor,tendered,change]);
const receiptCount=async id=>Number((await q('select count(*) n from cafe_payment_receipts where order_id=$1',[id])).rows[0].n);
try {
  await db.exec(readFileSync('tests/fixtures/supabase-public-schema.sql','utf8'));
  await db.exec(`
    insert into telegram_users(telegram_id,role) values (10,'super_admin'),(11,'employee'),(12,'employee'),(13,'employee'),(14,'employee'),(15,'user'),(16,'employee'),(17,'employee');
    insert into locations(id,name,location_type) values ('${cafe}','QA synthetic cafe','cafe'),('${other}','Other QA cafe','cafe');
    insert into cafe_staff(telegram_id,location_id,staff_role,can_accept_payments) values
      (11,'${cafe}','waiter',false),(12,'${cafe}','kitchen',false),(13,'${cafe}','cashier',true),(14,'${cafe}','cashier',true),(16,'${cafe}','manager',true),(17,'${other}','waiter',false);
    insert into products(id,name_ru,name_vi,name_en,product_type,price_vnd) values ('${product}','Тестовое блюдо','Test','Test','cafe',120000);
    insert into umma_runtime_settings(id,inventory_control_enabled) values (true,false);
  `);
  // Characterize deployed defects before applying the proposal locally.
  const baseline=await create();await advance(baseline.id,'confirmed');await advance(baseline.id,'preparing');await advance(baseline.id,'ready');await add(baseline.id);
  assert.equal((await state(baseline.id)).status,'ready','deployed add-on defect changed; reassess patch');
  const cancelled=await create();await advance(cancelled.id,'cancelled');await pay(cancelled.id);
  assert.equal((await state(cancelled.id)).payment_status,'paid','deployed cancelled-payment defect changed; reassess patch');
  const unsafeShift=(await q('select open_cafe_staff_shift($1,13,13,0) result',[cafe])).rows[0].result.shift;
  assert.equal((await q('select close_cafe_staff_shift($1,17,0) result',[unsafeShift.id])).rows[0].result.shift.shift_status,'closed');
  console.log('REPRODUCED cross-branch shift closing with missing staff lookup');
  console.log('REPRODUCED deployed defects: ready order stays ready after add-on; cancelled order accepts payment');
  await db.exec(readFileSync('supabase/proposals/cafe-lifecycle-hardening.sql','utf8'));
  await assert.rejects(pay(cancelled.id),/Closed order/);
  await db.exec('create role anon; create role authenticated; create role service_role;');
  await db.exec(readFileSync('supabase/proposals/cafe-courier-workflow.sql','utf8'));
  await db.exec(readFileSync('supabase/proposals/cafe-delivery-tracking.sql','utf8'));
  await db.exec(readFileSync('supabase/proposals/cafe-self-courier.sql','utf8'));
  await db.exec(readFileSync('supabase/proposals/cafe-notifications.sql','utf8'));
  await db.exec(readFileSync('supabase/proposals/cafe-order-idempotency.sql','utf8'));
  const args={p_location_id:cafe,p_items:JSON.parse(items),p_order_type:'pickup',p_customer_name:'Replay test',p_payment_method:'cash'};
  const key='44444444-4444-4444-8444-444444444444';
  const op=(key,action,args,actor=11)=>q('select execute_cafe_order_operation($1,$2,$3,$4::jsonb) result',[actor,key,action,JSON.stringify(args)]);
  const first=(await op(key,'staffOrder',args)).rows[0].result;
  const replay=(await op(key,'staffOrder',args)).rows[0].result;
  assert.equal(replay.order.id,first.order.id);assert.equal(replay.replayed,true);
  await assert.rejects(op(key,'staffOrder',{...args,p_customer_name:'Changed'}),/key reused/);
  const bill=await create('Add-on replay');
  const addArgs={p_order_id:bill.id,p_items:JSON.parse(items)};
  const addKey='55555555-5555-4555-8555-555555555555';
  await op(addKey,'addItems',addArgs);await op(addKey,'addItems',addArgs);
  assert.equal((await state(bill.id)).total_vnd,240000);
  await q('update cafe_staff set is_active=false where telegram_id=11');
  await assert.rejects(op(key,'staffOrder',args),/access denied/);
  await q('update cafe_staff set is_active=true where telegram_id=11');
  const privilege=(await q("select has_function_privilege('anon','public.execute_cafe_order_operation(bigint,uuid,text,jsonb)','execute') a, has_function_privilege('authenticated','public.execute_cafe_order_operation(bigint,uuid,text,jsonb)','execute') b")).rows[0];
  assert.equal(privilege.a,false);assert.equal(privilege.b,false);
  await assert.rejects(op('12345678-1234-4234-8234-123456789012','staffOrder',{...args,p_payment_timing:'on_delivery'}),/Invalid payment timing/);
  const atDoor=(await op('12345678-1234-4234-8234-123456789013','staffOrder',{...args,p_order_type:'delivery',p_delivery_address:'QA address',p_payment_timing:'on_delivery'})).rows[0].result;
  assert.equal((await state(atDoor.order.id)).payment_timing,'on_delivery');assert.equal((await state(atDoor.order.id)).payment_status,'pending');
  const failedKey='66666666-6666-4666-8666-666666666666';
  await assert.rejects(op(failedKey,'staffOrder',{...args,p_items:[{productId:product,quantity:0}]}),/quantity/);
  assert.equal(Number((await q('select count(*) n from umma_private.cafe_order_requests where request_key=$1',[failedKey])).rows[0].n),0);
  // Issued concurrently, but single-engine serialization does not simulate separate PostgreSQL sessions.
  const parallelKey='77777777-7777-4777-8777-777777777777';
  const parallel=await Promise.all([op(parallelKey,'staffOrder',args),op(parallelKey,'staffOrder',args)]);
  assert.equal(parallel[0].rows[0].result.order.id,parallel[1].rows[0].result.order.id);
  console.log('PASS idempotency: order/add-on replay, changed payload rejection, revoked staff, restricted execute, atomic rollback, parallel queued calls');
  for(let table=1;table<=6;table++) {
    const order=await create(`Стол №${table}`);
    await assert.rejects(create(`Стол ${table}`),/cafe_one_open_bill/);
    await assert.rejects(advance(order.id,'completed'),/before payment/);
    await assert.rejects(advance(order.id,'ready'),/cannot perform/);
    await advance(order.id,'confirmed');await advance(order.id,'preparing');await advance(order.id,'ready');
    await add(order.id);assert.equal((await state(order.id)).status,'preparing');
    assert.equal((await state(order.id)).total_vnd,240000);
    await assert.rejects(pay(order.id,11,240000,0),/permission denied/);
    await assert.rejects(pay(order.id,13,250000,1),/Invalid cash/);
    await pay(order.id,13,250000,10000);
    const original=await state(order.id);await pay(order.id,14,250000,10000);
    assert.equal((await state(order.id)).paid_by_telegram_id,original.paid_by_telegram_id);
    assert.equal(await receiptCount(order.id),1);
    await assert.rejects(add(order.id),/closed/);
    await assert.rejects(advance(order.id,'completed'),/cannot perform/);
    await assert.rejects(advance(order.id,'cancelled'),/requires recorded refund/);
    await advance(order.id,'ready');await advance(order.id,'completed');
    await assert.rejects(q("select update_cafe_order_payment($1,10,'pending','test')",[order.id]),/Closed order/);
    await create(`Стол №${table}`);
  }
  await assert.rejects(q('select create_cafe_order(15,$1::jsonb,\'pickup\')',[items]),/Cafe location is required/);
  await assert.rejects(create('bad user',15),/access denied/);
  await assert.rejects(create('wrong branch',11,other),/cannot create/);
  const cash=await create('void test');await pay(cash.id);
  for(const actor of [13,10,16])await assert.rejects(q("select update_cafe_order_payment($1,$2,'pending','test')",[cash.id,actor]),/Use recorded refund/);
  const shift=(await q('select open_cafe_staff_shift($1,13,13,50000) result',[cafe])).rows[0].result.shift;
  await assert.rejects(q('select open_cafe_staff_shift($1,13,13,50000)',[cafe]),/уже|open|duplicate/i);
  await assert.rejects(q('select close_cafe_staff_shift($1,15,0)',[shift.id]),/Нет права/);
  await assert.rejects(q('select close_cafe_staff_shift($1,17,0)',[shift.id]),/Нет права/);
  const shiftOrder=await create('Shift sale',13,cafe,'pickup');await pay(shiftOrder.id);
  const closedShift=(await q('select close_cafe_staff_shift($1,13,170000) result',[shift.id])).rows[0].result.shift;
  assert.equal(closedShift.expected_cash_vnd,170000);assert.equal(closedShift.variance_vnd,0);
  await assert.rejects(q('select close_cafe_staff_shift($1,13,170000)',[shift.id]),/уже закрыта/);
  console.log('PASS shifts: one open shift, foreign customer denied, expected cash/change reconciliation and closed-shift guard');
  assert.equal(Number((await q('select count(*) n from cafe_inventory_movements' )).rows[0].n),0);
  assert.equal((await q('select inventory_control_enabled from umma_runtime_settings')).rows[0].inventory_control_enabled,false);
  await db.exec(readFileSync('supabase/proposals/cafe-cash-summary.sql','utf8'));
  for(let i=0;i<105;i++){
    const order=await create('Daily summary '+i);
    await q('insert into cafe_payment_receipts(order_id,location_id,collected_by_telegram_id,payment_method,amount_vnd) values($1,$2,13,\'cash\',120000)',[order.id,cafe]);
  }
  const totals=(await q('select get_cafe_cash_summary($1) result',[cafe])).rows[0].result;
  const expected=(await q("select sum(amount_vnd) total from cafe_payment_receipts where location_id=$1 and receipt_status='confirmed' and collected_at>=now()-interval '24 hours'",[cafe])).rows[0].total;
  assert.equal(Number(totals.total24hVnd),Number(expected));assert.equal(Number(totals.cash24hVnd),Number(expected));
  const zero=(await q('select get_cafe_cash_summary($1) result',[other])).rows[0].result;
  assert.equal(Number(zero.total24hVnd),0);
  console.log('PASS daily cash totals include more than 100 receipts and exclude other cafes');
  console.log('PASS PostgreSQL: six tables, duplicate open bills, add-ons, preparation, cash/change, payment retries, actor preservation, cancellations, terminal states, role/branch restrictions and disabled inventory');
  await db.exec(readFileSync('supabase/proposals/cafe-delivery-hardening.sql','utf8'));
  await verifyCafeDelivery(db,cafe,other,product);
  await db.exec(readFileSync('supabase/proposals/cafe-refunds.sql','utf8'));
  await verifyCafeRefunds(db,cafe,other,product);
  await verifyCafeCouriers(db,cafe,other,product);
  await verifyCafeEdges(db,cafe,product);
  await verifyCafeNotifications(db,cafe,product);
  await verifyCourierPhotoCompletion(db,cafe,product);
  console.log('LIMIT: PGlite serializes queries; this does not prove multi-connection PostgreSQL locking or real device behavior.');
} finally { await db.close(); }
