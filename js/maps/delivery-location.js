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
  let confirmed = null, draft = null, map = null, marker = null, opener = null;
  let cafe = { lat: 12.2388, lng: 109.1967 }, generation = 0, geoRequest = 0;
  let disposeBasemap = null;
  const confirm = $("cafeDeliveryMapConfirm"), gps = $("cafeDeliveryMapLocate");
  function status(text) { $("cafeDeliveryMapStatus").textContent = text; }
  function stopPending() { geoRequest++; gps.disabled = !map; gps.textContent = "Моё местоположение"; }
  function addBasemap() { disposeBasemap = window.UmmaMaps.basemap(map, $("cafeDeliveryMap"), status); }
  function notify() {
    $("cafeDeliveryPointSummary").textContent = confirmed ? "Точка доставки выбрана · " + coords(confirmed) : "Выберите точку на карте или введите полный адрес ниже.";
    $("cafeDeliveryPointClear").hidden = !confirmed;
    $("cafeDeliveryMapOpen").textContent = confirmed ? "Изменить точку на карте" : "Указать на карте";
    document.dispatchEvent(new Event("umma:delivery-location-change"));
  }
  function choose(point, message) {
    if (!valid(point) || !map || !dialog.open) return;
    stopPending();
    draft = { lat: point.lat, lng: point.lng };
    if (!marker) {
      marker = window.L.marker([draft.lat, draft.lng], { draggable: true, title: "Точка доставки", alt: "Точка доставки", icon: window.L.divIcon({ className: "delivery-destination-marker", html: '<span aria-hidden="true"></span>', iconSize: [30, 38], iconAnchor: [15, 38] }) }).addTo(map);
      marker.on("dragstart", stopPending);
      marker.on("dragend", () => choose(marker.getLatLng(), "Проверьте точку и подтвердите доставку сюда."));
    } else marker.setLatLng([draft.lat, draft.lng]);
    confirm.disabled = false;
    status(message || "Проверьте точку и нажмите «Доставить сюда».");
    $("cafeDeliveryDraftCoordinates").textContent = coords(draft);
  }
  function cleanup() {
    generation++; disposeBasemap?.(); disposeBasemap = null; stopPending();
    try { map?.remove(); } catch {}
    $("cafeDeliveryMap").replaceChildren(); map = null; marker = null; draft = null;
    opener?.focus({ preventScroll: true });
  }
  function open() {
    if (dialog.open) return;
    opener = $("cafeDeliveryMapOpen");
    generation++;
    draft = null; confirm.disabled = true;
    $("cafeDeliveryDraftCoordinates").textContent = "";
    status("Передвиньте карту или нажмите на нужное здание. Затем подтвердите точку.");
    dialog.showModal();
    if (!window.L?.map) {
      gps.disabled = true; $("cafeDeliveryMapManual").disabled = true;
      status("Карта не загрузилась. Закройте окно и введите адрес вручную либо повторите позже.");
      return;
    }
    try {
      map = window.L.map("cafeDeliveryMap", { scrollWheelZoom: false }).setView([cafe.lat, cafe.lng], 16);
      map.attributionControl?.setPrefix(false);
      addBasemap(generation);
      map.on("click", event => choose(event.latlng));
      map.on("dragstart", stopPending);
      map.on("dragend", () => choose(map.getCenter()));
      window.L.marker([cafe.lat, cafe.lng], { interactive: false, keyboard: false, icon: window.L.divIcon({ className: "umma-cafe-marker", html: '<span>UMMA<br>CAFE</span>', iconSize: [48, 42], iconAnchor: [24, 42] }) }).addTo(map);
      gps.disabled = false; $("cafeDeliveryMapManual").disabled = false;
      if (confirmed) { choose(confirmed); map.setView([confirmed.lat, confirmed.lng], 17, { animate: false }); }
      map.invalidateSize();
    } catch {
      map?.remove(); map = null; gps.disabled = true; $("cafeDeliveryMapManual").disabled = true;
      status("Карта недоступна. Можно закрыть окно и ввести адрес вручную.");
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
  $("cafeDeliveryMapOpen").addEventListener("click", open);
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
    if (!valid(draft)) return;
    confirmed = { ...draft }; notify(); dialog.close();
  });
  $("cafeDeliveryPointClear").addEventListener("click", () => { confirmed = null; notify(); });
  window.ummaDeliveryLocation = {
    hasPoint: () => valid(confirmed) === true,
    getAddress: details => {
      const text = String(details || "").trim().slice(0, 440);
      return confirmed ? [text, "Точка доставки: " + coords(confirmed)].filter(Boolean).join("\n") : text;
    },
    setCafeLocation: location => {
      if (location?.latitude == null || location?.longitude == null) return;
      const point = { lat: Number(location.latitude), lng: Number(location.longitude) };
      if (valid(point)) cafe = point;
    },
    reset: () => { if (dialog.open) dialog.close(); confirmed = null; notify(); }
  };
  notify();
})();
