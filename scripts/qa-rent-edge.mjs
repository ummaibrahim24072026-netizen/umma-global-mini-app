import {readFileSync} from 'node:fs';import {stripTypeScriptTypes} from 'node:module';import vm from 'node:vm';import {webcrypto,createHmac,randomUUID} from 'node:crypto';import assert from 'node:assert/strict';
const auth=stripTypeScriptTypes(readFileSync('supabase/functions/rent-service/auth.ts','utf8').replace('export async','async'));
const source=stripTypeScriptTypes(readFileSync('supabase/functions/rent-service/index.ts','utf8').replace(/^import .*;\n/gm,''));
let handler;const calls=[],bot='synthetic-test-only',db={rpc:async(name,args)=>{calls.push({name,args});if(name==='rent_catalog')return{data:{ok:true,vehicles:[]}};if(args.p_actor!==2||args.p_staff)return{error:{message:'RENT_ACCESS'}};if(name==='rent_detail')return{data:{ok:true,booking:{id:args.p_id},media:[{path:'private.jpg'}]}};return{data:{ok:true,bookings:[]}};},storage:{from:()=>({createSignedUrl:async(path,seconds)=>{calls.push({path,seconds});return{data:{signedUrl:'https://example.test/private?token=expires'}};}})}};
vm.runInNewContext(stripTypeScriptTypes(readFileSync('supabase/functions/rent-service/payment.ts','utf8').replace('export function','function'))+'\n'+auth+'\n'+source,{URLSearchParams,TextEncoder,crypto:webcrypto,Response,Request,AbortSignal,createClient:()=>db,Deno:{env:{get:k=>k==='TELEGRAM_BOT_TOKEN'?bot:'synthetic'},serve:h=>handler=h}});
function signed(actor=2,age=0){const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)-age),user:JSON.stringify({id:actor})});const check=[...p].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');const secret=createHmac('sha256','WebAppData').update(bot).digest();p.set('hash',createHmac('sha256',secret).update(check).digest('hex'));return p.toString();}
const request=(body,method='POST')=>handler(new Request('https://example.test',{method,...(method==='POST'?{body:JSON.stringify(body)}:{})}));
assert.equal((await request({action:'catalog'})).status,200);
assert.equal((await request({action:'state',initData:'forged'})).status,401);
assert.equal((await request({action:'state',initData:signed(2,90000)})).status,401);
assert.equal((await request({action:'state',initData:signed(),actor:1,data:{staff:true}})).status,403);
assert.equal((await request({action:'state',initData:signed(),actor:1})).status,200);assert.equal(calls.at(-1).args.p_actor,2,'actor from signature, never body');
assert.equal((await request({action:'detail',initData:signed(3),data:{id:randomUUID()}})).status,403);assert.ok(!calls.some(c=>c.path),'no storage signing before authorization');
assert.equal((await request({action:'detail',initData:signed(),data:{id:randomUUID()}})).status,200);assert.equal(calls.at(-1).seconds,300,'private evidence link expires');
assert.equal((await request({action:'book',initData:signed(),request_id:'bad'})).status,400);
assert.equal((await request({},'GET')).status,405);
console.log('PASS rental Edge: signed actor, expired/forged Telegram rejection, staff checks, private evidence signing only after ownership authorization and 5-minute expiry.');
