/* Umma Maps destination and on-demand road route; native navigation stays available. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let opener = null, current = null;
  function close() {
    const s = current; current = null; s?.controller?.abort(); s?.map?.remove();
    const modal = $('courierMapModal'); if (modal) { modal.hidden = true; modal.style.display = 'none'; }
    $('courierRouteMap')?.replaceChildren(); opener?.focus();
  }
  function open(button) {
    close(); opener = button;
    const address = button.dataset.routeAddress || '', modal = $('courierMapModal'); if (!modal) return;
    const point = window.ummaMapLinks?.parseAddress(address);
    const s = { point, map: null, busy: false, lastRoute: 0 }; current = s;
    modal.hidden = false; modal.style.display = 'block';
    $('courierMapTitle').textContent = 'Маршрут · Заказ №' + (button.dataset.routeOrderNumber || '');
    $('courierMapMessage').textContent = address + (point ? ' · Точка доставки. Постройте маршрут от своего положения.' : ' · Для этого заказа указан текстовый адрес. Откройте навигацию ниже.');
    const destination = point ? window.ummaMapLinks.coords(point) : address + ', Vietnam';
    const apple = $('courierMapApple'); if (apple) { apple.hidden = false; apple.href = 'https://maps.apple.com/directions?destination=' + encodeURIComponent(destination) + '&mode=driving'; }
    $('courierMapExternal').href = 'https://www.google.com/maps/dir/?api=1&travelmode=driving&dir_action=navigate&destination=' + encodeURIComponent(destination);
    $('courierMapPrivacy').hidden = !point; $('courierMapLocate').hidden = !point; $('courierMapLocate').disabled = false; $('courierMapLocate').textContent = 'Построить маршрут от меня';
    if (point) try {
      s.map = window.UmmaMaps.create($('courierRouteMap'), point, text => { if (current === s) $('courierMapMessage').textContent = text; });
      window.UmmaMaps.marker(s.map, point);
    } catch (e) { $('courierMapMessage').textContent = e.message; }
    $('courierMapClose')?.focus();
  }
  function locate() {
    const s = current;
    if (!s?.map || s.busy || Date.now() - s.lastRoute < 2000) return;
    if (!navigator.geolocation) { $('courierMapMessage').textContent = 'GPS недоступен. Откройте навигацию ниже.'; return; }
    s.busy = true;
    const button = $('courierMapLocate'); button.disabled = true; button.textContent = 'Строим маршрут…';
    $('courierMapMessage').textContent = 'Разрешите геопозицию. Рассчитываем автомобильный маршрут по дорогам.';
    const done = () => { if (current !== s) return; s.busy = false; button.disabled = false; button.textContent = 'Обновить маршрут от меня'; };
    const fail = () => { if (current !== s) return; $('courierMapMessage').textContent = 'Не удалось построить маршрут. Проверьте GPS и связь или откройте Google Maps ниже.'; done(); };
    try { navigator.geolocation.getCurrentPosition(async position => {
      if (current !== s) return;
      const origin = { lat: position.coords.latitude, lng: position.coords.longitude };
      if (![origin.lat, origin.lng].every(Number.isFinite) || Math.abs(origin.lat) > 90 || Math.abs(origin.lng) > 180 || !Number.isFinite(position.coords.accuracy) || position.coords.accuracy > 500) { fail(); return; }
      try {
        s.lastRoute = Date.now(); s.controller = new AbortController();
        const timeout = setTimeout(() => s.controller.abort(), 12000);
        let response;
        try { response = await fetch('https://routing.openstreetmap.de/routed-car/route/v1/driving/' + origin.lng + ',' + origin.lat + ';' + s.point.lng + ',' + s.point.lat + '?overview=full&geometries=geojson&steps=false', { signal: s.controller.signal }); }
        finally { clearTimeout(timeout); }
        if (!response.ok) throw Error('route unavailable');
        const data = await response.json(); if (current !== s) return;
        const route = data.routes?.[0], points = route?.geometry?.coordinates;
        if (data.code !== 'Ok' || !Array.isArray(points) || points.length < 2 || !Number.isFinite(route.distance) || !Number.isFinite(route.duration) || !points.every(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90)) throw Error('route unavailable');
        s.line?.remove(); s.origin?.remove();
        s.line = window.L.polyline(points.map(p => [p[1], p[0]]), { color: '#087b80', weight: 6, opacity: 0.9 }).addTo(s.map);
        s.origin = window.UmmaMaps.marker(s.map, origin, 'courier');
        s.map.fitBounds(s.line.getBounds(), { padding: [35, 35] });
        $('courierMapMessage').textContent = (route.distance / 1000).toFixed(1) + ' км · примерно ' + Math.max(1, Math.round(route.duration / 60)) + ' мин без учёта пробок. Автомобильный маршрут; соблюдайте местные знаки.';
        done();
      } catch { fail(); }
    }, fail, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }); } catch { fail(); }
  }
  document.addEventListener('click', event => { const button = event.target.closest?.('[data-show-route="true"]'); if (button) { event.preventDefault(); open(button); } });
  $('courierMapClose')?.addEventListener('click', close);
  $('courierMapLocate')?.addEventListener('click', locate);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('courierMapModal')?.hidden) close(); });
  window.UmmaCourierMap = { open, close };
})();
