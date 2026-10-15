/* Shared Umma Maps renderer. Open cartography; no account or paid map key. */
(() => {
  'use strict';
  let libraries = null;
  const style = 'https://tiles.openfreemap.org/styles/liberty';
  const credit = '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://openmaptiles.org" target="_blank" rel="noopener">OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
  function script(src) {
    return new Promise((resolve, reject) => {
      const node = document.createElement('script');
      const fail = () => { clearTimeout(timer); node.remove(); reject(Error('Map unavailable')); };
      const timer = setTimeout(fail, 12000);
      node.src = src; node.async = true;
      node.onload = () => { clearTimeout(timer); resolve(); }; node.onerror = fail;
      document.head.append(node);
    });
  }
  function load() {
    if (!libraries) {
      if (!document.getElementById('deliveryVectorMapCSS')) {
        const css = document.createElement('link'); css.id = 'deliveryVectorMapCSS'; css.rel = 'stylesheet';
        css.href = 'https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.css'; document.head.append(css);
      }
      libraries = (async () => {
        if (!window.maplibregl) await script('https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.js');
        if (!window.L?.maplibreGL) await script('https://unpkg.com/@maplibre/maplibre-gl-leaflet@0.1.4/leaflet-maplibre-gl.js');
      })().catch(error => { libraries = null; throw error; });
    }
    return libraries;
  }
  // Preserve labels, road hierarchy and data; change only the cartographic palette.
  function theme(gl) {
    for (const layer of gl.getStyle?.().layers || []) {
      const source = layer['source-layer'], id = layer.id;
      try {
        if (layer.type === 'background') gl.setPaintProperty(id, 'background-color', '#f5f3ec');
        if (layer.type === 'fill' && source === 'water') gl.setPaintProperty(id, 'fill-color', '#abd8d5');
        if (layer.type === 'fill' && source === 'building') {
          gl.setPaintProperty(id, 'fill-color', '#d9d3c5');
          gl.setPaintProperty(id, 'fill-outline-color', '#c5bcaa');
        }
        if (layer.type === 'fill' && (source === 'park' || /landcover_wood|landuse_park/.test(id))) gl.setPaintProperty(id, 'fill-color', '#dce9da');
        if (layer.type === 'line' && source === 'waterway') gl.setPaintProperty(id, 'line-color', '#8fc9c6');
        if (layer.type === 'symbol' && source === 'place') {
          gl.setPaintProperty(id, 'text-color', '#244f50');
          gl.setPaintProperty(id, 'text-halo-color', '#fffdf6');
        }
      } catch { /* A provider style update must not prevent map display. */ }
    }
  }
  function basemap(map, canvas, status = () => {}) {
    let vector, timer, raster = false, disposed = false;
    const active = () => !disposed;
    const fallback = () => {
      if (!active() || raster) return;
      raster = true; clearTimeout(timer); try { vector?.remove(); } catch {}
      canvas.dataset.basemap = 'raster-fallback';
      let errors = 0;
      window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: credit }).on('tileerror', () => {
        if (active() && ++errors === 3) status('Карта загружается с ошибками. Попробуйте позже.');
      }).addTo(map);
      status('Включена запасная карта.');
    };
    canvas.dataset.basemap = 'loading'; delete canvas.dataset.theme;
    load().then(() => {
      if (!active()) return;
      try {
        if (typeof window.maplibregl?.supported === 'function' && !window.maplibregl.supported()) { fallback(); return; }
        vector = window.L.maplibreGL({ style, attributionControl: { customAttribution: credit } }).addTo(map);
        const gl = vector.getMaplibreMap(); let errors = 0;
        timer = setTimeout(fallback, 15000);
        gl.on('load', () => { if (active() && !raster) { clearTimeout(timer); theme(gl); canvas.dataset.basemap = 'openfreemap'; canvas.dataset.theme = 'umma'; } });
        gl.on('error', () => { if (++errors >= 3) fallback(); });
      } catch { fallback(); }
    }).catch(fallback);
    return () => { disposed = true; clearTimeout(timer); };
  }
  function create(canvas, point, status) {
    if (!window.L?.map) throw Error('Карта не загрузилась. Откройте адрес в Google Maps.');
    const map = window.L.map(canvas, { scrollWheelZoom: false }).setView([point.lat, point.lng], 16);
    map.attributionControl?.setPrefix(false);
    const dispose = basemap(map, canvas, status);
    const remove = map.remove.bind(map);
    map.remove = () => { dispose(); remove(); };
    return map;
  }
  function marker(map, point, kind = 'destination') {
    return window.L.marker([point.lat, point.lng], {
      title: kind === 'courier' ? 'Курьер UMMA' : 'Точка доставки',
      icon: window.L.divIcon({ className: 'umma-map-marker umma-map-marker-' + kind, html: '<span aria-hidden="true">' + (kind === 'courier' ? '<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h11v11H3zM14 10h4l3 4v3h-7"/><circle cx="7" cy="18" r="2" fill="#087b80"/><circle cx="18" cy="18" r="2" fill="#087b80"/></svg>' : '●') + '</span>', iconSize: [36, 36], iconAnchor: [18, 18] })
    }).addTo(map);
  }
  window.UmmaMaps = { basemap, create, marker };
})();
