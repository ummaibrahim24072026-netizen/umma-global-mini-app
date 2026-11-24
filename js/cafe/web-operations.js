/* POS and account control for the standalone web staff app. Server prices are authoritative. */
(()=>{'use strict';const $=id=>document.getElementById(id),base='https://zwzojugspldexyyljwpr.supabase.co/functions/v1/',auth=window.ummaStaffAuth;
const money=v=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(Number(v)||0),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let catalog=null,catalogLocation='',me=null,products=[],inventory=[],stockControl=false,cart=new Map(),busy=false,installPrompt=null,currentTab='';
const requested=new URLSearchParams(location.search).get('work');
const invite=new URLSearchParams(location.hash.slice(1)).get('invite');
if(requested==='stock'){
 document.title='UMMA · Склад';
 $('loginTitle').textContent='Вход на склад';
 $('loginHint').textContent='Закупки и остатки ингредиентов кафе.';
}
if(invite){$('webExistingLogin').hidden=false;$('loginTitle').textContent='Создайте веб-доступ';$('loginHint').textContent='Укажите email или придумайте логин и пароль. После этого входите на кухню, в кассу или доставку напрямую из браузера.';$('webLoginSubmit').textContent='Создать доступ';$('webPassword').autocomplete='new-password';}
function notice(s){$('webNotice').textContent=s;}
async function api(action,extra={},endpoint='cafe-web'){const response=await fetch(base+endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,initData:auth.credential(),...extra}),cache:'no-store',signal:AbortSignal.timeout(20000)});const data=await response.json();if(!response.ok||!data.ok){const e=Error(data.error||'Нет связи с кафе');e.status=response.status;throw e;}return data;}
const screenKey=()=> 'umma:pos-screen:'+auth.actorId()+':'+$('posLocation').value;
function screen(){try{return JSON.parse(localStorage.getItem(screenKey())||'null');}catch{return null;}}
function showPair(value){$('screenLayout').value=value?.layout||'auto';$('screenLanguageSetting').value=value?.language||'ru';$('screenUnpair').hidden=!value;$('screenPairLink').hidden=!value;$('screenPairQr').replaceChildren();if(!value)return;const url=new URL('payment-screen.html',location.href);url.hash=new URLSearchParams({screen:value.token});$('screenPairLink').href=url.href;drawQr($('screenPairQr'),url.href);$('screenPairState').textContent='Откройте эту ссылку на планшете или отсканируйте QR. Экран привязан к выбранному кафе.';}
function drawQr(root,payload){const qr=qrcode(0,'M');qr.addData(payload);qr.make();root.innerHTML=qr.createSvgTag({cellSize:5,margin:20,scalable:true});}
let screenTimer,screenRevision=0;
const publishedScreens=new Map();
function screenSnapshot(){
 if(currentTab!=='pos')return null;
 const received=Number($('posCash').value);
 const cashReceived=counterView==='payment'&&!switchingPayment&&paymentMethod()==='cash'&&
  $('posCash').value!==''&&Number.isSafeInteger(received)&&received>=0&&received<=2147483647?received:null;
 if(payOrder&&(counterView==='payment'||!cart.size))return {
  orderId:payOrder.id,cashReceived:payOrder.paymentStatus==='pending'?cashReceived:null,
 };
 if(cart.size)return {
  lines:[...cart.values()].map(({product,quantity})=>({
   name:String(product.name_ru||product.name_en||product.name_vi||'Блюдо').slice(0,160),
   name_ru:String(product.name_ru||'').slice(0,160),name_en:String(product.name_en||'').slice(0,160),name_vi:String(product.name_vi||'').slice(0,160),
   quantity,unitPrice:Number(product.price_vnd),
   sku:product.sku,image_url:product.image_url,
  })),
  method:counterView==='payment'?selectedMethod:null,cashReceived,
 };
 return null;
}
async function publishScreen(client,snapshot,force=false){
 const previous=publishedScreens.get(client.id);
 const key=JSON.stringify(snapshot);
 if(!force&&(previous===key||(!snapshot&&previous===undefined)))return;
 publishedScreens.set(client.id,key);
 screenRevision=Math.max(Date.now()*1000,screenRevision+1);
 const request=snapshot?.orderId?{action:'screenSelect',body:snapshot}:{action:'screenDraft',body:snapshot||{lines:[],method:null}};
 try{
  await api(request.action,{screenId:client.id,revision:screenRevision,...request.body});
  if(screen()?.id===client.id&&$('screenPairState').dataset.syncError){
   delete $('screenPairState').dataset.syncError;
   $('screenPairState').textContent='Клиентский экран подключён.';
  }
 }catch(error){
  if(publishedScreens.get(client.id)===key)publishedScreens.delete(client.id);
  throw error;
 }
}
function syncCustomerScreen(clear=false){
 clearTimeout(screenTimer);
 const client=screen();
 if(!client)return;
 screenTimer=setTimeout(()=>{
  if(screen()?.id!==client.id||currentTab!=='pos')return;
  const snapshot=screenSnapshot();
  void publishScreen(client,snapshot,clear&&!snapshot).catch(()=>{
   $('screenPairState').dataset.syncError='true';
   $('screenPairState').textContent='Не удалось обновить клиентский экран. Повторим после восстановления связи.';
  });
 },100);
}
async function displayOrder(orderId){
 const client=screen();
 if(!client)throw Error('Подключите клиентский планшет.');
 const snapshot=screenSnapshot();
 await publishScreen(client,snapshot?.orderId===orderId?snapshot:{orderId},true);
}
async function loadAvailability(){
 const id=$('posLocation').value;
 if(!me?.locations?.find(l=>l.id===id)?.ready_stock_enabled){catalog=null;catalogLocation='';return;}
 const r=await fetch(base+'cafe-guest-order?catalog=1&location='+encodeURIComponent(id),{cache:'no-store',signal:AbortSignal.timeout(12000)}),d=await r.json();
 if(!r.ok||!d.ok||!Array.isArray(d.products))throw Error('Не удалось обновить наличие и план готовки');
 if(id!==$('posLocation').value)return;
 catalog=new Map(d.products.map(p=>[p.id,p]));catalogLocation=id;
}
function available(){
 const id=$('posLocation').value,ready=me?.locations?.find(l=>l.id===id)?.ready_stock_enabled===true;
 return products.map(p=>{
  const i=inventory.find(i=>i.location_id===id&&i.product_id===p.id),c=catalogLocation===id?catalog?.get(p.id):null;
  const quantity=ready?(!i?.ready_stock_confirmed||i.ready_stock_state!=='ready'||i.is_available===false?0:Math.max(0,Number(i.quantity)-Number(i.reserved_quantity||0))):stockControl?(i?.is_available===false?0:Math.max(0,Number(i?.quantity||0)-Number(i?.reserved_quantity||0))):99;
  return {...p,price_vnd:!ready&&stockControl&&i?.price_vnd!=null?Number(i.price_vnd):Number(p.price_vnd),stockManaged:ready||stockControl,available:c?Math.max(0,Number(c.available)||0):quantity,plannedQuantity:c?.plannedQuantity||0,plannedAvailable:Math.max(0,Number(c?.plannedAvailable)||0),plannedReadyAt:c?.plannedReadyAt,planRevision:c?.planRevision};
 });
}
function stockLabel(p){
 const ready=p.stockManaged?'<small class="pos-stock-ready">В наличии: '+p.available+'</small>':'';
 const planned=p.planRevision&&p.plannedQuantity>0&&Number.isFinite(Date.parse(p.plannedReadyAt));
 const time=planned?new Intl.DateTimeFormat('ru-RU',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(p.plannedReadyAt)):'';
 return '<div class="pos-stock-info">'+ready+(planned?'<small class="pos-stock-plan">Следующая партия: '+p.plannedAvailable+' · '+esc(time)+' · время Нячанга</small>':'')+'</div>';
}
let lastMenuMarkup;
function menu(){
  const query=$('posSearch').value.trim().toLocaleLowerCase();
  const cards=available().filter(p=>p.available>0||p.planRevision&&p.plannedQuantity>0&&Number.isFinite(Date.parse(p.plannedReadyAt))).filter(p=>[p.name_ru,p.name_vi,p.name_en,p.description_ru,p.description_vi,p.description_en,p.ingredients_ru].join(' ').toLocaleLowerCase().includes(query)).map(p=>{
    const photo=window.ummaCafeProductPhoto?.(p);
    const description=p.description_ru||p.description_en||p.description_vi;
    const details=[description,p.ingredients_ru].filter(Boolean).join('\n');
    const name=p.name_ru||p.name_en||p.name_vi;
    return '<article class="pos-product" data-pos-product="'+esc(p.id)+'">'+
      '<span class="pos-product-media">'+
      (photo?'<img src="'+esc(photo)+'" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">':'')+
      '<span class="pos-product-no-photo">Фото пока нет</span></span>'+
      '<strong>'+esc(name)+'</strong>'+
      (details?'<details class="pos-product-description"><summary>Состав и описание</summary><p>'+esc(details)+'</p></details>':'')+
      stockLabel(p)+'<div class="pos-product-bottom"><b>'+money(p.price_vnd)+'</b>'+
      '<div class="pos-product-quantity"><button type="button" data-pos-remove="'+esc(p.id)+'" aria-label="Убрать '+esc(name)+'" hidden>−</button>'+
      '<b data-pos-count hidden></b><button type="button" class="primary pos-product-add" data-pos-add="'+esc(p.id)+'"'+(p.available<=0?' disabled':'')+
      ' aria-label="Добавить '+esc(name)+'">+</button></div></div></article>';
  });
  const markup=cards.join('')||(query?'<p>По этому запросу ничего нет.</p>':'<p>Сейчас нет блюд, доступных для продажи.</p>');
  if(markup!==lastMenuMarkup){
    const expanded=new Set(Array.from($('posProducts').querySelectorAll('details[open]'),node=>node.closest('[data-pos-product]').dataset.posProduct));
    $('posProducts').innerHTML=markup;
    for(const card of $('posProducts').querySelectorAll('[data-pos-product]')){
     if(expanded.has(card.dataset.posProduct)&&card.querySelector('details'))card.querySelector('details').open=true;
    }
    lastMenuMarkup=markup;
    renderProductCounts();
  }
}
$('posProducts').addEventListener('error',event=>{
  if(event.target.matches('.pos-product-media img'))event.target.hidden=true;
},true);
const amount=()=>[...cart.values()].reduce((sum,line)=>sum+line.quantity*line.product.price_vnd,0);
const cartItems=()=>[...cart.values()].map(({product,quantity})=>({product_name_ru:product.name_ru||product.name_en||product.name_vi,quantity}));
const itemsMarkup=items=>'<ul>'+items.map(item=>'<li>'+esc(item.product_name_ru)+' × '+esc(item.quantity)+'</li>').join('')+'</ul>';
const electronicPayment=method=>['qr','bank_transfer'].includes(method);
const closedOrder=order=>['completed','cancelled'].includes(order.status);
const counterCanIssue = order => ["manager", "cashier", "waiter"].includes(order.staffRole) ||
 (order.staffRole === "kitchen" && order.canAcceptPayments === true);
const readyToIssue = order => order.payment_status === "paid" && !order.preorder_waiting && order.status === "ready";
const canIssue = order => counterCanIssue(order) && order.order_type !== "delivery" && (readyToIssue(order) ||
 (order.payment_status === "paid" && !order.preorder_waiting && ["pending", "confirmed", "preparing"].includes(order.status) &&
  (order.status !== "preparing" || !order.accepted_by_telegram_id ||
   String(order.accepted_by_telegram_id) === String(auth.actorId()))));
const readyForCounterPickup=order=>readyToIssue(order)&&canIssue(order);
const cashOnDelivery=order=>order.order_type==='delivery'&&order.payment_method==='cash'&&
 order.payment_timing==='on_delivery'&&order.requires_prepayment!==true;
const canPrepareCounterOrder=order=>order.payment_status==='paid'||order.payment_status==='pending'&&cashOnDelivery(order);
const readyForCourier=order=>order.order_type==='delivery'&&order.status==='ready'&&!order.preorder_waiting&&
 !['picked_up','delivered'].includes(order.delivery_status)&&canPrepareCounterOrder(order);
const counterOrderReady=order=>readyForCounterPickup(order)||readyForCourier(order);
const canTakePayment=order=>order.canAcceptPayments===true&&order.payment_status==='pending'&&!closedOrder(order);
const needsCounterPayment=order=>canTakePayment(order)&&order.payment_timing!=='on_delivery'&&
 ['cash','qr','bank_transfer'].includes(order.payment_method);
const newCounterOrder=order=>order.created_via==='customer'&&!order.accepted_by_telegram_id&&
 ['pending','confirmed'].includes(order.status);
const canStartCounterOrder=order=>counterCanIssue(order)&&canPrepareCounterOrder(order)&&!order.preorder_waiting&&
 (newCounterOrder(order)||order.created_via==='staff'&&order.order_type==='delivery'&&
  !order.accepted_by_telegram_id&&['pending','confirmed'].includes(order.status));
const canFinishCounterDelivery=order=>order.order_type==='delivery'&&counterCanIssue(order)&&
 order.status==='preparing'&&canPrepareCounterOrder(order)&&!order.preorder_waiting&&
 String(order.accepted_by_telegram_id)===String(auth.actorId());
const locationId=()=>$('posLocation').value;
const foreignMethods=new Set(['rub','tenge','kaspi','sber','usdt']);
const fxMethods=new Set(['usd','eur']);
let fxQuote=null,fxLoading=false;
const activeFxQuote=()=>payOrder?.guestCashQuote||fxQuote;
const fxCurrency=()=>payOrder?.guestCashQuote?.currency||selectedMethod.toUpperCase();
const fxCash=()=>Boolean(payOrder?.guestCashQuote)||((!payOrder||payOrder.draftFx)&&fxMethods.has(selectedMethod));
const fxReady=()=>fxCash()&&activeFxQuote()?.currency===fxCurrency()&&Date.now()-Date.parse(activeFxQuote().quotedAt)<24*60*60*1000;
const fxFormat=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:fxCurrency(),minimumFractionDigits:2,maximumFractionDigits:2}).format(v);
async function refreshFxQuote(){
 const currency=fxCurrency();if(!fxCash())return;
 fxLoading=true;fxQuote=null;paymentFields();
 try{const response=await api('quote',{currency},'cafe-counter-fx-cash');if(fxCurrency()===currency)fxQuote=response;}
 catch(error){if(fxCurrency()===currency)result(error.message);}
 finally{fxLoading=false;paymentFields();}
}
async function acceptFxCash(order,received){
 const currency=fxCurrency();
 const data=await api('settle',{currency,orderId:order.id,received},'cafe-counter-fx-cash');
 const message=data.replayed?'Заказ уже оплачен. Сдача по чеку: '+money(data.changeVnd)
  :'Получено '+new Intl.NumberFormat('en-US',{style:'currency',currency}).format(received)+' · Сдача '+money(data.changeVnd)+' · Курс '+money(data.rate)+' за 1 '+currency;
 showSettledPayment(order,data,message,data.replayed?message:'Сдача '+money(data.changeVnd));
}
const foreignApi=(action,body)=>api(action,body,'cafe-counter-payment');
let selectedMethod='cash',switchingPayment=false,options=null,optionsLocation='',optionsError=false;
async function refreshMethods(){
 const id=locationId();
 if(!id)return;
 options=null;optionsLocation=id;optionsError=false;paymentFields();
 try{
  const {methods}=await foreignApi('options',{locationId:id});
  if(locationId()!==id)return;
  options=methods||{};
 }catch{
  if(locationId()!==id)return;
  optionsError=true;
 }
 paymentFields();
}
const result=message=>{$('posResult').textContent=message;};
const counterStatus=message=>{$('counterStatus').textContent=message;};
const serviceLabels={pickup:'С собой',dine_in:'На месте',delivery:'Доставка'};
let saleService='',saleDeliveryPoint=null,cafeLocations=[];
const deliveryDetails=()=>saleService==='delivery'?{
 deliveryAddress:$('posDeliveryAddress').value.trim(),customerPhone:$('posDeliveryPhone').value.trim(),
}:{};
function resetSaleService(){
 delete $('counterSale').dataset.basket;
 saleService='';
 saleDeliveryPoint=null;
 $('posDeliveryMapStatus').textContent='';
 $('posDeliveryMap').textContent='Указать точку на карте';
 $('posDeliveryAddress').value='';
 $('posDeliveryPhone').value='';
}
let counterView='sale',counterReturn='orders',counterOrders=[],loadedLocation='',orderFetch=null,payOrder=null;
let counterOrdersRevision=0,counterRefreshQueued=false,paymentFrom='sale';
const paymentMethod=()=>payOrder?.paymentMethod==='cash'&&fxCash()?fxCurrency().toLowerCase():payOrder?.paymentMethod||selectedMethod;
const orderMethod=order=>order.foreignPayment?.channel||order.paymentMethod;
const canSwitchPayment=order=>order?.staffCounter&&order.paymentStatus==='pending'&&!closedOrder(order)&&
 (order.paymentMethod!=='bank_transfer'||order.foreignPayment||order.legacyTransfer);
function settlePayment(order,amounts={}){
 if(order.staffCounter&&['cash','qr'].includes(order.paymentMethod))return foreignApi('settle',{orderId:order.id,expectedMethod:order.paymentMethod,...amounts});
 return api('updatePayment',{orderId:order.id,paymentStatus:'paid',paymentMethod:order.paymentMethod,...amounts},'cafe-kitchen');
}
const paymentDue=()=>Number(payOrder?.totalVnd??amount());
const rubles=kopecks=>new Intl.NumberFormat('ru',{style:'currency',currency:'RUB'}).format(kopecks/100);
const foreignAmount=payment=>payment.currency==='USDT'
 ? new Intl.NumberFormat('ru',{maximumFractionDigits:6}).format(payment.amount)+' USDT'
 : new Intl.NumberFormat('ru',{style:'currency',currency:payment.currency}).format(payment.amount);
const paymentTotal=()=>payOrder?.foreignPayment?foreignAmount(payOrder.foreignPayment)
 :payOrder?.rubKopecks!=null?rubles(payOrder.rubKopecks):money(paymentDue());
const confirmationReady=()=>$('counterPaymentVerified').checked&&
 (!payOrder?.requiresGuestProof||payOrder.hasPendingPaymentProof)&&(
 !payOrder?.foreignPayment||$('counterPaymentReference').value.trim().length>=4
);
function counterPaymentLabel(order){
 if(order.payment_status==='paid')return 'Оплачено';
 if(order.payment_status==='refunded')return 'Возврат';
 if(order.status==='cancelled')return 'Без оплаты';
 if(cashOnDelivery(order))return 'Наличные курьеру';
 if(order.hasPendingPaymentProof)return 'Чек прикреплён';
 return 'Ожидает оплаты';
}
function counterStage(order){
 const delivery=order.order_type==='delivery';
 if(order.status==='cancelled')return 'Отменён';
 if(order.status==='completed')return delivery?'Доставлен':'Выдан';
 if(delivery&&order.delivery_status==='delivered')return 'Доставлен';
 if(delivery&&order.delivery_status==='picked_up')return 'Курьер в пути';
 if(order.preorder_waiting)return 'Ожидается партия';
 if(order.status==='ready')return delivery&&readyForCourier(order)?'Готов к передаче курьеру':
  readyToIssue(order)?'Готов к выдаче':'Готов, выдача после оплаты';
 return {pending:'Новый',confirmed:'Принят',preparing:'Готовится'}[order.status]||'В работе';
}
const counterOrderDate=new Intl.DateTimeFormat('ru-RU',{
 timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'
});

function renderProductCounts(){
 for(const card of $('posProducts').querySelectorAll('[data-pos-product]')){
  const count=cart.get(card.dataset.posProduct)?.quantity||0;
  const label=card.querySelector('[data-pos-count]');
  label.textContent=count;
  label.hidden=count===0;
  card.querySelector('[data-pos-remove]').hidden=count===0;
 }
}
function renderCart(){
 renderProductCounts();
 $('posCart').innerHTML=cart.size?[...cart].map(([id,{product,quantity}])=>{
  const name=product.name_ru||product.name_en||product.name_vi;
  return '<div class="pos-row"><strong>'+esc(name)+'</strong><span>'+money(product.price_vnd*quantity)+'</span><div><button type="button" data-pos-delta="-1" data-id="'+esc(id)+'" aria-label="Уменьшить количество: '+esc(name)+'">−</button><b>'+quantity+'</b><button type="button" data-pos-delta="1" data-id="'+esc(id)+'" aria-label="Добавить: '+esc(name)+'">+</button></div></div>';
 }).join(''):'<p>Добавьте хотя бы один товар.</p>';
 $('posTotal').textContent=money(amount());
 $('posCartJump').textContent='Корзина · '+money(amount());
 updateCartJump();
 paymentFields();
 syncCustomerScreen();
}
function updateCartJump(){
 $('posCartJump').hidden=!cart.size||currentTab!=='pos'||counterView!=='sale'||$('counterSale').dataset.basket==='open';
}
function paymentFields(){
 const cash=paymentMethod()==='cash',fx=fxCash()&&!switchingPayment,due=paymentDue(),received=Number($('posCash').value);
 const draft=!payOrder&&cart.size>0;
 const isDelivery=saleService==='delivery';
 const {deliveryAddress,customerPhone}=deliveryDetails();
 const serviceReady=Boolean(saleService)&&(!isDelivery||(deliveryAddress&&customerPhone&&saleDeliveryPoint));
 $('posDeliveryFields').hidden=!isDelivery;
 $('posService').disabled=busy;
 for(const button of $('posService').querySelectorAll('[data-pos-service]')){
  button.setAttribute('aria-pressed',String(button.dataset.posService===saleService));
 }
 const pending=payOrder?.paymentStatus==='pending'&&!closedOrder(payOrder);
 const validCash=fx?(fxReady()&&Number.isFinite(received)&&received>=0&&Math.abs(Math.round(received*100)/100-received)<1e-8&&Math.floor(received*activeFxQuote().vndPerUnit)>=due):Number.isSafeInteger(received)&&received>=due;
 const unavailable=[...cart].some(([id,line])=>line.quantity>(available().find(p=>p.id===id)?.available||0));
 const activeCash=!switchingPayment&&(cash||fx)&&(draft||pending);
 const choosing=draft||switchingPayment;
 const cashReceipt=pending&&payOrder.paymentMethod==='cash';
 const canSwitch=canSwitchPayment(payOrder)&&!switchingPayment;
 const foreign=foreignMethods.has(selectedMethod);
 const selectedAvailable=fxCash()?fxReady():!foreign||options?.[selectedMethod]===true;
 const status=$('counterMethodStatus');
 status.hidden=!choosing||selectedAvailable;
 status.textContent=fxCash()?(fxLoading?'Получаем курс Google Finance…':'Курс недоступен. Валютная оплата заблокирована.')
   :optionsError?'Не удалось проверить реквизиты. Откройте оплату заказа повторно.'
  :!options?'Проверяем реквизиты…'
  :'Для этого способа оплаты ещё не настроены реквизиты.';
 for(const button of $('counterMethodLabel').querySelectorAll('[data-counter-method]')){
  button.disabled=busy||!choosing||(switchingPayment&&fxMethods.has(button.dataset.counterMethod));
  button.setAttribute('aria-pressed',String(button.dataset.counterMethod===selectedMethod));
 }
 $('posForm').hidden=!choosing&&!activeCash;
 $('counterMethodLabel').hidden=!choosing;
 $('counterSwitchHint').hidden=!switchingPayment;
 $('counterCancelSwitch').hidden=!switchingPayment;
 $('counterCancelSwitch').disabled=busy;
 const receipt=$('posReceipt');
 receipt.hidden=!payOrder||switchingPayment||(cashReceipt&&!canSwitch);
 receipt.classList.toggle('counter-cash-actions',cashReceipt);
 $('counterSwitchPayment').hidden=!canSwitch;
 $('counterSwitchPayment').disabled=busy;
 $('posCashLabel').hidden=!activeCash;
 $('posCash').required=activeCash;
  $('posCash').step=fx?'0.01':'1';
  $('posCash').inputMode=fx?'decimal':'numeric';
  $('posCash').placeholder=fx?'Получено '+fxCurrency():'Сколько дал клиент';
  $('posCashLabel').firstChild.textContent=fx?'Получено наличными, '+fxCurrency():'Получено наличными, ₫';
  const fxInfo=$('posFxInfo');fxInfo.hidden=!fx;
  if(fx)fxInfo.textContent=fxReady()?'К оплате ≈ '+fxFormat(Math.ceil(due/activeFxQuote().vndPerUnit*100)/100)+' · 1 '+fxCurrency()+' = '+money(activeFxQuote().vndPerUnit)+' · Google Finance · '+new Date(activeFxQuote().quotedAt).toLocaleString('ru-RU'):'Ожидаем актуальный курс Google Finance';
 $('posCash').disabled=!activeCash||busy;
 $('posLocation').disabled=busy;
 $('counterCheckout').disabled=busy||!cart.size||unavailable||!serviceReady;
 $('counterSummaryToolbar').hidden=!draft;
 $('counterAddProducts').disabled=busy;
 $('posSubmit').disabled=busy||(payOrder?.guestCash===true&&!payOrder.guestCashLoaded)||
  (switchingPayment?(!pending||!selectedAvailable||selectedMethod===orderMethod(payOrder))
   :(!payOrder&&(!draft||unavailable||!selectedAvailable||!serviceReady))||((cash||fx)&&payOrder&&!pending)||(fx&&!validCash));
 $('posSubmit').textContent=switchingPayment?'Сменить способ оплаты':(cash||fx)?'Принять наличные':foreign?'Показать реквизиты':'Показать QR';
 $('posChange').textContent=activeCash&&$('posCash').value?(fx?(fxReady()?(validCash?'Сдача '+money(Math.floor(received*activeFxQuote().vndPerUnit)-due):'Не хватает '+money(Math.max(0,due-Math.floor(received*activeFxQuote().vndPerUnit)))):'Курс недоступен'):(validCash?'Сдача '+money(received-due):'Не хватает '+money(Math.max(0,due-received)))):'';
 const total=paymentTotal();
 $('posCashDue').querySelector('strong').textContent=total;
 const itemsOpen=$('counterPaymentItems')?.open;
 $('counterPaymentSummary').innerHTML=payOrder||draft
  ? '<h2 id="posOrderNumber">'+(payOrder?'Заказ №'+esc(payOrder.orderNumber):'Текущий заказ')+'</h2>'+
   '<p>'+[serviceLabels[payOrder?payOrder.orderType:saleService],payOrder?payOrder.deliveryAddress?.split('\nТочка доставки: ')[0]:deliveryAddress].filter(Boolean).map(esc).join(' · ')+'</p>'+
   '<details id="counterPaymentItems"'+(itemsOpen?' open':'')+'><summary>Блюда в заказе</summary>'+
   itemsMarkup(payOrder?.items||cartItems())+'</details><div class="pos-total"><span>'+(payOrder?.paymentStatus==='paid'?'Оплачено':'К оплате')+'</span><strong>'+esc(total)+'</strong></div>'
  : '<p>Добавьте блюда в разделе «Продажа» или выберите заказ в разделе «Заказы».</p>';
}
let proofLoading=null;
function updateProofAction(order){
 const visible=Boolean(order&&order.paymentStatus==='pending'&&!closedOrder(order)&&electronicPayment(order.paymentMethod));
 const button=$('counterOpenProof'),loading=Boolean(order&&proofLoading===order);
 $('counterProofActions').hidden=!visible;
 button.disabled=loading;
 if(order?.requiresGuestProof)$('posConfirmQr').disabled=busy||!confirmationReady();
 button.textContent=loading?'Загружаем чек…':order?.hasPendingPaymentProof?'Открыть чек клиента':'Проверить чек клиента';
}
$('counterOpenProof').onclick=async()=>{
 const order=payOrder;
 if(!order||proofLoading===order||$('counterProofActions').hidden)return;
 proofLoading=order;
 updateProofAction(order);
 const current=()=>currentTab==='pos'&&counterView==='payment'&&payOrder===order&&order.paymentStatus==='pending';
 try{
  const {proofs}=await api('list',{orderId:order.id},'cafe-transfer-proof');
  if(!current())return;
  const pending=(proofs||[]).filter(proof=>proof.status==='pending');
  if(pending.length){
   order.hasPendingPaymentProof=true;
   result('');
   window.ummaKitchen.showPaymentProofs(pending,order.orderNumber);
  }else result('Клиент пока не прикрепил чек.');
 }catch(error){
  if(current())result(error.message||'Не удалось загрузить чек. Попробуйте ещё раз.');
 }finally{
  if(proofLoading===order)proofLoading=null;
  updateProofAction(payOrder);
 }
};
function showPayment(order,payment=null){
 switchingPayment=false;
 if(order?.id!==payOrder?.id||order?.paymentStatus!=='pending'||order?.paymentMethod!==payOrder?.paymentMethod){
  $('counterPaymentVerified').checked=false;
  $('counterPaymentReference').value='';
 }
 payOrder=order;
 updateProofAction(order);
 if(order?.paymentMethod==='bank_transfer'&&payment)order.foreignPayment=payment;
 $('posReceipt').hidden=!order;
 $('posQr').replaceChildren();
 const bank=$('counterBankDetails');
 bank.hidden=true;
 bank.textContent='';
 if(order){
  const pending=order.paymentStatus==='pending'&&!closedOrder(order);
  const electronic=electronicPayment(order.paymentMethod);
  if(pending&&payment?.account){
   bank.hidden=false;
   if(payment.qrPayload)drawQr($('posQr'),payment.qrPayload);
   bank.textContent=[payment.bankName,payment.recipient,
    payment.network?'Сеть '+payment.network:null,
    (payment.network?'Кошелёк ':payment.currency?'Реквизиты ':'Счёт ')+payment.account,
    payment.reference?'Назначение '+payment.reference:null,
   ].filter(Boolean).join('\n');
  }else if(pending&&payment?.qrPayload)drawQr($('posQr'),payment.qrPayload);
  const canConfirm=pending&&electronic&&(Boolean(payment)||order.legacyTransfer===true);
  $('counterPaymentVerification').hidden=!canConfirm;
  $('counterPaymentReferenceLabel').hidden=!order.foreignPayment;
  $('counterPaymentReferenceLabel').firstChild.textContent=order.foreignPayment?.currency==='USDT'?'Хеш транзакции':'Номер операции';
  $('posConfirmQr').hidden=!canConfirm;
  $('posConfirmQr').disabled=busy||!confirmationReady();
  $('posReloadQr').hidden=!(pending&&electronic&&!canConfirm);
  $('posShowScreen').hidden=!(pending&&order.paymentMethod==='qr'&&payment&&screen());
  $('counterNewSale').hidden=pending||paymentFrom==='orders';
  $('counterPaymentBack').textContent=paymentFrom==='orders'||order.paymentStatus==='paid'?'К заказу':'К продаже';
  $('posPaymentHint').textContent=order.paymentStatus==='paid'?'Оплачено. Назовите гостю номер заказа.'
   :!pending?'Заказ закрыт.'
   :order.paymentMethod==='cash'?''
   :!canConfirm?'Платёжные реквизиты пока недоступны.'
   :order.requiresGuestProof&&!order.hasPendingPaymentProof?'Ожидаем чек от клиента.':order.foreignPayment?.currency==='USDT'?'Сверьте поступление в кошельке в указанной сети.'
   :'Сверьте фактическое поступление в банке.';
 }
 paymentFields();
 syncCustomerScreen();
}
async function paymentDetails(order){
 if(order.paymentStatus!=='pending'||closedOrder(order))return null;
 if(order.paymentMethod==='bank_transfer'){
  const info=await foreignApi('details',{orderId:order.id});
  order.legacyTransfer=info.counter===false;
  if(info.paymentStatus)order.paymentStatus=info.paymentStatus;
  if(info.paymentMethod)order.paymentMethod=info.paymentMethod;
  if(info.status)order.status=info.status;
  return info.payment;
 }
 if(order.paymentMethod==='cash'&&order.guestCash){
  const info=await foreignApi('details',{orderId:order.id});
  order.guestCashQuote=info.cashQuote;
  order.guestCashLoaded=true;
 }
 if(order.paymentMethod!=='qr')return null;
 const {payment}=await api('payment',{orderId:order.id});
 if(!payment)throw Error('Не удалось получить реквизиты для этого заказа. Обновите статус заказа.');
 return payment;
}
async function acceptCash(order,received){
 const change=received-Number(order.totalVnd);
 const settled=await settlePayment(order,{tenderedAmountVnd:received,changeGivenVnd:change});
 const changeNote='Сдача '+money(change);
 showSettledPayment(order,settled,'Получено '+money(received)+' · '+changeNote,changeNote);
}
function showSettledPayment(order,settled,message,counterNote=''){
 const paid=settled?.order;
 const paidElsewhere=paid&&Object.hasOwn(paid,'paidByTelegramId')&&String(paid.paidByTelegramId)!==String(auth.actorId());
 const warning=paidElsewhere?'Заказ уже оплачен. Повторно деньги не принимайте.':'';
 order.counterPaymentNote=warning||counterNote;
 order.paymentStatus='paid';
 order.status=paid?.status||order.status;
 const listed=counterOrders.find(item=>item.id===order.id);
 if(listed){
  listed.payment_status='paid';
  if(paid?.status)listed.status=paid.status;
  renderCounterOrders();
 }
 $('posCash').value='';
 showPayment(order);
 result(warning||message);
}
async function switchOrderPayment(){
 const order=payOrder,method=selectedMethod;
 busy=true;
 paymentFields();
 result('Меняем способ оплаты…');
 try{
  const changed=await foreignApi('switch',{orderId:order.id,method,expectedMethod:orderMethod(order)});
  const next={...order,paymentMethod:changed.paymentMethod,paymentStatus:changed.paymentStatus,status:changed.status,
   rubKopecks:null,foreignPayment:null,legacyTransfer:false};
  $('posCash').value='';
  $('counterPaymentVerified').checked=false;
  $('counterPaymentReference').value='';
  showPayment(next,changed.payment);
  if(next.paymentMethod==='qr'){
   showPayment(next,await paymentDetails(next));
  }
  result('Способ оплаты изменён.');
 }catch(error){result(error.message);}
 finally{busy=false;paymentFields();void refreshCounterOrders({afterMutation:true});}
}
$('counterSwitchPayment').onclick=()=>{
 if(busy||!canSwitchPayment(payOrder))return;
 switchingPayment=true;
 selectedMethod=orderMethod(payOrder);
 result('');
 paymentFields();
 if(optionsLocation!==locationId()||optionsError)void refreshMethods();
 $('counterMethodLabel').querySelector('button:not([disabled])')?.focus();
};
$('counterCancelSwitch').onclick=()=>{
 if(busy)return;
 switchingPayment=false;
 result('');
 paymentFields();
 $('counterSwitchPayment').focus();
};
async function sell(event){
 event.preventDefault();
 if(busy||$('posSubmit').disabled)return;
 if(switchingPayment){await switchOrderPayment();return;}
 const method=paymentMethod(),cash=method==='cash',fx=fxMethods.has(method),foreign=foreignMethods.has(method),due=paymentDue(),received=Number($('posCash').value);
 if(fx&&(!fxReady()||!$('posCash').value||!Number.isFinite(received)||Math.abs(Math.round(received*100)/100-received)>=1e-8||Math.floor(received*activeFxQuote().vndPerUnit)<due)){result('Проверьте курс и полученную сумму в '+fxCurrency());return;}
 if(cash&&(!$('posCash').value||!Number.isSafeInteger(received)||received<due)){result('Введите полученную сумму не меньше '+money(due));return;}
 busy=true;
 paymentFields();
 result(payOrder?'Сохраняем оплату…':'Создаём заказ…');
 let created=payOrder,details=null;
 try{
  if(!created){
   const items=cartItems();
   const fulfillment={orderType:saleService,...deliveryDetails()};
   if(saleDeliveryPoint&&saleService==='delivery'){
    fulfillment.deliveryAddress=fulfillment.deliveryAddress.replace(/^Точка доставки:.*$/gm,'').trim()+
     '\nТочка доставки: '+window.ummaMapLinks.coords(saleDeliveryPoint);
    fulfillment.dispatchMode='manual';
   }
   const common={initData:auth.credential(),staffOrder:true,locationId:locationId(),...fulfillment,
    items:[...cart].map(([productId,line])=>({productId,quantity:line.quantity}))};
   const response=await window.ummaCafeRequests.request(base+(foreign?'cafe-counter-payment':'create-cafe-order'),foreign
    ? {...common,action:'create',method}
    : {...common,paymentMethod:fx?'cash':method,paymentTiming:'now',customerName:'Гость',customerPhone:common.customerPhone||'',customerNote:''});
   const data=await response.json();
   if(!response.ok||!data.ok||!data.order)throw Error(data.error||'Заказ не подтверждён');
   created={...fulfillment,...data.order,items,staffCounter:true,draftFx:fx,paymentMethod:data.paymentMethod||(foreign?'bank_transfer':fx?'cash':method),paymentStatus:data.paymentStatus||'pending',status:data.status||data.order.status};
   details=data.payment;
   // Creation committed. Keep the server order even if a later payment or display call fails.
   cart.clear();
   resetSaleService();
   showPayment(created);
   renderCart();
  }
  if(fx){
   if(Number(created.totalVnd)!==due)throw Error('Цена изменилась. Сверьте итог и повторите оплату.');
   await acceptFxCash(created,received);
  }else if(cash){
   if(Number(created.totalVnd)!==due)throw Error('Цена изменилась. Сверьте новый итог и подтвердите оплату.');
   await acceptCash(created,received);
  }else{
   showPayment(created,details||await paymentDetails(created));
   result('');
  }
 }catch(error){result((created?'Заказ №'+created.orderNumber+' уже создан. ':'')+error.message);}
 finally{busy=false;paymentFields();void refreshCounterOrders({afterMutation:true});}
}
function counterOrderButton(order,action,label,primary=true){
 return '<button type="button"'+(primary?' class="primary"':'')+' data-counter-action="'+action+
  '" data-order-id="'+esc(order.id)+'"'+(busy||$('counterStatus').dataset.offline?' disabled':'')+'>'+label+'</button>';
}
function counterDeliveryDetails(order){
 const raw=order.delivery_address||'';
 const address=raw.replace(/\s*Точка доставки:.*$/im,'').trim();
 const maps=window.ummaMapLinks;
 const point=maps?.parseAddress?.(raw.replace(/\s*Точка доставки: */i,'\nТочка доставки: '));
 const phone=String(order.customer_phone||'').replace(/[^+0-9]/g,'');
 return '<dl class="counter-order-info">'+
  (order.customer_name?'<div><dt>Клиент</dt><dd>'+esc(order.customer_name)+'</dd></div>':'')+
  (phone?'<div><dt>Телефон</dt><dd><a href="tel:'+esc(phone)+'">'+esc(order.customer_phone)+'</a></dd></div>':'')+
  (address||point?'<div><dt>Адрес</dt><dd>'+esc(address)+
   (point?'<a href="'+esc(maps.googlePlace(point))+'" target="_blank" rel="noopener noreferrer">На карте</a>':'')+'</dd></div>':'')+'</dl>';
}
function counterOrderMarkup(order){
 const mayPay=needsCounterPayment(order);
 const delivery=order.order_type==='delivery';
 const green=delivery&&counterCanIssue(order)&&window.ummaGreenSm?.handles(order)
  ? window.ummaGreenSm.card(order,me.locations.find(location=>location.id===order.location_id)) : '';
 const transfer=window.ummaGreenSm?.transfer(order,auth.actorId())||'';
 const requestedCash=Number(order.requested_cash_vnd),due=Number(order.total_vnd);
 const changeNote=cashOnDelivery(order)&&order.payment_status==='pending'&&!closedOrder(order)&&requestedCash>=due&&requestedCash>0
  ?requestedCash===due?'Без сдачи':'Сдача '+money(requestedCash-due)+' с '+money(requestedCash):'';
 const fresh=newCounterOrder(order);
 const ready=counterOrderReady(order);
 const start=canStartCounterOrder(order);
 const issue=canIssue(order)?counterOrderButton(order,'issue',ready?'Выдано':'Собрать и выдать',!start):'';
 const action=mayPay?counterOrderButton(order,'pay',order.hasPendingPaymentProof?'Проверить оплату':order.payment_method==='cash'?'Принять оплату':'Открыть оплату'):
  start?counterOrderButton(order,'start','Взять в работу'):canFinishCounterDelivery(order)?counterOrderButton(order,'ready','Заказ готов'):issue;
 const actor=order.preparationActor&&order.status==='preparing'?
  '<p>'+esc((order.preparation_station==='kitchen'?'Готовится на кухне':'Собирается на стойке')+' · '+order.preparationActor)+'</p>':'';
 const paymentNote=payOrder?.id===order.id&&order.payment_status==='paid'&&!closedOrder(order)?payOrder.counterPaymentNote:'';
 const paymentClass=order.payment_status==='paid'?'is-paid':order.payment_status==='pending'&&!closedOrder(order)?'is-due':'';
 const createdAt=Date.parse(order.created_at);
 const source=order.created_via==='staff'?'У стойки':'Из приложения';
 const items=order.cafe_order_items||[];
 return '<article class="counter-card'+(ready?' counter-card--ready':'')+(fresh?' counter-card--new':'')+
  '" data-counter-order="'+esc(order.id)+'">'+
  '<details class="counter-order-details"><summary><span class="counter-order-ident">'+
  (fresh?'<span class="counter-order-mark is-new" aria-hidden="true"></span>':'')+
  '<strong>№'+esc(order.order_number)+'</strong></span><strong class="counter-order-total">'+money(order.total_vnd)+'</strong>'+
  '<small class="counter-order-stage">'+esc(serviceLabels[order.order_type]||'')+' · '+esc(counterStage(order))+'</small>'+
  '<span class="counter-order-payment '+paymentClass+'">'+counterPaymentLabel(order)+'</span>'+
  (readyForCourier(order)&&order.delivery_status==='waiting_courier'?'<small>Ожидает курьера</small>':'')+
  (readyForCourier(order)&&order.delivery_status==='courier_assigned'?'<small>Курьер назначен</small>':'')+
  ((changeNote||paymentNote)?'<small class="counter-order-payment-note">'+esc(changeNote||paymentNote)+'</small>':'')+'</summary>'+
  '<div class="counter-order-body"><p class="counter-order-meta">'+source+
  (Number.isFinite(createdAt)?' · <time datetime="'+esc(order.created_at)+'">'+counterOrderDate.format(createdAt)+'</time>':'')+'</p>'+
  (items.length?itemsMarkup(items):'')+(delivery?counterDeliveryDetails(order):'')+
  (order.customer_note?'<p class="counter-order-note"><strong>Комментарий</strong> '+esc(order.customer_note)+'</p>':'')+
  actor+(start?issue:'')+'</div></details>'+
  (action||green||transfer?'<div class="counter-order-actions">'+action+green+transfer+'</div>':'')+'</article>';
}
function setCounterBadge(id,label,count,description){
 const badge=$(id);
 const value=count?String(count):'';
 if(badge.textContent!==value)badge.textContent=value;
 badge.hidden=!count;
 badge.parentElement.setAttribute('aria-label',count?label+' · '+description+': '+count:label);
}
function syncCounterReadyShortcut(){
 const filtered=counterView==='orders'&&$('counterOrderFilter').value==='ready'&&
  !$('counterOrderSearch').value.trim()&&!$('counterOrderType').value;
 $('counterReadyOpen').hidden=filtered||!$('counterReadyMessage').textContent;
}
function renderCounterReady(ready){
 const numbers=ready.slice(0,3).map(order=>'№'+order.order_number).join(', ');
 const message=ready.length===1?'Выдать заказ '+numbers
  :ready.length?'К выдаче: '+numbers+(ready.length>3?' и ещё '+(ready.length-3):''):'';
 const label=$('counterReadyMessage');
 if(label.textContent!==message)label.textContent=message;
 syncCounterReadyShortcut();
 window.ummaKitchenLive?.updateCounterIssues?.(ready);
}
function renderCounterOrders(){
 const search=$('counterOrderSearch').value.trim().replace(/^№\s*/,'');
 const filter=$('counterOrderFilter').value;
 const type=$('counterOrderType').value;
 const shown=counterOrders.filter(order=>{
  if(type&&order.order_type!==type)return false;
  if(search&&!String(order.order_number).includes(search))return false;
  if(filter==='closed')return closedOrder(order);
  if(closedOrder(order))return filter==='active'&&Boolean(search);
  if(filter==='payment')return needsCounterPayment(order);
  if(filter==='paid')return order.payment_status==='paid';
  if(filter==='preparing')return order.status==='preparing';
  if(filter==='ready')return counterOrderReady(order);
  return true;
 });
 if(filter==='active')shown.sort((a,b)=>Number(newCounterOrder(b))-Number(newCounterOrder(a))||
  Number(readyForCounterPickup(b))-Number(readyForCounterPickup(a))||
  Number(counterOrderReady(b))-Number(counterOrderReady(a)));
 const payments=counterOrders.filter(needsCounterPayment).length;
 const attention=counterOrders.filter(order=>newCounterOrder(order)||needsCounterPayment(order)).length;
 setCounterBadge('counterOrderBadge','Заказы',attention,'Требуют внимания');
 $('counterPaymentFilter').textContent='К оплате · '+payments;
 document.querySelector('[data-counter-filter="ready"]').textContent='Готовые · '+counterOrders.filter(counterOrderReady).length;
 for(const button of document.querySelectorAll('[data-counter-filter]')){
  button.setAttribute('aria-pressed',String(button.dataset.counterFilter===filter));
 }
 const filters=$('counterOrderFilter').closest('details');
 const filterLabel=filter==='paid'||filter==='preparing'?$('counterOrderFilter').selectedOptions[0].textContent:'';
 const typeLabel=type?serviceLabels[type]:'';
 filters.querySelector('summary').textContent=[filterLabel,typeLabel].filter(Boolean).join(' · ')||'Фильтры';
 renderCounterReady(counterOrders.filter(readyForCounterPickup));
 const empty=$('counterStatus').dataset.offline?'Не удалось загрузить заказы.':loadedLocation!==locationId()?'Загружаем заказы…':
  search||type?'Заказы не найдены.':({ready:'Готовых заказов пока нет.',payment:'Нет заказов к оплате.',
   closed:'Завершённых заказов пока нет.'}[filter]||'Заказов в этом списке пока нет.');
 const root=$('counterOrderList');
 const existing=new Map([...root.querySelectorAll('[data-counter-order]')].map(card=>[card.dataset.counterOrder,card]));
 const active=document.activeElement;
 let next=root.firstElementChild;
 for(const order of shown){
  const markup=counterOrderMarkup(order);
  let card=existing.get(order.id);
  existing.delete(order.id);
  if(card?.orderMarkup!==markup){
   const template=document.createElement('template');
   template.innerHTML=markup;
   const updated=template.content.firstElementChild;
   updated.orderMarkup=markup;
   if(card){
    updated.querySelector('details').open=card.querySelector('details').open;
    if(next===card)next=updated;
    card.replaceWith(updated);
    if(card.contains(active))updated.querySelector('summary').focus({preventScroll:true});
   }
   card=updated;
  }
  if(card!==next)root.insertBefore(card,next);
  next=card.nextElementSibling;
 }
 for(const card of existing.values()){
  if(card.contains(active))$('counterOrdersHeading').focus({preventScroll:true});
  card.remove();
 }
 const placeholder=root.querySelector('.counter-orders-empty');
 if(shown.length)placeholder?.remove();
 else if(placeholder)placeholder.textContent=empty;
 else{
  const message=document.createElement('p');
  message.className='counter-orders-empty';
  message.textContent=empty;
  root.append(message);
 }
}
async function refreshCounterOrders({afterMutation=false}={}){
 if(afterMutation)counterOrdersRevision++;
 if(currentTab!=='pos'||document.hidden)return;
 const selected=locationId();
 if(!selected)return;
 if(orderFetch!==null){counterRefreshQueued=true;return;}
 if(busy)return;
 const revision=counterOrdersRevision;
 const current=()=>currentTab==='pos'&&locationId()===selected&&revision===counterOrdersRevision;
 orderFetch=selected;
 try{
  const {orders}=await api('list',{includePaymentProof:true},'cafe-kitchen');
  if(!current()||busy||!Array.isArray(orders))return;
  counterOrders=orders.filter(order=>order.location_id===selected&&['pickup','dine_in','delivery'].includes(order.order_type)&&
   (order.source_module??'cafe')==='cafe'&&!order.cafe_order_items?.some(item=>item.product_name_ru?.startsWith('Market · ')))
   .sort((a,b)=>Number(b.created_via==='staff')-Number(a.created_via==='staff')||Date.parse(b.created_at)-Date.parse(a.created_at));
  loadedLocation=selected;
  if($('counterStatus').dataset.offline){delete $('counterStatus').dataset.offline;counterStatus('');}
  renderCounterOrders();
  window.ummaKitchenLive?.update(counterOrders);
  const open=payOrder,latest=counterOrders.find(order=>order.id===open?.id);
  if(open&&latest){
   const hasProof=latest.hasPendingPaymentProof;
   open.requiresGuestProof=latest.requiresGuestPaymentProof===true;
   if(open.requiresGuestProof&&hasProof&&!open.hasPendingPaymentProof&&$('posPaymentHint').textContent==='Ожидаем чек от клиента.'){
    $('posPaymentHint').textContent='Сверьте фактическое поступление.';
   }
   open.hasPendingPaymentProof=hasProof;
   updateProofAction(open);
  }
  if(open&&latest&&!busy&&(open.paymentMethod!==latest.payment_method||open.paymentStatus!==latest.payment_status||closedOrder(open)!==closedOrder(latest))){
   const changed=open.paymentMethod!==latest.payment_method;
   if(changed||latest.payment_status!=='pending')$('posCash').value='';
   const next={...open,paymentStatus:latest.payment_status,status:latest.status,paymentMethod:latest.payment_method,
    guestCashQuote:changed?null:open.guestCashQuote,guestCashLoaded:changed?false:open.guestCashLoaded,foreignPayment:changed?null:open.foreignPayment,legacyTransfer:changed?false:open.legacyTransfer};
   showPayment(next);
   if(changed&&next.paymentStatus==='pending'){
    const payment=await paymentDetails(next);
    if(current()&&payOrder===next&&!busy)showPayment(next,payment);
   }
   if(current()&&payOrder===next&&!busy){
    const paidElsewhere=open.paymentStatus==='pending'&&next.paymentStatus==='paid';
    if(paidElsewhere){
     const warning='Заказ уже оплачен. Повторно деньги не принимайте.';
     if(next.paymentMethod==='cash')next.counterPaymentNote=warning;
     result(warning);
    }else if(changed)result('Способ оплаты обновился на другой стойке.');
   }
  }
  if(current()&&!busy&&counterView==='payment'&&paymentFrom==='sale'&&
   latest?.id===payOrder?.id&&latest?.payment_status==='paid')openPaidCounterSale();
 }catch{
  if(current()&&!busy){
   $('counterStatus').dataset.offline='true';
   counterStatus('Не удалось обновить заказы. Нажмите «Обновить».');
   renderCounterOrders();
  }
 }finally{
  orderFetch=null;
  if(counterRefreshQueued){
   counterRefreshQueued=false;
   void refreshCounterOrders();
  }
 }
}
function setCounterView(view,{draft=false,from='sale',refresh=true}={}){
 if(currentTab!=='pos')return;
 const ids={sale:'counterSale',payment:'counterPayment',orders:'counterOrders'};
 counterView=view;
 if(view==='payment'){
  if(!$('counterStatus').dataset.offline)counterStatus('');
  paymentFrom=from;
  $('counterPaymentBack').textContent=from==='orders'?'К заказу':'К продаже';
 }
 const activeView=view==='payment'?paymentFrom:view;
 for(const [name,id] of Object.entries(ids))$(id).hidden=name!==view;
 document.querySelectorAll('[data-counter-view]').forEach(button=>{
  if(button.dataset.counterView===activeView)button.setAttribute('aria-current','page');
  else button.removeAttribute('aria-current');
 });
 if(draft){resetSaleService();selectedMethod='cash';fxQuote=null;$('posCash').value='';result('');showPayment(null);}
 if(view==='payment'){
  paymentFields();
  if(!payOrder&&cart.size&&(optionsLocation!==locationId()||optionsError))void refreshMethods();
 }
 if(view==='orders'){
  renderCounterOrders();
  showPickupPair();
  if(refresh)void refreshCounterOrders();
 }else syncCounterReadyShortcut();
 updateCartJump();
 syncCustomerScreen();
 $('counterContent').scrollTop=0;
 if(document.body.classList.contains('counter-cash-keyboard'))syncCashKeyboard();
}
async function counterOrderAction(event){
 const button=event.target.closest('[data-counter-action]');
 if(!button||busy||$('counterStatus').dataset.offline)return;
 const order=counterOrders.find(order=>order.id===button.dataset.orderId);
 if(!order)return;
 const action=button.dataset.counterAction;
 if(action==='issue'&&!canIssue(order))return;
 if(action==='pay'&&!needsCounterPayment(order))return;
 if(action==='start'&&!canStartCounterOrder(order))return;
 if(action==='ready'&&!canFinishCounterDelivery(order))return;
 busy=true;
 paymentFields();
 renderCounterOrders();
 try{
  if(action==='issue'){
   await api('updateStatus',{orderId:order.id,status:'completed',note:'counter_pickup_call'},'cafe-kitchen');
   order.status='completed';
   counterStatus('');
  }else if(action==='start'||action==='ready'){
   const status=action==='start'?'preparing':'ready';
   await api('updateStatus',{orderId:order.id,status},'cafe-kitchen');
   order.status=status;
   if(action==='start')order.accepted_by_telegram_id=auth.actorId();
   counterStatus('');
  }else{
   const target={id:order.id,orderNumber:order.order_number,totalVnd:order.total_vnd,paymentStatus:order.payment_status,
    paymentMethod:order.payment_method,status:order.status,items:order.cafe_order_items,rubKopecks:order.rub_payment_kopecks,orderType:order.order_type,
    deliveryAddress:order.delivery_address,hasPendingPaymentProof:order.hasPendingPaymentProof,requiresGuestProof:order.requiresGuestPaymentProof===true,guestCash:order.created_via==='customer'&&order.customer_telegram_id==null,staffCounter:order.created_via==='staff'&&
     (order.order_type==='pickup'||order.order_type==='dine_in'&&order.payment_timing==='now'||
      order.order_type==='delivery'&&order.requires_prepayment)};
   $('posCash').value='';
   result('');
   setCounterView('payment',{from:'orders'});
   showPayment(target);
   showPayment(target,await paymentDetails(target));
  }
 }catch(error){
  if(action==='issue'&&error.message==='Order already has this status'){
   order.status='completed';
   counterStatus('');
  }else if(action!=='pay'&&['Order already has this status','Order already accepted by another employee'].includes(error.message)){
   counterStatus('Обновляем заказ №'+order.order_number+' · статус уже изменился.');
  }else if(action!=='pay')counterStatus(error.message);
  else result(error.message);
 }finally{busy=false;paymentFields();renderCounterOrders();void refreshCounterOrders({afterMutation:action!=='pay'});}
}

$('posForm').onsubmit=sell;
$('counterMethodLabel').onclick=event=>{
 const button=event.target.closest('[data-counter-method]');
 if(!button||busy)return;
 selectedMethod=button.dataset.counterMethod;
 $('posCash').value='';
 result('');
 paymentFields();
 if(foreignMethods.has(selectedMethod)&&(optionsLocation!==locationId()||optionsError))void refreshMethods();
  if(fxCash())void refreshFxQuote();
 syncCustomerScreen();
};
$('posCash').oninput=()=>{paymentFields();syncCustomerScreen();};
$('posSearch').oninput=menu;
$('posLocation').onchange=()=>{
 counterOrdersRevision++;
 cart.clear();resetSaleService();counterOrders=[];loadedLocation='';result('');counterStatus('');
 $('pickupPairStatus').textContent='';
 renderCounterOrders();
 showPayment(null);renderCart();menu();showPair(screen());showPickupPair();
 void loadAvailability().then(()=>{menu();paymentFields();}).catch(error=>counterStatus(error.message));
 void refreshCounterOrders();
};
function changeQuantity(id,delta){
 if(busy)return;
 const product=available().find(item=>item.id===id);
 const current=cart.get(id);
 const quantity=(current?.quantity||0)+delta;
 if(delta>0&&(!product||quantity>Math.min(99,product.available)))return;
 if(delta>0&&!cart.size&&payOrder)showPayment(null);
 if(quantity<=0)cart.delete(id);
 else cart.set(id,{product:current?.product||product,quantity});
 renderCart();
}
$('posProducts').onclick=event=>{
 const button=event.target.closest('[data-pos-add],[data-pos-remove]');
 if(button)changeQuantity(button.dataset.posAdd||button.dataset.posRemove,button.dataset.posAdd?1:-1);
};
$('posCart').onclick=event=>{
 const button=event.target.closest('[data-pos-delta]');
 if(button)changeQuantity(button.dataset.id,Number(button.dataset.posDelta));
};
$('counterPaymentVerification').oninput=()=>{$('posConfirmQr').disabled=busy||!confirmationReady();};
$('posConfirmQr').onclick=async()=>{
 if(busy||!payOrder||$('posConfirmQr').hidden||!confirmationReady())return;
 const order=payOrder;
 busy=true;$('posConfirmQr').disabled=true;paymentFields();
 try{
  const settled=order.foreignPayment?await foreignApi('confirm',{
   orderId:order.id,verified:true,reference:$('counterPaymentReference').value.trim(),
   expectedMethod:order.foreignPayment.channel,expectedAmount:Number(order.foreignPayment.amount),
  }):await settlePayment(order);
  showSettledPayment(order,settled,'Оплата подтверждена.');
 }catch(error){result(error.message);}
 finally{busy=false;$('posConfirmQr').disabled=!confirmationReady();paymentFields();void refreshCounterOrders({afterMutation:true});}
};
$('posReloadQr').onclick=async()=>{
 if(busy||!payOrder)return;
 const order=payOrder;
 busy=true;$('posReloadQr').disabled=true;paymentFields();
 try{
  showPayment(order,await paymentDetails(order));
  result('');
 }catch(error){result(error.message);}
 finally{busy=false;$('posReloadQr').disabled=false;paymentFields();void refreshCounterOrders();}
};
$('posShowScreen').onclick=()=>displayOrder(payOrder?.id).then(()=>result('Заказ на клиентском экране.')).catch(error=>result(error.message));
$('screenPair').onclick=async()=>{
 if(busy)return;
 busy=true;$('screenPair').disabled=true;paymentFields();
 try{
  const old=screen();if(old)await api('screenRevoke',{screenId:old.id});
  const layout=$('screenLayout').value,language=$('screenLanguageSetting').value;
  const data=await api('screenCreate',{locationId:locationId(),layout,language});
  const value={id:data.id,token:data.screenToken,layout,language};
  localStorage.setItem(screenKey(),JSON.stringify(value));showPair(value);
  await publishScreen(value,screenSnapshot(),true);
  if(payOrder?.paymentMethod==='qr'&&payOrder.paymentStatus==='pending'&&!closedOrder(payOrder))$('posShowScreen').hidden=false;
 }catch(error){$('screenPairState').textContent=error.message;}
 finally{busy=false;$('screenPair').disabled=false;paymentFields();}
};
$('screenLayout').onchange=async()=>{
 const client=screen();
 if(!client)return;
 const field=$('screenLayout'),layout=field.value,cafe=screenKey();
 field.disabled=true;
 try{
  await api('screenSettings',{screenId:client.id,layout});
  if(screenKey()===cafe&&screen()?.id===client.id){
   localStorage.setItem(cafe,JSON.stringify({...client,layout}));
   $('screenPairState').textContent='Размер клиентского табло обновлён.';
  }
 }catch(error){
  if(screenKey()===cafe)field.value=client.layout||'auto';
  $('screenPairState').textContent=error.message;
 }finally{field.disabled=false;}
};
async function setCustomerLanguage(language){
 const client=screen();if(!client)return;
 const field=$('screenLanguageSetting'),key=screenKey();field.disabled=true;
 try{await api('screenSettings',{screenId:client.id,layout:client.layout||'auto',language});
  if(screenKey()===key&&screen()?.id===client.id){localStorage.setItem(key,JSON.stringify({...client,language}));$('screenPairState').textContent='Язык клиентского табло обновлён.';}}
 catch(error){field.value=client.language||'ru';$('screenPairState').textContent=error.message;}
 finally{field.disabled=false;}
}
$('screenLanguageSetting').onchange=()=>void setCustomerLanguage($('screenLanguageSetting').value);
$('screenUnpair').onclick=async()=>{
 const client=screen();if(!client||busy)return;
 try{
  await api('screenRevoke',{screenId:client.id});localStorage.removeItem(screenKey());showPair(null);
  $('posShowScreen').hidden=true;$('screenPairState').textContent='Планшет отключён.';
 }catch(error){$('screenPairState').textContent=error.message;}
};
const pickupBoardKey=()=> 'umma:pickup-screen:'+auth.actorId()+':'+locationId();
function pickupBoardToken(){
 try{return localStorage.getItem(pickupBoardKey())||'';}catch{return '';}
}
function showPickupPair(){
 const token=pickupBoardToken();
 const link=$('pickupPairLink'),qr=$('pickupPairQr');
 $('pickupPair').hidden=Boolean(token);
 $('pickupUnpair').hidden=!token;
 link.hidden=!token;
 qr.replaceChildren();
 link.removeAttribute('href');
 if(!token)return;
 const url=new URL('pickup-board.html',location.href);
 url.hash=new URLSearchParams({screen:token});
 link.href=url.href;
 drawQr(qr,url.href);
}
async function changePickupPair(action){
 const location=locationId(),key=pickupBoardKey(),token=pickupBoardToken();
 if(!location)return;
 const status=$('pickupPairStatus'),pair=$('pickupPair'),unpair=$('pickupUnpair');
 if(pair.disabled)return;
 pair.disabled=unpair.disabled=true;
 status.textContent='';
 try{
  const data=await api(action,{locationId:location,...(action==='revoke'?{token}:{})},'cafe-pickup-board');
  if(action==='pair')localStorage.setItem(key,data.token);
  else localStorage.removeItem(key);
  if(pickupBoardKey()===key)showPickupPair();
 }catch(error){
  if(pickupBoardKey()===key)status.textContent=error.message;
 }finally{pair.disabled=unpair.disabled=false;}
}
$('pickupPair').onclick=()=>void changePickupPair('pair');
$('pickupUnpair').onclick=()=>void changePickupPair('revoke');
$('counterOrderSearch').oninput=renderCounterOrders;
$('counterOrderFilter').onchange=renderCounterOrders;
$('counterOrderType').onchange=renderCounterOrders;
$('counterOrderList').onclick=counterOrderAction;
$('counterRefreshOrders').onclick=async()=>{
 const button=$('counterRefreshOrders');
 button.disabled=true;
 try{await refreshCounterOrders();}
 finally{button.disabled=false;}
};
document.querySelector('.counter-queues').onclick=event=>{
 const button=event.target.closest('[data-counter-filter]');
 if(!button||busy)return;
 $('counterOrderSearch').value='';
 $('counterOrderType').value='';
 $('counterOrderFilter').value=button.dataset.counterFilter;
 renderCounterOrders();
 $('counterContent').scrollTop=0;
};
$('counterReadyOpen').onclick=()=>{
 if(busy)return;
 $('counterOrderSearch').value='';
 $('counterOrderType').value='';
 $('counterOrderFilter').value='ready';
 setCounterView('orders');
 $('counterOrdersHeading').focus({preventScroll:true});
};
$('posService').onclick=event=>{
 const button=event.target.closest('[data-pos-service]');
 if(!button||busy)return;
 saleService=button.dataset.posService;
 paymentFields();
};
$('posDeliveryFields').oninput=paymentFields;
$('posDeliveryMap').onclick=()=>{
 if(busy)return;
 const cafe=cafeLocations.find(location=>location.id===locationId());
 const status=$('posDeliveryMapStatus');
 if(!Array.isArray(cafe?.delivery_zone)){
  status.textContent='Для этого кафе зона доставки недоступна.';
  return;
 }
 if(!window.ummaDeliveryLocation){
  status.textContent='Карта не загрузилась. Обновите страницу.';
  return;
 }
 window.ummaDeliveryLocation.chooseForLocation(cafe,point=>{
  saleDeliveryPoint=point;
  status.textContent='Точка доставки отмечена';
  $('posDeliveryMap').textContent='Изменить точку на карте';
  paymentFields();
 },$('posDeliveryMap'),{point:saleDeliveryPoint});
};
function returnToCounterOrder({refresh=true}={}){
 const order=payOrder;
 const filter=$('counterOrderFilter');
 if(filter.value==='payment'&&order?.paymentStatus!=='pending')filter.value='active';
 if(order&&closedOrder(order))filter.value='closed';
 setCounterView('orders',{refresh});
 const card=order&&Array.from($('counterOrderList').children).find(card=>card.dataset.counterOrder===order.id);
 if(card){
  card.scrollIntoView?.({block:'nearest'});
  card.querySelector('summary').focus({preventScroll:true});
 }else $('counterOrdersHeading').focus({preventScroll:true});
}
function openPaidCounterSale({refresh=false}={}){
 $('counterOrderSearch').value='';
 $('counterOrderType').value='';
 $('counterOrderFilter').value='active';
 returnToCounterOrder({refresh});
}
$('counterPaymentBack').onclick=()=>{
 if(busy)return;
 if(paymentFrom==='orders')returnToCounterOrder();
 else if(payOrder?.paymentStatus==='paid')openPaidCounterSale({refresh:true});
 else setCounterView('sale');
};
$('counterCheckout').onclick=()=>{
 if(busy)return;
 if(cart.size){result('');if(payOrder)showPayment(null);}
 setCounterView('payment');
};
$('counterAddProducts').onclick=()=>{
 if(busy||payOrder)return;
 setCounterView('sale');
 $('posSearch').focus({preventScroll:true});
};
$('counterNewSale').onclick=()=>{setCounterView('sale',{draft:true});$('screenLanguageSetting').value='ru';void setCustomerLanguage('ru');syncCustomerScreen(true);};
document.querySelectorAll('[data-counter-view]').forEach(button=>{
 button.onclick=()=>{
  if(busy)return;
  const view=button.dataset.counterView;
  if(view==='orders'){
   if(counterView==='payment'&&paymentFrom==='orders'){returnToCounterOrder();return;}
   if(counterView==='payment'&&payOrder?.paymentStatus==='paid'){openPaidCounterSale({refresh:true});return;}
   $('counterOrderSearch').value='';
   $('counterOrderType').value='';
   $('counterOrderFilter').value='active';
  }else if(!$('counterStatus').dataset.offline)counterStatus('');
  setCounterView(view);
 };
});
let staffLoading;
function filterStaff(){
 const query=$('webStaffSearch').value.trim().toLocaleLowerCase('ru');
 const cards=[...$('webStaffList').querySelectorAll('.staff-account')];
 for(const card of cards)card.hidden=!card.querySelector('.staff-access-copy').textContent.toLocaleLowerCase('ru').includes(query);
 $('webStaffNoMatch').hidden=!cards.length||cards.some(card=>!card.hidden);
}
$('webStaffSearch').oninput=filterStaff;
const roleNames={kitchen_cashier:'Кассир-кухня',kitchen:'Кухня',cashier:'Кассир',courier:'Курьер',manager:'Менеджер'};
const accessNames={active:'Подключён · вход создан',invited:'Ожидает регистрации по приглашению',expired:'Приглашение истекло',not_created:'Веб-доступ ещё не создан',disabled:'Доступ отключён'};
async function managerRoster() {
 const {employees} = await api('managerRoster');
 const root = $('webStaffList');
 const cards = employees.map(employee => {
  const card = document.createElement('article');
  card.className = 'staff-account';
  const copy = document.createElement('div');
  copy.className = 'staff-access-copy';
  const name = document.createElement('strong');
  name.textContent = employee.name;
  const roles = document.createElement('p');
  roles.textContent = employee.assignments.map(assignment => [
   assignment.staff_role === 'waiter' ? 'Официант' : roleNames[assignment.staff_role] || assignment.staff_role,
   assignment.locationName,
   assignment.can_accept_payments ? 'Принимает оплату' : ''
  ].filter(Boolean).join(' · ')).join(', ');
  const status = document.createElement('small');
  status.textContent = employee.active ? 'Учётная запись активна' : 'Доступ отключён';
  copy.append(name, roles, status);
  card.append(copy);
  return card;
 });
 root.replaceChildren(...cards);
 $('webStaffStatus').textContent = cards.length ? 'Сотрудников в списке: '+cards.length : 'В этом кафе пока нет сотрудников.';
 filterStaff();
}
function staffList(){
 if(staffLoading)return staffLoading;
 staffLoading=(async()=>{if(me.user.role!=='super_admin')return managerRoster();const d=await api('staffList'),employees=d.employees||d.accounts.map(a=>({...a,name:a.login,status:a.active?'active':'disabled',assignments:[]}));$('webStaffList').innerHTML=employees.map(a=>'<article class="staff-account" data-staff-status="'+esc(a.status)+'">'+expiredInviteButton(a)+'<div class="staff-access-copy"><strong>'+esc(a.name)+'</strong><p>'+esc(a.assignments.map(s=>(roleNames[s.staff_role==='kitchen'&&s.can_accept_payments?'kitchen_cashier':s.staff_role]||s.staff_role)+' · '+s.locationName).join('; ')||'Веб-доступ')+'</p><p class="staff-access-state">'+esc(accessNames[a.status])+'</p>'+(a.login?'<small>Логин: '+esc(a.login)+'</small>':'<small>Сотрудник должен открыть приглашение на своём телефоне и задать логин и пароль.</small>')+'</div>'+a.assignments.map(s=>'<div class="staff-role-editor"><label>Роль · '+esc(s.locationName)+'<select data-staff-role-select="'+a.actor_id+'" data-location="'+esc(s.location_id)+'">'+Object.entries(roleNames).map(([value,label])=>'<option value="'+value+'"'+(value===(s.staff_role==='kitchen'&&s.can_accept_payments?'kitchen_cashier':s.staff_role)?' selected':'')+'>'+label+'</option>').join('')+'</select></label><button type="button" data-save-staff-role="'+a.actor_id+'" data-location="'+esc(s.location_id)+'">Сохранить роль</button></div>').join('')+(['invited','expired','not_created'].includes(a.status)?'<button type="button" data-reinvite-staff="'+a.actor_id+'" data-staff-name="'+esc(a.name)+'">Получить ссылку приглашения</button>':a.status==='active'&&Number(a.actor_id)!==auth.actorId()?'<button type="button" data-disable-staff="'+a.actor_id+'">Отключить</button>':'')+'</article>').join('')||'<p>Сотрудников пока нет. Создайте приглашение выше.</p>';filterStaff();$('webStaffStatus').textContent='Сотрудников в списке: '+employees.length;
 })().finally(()=>{staffLoading=null;});
 return staffLoading;
}
function expiredInviteButton(employee){
 if(employee.status!=='expired'||!employee.inviteExpiresAt)return '';
 return '<button type="button" class="staff-dismiss-expired" data-dismiss-expired-invite="'+esc(employee.actor_id)+'" data-invite-expires="'+esc(employee.inviteExpiresAt)+'" aria-label="Убрать истёкшее приглашение — '+esc(employee.name)+'" title="Убрать истёкшее приглашение"><span aria-hidden="true">×</span></button>';
}
function showInvite(token,name){$('webInvitePanel').open=true;const url=new URL('staff.html',location.href);url.hash=new URLSearchParams({invite:token});$('webInviteLink').href=url.href;$('webInviteLink').textContent='Открыть приглашение для '+name;$('webInviteLink').hidden=false;$('webInviteCopy').hidden=false;$('webInviteResult').textContent='Передайте ссылку сотруднику: он открывает её на своём телефоне и создаёт логин и пароль. Для проверки на вашем телефоне откройте ссылку в режиме «Инкогнито», чтобы сохранить вход владельца. Ссылка действует 48 часов и используется один раз.';}
$('webStaffList').onclick=async e=>{const b=e.target.closest('[data-disable-staff],[data-reinvite-staff],[data-save-staff-role],[data-dismiss-expired-invite]');if(!b)return;b.disabled=true;try{if(b.dataset.dismissExpiredInvite){await api('staffDismissExpiredInvite',{actorId:Number(b.dataset.dismissExpiredInvite),inviteExpiresAt:b.dataset.inviteExpires});await staffLoading?.catch(()=>{});}else if(b.dataset.saveStaffRole){const select=[...$('webStaffList').querySelectorAll('[data-staff-role-select]')].find(s=>s.dataset.staffRoleSelect===b.dataset.saveStaffRole&&s.dataset.location===b.dataset.location);await api('staffRoleUpdate',{actorId:Number(b.dataset.saveStaffRole),locationId:b.dataset.location,role:select.value});}else if(b.dataset.reinviteStaff){const d=await api('inviteExisting',{actorId:Number(b.dataset.reinviteStaff)});showInvite(d.invite,b.dataset.staffName);$('webInviteResult').scrollIntoView({behavior:'smooth',block:'center'});}else await api('staffDisable',{actorId:Number(b.dataset.disableStaff)});await staffList();}catch(err){$('webStaffStatus').textContent=err.message;b.disabled=false;}};
$('webStaffList').onchange=e=>{if(e.target.matches('[data-staff-role-select]'))e.target.dataset.roleDirty='true';};
$('webStaffRefresh').onclick=()=>void staffList().catch(e=>$('webStaffStatus').textContent=e.message);
$('webInviteForm').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;try{const d=await api('inviteStaff',{name:$('webStaffName').value,locationId:$('webStaffLocation').value,role:$('webStaffRole').value});showInvite(d.invite,$('webStaffName').value);await staffList();}catch(err){$('webInviteResult').textContent=err.message;}finally{button.disabled=false;}};
setInterval(()=>{if(me&&currentTab==='admin'&&!document.hidden&&!$('webStaffList').querySelector('[data-role-dirty]')&&!$('webStaffList').contains(document.activeElement))void staffList().catch(e=>$('webStaffStatus').textContent=e.message);},10000);
const overview = $('webOverview');
const overviewLocation = $('webOverviewLocation');
let overviewRequest, overviewHasMetrics = false;
function setOverviewCounter(field, label, hasItems) {
 field.textContent = label;
 field.closest('.work-overview-link')?.toggleAttribute('data-has-items', hasItems);
}
function clearOverview() {
 overviewHasMetrics = false;
 for (const field of overview.querySelectorAll('[data-overview]')) {
  setOverviewCounter(field, '—', false);
 }
 $('webOverviewStock').hidden = true;
}
async function loadOverview() {
 if (currentTab !== 'overview' || !overviewLocation.value || document.hidden) return;
 const id = overviewLocation.value;
 if (overviewRequest?.id === id) return;
 const request = {id};
 overviewRequest = request;
 const status = $('webOverviewStatus');
 if (!overviewHasMetrics) status.textContent = 'Загружаем сводку…';
 $('webOverviewRefresh').disabled = true;
 try {
  const {metrics, soldOut} = await api('managerOverview', {locationId:id});
  if (overviewRequest !== request) return;
  for (const field of overview.querySelectorAll('[data-overview]')) {
   const value = metrics[field.dataset.overview];
   const label = value == null ? '—' : field.dataset.overview === 'revenue' ? money(value) : String(value);
   setOverviewCounter(field, label, Number(value) > 0);
  }
  $('webOverviewStockList').replaceChildren(...soldOut.map(name => {
   const item = document.createElement('li');
   item.textContent = name;
   return item;
  }));
  $('webOverviewStock').hidden = soldOut.length === 0;
  overviewHasMetrics = true;
  status.textContent = '';
 } catch (error) {
  if (overviewRequest !== request) return;
  if (error.status === 401 || error.status === 403) clearOverview();
  status.textContent = (overviewHasMetrics ? 'Показаны последние полученные данные. ' : '') + error.message;
 } finally {
  if (overviewRequest === request) {
   overviewRequest = null;
   $('webOverviewRefresh').disabled = false;
  }
 }
}
function updateOverviewLinks() {
 overview.querySelector('[data-overview-tab="cashOrders"]').hidden =
  !me || (me.user.role !== 'super_admin' && !me.assignments?.some(a =>
   a.location_id === overviewLocation.value && a.staff_role === 'manager' && a.can_accept_payments));
}
const storefrontPanel=$('webStorefront');
if(storefrontPanel){
 const form=$('webStorefrontForm'),status=$('webStorefrontStatus'),retry=$('webStorefrontRetry');
 const fields=form.elements;
 let placements=[], revision=0;

 function fillPlacement(){
  const row=placements.find(item=>item.product_id===fields.productId.value&&item.section===fields.section.value);
  fields.enabled.checked=row?.enabled??true;
  fields.allowPreorder.checked=row?.allow_preorder??false;
  fields.serviceDate.required=fields.section.value==='dish-day';
  fields.serviceDate.value=row?.service_date||'';
  fields.startsAt.value=row?.starts_at?.slice(0,5)||'';
  fields.endsAt.value=row?.ends_at?.slice(0,5)||'';
 }

 async function loadStorefront(){
  const locationId=overviewLocation.value;
  if(!locationId||!storefrontPanel.open)return;
  const request=++revision;
  form.hidden=true;
  retry.hidden=true;
  status.textContent='Загружаем разделы…';
  try{
   const data=await api('storefrontList',{locationId},'cafe-web-storefront');
   if(request!==revision||locationId!==overviewLocation.value)return;
   const selected=fields.productId.value;
   fields.productId.replaceChildren(...data.products.map(item=>new Option(item.name_ru,item.id)));
   if(data.products.some(item=>item.id===selected))fields.productId.value=selected;
   placements=data.assignments;
   fillPlacement();
   form.hidden=!data.products.length;
   status.textContent=data.products.length?'':'Нет активных блюд.';
  }catch(error){
   if(request!==revision||locationId!==overviewLocation.value)return;
   status.textContent=error.message;
   retry.hidden=false;
  }
 }

 form.onsubmit=async event=>{
  event.preventDefault();
  if(!form.reportValidity())return;
  const request=++revision,locationId=overviewLocation.value;
  const payload={locationId,productId:fields.productId.value,section:fields.section.value,
   startsAt:fields.startsAt.value,endsAt:fields.endsAt.value,serviceDate:fields.serviceDate.value,
   enabled:fields.enabled.checked,allowPreorder:fields.allowPreorder.checked};
  for(const control of fields)control.disabled=true;
  status.textContent='Сохраняем…';
  try{
   await api('storefrontSave',payload,'cafe-web-storefront');
   if(request!==revision||locationId!==overviewLocation.value)return;
   const index=placements.findIndex(item=>item.product_id===payload.productId&&item.section===payload.section);
   const row={product_id:payload.productId,section:payload.section,starts_at:payload.startsAt,
    ends_at:payload.endsAt,service_date:payload.serviceDate,enabled:payload.enabled,allow_preorder:payload.allowPreorder};
   if(index<0)placements.push(row);
   else placements[index]=row;
   status.textContent='Раздел сохранён.';
  }catch(error){
   if(request===revision&&locationId===overviewLocation.value)status.textContent=error.message;
  }finally{
   for(const control of fields)control.disabled=false;
  }
 };

 fields.productId.onchange=fields.section.onchange=fillPlacement;
 storefrontPanel.addEventListener('toggle',loadStorefront);
 overviewLocation.addEventListener('change',loadStorefront);
 retry.onclick=loadStorefront;
}
overviewLocation.onchange = () => {
 clearOverview();
 updateOverviewLinks();
 void loadOverview();
};
$('webOverviewRefresh').onclick = loadOverview;
document.addEventListener('umma:staff-inbox-counts',event=>{
 for(const field of overview.querySelectorAll('[data-inbox-metric]')){
  const value = event.detail[field.dataset.inboxMetric];
  setOverviewCounter(field, String(value), Number(value) > 0);
 }
});
overview.querySelectorAll('[data-overview-tab]').forEach(button => {
 button.onclick = () => {
  tab(button.dataset.overviewTab, overviewLocation.value,button.dataset.orderFilter);
  window.scrollTo({top:0,behavior:'instant'});
 };
});
window.addEventListener('online', loadOverview);
document.addEventListener('visibilitychange', loadOverview);
setInterval(loadOverview, 15000);

const workModes=$('webWorkModes');
let hasCombinedRole=false;
function tab(name, cafeId, orderFilter){
 const cash=name==='pos'||name==='cashOrders';
 const counter=name==='pos';
 const choosingMode=name==='workModes';
 const nav=document.querySelector('[data-web-tab="'+(cash?'pos':name)+'"]');
 if(choosingMode?!hasCombinedRole:!nav||nav.hidden)return;
 if(counter&&currentTab!=='pos'){
  if(currentTab)counterReturn=currentTab;
  if(cafeId&&cafeId!==locationId()&&!cart.size&&!payOrder&&Array.from($('posLocation').options).some(option=>option.value===cafeId)){
   $('posLocation').value=cafeId;
   $('posLocation').dispatchEvent(new Event('change'));
  }
 }
 if(name!==currentTab&&(counter||currentTab==='pos'))counterOrdersRevision++;
 currentTab=name;notice('');
 $('webMainHeader').hidden=counter;
 $('webMainNav').hidden=counter||choosingMode;
 workModes.hidden=!choosingMode;
 overview.hidden=name!=='overview';
 document.body.dataset.workspace=name;
 $('posCartJump').hidden=name!=='pos'||!cart.size;
 document.querySelector('.web-account-menu')?.removeAttribute('open');
 $('webPos').hidden=name!=='pos';$('webAdmin').hidden=name!=='admin';
 $('webMessages').hidden=name!=='messages';
 $('webCashViews').hidden=name!=='cashOrders';
 $('cafeKitchenPage').hidden=!['cashOrders','orders','kitchen','courier'].includes(name);
 if(counter){setCounterView('sale');void refreshCounterOrders();}
 else window.ummaKitchenLive?.updateCounterIssues?.([]);
 document.querySelectorAll('[data-web-tab]').forEach(b=>b.setAttribute('aria-current',String(b===nav)));
 document.querySelectorAll('[data-cash-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.cashView===name)));
 if(!$('cafeKitchenPage').hidden){
  const boardArgs=[name==='courier',name==='cashOrders'?'payment':orderFilter||'active'];
  if(cafeId)boardArgs.push(cafeId);
  window.ummaKitchen.open(...boardArgs);
 }
 if(name==='portions'&&cafeId){
  const stockLocation=$('readyStockLocation');
  if(Array.from(stockLocation.options).some(o=>o.value===cafeId)&&stockLocation.value!==cafeId){
   stockLocation.value=cafeId;
   stockLocation.dispatchEvent(new Event('change'));
  }
 }
 document.dispatchEvent(new CustomEvent('umma:staff-tab',{detail:name}));
 if(name==='overview')void loadOverview();
 if(name==='admin')void staffList().catch(e=>$('webStaffStatus').textContent=e.message);
}
document.querySelectorAll('[data-web-tab],[data-cash-view],[data-work-mode]').forEach(button=>{
 button.onclick=()=>{
  tab(button.dataset.webTab||button.dataset.cashView||button.dataset.workMode);
  window.scrollTo({top:0,behavior:'instant'});
 };
});
$('counterExit').onclick=()=>{
 if(busy)return;
 tab(hasCombinedRole?'kitchen':counterReturn);
 window.scrollTo({top:0,behavior:'instant'});
};
$('webCashShift').onclick=()=>{
 if(currentTab!=='cashOrders')tab('cashOrders');
 const panel=$('cafeCashPanel');
 if(panel?.hidden)$('cafeCashToggle').click();
 else panel?.scrollIntoView({behavior:'smooth',block:'start'});
};
$('webInviteCopy')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('webInviteLink').href);$('webInviteResult').textContent='Приглашение скопировано. Передайте его сотруднику.';}catch{$('webInviteResult').textContent='Нажмите и удерживайте ссылку приглашения, затем выберите «Копировать ссылку».';}});
function syncWorkKeyboard(){const viewport=window.visualViewport;const field=document.activeElement;const editing=field&&/^(INPUT|TEXTAREA|SELECT)$/.test(field.tagName);const closedHeight=document.documentElement.clientHeight||window.innerHeight;document.body.classList.toggle('work-keyboard-open',Boolean(viewport&&editing&&closedHeight-viewport.height>140));}
window.visualViewport?.addEventListener('resize',syncWorkKeyboard);document.addEventListener('focusin',syncWorkKeyboard);document.addEventListener('focusout',()=>document.body.classList.remove('work-keyboard-open'));

const cashField=$('posCash');
const cashPanel=cashField.closest('.counter-payment-controls');
const cashViewport=window.visualViewport;
let cashClosedHeight=0;
let cashViewportWidth=0;
function syncCashKeyboard(){
 const layoutHeight=document.documentElement.clientHeight||window.innerHeight;
 const height=cashViewport?.height||layoutHeight;
 const width=document.documentElement.clientWidth||window.innerWidth;
 const docked=document.body.classList.contains('counter-cash-keyboard');
 const active=document.activeElement;
 const editing=active===cashField||docked&&(active===$('posSubmit')||active===document.body);
 const visible=currentTab==='pos'&&counterView==='payment'&&!$('posForm').hidden&&!$('posCashLabel').hidden&&!cashField.disabled;
 if(!editing||!visible||width!==cashViewportWidth){
  cashClosedHeight=layoutHeight;
  cashViewportWidth=width;
 }
 // Android can resize the layout viewport. Safari usually resizes only the visual viewport.
 const layoutResized=window.matchMedia?.('(any-pointer: coarse)').matches&&cashClosedHeight-layoutHeight>120;
 const viewportReduced=layoutHeight-height>120;
 const keyboard=editing&&visible&&(layoutResized||viewportReduced);
 if(keyboard){
  const bottom=(cashViewport?.offsetTop||0)+height;
  cashPanel.style.setProperty('--counter-keyboard-inset',Math.max(0,layoutHeight-bottom)+'px');
  cashPanel.style.setProperty('--counter-keyboard-height',height+'px');
 }else if(!viewportReduced&&!layoutResized){
  cashClosedHeight=layoutHeight;
 }
 document.body.classList.toggle('counter-cash-keyboard',keyboard);
}
document.addEventListener('focusin',syncCashKeyboard);
document.addEventListener('focusout',()=>window.requestAnimationFrame(syncCashKeyboard));
window.addEventListener('resize',syncCashKeyboard);
cashViewport?.addEventListener('resize',syncCashKeyboard);
cashViewport?.addEventListener('scroll',syncCashKeyboard);
$('posCartJump').onclick=()=>{
 $('counterSale').dataset.basket='open';
 $('counterContent').scrollTop=0;
 updateCartJump();
 $('posBackToProducts').focus();
};
$('posBackToProducts').onclick=()=>{
 delete $('counterSale').dataset.basket;
 $('counterContent').scrollTop=0;
 updateCartJump();
 $('posSearch').focus({preventScroll:true});
};
$('webLogout').onclick=async()=>{try{await api('logout');}catch{}auth.clear();location.replace(new URL('staff.html',location.href));};
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});$('webInstall').onclick=async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null;}else notice('В меню браузера выберите «Установить приложение» или «Добавить на главный экран». В Safari: «Поделиться» → «На экран Домой».');};
async function boot(){me=await api('me');window.ummaCafeEpoch?.apply(me.cafeResetEpoch);auth.setActor(Number(me.user.id));window.ummaRole=me.user.role;window.ummaUser=me.user;$('webIdentity').textContent=me.user.name||'Сотрудник';$('webLogin').hidden=true;$('webLogout').hidden=false;
const owner=me.user.role==='super_admin',roles=me.assignments||[],sell=owner||roles.some(a=>['cashier','manager','kitchen'].includes(a.staff_role)&&a.can_accept_payments),courier=owner||roles.some(a=>a.staff_role==='courier'),kitchen=owner||roles.some(a=>a.staff_role!=='courier');
const roleLabels={manager:'Менеджер',cashier:'Кассир',kitchen:'Кухня',waiter:'Официант',courier:'Курьер'};
const isCombinedRole=a=>a.staff_role==='kitchen'&&a.can_accept_payments===true;
$('webRole').textContent=owner?'Владелец':Array.from(new Set(roles.map(a=>isCombinedRole(a)?'Стойка и кухня':roleLabels[a.staff_role]).filter(Boolean))).join(' · ');
const canMessage=owner||roles.some(a=>['manager','cashier','waiter'].includes(a.staff_role));
const managerLocations=me.locations.filter(l=>owner||roles.some(a=>a.location_id===l.id&&a.staff_role==='manager'));
overviewLocation.replaceChildren(...managerLocations.map(l=>{
 const option=document.createElement('option');option.value=l.id;option.textContent=l.name;return option;
}));
const hasSingleCafe=managerLocations.length===1;
overviewLocation.closest('label').hidden=hasSingleCafe;
$('webOverviewCafeName').hidden=!hasSingleCafe;
$('webOverviewCafeName').textContent=hasSingleCafe?managerLocations[0].name:'';
updateOverviewLinks();
const hasKitchen=owner||roles.some(a=>['kitchen','manager'].includes(a.staff_role));
const hasOrderDesk=owner||sell||roles.some(a=>['manager','cashier','waiter'].includes(a.staff_role));
const stockLocations=me.locations.filter(l=>owner||roles.some(a=>a.location_id===l.id&&['kitchen','manager'].includes(a.staff_role)));
hasCombinedRole=!owner&&roles.some(a=>isCombinedRole(a)&&stockLocations.some(l=>l.id===a.location_id));
$('webStockLink').hidden=requested==='stock'||!stockLocations.length;
$('webOwnerManagerLink').hidden=requested==='owner-manager'||!stockLocations.length;
if(requested==='owner-manager'){
 document.body.dataset.workspace='owner-manager';
 $('webWorkspace').hidden=true;
 const root=$('webOwnerManager');
 root.hidden=false;
 root.ummaLocations=stockLocations;
 document.dispatchEvent(new Event('umma:owner-manager-open'));
 return;
}
if(requested==='stock'){
 currentTab='stock';
 document.body.dataset.workspace='stock';
 $('webWorkspace').hidden=true;
 $('webIngredients').hidden=!stockLocations.length;
 $('webStockDenied').hidden=!!stockLocations.length;
 if(stockLocations.length)document.dispatchEvent(new CustomEvent('umma:ingredient-stock-open',{detail:stockLocations}));
 return;
}
$('webWorkspace').hidden=false;
for(const [name,allowed]of [['overview',!!managerLocations.length],['pos',sell],['kitchen',hasKitchen],['portions',!!stockLocations.length],['orders',hasOrderDesk],['courier',courier],['admin',!!managerLocations.length],['messages',canMessage]])document.querySelector('[data-web-tab="'+name+'"]').hidden=!allowed;
const options=(sell&& !owner?me.locations.filter(l=>roles.some(a=>a.location_id===l.id&&['cashier','manager','kitchen'].includes(a.staff_role)&&a.can_accept_payments)):me.locations).map(l=>'<option value="'+esc(l.id)+'">'+esc(l.name)+'</option>').join('');$('posLocation').innerHTML=options;$('webStaffLocation').innerHTML=me.locations.map(l=>'<option value="'+esc(l.id)+'">'+esc(l.name)+'</option>').join('');
$('counterCafeLabel').hidden=$('posLocation').options.length<2;
counterReturn=managerLocations.length?'overview':roles.some(a=>a.staff_role==='cashier')?'cashOrders':hasKitchen?'kitchen':'orders';
$('counterExit').textContent=hasCombinedRole?'Кухня':'К работе кафе';
$('webInvitePanel').hidden=!owner;
$('webStaffDescription').textContent=owner?'Управляйте ролями и доступом сотрудников к рабочему кабинету.':'Сотрудники, назначенные в ваши кафе.';
document.body.classList.toggle('work-owner',owner);
document.body.classList.toggle('work-counter-alerts',owner||roles.some(a=>['kitchen','manager'].includes(a.staff_role)&&a.can_accept_payments));
document.body.classList.toggle('work-waiter',roles.some(a=>a.staff_role==='waiter')&&!owner&&!managerLocations.length);
document.body.classList.toggle('work-cash-access', sell||!!managerLocations.length||roles.some(a=>a.staff_role==='waiter'&&a.can_accept_payments));
document.dispatchEvent(new CustomEvent('umma:staff-ready',{detail:me}));
tab(canMessage&&requested==='messages'?'messages':requested==='counter'&&sell?'pos':managerLocations.length?'overview':hasCombinedRole?'workModes':sell?'pos':hasKitchen?'kitchen':kitchen?'orders':'courier');
if(sell){
 try{
  const r=await fetch(base+'cafe-menu',{signal:AbortSignal.timeout(15000)}),d=await r.json();
  if(!r.ok||!d.ok)throw Error('Не удалось загрузить меню');
  products=(d.products||[]).filter(p=>p.is_active!==false&&p.price_vnd!=null&&!p.catalog_preview&&!p.photo_only);
  cafeLocations=d.locations||[];inventory=d.inventory||[];stockControl=d.inventoryControlEnabled===true;try{await loadAvailability();}catch(error){notice(error.message);}renderCart();menu();showPair(screen());
 }catch(error){$('posProducts').textContent=error.message+'. Обновите страницу для повторной загрузки.';}
}
}
$('webLoginForm').onsubmit=async e=>{e.preventDefault();$('webLoginSubmit').disabled=true;$('webLoginSubmit').textContent=invite?'Создаём доступ…':'Входим…';$('webLoginError').textContent='';try{const d=await api(invite?'activate':'login',{login:$('webLoginName').value,password:$('webPassword').value,...(invite?{invite}:{})});auth.save(d.token);history.replaceState(null,'',location.pathname+location.search);$('webPassword').value='';await boot();}catch(err){$('webLoginError').textContent=err.message;}finally{$('webLoginSubmit').disabled=false;$('webLoginSubmit').textContent=invite?'Создать доступ':'Войти';}};
// A recovered order still needs its payment checked against the actual receipt.
document.addEventListener('umma:cafe-operation-recovered',async event=>{
 const {payload,result:recovered}=event.detail;
 if(!payload.staffOrder||!recovered.order||currentTab!=='pos')return;
 if(payload.locationId!==locationId()){
  if(!Array.from($('posLocation').options).some(option=>option.value===payload.locationId))return;
  $('posLocation').value=payload.locationId;
  $('posLocation').dispatchEvent(new Event('change'));
 }
 const items=payload.items.map(line=>{
  const product=products.find(item=>item.id===line.productId);
  return {product_name_ru:product?.name_ru||product?.name_en||'Блюдо',quantity:line.quantity};
 });
 const recoveredSale={orderType:payload.orderType||'pickup',deliveryAddress:payload.deliveryAddress,...recovered.order,items,staffCounter:true,paymentMethod:recovered.paymentMethod||(payload.action==='create'?'bank_transfer':payload.paymentMethod),
  paymentStatus:recovered.paymentStatus||'pending',status:recovered.status||recovered.order.status};
 cart.clear();resetSaleService();$('posCash').value='';renderCart();
 setCounterView('payment');showPayment(recoveredSale);
 try{
  showPayment(recoveredSale,recovered.payment||await paymentDetails(recoveredSale));
  result(recoveredSale.paymentStatus==='paid'?'Оплата подтверждена.':'Прежний заказ восстановлен. Проверьте оплату.');
 }
 catch(error){result(error.message);}
 void refreshCounterOrders();
});
let stockRefreshing=false;
async function refreshStock(){
 if(!me||stockRefreshing||busy||document.hidden||currentTab!=='pos')return;
 stockRefreshing=true;
 try{
  const response=await fetch(base+'cafe-menu',{cache:'no-store',signal:AbortSignal.timeout(12000)});
  const data=await response.json();
  if(response.ok&&data.ok){cafeLocations=data.locations||[];inventory=data.inventory||[];await loadAvailability();menu();paymentFields();}
 }catch{}finally{stockRefreshing=false;}
}
document.addEventListener('umma:stock-changed',refreshStock);
document.addEventListener('umma:cafe-events',refreshCounterOrders);
document.addEventListener('visibilitychange',refreshCounterOrders);
window.addEventListener('online',refreshCounterOrders);
setInterval(refreshStock,5000);
setInterval(refreshCounterOrders,5000);
document.addEventListener('umma:fulfillment-realtime',()=>{
 void refreshCounterOrders();
 if (!$('cafeKitchenPage')?.hidden && currentTab!=='pos') void window.ummaKitchen?.refresh({silent:true,afterMutation:true});
});
setInterval(()=>{if($('screenPairState').dataset.syncError)syncCustomerScreen(true);},5000);
if(auth.credential()&&!invite)void boot().catch(e=>{$('webLoginError').textContent=e.message;notice(e.message);if(e.status===401)auth.clear();});
})();
