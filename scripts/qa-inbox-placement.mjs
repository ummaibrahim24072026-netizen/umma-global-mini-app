import {JSDOM} from 'jsdom';import {readFileSync,writeFileSync,mkdirSync,cpSync} from 'node:fs';import assert from 'node:assert/strict';
const html=readFileSync('menu/index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');const dom=new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true,url:'https://qa.invalid/menu/'}),w=dom.window,d=w.document;w.HTMLDialogElement.prototype.show=function(){this.open=true;};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;this.dataset.testModal="true";};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
const inbox=d.getElementById('customerMessages');
const trigger=d.getElementById('customerMessagesButton');
w.localStorage.setItem('umma:connect:token:v1','a'.repeat(64));
w.AbortSignal=AbortSignal;
const observedChatRows=new Set();
let notifyChatResize;
w.ResizeObserver=class{
 constructor(callback){notifyChatResize=callback;}
 observe(node){observedChatRows.add(node);}
 disconnect(){observedChatRows.clear();}
};
const staffReplies=[
 {id:'reply-1',direction:'staff',body:'Первый ответ',created_at:'2026-11-07T12:00:00Z'},
 {id:'reply-2',direction:'staff',body:'Второй ответ',created_at:'2026-11-07T12:01:00Z'}
];
const profileClient={name:'Тест',promotions:true,pushEnabled:true};
const senderNames=[];
let hasSubscription=true;
w.Notification={permission:'granted'};
w.PushManager=function(){};
const worker=new w.EventTarget();
worker.getRegistration=async()=>({pushManager:{getSubscription:async()=>hasSubscription?{}:null}});
Object.defineProperty(w.navigator,'serviceWorker',{value:worker});
w.ummaMenuI18n={t:key=>key};
w.eval(readFileSync('js/cafe/public-menu-profile-name.js','utf8'));
w.fetch=async(_url, options)=>{
 const {action,name,promotions,subscription}=JSON.parse(options.body);
 if(action==='preferences'&&typeof name==='string')profileClient.name=name;
 if(action==='preferences'&&typeof promotions==='boolean')profileClient.promotions=promotions;
 if(action==='preferences'&&subscription===null)profileClient.pushEnabled=false;
 if(action==='send')senderNames.push(profileClient.name);
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
await flush();
const chatDialog=d.getElementById('customerChatDialog');
assert.equal(inbox.open,false);
assert.ok(chatDialog.open);
assert.equal(chatDialog.dataset.testModal,undefined);
assert.equal(w.sessionStorage.getItem('umma:chat:open'),'1');
assert.equal(d.querySelector('.umma-connect-chat .connect-settings'),null);
assert.equal(d.querySelector('.connect-settings-toggle'),null);
assert.ok(badge(chat).hidden);
assert.ok(badge(button).hidden, 'Order updates shown in the chat are marked read there.');
assert.ok(badge(trigger).hidden, 'Opening Messages clears both kinds of unread updates.');
assert.equal(badge(trigger).textContent,'');
const inboxStorageKey='umma:order-inbox:v1';
const readInbox=()=>JSON.parse(w.localStorage.getItem(inboxStorageKey));
assert.ok(readInbox().messages.every(message=>message.at<=readInbox().readAt),
 'Read order updates stay cleared after a reload.');
const orderCard=number=>chatDialog.querySelector('.umma-chat-order-card[data-order-id="'+number+'"]');
assert.match(orderCard(52).textContent,/Заказ №52.*Готовится/);
assert.ok(chatDialog.querySelector('textarea'));
let selectedOrder;
w.addEventListener('umma:open-specific-order',event=>{selectedOrder=event.detail.orderId;});
orderCard(52).querySelector('.umma-chat-order-action').click();
assert.equal(selectedOrder,'52');
w.ummaOrderInbox.publish({
 orderNumber:52,status:'ready',eventAt:new Date(readInbox().readAt+1000).toISOString()
});
assert.ok(badge(trigger).hidden, 'Updates displayed in the open chat leave the count cleared.');
assert.match(orderCard(52).textContent,/Заказ готов/);
w.ummaOrderInbox.publish({
 orderNumber:52,status:'completed',eventAt:new Date(readInbox().readAt+1000).toISOString()
});
assert.ok(orderCard(52).classList.contains('umma-chat-order-card--finished'));
const toggle=orderCard(52).querySelector('[aria-expanded=false]');
assert.equal(toggle.textContent,'Показать этапы');
toggle.click();
assert.equal(toggle.textContent,'Скрыть этапы');
const stages=number=>orderCard(number).querySelector('.umma-order-stages');
assert.deepEqual([...stages(52).children].map(row=>row.dataset.stage),['pending','confirmed','preparing','paid','ready','completed']);
assert.ok([...stages(52).children].every(row=>row.dataset.state==='done'));
assert.equal(stages(52).querySelector('[data-stage=confirmed] time'),null,'inferred stages have no fabricated time');
assert.ok(stages(52).querySelector('[data-stage=completed] time'));
w.ummaOrderInbox.publish({orderNumber:53,orderType:'delivery',status:'pending',deliveryStatus:'waiting_courier'});
w.ummaOrderInbox.publish({orderNumber:53,status:'ready',deliveryStatus:'picked_up'});
assert.match(orderCard(53).textContent,/Курьер забрал заказ/);
assert.equal(stages(53).querySelector('[aria-current=step]').dataset.stage,'picked_up');
assert.equal(stages(53).querySelector('[data-stage=delivered]').dataset.state,'upcoming');
assert.equal(stages(52).hidden,false,'a user-expanded card stays open through background updates');
w.ummaOrderInbox.publish({orderNumber:53,status:'ready',deliveryStatus:'delivered'});
assert.ok(orderCard(53).classList.contains('umma-chat-order-card--finished'));
assert.match(orderCard(53).textContent,/Заказ доставлен/);
w.ummaOrderInbox.publish({orderNumber:54,status:'confirmed',paymentStatus:'paid'});
w.ummaOrderInbox.publish({orderNumber:54,status:'cancelled'});
w.ummaOrderInbox.publish({orderNumber:54,status:'cancelled',paymentStatus:'refunded',eventAt:new Date(Date.now()+1000).toISOString()});
assert.match(orderCard(54).textContent,/Заказ отменён/);
orderCard(54).querySelector('.umma-chat-order-toggle').click();
assert.deepEqual([...stages(54).children].map(row=>row.dataset.stage),['pending','confirmed','paid','cancelled','refunded']);
assert.equal(stages(54).querySelector('[data-stage=confirmed]').dataset.state,'done');
assert.equal(stages(54).querySelector('[aria-current=step]').dataset.stage,'cancelled');
const thread=chatDialog.querySelector('.connect-thread');
let scrollHeight=1000,clientHeight=400,scrollTop=0;
Object.defineProperties(thread,{
 scrollHeight:{get:()=>scrollHeight},
 clientHeight:{get:()=>clientHeight},
 scrollTop:{get:()=>scrollTop,set:value=>{scrollTop=Math.max(0,Math.min(value,scrollHeight-clientHeight));}}
});
chatDialog.close();
w.ummaOrderInbox.publish({
 orderNumber:55,status:'pending',eventAt:new Date(readInbox().readAt+1000).toISOString()
});
assert.equal(badge(trigger).textContent,'1','An update arriving after closing Messages has a badge.');
trigger.click();
await flush();
assert.ok(badge(trigger).hidden,'Reopening Messages clears the new update.');
assert.equal(thread.scrollTop,600,'Opening the chat shows the end of the thread.');
const lastCard=orderCard(54);
assert.ok(observedChatRows.has(thread));
assert.ok(observedChatRows.has(lastCard),'Observe cards even when the thread height stays fixed.');
scrollHeight+=110;
notifyChatResize();
assert.equal(thread.scrollTop,710,'A card that grows remains fully in view.');
clientHeight-=60;
notifyChatResize();
assert.equal(thread.scrollTop,770,'A smaller viewport keeps the card above the composer.');
thread.scrollTop=300;
thread.dispatchEvent(new w.Event('scroll'));
scrollHeight+=40;
notifyChatResize();
assert.equal(thread.scrollTop,300,'Resizing respects manual scrolling into chat history.');
thread.scrollTop=scrollHeight;
thread.dispatchEvent(new w.Event('scroll'));
scrollHeight+=40;
notifyChatResize();
assert.equal(thread.scrollTop,850,'Returning to the bottom resumes following the latest card.');
chatDialog.close();
assert.equal(w.sessionStorage.getItem('umma:chat:open'),null);
assert.equal(inbox.open,false);
w.ummaOrderInbox.open();
const notifications=d.querySelector('dialog[data-umma-inbox]');
assert.ok(notifications.open);
assert.ok(notifications.matches('.customer-section'));
assert.equal(notifications.dataset.testModal,undefined);
assert.equal(inbox.inert,true);
assert.equal(d.activeElement.id,'ummaOrderInboxTitle');
assert.ok(badge(button).hidden);
assert.ok(badge(trigger).hidden);
notifications.close();
assert.equal(button.parentElement.id,'orderInboxHost');
assert.equal(inbox.inert,false);
d.getElementById('customerProfile').show();
d.getElementById('openChatSettings').click();
await flush();
const settings=d.getElementById('customerChatSettings');
assert.ok(settings.open);
assert.ok(settings.matches('.customer-section'));
assert.equal(settings.dataset.testModal,undefined);
assert.equal(settings.querySelector('input:not([type=checkbox])'),null);
const promotions=settings.querySelector('input[role=switch]');
assert.equal(promotions.checked,true);
promotions.click();
await flush();
assert.equal(profileClient.promotions,false);
const pushSwitch=settings.querySelector('button[role=switch]');
assert.equal(pushSwitch.getAttribute('aria-checked'),'true');
pushSwitch.click();
await flush();
assert.equal(profileClient.pushEnabled,false);
assert.equal(pushSwitch.getAttribute('aria-checked'),'false');
assert.equal(profileClient.name,'Тест');
settings.close();
profileClient.pushEnabled=true;
hasSubscription=false;
d.getElementById('openChatSettings').click();
await flush();
assert.equal(pushSwitch.getAttribute('aria-checked'),'false','A server preference without this browser subscription must not show as enabled.');
settings.close();
assert.ok(d.getElementById('customerProfile').open);
const name=d.getElementById('profileDisplayName');
name.value='Ибрахим';
name.form.requestSubmit();
d.getElementById('customerProfile').close();
await w.ummaCustomerConnect.open();
const message=chatDialog.querySelector('textarea');
message.value='Тест';
message.form.requestSubmit();
await flush();
assert.deepEqual(senderNames,['Ибрахим']);
name.value='';
name.form.requestSubmit();
message.value='Тест без имени';
message.form.requestSubmit();
await flush();
assert.deepEqual(senderNames,['Ибрахим','']);
chatDialog.close();
const datedThread=d.createElement('ol');
const localTime=(day,hour,minute)=>new Date(2025,10,day,hour,minute).toISOString();
const addDatedMessage=(day,hour,minute,text)=>{
 const row=d.createElement('li');
 row.dataset.createdAt=localTime(day,hour,minute);
 row.textContent=text;
 datedThread.append(row);
};
addDatedMessage(20,23,45,'Перед заказом');
addDatedMessage(21,0,5,'После полуночи');
w.ummaOrderInbox.publish({orderNumber:61,status:'pending',eventAt:localTime(20,23,50)});
w.ummaOrderInbox.publish({orderNumber:62,status:'pending',eventAt:localTime(20,23,55)});
w.ummaOrderInbox.publish({orderNumber:61,status:'completed',eventAt:localTime(21,0,10)});
w.ummaOrderInbox.publish({orderNumber:63,status:'pending',eventAt:localTime(21,0,15)});
for(let refresh=0;refresh<2;refresh++){
 w.ummaOrderInbox.renderChatFeed(datedThread,'61');
 const rows=[...datedThread.children];
 assert.deepEqual(rows.slice(0,7).map(row=>row.matches('.umma-chat-day')?row.firstElementChild.dateTime:row.dataset.orderId||row.textContent),
  ['2025-11-20','Перед заказом','61','62','2025-11-21','После полуночи','63']);
 assert.match(rows[0].textContent,/20 ноября 2025/);
 assert.equal(rows[2].querySelector('[data-stage=pending] time').dateTime,localTime(20,23,50));
}
// Standalone render of the actual header, with no live server requests or order actions.
d.getElementById('menuLanguage').innerHTML='<option>Русский</option>';d.getElementById('products').innerHTML='<div class="message">Готовые блюда появятся после приёма кухни.</div>';
mkdirSync('preview-dist/menu',{recursive:true});writeFileSync('preview-dist/menu/index.html',dom.serialize());cpSync('css','preview-dist/css',{recursive:true});cpSync('logo','preview-dist/logo',{recursive:true});w.close();console.log('PASS inbox: one Messages entry, both counters clear in the chat, and order timelines.');
