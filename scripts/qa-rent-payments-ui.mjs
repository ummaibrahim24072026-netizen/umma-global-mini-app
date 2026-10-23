import {JSDOM} from 'jsdom';import {readFileSync} from 'node:fs';import {webcrypto} from 'node:crypto';import {stripTypeScriptTypes} from 'node:module';import vm from 'node:vm';import assert from 'node:assert/strict';
const pure={};vm.createContext(pure);vm.runInContext(stripTypeScriptTypes(readFileSync('supabase/functions/rent-service/payment.ts','utf8').replace('export function','function'))+';this.make=rentalPayment;',pure);
const id='22222222-2222-4222-8222-222222222222',intentId='33333333-3333-4333-8333-333333333333',proofId='44444444-4444-4444-8444-444444444444';
const invoice=pure.make({id:intentId,booking_id:id,amount_vnd:400000,reference:'UMMAR1ABCDEF12',method:'qr',status:'pending'});
const dom=new JSDOM(readFileSync('index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),{url:'https://example.test',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document;
w.Telegram={WebApp:{initData:'synthetic',initDataUnsafe:{user:{id:2,first_name:'QA'}},ready(){},expand(){},BackButton:{hide(){},show(){},onClick(){}}}};w.TextEncoder=TextEncoder;Object.defineProperty(w.crypto,'subtle',{value:webcrypto.subtle});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
const vehicle={id:'11111111-1111-4111-8111-111111111111',name:'QA bike',daily_vnd:400000,deposit_usd:200,deposit_vnd:5000000,pickup:'QA location',accessories:'2 helmets',photos:[],available:true};
let booking={id,number:1,version:1,customer_id:2,customer_name:'QA',phone:'000000000',status:'confirmed',days:1,daily_vnd:400000,total_vnd:400000,paid_vnd:0,currency:'VND',deposit_amount:5000000,payment_method:'qr',vehicle_snapshot:vehicle,starts_at:new Date(Date.now()+60000).toISOString(),ends_at:new Date(Date.now()+86460000).toISOString()};
let manager=false,intents=[],proofs=[],stored=false,uploadCount=0,prepared=0,release;let hold=new Promise(r=>release=r);const calls=[];
const proof={id:proofId,intent_id:intentId,path:'qa/receipt.jpg',mime:'image/jpeg',size_bytes:4,uploaded:false,status:'pending',created_at:new Date().toISOString(),url:'https://example.test/private-receipt.jpg'};
w.XMLHttpRequest=class{constructor(){this.upload={};}open(method,url){assert.equal(method,'PUT');assert.equal(url,'https://storage.test/signed');}setRequestHeader(){}send(){stored=true;uploadCount++;this.status=200;this.onload();}};
w.fetch=async(url,opts)=>{const b=JSON.parse(opts.body);calls.push(b);let r={ok:true};
 if(b.action==='catalog')r={ok:true,vehicles:[vehicle]};
 if(b.action==='state')r={ok:true,manager,super_admin:manager,bookings:[booking],vehicles:[vehicle],staff:[]};
 if(b.action==='detail')r={ok:true,booking,media:[],events:[]};
 if(b.action==='pay_state')r={ok:true,intents,proofs};
 if(b.action==='accept_terms'){assert.equal(b.data.version,booking.version);booking={...booking,terms_version:'rent-v4',version:booking.version+1};r={ok:true,booking};}
 if(b.action==='pay_prepare'){prepared++;await hold;intents=[invoice];r={ok:true,intent:invoice};}
 if(b.action==='pay_proof_start')r={ok:true,proof};
 if(b.action==='pay_upload_url')r={ok:true,url:'https://storage.test/signed'};
 if(b.action==='pay_proof_finish'){if(!stored)return{ok:false,json:async()=>({ok:false,error:'RENT_UPLOAD'})};proof.uploaded=true;proofs=[proof];invoice.status='review';booking={...booking,version:booking.version+1};r={ok:true,proof};}
 if(b.action==='pay_review'){assert.equal(b.data.funds_received,true);assert.equal(b.data.version,booking.version);booking={...booking,paid_vnd:400000,version:booking.version+1};invoice.status='paid';proof.status='confirmed';r={ok:true,booking,intent:invoice,proof};}
 return{ok:true,json:async()=>JSON.parse(JSON.stringify(r))};
};
const tick=async()=>{for(let i=0;i<12;i++)await new Promise(r=>setTimeout(r,0));};const click=a=>{const b=d.querySelector('#rentPage [data-rent="'+a+'"]');assert.ok(b,a);b.click();};
try{
 for(const f of ['js/vendor/qrcode-generator.js','js/core/app.js','js/rent/api.js','js/rent/rent.js','js/core/navigation.js','js/core/native-shell.js'])w.eval(readFileSync(f,'utf8'));
 await w.ummaRent.open();click('mine');await tick();click('detail');await tick();
 assert.match(d.querySelector('.rent-next-step').textContent,/Байк забронирован/);click('pay_qr');click('pay_qr');await tick();assert.equal(prepared,1,'double tap creates one invoice');release();await tick();
 assert.ok(d.querySelector('.rent-qr svg'),'local QR rendered');assert.match(d.querySelector('.rent-invoice').textContent,/1062679069/);assert.match(d.querySelector('.rent-invoice').textContent,/UMMAR1ABCDEF12/);assert.equal(booking.paid_vnd,0,'opening payment never marks paid');
 const file=d.querySelector('[data-proof-file]');Object.defineProperty(file,'files',{value:[new w.File(['test'],'receipt.jpg',{type:'image/jpeg',lastModified:1})]});file.dispatchEvent(new w.Event('change',{bubbles:true}));click('send_proof');await tick();
 assert.equal(uploadCount,1);assert.match(d.querySelector('.rent-proof').textContent,/Чек на проверке/);assert.equal(booking.paid_vnd,0,'receipt upload is not a payment');assert.equal(d.querySelector('[data-rent=form_review]'),null,'customer cannot approve receipt');
 manager=true;await w.ummaRent.open();click('manage');await tick();click('detail');await tick();click('form_review');await tick();
 const form=d.querySelector('[data-form=review]');form.elements.reference.value='QA verified bank reference';form.elements.funds_received.checked=true;form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();
 assert.equal(booking.paid_vnd,400000);assert.match(d.querySelector('.rent-proof').textContent,/Платёж подтверждён/);assert.equal(d.querySelector('.rent-invoice'),null,'paid invoice no longer prompts payment');
 assert.equal(calls.filter(c=>c.action==='pay_review').length,1);
 manager=false;intents=[];proofs=[];booking={...booking,paid_vnd:0,terms_version:'rent-v4-pending'};await w.ummaRent.open();click('mine');await tick();click('detail');await tick();
 assert.ok(d.querySelector('[data-rent=accept_terms]'));assert.equal(d.querySelector('[data-rent=pay_qr]'),null,'converted agreement cannot prompt payment before consent');assert.doesNotMatch(d.querySelector('#rentPage').textContent,/USD/);click('accept_terms');await tick();assert.equal(booking.terms_version,'rent-v4');assert.ok(d.querySelector('[data-rent=pay_qr]'),'payment available after consent');
 console.log('PASS rental payment UI: exact server QR, duplicate-tap guard, signed upload, pending-only receipt, staff bank verification and paid-state refresh.');
}finally{w.close();}
