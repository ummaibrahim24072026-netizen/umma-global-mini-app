/* Delivery uses the same cart, receipt and payment status as counter orders. */
(()=>{
'use strict';
const $=id=>document.getElementById(id),t=(key)=>window.ummaMenuI18n.t(key);
let cafe=null,map=null,marker=null,point=null,loading=null,generation=0;
let statusKey='Выберите точку доставки на карте.';
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
function leaflet(){if(window.L)return Promise.resolve();if(loading)return loading;
 loading=new Promise((resolve,reject)=>{const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.append(css);const s=document.createElement('script');s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';s.onload=resolve;s.onerror=()=>{loading=null;reject(Error());};document.head.append(s);});return loading;
}
$('deliveryMapOpen').onclick=async()=>{const button=$('deliveryMapOpen');button.disabled=true;try{if(!cafe?.delivery_zone)throw Error();await leaflet();$('deliveryMap').hidden=false;if(!map){map=L.map('deliveryMap',{scrollWheelZoom:false}).setView([Number(cafe.latitude),Number(cafe.longitude)],15);window.UmmaMaps.basemap(map,$('deliveryMap'),()=>{});L.polygon(cafe.delivery_zone,{color:'#03a2a5',weight:2,fillOpacity:.1}).addTo(map);map.fitBounds(cafe.delivery_zone);map.on('click',e=>select(e.latlng));if(point)select({lat:point.latitude,lng:point.longitude},false);}map.invalidateSize();}catch{text('Карта недоступна. Используйте геолокацию.');}finally{button.disabled=false;}};
$('deliveryLocate').onclick=()=>{const version=++generation;if(!navigator.geolocation){text('Не удалось определить местоположение. Выберите точку на карте.');return;}text('Определяем местоположение…');navigator.geolocation.getCurrentPosition(p=>{if(version!==generation||$('orderType').value!=='delivery')return;select({lat:p.coords.latitude,lng:p.coords.longitude});if(point&&map)map.setView([point.latitude,point.longitude],17);},()=>{if(version===generation)text('Не удалось определить местоположение. Выберите точку на карте.');},{enableHighAccuracy:true,timeout:12000,maximumAge:0});};
function mode(){generation++;cancelAddress();const delivery=$('orderType').value==='delivery';$('deliveryFields').hidden=!delivery;$('deliveryAddress').required=delivery;$('deliveryAddress').disabled=!delivery;$('tableNumber').closest('label').hidden=true;if(map&&delivery)setTimeout(()=>map.invalidateSize(),0);}
$('orderType').onchange=mode;mode();
window.ummaPublicDelivery={
 setCafe(value){cafe=value;},
 point:()=>point?{...point}:null,
 fields(){if($('orderType').value!=='delivery')return {};if(!point)throw Error(t('Выберите точку доставки на карте.'));return {orderType:'delivery',address:$('deliveryAddress').value.trim(),...point};},
 reset(){cancelAddress();autoAddress='';point=null;generation++;if(marker){marker.remove();marker=null;}mode();text('Выберите точку доставки на карте.');},
 receipt(order){const show=order.orderType==='delivery'&&/^[a-f0-9]{64}$/.test(order.trackingToken||'');$('deliveryReceipt').hidden=!show;if(!show)return;const url=new URL('delivery-tracking.html',document.baseURI);url.hash='token='+order.trackingToken;$('trackingLink').href=url.href;$('trackingLink').textContent=t('Отследить доставку');$('trackingCopy').textContent=t('Скопировать ссылку');$('trackingCopy').onclick=async()=>{try{await navigator.clipboard.writeText(url.href);$('trackingCopy').textContent=t('Ссылка скопирована');}catch{$('trackingLink').focus();}};}
};
})();
