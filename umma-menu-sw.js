// Orders and the live catalogue always require a network.
const CACHE='umma-menu-shell-v5';
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(CACHE).then(cache=>cache.add('./menu/')));});
self.addEventListener('activate',event=>{event.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('umma-menu-shell-')&&k!==CACHE).map(k=>caches.delete(k))))]));});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||!(url.pathname.endsWith('/menu/')||url.pathname.endsWith('/menu/index.html')))return;event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put('./menu/',copy)));}return response;}).catch(()=>caches.match('./menu/')));});
