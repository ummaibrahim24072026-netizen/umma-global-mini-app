/* Courier navigation stays in the UMMA workspace. */
(() => {
 'use strict';
 const $ = id => document.getElementById(id);
 const status = message => { $('courierMapMessage').textContent = message; };
 let active;
 function close() {
  const view=active;
  active=null;
  if(view?.watch!=null)navigator.geolocation.clearWatch(view.watch);
  clearTimeout(view?.staleTimer);
  view?.map?.remove();
  if($('courierMapModal'))$('courierMapModal').hidden=true;
  view?.opener.focus();
 }
 async function update(view){
  if(!view.position||view.pending)return;
  const origin=view.position;
  view.pending=true;
  view.requestedAt=Date.now();
  $('courierRouteRefresh').disabled=true;
  if(!view.line)status('Строим маршрут по дорогам…');
  try{
   const route=await window.UmmaNhaTrangRouter.route(origin,view.destination).catch(()=>{throw Error('Не удалось загрузить дорожные данные UMMA. Обновите маршрут.');});
   if(active!==view||!view.position)return;
   if(!route)throw Error('Дорожный маршрут не найден. Проверьте точки на карте.');
   const path=route.path.map(p=>[p.lat,p.lng]);
   if(!view.line){
    view.line=L.polyline(path,{color:'#007c80',weight:6}).addTo(view.map);
    view.map.fitBounds([...path,[view.destination.lat,view.destination.lng]],{padding:[36,36],maxZoom:17});
   }else view.line.setLatLngs(path);
   view.routedFrom=origin;
   const km=(route.meters/1000).toLocaleString('ru',{maximumFractionDigits:1});
   status(km+' км · около '+Math.max(1,Math.ceil(route.seconds/60))+' мин');
   $('courierRouteWarnings').textContent=[
    route.startGap>35?'До начала маршрута '+Math.round(route.startGap)+' м.':'',
    route.endGap>25?'От конца маршрута до точки назначения '+Math.round(route.endGap)+' м.':''
   ].filter(Boolean).join(' ');
   $('courierRouteSteps').replaceChildren(...route.streets.map(name=>{
    const row=document.createElement('li');row.textContent=name;return row;
   }));
   $('courierRouteDirections').hidden=!route.streets.length;
  }catch(error){
   if(active===view&&view.position)clearRoute(view,error.message);
  }finally{
   view.pending=false;
   if(active===view)$('courierRouteRefresh').disabled=!view.position;
  }
 }
 function clearRoute(view,message){
  view.line?.remove();
  view.line=null;
  view.routedFrom=null;
  $('courierRouteDirections').hidden=true;
  $('courierRouteWarnings').textContent='';
  status(message);
 }
 function gpsUnavailable(view,message){
  if(active!==view)return;
  view.position=null;
  view.marker?.remove();view.marker=null;
  clearRoute(view,message);
  $('courierRouteRefresh').disabled=true;
 }
 function open(button){
  close();
  if(!$('courierMapModal'))return;
  const destination=window.ummaMapLinks?.parseAddress(button.dataset.routeAddress);
  const view={destination,opener:button};
  active=view;
  $('courierMapModal').hidden=false;
  $('courierMapTitle').textContent='Маршрут · Заказ №'+(button.dataset.routeOrderNumber||'');
  $('courierRouteDirections').hidden=true;
  $('courierRouteDirections').open=false;
  $('courierRouteWarnings').textContent='';
  $('courierRouteRefresh').disabled=true;
  $('courierMapClose').focus();
  if(!destination){status('В заказе нет точки на карте. Уточните её у кафе.');return;}
  try{
   view.map=window.UmmaMaps.create($('courierRouteMap'),destination,()=>{});
   window.UmmaMaps.marker(view.map,destination);
   status('Ожидаем GPS. Разрешите геолокацию.');
   if(!navigator.geolocation?.watchPosition)throw Error('GPS недоступен в этом браузере.');
   view.watch=navigator.geolocation.watchPosition(fix=>{
    if(active!==view)return;
    const {latitude:lat,longitude:lng,accuracy}=fix.coords;
    if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180||
      !Number.isFinite(accuracy)||accuracy>100||Date.now()-fix.timestamp>15000)return;
    const point={lat,lng};
    view.position=point;
    clearTimeout(view.staleTimer);
    view.staleTimer=setTimeout(()=>gpsUnavailable(view,'Нет свежей позиции GPS. Ожидаем сигнал…'),30000);
    if(view.marker)view.marker.setLatLng([lat,lng]);
    else view.marker=window.UmmaMaps.marker(view.map,point,'courier');
    if(!view.map.getBounds().pad(-0.15).contains([lat,lng]))view.map.panTo([lat,lng]);
    const moved=!view.routedFrom||Math.hypot(lat-view.routedFrom.lat,lng-view.routedFrom.lng)>0.00065;
    if(!view.requestedAt||(moved&&Date.now()-view.requestedAt>=12000))void update(view);
   },error=>gpsUnavailable(view,error.code===1?'Разрешите геолокацию в настройках браузера.':'Ожидаем сигнал GPS…'),
   {enableHighAccuracy:true,maximumAge:5000,timeout:15000});
  }catch(error){status(error.message||'Карта недоступна.');}
 }
 document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-show-route="true"]');
  if(button){event.preventDefault();open(button);}
 });
 $('courierMapClose')?.addEventListener('click',close);
 $('courierRouteRefresh')?.addEventListener('click',()=>{if(active)void update(active);});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&active)close();});
 window.addEventListener('pagehide',close);
 window.UmmaCourierMap={open,close};
})();
