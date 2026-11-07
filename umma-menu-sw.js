// Orders and the live catalogue always require a network.
const CACHE='umma-menu-shell-v13';
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(CACHE).then(cache=>cache.add('./menu/')));});
self.addEventListener('activate',event=>{event.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('umma-menu-shell-')&&k!==CACHE).map(k=>caches.delete(k))))]));});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||!(url.pathname.endsWith('/menu/')||url.pathname.endsWith('/menu/index.html')))return;event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put('./menu/',copy)));}return response;}).catch(()=>caches.match('./menu/')));});
// Push history is separate from the offline shell and survives shell version updates.
const PUSH_CACHE='umma-order-events-v1';
const historyURL=new URL('./__umma_push_history',self.registration.scope).href;
let pushWork=Promise.resolve();
function serial(work){const next=pushWork.then(work);pushWork=next.catch(()=>{});return next;}
async function history(){const cache=await caches.open(PUSH_CACHE),response=await cache.match(historyURL);return response?response.json():{messages:[],count:0};}
async function storeHistory(value){const cache=await caches.open(PUSH_CACHE);await cache.put(historyURL,new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}}));}
const badgeCount=saved=>Math.min(999,(saved.count||0)+(saved.connectCount||0));
async function setBadge(count){try{if(count)await self.navigator.setAppBadge?.(count);else await self.navigator.clearAppBadge?.();}catch{}}
self.addEventListener('push',event=>event.waitUntil(serial(async()=>{
 let payload;try{payload=event.data.json();}catch{payload={title:'UMMA Cafe',body:'Order update'};}
 const saved=await history();
 const duplicate=!!payload.eventId&&saved.messages.some(m=>m.eventId===payload.eventId);
 if((payload.order||payload.kind==='connect')&&!duplicate){saved.messages.push(payload);saved.messages=saved.messages.slice(-100);const key=payload.kind==='connect'?'connectCount':'count';saved[key]=Math.min(999,(saved[key]||0)+1);await storeHistory(saved);}
 await self.registration.showNotification(payload.title||'UMMA Cafe',{body:payload.body||'Order update',icon:new URL('./logo/assets/umma-icon-192.png',self.registration.scope).href,badge:new URL('./logo/assets/umma-icon-192.png',self.registration.scope).href,tag:payload.eventId||'umma-order-update',silent:duplicate,...(payload.kind==='connect'&&!duplicate?{vibrate:[200,100,200]}:{}),data:{umma:true,kind:payload.kind}});
 await setBadge(badgeCount(saved));
 const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const client of windows)client.postMessage({type:payload.kind==='connect'?'UMMA_CONNECT_PUSH':'UMMA_ORDER_PUSH',payload});
})));
self.addEventListener('message',event=>{const data=event.data||{};if(!['UMMA_GET_HISTORY','UMMA_BADGE','UMMA_CONNECT_BADGE','UMMA_RESET'].includes(data.type))return;event.waitUntil(serial(async()=>{
 const saved=await history();
 if(data.type==='UMMA_RESET'){saved.messages=[];saved.count=0;saved.connectCount=0;await storeHistory(saved);await setBadge(0);const notifications=await self.registration.getNotifications();for(const n of notifications)if(n.data?.umma)n.close();event.source?.postMessage({type:'UMMA_PUSH_RESET'});return;}
 if(data.type==='UMMA_GET_HISTORY'){event.source?.postMessage({type:'UMMA_PUSH_HISTORY',messages:saved.messages});return;}
 const connect=data.type==='UMMA_CONNECT_BADGE',key=connect?'connectCount':'count';
 saved[key]=Math.max(0,Math.min(999,Number(data.count)||0));
 await storeHistory(saved);await setBadge(badgeCount(saved));
 if(!saved[key]){
  const notifications=await self.registration.getNotifications();
  for(const n of notifications)if(n.data?.umma&&(n.data.kind==='connect')===connect)n.close();
 }
}));});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{
 const connect=event.notification.data?.kind==='connect';
 const url=new URL(connect?'./menu/?connect=1':'./menu/?messages=1',self.registration.scope);
 const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
 const existing=windows.find(c=>{const u=new URL(c.url);return u.origin===url.origin&&(u.pathname===url.pathname||u.pathname===url.pathname+'index.html');});
 if(existing){await existing.focus();existing.postMessage({type:connect?'UMMA_OPEN_CONNECT':'UMMA_OPEN_INBOX'});}else await self.clients.openWindow(url.href);
})());});
