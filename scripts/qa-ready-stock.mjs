import {PGlite} from '@electric-sql/pglite';import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
const native=process.env.UMMA_QA_READY_NATIVE==='1';const db=native?await(await import('./qa/ready-native-db.mjs')).readyNativeDb():new PGlite();const cafe='11111111-1111-4111-8111-111111111111',product='33333333-3333-4333-8333-333333333333';
const q=(s,a=[])=>db.query(s,a),result=async(s,a=[])=>(await q(s,a)).rows[0].result;
try{
await db.exec(readFileSync('tests/fixtures/supabase-public-schema.sql','utf8'));
await db.exec("create role anon;create role authenticated;create role service_role;create schema if not exists auth;create function auth.role() returns text language sql as $$select 'service_role'::text$$;create schema if not exists umma_private;create schema cron;create function cron.schedule(text,text,text) returns bigint language sql as $$select 1::bigint$$;");
await q("insert into locations(id,name,location_type) values($1,'QA cafe','cafe')",[cafe]);await db.exec("insert into telegram_users(telegram_id,role) values(10,'super_admin'),(11,'employee'),(12,'employee'),(13,'employee'),(14,'employee');insert into umma_runtime_settings(id,inventory_control_enabled) values(true,false);");
await q("insert into cafe_staff(telegram_id,location_id,staff_role,can_accept_payments) values(11,$1,'cashier',true),(12,$1,'kitchen',false),(13,$1,'courier',true),(14,$1,'manager',true)",[cafe]);await q("insert into products(id,name_ru,name_vi,name_en,product_type,price_vnd) values($1,'QA portions','QA','QA','cafe',25000)",[product]);
await db.exec(readFileSync('supabase/proposals/cafe-lifecycle-hardening.sql','utf8'));
await db.exec("alter table umma_runtime_settings add column cafe_reset_epoch uuid;create function cafe_guest_order_status(uuid,uuid) returns jsonb language plpgsql as $$declare v_order cafe_orders%rowtype;begin return jsonb_build_object('status',v_order.status);end$$;alter table products add column catalog_preview boolean not null default false;alter table cafe_orders add column source_module text not null default 'cafe';");
// Existing order was accepted before stock control. Activation must reserve it without selling fictional seed stock.
const create=async qty=>(await result("select create_cafe_staff_order(11,$1,$2::jsonb,'pickup','QA',null,null,'cash') result",[cafe,JSON.stringify([{productId:product,quantity:qty}])])).order;
const old=await create(2);
await db.exec(readFileSync('supabase/proposals/cafe-ready-stock.sql','utf8'));
const stock=async()=>(await q('select * from inventory where location_id=$1 and product_id=$2',[cafe,product])).rows[0];
const available=async()=>(await result('select cafe_ready_catalog($1) result',[cafe])).products[0].available;
assert.equal(Number((await stock()).reserved_quantity),2);assert.equal(await available(),0);await assert.rejects(create(1),/READY_STOCK_UNAVAILABLE/);
const edit=(mode,qty,key=randomUUID(),actor=12)=>result('select cafe_ready_adjust($1,$2,$3,$4,$5::jsonb) result',[actor,cafe,key,mode,JSON.stringify([{productId:product,quantity:qty}])]);
await assert.rejects(edit('add',10,randomUUID(),11),/access denied/);await assert.rejects(edit('set',1),/меньше резерва/);
const key=randomUUID();await edit('set',10,key);await edit('set',10,key);assert.equal(await available(),8);await assert.rejects(edit('add',10,key),/key mismatch/);
const order=await create(3);assert.equal(await available(),5);await edit('add',5);assert.equal(await available(),10);
await result("select update_cafe_order_status($1,12,'cancelled') result",[order.id]);assert.equal(await available(),13);
await result("select update_cafe_order_status($1,12,'confirmed') result",[old.id]);await result("select update_cafe_order_status($1,12,'preparing') result",[old.id]);await result("select update_cafe_order_status($1,12,'ready') result",[old.id]);await result("select update_cafe_order_payment_cash($1,11,'paid',null,50000,0) result",[old.id]);await result("select update_cafe_order_status($1,11,'completed') result",[old.id]);assert.equal(Number((await stock()).quantity),13);assert.equal(Number((await stock()).reserved_quantity),0);
await edit('paused',0);assert.equal(await available(),0);await assert.rejects(create(1),/READY_STOCK_UNAVAILABLE/);await edit('resume',0);assert.equal(await available(),13);
const held=await create(2);await q("update cafe_orders set stock_reserved_until=now()-interval '1 minute' where id=$1",[held.id]);await db.exec('select cafe_ready_expire();select cafe_ready_expire();');assert.equal(await available(),13);assert.equal((await q('select status from cafe_orders where id=$1',[held.id])).rows[0].status,'cancelled');
await assert.rejects(q('delete from cafe_order_items where order_id=$1',[old.id]),/cannot be edited/);
const privileges=(await q("select has_function_privilege('anon','cafe_ready_adjust(bigint,uuid,uuid,text,jsonb)','execute') a")).rows[0];assert.equal(privileges.a,false);
if(native)await db.concurrent(cafe,product);console.log('PASS ready portions: no fictional stock, existing reservations, add/set, permissions, idempotency, reserve/cancel/sale, pause/resume, expiry, immutable lines and private RPC.');

}finally{await db.close();}
