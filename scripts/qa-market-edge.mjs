import{readFileSync}from'node:fs';import{stripTypeScriptTypes}from'node:module';import vm from'node:vm';import assert from'node:assert/strict';import{createHmac,webcrypto}from'node:crypto';
const token='synthetic-bot-secret-for-isolated-tests-only';
const rawAuth=stripTypeScriptTypes(readFileSync('supabase/functions/market-stock/auth.ts','utf8'));
const {verifyTelegramInitData}=await import('data:text/javascript;base64,'+Buffer.from(rawAuth).toString('base64'));
const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:12,first_name:'QA'})});
const check=[...p.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');p.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(token).digest()).update(check).digest('hex'));const signed=p.toString();
let handler,seen=[];
const db={rpc:async(name,args)=>{seen.push({name,args});return{data:name==='market_catalog'?{ok:true,warehouses:[],categories:[],offers:[]}:{ok:true,order_id:'synthetic'},error:null};},from(table){let filters=[];const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},in(k,v){filters.push([k,v]);return q;},order(){return q;},async maybeSingle(){return {data:table==='telegram_users'?{role:'user',is_active:true}:null,error:null};},then(resolve){return Promise.resolve({data:[],error:null}).then(resolve);}};return q;}};
const code=stripTypeScriptTypes(readFileSync('supabase/functions/market-stock/index.ts','utf8')).replace(/^import .*;\s*$/gm,'');
const context=vm.createContext({Deno:{env:{get:n=>({TELEGRAM_BOT_TOKEN:token,SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service-key'})[n]},serve:fn=>handler=fn},createClient:()=>db,verifyTelegramInitData,crypto:webcrypto,Request,Response,Headers,URL,URLSearchParams,TextEncoder,Uint8Array,console:{error(){}},atob});
new vm.Script(code).runInContext(context);
const req=body=>handler(new Request('https://example.test/market-stock',{method:'POST',body:JSON.stringify(body)}));
const publicResponse=await req({action:'catalog'});assert.equal(publicResponse.status,200);assert.equal((await publicResponse.json()).ok,true);
assert.equal((await req({action:'order_create',initData:'',data:{}})).status,401);
assert.equal((await req({action:'order_create',initData:signed.replace(/hash=([a-f0-9])/,(_,v)=>'hash='+(v==='0'?'1':'0')),data:{}})).status,401);
seen=[];const created=await req({action:'order_create',initData:signed,actor:10,request_id:'11111111-1111-4111-8111-111111111111',data:{warehouse_id:'22222222-2222-4222-8222-222222222222',p_actor:10}});assert.equal(created.status,200);assert.equal(seen[0].name,'market_commerce_operation');assert.equal(seen[0].args.p_actor,12,'actor comes from verified Telegram signature');
assert.equal((await req({action:'snapshot',initData:signed,data:{warehouse_id:'22222222-2222-4222-8222-222222222222'}})).status,403);
assert.equal((await req({action:'warehouse_create',initData:signed,data:{}})).status,403);
assert.equal((await req({action:'order_create',initData:signed,request_id:'invalid',data:{}})).status,400);
seen=[];assert.equal((await req({action:'b2b_catalog'})).status,200);assert.equal(seen[0].name,'b2b_catalog');
assert.equal((await req({action:'b2b_requests',initData:''})).status,401);
seen=[];assert.equal((await req({action:'b2b_requests',initData:signed,data:{staff:true,p_actor:10}})).status,200);assert.equal(seen[0].name,'b2b_request_list');assert.equal(seen[0].args.p_actor,12);assert.equal(seen[0].args.p_staff,true);
for(const action of ['b2b_create','b2b_cancel','b2b_respond']){
 seen=[];assert.equal((await req({action,initData:signed,request_id:'11111111-1111-4111-8111-111111111111',data:{p_actor:10}})).status,200);assert.equal(seen[0].name,'b2b_operation');assert.equal(seen[0].args.p_actor,12);assert.equal(seen[0].args.p_action,action.slice(4));
 assert.equal((await req({action,initData:signed,request_id:'bad',data:{}})).status,400);
}
console.log('PASS Market Edge: public catalogue only, signed identity, tamper rejection, denied staff scope and trusted actor selection');
