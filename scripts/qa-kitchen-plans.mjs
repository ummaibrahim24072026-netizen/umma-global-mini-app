import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
export async function verifyKitchenPlans(db,cafe,product){
 await db.exec(readFileSync('supabase/proposals/cafe-kitchen-plans.sql','utf8'));
 const row=async()=>(await db.query('select * from inventory where product_id=$1 and location_id=$2',[product,cafe])).rows[0];
 const call=async(action,quantity,revision=null,key=randomUUID(),actor=12,readyAt=new Date(Date.now()+3600000).toISOString())=>(await db.query('select cafe_ready_plan($1,$2,$3,$4,$5::jsonb) result',[actor,cafe,key,action,JSON.stringify([{productId:product,quantity,revision,...(action==='plan'?{readyAt}:{})}])])).rows[0].result;
 const before=await row(),available=Number(before.quantity)-Number(before.reserved_quantity);
 await assert.rejects(call('plan',10,null,randomUUID(),11),/access denied/);
 await assert.rejects(call('plan',10,null,randomUUID(),12,new Date(Date.now()-60000).toISOString()),/Время готовности/);
 await assert.rejects(call('plan',10,null,randomUUID(),12,'2026-11-04T18:00'),/Укажите дату и время/);
 const key=randomUUID(),at=new Date(Date.now()+3600000).toISOString();await call('plan',10,null,key,12,at);const planned=await row();await call('plan',10,null,key,12,at);assert.equal((await row()).plan_revision,planned.plan_revision);assert.equal(Number((await row()).quantity),Number(before.quantity));assert.equal(Number((await row()).reserved_quantity),Number(before.reserved_quantity));assert.equal((await row()).ready_stock_state,before.ready_stock_state);
 const list=(await db.query('select cafe_ready_list(12,$1) result',[cafe])).rows[0].result.products.find(p=>p.id===product);assert.equal(list.plannedQuantity,10);assert.ok(list.plannedReadyAt);assert.equal(Number(list.available),available);
 const doneKey=randomUUID();await call('finish',8,planned.plan_revision,doneKey);await call('finish',8,planned.plan_revision,doneKey);assert.equal(Number((await row()).quantity),Number(before.quantity)+8);assert.equal((await row()).planned_quantity,0);
 await assert.rejects(call('finish',8,planned.plan_revision),/План уже изменён/);
 await call('plan',12);const a=await row();await call('plan',15,a.plan_revision);const b=await row();await assert.rejects(call('cancel',0,a.plan_revision),/План уже изменён/);await call('cancel',0,b.plan_revision);assert.equal(Number((await row()).quantity),Number(before.quantity)+8);assert.equal((await row()).planned_quantity,0);
 assert.equal((await db.query("select has_function_privilege('anon','cafe_ready_plan(bigint,uuid,uuid,text,jsonb)','execute') allowed")).rows[0].allowed,false);
 console.log('PASS kitchen plans: quantity/time persisted, timezone required, no future stock sales, existing ready portions preserved, actual yield, idempotent finish, stale-edit/duplicate-receipt denial, cancel and role isolation.');
}
