/* Device-bound customer channel. The opaque credential never appears in URLs or push payloads. */
(()=>{'use strict';
const API='https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-connect',KEY='umma:connect:token:v1';
let token='',state=null,dialog=null,busy=false,pending=null,reading=false,refreshing=null;
try{token=localStorage.getItem(KEY)||'';}catch{}
const copy={ru:['Связь с UMMA','Закрыть','Сообщения кафе, акции и обратная связь','Начать переписку','Имя (необязательно)','Получать акции и новые блюда','Сохранить настройки','Включить уведомления','Отключить уведомления кафе','Напишите нам','Отправить','Переписка сохранится на этом устройстве. Сообщения по заказам — в «Мои сообщения».','Пока сообщений нет.','Сохранено','Уведомления включены','Разрешите уведомления в настройках сайта. На iPhone откройте установленное приложение с экрана «Домой».','Не удалось соединиться. Повторите попытку.','Подключаем…','Вы','UMMA','Уведомления кафе отключены. Уведомления заказов настраиваются отдельно.','Не удалось сохранить доступ на этом устройстве. Разрешите хранение данных сайта.'],en:['Contact UMMA','Close','Cafe updates, offers and feedback','Start conversation','Name (optional)','Receive offers and new dishes','Save preferences','Enable notifications','Disable cafe notifications','Write to us','Send','This conversation stays on this device. Order updates are in “Order updates”.','No messages yet.','Saved','Notifications enabled','Allow notifications in site settings. On iPhone, open the installed app from the Home Screen.','Could not connect. Please retry.','Connecting…','You','UMMA','Cafe notifications disabled. Order alerts have separate settings.','Could not save access on this device. Allow site storage.'],vi:['Liên hệ UMMA','Đóng','Tin tức, ưu đãi và phản hồi','Bắt đầu trò chuyện','Tên (không bắt buộc)','Nhận ưu đãi và món mới','Lưu tùy chọn','Bật thông báo','Tắt thông báo quán','Nhắn cho chúng tôi','Gửi','Cuộc trò chuyện lưu trên thiết bị này. Thông báo đơn hàng ở mục “Thông báo”.','Chưa có tin nhắn.','Đã lưu','Đã bật thông báo','Cho phép thông báo trong cài đặt trang. Trên iPhone, mở ứng dụng từ Màn hình chính.','Không thể kết nối. Hãy thử lại.','Đang kết nối…','Bạn','UMMA','Đã tắt thông báo quán. Thông báo đơn hàng có cài đặt riêng.','Không lưu được quyền truy cập. Cho phép lưu dữ liệu trang.']};
const notificationCopy={
 ru:['Включить уведомления об ответах','Сообщение отправлено. Включите уведомления, чтобы увидеть ответ, даже когда UMMA закрыта.','Ответы появятся в чате. Телефон управляет звуком, вибрацией и значком на ярлыке.'],
 en:['Enable reply notifications','Message sent. Enable notifications to get replies even when UMMA is closed.','Replies appear in this chat. Your phone controls sound, vibration and the app icon badge.'],
 vi:['Bật thông báo phản hồi','Đã gửi tin nhắn. Bật thông báo để nhận phản hồi ngay cả khi đã đóng UMMA.','Phản hồi xuất hiện trong cuộc trò chuyện. Âm thanh, rung và huy hiệu theo cài đặt điện thoại.']
};
const lang=()=>document.documentElement.lang.split('-')[0],t=i=>(copy[lang()]||copy.en)[i];
const notice=i=>(notificationCopy[lang()]||notificationCopy.en)[i];
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
const button=el('button',t(0),'umma-connect-button');button.type='button';button.setAttribute('aria-haspopup','dialog');
(document.querySelector('.menu-tools')||document.getElementById('cafeNotificationBar')||document.querySelector('header')||document.body).append(button);
async function api(action,data={}){const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',signal:AbortSignal.timeout(15000),body:JSON.stringify({action,token,...data})});const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||t(16));return d;}
function unread(){return (state?.messages||[]).filter(m=>m.direction!=='customer'&&!m.read_at);}
function badge(){
 const count=unread().length;
 button.textContent=t(0)+(count?' · '+count:'');
 if(state)navigator.serviceWorker?.controller?.postMessage({type:'UMMA_CONNECT_BADGE',count});
}
function refresh(){
 if(refreshing)return refreshing;
 if(!token||document.hidden||busy)return;
 refreshing=(async()=>{
  try{
   const next=await api('list');
   if(busy||document.hidden)return;
   state=next;
   if(dialog?.open){renderThread();await markRead();}
   else badge();
  }catch{if(dialog?.open)status.textContent=t(16);}
  finally{refreshing=null;}
 })();
 return refreshing;
}
const status=el('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
let list,name,promotions,push;
function renderThread(){if(!list)return;list.replaceChildren();for(const m of state?.messages||[]){const li=el('li');li.dataset.direction=m.direction;li.append(el('strong',m.direction==='customer'?t(18):m.title||t(19)),el('div',m.body),el('small',new Date(m.created_at).toLocaleString()));list.append(li);}if(!list.children.length)list.append(el('li',t(12)));badge();}
async function markRead(){
 const latest=unread().at(-1);
 if(reading||!latest||!dialog?.open||document.hidden)return;
 reading=true;
 try{
  state=await api('read',{before:latest.created_at});
  if(dialog.open&&!document.hidden)renderThread();else badge();
 }catch{}finally{reading=false;}
}
async function run(fn){if(busy)return;busy=true;await refreshing;dialog?.querySelectorAll('button').forEach(b=>b.disabled=true);status.textContent=t(17);try{await fn();}catch(e){status.textContent=e.message||t(16);}finally{busy=false;dialog?.querySelectorAll('button').forEach(b=>b.disabled=false);}}
function label(text,input){const l=el('label',text);l.append(input);return l;}
function build(){
 dialog=el('dialog',null,'umma-connect');dialog.setAttribute('aria-label',t(0));
 const close=el('button',t(1),'connect-close');close.type='button';close.onclick=()=>dialog.close();dialog.append(close,el('h2',t(0)),el('p',t(2)),el('small',t(11)));
 const join=el('button',t(3),'primary');join.type='button';const content=el('div');join.hidden=!!token;content.hidden=!token;
 async function connect(){
  if(token)return;
  const candidate=window.ummaMenuAudience?.identity()||
   Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join('');
  token=candidate;
  try{
   state=await api('join');
   try{localStorage.setItem(KEY,token);}catch{throw Error(t(21));}
  }catch(error){token='';throw error;}
  join.hidden=true;content.hidden=false;update();
 }
 join.onclick=()=>run(async()=>{await connect();state=await api('preferences',{language:lang()});status.textContent='';});
 name=el('input');name.maxLength=80;name.autocomplete='given-name';promotions=el('input');promotions.type='checkbox';const check=label(t(5),promotions);check.className='connect-check';
 const save=el('button',t(6));save.type='button';save.onclick=()=>run(async()=>{state=await api('preferences',{name:name.value,promotions:promotions.checked,language:lang()});status.textContent=t(13);update();});
 push=el('button',notice(0),'primary');push.type='button';push.onclick=()=>{
  // Permission must be requested synchronously within the user's tap.
  const permission=('Notification'in window&&'PushManager'in window&&'serviceWorker'in navigator)?Notification.requestPermission():Promise.resolve('unsupported');
  void run(async()=>{if(await permission!=='granted')throw Error(t(15));await connect();await navigator.serviceWorker.register(new URL('umma-menu-sw.js',document.baseURI));const registration=await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error(t(16))),12000))]);
   const r=await fetch('https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-push',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(12000),body:JSON.stringify({action:'config'})});const config=await r.json();if(!r.ok||!config.publicKey)throw Error(t(16));
   const bytes=Uint8Array.from(atob(config.publicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));const subscription=await registration.pushManager.getSubscription()||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
   state=await api('preferences',{subscription:subscription.toJSON(),name:name.value,promotions:promotions.checked,language:lang()});window.ummaOrderAlerts?.enableGranted?.();status.textContent=t(14)+' '+notice(2);update();});
 };
 const off=el('button',t(8));off.type='button';off.onclick=()=>run(async()=>{state=await api('preferences',{subscription:null});status.textContent=t(20);update();});
 list=el('ol',null,'connect-thread');list.setAttribute('aria-label',t(0));
 const form=el('form'),body=el('textarea');body.required=true;body.maxLength=2000;const send=el('button',t(10),'primary');send.type='submit';
 body.addEventListener('input',()=>{pending=null;});form.append(label(t(9),body),send);
 form.onsubmit=e=>{e.preventDefault();if(!body.value.trim())return;pending=pending||{requestKey:crypto.randomUUID(),body:body.value.trim()};void run(async()=>{state=await api('send',pending);body.value='';pending=null;status.textContent=push.hidden?t(13):notice(1);renderThread();await markRead();});};
 content.append(label(t(4),name),check,save,off,el('hr'),list,form);dialog.append(join,push,content,status);document.body.append(dialog);dialog.addEventListener('close',()=>button.focus());
 function update(){name.value=state?.client.name||'';promotions.checked=state?.client.promotions===true;const subscribed=state?.client.pushEnabled===true&&window.Notification?.permission==='granted';off.hidden=!state?.client.pushEnabled;push.hidden=subscribed;renderThread();}
 dialog.update=update;
}
async function open(){if(!dialog)build();if(!dialog.open)dialog.showModal();status.textContent='';await refresh();dialog.update?.();await markRead();}
button.onclick=open;window.ummaCustomerConnect={open};
window.addEventListener('umma-menu:languagechange',()=>{button.textContent=t(0);if(dialog&&!dialog.open){dialog.remove();dialog=null;}badge();});
navigator.serviceWorker?.addEventListener('message',e=>{if(e.data?.type==='UMMA_CONNECT_PUSH'){void refresh();}if(e.data?.type==='UMMA_OPEN_CONNECT')void open();});
navigator.serviceWorker?.addEventListener('controllerchange',badge);
window.addEventListener('pageshow',refresh);window.addEventListener('online',refresh);document.addEventListener('visibilitychange',refresh);setInterval(refresh,15000);void refresh();
if(new URL(location.href).searchParams.has('connect'))void open();
})();
