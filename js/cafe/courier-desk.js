/* Courier shift presence is private to dispatch; customer tracking remains delivery-scoped. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const web=!!$('webOverview');
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
 const money=n=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(Number(n)||0);
 let board=null,tab='available',tabChosen=false,watch=null,position=null,lastPositionSent=0,positionSending=false,shiftBusy=false,gpsError='',generation=0,heartbeat=null,heartbeatRequest=null;
 async function api(body){const initData=(window.ummaStaffAuth?.credential()||window.Telegram?.WebApp?.initData);if(!initData)throw Error('Откройте приложение через Telegram');const r=await fetch('https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-kitchen',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,initData}),signal:AbortSignal.timeout(12000)});const data=await r.json();if(!r.ok||!data.ok)throw Error(data.error||'Не удалось обновить рабочий статус');return data;}
 let lastNotice='';
 function notice(text){lastNotice=text;const el=$('courierDeskMessage');if(el)el.textContent=text;}
 function connection(){const el=$('courierConnection');if(el){el.hidden=navigator.onLine!==false;el.textContent='Нет связи. Подключитесь к интернету перед изменением заказа.';}}
 function stopGeo(){generation++;if(watch!==null)navigator.geolocation?.clearWatch(watch);watch=null;position=null;lastPositionSent=0;}
 async function publish(p){
  if(!board?.online||document.hidden||positionSending||Date.now()-lastPositionSent<20000)return;
  if(!Number.isFinite(p.coords.accuracy)||p.coords.accuracy>500||Date.now()-p.timestamp>90000){gpsError='GPS пока неточный';updateGpsLabel();return;}
  positionSending=true;const session=generation;
  try{await api({action:'courierPosition',latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy});if(session!==generation)return;lastPositionSent=Date.now();gpsError='';board.gpsFresh=true;updateGpsLabel();void window.ummaKitchen?.refresh({silent:true});}
  catch(e){if(session===generation){gpsError='Не удалось отправить GPS';updateGpsLabel();}}
  finally{positionSending=false;}
 }
 function updateGpsLabel(){const retry=$('courierDeskGpsRetry');if(retry)retry.hidden=!board?.online||!gpsError;const label=$('courierDeskGps');if(label)label.textContent=!board?.online?'GPS для подбора включится при выходе на линию':gpsError||(board.gpsFresh?(web?'GPS активен':'GPS обновлён · расстояния по прямой'):'Определяем GPS…');}
 function startGeo(){
  if(!board?.online||watch!==null||document.hidden)return;
  if(!navigator.geolocation){gpsError='GPS недоступен. Выбирайте свободные заказы.';updateGpsLabel();return;}
  const session=++generation;
  try{watch=navigator.geolocation.watchPosition(p=>{if(session!==generation||!board?.online)return;position=p;void publish(p);},e=>{if(session!==generation)return;gpsError=e.code===1?'Разрешите геопозицию в настройках телефона. Свободные заказы доступны.':'Ожидаем сигнал GPS. Свободные заказы доступны.';updateGpsLabel();},{enableHighAccuracy:true,maximumAge:10000,timeout:15000});}
  catch{gpsError='GPS недоступен. Выбирайте свободные заказы.';updateGpsLabel();}
 }
 async function pulse(){
  if(!board?.online||document.hidden||shiftBusy||heartbeatRequest)return;
  const task=(async()=>{try{await api({action:'courierAvailability',online:true});if(position)void publish(position);startGeo();}catch{notice('Связь потеряна. Новые назначения возобновятся после подключения.');}})();
  heartbeatRequest=task;try{await task;}finally{heartbeatRequest=null;}
 }
 function startHeartbeat(){if(heartbeat===null)heartbeat=setInterval(()=>void pulse(),30000);}
 async function setOnline(){
  if(shiftBusy||!board?.eligible)return;
  const target=!board.online;shiftBusy=true;const button=$('courierDeskOnline');if(button){button.disabled=true;button.textContent=target?'Выходим на линию…':'Завершаем приём…';}
  try{if(heartbeatRequest)await heartbeatRequest;await api({action:'courierAvailability',online:target});notice('');board.online=target;if(target){startHeartbeat();startGeo();}else{stopGeo();board.gpsFresh=false;gpsError='';}await window.ummaKitchen?.refresh({afterMutation:true});}
  catch(e){notice(e.message);}
  finally{shiftBusy=false;const current=$('courierDeskOnline');if(current){current.disabled=!board?.eligible;current.textContent=board.online?'Уйти с линии':'Выйти на линию';}}
 }
 function showTab(next){tab=next;tabChosen=true;applyTab(true);}
 function applyTab(refreshOrders=false){
  document.querySelectorAll('[data-courier-tab]').forEach(b=>{const active=b.dataset.courierTab===tab;b.classList.toggle('is-active',active);b.setAttribute('aria-selected',String(active));});
  if($('courierAvailablePool'))$('courierAvailablePool').hidden=tab!=='available';
  if($('courierHistorySummary'))$('courierHistorySummary').hidden=tab!=='history';
  const orders=$('cafeKitchenOrders');if(orders)orders.hidden=tab==='available';
  if(tab!=='available'&&(!web||refreshOrders))document.querySelector('[data-kitchen-filter="'+(tab==='history'?'closed':'active')+'"]')?.click();
  if(web&&tab==='available'){
   const message=$('cafeKitchenMessage');
   if(message?.dataset.courierEmpty)message.hidden=true;
  }
 }
 function offerCard(o,exclusive){
  const distance=Number.isFinite(o.pickupDistanceM)?(o.pickupDistanceM<1000?Math.round(o.pickupDistanceM)+' м':(o.pickupDistanceM/1000).toFixed(1)+' км'):'GPS не определён';
  const cash=o.paymentStatus==='paid'?'Заказ оплачен':o.paymentTiming==='on_delivery'?'Получить у клиента: '+money(o.totalVnd):'Оплата через кафе';
  return '<article class="courier-offer-card" data-desk-order="'+esc(o.orderId)+'"><div class="courier-offer-top"><strong>№'+esc(o.orderNumber)+'</strong><span class="courier-ready '+(o.kitchenStatus==='ready'?'is-ready':'')+'">'+(o.kitchenStatus==='ready'?'Можно забирать':'Готовится')+'</span></div>'+
   '<div class="courier-offer-route"><div><small>Забрать</small><strong>'+esc(o.locationName||'Кафе UMMA')+'</strong><span>'+esc(o.pickupAddress||'Адрес кафе после принятия')+'</span></div><div><small>Доставить</small><strong>'+esc(o.deliveryAddress?.trim()||'Точка клиента на карте')+'</strong></div></div>'+
   '<div class="courier-offer-facts"><span>До кафе: '+esc(distance)+(Number.isFinite(o.pickupDistanceM)?' по прямой':'')+'</span><span>'+esc(cash)+'</span>'+(Number(o.deliveryFeeVnd)>0?'<span>Стоимость доставки: '+esc(money(o.deliveryFeeVnd))+'</span>':'')+'</div>'+
   (exclusive?'<p class="courier-offer-deadline">Предложено вам · <span data-courier-deadline="'+esc(o.expiresAt||'')+'">Обновляем время…</span></p>':'')+
   '<div class="kitchen-order-actions"><button type="button" class="kitchen-action" '+(web&&board.busy?'disabled ':'')+(exclusive?'data-courier-accept':'data-courier-claim')+'="'+esc(o.orderId)+'">'+(exclusive?'Принять доставку':web?'Взять заказ':'Взять доставку')+'</button>'+(exclusive?'<button type="button" class="kitchen-cancel" data-courier-decline="'+esc(o.orderId)+'">Отказаться</button>':'')+'</div><p class="courier-offer-feedback" role="status" data-courier-offer-feedback></p></article>';
 }
 function updateDeadlines(){document.querySelectorAll('[data-courier-deadline]').forEach(el=>{const remaining=Math.ceil((Date.parse(el.dataset.courierDeadline)-Date.now())/1000);el.textContent=Number.isFinite(remaining)&&remaining>0?remaining+' с на ответ':'Время предложения истекло';if(remaining<=0)el.closest('article')?.querySelectorAll('button').forEach(b=>b.disabled=true);});}
 function render(offers,data){
  const root=$('courierOffers');if(!root)return;
  if(!data){
   if(!board||web){
    root.innerHTML='<div class="courier-desk-empty">Загружаем доставки…</div>';
    root._deskMarkup=null;
   }
   if(web){tab='available';tabChosen=false;}
   return;
  }
  const previousOnline=board?.online;
  const previousActive=Number(board?.activeCount||0);
  board=data||{online:false,eligible:false,busy:false,activeCount:0,completedToday:0,available:[],offers};
  const active=Number(board.activeCount||0);
  const previousTab=tab;
  if(!tabChosen||(web&&tab==='work'&&previousActive>0&&active===0)||
     (web&&tab==='available'&&previousActive===0&&active>0))tab=active>0?'work':'available';
  const available=[...(board.available||[])].sort((a,b)=>Number(b.kitchenStatus==='ready')-Number(a.kitchenStatus==='ready')||(a.pickupDistanceM??Infinity)-(b.pickupDistanceM??Infinity));
  const personal=board.offers||offers||[];
  const badge=$('webCourierCount');
  const newCount=available.length+personal.length;
  if(badge){badge.hidden=newCount+active===0;badge.textContent=String(newCount+active);}
  if(web&&previousActive===0&&active>0)notice('Вам назначена доставка.');
  const shiftButton='<button type="button" id="courierDeskOnline" '+(!board.eligible||shiftBusy?'disabled':'')+'>'+(board.online?'Уйти с линии':'Выйти на линию')+'</button>';
  const shiftDetails='<small id="courierDeskGps"></small><button type="button" id="courierDeskGpsRetry" class="courier-gps-retry" hidden>Обновить GPS</button>';
  const shiftMessage='<p id="courierDeskMessage" role="status" aria-live="polite"></p>';
  const shift=web
   ? '<section class="courier-shift-card courier-shift-compact" aria-label="Приём доставок"><strong class="courier-shift-state" data-online="'+board.online+'">'+(board.online?'На линии':'Не на линии')+'</strong>'+shiftButton+(board.online?shiftDetails:'')+'</section>'+shiftMessage
   : '<section class="courier-shift-card"><div><small>UMMA · КУРЬЕР</small><h2>'+(board.online?(board.busy?'Вы на доставке':'Вы на линии'):'Готовы к доставкам?')+'</h2><p>'+(board.online?'Новые предложения учитывают вашу доступность и GPS.':'Выйдите на линию, чтобы получать и выбирать заказы.')+'</p></div>'+shiftButton+shiftDetails+shiftMessage+'</section><div class="courier-desk-stats"><div><strong>'+active+'</strong><span>В работе</span></div><div><strong>'+Number(board.completedToday||0)+'</strong><span>Доставлено сегодня</span></div></div>';
  const availableTab='<button type="button" role="tab" data-courier-tab="available">'+(web?'Новые':'Доступные')+' · '+(web?newCount:available.length)+'</button>';
  const workTab='<button type="button" role="tab" data-courier-tab="work">В работе'+(!web||active?' · '+active:'')+'</button>';
  const personalOffers=personal.length?'<section class="courier-personal-offers"><h3>Предложено вам</h3>'+personal.map(o=>offerCard(o,true)).join('')+'</section>':'';
  const cashBalance=web&&board.cashReceivedTodayVnd!=null
   ? '<p class="courier-cash-balance"><span>Принято наличными сегодня</span><strong>'+esc(money(board.cashReceivedTodayVnd))+'</strong></p>'
   : '';
  const html='<p id="courierConnection" class="courier-connection" role="status" hidden></p>'+shift+cashBalance+
   '<nav class="courier-desk-tabs" role="tablist" aria-label="Доставки курьера">'+(web?workTab+availableTab:availableTab+workTab)+'<button type="button" role="tab" data-courier-tab="history">История</button></nav>'+
   (web?'':personalOffers)+
   (web?'<p id="courierHistorySummary" hidden>Доставлено сегодня: '+Number(board.completedToday||0)+'</p>':'')+
   (web?'<div id="courierAvailablePool">'+personalOffers+
    (available.length?'<section><h3>Свободные доставки</h3>'+(board.busy?'<p class="courier-queue-note">Завершите текущую доставку, чтобы взять следующий заказ.</p>':'')+available.map(o=>offerCard(o,false)).join('')+'</section>':personal.length?'':'<div class="courier-desk-empty">'+(!board.eligible?($('courierOwnerSetup')?.hidden?'Доступ к доставкам выдаёт администратор кафе.':'Подключите кафе в настройках курьера ниже.'):!board.online?'Вы пока не на линии. Выйдите на линию, чтобы принимать заказы.':board.busy?'Новые заказы появятся после завершения текущей доставки.':'Новых доставок пока нет. Они появятся здесь автоматически.')+'</div>')+'</div>':
   '<section id="courierAvailablePool"><div class="courier-pool-heading"><h3>Свободные доставки</h3><small>Сначала готовые к выдаче</small></div>'+(available.length?available.map(o=>offerCard(o,false)).join(''):'<div class="courier-desk-empty">'+(!board.eligible?'Подключите кафе в разделе «Кафе и доступ курьера».':!board.online?'Вы пока не на линии.':board.busy?'Завершите текущую доставку — после этого появятся новые заказы.':'Свободных доставок пока нет. Новые появятся автоматически.')+'</div>')+'</section>');
  if(root._deskMarkup!==html){
   const feedback=$('courierDeskMessage')?.textContent??lastNotice;
   root.innerHTML=html;root._deskMarkup=html;
   if(web)notice(feedback);
  }
  applyTab(previousTab!==tab);updateGpsLabel();updateDeadlines();connection();
  if(!web)notice(lastNotice);
  if(board.online){startHeartbeat();startGeo();if(!previousOnline)void pulse();}else if(previousOnline)stopGeo();
  const setup=$('courierOwnerSetup');if(setup&&!board.eligible)setup.open=true;
 }
 window.addEventListener('offline',connection);
 window.addEventListener('online',connection);
 document.addEventListener('click',e=>{const button=e.target.closest?.('button');if(button?.id==='courierDeskOnline')void setOnline();if(button?.id==='courierDeskGpsRetry'){stopGeo();gpsError='';startGeo();updateGpsLabel();}if(button?.dataset.courierTab)showTab(button.dataset.courierTab);});
 setInterval(()=>{if(!document.hidden)updateDeadlines();},1000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&board?.online){startGeo();void pulse();}});
 window.addEventListener('online',()=>{if(board?.online)void pulse();});
 window.addEventListener('pagehide',()=>{stopGeo();if(heartbeat!==null)clearInterval(heartbeat);heartbeat=null;});
 window.ummaCourierDesk={render,showTab};
})();
