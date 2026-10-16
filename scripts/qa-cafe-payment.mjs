import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {webcrypto,createHmac} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {paymentFor,crc16,QR_LOCATION} from '../supabase/functions/cafe-my-orders/payment.ts';
const read=p=>readFileSync(p,'utf8');
const id='11111111-1111-4111-8111-111111111111';
const order={id,order_number:1234,location_id:QR_LOCATION,payment_method:'qr',payment_status:'pending',status:'pending',total_vnd:125000,currency:'VND'};
const payment=paymentFor(order);
assert.equal(crc16('00020101021138540010A00000072701240006970436011010626790690208QRIBFTTA53037045802VN6304'),'8292','source QR checksum');
function parse(value){const tags={};for(let i=0;i<value.length;){const tag=value.slice(i,i+2),size=Number(value.slice(i+2,i+4));assert.ok(Number.isInteger(size)&&size>=0);tags[tag]=value.slice(i+4,i+4+size);i+=4+size;assert.ok(i<=value.length);}return tags;}
const fields=parse(payment.qrPayload);assert.equal(fields['01'],'12');assert.equal(fields['54'],'125000');assert.equal(fields['53'],'704');assert.equal(parse(fields['62'])['08'],'UMMA 1234');assert.equal(parse(parse(fields['38'])['01'])['01'],payment.account);assert.equal(crc16(payment.qrPayload.slice(0,-4)),fields['63']);
for(const change of [{payment_status:'paid'},{payment_status:'refunded'},{status:'cancelled'},{location_id:'other'},{payment_method:'cash'},{total_vnd:0},{total_vnd:1.5},{total_vnd:'NaN'},{currency:'RUB'}])assert.equal(paymentFor({...order,...change}),null);
// Execute the real endpoint with a signed synthetic Telegram session and a scoped fake DB.
let handler,queries=[],owned=true;
const client={from(table){const filters=[];const query={select(){return query;},eq(k,v){filters.push([k,v]);return query;},async maybeSingle(){queries.push({table,filters});if(table==='telegram_users')return {data:{telegram_id:42,is_active:true}};return {data:owned?order:null};}};return query;}};
const source=stripTypeScriptTypes(read('supabase/functions/cafe-my-orders/index.ts').replace(/^import .*;\n/gm,''));
vm.runInNewContext(source,{Deno:{serve:fn=>handler=fn,env:{get:key=>key==='TELEGRAM_BOT_TOKEN'?'test-only-token':'test-only'}},createClient:()=>client,paymentFor,QR_LOCATION,qrDownloadUrl:async()=>"https://qa.invalid/qr",qrDownloadResponse:()=>new Response(null,{status:403}),crypto:webcrypto,URLSearchParams,TextEncoder,Response,console});
const params=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:42})});
const check=[...params].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');
const secret=createHmac('sha256','WebAppData').update('test-only-token').digest();params.set('hash',createHmac('sha256',secret).update(check).digest('hex'));
async function request(body){return handler(new Request('https://test.invalid',{method:'POST',body:JSON.stringify(body)}));}
let res=await request({action:'paymentDetails',orderId:id,initData:params.toString(),amount:1,account:'attacker'});assert.equal(res.status,200);assert.equal((await res.json()).payment.amount,125000);assert.deepEqual(queries.find(q=>q.table==='cafe_orders').filters,[['id',id],['customer_telegram_id',42]]);
owned=false;res=await request({action:'paymentDetails',orderId:id,initData:params.toString()});assert.equal(res.status,409);
res=await request({action:'paymentDetails',orderId:id,initData:'user=42&auth_date=1&hash=bad'});assert.equal(res.status,401);
// Payment sheet: data safety, local QR, no paid mutation, stale request after closing.
const dom=new JSDOM('<button data-pay-order="'+id+'">Pay</button>',{url:'https://qa.local/app/',runScripts:'outside-only'}),w=dom.window,d=w.document;
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
w.HTMLCanvasElement.prototype.getContext=()=>({fillRect(){},set fillStyle(v){}});w.HTMLCanvasElement.prototype.toDataURL=()=> 'data:image/png;base64,AA==';
w.Telegram={WebApp:{initData:'synthetic'}};let calls=[],resolve;
w.fetch=async(url,opts)=>{calls.push(JSON.parse(opts.body));return new Response(JSON.stringify({ok:true,payment:{...payment,orderNumber:'<img src=x>',reference:'<img src=x>'}}));};
w.eval(read('js/vendor/qrcode-generator.js'));w.eval(read('js/cafe/payment.js'));
await w.ummaCafePayment.show(id);assert.ok(d.querySelector('.cafe-payment-qr-primary .cafe-payment-qr'));assert.equal(d.querySelector('input[type=file]'),null);assert.equal(d.querySelector('[data-bank-pay]').hidden,true);assert.equal(d.querySelector('[data-bank-pay]').hasAttribute('href'),false);assert.ok(d.querySelector('.cafe-payment-sheet').textContent.includes('<img src=x>'));assert.equal(d.querySelectorAll('img:not([hidden])').length,1);assert.equal(calls.filter(c=>c.action==='paymentDetails').length,1);assert.equal(calls[0].action,'paymentDetails');assert.equal(d.querySelectorAll('[data-confirm-payment]').length,0);
d.querySelector('.cafe-payment-close').click();assert.equal(d.querySelector('dialog').open,false);
w.fetch=()=>new Promise(r=>resolve=r);const pending=w.ummaCafePayment.show(id);d.querySelector('.cafe-payment-close').click();resolve(new Response(JSON.stringify({ok:true,payment})));await pending;assert.equal(d.querySelector('.cafe-payment-qr'),null);
dom.window.close();console.log('PASS VietQR CRC/fields, amount and recipient scope, signed owner authorization, rejected foreign/closed orders, safe payment UI, no paid mutation and cancelled request');
