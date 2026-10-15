import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {uploadDeliveryProof} from '../supabase/functions/_shared/courier-workflow.ts';
export async function verifyCourierPhotoCompletion(db,cafe,product){
 await db.exec(readFileSync('supabase/proposals/courier-photo-completion.sql','utf8'));
 const q=(sql,args=[])=>db.query(sql,args);
 const rpc=async(name,args)=>{try{const keys=Object.keys(args);const r=await q('select '+name+'('+keys.map((k,i)=>k+' => $'+(i+1)).join(',')+') result',Object.values(args));return {data:r.rows[0].result,error:null};}catch(e){return {data:null,error:{message:e.message}};}};
 const objects=new Map();const client={rpc,storage:{from:()=>({upload:async(path,bytes)=>{objects.set(path,bytes);return {error:null};},download:async path=>({data:new Blob([objects.get(path)]),error:null})})}};
 const photo=async(id,kind)=>uploadDeliveryProof(client,20,{orderId:id,requestKey:randomUUID(),kind,imageBase64:readFileSync('tests/fixtures/qa-'+(kind==='pickup'?'delivery':'handover')+'-photo-base64.txt','utf8').trim()});
 const state=async id=>(await q('select status,payment_status,delivery_status from cafe_orders where id=$1',[id])).rows[0];
 const create=async()=>{
  const o=(await q("select create_cafe_staff_order(11,$1,$2::jsonb,'delivery','Synthetic courier workflow',null,'QA address','cash') result",[cafe,JSON.stringify([{productId:product,quantity:1}])])).rows[0].result.order;
  await q('select ensure_cafe_courier_offers($1)',[o.id]);await q('select respond_cafe_courier_offer($1,20,true)',[o.id]);
  for(const status of ['confirmed','preparing','ready'])await q('select update_cafe_order_status($1,12,$2)',[o.id,status]);return o;
 };
 const pay=id=>q("select update_cafe_order_payment_cash($1,20,'paid',null,150000,30000)",[id]);
 const before=await create();const picked=await photo(before.id,'pickup');assert.equal(picked.order.deliveryStatus,'picked_up','verified photo commits pickup without a second API request');
 await assert.rejects(q("select update_cafe_order_status($1,21,'completed')",[before.id]),/payment|Delivery|transition/);
 await pay(before.id);assert.equal((await state(before.id)).status,'ready','cash alone does not close an unhanded delivery');
 const handed=await photo(before.id,'handover');assert.equal(handed.order.status,'completed','paid then handover photo automatically closes delivery');
 const replay=await rpc('confirm_cafe_delivery_proof',{p_id:handed.proof.id,p_actor:20});assert.equal(replay.data.order.status,'completed','saved-photo replay after close remains safe');
 assert.equal(Number((await q("select count(*) n from cafe_order_events where order_id=$1 and to_status='completed'",[before.id])).rows[0].n),1);
 const after=await create();await photo(after.id,'pickup');await photo(after.id,'handover');assert.equal((await state(after.id)).status,'ready','handover without cash does not close delivery');
 await pay(after.id);assert.equal((await state(after.id)).status,'completed','handover then cash automatically closes delivery');
 assert.equal(Number((await q('select count(*) n from cafe_payment_receipts where order_id=$1',[after.id])).rows[0].n),1);
 const denied=await create();await assert.rejects(uploadDeliveryProof(client,21,{orderId:denied.id,requestKey:randomUUID(),kind:'pickup',imageBase64:readFileSync('tests/fixtures/qa-delivery-photo-base64.txt','utf8').trim()}),/access denied/);assert.equal((await state(denied.id)).delivery_status,'courier_assigned');
 console.log('PASS database courier flow: photo commits pickup, both payment/handover orders close once, replay safe, cash alone stays open and another courier is denied');
}
