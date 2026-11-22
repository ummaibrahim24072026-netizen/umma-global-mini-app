import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';

const orderId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const requestKey='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const token='a'.repeat(64);
let handler,rpcError=false,status='ready',state='picked_up',age=0,enabled=true,green=null,positionReads=0;
let address='Scenia Bay apartment\nТочка доставки: 12.31,109.2';
let authorizedArgs,positionFilters;

function query(table){
 const filters=[];
 const chain={
  select(){return chain;},
  eq(key,value){filters.push([key,value]);return chain;},
  async maybeSingle(){
   if(table==='cafe_orders')return {data:{order_number:321,status,delivery_status:state,order_type:'delivery',
    courier_telegram_id:123,payment_status:'pending',delivery_address:address,green_sm_stage:green}};
   assert.equal(table,'cafe_delivery_tracking');
   positionReads++;positionFilters=filters;
   return {data:{latitude:12.28,longitude:109.2,position_at:new Date(Date.now()-age).toISOString(),enabled}};
  }
 };
 return chain;
}
async function rpc(name,args){
 assert.equal(name,'umma_resolve_guest_tracking');
 authorizedArgs=args;
 if(rpcError)return {error:{code:'42501'}};
 const valid=(args.p_order===orderId&&args.p_request_key===requestKey)||
  (!args.p_order&&args.p_token_hash===await digest(token));
 return {data:valid?{orderId,channel:'umma-guest-gps:'+'f'.repeat(64)}:null};
}
async function digest(value){
 const bytes=await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
 return Buffer.from(bytes).toString('hex');
}
vm.runInNewContext(stripTypeScriptTypes(readFileSync('supabase/functions/umma-guest-delivery/index.ts','utf8').replace(/^import .*;\n/gm,'')),{
 Deno:{serve:fn=>handler=fn,env:{get:()=> 'qa'}},
 createClient:()=>({from:query,rpc}),crypto:webcrypto,TextEncoder,Response,console:{error(){}}
});
const req=credentials=>handler(new Request('https://qa.invalid',{method:'POST',body:JSON.stringify({action:'tracking',...credentials})}));
const owner={orderId,requestKey};
let r=await req(owner),d=await r.json();
assert.equal(r.status,200);
assert.equal(d.latitude,12.28);
assert.deepEqual(d.destination,{latitude:12.31,longitude:109.2});
assert.equal(d.delivery_address,undefined);
assert.deepEqual(positionFilters,[['order_id',orderId],['courier_telegram_id',123]]);
assert.equal(authorizedArgs.p_request_key,requestKey);
assert.equal((await req({token})).status,200);
assert.equal(authorizedArgs.p_token_hash,await digest(token));

for(const credentials of [{orderId},{orderId,requestKey:orderId},{orderId:requestKey,requestKey},{orderId:requestKey,token},{token:'b'.repeat(64)}]){
 const before=positionReads;
 r=await req(credentials);
 assert.equal(r.status,403);
 assert.equal((await r.json()).channel,undefined);
 assert.equal(positionReads,before);
}
rpcError=true;
assert.equal((await req(owner)).status,500,'permission failures are service faults');
rpcError=false;
for(const ending of ['completed','cancelled']){
 status=ending;
 const before=positionReads;
 d=await(await req(owner)).json();
 assert.equal(d.state,ending);
 assert.equal(d.latitude,undefined);
 assert.equal(d.channel,undefined);
 assert.equal(positionReads,before);
}
status='ready';
for(const step of ['waiting_courier','courier_assigned','delivered']){
 state=step;
 const before=positionReads;
 d=await(await req(owner)).json();
 assert.equal(d.latitude,undefined);
 assert.equal(d.channel,undefined);
 assert.equal(positionReads,before);
}
state='picked_up';green='picked_up';
assert.equal((await req(owner)).status,404);
green=null;address='Legacy address without coordinates';
d=await(await req(owner)).json();
assert.equal(d.destination,undefined);
assert.equal(d.latitude,12.28);
age=61000;
d=await(await req(owner)).json();
assert.equal(d.latitude,12.28);
assert.equal(d.positionFresh,false);
age=0;enabled=false;
d=await(await req(owner)).json();
assert.equal(d.positionFresh,false);
console.log('PASS guest tracking Edge: owner and token access, wrong order, service faults, courier scoping, Green SM isolation, terminal and stale positions.');
