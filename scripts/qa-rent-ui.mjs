import {JSDOM} from 'jsdom';import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';
const dom=new JSDOM(readFileSync('index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),{url:'https://example.test',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document;
w.Telegram={WebApp:{initData:'signed-test',initDataUnsafe:{user:{id:2,first_name:'QA'}},BackButton:{hide(){},show(){},onClick(){}},ready(){},expand(){}}};w.scrollTo=()=>{};w.HTMLElement.prototype.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.TextEncoder=TextEncoder;Object.defineProperty(w.crypto,'subtle',{value:webcrypto.subtle});
let catalogResponder=null;
let locale='ru',manager=false,bookings=[],bookCalls=0,lose=true;w.ummaI18n={locale:()=>locale};
const calls=[],saved=new Map(),id='11111111-1111-4111-8111-111111111111';
const vehicle={id,daily_vnd:400000,deposit_usd:200,deposit_vnd:5000000,name:'QA Honda <script>bad()</script>',specs:'125cc',description:'QA',pickup:'QA Nha Trang',accessories:'2 helmets',available:true,photos:[{path:'a.jpg',url:'javascript:alert(1)'},{path:'b.jpg'}]};
w.fetch=async(url,opts)=>{const b=JSON.parse(opts.body);calls.push(b);let r={ok:true};
 if(b.action==='catalog')r=catalogResponder?await catalogResponder(b):{ok:true,vehicles:[vehicle]};
 else if(b.action==='state')r={ok:true,manager,super_admin:manager,bookings,vehicles:[],staff:[]};
 else if(b.action==='book'){bookCalls++;if(saved.has(b.request_id))r=saved.get(b.request_id);else{const booking={...b.data,id:'22222222-2222-4222-8222-222222222222',number:1,status:'reserved',expires_at:new Date(Date.now()+1800000).toISOString(),customer_id:2,vehicle_snapshot:vehicle,total_vnd:400000,paid_vnd:0,deposit_amount:5000000,version:1};r={ok:true,booking};saved.set(b.request_id,r);bookings=[booking];}if(lose){lose=false;throw Error('Lost response');}}
 else if(b.action==='detail')r={ok:true,booking:bookings[0],media:[],events:[]};
 else if(b.action==='cancel'){bookings[0]={...bookings[0],status:'cancelled',version:2};r={ok:true,booking:bookings[0]};}
 return{ok:true,json:async()=>structuredClone(r)};
};
const tick=async()=>{for(let i=0;i<10;i++)await new Promise(r=>setTimeout(r,0));};
const click=a=>{const el=d.querySelector('#rentPage [data-rent="'+a+'"]');assert.ok(el,a);el.click();};
const set=(name,val)=>{const el=d.querySelector('#rentPage [name="'+name+'"]');assert.ok(el,name);if(el.type==='checkbox')el.checked=val;else el.value=val;el.dispatchEvent(new w.Event('input',{bubbles:true}));};
const submit=()=>d.querySelector('#rentPage [data-form]').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
try{
 for(const f of ['js/core/app.js','js/rent/api.js','js/rent/rent.js','js/core/navigation.js','js/core/native-shell.js'])w.eval(readFileSync(f,'utf8'));
 assert.equal(d.querySelector('.services-grid [data-service=cafe]').nextElementSibling.dataset.service,'rent','rental follows Cafe on Home');d.querySelector('.services-grid [data-service="rent"]').click();await tick();assert.equal(w.ummaNavigation.current(),'rentPage');
 assert.match(d.querySelector('#rentPage').textContent,/400/);assert.equal(d.querySelector('#rentPage script'),null);assert.equal(d.querySelector('#rentPage a[href^="javascript:"]'),null);assert.ok([...d.querySelectorAll('#rentPage .rent-gallery img')].every(img=>img.src.startsWith('https://zwzojugspldexyyljwpr.supabase.co/storage/v1/object/public/rent-catalog/')),'catalogue photos without URL use their storage path');
 assert.equal(d.querySelector('[data-rent="vehicles"]'),null,'customer cannot access inventory');

 assert.equal(d.querySelector('[data-filter] button[type=submit]'),null,'no manual availability button');
 const input=d.querySelector('[data-filter] [name=starts_at]');
 const future=new Date(Date.now()+30*86400000),localTime=v=>new Date(v.getTime()+7*3600000).toISOString().slice(0,16);
 const changeDate=(name,value)=>{const el=d.querySelector('[data-filter] [name='+name+']');el.value=value;el.dispatchEvent(new w.Event('change',{bubbles:true}));};
 const held=[];catalogResponder=()=>new Promise((resolve,reject)=>held.push({resolve,reject}));
 changeDate('starts_at',localTime(future));changeDate('ends_at',localTime(new Date(+future+86400000)));await tick();
 assert.equal(held.length,1,'future dates checked automatically');assert.equal(d.querySelector('[data-rent=book]').disabled,true,'stale availability cannot be booked');
 changeDate('ends_at',localTime(new Date(+future+2*86400000)));await tick();assert.equal(held.length,2);
 held[1].resolve({ok:true,vehicles:[{...vehicle,available:false}]});await tick();assert.match(d.querySelector('[data-rent=book]').textContent,/Занят/);
 assert.equal(d.querySelector('[data-filter] [name=starts_at]'),input,'native date input remains mounted');
 held[0].resolve({ok:true,vehicles:[{...vehicle,available:true}]});await tick();assert.equal(d.querySelector('[data-rent=book]').disabled,true,'late response cannot overwrite newer unavailable dates');
 changeDate('ends_at',localTime(new Date(+future+3*86400000)));await tick();held[2].reject(Error('offline'));await tick();assert.equal(d.querySelector('[data-rent=book]').disabled,true,'network failure cannot expose stale book action');
 catalogResponder=null;click('refresh');await tick();assert.equal(d.querySelector('[data-rent=book]').disabled,false,'refresh retries failed check');
 const catalogCount=calls.filter(c=>c.action==='catalog').length;
 changeDate('ends_at',localTime(new Date(+future-86400000)));await tick();assert.equal(calls.filter(c=>c.action==='catalog').length,catalogCount,'invalid range sends no request');assert.equal(d.querySelector('[data-rent=book]').disabled,true);
 changeDate('ends_at',localTime(new Date(+future+86400000)));await tick();assert.equal(d.querySelector('[data-rent=book]').disabled,false);
 const lastCatalog=calls.filter(c=>c.action==='catalog').at(-1);assert.ok(new Date(lastCatalog.data.starts_at)>new Date(Date.now()+29*86400000),'future month is sent to server');
 w.sessionStorage.setItem('umma-rent-form:2:book:'+id,JSON.stringify({payment_method:'cash'}));
 click('book');await tick();assert.equal(d.querySelector('[name=payment_method]:checked'),null,'no cash default');set('phone','000000000');set('terms',true);set('driver_declared',true);submit();await tick();assert.equal(bookCalls,0,'explicit payment choice required');d.querySelector('[name=payment_method][value=qr]').checked=true;submit();submit();await tick();assert.equal(bookCalls,1,'double submit suppressed');assert.ok(d.querySelector('[data-form="book"]'),'unknown outcome retains draft');assert.equal(d.querySelector('[name="phone"]').value,'000000000');
 submit();await tick();assert.equal(bookCalls,2);const booked=calls.filter(c=>c.action==='book');assert.equal(booked[0].request_id,booked[1].request_id,'same request key after response loss');assert.equal(bookings.length,1);assert.equal(booked[1].data.currency,'VND');assert.equal(booked[1].data.payment_method,'qr','chosen method survives retry');assert.equal(booked[1].data.terms_version,'rent-v4');assert.match(d.querySelector('#rentPage').textContent,/№1/);
 click('cancel');await tick();assert.equal(bookings[0].status,'cancelled');
 vehicle.daily_vnd=1200000;vehicle.deposit_usd=500;vehicle.deposit_vnd=12500000;click('catalog');await tick();click('book');await tick();
 assert.equal(d.querySelector('[name=currency]').type,'hidden','no currency choice');assert.equal(d.querySelector('[name=currency]').value,'VND');assert.equal(d.querySelectorAll('[name=payment_method][type=radio]').length,2,'cash and QR choice before booking');assert.doesNotMatch(d.querySelector('#rentPage').textContent,/USD|\$/);assert.match(d.querySelector('#rentPage').textContent,/24 часа/);
 assert.match(d.querySelector('[data-quote]').textContent,/1[\s\u00a0]200[\s\u00a0]000/,'Duke quote uses vehicle tariff');assert.match(d.querySelector('[data-quote]').textContent,/12[\s\u00a0]500[\s\u00a0]000/,'Duke VND deposit');assert.match(d.querySelector('[data-quote]').textContent,/13[\s\u00a0]700[\s\u00a0]000/,'rent plus refundable deposit');
 click('catalog');await tick();manager=true;await w.ummaRent.open();await tick();click('vehicles');await tick();click('new_vehicle');await tick();assert.ok(d.querySelector('[data-form="vehicle"]'));assert.equal(d.querySelector('[name=deposit_usd]'),null);assert.equal(d.querySelector('[name=deposit_vnd]').required,true);
 assert.equal(d.querySelector('[name="published"]').disabled,true,'new vehicle cannot publish without photos');set('name','QA draft');locale='vi';w.dispatchEvent(new w.Event('umma:languagechange'));assert.equal(d.querySelector('[name="name"]').value,'QA draft','language change preserves form');assert.match(d.querySelector('#rentPage').textContent,/Lưu xe/);
 assert.equal(w.ummaNavigation.back(),true,'nested Back');assert.equal(w.ummaNavigation.back(),true,'screen Back');await tick();assert.equal(d.getElementById('rentPage').hidden,true);
 console.log('PASS rental UI: More routing, safe gallery/text, booking validation, double tap, response-loss replay, customer cancellation, draft inventory, translated form preservation and native Back.');
}finally{w.close();}
