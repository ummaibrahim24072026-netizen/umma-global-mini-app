/* Device-bound customer channel. The opaque credential never appears in URLs or push payloads. */
(()=>{'use strict';
const API='https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-connect',KEY='umma:connect:token:v1';
let token='',state=null,dialog=null,busy=false,pending=null,reading=false,refreshing=null;
try{token=localStorage.getItem(KEY)||'';}catch{}
const copy={ru:['Связь с UMMA','Закрыть','Сообщения кафе, акции и обратная связь','Начать переписку','Имя (необязательно)','Получать рассылку об акциях и новых блюдах','Сохранить настройки','Включить уведомления','Отключить уведомления кафе','Напишите нам','Отправить','Переписка сохранится на этом устройстве. Сообщения по заказам — в «Мои сообщения».','Пока сообщений нет.','Сохранено','Уведомления включены','Разрешите уведомления в настройках сайта. На iPhone откройте установленное приложение с экрана «Домой».','Не удалось соединиться. Повторите попытку.','Подключаем…','Вы','UMMA','Уведомления кафе отключены. Уведомления заказов настраиваются отдельно.','Не удалось сохранить доступ на этом устройстве. Разрешите хранение данных сайта.'],en:['Contact UMMA','Close','Cafe updates, offers and feedback','Start conversation','Name (optional)','Subscribe to offers and new dishes','Save preferences','Enable notifications','Disable cafe notifications','Write to us','Send','This conversation stays on this device. Order updates are in “Order updates”.','No messages yet.','Saved','Notifications enabled','Allow notifications in site settings. On iPhone, open the installed app from the Home Screen.','Could not connect. Please retry.','Connecting…','You','UMMA','Cafe notifications disabled. Order alerts have separate settings.','Could not save access on this device. Allow site storage.'],vi:['Liên hệ UMMA','Đóng','Tin tức, ưu đãi và phản hồi','Bắt đầu trò chuyện','Tên (không bắt buộc)','Đăng ký nhận ưu đãi và món mới','Lưu tùy chọn','Bật thông báo','Tắt thông báo quán','Nhắn cho chúng tôi','Gửi','Cuộc trò chuyện lưu trên thiết bị này. Thông báo đơn hàng ở mục “Thông báo”.','Chưa có tin nhắn.','Đã lưu','Đã bật thông báo','Cho phép thông báo trong cài đặt trang. Trên iPhone, mở ứng dụng từ Màn hình chính.','Không thể kết nối. Hãy thử lại.','Đang kết nối…','Bạn','UMMA','Đã tắt thông báo quán. Thông báo đơn hàng có cài đặt riêng.','Không lưu được quyền truy cập. Cho phép lưu dữ liệu trang.']};
const notificationCopy={
 ru:['Включить уведомления об ответах','Сообщение отправлено. Включите уведомления, чтобы увидеть ответ, даже когда UMMA закрыта.','Ответы появятся в чате. Телефон управляет звуком, вибрацией и значком на ярлыке.'],
 en:['Enable reply notifications','Message sent. Enable notifications to get replies even when UMMA is closed.','Replies appear in this chat. Your phone controls sound, vibration and the app icon badge.'],
 vi:['Bật thông báo phản hồi','Đã gửi tin nhắn. Bật thông báo để nhận phản hồi ngay cả khi đã đóng UMMA.','Phản hồi xuất hiện trong cuộc trò chuyện. Âm thanh, rung và huy hiệu theo cài đặt điện thoại.']
};
const setupCopy={
 ru:['Получайте ответы UMMA, даже когда приложение закрыто.','Позже'],
 en:['Get replies from UMMA even when the app is closed.','Later'],
 vi:['Nhận phản hồi từ UMMA ngay cả khi đã đóng ứng dụng.','Để sau']
};
const receiptCopy={
 ru:['Отправлено','Прочитано сотрудником'],
 en:['Sent','Read by staff'],
 vi:['Đã gửi','Nhân viên đã đọc']
};
const lang=()=>document.documentElement.lang.split('-')[0],t=i=>(copy[lang()]||copy.en)[i];
const notice=i=>(notificationCopy[lang()]||notificationCopy.en)[i];
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
const button=el('button',t(0),'umma-connect-button');button.type='button';button.setAttribute('aria-haspopup','dialog');
(document.getElementById('customerConnectHost')||document.querySelector('.menu-tools')||document.getElementById('cafeNotificationBar')||document.querySelector('header')||document.body).append(button);
async function api(action,data={}){const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',signal:AbortSignal.timeout(action==='voice'?115000:15000),body:JSON.stringify({action,token,...data})});const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||t(16));return d;}
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
   renderSetup();
   if(dialog?.open){renderThread();await markRead();}
   else badge();
  }catch{if(dialog?.open)status.textContent=t(16);}
  finally{refreshing=null;}
 })();
 return refreshing;
}
const status=el('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
let list,name,promotions,push;
const mediaCopy={
 ru:{photo:'Открыть фото',video:'Открыть видео',voice:'Прослушать голосовое',error:'Не удалось открыть вложение. Попробуйте ещё раз.'},
 en:{photo:'Open photo',video:'Open video',voice:'Listen to voice message',error:'Could not open attachment. Try again.'},
 vi:{photo:'Mở ảnh',video:'Mở video',voice:'Nghe tin nhắn thoại',error:'Không mở được tệp. Hãy thử lại.'}
};
function renderThread(){
 if(!list)return;
 const receipt=receiptCopy[lang()]||receiptCopy.en;
 const dateTime=new Intl.DateTimeFormat(document.documentElement.lang||'en',{dateStyle:'short',timeStyle:'short'});
 const media=mediaCopy[lang()]||mediaCopy.en;
 const target=window.ummaConnectMedia.language(lang());
 window.ummaConnectMedia.render(list,state?.messages||[],m=>{
  const li=el('li');
  const outgoing=m.direction==='customer';
  li.dataset.direction=m.direction;
  li.append(el('strong',outgoing?t(18):m.title||t(19)));
  if(m.body)li.append(el('div',m.body));
  if(m.media_kind)li.append(window.ummaConnectMedia.attachment(m.media_kind,media[m.media_kind],
   async()=> (await api('mediaGet',{messageId:m.id})).url,media.error));
  if(!outgoing&&m.media_kind==='voice'&&typeof state.voiceTranslation==='boolean'){
   li.append(window.ummaConnectMedia.voiceTranslation(lang(),target,
    ()=>api('voice',{messageId:m.id,language:target}),state.voiceTranslation));
  }
  li.append(el('small',dateTime.format(new Date(m.created_at))));
  if(outgoing)li.append(el('small',null,'connect-receipt'));
  return li;
 },m=>m.read_at?receipt[1]+' · '+dateTime.format(new Date(m.read_at)):receipt[0]);
 if(!list.children.length)list.append(el('li',t(12)));
 badge();
}
async function markRead(){
 const latest=unread().at(-1);
 if(reading||!latest||!dialog?.open||document.hidden)return;
 reading=true;
 try{
  state=await api('read',{before:latest.created_at});
  if(dialog.open&&!document.hidden)renderThread();else badge();
 }catch{}finally{reading=false;}
}
const setupHost=document.getElementById('replyNotificationsSetup');
const setupButton=el('button',notice(0),'umma-connect-button'),later=el('button',null,'plain-btn');
const setupHint=el('p'),setupStatus=el('p');setupStatus.setAttribute('role','status');
const setupKey='umma:reply-notifications:setup-dismissed';
let installed=navigator.standalone===true||window.matchMedia?.('(display-mode: standalone)').matches===true;
let dismissed=false;
try{dismissed=localStorage.getItem(setupKey)==='1';}catch{}
const pushSupported=()=> 'Notification'in window&&'PushManager'in window&&'serviceWorker'in navigator;
function dismissSetup(){
 dismissed=true;
 try{localStorage.setItem(setupKey,'1');}catch{}
 renderSetup();
}
function renderSetup(){
 if(!setupHost)return;
 const copy=setupCopy[lang()]||setupCopy.en;
 setupButton.textContent=notice(0);
 setupHint.textContent=copy[0];
 later.textContent=copy[1];
 setupHost.hidden=!installed||dismissed||!pushSupported()||(!!token&&!state)||state?.client?.pushEnabled===true||
  (Notification.permission==='denied'&&!setupStatus.textContent);
}
async function run(fn,feedback=status){
 if(busy)return;
 busy=true;await refreshing;
 const buttons=[...(dialog?.querySelectorAll('button')||[]),setupButton,later];
 buttons.forEach(b=>b.disabled=true);feedback.textContent=t(17);
 try{await fn();}catch(e){feedback.textContent=e.message||t(16);}
 finally{busy=false;buttons.forEach(b=>b.disabled=false);renderSetup();}
}
async function connect(){
 if(token)return;
 token=window.ummaMenuAudience?.identity()||
  Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join('');
 try{
  state=await api('join');
  try{localStorage.setItem(KEY,token);}catch{throw Error(t(21));}
 }catch(error){token='';throw error;}
}
function enablePush(feedback){
 if(busy)return;
 // Only a direct tap can ask for a new browser permission.
 const permission=pushSupported()?(Notification.permission==='granted'?'granted':Notification.requestPermission()):'unsupported';
 void run(async()=>{
  if(await permission!=='granted')throw Error(t(15));
  await navigator.serviceWorker.register(new URL('umma-menu-sw.js',document.baseURI));
  const registration=await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error(t(16))),12000))]);
  const r=await fetch('https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-push',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(12000),body:JSON.stringify({action:'config'})});
  const config=await r.json();if(!r.ok||!config.publicKey)throw Error(t(16));
  const bytes=Uint8Array.from(atob(config.publicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
  const subscription=await registration.pushManager.getSubscription()||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
  await connect();
  state=await api('preferences',{subscription:subscription.toJSON(),language:lang()});
  if(feedback===status)window.ummaOrderAlerts?.enableGranted?.();
  feedback.textContent=t(14)+' '+notice(2);
  if(dialog)dialog.update?.();else badge();
 },feedback);
}
function installedSetup(){
 if(!setupHost||!installed)return;
 renderSetup();
 // A new installation can reuse an existing browser grant. Existing chats may have opted out.
 if(!dismissed&&!token&&pushSupported()&&Notification.permission==='granted'&&!document.hidden)enablePush(setupStatus);
}
if(setupHost){
 setupButton.type=later.type='button';
 setupButton.onclick=()=>enablePush(setupStatus);
 later.onclick=dismissSetup;
 setupHost.append(setupHint,setupButton,later,setupStatus);
 window.addEventListener('appinstalled',()=>{installed=true;installedSetup();});
 window.addEventListener('pageshow',installedSetup);
}
function label(text,input){const l=el('label',text);l.append(input);return l;}
function build(){
 dialog=el('dialog',null,'umma-connect');dialog.setAttribute('aria-label',t(0));
 const close=el('button',t(1),'connect-close');close.type='button';close.onclick=()=>dialog.close();const hero=el('div',null,'connect-hero');const heroIcon=el('span','☏','connect-hero-icon');if(document.getElementById('customerConnectHost')){const logo=el('img');logo.src='logo/assets/umma-icon-192.png';logo.alt='';logo.width=42;logo.height=42;heroIcon.replaceChildren(logo);}heroIcon.setAttribute('aria-hidden','true');const heroText=el('div',null,'connect-hero-copy');heroText.append(el('h2',t(0)),el('p',t(2)));hero.append(heroIcon,heroText,close);dialog.append(hero,el('small',t(11)));
 const join=el('button',t(3),'primary');join.type='button';const content=el('div');join.hidden=!!token;content.hidden=!token;
 join.onclick=()=>run(async()=>{await connect();update();state=await api('preferences',{language:lang()});status.textContent='';});
 name=el('input');name.maxLength=80;name.autocomplete='given-name';promotions=el('input');promotions.type='checkbox';const check=label(t(5),promotions);check.className='connect-check';
 promotions.onchange=()=>{
  if(busy){promotions.checked=state?.client.promotions===true;return;}
  const selected=promotions.checked;
  promotions.disabled=true;
  void run(async()=>{
   try{
    state=await api('preferences',{promotions:selected,language:lang()});
    status.textContent=t(13);
   }finally{
    promotions.checked=state?.client.promotions===true;
    promotions.disabled=false;
   }
  });
 };
 const save=el('button',t(6),'connect-save');save.type='button';save.onclick=()=>run(async()=>{state=await api('preferences',{name:name.value,language:lang()});status.textContent=t(13);update();});
 push=el('button',notice(0),'primary');push.type='button';push.onclick=()=>enablePush(status);
 const off=el('button',t(8),'connect-off');off.type='button';off.onclick=()=>run(async()=>{state=await api('preferences',{subscription:null});dismissSetup();status.textContent=t(20);update();});
 list=el('ol',null,'connect-thread');list.setAttribute('aria-label',t(0));
 const form=el('form'),body=el('textarea');form.className='connect-compose';body.maxLength=2000;const send=el('button',t(10),'primary connect-send');send.type='submit';
 body.addEventListener('input',()=>{pending=null;});form.append(label(t(9),body),send);
 const composer=window.ummaConnectComposer({lang:lang(),el,form,body,send,status,onChange:()=>{pending=null;}});
 form.onsubmit=e=>{
  e.preventDefault();
  if(busy||composer.recording||(!body.value.trim()&&!composer.draft))return;
  pending=pending||{requestKey:crypto.randomUUID(),body:body.value.trim()};
  const draft=composer.draft;
  composer.busy(true);
  void run(async()=>{
   if(draft){
    await window.ummaConnectMedia.upload(API,{'X-Umma-Token':token},draft,pending.requestKey,pending.body,composer.error);
   }else state=await api('send',pending);
   body.value='';
   composer.clear();
   pending=null;
   status.textContent=push.hidden?t(13):notice(1);
   if(draft){
    try{state=await api('list');}catch{setTimeout(refresh,0);}
   }
   renderThread();
   await markRead();
  }).finally(()=>composer.busy(false));
 };
 const settings=el('section',null,'connect-settings');settings.append(label(t(4),name),check);const actions=el('div',null,'connect-actions');actions.append(save,off);settings.append(actions);const messagesHeading=el('h3',lang()==='ru'?'Ваши сообщения':lang()==='vi'?'Tin nhắn của bạn':'Your messages','connect-messages-heading');content.append(settings,messagesHeading,list,form);dialog.append(join,push,content,status);document.body.append(dialog);
 dialog.addEventListener('close',()=>{
  composer.close();
  list.querySelectorAll('audio,video').forEach(media=>media.pause());
  button.focus();
 });
 function update(){join.hidden=!!token;content.hidden=!token;name.value=state?.client.name||'';promotions.checked=state?.client.promotions===true;const subscribed=state?.client.pushEnabled===true&&window.Notification?.permission==='granted';off.hidden=!state?.client.pushEnabled;push.hidden=subscribed;renderThread();}
 dialog.update=update;
 dialog.releaseDraft=()=>composer.clear();
}
async function open(){if(!dialog)build();if(!dialog.open)dialog.showModal();status.textContent='';await refresh();dialog.update?.();await markRead();}
button.onclick=open;window.ummaCustomerConnect={open};
window.addEventListener('umma-menu:languagechange',()=>{button.textContent=t(0);if(dialog&&!dialog.open){dialog.releaseDraft();dialog.remove();dialog=null;}else if(dialog){list.replaceChildren();renderThread();}badge();renderSetup();});
navigator.serviceWorker?.addEventListener('message',e=>{if(e.data?.type==='UMMA_CONNECT_PUSH'){void refresh();}if(e.data?.type==='UMMA_OPEN_CONNECT')void open();});
navigator.serviceWorker?.addEventListener('controllerchange',badge);
window.addEventListener('pageshow',refresh);window.addEventListener('online',refresh);document.addEventListener('visibilitychange',refresh);setInterval(refresh,15000);void refresh();installedSetup();
if(new URL(location.href).searchParams.has('connect'))void open();
})();
