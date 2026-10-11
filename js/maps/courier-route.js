/* Shared Leaflet route view for Umma delivery couriers */
(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  let map=null,route=null,markers=[];
  function status(text){if($("courierMapMessage"))$("courierMapMessage").textContent=text;}
  function currentPosition(){
    return new Promise(resolve=>{
      if(!navigator.geolocation){resolve(null);return;}
      navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lng:p.coords.longitude}),()=>resolve(null),{enableHighAccuracy:true,timeout:6500,maximumAge:60000});
    });
  }
  async function findAddress(address){
    const url="https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q="+encodeURIComponent(address+", Vietnam")+"&accept-language=ru,en";
    const res=await fetch(url);if(!res.ok)throw new Error("Поиск адреса временно недоступен");
    const data=await res.json();if(!data.length)throw new Error("Адрес не найден. Проверьте, что в заказе указан полный адрес.");
    return {lat:Number(data[0].lat),lng:Number(data[0].lon),label:data[0].display_name};
  }
  function clearLayers(){
    markers.forEach(m=>map.removeLayer(m));markers=[];
    if(route){map.removeLayer(route);route=null;}
  }
  async function open(button){
    if(!window.L){status("Библиотека карты не загрузилась.");return;}
    const address=button.getAttribute("data-route-address")||"";
    const originLat=Number(button.getAttribute("data-route-origin-lat")),originLng=Number(button.getAttribute("data-route-origin-lng"));
    const originName=button.getAttribute("data-route-origin-name")||"Кафе";
    const orderNo=button.getAttribute("data-route-order-number")||"";
    const modal=$("courierMapModal");if(!modal)return;
    modal.hidden=false;modal.style.display="block";
    $("courierMapTitle").textContent="Маршрут · Заказ №"+orderNo;
    $("courierMapExternal").href="https://www.google.com/maps/dir/?api=1&destination="+encodeURIComponent(address+", Vietnam");
    if(!map){
      map=L.map("courierRouteMap").setView([12.2388,109.1967],6);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);
    }
    setTimeout(()=>map&&map.invalidateSize(),80);
    clearLayers();status("Находим адрес доставки…");
    try{
      const dest=await findAddress(address);
      markers.push(L.marker([dest.lat,dest.lng]).addTo(map).bindPopup("Доставка · заказ №"+esc(orderNo)).openPopup());
      const all=Array.isArray(window.ummaLocationPins)?window.ummaLocationPins:[];
      all.filter(l=>l.latitude!=null&&l.longitude!=null).forEach(l=>{
        const marker=L.circleMarker([Number(l.latitude),Number(l.longitude)],{radius:6,color:"#176b55",fillColor:"#0fa3a8",fillOpacity:.9}).addTo(map).bindPopup(esc(l.name)+(l.address?"<br>"+esc(l.address):""));
        markers.push(marker);
      });
      status("Получаем ваше местоположение для построения маршрута…");
      let origin=await currentPosition();
      if(!origin&&Number.isFinite(originLat)&&Number.isFinite(originLng)&&originLat>=-90&&originLat<=90&&originLng>=-180&&originLng<=180)origin={lat:originLat,lng:originLng};
      if(!origin){map.setView([dest.lat,dest.lng],15);status("Адрес найден. Разрешите геолокацию, чтобы построить маршрут от вас, или откройте Google Maps.");return;}
      markers.push(L.marker([origin.lat,origin.lng]).addTo(map).bindPopup(originName+" · отправление"));
      status("Строим автомобильный маршрут…");
      const res=await fetch("https://router.project-osrm.org/route/v1/driving/"+origin.lng+","+origin.lat+";"+dest.lng+","+dest.lat+"?overview=full&geometries=geojson");
      if(!res.ok)throw new Error("Сервис маршрутов временно недоступен");
      const data=await res.json();if(data.code!=="Ok"||!data.routes||!data.routes.length)throw new Error("Не удалось построить маршрут для этих точек");
      route=L.geoJSON(data.routes[0].geometry,{style:{color:"#0fa3a8",weight:5,opacity:.9}}).addTo(map);
      map.fitBounds(route.getBounds(),{padding:[28,28]});
      status("Маршрут построен · "+(data.routes[0].distance/1000).toFixed(1)+" км · около "+Math.round(data.routes[0].duration/60)+" мин. Время ориентировочное.");
    }catch(e){status((e instanceof Error?e.message:"Не удалось построить маршрут")+" Используйте кнопку Google Maps для навигации.");}
  }
  document.addEventListener("click",event=>{
    const target=event.target instanceof Element?event.target.closest("[data-show-route='true']"):null;
    if(target){event.preventDefault();open(target);}
  });
  $("courierMapClose")?.addEventListener("click",()=>{const modal=$("courierMapModal");if(modal){modal.hidden=true;modal.style.display="none";}});
  window.UmmaCourierMap={open};
})();