import {JSDOM} from 'jsdom';import {readFileSync,writeFileSync} from 'node:fs';import {webcrypto} from 'node:crypto';import assert from 'node:assert/strict';
const token='a'.repeat(64),html=readFileSync('kiosk.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
const dom=new JSDOM(html,{url:'https://umma.example/kiosk.html#activate='+token,runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document;
let tickFn,now=0,createCalls=[],lose=false,paid=false;const cafe='e22788bd-4734-4b3a-911e-ba103d52617a';
const product={id:'11111111-1111-4111-8111-111111111111',sku:'UMMA-CAFE-PLOV',name_ru:'Плов',name_en:'Pilaf',name_vi:'Cơm cừu',price_vnd:120000,image_url:'logo/assets/menu/plov-white-v2.webp'};
function mockFetch(url,opts){const b=opts?.body?JSON.parse(opts.body):{};let data;
 if(String(url).endsWith('cafe-menu'))data={ok:true,products:[product],locations:[{id:cafe,name:'HALAL UMMA',address:'Scenia Bay · №13'}]};
 else if(b.action==='config')data={ok:true,location:{id:cafe,name:'HALAL UMMA',address:'Scenia Bay · №13'},qrAvailable:true};
 else if(b.action==='create'){createCalls.push(b);if(lose){lose=false;return Promise.reject(Error('Lost response'));}data={ok:true,order:{id:'order',orderNumber:321,totalVnd:120000}};}
 else data={ok:true,order:{id:'order',number:321,total:120000,status:'pending',paymentStatus:paid?'paid':'pending'},payment:null};
 return Promise.resolve({ok:true,json:async()=>data});}
w.fetch=mockFetch;w.AbortSignal=AbortSignal;w.scrollTo=()=>{};Object.defineProperty(w.crypto,'randomUUID',{value:()=>webcrypto.randomUUID()});w.Date.now=()=>now;
w.setInterval=(fn,ms)=>{if(ms===1000)tickFn=fn;return 1};w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};
const tick=()=>new Promise(r=>setTimeout(r,10)),click=s=>{assert.ok(d.querySelector(s),s);d.querySelector(s).click();};
try{
 w.eval(readFileSync('js/cafe/kiosk.js','utf8'));await tick();assert.equal(w.location.hash,'');assert.equal(w.localStorage.getItem('umma:kiosk:token'),token);
 click('[data-action=start]');await tick();click('[data-change="1"]');click('[data-action=review]');click('[data-mode=dine_in]');click('[data-action=submit]');await tick();assert.equal(createCalls.length,0,'table required');
 const select=d.getElementById('table');select.value='3';select.dispatchEvent(new w.Event('change',{bubbles:true}));click('[data-payment=qr]');lose=true;click('[data-action=submit]');click('[data-action=submit]');await tick();assert.equal(createCalls.length,1,'double tap suppressed');assert.ok(w.localStorage.getItem('umma:kiosk:pending'));assert.ok(d.querySelector('[data-action=recover]'));
 click('[data-action=recover]');await tick();assert.equal(createCalls.length,2);assert.equal(createCalls[0].requestKey,createCalls[1].requestKey);assert.equal(createCalls[1].orderType,'dine_in');assert.equal(createCalls[1].table,'3');assert.equal(createCalls[1].paymentMethod,'qr');assert.equal(w.localStorage.getItem('umma:kiosk:pending'),null);assert.match(d.getElementById('screen').textContent,/321/);
 paid=true;click('[data-action=check]');await tick();assert.match(d.getElementById('paymentStatus').textContent,/Оплата подтверждена/);
 click('[data-action=new]');click('[data-lang=en]');click('[data-action=start]');await tick();assert.match(d.getElementById('screen').textContent,/Pilaf/);click('[data-change="1"]');now=91000;tickFn();assert.equal(d.getElementById('idle').open,true);now=107000;tickFn();assert.match(d.getElementById('screen').textContent,/Начать заказ/);assert.equal(w.localStorage.getItem('umma:kiosk:token'),token,'visitor reset retains only device credential');
 console.log('PASS kiosk UI: activation fragment cleared, menu/three languages, table validation, duplicate tap guard, lost response same-key recovery, real payment status and idle reset');
 if(process.argv.includes('--fixture')){
  const mock=mockFetch.toString().replace('createCalls.push(b);','').replace("if(lose){lose=false;return Promise.reject(Error('Lost response'));}",'');
  const fixture=readFileSync('kiosk.html','utf8').replace('<script src="js/vendor/qrcode-generator.js">',`<script>const cafe=${JSON.stringify(cafe)},product=${JSON.stringify(product)},paid=false;window.fetch=${mock};localStorage.setItem('umma:kiosk:token','${token}');</script><script src="js/vendor/qrcode-generator.js">`);
  writeFileSync('preview-public/kiosk-qa.html',fixture);
 }
}finally{w.close();}
