import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {paymentFor} from '../supabase/functions/cafe-my-orders/payment.ts';
const read=p=>readFileSync(p,'utf8'),html=read('menu/index.html');
const product={id:'def936dc-6c57-4b06-ac32-cdf6a736c238',sku:'UMMA-CAFE-SHURPA',name_ru:'Шурпа',name_en:'Shurpa',price_vnd:90000};
const item={name_ru:'Шурпа',name_en:'Shurpa',quantity:2,unitPriceVnd:45000,lineTotalVnd:90000};
for(const method of ['cash','qr']){
 let created=0,calls=[],lost=true,paid=false,terminal=null;
 const base={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',orderNumber:98765,totalVnd:90000,paymentMethod:method,paymentStatus:'pending',status:'pending',items:[item]};
 const payment=paymentFor({id:base.id,order_number:98765,total_vnd:90000,location_id:'e22788bd-4734-4b3a-911e-ba103d52617a',payment_method:'qr',payment_status:'pending',currency:'VND',status:'pending'});
 const dom=new JSDOM(html,{url:'https://example.com/menu/',runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){
  w.confirm=()=>assert.fail('Clearing the cart must not ask for browser confirmation');
  w.localStorage.setItem('umma-menu-language','ru');w.AbortSignal=AbortSignal;w.CSS={escape:value=>value};
  w.HTMLDialogElement.prototype.show=function(){this.open=true;};
  w.HTMLDialogElement.prototype.showModal=function(){this.dataset.testModal='true';this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;delete this.dataset.testModal;this.dispatchEvent(new w.Event('close'));};
  w.HTMLCanvasElement.prototype.getContext=()=>({fillRect(){},set fillStyle(v){}});w.HTMLCanvasElement.prototype.toDataURL=()=> 'data:image/png;base64,AA==';
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.eval(read('js/cafe/public-menu-i18n.js'));w.eval(read('js/cafe/product-photo.js'));w.eval(read('js/vendor/qrcode-generator.js'));w.eval(read('js/cafe/public-menu-extras.js'));
  w.fetch=async(url,options)=>{if(!options?.body)return new Response(JSON.stringify({ok:true,products:[product]}));const b=JSON.parse(options.body);calls.push(b);if(b.action==='create'){created++;if(lost){lost=false;throw Error('Simulated lost response');}return new Response(JSON.stringify({ok:true,order:base,payment:method==='qr'?payment:null}));}return new Response(JSON.stringify({ok:true,order:{...base,status:terminal||(paid?'ready':'preparing'),paymentStatus:paid?'paid':'pending',cashReceipt:paid&&method==='cash'?{tenderedVnd:100000,changeVnd:10000}:null},payment:method==='qr'&&!paid?payment:null}));};
 }});
 const w=dom.window,d=w.document;await new Promise(r=>setTimeout(r,20));
 const receiptButton=d.getElementById('receiptButton');
 const cartButton=d.getElementById('openCart'),cartCount=d.getElementById('cartCount');
 assert.equal(d.getElementById('orderBar'),null);
 assert.equal(cartButton.closest('.customer-actions').lastElementChild,cartButton);
 assert.equal(cartCount.hidden,true);
 const profile=d.getElementById('customerProfile');
 d.getElementById('openProfile').click();
 assert.equal(profile.open,true);
 assert.equal(profile.dataset.testModal,undefined);
 assert.ok(profile.matches('.customer-section'));
 assert.equal(d.getElementById('cafePage').inert,true);
 assert.equal(d.activeElement.id,'profileTitle');
 cartButton.click();
 assert.equal(profile.open,false);
 assert.equal(d.getElementById('checkout').open,true);
 assert.equal(d.getElementById('continueCheckout').disabled,true);
 d.getElementById('closeCart').click();
 assert.equal(receiptButton.classList.contains('has-active-orders'),false);
 assert.ok(receiptButton.closest('.customer-actions'));
 assert.equal(receiptButton.closest('.customer-actions'),d.getElementById('customerMessagesButton').closest('.customer-actions'));
 assert.equal(receiptButton.hidden,false);
 assert.equal(receiptButton.closest('nav').children[2].id,'nearbyCafeButton');
 assert.equal(d.getElementById('orderHistoryButton'),null);
 if(method==='cash'){
  w.eval(read('js/cafe/order-inbox.js'));
  w.eval(read('js/cafe/customer-messages.js'));
  const menuTab=d.querySelector('.dock-menu');
  const messagesTab=d.getElementById('customerMessagesButton');
  const worker=new w.EventTarget();
  Object.defineProperty(w.navigator,'serviceWorker',{value:Object.assign(worker,{ready:Promise.resolve(),controller:{postMessage(){}}})});
  w.eval(read('js/cafe/order-alerts.js'));
  const workerMessage=data=>worker.dispatchEvent(new w.MessageEvent('message',{data}));
  workerMessage({type:'UMMA_PUSH_HISTORY',messages:[{order:base}]});
  assert.equal(d.getElementById('customerChatDialog'),null,'background sync keeps the menu open');
  assert.equal(d.getElementById('ummaOrderInboxDialog'),null);
  const orderNumber='267';
  w.history.replaceState(null,'','?messages=1&order='+orderNumber);
  for(const script of ['connect-media','connect-composer','customer-connect'])w.eval(read('js/cafe/'+script+'.js'));
  const orderChat=d.getElementById('customerChatDialog');
  assert.ok(orderChat.open);
  assert.equal(w.location.search,'');
  assert.equal(d.getElementById('ummaOrderInboxDialog'),null);
  assert.equal(messagesTab.getAttribute('aria-expanded'),'true');
  assert.equal(menuTab.hasAttribute('aria-current'),false);
  assert.equal(d.getElementById('cafePage').inert,true);
  // On a cold launch the worker can replay the tapped order only after the chat opens.
  const ready={...base,orderNumber,status:'ready',paymentStatus:'paid'};
  workerMessage({type:'UMMA_PUSH_HISTORY',messages:[{order:ready}]});
  assert.match(orderChat.querySelector('.umma-chat-order-card[data-order-id="267"]').textContent,/Заказ готов/);
  const completed={...ready,status:'completed'};
  const other={...completed,orderNumber:268};
  const pushHistory={type:'UMMA_PUSH_HISTORY',messages:[{order:completed},{order:other}]};
  workerMessage(pushHistory);
  const target=orderChat.querySelector('.umma-chat-order-card[data-order-id="267"]');
  assert.ok(target);
  assert.equal(target.querySelector('.umma-chat-order-toggle').getAttribute('aria-expanded'),'true','the tapped order has its timeline expanded');
  assert.match(target.textContent,/Заказ выдан/);
  assert.ok(orderChat.querySelector('.umma-chat-order-card[data-order-id="268"] [aria-expanded=false]'));
  assert.equal(orderChat.querySelector('.connect-chat-content').hidden,false,'an order can be viewed without an existing support conversation');
  assert.equal(messagesTab.querySelector('.messages-unread').hidden,true);
  menuTab.click();
  workerMessage(pushHistory);
  assert.equal(orderChat.open,false,'history replay must not reopen the chat');
  assert.equal(menuTab.getAttribute('aria-current'),'page');
  receiptButton.click();
  assert.equal(d.getElementById('customerOrders').open,true);
  workerMessage({type:'UMMA_OPEN_INBOX'});
  assert.equal(d.getElementById('customerOrders').open,false);
  assert.equal(orderChat.open,true,'click from a legacy worker still opens the chat');
  assert.equal(d.getElementById('ummaOrderInboxDialog'),null);
  menuTab.click();
  d.getElementById('openProfile').click();
  const openSettings=d.getElementById('openChatSettings');
  const settings=d.getElementById('customerChatSettings');
  openSettings.click();
  assert.ok(settings.open);
  assert.ok(profile.inert);
  assert.equal(d.activeElement.id,'customerChatSettingsTitle');
  settings.close();
  assert.ok(profile.open);
  assert.equal(profile.inert,false);
  assert.equal(d.activeElement,openSettings);
  openSettings.click();
  cartButton.click();
  assert.equal(settings.open,false);
  assert.equal(profile.open,false);
  assert.ok(d.getElementById('checkout').open);
  d.querySelector('.dock-menu').click();
  await w.ummaCustomerConnect.open();
  const chat=d.getElementById('customerChatDialog');
  assert.ok(chat.open);
  assert.equal(chat.dataset.testModal,undefined);
  assert.equal(d.getElementById('customerMessagesButton').getAttribute('aria-expanded'),'true');
  assert.equal(d.getElementById('cafePage').inert,true);
  cartButton.click();
  assert.equal(chat.open,false);
  assert.equal(d.getElementById('checkout').open,true);
  d.querySelector('.dock-menu').click();
 }
 d.querySelector(method==='cash'?'.cafe-product-photo':'.dish-link').click();
 assert.equal(d.getElementById('dishDetails').open,true);
 assert.equal(d.getElementById('dishTitle').textContent,'Шурпа');
 assert.equal(d.getElementById('dishDetails').dataset.testModal,undefined);
 assert.equal(d.getElementById('cafePage').inert,true);
 assert.equal(d.querySelector('#dishDetails .cafe-add').textContent,'В корзину');
 d.querySelector('#dishDetails [data-change="1"]').click();
 assert.equal(d.querySelector('#dishDetails .cafe-card-quantity strong').textContent,'1');
 assert.equal(cartCount.hidden,false);
 assert.equal(cartCount.textContent,'1');
 assert.equal(cartButton.classList.contains('has-items'),true);
 receiptButton.click();
 assert.equal(d.getElementById('dishDetails').open,false);
 assert.equal(d.getElementById('customerOrders').open,true);
 d.querySelector('.dock-menu').click();
 assert.equal(d.getElementById('cafePage').inert,false);
 d.querySelector('.dish-link').click();
 cartButton.click();
 assert.equal(d.getElementById('dishDetails').open,false);
 assert.equal(d.getElementById('cartStep').hidden,false);
 assert.equal(d.getElementById('checkoutStep').hidden,true);
 const clearCart=d.getElementById('clearCart'),feedback=d.getElementById('cartFeedback');
 assert.equal(clearCart.hidden,false);
 clearCart.click();
 assert.equal(cartCount.hidden,true);
 assert.equal(clearCart.hidden,true);
 assert.equal(d.getElementById('continueCheckout').disabled,true);
 assert.equal(feedback.hidden,false);
 assert.equal(d.getElementById('cartFeedbackMessage').textContent,'Корзина очищена');
 d.getElementById('undoClearCart').click();
 assert.equal(cartCount.textContent,'1');
 assert.equal(feedback.hidden,true);
 assert.equal(clearCart.hidden,false);
 d.getElementById('continueCheckout').click();
 assert.equal(d.getElementById('checkoutStep').hidden,false);
 d.getElementById('backToCart').click();
 assert.equal(d.getElementById('cartStep').hidden,false);
 d.getElementById('continueCheckout').click();
 d.querySelector('[name=paymentMethod][value='+method+']').checked=true;
 const submit=()=>d.getElementById('form').dispatchEvent(new w.Event('submit',{cancelable:true}));submit();await new Promise(r=>setTimeout(r,20));assert.ok(d.getElementById('result').textContent.includes('Не удалось'));submit();await new Promise(r=>setTimeout(r,30));
 assert.equal(cartCount.hidden,true);
 assert.equal(d.getElementById('checkoutTitle').textContent,'Оплата заказа');
 assert.equal(d.getElementById('paymentConfirmedMark').hidden,true);
 assert.match(d.getElementById('receiptHint').textContent,method==='cash'?/Назовите сотруднику ваш номер заказа/:/после подтверждения оплаты/);
 assert.equal(created,2);assert.equal(calls[0].requestKey,calls[1].requestKey);assert.equal(calls[0].paymentMethod,method);assert.equal(d.getElementById('success').hidden,false);assert.equal(d.getElementById('guestPayment').hidden,method!=='qr');assert.ok(d.getElementById('paymentState').textContent.includes(method==='qr'?'QR':'наличными'));
 const receiptLines=d.getElementById('receiptDetails');
 assert.equal(receiptLines.hidden,false);
 assert.match(receiptLines.textContent,/Шурпа2 × 45\D?000.*90\D?000/);
 assert.equal(d.getElementById('receiptCash').hidden,true);
 if(method==='qr'){
  const bank=d.getElementById('paymentBank');
  const qr=d.getElementById('guestPaymentQr');
  const appLink=d.getElementById('openBank');
  const launches=[];
  appLink.addEventListener('click',event=>{
   event.preventDefault();
   launches.push(new URL(appLink.href));
  });
  assert.equal(bank.value,'vcb');
  assert.equal(qr.hidden,false);
  assert.equal(appLink.hidden,true);
  assert.ok(d.getElementById('paymentQr').src.startsWith('data:image/png'));
  assert.doesNotMatch(d.getElementById('guestPayment').textContent,/Можно оплатить переводом по реквизитам выше/);
  const appIds=['mb','bidv','acb','ocb','icb'];
  assert.deepEqual(Array.from(bank.options,option=>option.value),['vcb',...appIds]);
  for(const app of appIds){
   bank.value=app;
   bank.dispatchEvent(new w.Event('change'));
   assert.equal(qr.hidden,true);
   assert.equal(appLink.hidden,false);
   const url=launches.at(-1);
   assert.equal(url.origin+url.pathname,'https://dl.vietqr.io/pay');
   assert.equal(url.searchParams.get('app'),app);
   assert.equal(url.searchParams.get('am'),'90000');
   assert.equal(url.searchParams.get('ba'),'1062679069@vcb');
   assert.equal(url.searchParams.get('tn'),'UMMA 98765');
  }
  w.ummaMenuI18n.setLanguage('en');
  assert.equal(launches.length,appIds.length);
  assert.equal(qr.hidden,true);
  w.ummaMenuI18n.setLanguage('ru');
  bank.value='vcb';
  bank.dispatchEvent(new w.Event('change'));
  assert.equal(qr.hidden,false);
  assert.equal(appLink.hidden,true);
  assert.equal(launches.length,appIds.length);
  assert.equal(d.getElementById('attachGuestTransferProof').hidden,false);
 }
 for(const code of Object.keys(w.ummaMenuI18n.languages)){w.ummaMenuI18n.setLanguage(code);for(const key of ['Язык','На главный экран','Способ оплаты','Наличные','По QR-коду','Ваш банк','Открыть банк','Сохранить QR','Ожидаем оплату по QR','Получено наличными','Сдача','Стоимость блюд','Стоимость доставки','Скидка'])if(code!=='ru')assert.ok(!/[А-Яа-яЁё]/.test(w.ummaMenuI18n.t(key)),code+': '+key);}
 w.ummaMenuI18n.setLanguage('ru');paid=true;d.dispatchEvent(new w.Event('visibilitychange'));await new Promise(r=>setTimeout(r,20));assert.equal(d.getElementById('paymentState').textContent,'Оплачено');assert.equal(d.getElementById('guestPayment').hidden,true);assert.equal(d.getElementById('orderState').textContent,'Заказ готов');assert.equal(calls.filter(x=>/paid|confirm/.test(x.action)).length,0);assert.ok(JSON.parse(w.sessionStorage.getItem('umma-menu-receipt')).requestKey);
 assert.equal(d.getElementById('checkoutTitle').textContent,'Ваш заказ');
 assert.equal(d.getElementById('paymentConfirmedMark').hidden,false);
 assert.equal(d.getElementById('receiptCash').hidden,method!=='cash');
 if(method==='cash'){
  assert.match(d.getElementById('receiptTendered').textContent,/100\D?000/);
  assert.match(d.getElementById('receiptChange').textContent,/10\D?000/);
  assert.equal(JSON.parse(w.localStorage.getItem('umma-menu-receipt')).cashReceipt.changeVnd,10000);
 }
 terminal=method==='cash'?'completed':'cancelled';
 assert.equal(receiptButton.classList.contains('has-active-orders'),true);
 assert.equal(receiptButton.textContent,'Заказы');
 d.getElementById('newOrder').click();
 receiptButton.click();
 assert.equal(d.getElementById('activeOrdersList').hidden,false);
 assert.match(d.getElementById('activeOrdersList').textContent,/Заказ готов/);
 d.querySelector('#activeOrdersList button').click();
 assert.equal(d.getElementById('checkout').open,true);
 assert.match(d.getElementById('successNumber').textContent,/98765/);
 d.dispatchEvent(new w.Event('visibilitychange'));
 await new Promise(r=>setTimeout(r,20));
 assert.equal(receiptButton.classList.contains('has-active-orders'),false);
 assert.equal(receiptButton.textContent,'Заказы');
 assert.equal(JSON.parse(w.localStorage.getItem('umma-menu-receipts'))[0].status,terminal);
 d.getElementById('newOrder').click();
 receiptButton.click();
 assert.equal(d.getElementById('orderHistoryList').hidden,false);
 d.getElementById('showActiveOrders').click();
 assert.equal(d.getElementById('activeOrdersList').hidden,false);
 d.getElementById('showOrderHistory').click();
 assert.match(d.getElementById('orderHistoryList').textContent,method==='cash'?/Заказ выдан/:/Заказ отменён/);
 d.querySelector('#orderHistoryList button').click();
 assert.equal(d.getElementById('success').hidden,false);
 assert.equal(d.getElementById('guestPayment').hidden,true);
 assert.match(d.getElementById('receiptDetails').textContent,/Шурпа/);
 d.getElementById('newOrder').click();
 w.eval(`saveReceipt({id:'active-1',orderNumber:101,status:'ready',totalVnd:90000});
 saveReceipt({id:'active-2',orderNumber:102,status:'pending',totalVnd:120000});
 renderReceiptLinks();`);
 receiptButton.click();
 assert.equal(d.getElementById('customerOrders').open,true);
 assert.equal(receiptButton.getAttribute('aria-expanded'),'true');
 assert.equal(d.getElementById('cafePage').inert,true);
 cartButton.click();
 assert.equal(d.getElementById('customerOrders').open,false);
 assert.equal(receiptButton.getAttribute('aria-expanded'),'false');
 assert.equal(d.getElementById('checkout').open,true);
 assert.equal(cartButton.getAttribute('aria-expanded'),'true');
 const menuButton=d.querySelector('.dock-menu');
 menuButton.click();
 assert.equal(d.getElementById('checkout').open,false);
 assert.equal(menuButton.getAttribute('aria-current'),'page');
 assert.equal(d.getElementById('cafePage').inert,false);
 receiptButton.click();
 const activeOrders=d.querySelectorAll('#activeOrdersList button');
 assert.equal(activeOrders.length,2);
 assert.match(activeOrders[0].textContent,/102/);
 activeOrders[1].click();
 assert.equal(d.getElementById('customerOrders').open,false);
 assert.match(d.getElementById('successNumber').textContent,/101/);
 d.getElementById('newOrder').click();d.getElementById('installApp').click();assert.equal(d.getElementById('installHelp').hidden,false);dom.window.close();
}
console.log('PASS public guest cash/QR: retry key, method, bank/amount/reference, local QR, 12-language labels, live preparation/payment status, receipt recovery and install guidance.');
{
 const dom=new JSDOM(html,{url:'https://example.com/menu/',runScripts:'outside-only'});
 const w=dom.window,d=w.document,$=id=>d.getElementById(id);
 w.HTMLDialogElement.prototype.show=w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.eval(read('js/cafe/public-menu-i18n.js'));
 let hints=[],center,fail=false,geolocationCalls=0;
 const map={setView(point){center=Array.from(point);return this;},invalidateSize(){}};
 w.ummaPublicDelivery={loadMapLibrary:async()=>{if(fail)throw Error('map offline');}};
 w.UmmaMaps={basemap(){}};
 w.L={map:()=>map,layerGroup:()=>({addTo(){return this;},clearLayers(){hints=[];}}),
  icon:options=>options,
  marker:(point,{title,alt,icon})=>({bindTooltip(){return this;},on(_,callback){hints.push({title,alt,icon,callback});return this;},addTo(){}}),
  latLng:latitude=>({distanceTo:point=>Math.abs(point[0]-latitude)})};
 Object.defineProperty(w.navigator,'geolocation',{value:{getCurrentPosition(success){
  geolocationCalls++;success({coords:{latitude:13,longitude:109}});
 }}});
 w.ummaCafeNavigation={open:id=>$($(id).getAttribute('aria-controls')).show()};
 w.eval(read('js/cafe/public-menu-nearby.js'));
 const point=()=>new URL($('nearbyCafeRoute').href).searchParams.get('destination');
 assert.equal(point(),'12.2814294,109.2020884');
 fail=true;
 $('nearbyCafeButton').click();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal($('nearbyCafeMap').hidden,true);
 assert.equal(point(),'12.2814294,109.2020884');
 $('closeNearbyCafe').click();
 fail=false;
 $('nearbyCafeButton').click();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal($('nearbyCafeMap').hidden,false);
 assert.deepEqual(center,[12.2814294,109.2020884]);
 assert.equal(hints[0].icon.iconUrl,'logo/assets/umma-icon-192.png');
 assert.deepEqual(Array.from(hints[0].icon.iconSize),[40,40]);
 assert.deepEqual(Array.from(hints[0].icon.iconAnchor),[20,20]);
 assert.equal(hints[0].alt,'Halal UMMA Nha Trang');
 assert.equal($('findNearestCafe').hidden,true);
 assert.equal(geolocationCalls,0);
 w.ummaNearbyCafe.setLocations([
  {id:'north',name:'North UMMA',address:'North cafe',latitude:13,longitude:109},
  {id:'south',name:'South UMMA',address:'South cafe',latitude:12,longitude:109}
 ],'south');
 assert.equal(point(),'12,109');
 assert.equal($('findNearestCafe').hidden,false);
 $('findNearestCafe').click();
 assert.equal(point(),'13,109');
 assert.equal($('nearbyCafeName').textContent,'North UMMA');
 hints.find(marker=>marker.title==='South UMMA').callback();
 assert.equal(point(),'12,109');
 assert.equal(geolocationCalls,1);
 dom.window.close();
}
console.log('PASS nearby cafes: offline directions, cafe marker, primary cafe, explicit geolocation and nearest cafe selection.');
{
 const dom=new JSDOM(html,{url:'https://example.com/menu/',runScripts:'outside-only'});
 const w=dom.window,$=id=>w.document.getElementById(id);
 const copied=[];
 Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async text=>copied.push(text)}});
 w.fetch=async()=>new Response(JSON.stringify({ok:true,proofs:[]}));
 w.eval(read('js/cafe/public-menu-i18n.js'));
 w.ummaMenuI18n.setLanguage('ru');
 w.eval(read('js/cafe/public-menu-extras.js'));
 const ctx={t:w.ummaMenuI18n.t,money:String,API:'/api/',activeReceipts:()=>[]};
 const kaspi={id:'kaspi-order',requestKey:'kaspi-test-key',status:'pending',paymentStatus:'pending',
  paymentMethod:'bank_transfer',totalVnd:150000,
  payment:{currency:'KZT',amount:2850,bankName:'Kaspi',recipient:'Test recipient',account:'+77000000000'}};
 w.ummaGuestExtras.receipt(kaspi,ctx);
 assert.equal($('numberTransfer').hidden,false);
 assert.equal($('guestForeignPayment').hidden,true);
 assert.equal($('transferBank').textContent,'Kaspi');
 assert.match($('transferAmount').textContent,/₸/);
 assert.equal($('transferNumber').textContent,kaspi.payment.account);
 assert.equal($('rubleBankLinks').hidden,true);
 assert.equal($('transferRateRow').hidden,true);
 assert.equal($('guestTransferProof').hidden,false);
 assert.equal($('copyTransferNumber').hidden,false);
 await $('copyTransferNumber').onclick();
 assert.deepEqual(copied,[kaspi.payment.account]);
 assert.equal($('transferCopyStatus').textContent,'Номер скопирован');

 const sber={...kaspi,id:'sber-order',payment:{currency:'RUB',kopecks:47618,rate:315,
  bankName:'Сбер',recipient:'Test recipient',phone:'+79000000000'}};
 w.ummaGuestExtras.receipt(sber,ctx);
 assert.equal($('transferCopyStatus').textContent,'');
 assert.equal($('rubleBankLinks').hidden,false);
 assert.equal($('transferRateRow').hidden,false);
 await $('copyTransferNumber').onclick();
 assert.deepEqual(copied,[kaspi.payment.account,sber.payment.phone]);
 const bankLinks=$('rubleBankLinks').querySelectorAll('a');
 assert.deepEqual(Array.from(bankLinks,link=>link.textContent),['Сбер','Т-Банк','Альфа-Банк','ВТБ']);
 $('rubleBankLinks').onclick({target:bankLinks[0]});
 assert.equal(copied.at(-1),sber.payment.phone);

 const usdt={...kaspi,id:'usdt-order',payment:{currency:'USDT',amount:5.123456,bankName:'USDT',
  network:'TRC20',account:'TTestWalletUpperAndLowerCase12345'}};
 w.ummaGuestExtras.receipt(usdt,ctx);
 assert.equal($('numberTransfer').hidden,false);
 assert.equal($('guestForeignPayment').hidden,true);
 assert.equal($('transferBankRow').hidden,true);
 assert.equal($('transferRateRow').hidden,true);
 assert.equal($('transferNetworkRow').hidden,false);
 assert.equal($('transferNetwork').textContent,'TRC20');
 assert.match($('transferAmount').textContent,/5,123456 USDT/);
 assert.equal($('transferNumber').textContent,usdt.payment.account);
 assert.equal($('copyTransferNumber').textContent,'Скопировать адрес');
 assert.equal($('rubleBankLinks').hidden,true);
 assert.equal($('guestTransferProof').hidden,false);
 await $('copyTransferNumber').onclick();
 assert.equal(copied.at(-1),usdt.payment.account);
 assert.equal($('transferCopyStatus').textContent,'Адрес скопирован');
 w.ummaGuestExtras.receipt(kaspi,ctx);
 assert.equal($('transferNetworkRow').hidden,true);
 assert.equal($('copyTransferNumber').textContent,'Скопировать только номер');

 w.ummaGuestExtras.receipt({...usdt,paymentStatus:'paid'},ctx);
 assert.equal($('numberTransfer').hidden,true);
 assert.equal($('guestTransferProof').hidden,true);
 dom.window.close();
}
console.log('PASS Kaspi, RUB bank shortcuts and USDT payment receipts: shared layout, exact number copying, proof attachment, and paid-state cleanup.');
const {stripTypeScriptTypes}=await import('node:module');
const vm=await import('node:vm');
{
 const now=Date.parse('2026-11-22T04:20:00Z');
 const html=(stamp)=>'United States Dollar / Vietnamese dong</div>'
  +'<span jsname="Pdsbrc" class=""><span>25,801.5244</span></span>'
  +'<div>'+stamp+'</div>';
 for(const fresh of [true,false]){
  const requests=[];
  const rates=vm.runInNewContext(stripTypeScriptTypes(read('supabase/functions/cafe-guest-order/ruble-rate.ts')
   .replace(/^export /gm,''))+';({googleCashQuote})',{
   Date:class extends Date{static now(){return now;}},
   AbortSignal,
   fetch:async url=>{
    requests.push(url);
    const stamp=fresh&&url.endsWith('?hl=en')?'Nov 22, 4:15:00\u202fAM UTC':'Nov 20, 10:00:00\u202fPM UTC';
    return new Response(html(stamp));
   },
  });
  const quote=await rates.googleCashQuote('USD');
  if(fresh){
   assert.equal(quote.currency,'USD');
   assert.equal(quote.vndPerUnit,25801.5244);
   assert.equal(quote.quotedAt,'2026-11-22T04:15:00.000Z');
   assert.equal(await rates.googleCashQuote('USD').then(value=>value.vndPerUnit),25801.5244);
  }else assert.equal(quote,null);
  assert.deepEqual(requests,[
   'https://www.google.com/finance/beta/quote/USD-VND',
   'https://www.google.com/finance/beta/quote/USD-VND?hl=en',
  ]);
 }
}
console.log('PASS USD cash rate: Google Finance fallback, cache reuse and stale quote rejection.');
// Exercise the deployed handler code: guest capabilities, server totals and payment scope.
const {webcrypto}=await import('node:crypto');
let handler,rpcCalls=[],allowStatus=true,receiptReads=0,storedMethod='qr',storedStatus='pending';
const receiptQuery={
 select(){return this;},
 eq(field,value){if(field==='id')assert.equal(value,order.id);return this;},
 order(){return this;},limit(){return this;},
 async maybeSingle(){return {data:{
  subtotal_vnd:90000,delivery_fee_vnd:0,discount_vnd:0,total_vnd:90000,payment_method:storedMethod,payment_status:storedStatus,status:'pending',
  cafe_order_items:[{product_name_ru:item.name_ru,product_name_en:item.name_en,quantity:2,unit_price_vnd:45000,line_total_vnd:90000}],
  cafe_payment_receipts:[{tendered_amount_vnd:90000,change_given_vnd:0,internal_note:'private'}],
 }};},
};
const order={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',orderNumber:10,totalVnd:90000,paymentMethod:'qr',paymentStatus:'pending',status:'pending'};
const db={from(table){assert.equal(table,'cafe_orders');receiptReads++;return receiptQuery;},rpc:async(name,args)=>{rpcCalls.push({name,args});return name==='cafe_guest_order_status'?allowStatus?{data:{ok:true,order:{...order,location_id:'e22788bd-4734-4b3a-911e-ba103d52617a',payment_method:'qr',payment_status:'pending',currency:'VND'}}}:{error:{message:'denied'}}:{data:{ok:true,order:{...order,paymentMethod:args.p_payment_method}}};}};
vm.runInNewContext(stripTypeScriptTypes(read('supabase/functions/cafe-guest-order/index.ts').replace(/^import .*;\n/gm,'')),{Deno:{serve:fn=>handler=fn,env:{get:()=> 'synthetic-test'}},createClient:()=>db,paymentFor,crypto:webcrypto,TextEncoder,URL,Response,console});
const payload={action:'create',requestKey:'12345678-1234-4123-8123-123456789abc',locationId:'e22788bd-4734-4b3a-911e-ba103d52617a',items:[{productId:product.id,quantity:1}],paymentMethod:'qr',amount:1,account:'wrong',paymentStatus:'paid'};
const req=b=>handler(new Request('https://qa.invalid',{method:'POST',body:JSON.stringify(b)}));
let response=await req(payload),body=await response.json();assert.equal(response.status,201);assert.equal(body.payment.amount,90000);assert.equal(body.payment.account,'1062679069');assert.equal(body.order.paymentStatus,'pending');assert.equal(body.order.cashReceipt,null);assert.deepEqual(body.order.items,[item]);assert.equal(rpcCalls[0].name,'submit_cafe_guest_order_v3');assert.equal(rpcCalls[0].args.p_payment_method,'qr');
response=await req({...payload,paymentMethod:'card'});assert.equal(response.status,400);assert.equal(rpcCalls.length,1);
storedMethod='cash';response=await req({...payload,paymentMethod:'cash'});body=await response.json();assert.equal(body.payment,null);
storedMethod='qr';response=await req({action:'status',requestKey:payload.requestKey,orderId:order.id});body=await response.json();assert.equal(response.status,200);assert.equal(body.payment.amount,90000);assert.equal(body.order.location_id,undefined);
storedMethod='cash';storedStatus='paid';
response=await req({action:'status',requestKey:payload.requestKey,orderId:order.id});
body=await response.json();assert.deepEqual(body.order.cashReceipt,{tenderedVnd:90000,changeVnd:0});assert.equal(body.payment,null);
const readsBeforeDenial=receiptReads;
allowStatus=false;response=await req({action:'status',requestKey:payload.requestKey,orderId:order.id});assert.equal(response.status,404);assert.equal(receiptReads,readsBeforeDenial);assert.equal((await response.json()).payment,undefined);
console.log('PASS guest endpoint: server-only amount/account/status, cash compatibility, bank method validation, receipt capability and private-field omission.');
