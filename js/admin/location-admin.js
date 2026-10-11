/* UMMA GLOBAL — GOOGLE MAPS LOCATION DIRECTORY */
(() => {
  "use strict";
  const API="https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-location-admin";
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  let map=null,markers=[],pin=null,locations=[],users=[],managers=[],selectedId=null,busy=false,geocoder=null;
  const typeNames={cafe:"Кафе",restaurant:"Ресторан",warehouse:"Склад",market:"Магазин",other:"Другое"};
  async function api(payload){
    const initData=window.Telegram?.WebApp?.initData;
    if(!initData)throw new Error("Откройте приложение через Telegram");
    const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...payload,initData})});
    const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||"Ошибка запроса");return d;
  }
  function message(text,show=true){const el=$("locationAdminMessage");if(el){el.textContent=text;el.hidden=!show;}}
  function isSuper(){return typeof isUmmaSuperAdmin==="function"&&isUmmaSuperAdmin();}
  function displayName(u){return [u.first_name,u.last_name].filter(Boolean).join(" ")||u.username||String(u.telegram_id);}
  function managerFor(id){return managers.find(m=>m.location_id===id);}
  function fillManagerSelect(currentId){
    const s=$("locationManager");
    s.innerHTML='<option value="">Выберите администратора кафе</option>'+users.filter(u=>u.is_active&&u.role!=="super_admin").map(u=>'<option value="'+esc(u.telegram_id)+'">'+esc(displayName(u))+' · '+esc(u.role)+' · ID '+esc(u.telegram_id)+'</option>').join("");
    if(currentId)s.value=String(currentId);
  }
  function setCoordinates(lat,lng){
    $("locationLatitude").value=Number(lat).toFixed(7);$("locationLongitude").value=Number(lng).toFixed(7);
  }
  function setPin(lat,lng,pan=true){
    lat=Number(lat);lng=Number(lng);if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
    setCoordinates(lat,lng);
    if(map){
      if(!pin)pin=new google.maps.Marker({map,position:{lat,lng},draggable:true,title:"Точка локации"});
      else {pin.setPosition({lat,lng});pin.setMap(map);}
      google.maps.event.clearListeners(pin,"dragend");
      pin.addListener("dragend",()=>{const p=pin.getPosition();setCoordinates(p.lat(),p.lng());});
      if(pan){map.setCenter({lat,lng});map.setZoom(Math.max(map.getZoom()||6,15));}
    }
  }
  function initMap(){
    if(map)return true;
    const el=$("locationAdminMap");if(!el||!window.google?.maps)return false;
    map=new google.maps.Map(el,{center:{lat:12.2388,lng:109.1967},zoom:6,mapTypeControl:true,streetViewControl:false,fullscreenControl:true,gestureHandling:"greedy"});
    geocoder=new google.maps.Geocoder();
    map.addListener("click",e=>{
      if(!e.latLng)return;setPin(e.latLng.lat(),e.latLng.lng(),false);
      message("Точка выбрана. Можно перетащить маркер для точного положения.");
    });
    return true;
  }
  function renderMap(){
    if(!map)return;
    markers.forEach(m=>m.setMap(null));markers=[];
    const bounds=new google.maps.LatLngBounds();let count=0;
    locations.forEach(l=>{
      if(l.latitude==null||l.longitude==null)return;
      const lat=Number(l.latitude),lng=Number(l.longitude);if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
      const marker=new google.maps.Marker({map,position:{lat,lng},title:l.name,label:{text:l.location_type==="warehouse"?"W":(l.location_type==="market"?"M":"U"),color:"#ffffff"}});
      const info=new google.maps.InfoWindow({content:'<div style="max-width:240px"><strong>'+esc(l.name)+'</strong><br>'+esc(typeNames[l.location_type]||l.location_type)+'<br>'+esc(l.address||"Адрес не указан")+'<br><button type="button" data-edit-location="'+esc(l.id)+'">Редактировать</button></div>'});
      marker.addListener("click",()=>info.open({map,anchor:marker}));
      markers.push(marker);bounds.extend({lat,lng});count++;
    });
    if(count>1)map.fitBounds(bounds,{padding:35});
    else if(count===1){const p=bounds.getCenter();map.setCenter(p);map.setZoom(13);}
  }
  function renderList(){
    const root=$("locationAdminList");if(!root)return;
    if(!locations.length){root.innerHTML='<div class="cafe-message">Локаций пока нет.</div>';return;}
    root.innerHTML=locations.map(l=>{
      const manager=managerFor(l.id),user=manager&&users.find(u=>String(u.telegram_id)===String(manager.telegram_id));
      const coords=l.latitude!=null&&l.longitude!=null?Number(l.latitude).toFixed(5)+", "+Number(l.longitude).toFixed(5):"Точка на карте не установлена";
      return '<article class="cafe-staff-card" style="margin-bottom:10px"><div class="cafe-staff-card-head"><div><strong>'+esc(l.name)+'</strong><small>'+esc(typeNames[l.location_type]||l.location_type)+' · '+esc(l.city||l.country||"")+'</small></div><span class="'+(l.is_active?"cafe-staff-active":"cafe-staff-inactive")+'">'+(l.is_active?"Активна":"Отключена")+'</span></div><p style="margin:8px 0">'+esc(l.address||"Адрес не указан")+'</p><p style="font-size:12px;color:#607171;margin:4px 0">Координаты: '+esc(coords)+'</p><p style="font-size:12px;color:#607171;margin:4px 0">Администратор: '+esc(user?displayName(user):"Не назначен")+'</p><div class="cafe-staff-card-foot"><button type="button" class="cafe-staff-payment-permission" data-edit-location="'+esc(l.id)+'">Открыть на карте / изменить</button></div></article>';
    }).join("");
  }
  function resetForm(){
    selectedId=null;$("locationForm").reset();$("locationId").value="";$("locationActive").checked=true;$("locationCountry").value="Vietnam";
    $("locationFormTitle").textContent="Добавить новую локацию";$("locationSave").textContent="Сохранить локацию";$("locationManagerWrap").hidden=false;fillManagerSelect("");
    if(pin){pin.setMap(null);pin=null;}
    $("locationLatitude").value="";$("locationLongitude").value="";
  }
  function editLocation(id){
    const l=locations.find(x=>String(x.id)===String(id));if(!l)return;
    selectedId=l.id;$("locationId").value=l.id;$("locationName").value=l.name||"";$("locationType").value=l.location_type||"cafe";$("locationAddress").value=l.address||"";
    $("locationCity").value=l.city||"";$("locationCountry").value=l.country||"Vietnam";$("locationPhone").value=l.phone||"";$("locationActive").checked=!!l.is_active;
    $("locationLatitude").value=l.latitude??"";$("locationLongitude").value=l.longitude??"";
    const m=managerFor(l.id);fillManagerSelect(m?.telegram_id||"");
    $("locationFormTitle").textContent="Изменить локацию";$("locationSave").textContent="Сохранить изменения";
    if(l.latitude!=null&&l.longitude!=null)setPin(Number(l.latitude),Number(l.longitude),true);
    else if(pin){pin.setMap(null);pin=null;}
    $("locationAdminPage").scrollIntoView({behavior:"smooth",block:"start"});
    message("Локация загружена. Нажмите на карту, чтобы изменить точку.");
  }
  async function load(force=false){
    if(busy&&!force)return;busy=true;message("Загружаем список локаций…");
    try{
      const d=await api({action:"list"});locations=d.locations||[];users=d.users||[];managers=d.managers||[];
      fillManagerSelect("");renderMap();renderList();message("Список загружен. На карте отображаются локации с координатами.");
    }catch(e){message(e.message||"Не удалось загрузить локации");}
    finally{busy=false;}
  }
  async function open(){
    if(!isSuper()){if(typeof showToast==="function")showToast("Доступ только для суперадминистратора");return;}
    ["adminPage","adminUsersPage","cafeStaffAdminPage","cafeKitchenPage","cafeInventoryPage","cafeProductsAdminPage","cafePage"].forEach(id=>{if($(id))$(id).hidden=true;});
    const home=document.querySelector(".app > main"),nav=document.querySelector(".bottom-nav");if(home)home.style.display="none";if(nav)nav.style.display="none";
    $("locationAdminPage").hidden=false;window.scrollTo({top:0,behavior:"smooth"});message("Подключаем Google Maps…");
    try{await window.loadUmmaGoogleMaps();if(!initMap())throw new Error("Не удалось инициализировать Google Maps");map.setCenter({lat:12.2388,lng:109.1967});setTimeout(()=>{google.maps.event.trigger(map,"resize");load();},100);}
    catch(e){message(e.message||"Google Maps пока не настроена");}
  }
  async function geocode(){
    const q=[$("locationAddress").value.trim(),$("locationCity").value.trim(),$("locationCountry").value.trim()].filter(Boolean).join(", ");
    if(!q){message("Сначала введите адрес, город и страну.");return;}
    if(!geocoder){message("Карта ещё не готова.");return;}
    message("Ищем адрес в Google Maps…");
    try{
      const response=await geocoder.geocode({address:q});
      if(!response.results?.length)throw new Error("Адрес не найден. Нажмите на карту и установите точку вручную.");
      const result=response.results[0],p=result.geometry.location;setPin(p.lat(),p.lng(),true);
      if(!$("locationAddress").value.trim())$("locationAddress").value=result.formatted_address;
      message("Адрес найден. Проверьте положение маркера и при необходимости передвиньте его.");
    }catch(e){message(e.message||"Не удалось найти адрес");}
  }
  $("locationOpenMapButton")?.addEventListener("click",open);
  $("locationAdminBack")?.addEventListener("click",()=>{if($("locationAdminPage"))$("locationAdminPage").hidden=true;if(typeof openAdminPanel==="function")openAdminPanel();});
  $("locationRefresh")?.addEventListener("click",load);
  $("locationNew")?.addEventListener("click",()=>{resetForm();message("Введите данные новой локации и выберите точку на карте.");});
  $("locationFindAddress")?.addEventListener("click",geocode);
  $("locationType")?.addEventListener("change",()=>{const isCafe=["cafe","restaurant"].includes($("locationType").value);$("locationManagerWrap").hidden=!isCafe;});
  document.addEventListener("click",e=>{const el=e.target instanceof Element?e.target.closest("[data-edit-location]"):null;if(el){editLocation(el.getAttribute("data-edit-location"));}});
  $("locationForm")?.addEventListener("submit",async e=>{
    e.preventDefault();if(busy)return;
    const type=$("locationType").value,isCafe=["cafe","restaurant"].includes(type),manager=$("locationManager").value;
    if(isCafe&&!manager){message("Назначьте главного администратора этого кафе.");return;}
    if(!$("locationLatitude").value||!$("locationLongitude").value){message("Выберите точку на карте или найдите адрес.");return;}
    busy=true;$("locationSave").disabled=true;message("Сохраняем локацию и назначение администратора…");
    try{
      const d=await api({action:"save",id:selectedId,name:$("locationName").value.trim(),location_type:type,address:$("locationAddress").value.trim(),city:$("locationCity").value.trim(),country:$("locationCountry").value.trim(),phone:$("locationPhone").value.trim(),latitude:$("locationLatitude").value,longitude:$("locationLongitude").value,is_active:$("locationActive").checked,manager_telegram_id:isCafe?manager:null});
      const saved=d.location||d;selectedId=saved.id;await load(true);editLocation(selectedId);message("Локация сохранена. Главный администратор привязан к этому кафе.");
    }catch(err){message(err.message||"Не удалось сохранить локацию");}
    finally{busy=false;$("locationSave").disabled=false;}
  });
  window.ummaLocationAdmin={open,refresh:load};
})();