import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {dispatchCustomerNotifications} from '../supabase/functions/_shared/customer-notifications.ts';
export async function verifyCafeNotifications(db,cafe,product){
 const result=async(sql,args=[])=>(await db.query(sql,args)).rows[0].result;
 // All rows here are synthetic; keep pre-existing test events out of this queue case.
 await db.query('update umma_private.cafe_notifications set send_to_bot=false');
 const created=await result("select create_cafe_order(15,$1::jsonb,'delivery',$2,'Synthetic notification guest',null,'Synthetic address','cash',null) result",[JSON.stringify([{productId:product,quantity:1}]),cafe]);
 const id=created.order.id;
 await result('select ensure_cafe_courier_offers($1) result',[id]);
 await result('select respond_cafe_courier_offer($1,20,true,null) result',[id]);
 const count=async()=>Number((await db.query('select count(*) n from umma_private.cafe_notifications where order_id=$1',[id])).rows[0].n);
 const before=await count();await result('select respond_cafe_courier_offer($1,20,true,null) result',[id]);assert.equal(await count(),before);
 await db.query('update cafe_orders set delivery_status=delivery_status where id=$1',[id]);assert.equal(await count(),before);
 await db.query('begin');await db.query("update cafe_orders set status='confirmed' where id=$1",[id]);await db.query('rollback');assert.equal(await count(),before);
 const own=await result('select get_cafe_notifications(15) result');const acceptance=own.notifications.find(n=>n.order_id===id&&n.kind==='delivery');assert.match(acceptance.title,/Курьер принял/);assert.equal(acceptance.workspace,'customer');
 const foreign=await result('select get_cafe_notifications(17) result');assert.ok(!foreign.notifications.some(n=>n.order_id===id));
 await result('select read_cafe_notifications(17,$1) result',[[acceptance.id]]);assert.equal((await db.query('select read_at from umma_private.cafe_notifications where id=$1',[acceptance.id])).rows[0].read_at,null);
 await result('select read_cafe_notifications(15,$1) result',[[acceptance.id]]);assert.ok((await db.query('select read_at from umma_private.cafe_notifications where id=$1',[acceptance.id])).rows[0].read_at);
 const privileges=(await db.query("select has_function_privilege('anon','get_cafe_notifications(bigint)','execute') a,has_function_privilege('authenticated','read_cafe_notifications(bigint,uuid[])','execute') b")).rows[0];assert.equal(privileges.a,false);assert.equal(privileges.b,false);
 const client={rpc:async(name,args)=>{try{const names=Object.keys(args);const sql='select '+name+'('+names.map((n,i)=>n+' => $'+(i+1)).join(',')+') result';return {data:await result(sql,Object.values(args)),error:null};}catch(e){return {data:null,error:e};}}};
 await db.query('update umma_courier_internal.worker_control set dispatch_enabled=false');
 let sends=0;await dispatchCustomerNotifications(client,'synthetic-only',async()=>{sends++;throw Error('lost connection');});assert.ok(sends>=2);
 const pending=(await db.query('select id,attempts,sent_at from umma_private.cafe_notifications where order_id=$1 and send_to_bot',[id])).rows;assert.ok(pending.every(n=>n.attempts===1&&n.sent_at===null));
 await db.query('update umma_private.cafe_notifications set next_attempt_at=clock_timestamp() where order_id=$1',[id]);
 const lease=await result('select lease_cafe_customer_notifications() result');assert.ok(lease.length>=2);assert.equal((await result('select lease_cafe_customer_notifications() result')).length,0);
 await result('select finish_cafe_customer_notification($1,$2,true,123,null,false) result',[lease[0].id,randomUUID()]);assert.equal((await db.query('select sent_at from umma_private.cafe_notifications where id=$1',[lease[0].id])).rows[0].sent_at,null);
 for(const job of lease)await result('select finish_cafe_customer_notification($1,$2,true,123,null,false) result',[job.id,job.lease_id]);
 assert.equal((await result('select lease_cafe_customer_notifications() result')).length,0);
 assert.equal((await db.query('select delivery_status from cafe_orders where id=$1',[id])).rows[0].delivery_status,'courier_assigned');
 await db.query('update umma_courier_internal.worker_control set dispatch_enabled=true');
 console.log('PASS durable inbox: courier acceptance, replay/no-op deduplication, rollback, recipient isolation/read ownership, leases/stale acknowledgements, network retries and customer sends while courier offers paused');
}
