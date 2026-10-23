/* One confirmed destination, shared by customer checkout and courier map links. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const valid = point => point && Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
  const coords = point => point.lat.toFixed(6) + "," + point.lng.toFixed(6);
  function parseAddress(address) {
    const match = String(address || "").match(/^Точка доставки: (-?\d+(?:\.\d+)?),[ ]*(-?\d+(?:\.\d+)?)$/m);
    const point = match ? { lat: Number(match[1]), lng: Number(match[2]) } : null;
    return valid(point) ? point : null;
  }
  const googlePlace = point => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(coords(point));
  const applePlace = point => "https://maps.apple.com/place?coordinate=" + encodeURIComponent(coords(point)) + "&name=" + encodeURIComponent("Точка доставки");
  window.ummaMapLinks = { parseAddress, coords, googlePlace, applePlace };
  const dialog = $("cafeDeliveryMapDialog");
  if (!dialog) return;
  let confirmed = null, draft = null, map = null, marker = null, opener = null, zone = null, zoneLayer = null;
  let cafe = { lat: 12.2388, lng: 109.1967 }, generation = 0, geoRequest = 0;
  let disposeBasemap = null, external = null, unrestricted = false;
  const confirm = $("cafeDeliveryMapConfirm"), gps = $("cafeDeliveryMapLocate");
  function status(text) { $("cafeDeliveryMapStatus").textContent = text; }
  function stopPending() { geoRequest++; gps.disabled = !map; gps.textContent = "Моё местоположение"; }
  function addBasemap() { disposeBasemap = window.UmmaMaps.basemap(map, $("cafeDeliveryMap"), status); }
  function available(point) { return valid(point) && (unrestricted || window.ummaDeliveryZone?.contains(zone, [point.lat, point.lng]) === true); }
  function availability() { if(unrestricted)return !confirmed?"required":available(confirmed)?"available":"required";return !Array.isArray(zone) ? "unavailable" : !confirmed ? "required" : available(confirmed) ? "available" : "outside"; }
  function notify() {
    const messages = {
      unavailable: "Доставка из выбранного кафе пока недоступна. Выберите самовывоз.",
      required: "Доставляем только в пределах зоны на карте. Выберите точку доставки.",
      available: "Адрес входит в зону доставки.",
      outside: "Этот адрес вне зоны доставки выбранного кафе. Выберите другой адрес или самовывоз."
    };
    if(unrestricted){messages.required="Отметьте точку доставки. Доступность маршрута и цену проверит выбранная служба.";messages.available="Точка доставки сохранена. Маршрут и цену проверит выбранная служба.";}
    const state=availability(), hint=$("cafeDeliveryZoneStatus");
    if(hint){hint.textContent=messages[state];hint.dataset.state=state;}
    if(map && window.L.polygon) {zoneLayer?.remove();zoneLayer=!unrestricted&&Array.isArray(zone)?window.L.polygon(zone,{color:'#007c80',weight:2,fillOpacity:0.12,interactive:false}).addTo(map):null;}
    $("cafeDeliveryPointSummary").textContent = confirmed ? "Место доставки отмечено на карте" : "Для доставки нужна точка на карте. Доступ к геолокации необязателен.";
    $("cafeDeliveryPointClear").hidden = !confirmed;
    $("cafeDeliveryMapOpen").textContent = confirmed ? "Изменить точку на карте" : "Указать на карте";
    document.dispatchEvent(new Event("umma:delivery-location-change"));
  }
  function choose(point, message) {
    if (!valid(point) || !map || !dialog.open) return;
    stopPending();
    draft = { lat: Number(point.lat.toFixed(6)), lng: Number(point.lng.toFixed(6)) };
    if (!marker) {
      marker = window.L.marker([draft.lat, draft.lng], { draggable: true, title: "Точка доставки", alt: "Точка доставки", icon: window.L.divIcon({ className: "delivery-destination-marker", html: '<span aria-hidden="true"></span>', iconSize: [30, 38], iconAnchor: [15, 38] }) }).addTo(map);
      marker.on("dragstart", stopPending);
      marker.on("dragend", () => choose(marker.getLatLng(), "Проверьте точку и подтвердите доставку сюда."));
    } else marker.setLatLng([draft.lat, draft.lng]);
    confirm.disabled = !available(draft);
    status(!available(draft) ? "Этот адрес вне зоны доставки выбранного кафе. Выберите другой адрес или самовывоз." : message || "Проверьте точку и нажмите «Доставить сюда».");
    $("cafeDeliveryDraftCoordinates").textContent = coords(draft);
  }
  function cleanup() {
    generation++; disposeBasemap?.(); disposeBasemap = null; stopPending();
    try { map?.remove(); } catch {}
    $("cafeDeliveryMap").replaceChildren(); map = null; marker = null; draft = null; zoneLayer = null;
    if(external){if(external.titleHTML!==undefined){$('cafeDeliveryMapTitle').innerHTML=external.titleHTML;confirm.textContent=external.confirmText;}({zone,cafe,confirmed,unrestricted}=external.previous);external=null;notify();}
    opener?.focus({ preventScroll: true });
  }
  function open(source) {
    if (dialog.open) return;
    opener = source || $("cafeDeliveryMapOpen");
    generation++;
    draft = null; confirm.disabled = true;
    $("cafeDeliveryDraftCoordinates").textContent = "";
    status(unrestricted?"Отметьте место доставки. Маршрут и цену проверит выбранная служба.":"Доставляем только в пределах зоны на карте. Выберите точку доставки.");
    dialog.showModal();
    if (!window.L?.map) {
      gps.disabled = true; $("cafeDeliveryMapManual").disabled = true;
      status(unrestricted?"Карта не загрузилась. Повторите выбор точки. Без выбора точки доставка недоступна.":"Карта не загрузилась. Проверьте соединение и повторите выбор точки. Без проверки зоны доставка недоступна.");
      return;
    }
    try {
      map = window.L.map("cafeDeliveryMap", { scrollWheelZoom: false }).setView([cafe.lat, cafe.lng], 16);
      map.attributionControl?.setPrefix(false);
      addBasemap(generation);
      if(!unrestricted && Array.isArray(zone) && window.L.polygon) {zoneLayer=window.L.polygon(zone,{color:'#007c80',weight:2,fillOpacity:0.12,interactive:false}).addTo(map);map.fitBounds?.(zone,{padding:[20,20]});}
      map.on("click", event => choose(event.latlng));
      map.on("dragstart", stopPending);
      map.on("dragend", () => choose(map.getCenter()));
      window.L.marker([cafe.lat, cafe.lng], { interactive: false, keyboard: false, icon: window.L.divIcon({ className: "umma-cafe-marker", html: '<span>UMMA<br>CAFE</span>', iconSize: [48, 42], iconAnchor: [24, 42] }) }).addTo(map);
      gps.disabled = false; $("cafeDeliveryMapManual").disabled = false;
      if (confirmed) { choose(confirmed); map.setView([confirmed.lat, confirmed.lng], 17, { animate: false }); }
      map.invalidateSize();
    } catch {
      map?.remove(); map = null; gps.disabled = true; $("cafeDeliveryMapManual").disabled = true;
      status("Карта недоступна. Повторите позже или выберите самовывоз.");
    }
  }
  function locate() {
    if (!map || !dialog.open) return;
    if (!navigator.geolocation) { status("Геолокация недоступна. Поставьте точку на карте вручную."); return; }
    const session = generation, request = ++geoRequest;
    gps.disabled = true; gps.textContent = "Определяем…";
    status("Разрешите доступ к местоположению. Затем проверьте найденную точку.");
    try { navigator.geolocation.getCurrentPosition(position => {
      if (!dialog.open || session !== generation || request !== geoRequest) return;
      const point = { lat: position.coords.latitude, lng: position.coords.longitude };
      if (!valid(point)) { stopPending(); status("Не удалось определить точку. Выберите её на карте."); return; }
      const accuracy = Number(position.coords.accuracy);
      choose(point, (Number.isFinite(accuracy) ? "Точность геолокации ≈ " + Math.round(accuracy) + " м. " : "") + "Проверьте метку и при необходимости передвиньте её.");
      map.setView([point.lat, point.lng], 17, { animate: false });
    }, () => {
      if (!dialog.open || session !== generation || request !== geoRequest) return;
      stopPending(); status("Не удалось получить геолокацию. Проверьте разрешение или поставьте точку вручную.");
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
    } catch { stopPending(); status("Доступ к геолокации недоступен. Поставьте точку на карте вручную."); }
  }
  $("cafeDeliveryMapOpen").addEventListener("click", () => open());
  $("cafeDeliveryMapClose").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", cleanup);
  gps.addEventListener("click", locate);
  $("cafeDeliveryMapManual").addEventListener("click", () => {
    if (!map || !dialog.open) return;
    stopPending();
    status("Нажмите на нужное здание или передвиньте карту к месту доставки. Затем нажмите «Доставить сюда».");
    $("cafeDeliveryMap").focus({ preventScroll: true });
    map.invalidateSize();
  });
  confirm.addEventListener("click", () => {
    if (!valid(draft) || !available(draft)) return;
    if(external){external.onConfirm({...draft});dialog.close();return;}
    confirmed = { ...draft }; notify(); dialog.close();
  });
  $("cafeDeliveryPointClear").addEventListener("click", () => { confirmed = null; notify(); });
  window.ummaDeliveryLocation = {
    chooseForLocation: (location,onConfirm,source,options={}) => {
      if(dialog.open||(!options.unrestricted&&!Array.isArray(location?.delivery_zone)))return;
      external={previous:{zone,cafe,confirmed,unrestricted},onConfirm};zone=location?.delivery_zone;unrestricted=options.unrestricted===true;
      if(location?.latitude!=null&&location?.longitude!=null&&Number.isFinite(Number(location.latitude))&&Number.isFinite(Number(location.longitude)))cafe={lat:Number(location.latitude),lng:Number(location.longitude)};
      confirmed=valid(options.point)?{...options.point}:null;if(options.title){external.titleHTML=$('cafeDeliveryMapTitle').innerHTML;external.confirmText=confirm.textContent;$('cafeDeliveryMapTitle').textContent=options.title;confirm.textContent=options.confirmText||'Выбрать точку';}open(source);
    },
    setCarrierMode: enabled => {const next=enabled===true;if(next===unrestricted)return;if(dialog.open)return;unrestricted=next;notify();},
    hasPoint: () => valid(confirmed) === true,
    availability,
    getAddress: details => {
      const text = String(details || "").replace(/^Точка доставки:.*$/gm, "").trim().slice(0, 440);
      return confirmed ? [text, "Точка доставки: " + coords(confirmed)].filter(Boolean).join("\n") : text;
    },
    setCafeLocation: location => {
      zone = Array.isArray(location?.delivery_zone) ? location.delivery_zone : null;
      if(draft) {confirm.disabled=!available(draft);}
      notify();
      if (location?.latitude == null || location?.longitude == null) return;
      const point = { lat: Number(location.latitude), lng: Number(location.longitude) };
      if (valid(point)) cafe = point;
    },
    reset: () => { if (dialog.open) dialog.close(); confirmed = null; notify(); }
  };
  $("staffDeliveryMapOpen")?.addEventListener("click",async()=>{
    if(dialog.open)return;
    const button=$("staffDeliveryMapOpen"),hint=$("staffDeliveryMapStatus");
    button.disabled=true;
    try{
      const response=await fetch("https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-menu",{cache:"no-store"});
      const result=await response.json();if(!response.ok||!result.ok)throw Error("Не удалось проверить зону доставки");
      const id=$("staffOrderLocation")?.value||window.ummaKitchen?.getLocationId?.();
      const location=(result.locations||[result.location]).find(l=>l&&String(l.id)===String(id));
      if(!location?.delivery_zone)throw Error("Доставка из выбранного кафе пока недоступна. Выберите самовывоз.");
      external={previous:{zone,cafe,confirmed,unrestricted},onConfirm:point=>{
        const input=$("staffOrderAddress"),details=input.value.replace(/^Точка доставки:.*$/gm,"").trim().slice(0,440);
        input.value=[details,"Точка доставки: "+coords(point)].filter(Boolean).join("\n");
        input.dispatchEvent(new Event("change",{bubbles:true}));hint.textContent="Адрес входит в зону доставки.";
      }};
      unrestricted=false;zone=location.delivery_zone;cafe={lat:Number(location.latitude),lng:Number(location.longitude)};
      confirmed=parseAddress($("staffOrderAddress").value);open(button);
    }catch(e){hint.textContent=e.message;}
    finally{button.disabled=false;}
  });
  notify();
})();
