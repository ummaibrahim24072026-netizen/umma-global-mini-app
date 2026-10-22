import {JSDOM} from 'jsdom';import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';
const dom=new JSDOM(readFileSync('index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),{url:'https://example.test',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document;
w.Telegram={WebApp:{initData:'signed-test',initDataUnsafe:{user:{id:2,first_name:'QA'}},BackButton:{hide(){},show(){},onClick(){}},ready(){},expand(){}}};w.scrollTo=()=>{};w.HTMLElement.prototype.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.TextEncoder=TextEncoder;Object.defineProperty(w.crypto,'subtle',{value:webcrypto.subtle});
let locale='ru',manager=false,bookings=[],bookCalls=0,lose=true;w.ummaI18n={locale:()=>locale};
const calls=[],saved=new Map(),id='11111111-1111-4111-8111-111111111111';
const vehicle={id,name:'QA Honda <script>bad()</script>',specs:'125cc',description:'QA',pickup:'QA Nha Trang',accessories:'2 helmets',available:true,photos:[{path:'a.jpg',url:'javascript:alert(1)'}]};
w.fetch=async(url,opts)=>{const b=JSON.parse(opts.body);calls.push(b);let r={ok:true};
 if(b.action==='catalog')r={ok:true,vehicles:[vehicle]};
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
 d.querySelector('[data-service="rent"]').click();await tick();assert.equal(w.ummaNavigation.current(),'rentPage');
 assert.match(d.querySelector('#rentPage').textContent,/400 000/);assert.equal(d.querySelector('#rentPage script'),null);assert.equal(d.querySelector('#rentPage a[href^="javascript:"]'),null);
 assert.equal(d.querySelector('[data-rent="vehicles"]'),null,'customer cannot access inventory');
 click('book');await tick();set('phone','000000000');set('terms',true);submit();submit();await tick();assert.equal(bookCalls,1,'double submit suppressed');assert.ok(d.querySelector('[data-form="book"]'),'unknown outcome retains draft');assert.equal(d.querySelector('[name="phone"]').value,'000000000');
 submit();await tick();assert.equal(bookCalls,2);const booked=calls.filter(c=>c.action==='book');assert.equal(booked[0].request_id,booked[1].request_id,'same request key after response loss');assert.equal(bookings.length,1);assert.match(d.querySelector('#rentPage').textContent,/№1/);
 click('cancel');await tick();assert.equal(bookings[0].status,'cancelled');
 click('catalog');await tick();manager=true;await w.ummaRent.open();await tick();click('vehicles');await tick();click('new_vehicle');await tick();assert.ok(d.querySelector('[data-form="vehicle"]'));
 assert.equal(d.querySelector('[name="published"]').disabled,true,'new vehicle cannot publish without photos');set('name','QA draft');locale='vi';w.dispatchEvent(new w.Event('umma:languagechange'));assert.equal(d.querySelector('[name="name"]').value,'QA draft','language change preserves form');assert.match(d.querySelector('#rentPage').textContent,/Lưu xe/);
 assert.equal(w.ummaNavigation.back(),true,'nested Back');assert.equal(w.ummaNavigation.back(),true,'screen Back');await tick();assert.equal(d.getElementById('rentPage').hidden,true);
 console.log('PASS rental UI: More routing, safe gallery/text, booking validation, double tap, response-loss replay, customer cancellation, draft inventory, translated form preservation and native Back.');
}finally{w.close();}
