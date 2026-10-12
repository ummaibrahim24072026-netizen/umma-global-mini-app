/* UMMA GLOBAL — LOCATION DIRECTORY AND MAP */
(() => {
  "use strict";
  const API="https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-location-admin";
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  let map=null,markers=[],pin=null,locations=[],users=[],managers=[],selectedId=null,busy=false;
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
  function setPin(lat,lng,pan=true){
    if(!Number.isFinite(Number(lat))||!Number.isFinite(Number(lng)))return;
    $("locationLatitude").value=Number(lat).toFixed(7);$("locationLongitude").value=Number(lng).toFixed(7);
    if(map){
      if(!pin){
        const el=document.createElement("div");el.className="umma-map-marker umma-map-marker-is-pin";el.textContent="☪";
        pin=new maplibregl.Marker({element:el,draggable:true}).setLngLat([Number(lng),Number(lat)]).addTo(map);
        pin.on("dragend",()=>{const p=pin.getLngLat();setCoordinates(p.lat,p.lng);});
      }else pin.setLngLat([Number(lng),Number(lat)]);
      if(pan)map.flyTo({center:[Number(lng),Number(lat)],zoom:Math.max(map.getZoom(),15)});
    }
  }
  function setCoordinates(lat,lng){$("locationLatitude").value=Number(lat).toFixed(7);$("locationLongitude").value=Number(lng).toFixed(7);}
  function initMap(){
    if(map)return;
    if(!window.maplibregl){message("Карта не загрузилась: библиотека MapLibre заблокирована или недоступна. Проверьте подключение к unpkg.com.");return;}
    map=new maplibregl.Map({container:"locationAdminMap",style:"https://tiles.openfreemap.org/styles/positron",center:[109.2020884,12.2814294],zoom:13,attributionControl:true});
    map.addControl(new maplibregl.NavigationControl({showCompass:false}),"top-left");
    map.on("load",()=>{map.resize();});
    map.on("error",e=>{const err=e?.error?.message||e?.error?.statusText||"неизвестная ошибка";message("Ошибка загрузки карты: "+err);});
    map.on("click",async e=>{
      setPin(e.lngLat.lat,e.lngLat.lng,false);
      const addr=$("locationAddress").value.trim();
      if(!addr){try{const r=await fetch("https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat="+e.lngLat.lat+"&lon="+e.lngLat.lng+"&zoom=18&addressdetails=1&accept-language=ru,en");if(r.ok){const d=await r.json();if(d.display_name)$("locationAddress").value=d.display_name;const a=d.address||{};if(!$("locationCity").value)$("locationCity").value=a.city||a.town||a.village||a.county||"";}}catch{}}
      message("Точка выбрана. Можно перетащить маркер для точного положения.");
    });
  }
  function renderMap(){
    if(!map)return;
    markers.forEach(m=>m.remove());markers=[];
    const bounds=[];
    locations.forEach(l=>{
      if(l.latitude==null||l.longitude==null)return;
      const lat=Number(l.latitude),lng=Number(l.longitude);if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
      const el=document.createElement("div");el.className="umma-map-marker "+(l.location_type==="cafe"||l.location_type==="restaurant"?"is-cafe":"");
      el.textContent=l.location_type==="warehouse"?"📦":l.location_type==="market"?"🛍️":"☪";
      const popup=new maplibregl.Popup({offset:24}).setHTML('<strong>'+esc(l.name)+'</strong><br>'+esc(typeNames[l.location_type]||l.location_type)+'<br>'+esc(l.address||"Адрес не указан")+'<br><button type="button" class="location-popup-edit" data-edit-location="'+esc(l.id)+'">Редактировать</button>');
      const marker=new maplibregl.Marker({element:el}).setLngLat([lng,lat]).setPopup(popup).addTo(map);
      markers.push(marker);bounds.push([lng,lat]);
    });
    if(bounds.length>1){const b=new maplibregl.LngLatBounds();bounds.forEach(p=>b.extend(p));map.fitBounds(b,{padding:30,maxZoom:14});}
    else if(bounds.length===1)map.jumpTo({center:bounds[0],zoom:13});
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
    if(pin&&map){pin.remove();pin=null;}
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
    else if(pin&&map){pin.remove();pin=null;}
    $("locationAdminPage").scrollIntoView({behavior:"smooth",block:"start"});
    message("Локация загружена. Нажмите на карту, чтобы изменить точку.");
  }
  async function load(force=false){
    if(busy&&!force)return;busy=true;message("Загружаем карту и список локаций…");
    try{
      const d=await api({action:"list"});locations=d.locations||[];users=d.users||[];managers=d.managers||[];
      fillManagerSelect("");renderMap();renderList();message("Карта загружена. На ней отображаются все локации, для которых указаны координаты.");
    }catch(e){message(e.message||"Не удалось загрузить локации");}
    finally{busy=false;}
  }
  function open(){
    if(!isSuper()){if(typeof showToast==="function")showToast("Доступ только для суперадминистратора");return;}
    ["adminPage","adminUsersPage","cafeStaffAdminPage","cafeKitchenPage","cafeInventoryPage","cafeProductsAdminPage","cafePage"].forEach(id=>{if($(id))$(id).hidden=true;});
    const home=document.querySelector(".app > main"),nav=document.querySelector(".bottom-nav");if(home)home.style.display="none";if(nav)nav.style.display="none";
    $("locationAdminPage").hidden=false;initMap();setTimeout(()=>{map?.resize();load();},100);window.scrollTo({top:0,behavior:"smooth"});
  }
  async function geocode(){
    const q=[$("locationAddress").value.trim(),$("locationCity").value.trim(),$("locationCountry").value.trim()].filter(Boolean).join(", ");
    if(!q){message("Сначала введите адрес, город и страну.");return;}
    message("Ищем адрес на карте…");
    try{
      const r=await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q="+encodeURIComponent(q)+"&accept-language=ru,en");
      if(!r.ok)throw new Error("Сервис поиска адреса временно недоступен");
      const a=await r.json();if(!a.length)throw new Error("Адрес не найден. Нажмите на карту и установите точку вручную.");
      setPin(Number(a[0].lat),Number(a[0].lon),true);message("Адрес найден. Проверьте точку на карте и при необходимости передвиньте маркер.");
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