/* Courier navigation opens Google Maps directly from a user gesture. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let opener = null, map = null;
  function destination(button) {
    const address = button.dataset.routeAddress || '';
    const point = window.ummaMapLinks?.parseAddress(address);
    return { address, point, text: point ? window.ummaMapLinks.coords(point) : address + ', Vietnam' };
  }
  function url(button) {
    return 'https://www.google.com/maps/dir/?api=1&travelmode=driving&dir_action=navigate&destination=' + encodeURIComponent(destination(button).text);
  }
  function close() {
    map?.remove(); map = null;
    const modal = $('courierMapModal'); if (modal) { modal.hidden = true; modal.style.display = 'none'; }
    $('courierRouteMap')?.replaceChildren(); opener?.focus();
  }
  // Optional destination preview for existing callers; no internal route service.
  function open(button) {
    close(); opener = button;
    const modal = $('courierMapModal'); if (!modal) return;
    const d = destination(button); modal.hidden = false; modal.style.display = 'block';
    $('courierMapTitle').textContent = 'Доставка · Заказ №' + (button.dataset.routeOrderNumber || '');
    $('courierMapMessage').textContent = d.address;
    $('courierMapExternal').href = url(button);
    $('courierMapApple').hidden = false;
    $('courierMapApple').href = 'https://maps.apple.com/directions?destination=' + encodeURIComponent(d.text) + '&mode=driving';
    if (d.point) try { map = window.UmmaMaps.create($('courierRouteMap'), d.point); window.UmmaMaps.marker(map, d.point); } catch (e) { $('courierMapMessage').textContent = e.message; }
    $('courierMapClose')?.focus();
  }
  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-show-route="true"]'); if (!button) return;
    event.preventDefault();
    const link = url(button);
    try {
      if (typeof window.Telegram?.WebApp?.openLink === 'function') window.Telegram.WebApp.openLink(link, { try_instant_view: false });
      else { const a = document.createElement('a'); a.href = link; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.click(); }
    } catch { open(button); }
  });
  $('courierMapClose')?.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('courierMapModal')?.hidden) close(); });
  window.UmmaCourierMap = { open, close, navigationUrl: url };
})();
