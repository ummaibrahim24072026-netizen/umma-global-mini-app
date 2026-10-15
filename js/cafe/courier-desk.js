/* Courier shift presence is private to dispatch; customer tracking remains delivery-scoped. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
 const money=n=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(Number(n)||0);
 let board=null,tab='available',tabChosen=false,watch=null,position=null,lastPositionSent=0,positionSending=false,shiftBusy=false,gpsError='',generation=0,heartbeat=null,heartbeatRequest=null;
 async function api(body){const initData=window.Telegram?.WebApp?.initData;if(!initData)throw Error('Откройте приложение через Telegram');const r=await fetch('https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-kitchen',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,initData}),signal:AbortSignal.timeout(12000)});const data=await r.json();if(!r.ok||!data.ok)throw Error(data.error||'Не удалось обновить рабочий статус');return data;}
 function notice(text){const el=$('courierDeskMessage');if(el)el.textContent=text;}
 function stopGeo(){generation++;if(watch!==null)navigator.geolocation?.clearWatch(watch);watch=null;position=null;lastPositionSent=0;}
 async function publish(p){
  if(!board?.online||document.hidden||positionSending||Date.now()-lastPositionSent<20000)return;
  if(!Number.isFinite(p.coords.accuracy)||p.coords.accuracy>500||Date.now()-p.timestamp>90000){gpsError='GPS пока неточный';updateGpsLabel();return;}
  positionSending=true;const session=generation;
  try{await api({action:'courierPosition',latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy});if(session!==generation)return;lastPositionSent=Date.now();gpsError='';board.gpsFresh=true;updateGpsLabel();void window.ummaKitchen?.refresh({silent:true});}
  catch(e){if(session===generation){gpsError='Не удалось отправить GPS';updateGpsLabel();}}
  finally{positionSending=false;}
 }
 function updateGpsLabel(){const retry=$('courierDeskGpsRetry');if(retry)retry.hidden=!board?.online||!gpsError;const label=$('courierDeskGps');if(label)label.textContent=!board?.online?'GPS для подбора включится при выходе на линию':gpsError||(board.gpsFresh?'GPS обновлён · расстояния по прямой':'Определяем GPS для ближайших предложений…');}
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
  try{if(heartbeatRequest)await heartbeatRequest;await api({action:'courierAvailability',online:target});board.online=target;if(target){startHeartbeat();startGeo();}else{stopGeo();board.gpsFresh=false;}await window.ummaKitchen?.refresh({afterMutation:true});}
  catch(e){notice(e.message);}
  finally{shiftBusy=false;const current=$('courierDeskOnline');if(current){current.disabled=!board?.eligible;current.textContent=board.online?'Уйти с линии':'Выйти на линию';}}
 }
 function showTab(next){tab=next;tabChosen=true;applyTab();}
 function applyTab(){
  document.querySelectorAll('[data-courier-tab]').forEach(b=>{const active=b.dataset.courierTab===tab;b.classList.toggle('is-active',active);b.setAttribute('aria-selected',String(active));});
  if($('courierAvailablePool'))$('courierAvailablePool').hidden=tab!=='available';
  const orders=$('cafeKitchenOrders');if(orders)orders.hidden=tab==='available';
  if(tab!=='available')document.querySelector('[data-kitchen-filter="'+(tab==='history'?'closed':'active')+'"]')?.click();
 }
 function offerCard(o,exclusive){
  const distance=Number.isFinite(o.pickupDistanceM)?(o.pickupDistanceM<1000?Math.round(o.pickupDistanceM)+' м':(o.pickupDistanceM/1000).toFixed(1)+' км'):'GPS не определён';
  const cash=o.paymentStatus==='paid'?'Заказ оплачен':o.paymentTiming==='on_delivery'?'Получить у клиента: '+money(o.totalVnd):'Оплата через кафе';
  return '<article class="courier-offer-card" data-desk-order="'+esc(o.orderId)+'"><div class="courier-offer-top"><strong>№'+esc(o.orderNumber)+'</strong><span class="courier-ready '+(o.kitchenStatus==='ready'?'is-ready':'')+'">'+(o.kitchenStatus==='ready'?'Можно забирать':'Готовится')+'</span></div>'+
   '<div class="courier-offer-route"><div><small>Забрать</small><strong>'+esc(o.locationName||'Кафе UMMA')+'</strong><span>'+esc(o.pickupAddress||'Адрес кафе после принятия')+'</span></div><div><small>Доставить</small><strong>'+esc(o.deliveryAddress?.trim()||'Точка клиента на карте')+'</strong></div></div>'+
   '<div class="courier-offer-facts"><span>До кафе: '+esc(distance)+(Number.isFinite(o.pickupDistanceM)?' по прямой':'')+'</span><span>'+esc(cash)+'</span>'+(Number(o.deliveryFeeVnd)>0?'<span>Стоимость доставки: '+esc(money(o.deliveryFeeVnd))+'</span>':'')+'</div>'+
   (exclusive?'<p class="courier-offer-deadline">Предложено вам · <span data-courier-deadline="'+esc(o.expiresAt||'')+'">Обновляем время…</span></p>':'')+
   '<div class="kitchen-order-actions"><button type="button" class="kitchen-action" '+(exclusive?'data-courier-accept':'data-courier-claim')+'="'+esc(o.orderId)+'">'+(exclusive?'Принять доставку':'Взять доставку')+'</button>'+(exclusive?'<button type="button" class="kitchen-cancel" data-courier-decline="'+esc(o.orderId)+'">Отказаться</button>':'')+'</div><p class="courier-offer-feedback" role="status" data-courier-offer-feedback></p></article>';
 }
 function updateDeadlines(){document.querySelectorAll('[data-courier-deadline]').forEach(el=>{const remaining=Math.ceil((Date.parse(el.dataset.courierDeadline)-Date.now())/1000);el.textContent=Number.isFinite(remaining)&&remaining>0?remaining+' с на ответ':'Время предложения истекло';if(remaining<=0)el.closest('article')?.querySelectorAll('button').forEach(b=>b.disabled=true);});}
 function render(offers,data){
  const root=$('courierOffers');if(!root)return;
  if(!data){if(!board)root.innerHTML='<div class="courier-desk-empty">Подключаем рабочий экран курьера…</div>';return;}
  const previousOnline=board?.online;
  board=data||{online:false,eligible:false,busy:false,activeCount:0,completedToday:0,available:[],offers};
  if(!tabChosen)tab=Number(board.activeCount)>0?'work':'available';
  const available=[...(board.available||[])].sort((a,b)=>Number(b.kitchenStatus==='ready')-Number(a.kitchenStatus==='ready')||(a.pickupDistanceM??Infinity)-(b.pickupDistanceM??Infinity));
  const personal=board.offers||offers||[];
  const html='<section class="courier-shift-card"><div><small>UMMA · КУРЬЕР</small><h2>'+(board.online?(board.busy?'Вы на доставке':'Вы на линии'):'Готовы к доставкам?')+'</h2><p>'+(board.online?'Новые предложения учитывают вашу доступность и GPS.':'Выйдите на линию, чтобы получать и выбирать заказы.')+'</p></div><button type="button" id="courierDeskOnline" '+(!board.eligible||shiftBusy?'disabled':'')+'>'+(board.online?'Уйти с линии':'Выйти на линию')+'</button><small id="courierDeskGps"></small><button type="button" id="courierDeskGpsRetry" class="courier-gps-retry" hidden>Обновить GPS</button><p id="courierDeskMessage" role="status" aria-live="polite"></p></section>'+
   '<div class="courier-desk-stats"><div><strong>'+Number(board.activeCount||0)+'</strong><span>В работе</span></div><div><strong>'+Number(board.completedToday||0)+'</strong><span>Доставлено сегодня</span></div></div>'+
   '<nav class="courier-desk-tabs" role="tablist" aria-label="Доставки курьера"><button type="button" role="tab" data-courier-tab="available">Доступные · '+available.length+'</button><button type="button" role="tab" data-courier-tab="work">В работе · '+Number(board.activeCount||0)+'</button><button type="button" role="tab" data-courier-tab="history">История</button></nav>'+
   (personal.length?'<section class="courier-personal-offers"><h3>Предложено вам</h3>'+personal.map(o=>offerCard(o,true)).join('')+'</section>':'')+
   '<section id="courierAvailablePool"><div class="courier-pool-heading"><h3>Свободные доставки</h3><small>Сначала готовые к выдаче</small></div>'+(available.length?available.map(o=>offerCard(o,false)).join(''):'<div class="courier-desk-empty">'+(!board.eligible?'Подключите кафе в разделе «Кафе и доступ курьера».':!board.online?'Вы пока не на линии.':board.busy?'Завершите текущую доставку — после этого появятся новые заказы.':'Свободных доставок пока нет. Новые появятся автоматически.')+'</div>')+'</section>';
  if(root._deskMarkup!==html){root.innerHTML=html;root._deskMarkup=html;}
  applyTab();updateGpsLabel();updateDeadlines();
  if(board.online){startHeartbeat();startGeo();if(!previousOnline)void pulse();}else if(previousOnline)stopGeo();
  const setup=$('courierOwnerSetup');if(setup&&!board.eligible)setup.open=true;
 }
 document.addEventListener('click',e=>{const button=e.target.closest?.('button');if(button?.id==='courierDeskOnline')void setOnline();if(button?.id==='courierDeskGpsRetry'){stopGeo();gpsError='';startGeo();updateGpsLabel();}if(button?.dataset.courierTab)showTab(button.dataset.courierTab);});
 setInterval(()=>{if(!document.hidden)updateDeadlines();},1000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&board?.online){startGeo();void pulse();}});
 window.addEventListener('online',()=>{if(board?.online)void pulse();});
 window.addEventListener('pagehide',()=>{stopGeo();if(heartbeat!==null)clearInterval(heartbeat);heartbeat=null;});
 window.ummaCourierDesk={render,showTab};
})();
