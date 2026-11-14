/* A private token grants read-only access to one order, never a customer's ID. */
(()=>{
'use strict';
const $=id=>document.getElementById(id),I=window.ummaMenuI18n,t=I.t;
const token=new URLSearchParams(location.hash.slice(1)).get('token')||'';
let road=null,routeRequest=0,routeOrigin=null;
let map=null,marker=null,trail=null,etaMinutes=null,lastFix=null,timer=null,controller=null,previous='',data=null,stopped=false,active=false,statusKey='',connectionKey='',notificationKey='Уведомления для открытой страницы';
const terminal=['delivered','completed','cancelled'];
const names={pending:'Заказ отправлен',confirmed:'Заказ принят',preparing:'Готовится',ready:'Заказ готов',waiting_courier:'Ищем курьера',courier_assigned:'Курьер назначен',picked_up:'Курьер в пути',delivered:'Заказ доставлен',completed:'Заказ выдан',cancelled:'Заказ отменён'};
const stages=['Заказ отправлен','Готовится','Заказ готов','Курьер назначен','Курьер в пути','Заказ доставлен'];
const stageRows=stages.map(()=>document.createElement('li'));
$('stages').append(...stageRows);
function isTerminal(d){return terminal.includes(d.state)||terminal.includes(d.orderStatus);}
function point(d){
 const lat=d?.latitude,lng=d?.longitude;
 return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180?{lat,lng}:null;
}
function hideMap(){
 if(map)map.remove();
 map=marker=trail=lastFix=road=routeOrigin=null;
 routeRequest++;
 delete $('map').closest('main').dataset.map;
 $('center').hidden=true;
 etaMinutes=null;
 $('map').hidden=true;
}
function estimateMinutes(from,to){
 // Straight-line distance with a local driving allowance. No road or traffic feed.
 const radians=Math.PI/180;
 const a=Math.sin((to.lat-from.lat)*radians/2)**2
   +Math.cos(from.lat*radians)*Math.cos(to.lat*radians)*Math.sin((to.lng-from.lng)*radians/2)**2;
 const km=12742*Math.asin(Math.sqrt(Math.min(1,a)));
 return Math.max(1,Math.ceil(km*1.4/18*60));
}
function drawPosition(d){
 const courier=point(d),destination=point(d.destination);
 const age=Date.now()-Date.parse(d.updatedAt);
 if(d.state!=='picked_up'||isTerminal(d)||!courier||!(age>=-10000&&age<60000)){
  hideMap();
  if(d.state==='picked_up'&&!isTerminal(d))connectionKey='Ожидаем свежую геопозицию курьера';
  return;
 }
 if(!routeOrigin)etaMinutes=destination?estimateMinutes(courier,destination):null;
 if(!window.L||!window.UmmaMaps){connectionKey='Не удалось загрузить карту';return;}
 const fix=[courier.lat,courier.lng];
 $('map').hidden=false;
 $('map').closest('main').dataset.map='';
 $('center').hidden=false;
 if(!map){
  map=UmmaMaps.create($('map'),courier,()=>{});
  map.zoomControl?.setPosition('bottomleft');
  marker=UmmaMaps.marker(map,courier,'courier');
  trail=L.polyline([fix],{color:'#478a80',weight:3,dashArray:'4 7'}).addTo(map);
  if(destination){
   UmmaMaps.marker(map,destination);
   map.fitBounds([fix,[destination.lat,destination.lng]],{padding:[32,32],maxZoom:16});
  }
 }else if(lastFix?.[0]!==fix[0]||lastFix?.[1]!==fix[1]){
  marker.setLatLng(fix);
  const points=trail.getLatLngs().slice(-119);
  trail.setLatLngs([...points,fix]);
  if(!map.getBounds().pad(-0.15).contains(fix))map.panTo(fix);
 }
 lastFix=fix;
 if(destination)updateRoad(courier,destination);
}
$('center').onclick=()=>{if(map&&lastFix)map.panTo(lastFix);};
function updateRoad(courier,destination){
 if(!window.UmmaNhaTrangRouter)return;
 if(routeOrigin&&Math.hypot(courier.lat-routeOrigin.lat,courier.lng-routeOrigin.lng)<0.00045)return;
 routeOrigin=courier;
 const request=++routeRequest;
 void window.UmmaNhaTrangRouter.route(courier,destination).then(result=>{
  if(request!==routeRequest||!map)return;
  etaMinutes=result?Math.max(1,Math.ceil(result.seconds/60)):estimateMinutes(courier,destination);
  if(result){
   const path=result.path.map(p=>[p.lat,p.lng]);
   if(road)road.setLatLngs(path);
   else road=L.polyline(path,{color:'#007c61',weight:5}).addTo(map);
  }else if(road){road.remove();road=null;}
  labels();
 }).catch(()=>{
  if(request!==routeRequest||!map)return;
  routeOrigin=null;
  road?.remove();road=null;
  etaMinutes=estimateMinutes(courier,destination);
  labels();
 });
}
function renderStages(){
 const d=data;
 $('progress').hidden=!d||d.state==='cancelled'||d.orderStatus==='cancelled'||!!statusKey;
 const kitchen=d?.orderStatus==='ready'?2:d?.orderStatus==='preparing'?1:0;
 const delivery=d?.state==='courier_assigned'?3:d?.state==='picked_up'?4:d&&isTerminal(d)?5:0;
 const current=delivery>=4?delivery:Math.max(kitchen,delivery);
 stageRows.forEach((row,i)=>{
  row.textContent=t(stages[i]);
  row.toggleAttribute('data-done',i<=kitchen||(i>=3&&i<=delivery)||delivery>=4);
  if(i===current)row.setAttribute('aria-current','step');else row.removeAttribute('aria-current');
 });
 $('eta').hidden=etaMinutes===null;
 $('eta').textContent=etaMinutes===null?'':t('Примерно {minutes} мин. до прибытия',{minutes:etaMinutes});
}
function labels(){
 document.title='UMMA Delivery';
 $('menuLanguage').setAttribute('aria-label',t('Выбрать язык'));
 $('orderNumber').textContent=data&&!statusKey?t('Заказ №{number}',{number:data.number}):'';
 const state=data?.state;
 const label=['courier_assigned','picked_up',...terminal].includes(state)?names[state]:names[data?.orderStatus]||names[state];
 $('status').textContent=statusKey?t(statusKey):label?t(label):'';
 $('connection').textContent=connectionKey?t(connectionKey):'';
 $('notify').textContent=t(notificationKey);
 $('back').textContent=t('Вернуться к меню');
 $('center').textContent=t('Показать курьера');
 $('progressLabel').textContent=t('Этапы доставки');
 renderStages();
}
for(const [code,[label]]of Object.entries(I.languages)){const o=document.createElement('option');o.value=code;o.textContent=label;$('menuLanguage').append(o);}$('menuLanguage').value=I.language;$('menuLanguage').onchange=e=>I.setLanguage(e.target.value);window.addEventListener('umma-menu:languagechange',labels);labels();
$('notify').hidden=!('Notification'in window);$('notify').onclick=async()=>{if(!('Notification'in window))return;try{const p=await Notification.requestPermission();notificationKey=p==='granted'?'Уведомления разрешены для открытой страницы':'Уведомления не разрешены';labels();}catch{notificationKey='Уведомления не разрешены';labels();}};
async function poll(){if(stopped||active)return;active=true;clearTimeout(timer);controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);try{
 const r=await fetch('https://zwzojugspldexyyljwpr.supabase.co/functions/v1/umma-guest-delivery',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'tracking',token}),cache:'no-store',signal:controller.signal});
 if(r.status===404){stopped=true;hideMap();statusKey='Ссылка отслеживания недействительна или истекла.';labels();return;}
 const d=await r.json();if(!r.ok||!d.ok)throw Error();if(stopped)return;
 data=d;statusKey='';connectionKey='';
 try{drawPosition(d);}catch{hideMap();connectionKey='Не удалось загрузить карту';}
 window.ummaOrderInbox?.publish({...d,id:"delivery:"+d.number},t);labels();
 const state=d.orderStatus+':'+d.state;if(previous&&state!==previous&&document.hidden&&'Notification'in window&&Notification.permission==='granted'){try{new Notification('UMMA Delivery',{body:$('status').textContent});}catch{}}previous=state;
 if(isTerminal(d))stopped=true;
 }catch{if(!stopped){hideMap();connectionKey='Нет связи. Повторяем запрос…';labels();}}finally{clearTimeout(timeout);active=false;if(!stopped)timer=setTimeout(poll,5000);}}
window.addEventListener('pagehide',()=>{stopped=true;clearTimeout(timer);controller?.abort();hideMap();});window.addEventListener('pageshow',e=>{if(e.persisted){stopped=false;void poll();}});
if(/^[a-f0-9]{64}$/.test(token)){if(!data)statusKey='Загружаем меню…';labels();void poll();}else{statusKey='Ссылка отслеживания недействительна или истекла.';labels();$('notify').hidden=true;}
})();
