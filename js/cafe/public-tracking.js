/* A private token grants read-only access to one order, never a customer's ID. */
(()=>{
'use strict';
const $=id=>document.getElementById(id),I=window.ummaMenuI18n,t=I.t;
const query=new URLSearchParams(location.search);
const token=query.get('token')||new URLSearchParams(location.hash.slice(1)).get('token')||'';
const requestKey=query.get('requestKey')||'';
const orderId=query.get('orderId')||'';
let road=null,routeRequest=0,routeOrigin=null;
let liveSocket=null,liveChannel='',liveRetry=null,liveSequence=0,liveHeartbeat=null;
let map=null,marker=null,trail=null,etaMinutes=null,lastFix=null,timer=null,controller=null,previous='',data=null,stopped=false,active=false,statusKey='',connectionKey='',notificationKey='Уведомления для открытой страницы';
const terminal=['delivered','completed','cancelled'];
const names={pending:'Заказ отправлен',confirmed:'Заказ принят',preparing:'Готовится',ready:'Заказ готов',waiting_courier:'Ищем курьера',courier_assigned:'Курьер назначен',picked_up:'Курьер в пути',delivered:'Заказ доставлен',completed:'Заказ доставлен',cancelled:'Заказ отменён'};
const stages=['Заказ отправлен','Готовится','Заказ готов','Курьер назначен','Курьер в пути','Заказ доставлен'];
const stageRows=stages.map(()=>document.createElement('li'));
$('stages').append(...stageRows);
function isTerminal(d){return terminal.includes(d.state)||terminal.includes(d.orderStatus);}
function point(d){
 const lat=d?.latitude,lng=d?.longitude;
 return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180?{lat,lng}:null;
}
// The order-specific channel is returned only after the tracking credential is verified.
// Broadcast updates supplement the authoritative 3-second polling fallback.
function startRealtime(channel){
 if(typeof channel!=='string'||!/^umma-delivery:[a-f0-9]{64}$/.test(channel)||stopped)return;
 if(liveChannel===channel&&liveSocket)return;
 stopRealtime();
 liveChannel=channel;
 const endpoint='wss://zwzojugspldexyyljwpr.supabase.co/realtime/v1/websocket?apikey='+encodeURIComponent('sb_publishable_s2qkY0H-Wb7r9aVkofZIJQ_8SsaQTpC')+'&vsn=1.0.0';
 const topic='realtime:'+channel;
 function connect(){
  if(stopped||document.hidden||!navigator.onLine||liveSocket)return;
  let ws;
  try{ws=new WebSocket(endpoint);}catch{return;}
  liveSocket=ws;
  ws.onopen=()=>{
   ws.send(JSON.stringify({topic,event:'phx_join',payload:{config:{broadcast:{self:false,ack:false},presence:{key:''},postgres_changes:[],private:false}},ref:String(++liveSequence)}));
   liveHeartbeat=setInterval(()=>{if(ws.readyState===1)ws.send(JSON.stringify({topic:'phoenix',event:'heartbeat',payload:{},ref:String(++liveSequence)}));},25000);
  };
  ws.onmessage=event=>{
   try{
    const msg=JSON.parse(event.data);
    if(msg.topic!==topic||msg.event!=='broadcast'||msg.payload?.event!=='position'||!data||isTerminal(data))return;
    const p=msg.payload.payload;
    if(!p||!Number.isFinite(p.latitude)||!Number.isFinite(p.longitude)||!Number.isFinite(Date.parse(p.updatedAt)))return;
    if(Date.parse(p.updatedAt)<=Date.parse(data.updatedAt||0))return;
    data={...data,latitude:p.latitude,longitude:p.longitude,accuracy:p.accuracy,updatedAt:p.updatedAt};
    connectionKey='GPS курьера подключён · обновление в реальном времени';
    drawPosition(data);labels();
   }catch(error){console.warn('Realtime position',error);}
  };
  ws.onclose=()=>{
   clearInterval(liveHeartbeat);liveHeartbeat=null;
   if(liveSocket===ws)liveSocket=null;
   if(!stopped&&liveChannel===channel&&!document.hidden)liveRetry=setTimeout(connect,3000);
  };
  ws.onerror=()=>ws.close();
 }
 connect();
}
function stopRealtime(){
 clearTimeout(liveRetry);clearInterval(liveHeartbeat);liveRetry=liveHeartbeat=null;
 const ws=liveSocket;liveSocket=null;liveChannel='';
 if(ws)ws.close();
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
 if(d.state!=='picked_up'||isTerminal(d)||!courier||!(age>=-10000)){
  if(d.state==='picked_up'&&!isTerminal(d)&&destination&&window.L&&window.UmmaMaps){
   if(!map){$('map').hidden=false;$('map').closest('main').dataset.map='';map=UmmaMaps.create($('map'),destination,()=>{});map.zoomControl?.setPosition('bottomleft');UmmaMaps.marker(map,destination);map.setView([destination.lat,destination.lng],15);setTimeout(()=>map?.invalidateSize(),100);}
   connectionKey='Ожидаем свежую геопозицию курьера';
  }else hideMap();
  return;
 }
 const fresh=age<60000;
 if(!fresh){connectionKey='Последняя позиция курьера · '+new Date(d.updatedAt).toLocaleTimeString('ru-RU')+' (GPS сейчас не обновляется)';etaMinutes=null;}
 if(!routeOrigin&&fresh)etaMinutes=destination?estimateMinutes(courier,destination):null;
 if(!window.L||!window.UmmaMaps){connectionKey='Не удалось загрузить карту';return;}
 const fix=[courier.lat,courier.lng];
 $('map').hidden=false;
 $('map').closest('main').dataset.map='';
 $('center').hidden=false;
 if(!map){
  map=UmmaMaps.create($('map'),courier,()=>{});setTimeout(()=>map?.invalidateSize(),100);
  map.zoomControl?.setPosition('bottomleft');
  marker=UmmaMaps.marker(map,courier,'courier');
  trail=L.polyline([fix],{color:'#478a80',weight:3,dashArray:'4 7'}).addTo(map);
  if(destination){
   UmmaMaps.marker(map,destination);
   map.fitBounds([fix,[destination.lat,destination.lng]],{padding:[32,32],maxZoom:16});
  }
 }else if(!marker){
  marker=UmmaMaps.marker(map,courier,'courier');
  trail=L.polyline([fix],{color:'#478a80',weight:3,dashArray:'4 7'}).addTo(map);
  if(destination)map.fitBounds([fix,[destination.lat,destination.lng]],{padding:[32,32],maxZoom:16});
 }else if(lastFix?.[0]!==fix[0]||lastFix?.[1]!==fix[1]){
  marker.setLatLng(fix);
  const points=trail.getLatLngs().slice(-119);
  trail.setLatLngs([...points,fix]);
  if(!map.getBounds().pad(-0.15).contains(fix))map.panTo(fix);
 }
 lastFix=fix;
 if(destination&&fresh)updateRoad(courier,destination);
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
 const endpoint='https://zwzojugspldexyyljwpr.supabase.co/functions/v1/umma-guest-delivery';
 const options=payload=>({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),cache:'no-store',signal:controller.signal});
 let r=await fetch(endpoint,options({action:'tracking',token}));
 if(r.status===404&&/^[0-9a-f-]{36}$/i.test(requestKey)&&/^[0-9a-f-]{36}$/i.test(orderId)){
  r=await fetch(endpoint,options({action:'tracking',requestKey,orderId}));
 }
 if(r.status===404){statusKey='Не удалось подтвердить доступ к отслеживанию. Повторяем проверку…';connectionKey='Проверьте, что заказ открыт на устройстве, с которого он оформлен.';labels();return;}
 const d=await r.json();if(!r.ok||!d.ok)throw Error();if(stopped)return;
 data=d;statusKey='';connectionKey='';startRealtime(d.channel);
 try{drawPosition(d);}catch{hideMap();connectionKey='Не удалось загрузить карту';}
 window.ummaOrderInbox?.publish({...d,id:"delivery:"+d.number},t);labels();
 const state=d.orderStatus+':'+d.state;if(previous&&state!==previous&&document.hidden&&'Notification'in window&&Notification.permission==='granted'){try{new Notification('UMMA Delivery',{body:$('status').textContent});}catch{}}previous=state;
 if(isTerminal(d))stopped=true;
 }catch(error){if(!stopped){console.warn('Tracking poll',error);connectionKey='Нет связи. Повторяем запрос каждые 3 секунды…';labels();}}finally{clearTimeout(timeout);active=false;if(!stopped)timer=setTimeout(poll,3000);}}
window.addEventListener('pagehide',()=>{stopped=true;clearTimeout(timer);controller?.abort();stopRealtime();hideMap();});window.addEventListener('pageshow',e=>{if(e.persisted){stopped=false;void poll();}});
if(/^[a-f0-9]{64}$/.test(token)||(/^[0-9a-f-]{36}$/i.test(requestKey)&&/^[0-9a-f-]{36}$/i.test(orderId))){if(!data)statusKey='Подключаем карту доставки…';labels();void poll();}else{statusKey='Ссылка отслеживания недействительна или истекла.';labels();$('notify').hidden=true;}
})();
