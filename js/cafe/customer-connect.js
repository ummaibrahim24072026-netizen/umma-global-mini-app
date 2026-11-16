/* Device-bound customer channel. The opaque credential never appears in URLs or push payloads. */
(()=>{'use strict';
const API='https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-connect',KEY='umma:connect:token:v1';
let token='',state=null,dialog=null,busy=false,pending=null,reading=false,refreshing=null,hiddenMessages=new Set();
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
const publicChat=document.body.classList.contains('public-cafe-menu');
const CHAT_THEME_KEY='umma:chat:theme:v1';
const chatThemes=[
 ['light','Светлый','Light','Sáng'],
 ['turquoise','Бирюзовый','Turquoise','Xanh ngọc'],
 ['dark','Тёмно-бирюзовый','Dark teal','Xanh ngọc đậm'],
 ['beige','Бежевый','Beige','Màu be'],
 ['blue','Синий (ночной)','Night blue','Xanh đêm'],
 ['lavender','Лавандовый','Lavender','Oải hương']
];
function savedChatTheme(){
 try{
  const id=localStorage.getItem(CHAT_THEME_KEY);
  return chatThemes.some(([theme])=>theme===id)?id:'light';
 }catch{return 'light';}
}
const chatTitles={ru:'Чат UMMA',en:'UMMA Chat',vi:'Trò chuyện UMMA'};
const connectHost=document.getElementById('customerConnectHost');
const inMessages=!!connectHost?.closest('#customerMessages');
const chatTitle=()=>publicChat?(chatTitles[lang()]||chatTitles.en):t(0);
const profileSettingsButton=document.getElementById('openChatSettings');
let settingsDialog;
const chatSettings={ru:'Настройки чата',en:'Chat settings',vi:'Cài đặt trò chuyện'};
const button=el('button',chatTitle(),'umma-connect-button');button.type='button';button.setAttribute('aria-haspopup','dialog');
(connectHost||document.querySelector('.menu-tools')||document.getElementById('cafeNotificationBar')||document.querySelector('header')||document.body).append(button);
async function api(action,data={}){const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',signal:AbortSignal.timeout(action==='voice'?115000:15000),body:JSON.stringify({action,token,...data})});const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||t(16));return d;}
function unread(){return (state?.messages||[]).filter(m=>m.direction!=='customer'&&!m.read_at);}
function badge(){
 const count=unread().length;
 button.textContent=chatTitle()+(count&&!inMessages?' · '+count:'');
 if(inMessages){
  button.dataset.unread=String(count);
  window.dispatchEvent(new Event('umma:messages-count'));
 }
 if(state)navigator.serviceWorker?.controller?.postMessage({type:'UMMA_CONNECT_BADGE',count});
}
function refresh(){
 if(refreshing)return refreshing;
 if(!token||document.hidden||busy)return;
 refreshing=(async()=>{
  try{
   await refreshHidden();
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
 ru:{album:'Открыть фото и видео',photo:'Открыть фото',video:'Открыть видео',voice:'Прослушать голосовое',error:'Не удалось открыть вложение. Попробуйте ещё раз.'},
 en:{album:'Open photos and videos',photo:'Open photo',video:'Open video',voice:'Listen to voice message',error:'Could not open attachment. Try again.'},
 vi:{album:'Mở ảnh và video',photo:'Mở ảnh',video:'Mở video',voice:'Nghe tin nhắn thoại',error:'Không mở được tệp. Hãy thử lại.'}
};
const TRANSLATE_API='https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-connect-translate';
async function translateChat(messageId,language,clientId){
 const payload={token,messageId,language};
 const response=await fetch(TRANSLATE_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(45000)});
 const result=await response.json();
 if(!response.ok||!result.ok)throw Error(result.error||'Translation unavailable');
 return result;
}
const ACTIONS='https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-connect-actions';
async function messageAction(action,messageId){
 const response=await fetch(ACTIONS,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,action,messageId})});
 const result=await response.json();
 if(!response.ok||!result.ok)throw Error(result.code==='READ_OR_NOT_OWN'?'Сообщение уже прочитано. Удалить у всех нельзя.':result.error||'Не удалось выполнить действие.');
 return result;
}
async function refreshHidden(){
 try{const result=await messageAction('hidden');hiddenMessages=new Set(result.ids||[]);}catch{}
}
function downloadAttachment(file){
 const url=URL.createObjectURL(file);
 const link=document.createElement('a');
 link.href=url;link.download=file.name;
 document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),30000);
}
async function forwardMessage(m){
 const text=(m.body&&m.body!=='◉ Видеосообщение')?m.body:'';
 if(m.media_kind){
  const result=await api('mediaGet',{messageId:m.id});
  if(m.media_kind==='album'){
   const files=await window.ummaConnectMedia.albumFiles(result.url);
   if(navigator.share&&navigator.canShare?.({files})){
    await navigator.share({files,...(text?{text}:{})});
    return;
   }
   for(const file of files)downloadAttachment(file);
   return;
  }
  const response=await fetch(result.url,{cache:'no-store'});
  if(!response.ok)throw Error('Не удалось загрузить вложение');
  const blob=await response.blob();
  const mime=blob.type||({'photo':'image/jpeg','video':'video/mp4','voice':'audio/webm'}[m.media_kind]);
  const extension=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/webm':'webm','audio/webm':'webm','audio/mp4':'m4a','audio/ogg':'ogg'})[mime.split(';')[0]]||'bin';
  const file=new File([blob],'UMMA-'+m.media_kind+'-'+m.id.slice(0,8)+'.'+extension,{type:mime});
  if(navigator.share&&navigator.canShare?.({files:[file]})){
   await navigator.share({files:[file],...(text?{text}:{})});
   return;
  }
  // Never forward a filename instead of the actual attachment.
  downloadAttachment(file);
  alert('Файл сохранён. Прикрепите его в WhatsApp или другом чате.');
  return;
 }
 if(navigator.share)await navigator.share({text});
 else if(navigator.clipboard){await navigator.clipboard.writeText(text);alert('Текст скопирован');}
}
function messageMenu(li,m){
 const ru=lang()==='ru';
 const labels={ru:['Копировать','Переслать','Удалить у себя','Удалить у всех'],en:['Copy','Forward','Delete for me','Delete for everyone'],vi:['Sao chép','Chuyển tiếp','Xóa phía tôi','Xóa với mọi người']};
 const l=labels[lang()]||labels.en;
 const menu=el('details',null,'connect-message-actions');
 const summary=el('summary','⋯');
 summary.setAttribute('aria-label',ru?'Действия с сообщением':'Message actions');
 menu.append(summary);
 const forwardIcon='M14 4l7 7-7 7v-4h-3c-3.5 0-6 1.5-8 4.5.5-6.5 4-10.5 11-10.5z';
 const deleteIcon='M3 6h18M9 6V4h6v2M5 6l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13M10 10v7m4-7v7';
 const add=(icon,label,action,danger=false)=>{
  const button=el('button',null,danger?'connect-action-danger':'');
  button.type='button';
  const glyph=el('span',icon.text,'connect-action-icon');
  glyph.setAttribute('aria-hidden','true');
  if(icon.path){
   const ns='http://www.w3.org/2000/svg';
   const svg=document.createElementNS(ns,'svg');
   for(const [name,value] of Object.entries({width:20,height:20,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':1.8,'stroke-linecap':'round','stroke-linejoin':'round',focusable:'false'})){
    svg.setAttribute(name,value);
   }
   const path=document.createElementNS(ns,'path');
   path.setAttribute('d',icon.path);
   svg.append(path);
   glyph.append(svg);
  }
  const title=el('span',label);
  button.append(glyph,title);
  button.onclick=async()=>{
   menu.open=false;
   try{await action();}
   catch(error){if(error?.name!=='AbortError')alert(error?.message||'Не удалось выполнить действие');}
  };
  menu.append(button);
 };
 if(m.body&&m.body!=='◉ Видеосообщение')add({text:'▤'},l[0],async()=>navigator.clipboard.writeText(m.body));
 add({path:forwardIcon},l[1],()=>forwardMessage(m));
 add({path:deleteIcon},l[2],async()=>{await messageAction('hide',m.id);hiddenMessages.add(m.id);renderThread();});
 if(m.direction==='customer'&&!m.read_at)add({path:deleteIcon},l[3],async()=>{
  if(!confirm(l[3]+'?'))return;
  await messageAction('deleteAll',m.id);
  state=await api('list');renderThread();
 },true);
 li.append(menu);
}
function renderThread(){
 if(!list)return;
 const nearBottom=list.scrollHeight-list.clientHeight-list.scrollTop<48;
 const receipt=receiptCopy[lang()]||receiptCopy.en;
 const dateTime=new Intl.DateTimeFormat(document.documentElement.lang||'en',{dateStyle:'short',timeStyle:'short'});
 const media=mediaCopy[lang()]||mediaCopy.en;
 const target=window.ummaConnectMedia.language(lang());
 window.ummaConnectMedia.render(list,(state?.messages||[]).filter(m=>!hiddenMessages.has(m.id)),m=>{
  const li=el('li');
  const outgoing=m.direction==='customer';
  li.dataset.direction=m.direction;
  if(!publicChat||!outgoing)li.append(el('strong',outgoing?t(18):m.title||t(19)));
  if(m.body==='◉ Видеосообщение')li.classList.add('connect-video-note');
  else if(m.body)li.append(m.media_kind?el('div',m.body):window.ummaConnectMedia.translatedText(m.body,target,()=>window.ummaLocalTranslate.translate(m.body,target).then(text=>({text}))));
  if(m.media_kind){
   const load=async()=> (await api('mediaGet',{messageId:m.id})).url;
   li.append(m.media_kind==='album'?window.ummaConnectMedia.inlineAlbum(media,load):m.media_kind==='video'&&m.body==='◉ Видеосообщение'
    ?window.ummaConnectMedia.videoCircle(load,media.error)
    :window.ummaConnectMedia.inlineAttachment(m.media_kind,media[m.media_kind],load,media.error));
  }
  if(!outgoing&&m.media_kind==='voice'&&typeof state.voiceTranslation==='boolean'){
   li.append(window.ummaConnectMedia.voiceTranslation(lang(),target,
    async(source)=>{const media=await api('mediaGet',{messageId:m.id});return window.ummaLocalTranslate.voice(media.url,target,source);},true));
  }
  const timestamp=dateTime.format(new Date(m.created_at));
  const meta=publicChat?el('div',null,'connect-message-meta'):li;
  meta.append(el('small',timestamp));
  if(outgoing)meta.append(el('small',null,'connect-receipt'));
  if(publicChat)li.append(meta);
  if(publicChat)messageMenu(li,m);
  return li;
 },m=>{
  if(publicChat)return m.read_at?'✓✓ '+receipt[1]:'✓ '+receipt[0];
  return m.read_at?receipt[1]+' · '+dateTime.format(new Date(m.read_at)):receipt[0];
 });
 if(!list.children.length)list.append(el('li',t(12),'connect-empty'));
 if(publicChat&&nearBottom)list.scrollTop=list.scrollHeight;
 badge();
}
async function markRead(){
 const latest=unread().at(-1);
 if(reading||!latest||!dialog?.open||document.hidden)return;
 reading=true;
 try{
  // The read endpoint serializes the cutoff to milliseconds. Round up only
  // when the database timestamp has a nonzero fraction of a millisecond.
  const createdAt=latest.created_at;
  const hasSubMillisecondPrecision=/\.\d{3}\d*[1-9]\d*(?:Z|[+-]\d{2}:\d{2})$/.test(createdAt);
  const before=hasSubMillisecondPrecision?new Date(Date.parse(createdAt)+1).toISOString():createdAt;
  state=await api('read',{before});
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
async function run(fn,feedback=status,showProgress=true){
 if(busy)return;
 busy=true;await refreshing;
 const buttons=[...(dialog?.querySelectorAll('button')||[]),...(settingsDialog?.querySelectorAll('button')||[]),setupButton,later];
 buttons.forEach(b=>b.disabled=true);feedback.textContent=showProgress?t(17):'';
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
function enablePush(feedback,enableOrderAlerts=feedback===status){
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
  if(enableOrderAlerts)window.ummaOrderAlerts?.enableGranted?.();
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
 dialog=el('dialog',null,publicChat?'umma-connect umma-connect-chat':'umma-connect');dialog.setAttribute('aria-label',chatTitle());
 if(publicChat)dialog.dataset.chatTheme=savedChatTheme();
 const close=el('button',t(1),'connect-close');close.type='button';close.onclick=()=>dialog.close();const hero=el('div',null,'connect-hero');const heroIcon=el('span','☏','connect-hero-icon');if(connectHost){const logo=el('img');logo.src='logo/assets/umma-icon-192.png';logo.alt='';logo.width=42;logo.height=42;heroIcon.replaceChildren(logo);}heroIcon.setAttribute('aria-hidden','true');const heroText=el('div',null,'connect-hero-copy');heroText.append(el('h2',chatTitle()));if(publicChat){
  close.textContent='←';
  close.setAttribute('aria-label',t(1));
  const menuLabel=({ru:'Действия чата',vi:'Tùy chọn trò chuyện'})[lang()]||'Chat options';
  const clearLabel=({ru:'Очистить чат',vi:'Xóa lịch sử trò chuyện'})[lang()]||'Clear chat';
  const chatMenu=el('details',null,'connect-chat-menu');
  const menuToggle=el('summary',null,'connect-chat-menu-toggle');
  menuToggle.setAttribute('aria-label',menuLabel);
  menuToggle.title=menuLabel;
  const menuPanel=el('div',null,'connect-chat-menu-panel');
  const clearButton=el('button',clearLabel,'connect-clear-chat');
  clearButton.type='button';
  const themeLabel=({ru:'Тема чата',vi:'Giao diện trò chuyện'})[lang()]||'Chat theme';
  const themeButton=el('button',({ru:'Тема',vi:'Giao diện'})[lang()]||'Theme','connect-theme-menu-button');
  themeButton.setAttribute('aria-haspopup','dialog');
  themeButton.type='button';
  themeButton.onclick=()=>{
   chatMenu.open=false;
   const modal=el('dialog',null,'connect-theme-dialog');
   modal.setAttribute('aria-label',themeLabel);
   const heading=el('h3',themeLabel);
   const grid=el('div',null,'connect-theme-grid');
   for(const [id,ru,en,vi] of chatThemes){
    const choice=el('button',null,'connect-theme-choice');
    choice.type='button';choice.dataset.chatTheme=id;
    const preview=el('span',null,'connect-theme-preview');
    const name=el('span',lang()==='ru'?ru:lang()==='vi'?vi:en);
    choice.append(preview,name);
    choice.setAttribute('aria-pressed',String(dialog.dataset.chatTheme===id));
    choice.onclick=()=>{
     dialog.dataset.chatTheme=id;
     try{localStorage.setItem(CHAT_THEME_KEY,id);}catch{}
     modal.close();
    };
    grid.append(choice);
   }
   const closeTheme=el('button',lang()==='ru'?'Закрыть':lang()==='vi'?'Đóng':'Close','connect-theme-close');
   closeTheme.type='button';closeTheme.onclick=()=>modal.close();
   modal.append(heading,grid,closeTheme);
   modal.addEventListener('close',()=>{modal.remove();menuToggle.focus();},{once:true});
   document.body.append(modal);modal.showModal();
  };
  menuPanel.append(themeButton);
  menuPanel.append(clearButton);
  chatMenu.append(menuToggle,menuPanel);
  dialog.addEventListener('click',event=>{
   if(chatMenu.open&&!chatMenu.contains(event.target))chatMenu.open=false;
  });
  dialog.addEventListener('keydown',event=>{
   if(event.key!=='Escape'||!chatMenu.open)return;
   event.preventDefault();
   chatMenu.open=false;
   menuToggle.focus();
  });
  dialog.addEventListener('close',()=>{chatMenu.open=false;});
  clearButton.onclick=()=>{
   chatMenu.open=false;
   menuToggle.focus();
   const modal=el('dialog',null,'connect-clear-confirm');
   const heading=el('h3',lang()==='ru'?'Очистить чат?':lang()==='vi'?'Xóa lịch sử trò chuyện?':'Clear chat?');
   const explanation=el('p',lang()==='ru'?'Все сообщения исчезнут только у вас. У UMMA переписка сохранится. Новые сообщения будут приходить как обычно.':lang()==='vi'?'Tin nhắn chỉ biến mất với bạn. UMMA vẫn giữ cuộc trò chuyện.':'Messages will disappear only for you. UMMA will keep the conversation.');
   const cancel=el('button',lang()==='ru'?'Отмена':lang()==='vi'?'Hủy':'Cancel');
   const confirmButton=el('button',lang()==='ru'?'Очистить чат':lang()==='vi'?'Xóa cuộc trò chuyện':'Clear chat','connect-clear-confirm-action');
   cancel.type=confirmButton.type='button';
   cancel.onclick=()=>modal.close();
   confirmButton.onclick=async()=>{
    confirmButton.disabled=true;
    try{
     await messageAction('clear');
     await refreshHidden();
     renderThread();
     modal.close();
    }catch(error){
     confirmButton.disabled=false;
     explanation.textContent=error.message||'Не удалось очистить чат.';
    }
   };
   const actions=el('div',null,'connect-clear-confirm-buttons');
   actions.append(cancel,confirmButton);
   modal.append(heading,explanation,actions);
   modal.addEventListener('close',()=>modal.remove(),{once:true});
   document.body.append(modal);modal.showModal();
  };
  hero.append(close,heroIcon,heroText,chatMenu);
  dialog.append(hero);
 }else{
  heroText.append(el('p',t(2)));
  hero.append(heroIcon,heroText,close);
  dialog.append(hero,el('small',t(11)));
 }
 const settingsStatus=publicChat?el('p'):status;
 if(publicChat)settingsStatus.setAttribute('role','status');
 const join=el('button',t(3),'primary');join.type='button';const content=el('div');join.hidden=!!token;content.hidden=!token;
 join.onclick=()=>run(async()=>{await connect();update();state=await api('preferences',{language:lang()});status.textContent='';});
 name=el('input');name.maxLength=80;name.autocomplete='given-name';promotions=el('input');promotions.type='checkbox';const check=label(t(5),promotions);check.className='connect-check';
 promotions.onchange=()=>{
  if(busy){promotions.checked=state?.client.promotions===true;return;}
  const selected=promotions.checked;
  promotions.disabled=true;
  void run(async()=>{
   try{
    await connect();
    state=await api('preferences',{promotions:selected,language:lang()});
    settingsStatus.textContent=t(13);
   }finally{
    promotions.checked=state?.client.promotions===true;
    promotions.disabled=false;
   }
  },settingsStatus);
 };
 const save=el('button',t(6),'connect-save');save.type='button';save.onclick=()=>run(async()=>{await connect();state=await api('preferences',{name:name.value,language:lang()});settingsStatus.textContent=t(13);update();},settingsStatus);
 push=el('button',notice(0),'primary');push.type='button';push.onclick=()=>enablePush(settingsStatus,true);
 const off=el('button',t(8),'connect-off');off.type='button';off.onclick=()=>run(async()=>{state=await api('preferences',{subscription:null});dismissSetup();settingsStatus.textContent=t(20);update();},settingsStatus);
 list=el('ol',null,'connect-thread');list.setAttribute('aria-label',chatTitle());
 if(publicChat)list.addEventListener('loadedmetadata',event=>{
  const latest=list.lastElementChild;
  if(!event.target.matches('.connect-inline-video video')||!latest?.contains(event.target))return;
  const {top,bottom}=list.getBoundingClientRect();
  const messageTop=latest.getBoundingClientRect().top;
  if(messageTop>=top&&messageTop<bottom)list.scrollTop=list.scrollHeight;
 },true);
 const form=el('form'),body=el('textarea');form.className='connect-compose';body.maxLength=2000;const send=el('button',t(10),'primary connect-send');send.type='submit';
 body.addEventListener('input',()=>{pending=null;});
 if(publicChat){
  body.placeholder=({ru:'Сообщение',vi:'Tin nhắn',en:'Message'})[lang()]||'Message';
  body.setAttribute('aria-label',t(9));
  body.rows=1;
  send.textContent='➤';
  send.setAttribute('aria-label',t(10));
  form.append(body,send);
 }else form.append(label(t(9),body),send);
 const composer=window.ummaConnectComposer({lang:lang(),el,form,body,send,status,compact:publicChat,albums:publicChat,onChange:()=>{pending=null;},
  onInstantVideo:publicChat?async file=>{
   if(busy)throw Error(t(16));
   const requestKey=crypto.randomUUID();
   sending(true);
   try{
    await connect();
    await window.ummaConnectMedia.upload(API,{'X-Umma-Token':token},{file,kind:'video'},requestKey,'◉ Видеосообщение',composer.error);
    await refreshHidden();
    state=await api('list');
    renderThread();
    list.scrollTop=list.scrollHeight;
    status.textContent='';
   }finally{sending(false);}
  }:null});
 function sending(value){
  composer.busy(value);
  if(!publicChat)return;
  if(value){
   status.textContent='';
   send.setAttribute('aria-busy','true');
   send.hidden=false;
  }else send.removeAttribute('aria-busy');
 }
 form.onsubmit=e=>{
  e.preventDefault();
  if(busy||composer.recording||(!body.value.trim()&&!composer.draft))return;
  pending=pending||{requestKey:crypto.randomUUID(),body:body.value.trim()};
  const draft=composer.draft;
  sending(true);
  void run(async()=>{
   if(draft){
    await window.ummaConnectMedia.upload(API,{'X-Umma-Token':token},draft,pending.requestKey,pending.body,composer.error);
   }else state=await api('send',pending);
   body.value='';
   composer.clear();
   pending=null;
   status.textContent=publicChat?'':push.hidden?t(13):notice(1);
   if(draft){
    try{state=await api('list');}catch{setTimeout(refresh,0);}
   }
   renderThread();
   if(publicChat)list.scrollTop=list.scrollHeight;
   await markRead();
  },status,!publicChat).finally(()=>sending(false));
 };
 const settings=el('section',null,'connect-settings');
 const actions=el('div',null,'connect-actions');
 settings.append(label(t(4),name),check,actions);
 if(publicChat){
  if(profileSettingsButton){
   const settingsLabel=window.ummaMenuI18n?.t('Настройки чата')||chatSettings[lang()]||chatSettings.en;
   settingsDialog=el('dialog',null,'umma-connect');
   settingsDialog.id='customerChatSettings';
   settingsDialog.setAttribute('aria-labelledby','customerChatSettingsTitle');
   const heading=el('h2',settingsLabel);
   heading.id='customerChatSettingsTitle';
   const closeSettings=el('button','×','connect-close');
   closeSettings.type='button';
   closeSettings.setAttribute('aria-label',t(1));
   closeSettings.onclick=()=>settingsDialog.close();
   actions.append(save,push,off);
   settingsDialog.append(closeSettings,heading,settings,settingsStatus);
   document.body.append(settingsDialog);
  }
  content.className='connect-chat-content';
  const wallpaper=el('div',null,'connect-chat-wallpaper');
  wallpaper.append(list);
  content.append(wallpaper,status,form);
  dialog.append(join,content);
 }else{
  actions.append(save,off);
  const heading=el('h3',lang()==='ru'?'Ваши сообщения':lang()==='vi'?'Tin nhắn của bạn':'Your messages','connect-messages-heading');
  content.append(settings,heading,list,form);
  dialog.append(join,push,content,status);
 }
 document.body.append(dialog);
 dialog.addEventListener('close',()=>{
  composer.close();
  list.querySelectorAll('audio,video').forEach(media=>media.pause());
  button.focus();
 });
 function update(){
  join.hidden=!!token;
  content.hidden=!token;
  if(publicChat){
   if(token)content.insertBefore(status,form);
   else join.after(status);
  }
  name.value=state?.client.name||'';
  promotions.checked=state?.client.promotions===true;
  const subscribed=state?.client.pushEnabled===true&&window.Notification?.permission==='granted';
  off.hidden=!state?.client.pushEnabled;
  push.hidden=subscribed;
  renderThread();
 }
 dialog.update=update;
 dialog.releaseDraft=()=>composer.clear();
}
async function open(){if(!dialog)build();if(!dialog.open)dialog.showModal();status.textContent='';await refresh();dialog.update?.();if(publicChat)list.scrollTop=list.scrollHeight;await markRead();}
button.onclick=open;window.ummaCustomerConnect={open};
if(profileSettingsButton)profileSettingsButton.onclick=async()=>{
 if(!dialog)build();
 settingsDialog.showModal();
 settingsDialog.querySelector('[role=status]').textContent='';
 await refresh();
 dialog.update?.();
};
window.addEventListener('umma-menu:languagechange',()=>{button.textContent=chatTitle();if(dialog&&!dialog.open){dialog.releaseDraft();window.ummaConnectMedia.releaseAlbums(list);dialog.remove();dialog=null;settingsDialog?.remove();settingsDialog=null;}else if(dialog){window.ummaConnectMedia.releaseAlbums(list);list.replaceChildren();renderThread();}badge();renderSetup();});
navigator.serviceWorker?.addEventListener('message',e=>{if(e.data?.type==='UMMA_CONNECT_PUSH'){void refresh();}if(e.data?.type==='UMMA_OPEN_CONNECT')void open();});
navigator.serviceWorker?.addEventListener('controllerchange',badge);
window.addEventListener('pageshow',refresh);window.addEventListener('online',refresh);document.addEventListener('visibilitychange',refresh);setInterval(refresh,15000);void refresh();installedSetup();
if(new URL(location.href).searchParams.has('connect'))void open();
})();
