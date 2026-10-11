/* UMMA GLOBAL — GOOGLE MAPS COURIER VIEW; navigation delegated to Google Maps app */
(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  let map=null,markers=[];
  function status(text){if($("courierMapMessage"))$("courierMapMessage").textContent=text;}
  function currentPosition(){
    return new Promise(resolve=>{
      if(!navigator.geolocation){resolve(null);return;}
      navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lng:p.coords.longitude}),()=>resolve(null),{enableHighAccuracy:false,timeout:4500,maximumAge:120000});
    });
  }
  function clearMarkers(){markers.forEach(m=>m.setMap(null));markers=[];}
  async function open(button){
    const address=button.getAttribute("data-route-address")||"";
    const rawLat=button.getAttribute("data-route-origin-lat"),rawLng=button.getAttribute("data-route-origin-lng");
    const originLat=rawLat===""?NaN:Number(rawLat),originLng=rawLng===""?NaN:Number(rawLng);
    const originName=button.getAttribute("data-route-origin-name")||"Кафе";
    const orderNo=button.getAttribute("data-route-order-number")||"";
    const modal=$("courierMapModal");if(!modal)return;
    modal.hidden=false;modal.style.display="block";
    $("courierMapTitle").textContent="Маршрут · Заказ №"+orderNo;
    $("courierMapExternal").href="https://www.google.com/maps/dir/?api=1&destination="+encodeURIComponent(address+", Vietnam")+"&travelmode=driving";
    $("courierMapNote").textContent="Для экономии расходов расчёт маршрута и пошаговая навигация открываются в Google Maps.";
    status("Подключаем Google Maps…");
    try{
      await window.loadUmmaGoogleMaps();
      const el=$("courierRouteMap");
      if(!map)map=new google.maps.Map(el,{center:{lat:12.2388,lng:109.1967},zoom:6,mapTypeControl:true,streetViewControl:false,fullscreenControl:true,gestureHandling:"greedy"});
      setTimeout(()=>google.maps.event.trigger(map,"resize"),100);
      clearMarkers();
      const all=Array.isArray(window.ummaLocationPins)?window.ummaLocationPins:[];
      all.filter(l=>l.latitude!=null&&l.longitude!=null).forEach(l=>{
        const marker=new google.maps.Marker({map,position:{lat:Number(l.latitude),lng:Number(l.longitude)},title:l.name});
        const info=new google.maps.InfoWindow({content:"<strong>"+esc(l.name)+"</strong><br>"+esc(l.address||"")});
        marker.addListener("click",()=>info.open({map,anchor:marker}));markers.push(marker);
      });
      let origin=await currentPosition();
      if(!origin&&Number.isFinite(originLat)&&Number.isFinite(originLng)&&originLat>=-90&&originLat<=90&&originLng>=-180&&originLng<=180)origin={lat:originLat,lng:originLng};
      if(origin){markers.push(new google.maps.Marker({map,position:origin,title:originName+" · отправление",label:"A"}));}
      const destMarker=new google.maps.Marker({map,position:origin||{lat:12.2388,lng:109.1967},title:"Адрес доставки",label:"B"});
      markers.push(destMarker);
      let dest=null;
      if(address){
        const geocoder=new google.maps.Geocoder();
        const result=await geocoder.geocode({address:address+", Vietnam"});
        if(result.results?.length){dest=result.results[0].geometry.location;destMarker.setPosition(dest);}
      }
      if(origin&&dest){const bounds=new google.maps.LatLngBounds();bounds.extend(origin);bounds.extend(dest);map.fitBounds(bounds,50);}
      else if(dest){map.setCenter(dest);map.setZoom(15);}
      else if(origin){map.setCenter(origin);map.setZoom(14);}
      status(dest?"Адрес отмечен на карте. Нажмите «Открыть навигацию в Google Maps» для маршрута.":"Проверьте адрес доставки. Откройте Google Maps для построения маршрута.");
    }catch(e){status((e instanceof Error?e.message:"Не удалось открыть карту")+" Откройте навигацию по кнопке ниже.");}
  }
  document.addEventListener("click",event=>{
    const target=event.target instanceof Element?event.target.closest("[data-show-route='true']"):null;
    if(target){event.preventDefault();open(target);}
  });
  $("courierMapClose")?.addEventListener("click",()=>{const modal=$("courierMapModal");if(modal){modal.hidden=true;modal.style.display="none";}});
  window.UmmaCourierMap={open};
})();