(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const dialog = $('nearbyCafe'), canvas = $('nearbyCafeMap'), locate = $('findNearestCafe');
  const status = $('nearbyCafeStatus');
  const fallback = {name:'Halal UMMA Nha Trang', address:'15 Nguyễn Biểu, Nha Trang, Khánh Hòa', point:[12.2814294,109.2020884]};
  let cafes = [fallback], selected = fallback, map, markers, opening, statusKey, locationRequest = 0;

  function setStatus(key) {
    statusKey = key;
    status.hidden = !key;
    status.textContent = key ? window.ummaMenuI18n.t(key) : '';
  }

  function select(cafe) {
    selected = cafe;
    $('nearbyCafeName').textContent = cafe.name;
    $('nearbyCafeAddress').textContent = cafe.address || '';
    const url = new URL('https://www.google.com/maps/dir/');
    url.search = new URLSearchParams({api:'1', destination:cafe.point?.join(',') || cafe.address || cafe.name, dir_action:'navigate'});
    $('nearbyCafeRoute').href = url.href;
    if (map && cafe.point) map.setView(cafe.point, 16);
  }

  function drawMarkers() {
    markers.clearLayers();
    const icon = window.L.icon({
      iconUrl: 'logo/assets/umma-icon-192.png',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      tooltipAnchor: [20, 0]
    });
    for (const cafe of cafes) {
      if (!cafe.point) continue;
      const label = document.createElement('span');
      label.textContent = cafe.name;
      window.L.marker(cafe.point, {icon, title:cafe.name, alt:cafe.name})
        .bindTooltip(label).on('click', () => select(cafe)).addTo(markers);
    }
    select(selected);
    locate.hidden = cafes.filter(cafe => cafe.point).length < 2;
  }

  async function openMap() {
    if (map) {
      map.invalidateSize();
      return;
    }
    if (opening) return;
    setStatus('Загружаем карту…');
    opening = (async () => {
      try {
        await window.ummaPublicDelivery.loadMapLibrary();
        if (!dialog.open) return;
        canvas.hidden = false;
        map = window.L.map(canvas, {scrollWheelZoom:false}).setView(selected.point || fallback.point, 16);
        map.zoomControl?.setPosition('topright');
        map.attributionControl?.setPrefix(false);
        markers = window.L.layerGroup().addTo(map);
        window.UmmaMaps.basemap(map, canvas, key => {
          if (key === 'Карта загружается с ошибками. Попробуйте позже.') setStatus('Карта кафе недоступна.');
        }, {blueWater:true});
        drawMarkers();
        setStatus('');
      } catch {
        map?.remove();
        map = null;
        canvas.hidden = true;
        setStatus('Карта кафе недоступна.');
      } finally {
        opening = null;
      }
    })();
  }

  $('nearbyCafeButton').onclick = () => {
    dialog.showModal();
    openMap();
  };
  $('closeNearbyCafe').onclick = () => dialog.close();
  dialog.addEventListener('close', () => {
    locationRequest++;
    locate.disabled = false;
    if (statusKey === 'Определяем местоположение…') setStatus('');
  });
  locate.onclick = () => {
    if (!navigator.geolocation) {
      setStatus('Не удалось определить местоположение.');
      return;
    }
    const request = ++locationRequest;
    locate.disabled = true;
    setStatus('Определяем местоположение…');
    navigator.geolocation.getCurrentPosition(({coords}) => {
      if (request !== locationRequest || !dialog.open) return;
      const origin = window.L.latLng(coords.latitude,coords.longitude);
      const nearest = cafes.filter(cafe => cafe.point)
        .map(cafe => ({cafe, distance:origin.distanceTo(cafe.point)}))
        .sort((a,b) => a.distance-b.distance)[0];
      if (nearest) select(nearest.cafe);
      locate.disabled = false;
      setStatus('');
    }, () => {
      if (request !== locationRequest || !dialog.open) return;
      locate.disabled = false;
      setStatus('Не удалось определить местоположение.');
    }, {timeout:10000, maximumAge:60000});
  };
  window.addEventListener('umma-menu:languagechange', () => setStatus(statusKey));
  window.ummaNearbyCafe = {
    setLocations(locations, primaryId) {
      if (!locations?.length) return;
      cafes = locations.map(({id,name,address,latitude,longitude}) => {
        const lat = Number(latitude), lon = Number(longitude);
        const point = latitude != null && longitude != null && Number.isFinite(lat) &&
          Number.isFinite(lon) && Math.abs(lat)<=90 && Math.abs(lon)<=180 ? [lat,lon] : null;
        return {id,name,address,point};
      });
      selected = cafes.find(cafe => cafe.id === primaryId && cafe.point) || cafes.find(cafe => cafe.point) || fallback;
      if (selected === fallback) cafes = [fallback];
      if (map) drawMarkers();
      else select(selected);
      locate.hidden = !map || cafes.filter(cafe => cafe.point).length < 2;
    }
  };
  select(selected);
})();
