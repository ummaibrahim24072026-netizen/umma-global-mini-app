// Keep live documents and transaction data out of Cache Storage.
const base = new URL(self.registration.scope);
const shellPaths = new Set(['menu/', 'menu/index.html', 'staff.html'].map(path => new URL(path, base).pathname));
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then(keys => Promise.all(keys
      .filter(key => key.startsWith('umma-menu-shell-'))
      .map(key => caches.delete(key))))
  ]));
});
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || request.mode !== 'navigate' ||
      url.origin !== base.origin || !shellPaths.has(url.pathname)) return;

  event.respondWith(fetch(request, { cache: 'no-cache' }).catch(() => new Response(
    '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>UMMA · Offline</title><main><h1>UMMA</h1><p lang="ru">Нет связи. Проверьте интернет и обновите страницу.</p>' +
    '<p>Offline. Check your connection and reload.</p><p lang="vi">Mất kết nối. Hãy kiểm tra mạng và tải lại trang.</p>' +
    '<button type="button" onclick="location.reload()">Обновить · Reload · Tải lại</button></main>' +
    '<style>body{margin:0;background:#f1fafa;color:#163d3e;font:16px system-ui}main{max-width:32rem;margin:8vh auto;padding:24px}button{min-height:48px;padding:8px 16px;border:0;border-radius:12px;background:#02787a;color:white;font:inherit}</style>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
  )));
});
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
