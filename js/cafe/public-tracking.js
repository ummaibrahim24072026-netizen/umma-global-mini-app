/* A private token grants read-only access to one order, never a customer's ID. */
(()=>{
'use strict';
const $=id=>document.getElementById(id),I=window.ummaMenuI18n,t=I.t;
const query=new URLSearchParams(location.search), fragment=new URLSearchParams(location.hash.slice(1));
const token=fragment.get('token')||query.get('token')||'';
let requestKey=fragment.get('requestKey')||query.get('requestKey')||'';
let orderId=fragment.get('orderId')||query.get('orderId')||'';
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const hex=/^[a-f0-9]{64}$/;
const base='https://zwzojugspldexyyljwpr.supabase.co';
const mapFallback={lat:12.245,lng:109.194};
// Old tracking links carried only a token. Recover the original order-bound
// checkout key from this device's saved receipt, without ever guessing a key.
if(!requestKey||!orderId){
 try{
  const stored=[localStorage.getItem('umma-menu-receipt'),sessionStorage.getItem('umma-menu-receipt')];
  for(const store of [localStorage,sessionStorage]){
   const list=JSON.parse(store.getItem('umma-menu-receipts')||'[]');
   if(Array.isArray(list))stored.push(...list);
  }
  const receipts=stored.flatMap(v=>typeof v==='string'?(()=>{try{return [JSON.parse(v)];}catch{return [];}})():[v]);
  const match=receipts.find(o=>o&&o.id&&o.requestKey&&
   (orderId?String(o.id)===orderId:token&&o.trackingToken===token));
  if(match){requestKey=requestKey||match.requestKey;orderId=orderId||match.id;}
 }catch(error){console.warn('Receipt recovery unavailable',error);}
}
// Keep credentials out of future document requests while preserving reload and old links.
if(query.has('token')||query.has('requestKey')||query.has('orderId')){
 const url=new URL(location.href);
 for(const name of ['token','requestKey','orderId']){
  if(!fragment.has(name)&&query.has(name))fragment.set(name,query.get(name));
  url.searchParams.delete(name);
 }
 url.hash=fragment.toString();
 history.replaceState(history.state,'',url.href);
}
let road=null,routeRequest=0,routeOrigin=null;
let liveSocket=null,liveChannel='',liveRetry=null,liveSequence=0,liveHeartbeat=null;
let map=null,marker=null,destinationMarker=null,trail=null,lastFix=null,timer=null,controller=null,previous='',data=null,stopped=false,active=false,statusKey='',connectionKey='';
let disconnected=false,refreshQueued=false;
const terminal=['delivered','completed','cancelled'];
const names={pending:'Заказ отправлен',confirmed:'Заказ принят',preparing:'Готовится',ready:'Заказ готов',waiting_courier:'Ищем курьера',courier_assigned:'Курьер назначен',picked_up:'Курьер в пути',delivered:'Заказ доставлен',completed:'Заказ доставлен',cancelled:'Заказ отменён'};
function isTerminal(d){return terminal.includes(d.state)||terminal.includes(d.orderStatus);}
function point(d){
 const lat=d?.latitude,lng=d?.longitude;
 return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180?{lat,lng}:null;
}
// Private Broadcast only wakes up the authorized HTTP reader. Ignore all payload data.
function startRealtime(channel){
 if(channel===liveChannel)return;
 stopRealtime();
 if(typeof channel!=='string'||!/^umma-guest-gps:[a-f0-9]{64}$/.test(channel)||stopped||!window.WebSocket)return;
 liveChannel=channel;
 const endpoint=base.replace(/^https:/,'wss:')+'/realtime/v1/websocket?apikey='+encodeURIComponent('sb_publishable_s2qkY0H-Wb7r9aVkofZIJQ_8SsaQTpC')+'&vsn=1.0.0';
 const topic='realtime:'+channel;
 function connect(){
  if(stopped||document.hidden||!navigator.onLine||liveSocket)return;
  let ws;
  try{ws=new WebSocket(endpoint);}catch{return;}
  liveSocket=ws;
  const send=(target,event,payload)=>ws.send(JSON.stringify({topic:target,event,payload,ref:String(++liveSequence)}));
  ws.onopen=()=>{
   send(topic,'phx_join',{config:{broadcast:{self:false,ack:false},presence:{enabled:false},postgres_changes:[],private:true}});
   liveHeartbeat=setInterval(()=>{if(ws.readyState===1)send('phoenix','heartbeat',{});},25000);
  };
  ws.onmessage=event=>{
   if(liveSocket!==ws)return;
   let message;
   try{message=JSON.parse(event.data);}catch{return;}
   if(message.topic!==topic)return;
   if(message.event==='broadcast'&&message.payload?.event==='position'){
    if(active)refreshQueued=true;
    else void poll();
   }
   if(message.event==='phx_error'||message.event==='phx_close'||
      (message.event==='phx_reply'&&message.payload?.status==='error'))ws.close();
  };
  ws.onclose=()=>{
   if(liveSocket!==ws)return;
   clearInterval(liveHeartbeat);liveHeartbeat=null;liveSocket=null;
   if(!stopped&&!document.hidden)liveRetry=setTimeout(connect,5000);
  };
  ws.onerror=()=>ws.close();
 }
 connect();
}
function stopRealtime(){
 clearTimeout(liveRetry);clearInterval(liveHeartbeat);liveRetry=liveHeartbeat=null;
 const ws=liveSocket;liveSocket=null;liveChannel='';
 ws?.close();
}
// A GPS notice or a change in the visible mobile viewport can resize the map without a window resize.
if(window.ResizeObserver){
 const observer=new ResizeObserver(()=>map?.invalidateSize({debounceMoveend:true}));
 observer.observe($('map'));
}
function hideMap(){
 if(map)map.remove();
 map=marker=destinationMarker=trail=lastFix=road=routeOrigin=null;
 $('mapNotice').hidden=true;
 routeRequest++;
 $('center').hidden=true;
 $('map').hidden=true;
}
function drawPosition(d){
 if(isTerminal(d)){hideMap();return;}
 const age=Date.now()-Date.parse(d.updatedAt);
 const courier=d.state==='picked_up'&&age>=-10000?point(d):null;
 const destination=point(d.destination);
 const fresh=courier&&d.positionFresh!==false&&age<60000&&!disconnected;
 if(courier&&!fresh){
  connectionKey=t('Последняя позиция курьера')+' · '+new Date(d.updatedAt).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'});
 }else if(!courier&&d.state==='picked_up'){
  connectionKey=t('Ожидаем геолокацию курьера');
 }else{
  connectionKey='';
 }
 if(!window.L?.map||!window.UmmaMaps)throw Error('Map assets unavailable');
 $('map').hidden=false;
 const initial=destination||courier||mapFallback;
 if(!map){
  map=L.map($('map')).setView([initial.lat,initial.lng],destination||courier?16:13);
  map.zoomControl?.setPosition('bottomleft');
  map.attributionControl?.setPrefix(false);
  const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
   maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);
  tiles.on('tileerror',()=>{
   $('mapNotice').textContent=t('Не удалось загрузить подложку карты.');
   $('mapNotice').hidden=false;
  });
  tiles.on('tileload',()=>{$('mapNotice').hidden=true;});
  setTimeout(()=>map?.invalidateSize(),100);
 }
 if(destination&&!destinationMarker){
  destinationMarker=UmmaMaps.marker(map,destination);
  if(!courier)map.setView([destination.lat,destination.lng],16);
 }
 if(!courier)return;
 const fix=[courier.lat,courier.lng];
 $('center').hidden=false;
 if(!marker){
  marker=UmmaMaps.marker(map,courier,'courier');
  marker.setZIndexOffset(1000);
  trail=L.polyline([fix],{color:'#418780',weight:3,dashArray:'4 7'}).addTo(map);
  if(destination)map.fitBounds([fix,[destination.lat,destination.lng]],{padding:[36,36],maxZoom:16});
  else map.setView(fix,16);
 }else if(lastFix?.[0]!==fix[0]||lastFix?.[1]!==fix[1]){
  marker.setLatLng(fix);
  trail.setLatLngs([...trail.getLatLngs().slice(-119),fix]);
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
  if(result){
   const path=result.path.map(p=>[p.lat,p.lng]);
   if(road)road.setLatLngs(path);
   else road=L.polyline(path,{color:'#007c61',weight:5}).addTo(map);
  }else if(road){road.remove();road=null;}
 }).catch(()=>{
  if(request!==routeRequest||!map)return;
  routeOrigin=null;
  road?.remove();road=null;
 });
}
function labels(){
 document.title='UMMA Delivery';
 const number=data?.number;
 $('orderNumber').hidden=number==null||!!statusKey;
 $('orderNumber').textContent=$('orderNumber').hidden?'':t('Заказ №{number}',{number});
 const state=data?.state;
 const label=['courier_assigned','picked_up',...terminal].includes(state)?names[state]:names[data?.orderStatus]||names[state];
 $('status').textContent=statusKey?t(statusKey):label?t(label):'';
 const notice=[disconnected&&t('Нет связи'),connectionKey].filter(Boolean).join(' · ');
 $('connection').textContent=notice;
 $('connection').hidden=!notice;
 $('back').setAttribute('aria-label',t('Вернуться к меню'));
 $('center').textContent=t('Показать курьера');
}
window.addEventListener('umma-menu:languagechange',labels);
async function poll(){
 if(stopped||active)return;
 active=true;clearTimeout(timer);
 controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const payload={action:'tracking'};
  if(uuid.test(orderId))payload.orderId=orderId;
  if(uuid.test(requestKey))payload.requestKey=requestKey;
  if(hex.test(token))payload.token=token;
  const response=await fetch(base+'/functions/v1/umma-guest-delivery',{
   method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),
   cache:'no-store',signal:controller.signal
  });
  const next=await response.json();
  if(stopped)return;
  if([403,404].includes(response.status)&&['TRACKING_CREDENTIAL_INVALID','TRACKING_UNAVAILABLE'].includes(next.code)){
   stopped=true;data=null;disconnected=false;stopRealtime();hideMap();
   statusKey='Доступ к отслеживанию не подтверждён';
   connectionKey=t('Откройте доставку через «Мои заказы» на устройстве оформления.');
   labels();return;
  }
  if(!response.ok||!next.ok)throw Error('Tracking API unavailable');
  disconnected=false;statusKey='';connectionKey='';
  if(next.state==='picked_up'&&data?.state==='picked_up'&&!point(next)&&point(data)&&!isTerminal(next)){
   Object.assign(next,{latitude:data.latitude,longitude:data.longitude,updatedAt:data.updatedAt,positionFresh:false});
  }
  data=next;
  if(isTerminal(next)){stopped=true;stopRealtime();}
  else if(!document.hidden)startRealtime(next.channel);
  try{drawPosition(next);}catch{hideMap();connectionKey=t('Не удалось загрузить карту');}
  window.ummaOrderInbox?.publish({...next,id:'delivery:'+next.number},t);labels();
  const state=next.orderStatus+':'+next.state;
  if(previous&&state!==previous&&document.hidden&&'Notification'in window&&Notification.permission==='granted'){
   try{new Notification('UMMA Delivery',{body:$('status').textContent});}catch{}
  }
  previous=state;
 }catch{
  if(!stopped){
   disconnected=true;
   if(data)try{drawPosition(data);}catch{}
   labels();
  }
 }finally{
  clearTimeout(timeout);active=false;
  if(!stopped)timer=setTimeout(poll,refreshQueued?0:3000);
  refreshQueued=false;
 }
}
window.addEventListener('offline',()=>{
 if(stopped)return;
 disconnected=true;stopRealtime();controller?.abort();
 if(data)try{drawPosition(data);}catch{}
 labels();
});
window.addEventListener('online',()=>void poll());
document.addEventListener('visibilitychange',()=>{
 if(document.hidden)stopRealtime();
 else void poll();
});
window.addEventListener('pagehide',()=>{stopped=true;clearTimeout(timer);controller?.abort();stopRealtime();hideMap();});
window.addEventListener('pageshow',event=>{if(event.persisted){stopped=false;void poll();}});
if(hex.test(token)||(uuid.test(orderId)&&uuid.test(requestKey))){
 statusKey='Подключаем карту доставки…';labels();void poll();
}else{
 stopped=true;statusKey='Ссылка отслеживания недействительна или истекла.';labels();
}
})();
