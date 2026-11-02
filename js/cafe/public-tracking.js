/* A private token grants read-only access to one order, never a customer's ID. */
(()=>{
'use strict';
const $=id=>document.getElementById(id),I=window.ummaMenuI18n,t=I.t;
const token=new URLSearchParams(location.hash.slice(1)).get('token')||'';
let map=null,marker=null,timer=null,controller=null,previous='',data=null,stopped=false,active=false;
const terminal=['delivered','completed','cancelled'];
const names={pending:'Заказ отправлен',confirmed:'Заказ принят',preparing:'Готовится',ready:'Заказ готов',waiting_courier:'Ищем курьера',courier_assigned:'Курьер назначен',picked_up:'Курьер в пути',delivered:'Заказ доставлен',completed:'Заказ выдан',cancelled:'Заказ отменён'};
function hideMap(){if(map){map.remove();map=null;marker=null;}$('map').hidden=true;}
function labels(){if(data)$('status').textContent=t('Заказ №{number}',{number:data.number})+' · '+t(names[data.orderStatus]||'Заказ отправлен')+' · '+t(names[data.state]||'Ищем курьера');$('note').textContent=t('Координаты доступны только во время доставки. Обновление каждые 5 секунд.');$('notify').textContent=t('Уведомления для открытой страницы');$('back').textContent=t('Вернуться к меню');}
for(const [code,[label]]of Object.entries(I.languages)){const o=document.createElement('option');o.value=code;o.textContent=label;$('menuLanguage').append(o);}$('menuLanguage').value=I.language;$('menuLanguage').onchange=e=>I.setLanguage(e.target.value);window.addEventListener('umma-menu:languagechange',labels);labels();
$('notify').hidden=!('Notification'in window);$('notify').onclick=async()=>{if(!('Notification'in window))return;try{const p=await Notification.requestPermission();$('notify').textContent=t(p==='granted'?'Уведомления разрешены для открытой страницы':'Уведомления не разрешены');}catch{$('notify').textContent=t('Уведомления не разрешены');}};
async function poll(){if(stopped||active)return;active=true;clearTimeout(timer);controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);try{
 const r=await fetch('https://zwzojugspldexyyljwpr.supabase.co/functions/v1/umma-guest-delivery',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'tracking',token}),cache:'no-store',signal:controller.signal});
 if(r.status===404){stopped=true;hideMap();$('status').textContent=t('Ссылка отслеживания недействительна или истекла.');return;}
 const d=await r.json();if(!r.ok||!d.ok)throw Error();if(stopped)return;data=d;labels();$('connection').textContent='';
 const age=Date.now()-Date.parse(d.updatedAt),fresh=!terminal.includes(d.state)&&!['cancelled','completed'].includes(d.orderStatus)&&Number.isFinite(d.latitude)&&Number.isFinite(d.longitude)&&Math.abs(d.latitude)<=90&&Math.abs(d.longitude)<=180&&age>=-10000&&age<60000;
 if(fresh&&window.L&&window.UmmaMaps){$('map').hidden=false;if(!map)map=UmmaMaps.create($('map'),{lat:d.latitude,lng:d.longitude},()=>{});if(marker)marker.setLatLng([d.latitude,d.longitude]);else marker=UmmaMaps.marker(map,{lat:d.latitude,lng:d.longitude},'courier');map.invalidateSize();map.panTo([d.latitude,d.longitude]);}else hideMap();
 const state=d.orderStatus+':'+d.state;if(previous&&state!==previous&&document.hidden&&'Notification'in window&&Notification.permission==='granted'){try{new Notification('UMMA Delivery',{body:$('status').textContent});}catch{}}previous=state;
 if(terminal.includes(d.state))stopped=true;
 }catch{if(!stopped){hideMap();$('connection').textContent=t('Нет связи. Повторяем запрос…');}}finally{clearTimeout(timeout);active=false;if(!stopped)timer=setTimeout(poll,5000);}}
window.addEventListener('pagehide',()=>{stopped=true;clearTimeout(timer);controller?.abort();hideMap();});window.addEventListener('pageshow',e=>{if(e.persisted){stopped=false;void poll();}});
if(/^[a-f0-9]{64}$/.test(token)){if(!data)$('status').textContent=t('Загружаем меню…');void poll();}else{$('status').textContent=t('Ссылка отслеживания недействительна или истекла.');$('notify').hidden=true;}
})();
