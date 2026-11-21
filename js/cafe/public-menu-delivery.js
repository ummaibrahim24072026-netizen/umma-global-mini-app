/* Delivery uses the same cart, receipt and payment status as counter orders. */
(()=>{
'use strict';
const $=id=>document.getElementById(id),t=(key)=>window.ummaMenuI18n.t(key);
let cafe=null,map=null,marker=null,point=null,loading=null,opening=null,generation=0;
let statusKey='Выберите точку доставки на карте.';
const choosePoint='Выберите точку доставки на карте.';
const mapUnavailable='Карта недоступна. Используйте геолокацию.';
const locateFailed='Не удалось определить местоположение. Выберите точку на карте.';
const isDelivery=()=>$('orderType').value==='delivery';
function text(key){statusKey=key;$('deliveryPointState').removeAttribute('data-i18n');$('deliveryPointState').textContent=t(key);}
window.addEventListener('umma-menu:languagechange',()=>text(statusKey));
// Photon receives only the explicitly selected point, without order or customer details.
let autoAddress='',addressVersion=0,addressTimer=null,addressController=null;
const addressCache=new Map();
function cancelAddress(){addressVersion++;clearTimeout(addressTimer);addressController?.abort();addressController=null;}
$('deliveryAddress').addEventListener('input',cancelAddress);
function fillAddress(p){
 cancelAddress();const field=$('deliveryAddress');if(field.value.trim()&&field.value!==autoAddress)return;
 const version=addressVersion,key=p.latitude.toFixed(6)+', '+p.longitude.toFixed(6);
 const write=value=>{if(version!==addressVersion||$('orderType').value!=='delivery'||$('customerFields').disabled||field.value!==autoAddress)return;autoAddress=value;field.value=value;};
 autoAddress=key;field.value=key;
 if(addressCache.has(key)){write(addressCache.get(key));return;}
 addressTimer=setTimeout(async()=>{
  const controller=new AbortController();addressController=controller;const timeout=setTimeout(()=>controller.abort(),8000);
  try{
   const url=new URL('https://photon.komoot.io/reverse');url.search=new URLSearchParams({lat:String(p.latitude),lon:String(p.longitude),limit:'1',lang:'en',radius:'0.1'});
   const response=await fetch(url.href,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw Error();
   const data=await response.json(),a=data.features?.[0]?.properties;if(!a)return;
   const street=[a.housenumber,a.street].filter(Boolean).join(' ');
   // A city-only result is too broad to replace the exact delivery coordinates.
   if(!street&&(!a.name||['city','town','village','suburb','country','state'].includes(a.osm_value)))return;
   const address=[...new Set([street||a.name,a.district,a.city||a.town||a.village,a.state,a.country].filter(v=>typeof v==='string'&&v.trim()))].join(', ').slice(0,250);
   if(address.length<8)return;
   if(addressCache.size>=64)addressCache.delete(addressCache.keys().next().value);
   addressCache.set(key,address);write(address);
  }catch{/* Keep the exact point if Photon is offline or has no nearby address. */}finally{clearTimeout(timeout);if(addressController===controller)addressController=null;}
 },450);
}
function select(p,resolveAddress=true){
 if(!Number.isFinite(p.lat)||!Number.isFinite(p.lng)||!window.ummaDeliveryZone?.contains(cafe?.delivery_zone,[p.lat,p.lng])){cancelAddress();if($('deliveryAddress').value===autoAddress){$('deliveryAddress').value='';autoAddress='';}point=null;if(marker){marker.remove();marker=null;}text('Адрес вне зоны доставки.');return;}
 point={latitude:Number(p.lat.toFixed(6)),longitude:Number(p.lng.toFixed(6))};
 if(map&&window.L){if(marker)marker.setLatLng([p.lat,p.lng]);else marker=L.marker([p.lat,p.lng]).addTo(map);}
 if(resolveAddress)fillAddress(point);
 text('Точка доставки выбрана.');
}
function leaflet(){
 if(window.L)return Promise.resolve();
 if(loading)return loading;
 if(!document.getElementById('publicDeliveryMapCSS')){
  const css=document.createElement('link');
  css.id='publicDeliveryMapCSS';css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.append(css);
 }
 loading=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  const fail=()=>{clearTimeout(timer);script.remove();reject(Error('Leaflet unavailable'));};
  const timer=setTimeout(fail,10000);
  script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  script.onload=()=>{clearTimeout(timer);window.L?resolve():fail();};
  script.onerror=fail;
  document.head.append(script);
 }).catch(error=>{loading=null;throw error;});
 return loading;
}
function openMap(){
 if(!isDelivery())return;
 const canvas=$('deliveryMap'),button=$('deliveryMapOpen');
 if(map){canvas.hidden=false;map.invalidateSize();return;}
 if(opening)return;
 if(!cafe?.delivery_zone){button.hidden=false;if(statusKey===choosePoint)text(mapUnavailable);return;}
 button.hidden=true;
 opening=(async()=>{
  try{
   await leaflet();
   if(!isDelivery())return;
   canvas.hidden=false;
   map=L.map(canvas,{scrollWheelZoom:false}).setView([Number(cafe.latitude),Number(cafe.longitude)],15);
   map.attributionControl?.setPrefix(false);
   window.UmmaMaps.basemap(map,canvas,key=>{if(key==='Карта загружается с ошибками. Попробуйте позже.'&&statusKey===choosePoint)text(mapUnavailable);},{blueWater:true});
   L.polygon(cafe.delivery_zone,{color:'#087b80',weight:2,fill:false,interactive:false}).addTo(map);
   map.on('click',e=>{generation++;select(e.latlng);});
   if(point){select({lat:point.latitude,lng:point.longitude},false);if(point)map.setView([point.latitude,point.longitude],17);}
   else if(statusKey===mapUnavailable)text(choosePoint);
   map.invalidateSize();
  }catch{
   map?.remove();map=null;marker=null;canvas.hidden=true;button.hidden=false;
   if(statusKey===choosePoint)text(mapUnavailable);
  }finally{opening=null;}
 })();
}
$('deliveryMapOpen').onclick=openMap;
$('deliveryLocate').onclick=()=>{
 const version=++generation;
 if(!navigator.geolocation){text(locateFailed);return;}
 text('Определяем местоположение…');
 openMap();
 navigator.geolocation.getCurrentPosition(p=>{
  if(version!==generation||!isDelivery()||$('customerFields').disabled)return;
  if(!cafe?.delivery_zone){text(locateFailed);return;}
  select({lat:p.coords.latitude,lng:p.coords.longitude});
  if(point&&map)map.setView([point.latitude,point.longitude],17);
 },()=>{if(version===generation)text(locateFailed);},{enableHighAccuracy:true,timeout:12000,maximumAge:0});
};
function mode(){
 generation++;cancelAddress();const delivery=$('orderType').value==='delivery';
 $('deliveryFields').hidden=!delivery;
 for(const id of ['deliveryAddress','deliveryPhone']){$(id).required=delivery;$(id).disabled=!delivery;}
 $('tableNumber').closest('label').hidden=true;
 if(delivery){
  text(point?'Точка доставки выбрана.':choosePoint);
  openMap();
 }
}
$('orderType').onchange=mode;mode();
window.ummaPublicDelivery={
 loadMapLibrary:leaflet,
 setCafe(value){cafe=value;if(value)openMap();},
 point:()=>point?{...point}:null,
 fields(){if($('orderType').value!=='delivery')return {};if(!point)throw Error(t('Выберите точку доставки на карте.'));return {orderType:'delivery',address:$('deliveryAddress').value.trim(),phone:$('deliveryPhone').value.trim(),...point};},
 reset(){cancelAddress();autoAddress='';point=null;generation++;if(marker){marker.remove();marker=null;}mode();text('Выберите точку доставки на карте.');},
};
})();
