/* Google Maps and road directions inside the courier workspace. */
(() => {
 'use strict';
 const $ = id => document.getElementById(id);
 const config = document.querySelector('meta[name="umma-google-maps-key"]');
 let api, active;
 const status = message => { $('courierMapMessage').textContent = message; };

 function loadGoogle() {
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps);
  const key = config?.content.trim();
  if (!key) return Promise.reject(new Error('Google Maps ещё не подключён. Нужен ключ для веб-кабинета UMMA.'));
  if (!api) {
   api = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(fail, 15000);
    function cleanup() {
     clearTimeout(timer);
     delete window.ummaCourierGoogleReady;
     delete window.gm_authFailure;
    }
    function fail() {
     cleanup();
     script.remove();
     reject(new Error('Google Maps недоступен. Проверьте подключение и настройки ключа.'));
    }
    window.gm_authFailure = fail;
    window.ummaCourierGoogleReady = () => {
     cleanup();
     window.gm_authFailure = () => {
      if (active) {
       const view = active;
       if (view.watch != null) navigator.geolocation.clearWatch(view.watch);
       view.watch = null;
       clearTimeout(view.staleTimer);
       gpsUnavailable(view, 'Google Maps отклонил ключ. Проверьте разрешённый домен и доступ к API.');
      }
     };
     resolve(window.google.maps);
    };
    script.onerror = fail;
    script.referrerPolicy = 'strict-origin-when-cross-origin';
    script.src = 'https://maps.googleapis.com/maps/api/js?' + new URLSearchParams({
     key, v: 'quarterly', loading: 'async', callback: 'ummaCourierGoogleReady',
     auth_referrer_policy: 'origin', language: 'ru', region: 'VN'
    });
    document.head.append(script);
   }).catch(error => { api = null; throw error; });
  }
  return api;
 }

 function close() {
  const view = active;
  active = null;
  if (view?.watch != null) navigator.geolocation.clearWatch(view.watch);
  if (view?.staleTimer) clearTimeout(view.staleTimer);
  view?.courier?.setMap(null);
  view?.pin?.setMap(null);
  view?.line?.setMap(null);
  $('courierRouteMap')?.replaceChildren();
  if ($('courierMapModal')) $('courierMapModal').hidden = true;
  view?.opener.focus();
 }

 async function route(view, origin) {
  if (view.pending) return;
  view.pending = true;
  view.requestedAt = Date.now();
  if (!view.line) status('Строим маршрут по дорогам…');
  try {
   const { routes } = await view.Route.computeRoutes({
    origin, destination: view.destination, travelMode: 'TWO_WHEELER',
    language: 'ru', region: 'VN',
    fields: ['path', 'viewport', 'distanceMeters', 'durationMillis', 'legs', 'warnings']
   });
   if (active !== view || !view.position) return;
   const result = routes?.[0];
   if (!result?.path?.length) throw new Error('No route');
   const firstRoute = !view.line;
   if (firstRoute) {
    view.line = new view.maps.Polyline({map: view.map, strokeColor: '#087b80', strokeWeight: 6});
   }
   view.line.setPath(result.path);
   view.line.setVisible(true);
   if (firstRoute && result.viewport) view.map.fitBounds(result.viewport, 42);
   view.routedFrom = origin;
   const minutes = Math.max(1, Math.ceil(result.durationMillis / 60000));
   const distance = (result.distanceMeters / 1000).toLocaleString('ru', {maximumFractionDigits: 1});
   status(Number.isFinite(minutes) && Number.isFinite(result.distanceMeters)
    ? `${distance} км · около ${minutes} мин от точки расчёта`
    : 'Маршрут построен');
   const rows = (result.legs ?? []).flatMap(leg => leg.steps ?? []).filter(step => step.instructions).map(step => {
    const row = document.createElement('li');
    row.textContent = step.instructions;
    return row;
   });
   $('courierRouteSteps').replaceChildren(...rows);
   $('courierRouteDirections').hidden = !rows.length;
   $('courierRouteWarnings').textContent = (result.warnings ?? []).join(' ');
  } catch {
   if (active === view && view.position) {
    view.line?.setVisible(false);
    $('courierRouteDirections').hidden = true;
    $('courierRouteWarnings').textContent = '';
    status('Google Maps не построил маршрут. Проверьте адрес или обновите маршрут.');
   }
  } finally {
   view.pending = false;
   if (active === view) $('courierRouteRefresh').disabled = !view.position;
  }
 }

 function gpsUnavailable(view, message) {
  if (active !== view) return;
  view.position = null;
  view.courier?.setVisible(false);
  view.line?.setVisible(false);
  view.routedFrom = null;
  $('courierRouteDirections').hidden = true;
  $('courierRouteWarnings').textContent = '';
  $('courierRouteRefresh').disabled = true;
  status(message);
 }

 async function open(button) {
  close();
  if (!$('courierMapModal')) return;
  const address = button.dataset.routeAddress?.trim();
  const pin = window.ummaMapLinks?.parseAddress(address);
  const street = address?.split(/\r?\n/).filter(line => !line.startsWith('Точка доставки:')).join(', ').trim();
  const view = {opener: button, destination: pin || (street ? street + ', Vietnam' : '')};
  active = view;
  $('courierMapModal').hidden = false;
  $('courierMapTitle').textContent = 'Маршрут · Заказ №' + (button.dataset.routeOrderNumber || '');
  $('courierRouteDirections').hidden = true;
  $('courierRouteDirections').open = false;
  $('courierRouteWarnings').textContent = '';
  $('courierRouteRefresh').disabled = true;
  $('courierMapClose').focus();
  if (!view.destination) { status('В заказе нет адреса назначения.'); return; }
  status('Загружаем Google Maps…');
  try {
   const maps = await loadGoogle();
   const [{Map}, {Route}, {Marker}] = await Promise.all(
    ['maps', 'routes', 'marker'].map(library => maps.importLibrary(library))
   );
   if (active !== view) return;
   view.maps = maps;
   view.Route = Route;
   view.map = new Map($('courierRouteMap'), {
    center: pin || {lat: 12.2388, lng: 109.1967}, zoom: pin ? 16 : 13,
    mapTypeControl: false, streetViewControl: false, fullscreenControl: false
   });
   if (pin) view.pin = new Marker({map: view.map, position: pin, title: 'Точка назначения'});
   if (!navigator.geolocation?.watchPosition) {
    gpsUnavailable(view, 'GPS недоступен. Откройте веб-кабинет по HTTPS и разрешите геолокацию.');
    return;
   }
   status('Ожидаем GPS. Разрешите доступ к геолокации.');
   view.watch = navigator.geolocation.watchPosition(fix => {
    if (active !== view) return;
    const {latitude: lat, longitude: lng, accuracy} = fix.coords;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 ||
        Math.abs(lng) > 180 || !Number.isFinite(accuracy) || accuracy > 100 ||
        Date.now() - fix.timestamp > 15000) return;
    const point = {lat, lng};
    view.position = point;
    clearTimeout(view.staleTimer);
    view.staleTimer = setTimeout(() => gpsUnavailable(view, 'Нет свежей позиции GPS. Ожидаем сигнал…'), 30000);
    if (!view.courier) {
     view.courier = new Marker({map: view.map, position: point, title: 'Курьер', zIndex: 10,
      icon: {path: maps.SymbolPath.CIRCLE, scale: 9, fillColor: '#1684fc', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3}});
    } else {
     view.courier.setPosition(point);
     view.courier.setVisible(true);
    }
    if (!view.map.getBounds()?.contains(point)) view.map.panTo(point);
    const moved = view.routedFrom && Math.hypot(point.lat - view.routedFrom.lat, point.lng - view.routedFrom.lng) > 0.0015;
    if (!view.requestedAt || (Date.now() - view.requestedAt >= 45000 && (!view.routedFrom || moved))) {
     $('courierRouteRefresh').disabled = true;
     void route(view, point);
    }
   }, error => gpsUnavailable(view, error.code === 1
    ? 'Разрешите геолокацию в настройках браузера и снова откройте маршрут.'
    : 'Нет свежей позиции GPS. Ожидаем сигнал…'),
   {enableHighAccuracy: true, maximumAge: 5000, timeout: 15000});
  } catch (error) {
   if (active === view) status(error.message || 'Не удалось загрузить карту.');
  }
 }

 document.addEventListener('click', event => {
  const button = event.target.closest?.('[data-show-route="true"]');
  if (button) { event.preventDefault(); void open(button); }
 });
 $('courierMapClose')?.addEventListener('click', close);
 $('courierRouteRefresh')?.addEventListener('click', () => {
  if (!active?.position || active.pending) return;
  $('courierRouteRefresh').disabled = true;
  void route(active, active.position);
 });
 document.addEventListener('keydown', event => { if (event.key === 'Escape' && active) close(); });
 window.addEventListener('pagehide', close);
 window.UmmaCourierMap = {open, close};
})();
