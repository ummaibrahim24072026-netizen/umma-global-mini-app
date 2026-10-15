import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
export async function verifyCourierDispatchDesk(db,cafe,other,product,schema='public'){
 assert.match(schema,/^[a-z_][a-z0-9_]*$/);
 let sql=readFileSync('supabase/proposals/courier-dispatch-desk.sql','utf8');if(schema!=='public')sql=sql.replace(/public\./g,schema+'.').replace(/\bsearch_path=public/g,'search_path='+schema).replace(/'public'/g,"'"+schema+"'");await db.exec(sql);
 const q=(s,args=[])=>db.query(s,args),call=async(s,args)=>(await q(s+' result',args)).rows[0].result;
 await q("insert into telegram_users(telegram_id,role) values(30,'employee'),(31,'employee'),(32,'employee'),(33,'user')");
 for(const actor of [30,31])await q("insert into cafe_staff(telegram_id,location_id,staff_role,can_accept_payments) values($1,$2,'courier',true)",[actor,cafe]);
 await q("insert into cafe_staff(telegram_id,location_id,staff_role) values(32,$1,'courier')",[other]);
 await q('update locations set latitude=12.24,longitude=109.19 where id=$1',[cafe]);
 const presence=(actor,online)=>call('select set_courier_dispatch_presence($1,$2)',[actor,online]);
 const board=actor=>call('select get_cafe_courier_dispatch_board($1)',[actor]);
 const create=async(mode='nearest')=>{
  const o=(await call("select create_cafe_staff_order(11,$1,$2::jsonb,'delivery','Dispatch QA',null,'QA dropoff','cash')",[cafe,JSON.stringify([{productId:product,quantity:1}])])).order;
  await q('update cafe_orders set dispatch_mode=$1 where id=$2',[mode,o.id]);await q('select ensure_cafe_courier_offers($1)',[o.id]);return o;
 };
 const claim=(id,actor)=>call('select claim_cafe_available_delivery($1,$2)',[id,actor]);
 await assert.rejects(presence(33,true),/access denied/);
 const offline=await create();assert.equal((await board(30)).online,false);await assert.rejects(claim(offline.id,30),/Go online/);
 await presence(30,true);await presence(31,true);await presence(32,true);
 await q('select update_cafe_courier_position(30,12.2401,109.19,15)');await q('select update_cafe_courier_position(31,12.28,109.20,20)');
 const nearest=await create();const personal30=(await board(30)).offers.find(o=>o.orderId===nearest.id);assert.ok(personal30,'fresh nearest idle courier receives reserved offer');assert.equal(personal30.scope,'exclusive');assert.ok(personal30.pickupDistanceM<50);assert.equal(personal30.deliveryAddress,'QA dropoff');assert.equal(personal30.customerPhone,undefined);
 assert.ok(!(await board(31)).available.some(o=>o.orderId===nearest.id),'reserved offer cannot be taken from pool');await assert.rejects(claim(nearest.id,31),/currently offered/);
 await q("update cafe_courier_offers set expires_at=clock_timestamp()-interval '1 second' where order_id=$1",[nearest.id]);
 assert.ok((await board(31)).available.some(o=>o.orderId===nearest.id),'expiry moves reserved order into pool');
 const accepted=await claim(nearest.id,31);assert.equal(Number(accepted.order.courier_telegram_id),31);assert.equal((await claim(nearest.id,31)).replayed,true);
 await assert.rejects(claim(nearest.id,30),/no longer/);await assert.rejects(claim(offline.id,31),/current delivery/);assert.equal((await board(31)).busy,true);
 await presence(31,false);assert.equal((await board(31)).online,false,'courier can stop new requests while completing assigned delivery');assert.equal((await q('select courier_telegram_id from cafe_orders where id=$1',[nearest.id])).rows[0].courier_telegram_id.toString(),'31');
 await presence(30,false);await assert.rejects(q('select update_cafe_courier_position(30,12.24,109.19,15)'),/offline/);
 await presence(30,true);await q("update cafe_courier_positions set updated_at=clock_timestamp()-interval '3 minutes' where courier_telegram_id=30");
 const stale=await create();assert.ok((await board(30)).available.some(o=>o.orderId===stale.id),'stale GPS falls back to free pool');assert.equal((await board(30)).gpsFresh,false);
 await assert.rejects(claim(stale.id,32),/access denied/);
 await q("update cafe_courier_presence set last_seen_at=clock_timestamp()-interval '3 minutes' where courier_telegram_id=30");await assert.rejects(claim(stale.id,30),/Go online/);
 const privileges=(await q("select has_function_privilege('anon','claim_cafe_available_delivery(uuid,bigint)','execute') allowed")).rows[0];assert.equal(privileges.allowed,false);
 console.log('PASS dispatch desk SQL: online/offline, fresh nearest reservation, expiry-to-pool, self-choice/one winner, replay, one active delivery, stale GPS fallback, branch/privacy boundaries and restricted RPCs');
}
