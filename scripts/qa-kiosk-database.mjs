import {PGlite} from '@electric-sql/pglite';import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
const db=new PGlite(),cafe='e22788bd-4734-4b3a-911e-ba103d52617a',other=randomUUID(),product=randomUUID(),device=randomUUID();
try{
 await db.exec(readFileSync('tests/fixtures/supabase-public-schema.sql','utf8'));
 await db.exec('create role anon;create role authenticated;create role service_role;');
 await db.exec(readFileSync('supabase/proposals/cafe-lifecycle-hardening.sql','utf8'));
 await db.exec(readFileSync('supabase/proposals/cafe-order-idempotency.sql','utf8'));
 await db.exec(readFileSync('supabase/proposals/cafe-kiosk.sql','utf8'));
 await db.exec(`insert into telegram_users(telegram_id,role) values(101,'employee');insert into locations(id,name,location_type) values('${cafe}','Synthetic cafe','cafe'),('${other}','Other cafe','cafe');insert into cafe_staff(telegram_id,location_id,staff_role) values(101,'${cafe}','manager');insert into products(id,name_ru,name_en,name_vi,product_type,price_vnd) values('${product}','Synthetic meal','Test','Test','cafe',120000);insert into umma_runtime_settings(id,inventory_control_enabled) values(true,false);insert into cafe_kiosk_devices(id,location_id,actor_telegram_id,token_hash) values('${device}','${cafe}',101,repeat('a',64));`);
 const key=randomUUID(),items=JSON.stringify([{productId:product,quantity:1}]);const op=(request=key,type='pickup',method='cash',table=null)=>db.query('select submit_cafe_kiosk_order($1,$2,$3,$4,$5,$6) result',[device,request,items,type,method,table]);
 const first=(await op()).rows[0].result;const again=(await op()).rows[0].result;
 assert.equal(first.order.id,again.order.id);assert.equal(again.replayed,true);assert.equal((await db.query('select count(*)::int n from cafe_orders')).rows[0].n,1);
 assert.equal((await db.query('select payment_status from cafe_orders')).rows[0].payment_status,'pending');
 await assert.rejects(op(key,'delivery'),/Invalid kiosk order/);await assert.rejects(op(key,'pickup','card'),/Invalid kiosk order/);await assert.rejects(op(key,'dine_in','cash','7'),/Choose table/);
 await assert.rejects(op(key,'pickup','qr'),/key reused/);await assert.rejects(op(randomUUID()),/Wait 10/);
 await db.exec("update cafe_kiosk_devices set last_order_at=now()-interval '11 seconds'");const second=(await op(randomUUID(),'dine_in','qr','3')).rows[0].result;
 assert.notEqual(second.order.id,first.order.id);assert.match((await db.query('select customer_note from cafe_orders where id=$1',[second.order.id])).rows[0].customer_note,/Стол №3/);
 await db.exec("update cafe_staff set is_active=false");await assert.rejects(op(),/manager access revoked/);
 await db.exec('set role anon');await assert.rejects(db.query('select * from cafe_kiosk_devices'),/permission denied/);await assert.rejects(op(),/permission denied/);await db.exec('reset role');
 console.log('PASS kiosk PostgreSQL: unpaid real order, replay/changed payload, atomic mapping/rate limit, pickup/table, QR restriction, revoked manager and no anon table/RPC access');
}finally{await db.close();}
