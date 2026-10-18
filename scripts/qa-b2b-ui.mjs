import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
const html=readFileSync('index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
const dom=new JSDOM(html,{url:'https://example.test',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document;
const id='11111111-1111-4111-8111-111111111111',wh='22222222-2222-4222-8222-222222222222';
const catalog={ok:true,warehouses:[{id:wh,name:'UMMA Market',city:'Nha Trang'}],categories:[{id:'veg',name_ru:'Овощи'}],products:[{id,warehouse_id:wh,category_id:'veg',name_ru:'Перец <script>bad()</script>',name_en:'Pepper',image_url:'javascript:alert(1)'}]};
w.Telegram={WebApp:{initData:'synthetic-signed',initDataUnsafe:{user:{id:12,first_name:'QA'}},ready(){},expand(){},setHeaderColor(){},setBackgroundColor(){},enableClosingConfirmation(){}}};
w.TextEncoder=TextEncoder;Object.defineProperty(w.crypto,'subtle',{value:webcrypto.subtle});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
let locale='ru',manager=false,requests=[],created=0,lost=true,delayCreate=null;
w.ummaI18n={locale:()=>locale};
const calls=[],saved=new Map();
w.fetch=async(url,options)=>{
 const body=JSON.parse(options.body);calls.push(body);
 let result={ok:true};
 if(body.action==='b2b_catalog')result=catalog;
 else if(body.action==='b2b_requests')result={ok:true,requests,manager_warehouses:manager?[{id:wh}]:[]};
 else if(body.action==='b2b_create'){
  if(delayCreate)await delayCreate;
  if(saved.has(body.request_id))result=saved.get(body.request_id);
  else{created++;result={ok:true,request:{...body.data,id:'request-one',request_number:1,status:'submitted',version:1,items:body.data.items.map(i=>({...i,name_ru:catalog.products[0].name_ru}))}};saved.set(body.request_id,result);requests=[result.request];}
  if(lost){lost=false;throw Error('Response lost after commit');}
 }else if(body.action==='b2b_respond'){
  requests=requests.map(r=>r.id===body.data.id?{...r,...body.data,version:r.version+1}:r);result={ok:true,request:requests[0]};
 }else if(body.action==='b2b_cancel'){requests=requests.map(r=>({...r,status:'cancelled',version:r.version+1}));result={ok:true,request:requests[0]};}
 return{ok:true,json:async()=>structuredClone(result)};
};
const tick=async()=>{for(let i=0;i<12;i++)await new Promise(r=>setTimeout(r,0));};
const click=action=>{const b=d.querySelector('#b2bPage [data-b2b="'+action+'"]');assert.ok(b,'button '+action);b.click();};
const set=(name,value)=>{const input=d.querySelector('#b2bPage [name="'+name+'"]');assert.ok(input,name);input.value=value;input.dispatchEvent(new w.Event('input',{bubbles:true}));input.dispatchEvent(new w.Event('change',{bubbles:true}));};
const submit=form=>form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
try {
 for(const file of ['js/core/app.js','js/market/api.js','js/b2b/b2b.js','js/core/navigation.js','js/core/native-shell.js'])w.eval(readFileSync(file,'utf8'));
 d.querySelector('.service[data-page=b2b]').click();await tick();
 assert.equal(d.getElementById('b2bPage').hidden,false);assert.equal(w.ummaNavigation.current(),'b2bPage');
 assert.equal(d.querySelector('.service[data-page=b2b] .native-coming')?.textContent,'В разработке','B2B route remains accessible while launch status is disclosed');
 assert.ok(d.querySelector('[data-service=b2b]'),'B2B in More directory');
 assert.equal(d.querySelector('[data-b2b-product] img'),null,'unsafe image URL rejected');assert.equal(d.querySelector('#b2bPage script'),null);
 assert.match(d.querySelector('[data-b2b-product]').textContent,/<script>bad/,'name displayed as plain text');
 assert.equal(d.querySelector('#b2bPage [data-b2b=manage]'),null,'consumer has no manager button');
 const search=d.querySelector('[data-b2b-search]');search.value='none';search.dispatchEvent(new w.Event('input',{bubbles:true}));assert.equal(d.querySelectorAll('[data-b2b-product]').length,0);
 search.value='pepper';search.dispatchEvent(new w.Event('input',{bubbles:true}));assert.equal(d.querySelectorAll('[data-b2b-product]').length,1,'multilingual product search');
 click('toggle');click('compose');assert.equal(d.querySelector('[name=contact_name]').value,'QA');
 set('company_name','QA <img src=x> café');set('contact_phone','+840000000');set('city','Nha Trang');set('frequency','weekly');set('fulfillment','delivery');
 assert.equal(d.querySelector('[name=address]').required,true);assert.equal(d.querySelector('[data-b2b-form]').checkValidity(),false,'delivery address required');
 set('address','QA address 13');set('comment','Keep this draft');
 const quantity=d.querySelector('[data-line-quantity]');quantity.value='12.5';quantity.dispatchEvent(new w.Event('input',{bubbles:true}));
 assert.equal(w.ummaNavigation.back(),true);assert.ok(d.querySelector('[data-b2b-grid]'),'native Back leaves form first');
 click('compose');assert.equal(d.querySelector('[name=comment]').value,'Keep this draft');assert.equal(d.querySelector('[data-line-quantity]').value,'12.5');
 let release;delayCreate=new Promise(r=>release=r);submit(d.querySelector('[data-b2b-form]'));submit(d.querySelector('[data-b2b-form]'));await tick();
 assert.equal(calls.filter(c=>c.action==='b2b_create').length,1,'double tap sends once');assert.equal(d.querySelector('[name=company_name]').disabled,true,'in-flight fields locked');
 release();delayCreate=null;await tick();assert.ok(d.querySelector('[data-b2b-form]'),'unknown outcome retains form');assert.equal(d.querySelector('[name=comment]').value,'Keep this draft');
 submit(d.querySelector('[data-b2b-form]'));await tick();assert.equal(created,1,'retry does not duplicate committed enquiry');
 const createCalls=calls.filter(c=>c.action==='b2b_create');assert.equal(createCalls[0].request_id,createCalls[1].request_id);assert.equal(createCalls[1].data.items[0].quantity,12.5);assert.equal(createCalls[1].data.items[0].unit,'kg');
 assert.ok(d.querySelector('[data-b2b-request]'));assert.equal(d.querySelector('#b2bPage img'),null,'company text escaped');assert.match(d.querySelector('[data-b2b-status]').textContent,/Заявка отправлена/);
 manager=true;await w.ummaB2B.open();click('manage');await tick();assert.ok(d.querySelector('[data-b2b-response]'),'authorized management inbox');
 set('status','quoted');set('manager_reply','QA <script> proposal');submit(d.querySelector('[data-b2b-response]'));await tick();assert.match(d.querySelector('.b2b-reply').textContent,/QA <script> proposal/);assert.equal(d.querySelector('.b2b-reply script'),null);
 assert.equal(calls.find(c=>c.action==='b2b_respond').data.version,1,'optimistic version sent');
 click('mine');await tick();click('cancel');await tick();assert.match(d.querySelector('[data-b2b-request]').textContent,/Отменена/);assert.equal(d.querySelector('[data-b2b=cancel]'),null);
 click('catalog');await tick();click('compose');set('company_name','Other QA');set('other_needs','Packaging and cleaning supplies');assert.equal(d.querySelector('[name=other_needs]').required,true,'non-catalogue needs required for empty basket');
 locale='vi';w.dispatchEvent(new w.Event('umma:languagechange'));assert.equal(d.querySelector('[name=company_name]').value,'Other QA','language change preserves draft');assert.match(d.querySelector('#b2bPage button[type=submit]').textContent,/Gửi/);
 w.ummaB2B.backToCatalog();w.ummaNavigation.back();assert.equal(d.getElementById('b2bPage').hidden,true);assert.equal(d.querySelector('.app>main').style.display,'','Back restores home');
 w.Telegram.WebApp.initData='';await w.ummaB2B.open();click('compose');assert.equal(d.querySelector('[data-b2b-form]'),null,'unsigned visitor can browse but not submit');
 console.log('PASS B2B UI: real Home/More/native Back routing, safe product search, quantity draft, delivery validation, duplicate-tap and lost-response replay, manager reply, buyer cancellation and language preservation');
}finally{w.close();}
