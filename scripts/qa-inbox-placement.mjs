import {JSDOM} from 'jsdom';import {readFileSync,writeFileSync,mkdirSync,cpSync} from 'node:fs';import assert from 'node:assert/strict';
const html=readFileSync('menu/index.html','utf8');const dom=new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true,url:'https://qa.invalid/menu/'}),w=dom.window,d=w.document;w.HTMLDialogElement.prototype.show=w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
w.eval(d.getElementById('customer-navigation').textContent);
w.ummaCafeNavigation.restore(false);
const inbox=d.getElementById('customerMessages');
const trigger=d.getElementById('customerMessagesButton');
w.localStorage.setItem('umma:connect:token:v1','a'.repeat(64));
w.AbortSignal=AbortSignal;
const staffReplies=[
 {id:'reply-1',direction:'staff',body:'Первый ответ',created_at:'2026-11-07T12:00:00Z'},
 {id:'reply-2',direction:'staff',body:'Второй ответ',created_at:'2026-11-07T12:01:00Z'}
];
const profileClient={name:'Тест',promotions:true,pushEnabled:true};
w.fetch=async(_url, options)=>{
 const {action,promotions,subscription}=JSON.parse(options.body);
 if(action==='preferences'&&typeof promotions==='boolean')profileClient.promotions=promotions;
 if(action==='preferences'&&subscription===null)profileClient.pushEnabled=false;
 if(action==='read')for(const message of staffReplies)message.read_at='2026-11-07T12:02:00Z';
 return new Response(JSON.stringify({ok:true,client:profileClient,messages:staffReplies}));
};
for(const script of ['order-inbox','connect-media','connect-composer','customer-connect','customer-messages']){
 w.eval(readFileSync('js/cafe/'+script+'.js','utf8'));
}
const button=d.querySelector('#orderInboxHost button');
const chat=d.querySelector('#customerConnectHost button');
const badge=element=>element.querySelector('.messages-unread');
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
await flush();
assert.equal(badge(trigger).textContent,'2');
assert.equal(badge(chat).textContent,'2');
assert.ok(badge(button).hidden);
assert.equal(button.parentElement.id,'orderInboxHost');
assert.equal(button.closest('dialog'),inbox);
assert.equal(trigger.closest('.customer-actions').querySelectorAll('button[aria-controls="customerMessages"]').length,1);
w.ummaOrderInbox.publish({id:'demo',orderNumber:52,status:'pending'});
assert.equal(badge(button).textContent,'1');
assert.equal(badge(trigger).textContent,'3');
w.ummaOrderInbox.publish({id:'demo',orderNumber:52,status:'preparing',paymentStatus:'paid'});
assert.equal(badge(button).textContent,'3');
assert.equal(badge(trigger).textContent,'5');
trigger.click();
assert.ok(inbox.open);
assert.equal(badge(trigger).textContent,'5');
chat.click();
await flush();
assert.ok(d.querySelector('.umma-connect-chat').open);
assert.equal(d.querySelector('.umma-connect-chat .connect-settings'),null);
assert.equal(d.querySelector('.connect-settings-toggle'),null);
assert.ok(badge(chat).hidden);
assert.equal(badge(trigger).textContent,'3');
d.querySelector('.umma-connect-chat .connect-close').click();
await new Promise(resolve=>w.addEventListener('popstate',resolve,{once:true}));
assert.ok(inbox.open);
button.click();
assert.ok(d.querySelector('dialog[data-umma-inbox]').open);
assert.ok(badge(button).hidden);
assert.ok(badge(trigger).hidden);
const list=d.querySelector('.umma-inbox-orders');
assert.equal(list.children.length,1);
assert.equal(list.querySelector('.umma-inbox-number').textContent,'№52');
assert.equal(list.querySelectorAll('.is-done').length,2);
assert.equal(list.querySelector('[aria-current="step"]').textContent,'•Кухня');
w.ummaOrderInbox.publish({orderNumber:52,status:'ready'});
assert.equal(list.querySelectorAll('.is-done').length,4);
w.ummaOrderInbox.publish({orderNumber:52,status:'completed'});
assert.equal(list.querySelectorAll('.is-done').length,5);
w.ummaOrderInbox.publish({orderNumber:53,orderType:'delivery',status:'pending',deliveryStatus:'waiting_courier'});
assert.equal(list.children.length,2);
assert.equal(list.firstElementChild.querySelectorAll('.is-done').length,1);
w.ummaOrderInbox.publish({orderNumber:53,status:'ready',deliveryStatus:'picked_up'});
assert.match(list.firstElementChild.querySelector('[aria-current="step"]').textContent,/В пути/);
w.ummaOrderInbox.publish({orderNumber:53,status:'ready',deliveryStatus:'delivered'});
assert.equal(list.firstElementChild.querySelectorAll('.is-done').length,6);
w.ummaOrderInbox.publish({orderNumber:54,status:'cancelled'});
assert.equal(list.children.length,3);
assert.equal(list.firstElementChild.querySelectorAll('.is-done').length,0);
assert.equal(list.firstElementChild.querySelectorAll('.is-cancelled').length,1);d.querySelector('dialog[data-umma-inbox] [data-customer-back]').click();
await new Promise(resolve=>w.addEventListener('popstate',resolve,{once:true}));
assert.equal(button.parentElement.id,'orderInboxHost');
w.ummaCafeNavigation.go('profile');
d.getElementById('openChatSettings').click();
await flush();
const settings=d.getElementById('customerChatSettings');
assert.ok(settings.open);
const promotions=settings.querySelector('input[type=checkbox]');
assert.equal(promotions.checked,true);
promotions.click();
await flush();
assert.equal(profileClient.promotions,false);
settings.querySelector('.connect-off').click();
await flush();
assert.equal(profileClient.pushEnabled,false);
settings.querySelector('.connect-close').click();
assert.ok(d.getElementById('customerProfile').open);
w.ummaCafeNavigation.go('menu');
// A failed background poll should neither block the timeline nor discard the draft.
const replies=staffReplies;
const testChat={name:'Тест',promotions:false,pushEnabled:false};
const retryQueue=new Map();
let timerId=0, failLists=0, listCalls=0, online=true, dropSend=true;
const sends=[];
let holdHidden;
const originalTimer=w.setTimeout.bind(w),originalClear=w.clearTimeout.bind(w);
w.setTimeout=(callback,delay,...args)=>{
 if(delay===2000||delay===4000){retryQueue.set(--timerId,{callback,delay});return timerId;}
 return originalTimer(callback,delay,...args);
};
w.clearTimeout=id=>id<0?retryQueue.delete(id):originalClear(id);
Object.defineProperty(w.navigator,'onLine',{get:()=>online});
w.fetch=async(url,options)=>{
 const request=JSON.parse(options.body);
 assert.equal(request.token,'a'.repeat(64));
 if(url.endsWith('cafe-connect-actions')){
  assert.equal(request.action,'hidden');
  assert.ok(options.signal);
  await new Promise(resolve=>{holdHidden=resolve;});
  return Response.json({ok:true,ids:[]});
 }
 if(request.action==='list'){
  listCalls++;
  if(failLists-->0)throw new TypeError('Network error');
 }
 if(request.action==='send'){
  sends.push(request);
  if(dropSend){dropSend=false;throw new TypeError('Lost response');}
 }
 return Response.json({ok:true,client:testChat,messages:replies});
};
await w.ummaCustomerConnect.open();
await flush();
const thread=d.querySelector('.connect-thread');
const notice=d.querySelector('.connect-connection-status');
const composer=d.querySelector('.connect-compose');
const draft=composer.querySelector('textarea');
assert.ok(holdHidden,'The secondary request is still pending');
assert.match(thread.textContent,/Первый ответ/,'The conversation loads independently');
draft.value='Сохранённый черновик';
failLists=2;
w.dispatchEvent(new w.Event('online'));
await flush();
assert.equal(notice.textContent,'','A brief polling failure stays silent');
async function fireRetry(delay){
 const [id,task]=[...retryQueue].find(([,entry])=>entry.delay===delay);
 retryQueue.delete(id);
 task.callback();
 await flush();
}
await fireRetry(2000);
assert.match(notice.textContent,/Переподключаем/);
assert.match(thread.textContent,/Первый ответ/);
assert.equal(draft.value,'Сохранённый черновик');
await fireRetry(4000);
assert.equal(notice.textContent,'','A successful retry clears the connection banner');
holdHidden();
await flush();
online=false;
w.dispatchEvent(new w.Event('offline'));
assert.match(notice.textContent,/Нет интернета/);
const before=listCalls;
w.dispatchEvent(new w.Event('pageshow'));
await flush();
assert.equal(listCalls,before);
online=true;
w.dispatchEvent(new w.Event('online'));
await flush();
assert.equal(notice.textContent,'');
const submit=()=>composer.dispatchEvent(new w.Event('submit',{cancelable:true}));
submit();
await flush();
assert.equal(draft.value,'Сохранённый черновик','A lost send response preserves the draft');
submit();
await flush();
assert.equal(draft.value,'');
assert.equal(sends.length,2);
assert.equal(sends[0].requestKey,sends[1].requestKey,'Retry uses the same request ID');
w.ummaCafeNavigation.go('menu');
console.log('PASS chat reconnect: delayed secondary request, automatic backoff, offline/online, preserved thread and draft, idempotent send retry.');
// Standalone render of the actual header, with no live server requests or order actions.
d.getElementById('menuLanguage').innerHTML='<option>Русский</option>';d.getElementById('products').innerHTML='<div class="message">Готовые блюда появятся после приёма кухни.</div>';
mkdirSync('preview-dist/menu',{recursive:true});writeFileSync('preview-dist/menu/index.html',dom.serialize());cpSync('css','preview-dist/css',{recursive:true});cpSync('logo','preview-dist/logo',{recursive:true});w.close();console.log('PASS inbox: one Messages entry, independent unread counts, clear-on-read, and order timelines.');
