import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const source=readFileSync(new URL('../js/cafe/voice-order.js',import.meta.url),'utf8');
const products=[
 {id:'p',sku:'UMMA-CAFE-PLOV',name_ru:'Плов с бараниной',name_en:'Lamb pilaf',name_vi:'Cơm pilaf thịt cừu',price_vnd:120000},
 {id:'m',sku:'UMMA-CAFE-MANTI',name_ru:'Манты с бараниной',name_en:'Manti',price_vnd:150000},
 {id:'s',sku:'UMMA-CAFE-SHURPA',name_ru:'Шурпа',name_en:'Shurpa',price_vnd:90000},
 {id:'a5',sku:'UMMA-CAFE-AYRAN-500',name_ru:'Айран 0,5 л',name_en:'Ayran 500 ml',price_vnd:40000,weight_value:500,weight_unit:'ml'},
 {id:'a1',sku:'UMMA-CAFE-TURKISH-AYRAN-1000',name_ru:'Айран 1 л',name_en:'Ayran 1 l',price_vnd:80000,weight_value:1000,weight_unit:'ml'}
];
let recognitions=[],spoken=[];
const dom=new JSDOM('<div id="host"></div><div id="review"></div>',{url:'https://example.com/',runScripts:'dangerously',pretendToBeVisual:true});const w=dom.window;
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
w.SpeechRecognition=class {constructor(){recognitions.push(this);}start(){this.started=true;}abort(){this.aborted=true;}};
w.SpeechSynthesisUtterance=class {constructor(text){this.text=text;}};w.speechSynthesis={cancel(){},getVoices:()=>[],speak:u=>spoken.push(u)};
w.eval(source);const {parse,volume}=w.UmmaVoiceOrder;const name=p=>p.name_ru;
const parseText=t=>JSON.parse(JSON.stringify(parse(t,products,name)));
assert.deepEqual(parseText('я хочу плов, манты, шурпу и айран').operations.map(x=>x.candidates.map(p=>p.id)),[['p'],['m'],['s'],['a5','a1']]);
assert.equal(parseText('два плова и три манты').operations[0].quantity,2);assert.equal(parseText('два плова и три манты').operations[1].quantity,3);
assert.equal(parseText('убери шурпу').operations[0].remove,true);
for(const [phrase,id] of [['two pilaf','p'],['tôi muốn một shurpa','s'],['필라프','p'],['抓饭','p'],['أريد بيلاف','p']])assert.equal(parseText(phrase).operations[0].candidates[0].id,id,phrase);
assert.equal(volume('0,5 литра'),500);assert.equal(volume('1 литр'),1000);
assert.equal(parseText('айран 0,5 л').operations[0].candidates[0].id,'a5');
assert.equal(parseText('правильно').kind,'confirm');assert.equal(parseText('Да, правильно.').kind,'confirm');assert.equal(parseText('两个抓饭').operations[0].quantity,2);assert.notEqual(parseText('неправильно').kind,'confirm');assert.notEqual(parseText('не правильно').kind,'confirm');assert.notEqual(parseText('правильно, убери плов').kind,'confirm');
assert.equal(parseText('добавь суши').kind,'unknown');assert.equal(parseText('посоветуй что-нибудь с бараниной').kind,'recommend');
let cart=new Map(),submitted=0,checked=0,valid=true,locked=false,language='ru',context={payment:'cash'};
const items=()=>[...cart].map(([id,quantity])=>({product:products.find(p=>p.id===id),quantity}));
const a=w.UmmaVoiceOrder.create({host:w.document.getElementById('host'),reviewHost:w.document.getElementById('review'),language:()=>language,name,money:n=>n+' ₫',products:()=>products,items,total:()=>items().reduce((s,x)=>s+x.product.price_vnd*x.quantity,0),context:()=>context,locked:()=>locked,change:(id,delta)=>cart.set(id,Math.max(0,(cart.get(id)||0)+delta)),checkout:()=>checked++,validate:()=>valid,submit:()=>submitted++});
const say=t=>a.accept(t);
a.open();say('правильно');assert.equal(submitted,0,'cannot confirm before review');
say('я хочу плов, манты, шурпа, айран');assert.equal(cart.get('p'),1);assert.equal(cart.get('m'),1);assert.equal(cart.get('s'),1);assert.equal(cart.has('a5'),false,'ambiguous drink is not guessed');assert.equal(a.dialog.querySelectorAll('.uv-choices button').length,2);
say('правильно');assert.equal(submitted,0,'unresolved ambiguity cannot submit');
// Return to the drink clarification and choose volume verbally.
say('айран');say('пол литра');assert.equal(cart.get('a5'),1);assert.equal(a.dialog.querySelector('.uv-actions button:last-child').hidden,false);
const oldSummary=spoken.at(-1).text;assert.match(oldSummary,/четыреста тысяч вьетнамских донгов/);
context={payment:'qr'};say('правильно');assert.equal(submitted,0,'changing fulfillment or payment invalidates review');say('правильно');assert.equal(submitted,1);assert.equal(checked,1);say('правильно');assert.equal(submitted,1,'closed session ignores duplicate confirmations');
a.open();say('два плова');assert.equal(cart.get('p'),3);cart.set('p',4);say('правильно');assert.equal(submitted,1,'manual cart edits invalidate review');
valid=false;say('правильно');assert.equal(submitted,1,'incomplete checkout never submits');assert.equal(checked,2);
a.open();locked=true;say('добавь плов');assert.equal(cart.get('p'),4);locked=false;
cart=new Map();a.open();say('посоветуй что-нибудь с бараниной');assert.equal(cart.size,0,'recommendations require selection');assert.ok(a.dialog.querySelectorAll('.uv-choices button').length>0);assert.ok(!a.dialog.querySelector('.uv-choices').textContent.includes('Айран'));
a.dialog.querySelector('.uv-actions button').click();const r=recognitions.at(-1);assert.equal(r.lang,'ru-RU');r.onresult({results:[[{transcript:'плов'}]]});assert.equal(cart.get('p'),1);assert.equal(r.aborted,true);const beforeAuto=recognitions.length;spoken.at(-1).onend();assert.equal(recognitions.length,beforeAuto+1,'voice dialog resumes listening after review');
const stale=recognitions.at(-1),callback=stale.onresult;a.dialog.close();callback({results:[[{transcript:'два плова'}]]});assert.equal(cart.get('p'),1,'late results ignored after closing');
a.open();a.dialog.querySelector('.uv-actions button').click();const denied=recognitions.at(-1);denied.onerror({error:'not-allowed'});assert.match(a.dialog.querySelector('.uv-state').textContent,/Разрешите/);
for(const code of ['ru','en','vi','ko','zh','de','fr','th','ms','id','ar','pt']){language=code;w.dispatchEvent(new w.Event('umma-menu:languagechange'));assert.equal(a.dialog.lang,code);assert.ok(a.dialog.querySelector('h2').textContent);}
assert.equal(a.dialog.dir,'ltr');language='ar';w.dispatchEvent(new w.Event('umma-menu:languagechange'));assert.equal(a.dialog.dir,'rtl');
dom.window.close();console.log('PASS voice ordering: multilingual menu parsing, quantities, variants, recommendations, review invalidation, validation, duplicate and stale speech, microphone errors. No live orders.');
// Exercise the real public menu adapter and its existing checkout handler.
const html=readFileSync(new URL('../menu/index.html',import.meta.url),'utf8');
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
// Keep exercising the dormant adapters while both customer entry points omit the script.
for (const page of ['index.html', 'menu/index.html']) {
 const document = new JSDOM(read(page)).window.document;
 assert.ok(!document.querySelector('script[src*="js/cafe/voice-order.js"]'), `${page} keeps voice ordering disabled`);
 document.defaultView.close();
}
let posts=[],lost=false;
const live=new JSDOM(html,{url:'https://example.com/menu/',runScripts:'dangerously',beforeParse(w){
 w.localStorage.setItem('umma-menu-language','ru');w.AbortSignal=AbortSignal;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.eval(read('js/cafe/public-menu-i18n.js'));w.eval(read('js/vendor/qrcode-generator.js'));w.eval(read('js/cafe/public-menu-extras.js'));w.eval(source);
 w.fetch=async(url,options={})=>{if(options.method!=='POST')return new Response(JSON.stringify({ok:true,products:products.map(p=>({...p,stockManaged:true,available:10}))}));const body=JSON.parse(options.body);if(body.action==='status')return new Response(JSON.stringify({ok:true,order:{status:'pending',paymentStatus:'pending'}}));posts.push(body);if(lost)throw Error('Response lost');return new Response(JSON.stringify({ok:true,order:{id:'fixture-order',orderNumber:101,totalVnd:body.items.reduce((s,x)=>s+products.find(p=>p.id===x.productId).price_vnd*x.quantity,0),status:'pending',paymentMethod:'cash',paymentStatus:'pending'}}));};
}});
const tick=()=>new Promise(r=>setTimeout(r,20));await tick();const v=live.window.ummaMenuVoice,d=live.window.document;
assert.ok(v,'real menu loads its adapter');v.open();v.accept('плов, манты, шурпа, айран');assert.equal(posts.length,0);v.accept('0,5 литра');assert.equal(posts.length,0);assert.match(v.dialog.querySelector('.uv-basket').textContent,/400/);v.accept('правильно');await tick();assert.equal(posts.length,1);assert.equal(posts[0].items.length,4);assert.equal(posts[0].items.find(x=>x.productId==='a5').quantity,1);assert.equal(d.getElementById('successNumber').textContent,'Заказ №101');v.accept('правильно');assert.equal(posts.length,1);
d.getElementById('newOrder').click();v.open();v.accept('плов');d.getElementById('orderType').value='delivery';v.accept('правильно');assert.equal(posts.length,1);v.accept('правильно');assert.equal(posts.length,1,'missing delivery adapter never bypassed');assert.equal(d.getElementById('checkout').open,true);
d.getElementById('orderType').value='pickup';v.open();v.accept('проверь заказ');lost=true;v.accept('правильно');await tick();assert.equal(posts.length,2);v.open();v.accept('плов');v.accept('правильно');assert.equal(posts.length,2,'uncertain pending request cannot create another order');d.getElementById('form').requestSubmit();await tick();assert.equal(posts.length,3);assert.equal(posts[1].requestKey,posts[2].requestKey,'retry retains existing checkout request key');live.window.close();
// Main app uses the same assistant against the selected cafe stock and checkout.
const main=new JSDOM(read('index.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),{url:'https://example.com/',runScripts:'outside-only'}),mw=main.window,md=mw.document;
mw.HTMLDialogElement.prototype.showModal=function(){this.open=true;};mw.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new mw.Event('close'));};
mw.Telegram={WebApp:{initData:'fixture-only',initDataUnsafe:{user:{id:1,first_name:'QA'}}}};mw.fetch=async()=>({ok:true,json:async()=>({ok:true,products,inventoryControlEnabled:true,location:{id:'cafe',name:'QA'},inventory:products.map(p=>({product_id:p.id,location_id:'cafe',quantity:p.id==='s'?0:2,reserved_quantity:0,is_available:true}))})});mw.eval(source);mw.eval(read('js/cafe/cafe.js'));md.getElementById('cafePage').hidden=false;await mw.ummaCafe.refreshMenu();assert.ok(mw.ummaCafeVoice);mw.ummaCafeVoice.open();mw.ummaCafeVoice.accept('два плова');assert.match(mw.ummaCafeVoice.dialog.querySelector('.uv-basket').textContent,/× 2/);mw.ummaCafeVoice.accept('добавь плов');assert.match(mw.ummaCafeVoice.dialog.querySelector('.uv-state').textContent,/остаток/);assert.equal(mw.ummaCafeVoice.dialog.querySelector('.uv-actions button:last-child').hidden,true,'stock error prevents ready-to-confirm state');mw.ummaCafeVoice.accept('шурпа');assert.match(mw.ummaCafeVoice.dialog.querySelector('.uv-state').textContent,/Не удалось/);mw.close();
console.log('PASS voice adapters: real guest checkout, 4-item order, chosen drink volume, server receipt, delivery validation, lost-response replay key, mini-app stock and quantity guards.');
