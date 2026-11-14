import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
let address='Scenia Bay apartment\nТочка доставки: 12.31,109.2';
let handler,valid=true,status='preparing',state='picked_up',age=0,filters=[],positionReads=0;
const query=(table)=>{const f=[];const q={select(){return q;},eq(k,v){f.push([k,v]);return q;},is(k,v){f.push([k,v]);return q;},gt(k,v){f.push([k,v]);return q;},async maybeSingle(){filters.push({table,f});if(table==='umma_guest_delivery_grants')return {data:valid?{order_id:'qa-order'}:null};if(table==='cafe_orders')return {data:{order_number:321,status,delivery_status:state,order_type:'delivery',courier_telegram_id:123,payment_status:'pending',delivery_address:address}};positionReads++;return {data:{latitude:12.28,longitude:109.2,position_at:new Date(Date.now()-age).toISOString(),enabled:true}};}};return q;};
vm.runInNewContext(stripTypeScriptTypes(readFileSync('supabase/functions/umma-guest-delivery/index.ts','utf8').replace(/^import .*;\n/gm,'')),{Deno:{serve:fn=>handler=fn,env:{get:()=> 'qa'}},createClient:()=>({from:query}),crypto:webcrypto,TextEncoder,Response,console});
const req=()=>handler(new Request('https://qa.invalid',{method:'POST',body:JSON.stringify({action:'tracking',token:'a'.repeat(64)})}));
let r=await req(),d=await r.json();assert.equal(r.status,200);assert.equal(d.latitude,12.28);assert.deepEqual(d.destination,{latitude:12.31,longitude:109.2});assert.equal(d.delivery_address,undefined);assert.ok(filters.find(x=>x.table==='cafe_delivery_tracking').f.some(([k,v])=>k==='courier_telegram_id'&&v===123));assert.ok(filters.find(x=>x.table==='umma_guest_delivery_grants').f.some(([k])=>k==='expires_at'));
for(const ending of ['completed','cancelled']){status=ending;const before=positionReads;d=await(await req()).json();assert.equal(d.state,ending);assert.equal(d.latitude,undefined);assert.equal(positionReads,before);}
status='preparing';state='waiting_courier';const before=positionReads;d=await(await req()).json();assert.equal(d.latitude,undefined);assert.equal(positionReads,before);
state='courier_assigned';d=await(await req()).json();assert.equal(d.latitude,undefined);assert.equal(d.destination,undefined);assert.equal(positionReads,before);
state='picked_up';address='Legacy address without coordinates';d=await(await req()).json();assert.equal(d.destination,undefined);assert.equal(d.latitude,12.28);
age=61000;d=await(await req()).json();assert.equal(d.latitude,undefined);valid=false;r=await req();assert.equal(r.status,404);
console.log('PASS guest tracking Edge: token expiry/revocation filters, current courier isolation, terminal status priority, no location before assignment, stale position omission and denied token.');
