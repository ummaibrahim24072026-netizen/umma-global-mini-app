import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const source=readFileSync('js/cafe/order-requests.js','utf8');
const values=new Map(),server=new Map();let requests=0,created=0,loseResponse=true;
const url='https://zwzojugspldexyyljwpr.supabase.co/functions/v1/create-cafe-order';
function runtime(storageFailure=false){
  const context={
    window:{Telegram:{WebApp:{initDataUnsafe:{user:{id:123}}}}},
    document:{readyState:'complete',getElementById:()=>null},
    sessionStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>{if(storageFailure)throw new Error('storage unavailable');values.set(key,value);},removeItem:key=>values.delete(key)},
    crypto:{randomUUID},AbortSignal,
    fetch:async(url,options)=>{
      requests++;const body=JSON.parse(options.body);
      if(!server.has(body.requestKey)){created++;server.set(body.requestKey,{ok:true,order:{id:'order-'+created,orderNumber:created}});}
      if(loseResponse){loseResponse=false;throw new TypeError('response lost after commit');}
      return new Response(JSON.stringify(server.get(body.requestKey)),{status:201});
    },
  };
  vm.runInNewContext(source,context);return context.window.ummaCafeRequests;
}
let api=runtime();
const payload={initData:'secret-telegram-auth',items:[{productId:'test',quantity:1}],orderType:'pickup'};
await assert.rejects(api.request(url,payload),/response lost/);
assert.equal(created,1);assert.ok(api.pending());
assert.ok(![...values.values()][0].includes('secret-telegram-auth'));
await assert.rejects(api.request(url,{...payload,orderType:'delivery'}),/прежний заказ/);
assert.equal(requests,1);
api=runtime(); // Simulate a page reload retaining sessionStorage.
const response=await api.request(url,{...payload,initData:'fresh-signature'});
assert.equal((await response.json()).order.id,'order-1');assert.equal(created,1);assert.equal(api.pending(),null);
const count=requests;
await assert.rejects(runtime(true).request(url,payload),/storage unavailable/);assert.equal(requests,count);
await assert.rejects(api.request('https://untrusted.example',payload),/Недопустимый/);
console.log('PASS lost-response recovery after reload, stable operation key, changed-draft guard, no stored Telegram credential, storage failure before network and endpoint allowlist');

assert.equal((readFileSync('index.html','utf8').match(/src="js\/cafe\/order-requests.js/g)||[]).length,1,'operation helper must load once');

values.clear();loseResponse=true;
const refundPayload={initData:'secret-telegram-auth',action:'refundOrder',orderId:'qa-paid-order',reason:'QA reason',payoutConfirmed:true};
const refundUrl='https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-kitchen';
const beforeRefund=created;api=runtime();await assert.rejects(api.request(refundUrl,refundPayload),/response lost/);
const refundKey=api.pending().requestKey;api=runtime();await api.request(refundUrl,{...refundPayload,initData:'fresh-signature'});
assert.equal(created,beforeRefund+1);assert.equal(api.pending(),null);assert.ok(server.has(refundKey));
console.log('PASS refund response-loss recovery keeps original operation key after reload');
