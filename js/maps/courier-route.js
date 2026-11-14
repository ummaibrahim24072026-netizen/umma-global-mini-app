/* UMMA courier in-app map: live GPS, destination and optional external turn-by-turn. */
(() => {
 'use strict';
 const $ = id => document.getElementById(id);
 let opener=null,map=null,watch=null,marker=null,line=null,session=0;
 const valid=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180;
 function destination(button){
  const address=button.dataset.routeAddress||'';
  const point=window.ummaMapLinks?.parseAddress(address);
  return {address,point,text:point?window.ummaMapLinks.coords(point):address+', Vietnam'};
 }
 function url(button,provider=button.dataset.navigationProvider){
  const d=destination(button).text;
  if(provider==='apple')return 'https://maps.apple.com/directions?destination='+encodeURIComponent(d)+'&mode=driving';
  return 'https://www.google.com/maps/dir/?api=1&travelmode=driving&dir_action=navigate&destination='+encodeURIComponent(d);
 }
 function status(message){const el=$('courierMapMessage');if(el)el.textContent=message;}
 function close(){
  session++;
  if(watch!==null){navigator.geolocation?.clearWatch(watch);watch=null;}
  try{map?.remove();}catch{}
  map=null;marker=null;line=null;
  const modal=$('courierMapModal');if(modal){modal.hidden=true;modal.style.display='none';}
  $('courierRouteMap')?.replaceChildren();opener?.focus?.();
 }
 function open(button){
  close();opener=button;const generation=session;
  const modal=$('courierMapModal');if(!modal)return;
  const d=destination(button);modal.hidden=false;modal.style.display='block';
  $('courierMapTitle').textContent='Доставка · Заказ №'+(button.dataset.routeOrderNumber||'');
  $('courierMapExternal').href=url(button,'google');
  $('courierMapApple').hidden=false;
  $('courierMapApple').href=url(button,'apple');
  status('Открываем карту UMMA. Разрешите доступ к GPS.');
  if(!valid(d.point)){status('Для встроенной карты необходима точка доставки. Используйте Google Maps для адреса.');return;}
  try{
   map=window.UmmaMaps.create($('courierRouteMap'),d.point,status);
   window.UmmaMaps.marker(map,d.point);
   map.invalidateSize?.();
  }catch(e){status(e.message||'Карта недоступна. Используйте Google Maps.');return;}
  if(!navigator.geolocation?.watchPosition){status('GPS недоступен. Можно открыть маршрут в Google Maps.');return;}
  try{
   watch=navigator.geolocation.watchPosition(position=>{
    if(generation!==session||!map)return;
    const p={lat:position.coords.latitude,lng:position.coords.longitude};
    if(!valid(p))return;
    if(!marker)marker=window.UmmaMaps.marker(map,p,'courier');
    else marker.setLatLng([p.lat,p.lng]);
    // A straight connector is orientation only, never presented as a road route.
    if(window.L?.polyline){
     if(!line)line=window.L.polyline([[p.lat,p.lng],[d.point.lat,d.point.lng]],{color:'#087b80',weight:2,dashArray:'5 9',opacity:0.65}).addTo(map);
     else line.setLatLngs([[p.lat,p.lng],[d.point.lat,d.point.lng]]);
    }
    if(window.L?.latLngBounds)map.fitBounds(window.L.latLngBounds([[p.lat,p.lng],[d.point.lat,d.point.lng]]),{padding:[48,48],maxZoom:17});
    status('GPS активен · точность около '+Math.round(position.coords.accuracy||0)+' м. Пунктир показывает направление, не дорожный маршрут. Для поворотов используйте Google Maps.');
   },error=>{
    if(generation!==session)return;
    status(error.code===1?'Доступ к GPS запрещён. Разрешите геолокацию в настройках.':'Ожидаем GPS. Для навигации по дорогам доступен Google Maps.');
   },{enableHighAccuracy:true,maximumAge:5000,timeout:12000});
  }catch{status('GPS недоступен. Используйте Google Maps.');}
  $('courierMapClose')?.focus();
 }
 document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-show-route="true"]');
  if(!button)return;
  event.preventDefault();
  open(button);
 });
 $('courierMapClose')?.addEventListener('click',close);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('courierMapModal')?.hidden)close();});
 window.addEventListener('pagehide',close);
 window.UmmaCourierMap={open,close,navigationUrl:url};
})();
