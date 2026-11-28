/* Staff conversations and owner broadcasts. Authorization is enforced server-side. */
(()=>{'use strict';
const API='https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-connect';
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
let dialog=null,busy=false,polling=false,thread=null,replyKey=null,campaign=null,view='inbox';
let panels,viewButtons,clientSnapshot='',inboxClients=[],inboxAccess=false,checkingCounterAccess=false;
let inboxSearch,assigneeButton,workflow,threadMenu,alertAudio,soundButton;
const Audio=window.AudioContext||window.webkitAudioContext;
let inboxLoaded=false,avatarRefreshAt=0;
const inboxAvatars=new Map();
const translationLanguages=['ru','vi','en'];
const deviceTranslationLanguage=()=>[navigator.language,...(navigator.languages||[])]
 .map(value=>value?.split('-')[0].toLowerCase()).find(code=>translationLanguages.includes(code))||'en';
const translationPreferenceKey='umma:staff:translation-language:'+String(window.ummaStaffAuth?.actorId?.()||'staff');
let translationLanguage=(()=>{try{const saved=localStorage.getItem(translationPreferenceKey);return translationLanguages.includes(saved)?saved:deviceTranslationLanguage();}catch{return deviceTranslationLanguage();}})();
let inboxSeen=null,pendingSound=false,oldestButton,history=[],latestThread=null,historyFinished=false;
const counterMessageText='Внимание! Новое сообщение от клиента. Требует внимания.';
const atCounter=()=>document.body.dataset.workspace==='pos';
const counterSound=document.getElementById('counterMessageSound');
let soundInteracted=false;
function announceUnread(clients){
 const next=new Map(clients.filter(c=>c.unread>0&&c.last_unread_id).map(c=>[c.id,c.last_unread_id]));
 const incoming=inboxSeen&&[...next].some(([id,message])=>inboxSeen.get(id)!==message);
 inboxSeen=next;
 if(incoming)pendingSound=true;
 if(!next.size)pendingSound=false;
 playPendingSound();
}
function playPendingSound(){
 if(document.hidden||!pendingSound)return;
 const counter=atCounter();
 if(counter?!soundInteracted:alertAudio?.state!=='running')return;
 pendingSound=false;
 if(counter)window.ummaCounterSpeakAlert(counterMessageText);
 else playMessageSound();
}
window.ummaCounterSpeakAlert=async message=>{
 const spoken=await window.ummaKitchenLive?.speakCounterAlert(message);
 if(!spoken&&atCounter())playMessageSound();
};
function playMessageSound(){
 if(alertAudio?.state!=='running')return;
 const tone=alertAudio.createOscillator(),gain=alertAudio.createGain(),time=alertAudio.currentTime;
 tone.frequency.value=720;
 gain.gain.setValueAtTime(.1,time);
 gain.gain.exponentialRampToValueAtTime(.001,time+.22);
 tone.connect(gain);gain.connect(alertAudio.destination);tone.start(time);tone.stop(time+.24);
}
function updateSoundButton(){
 if(soundButton)soundButton.textContent=alertAudio?.state==='running'?'Проверить звук':'Включить звук';
 if(counterSound)counterSound.hidden=!inboxAccess||soundInteracted;
}
async function enableMessageSound(){
 if(!Audio)return;
 try{
  if(!alertAudio||alertAudio.state==='closed'){
   alertAudio=new Audio();
   alertAudio.addEventListener('statechange',()=>{
    updateSoundButton();
    playPendingSound();
   });
  }
  if(alertAudio.state!=='running')await alertAudio.resume();
  updateSoundButton();
  playPendingSound();
 }catch{}
}
const mediaNames={voice:'Голосовое сообщение',photo:'Фото',video:'Видео',album:'Фото и видео'};
const orderStates={pending:'Принят',confirmed:'Подтверждён',preparing:'Готовится',ready:'Готов',completed:'Завершён',cancelled:'Отменён',paid:'Оплата подтверждена',assigned:'Курьер назначен',courier_assigned:'Курьер назначен',picked_up:'Курьер забрал заказ',in_transit:'Курьер в пути',delivered:'Доставлен'};
const staffThemes=[
 ['light','Светлый'],
 ['turquoise','Бирюзовый'],
 ['dark','Тёмно-бирюзовый'],
 ['beige','Бежевый'],
 ['blue','Синий (ночной)'],
 ['lavender','Лавандовый']
];
const staffThemeKey=()=>{
 const actor=workspace
  ?window.ummaStaffAuth?.actorId?.()
  :window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
 return actor?'umma:staff:chat:theme:v1:'+actor:null;
};
const staffHiddenKey=id=>'umma:staff:chat:hidden:'+String(window.ummaStaffAuth?.actorId?.()||'owner')+':'+id;
let hiddenBefore='';
function loadStaffHidden(id){
 try{hiddenBefore=localStorage.getItem(staffHiddenKey(id))||'';}catch{hiddenBefore='';}
}
const compareTimestamp=(a,b)=>Date.parse(a)-Date.parse(b)||a.localeCompare(b);
const compareMessages=(a,b)=>compareTimestamp(a.created_at,b.created_at)||a.id.localeCompare(b.id);
function restoreStaffTheme(){
 const section=root();
 if(!section)return;
 const key=staffThemeKey();
 let id;
 try{if(key)id=localStorage.getItem(key);}catch{}
 section.dataset.chatTheme=staffThemes.some(([theme])=>theme===id)?id:'light';
}

const mobileChat=()=>window.matchMedia?.('(max-width:760px)')?.matches===true;
const limitedChat=()=>!!workspace&&(mobileChat()||navigator.userAgentData?.mobile||/Android|iPhone|iPad/.test(navigator.userAgent));
function syncChatScreen(){if(workspace)workspace.classList.toggle('work-chat-open',visible()&&view==='inbox'&&!!thread&&mobileChat());}
window.addEventListener('resize',syncChatScreen);
const workspace=document.getElementById('webMessages');
const badge=document.getElementById('webInboxCount');
const messagesTab=badge?.closest('button');
const button=workspace?null:node('button','Сообщения клиентов','umma-connect-button');
if(button){
 button.type='button';button.hidden=true;button.setAttribute('aria-haspopup','dialog');
 (document.querySelector('header')||document.body).append(button);
}
const root=()=>workspace||dialog;
const visible=()=>workspace?!workspace.hidden&&!!workspace.parentElement&&!workspace.parentElement.hidden:!!dialog?.open;
const credential=()=>window.ummaStaffAuth?.credential?.()||window.Telegram?.WebApp?.initData||'';
async function api(action,data={}){const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',signal:AbortSignal.timeout(action==='staffVoice'?115000:20000),body:JSON.stringify({action,initData:credential(),...data})});const d=await r.json();if(!r.ok||!d.ok){const error=Error(d.error||'Нет связи с кафе');error.status=r.status;throw error;}return d;}
const callIdentity=()=>{
 const initData=credential();
 return (owner()||inboxAccess)&&initData.startsWith('web:')?{initData}:null;
};
const calls=workspace?window.ummaConnectCalls?.({identity:callIdentity,language:()=> 'ru'}):null;
let callButtons;
const callAlerts=document.getElementById('webCallAlerts');
const callAlertStatus=document.getElementById('webCallAlertStatus');
const pushSupported=()=> 'Notification'in window&&'PushManager'in window&&'serviceWorker'in navigator;
const alertKey=()=> 'umma:staff-call-alerts:'+window.ummaStaffAuth?.actorId();
let inboxCallAlerts, inboxCallAlertStatus, callAlertsReady=false, updatingCallAlerts=false;
function syncCallAlerts(){
 if(!callAlerts||!calls)return;
 const supported=Boolean(callIdentity())&&pushSupported();
 callAlerts.hidden=!supported;
 callAlerts.disabled=updatingCallAlerts;
 callAlerts.textContent=callAlertsReady?'Отключить уведомления о звонках':'Включить уведомления о звонках';
 if(inboxCallAlerts){
  inboxCallAlerts.hidden=!supported||callAlertsReady;
  inboxCallAlerts.disabled=updatingCallAlerts;
 }
}
function showCallAlertStatus(message){
 if(callAlertStatus)callAlertStatus.textContent=message;
 if(inboxCallAlertStatus)inboxCallAlertStatus.textContent=message;
}
async function registerCallAlerts(){
 const registration=await Promise.race([
  navigator.serviceWorker.ready,
  new Promise((_,reject)=>setTimeout(()=>reject(Error('Служба уведомлений недоступна.')),12000))
 ]);
 let subscription=await registration.pushManager.getSubscription();
 if(!subscription){
  const response=await fetch('https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-push',{
   method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(12000),
   body:JSON.stringify({action:'config'})
  });
  const config=await response.json();
  if(!response.ok||!config.publicKey)throw Error('Не удалось подключить уведомления.');
  const key=Uint8Array.from(atob(config.publicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
  subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
 }
 await calls.saveStaffSubscription(subscription.toJSON());
}
async function updateCallAlerts(userInitiated){
 if(!callAlerts||!calls||!callIdentity()||!pushSupported()||updatingCallAlerts)return;
 const key=alertKey();
 const identity=credential();
 if(!userInitiated&&(Notification.permission!=='granted'||localStorage.getItem(key)==='off'))return;
 updatingCallAlerts=true;
 showCallAlertStatus('');
 syncCallAlerts();
 try{
  if(userInitiated&&callAlertsReady){
   await calls.saveStaffSubscription(null);
   localStorage.setItem(key,'off');
   callAlertsReady=false;
   showCallAlertStatus('Уведомления о звонках отключены.');
  }else{
   const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();
   if(permission!=='granted')throw Error('Разрешите уведомления для UMMA Work в настройках браузера.');
   await registerCallAlerts();
   if(credential()!==identity)return;
   localStorage.setItem(key,'on');
   callAlertsReady=true;
   if(userInitiated)showCallAlertStatus('Уведомления о звонках включены.');
  }
 }catch(error){
  callAlertsReady=false;
  if(userInitiated)showCallAlertStatus(error.message);
 }finally{
  updatingCallAlerts=false;
  syncCallAlerts();
 }
}
if(callAlerts&&calls)callAlerts.onclick=()=>void updateCallAlerts(true);

const TRANSLATE_API='https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-connect-translate';
async function translateChat(messageId,language,clientId){
 const payload={staff:true,initData:credential(),clientId,messageId,language};
 const response=await fetch(TRANSLATE_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(45000)});
 const result=await response.json();
 if(!response.ok||!result.ok)throw Error(result.error||'Translation unavailable');
 return result;
}
const connection=node('p',null,'work-board-connection');connection.hidden=true;connection.setAttribute('role','status');
const status=node('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
let clients,messages,replyForm,replyBody,replyStatus,threadTitle,threadAvatar,avatarInitials,avatarImage,composer;
let avatarCheckedAt=0;
const clientInitials=name=>Array.from(name?.trim()||'').slice(0,2).join('').toLocaleUpperCase()||'U';
function setAvatarPhoto(image,photo){
 if(image.getAttribute('src')===photo)return;
 image.hidden=true;
 if(photo)image.src=photo;
 else image.removeAttribute('src');
}
function renderThreadAvatar(client){
 threadAvatar.hidden=!client;
 if(!client){
  avatarCheckedAt=0;
  setAvatarPhoto(avatarImage,null);
  return;
 }
 avatarInitials.textContent=clientInitials(client.name);
 if(!Object.hasOwn(client,'avatar'))return;
 const photo=client.avatar;
 setAvatarPhoto(avatarImage,typeof photo==='string'&&/^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(photo)?photo:null);
}
function messageAvatar(incoming,kind){
 const badge=node('span',null,'work-message-avatar work-'+kind+'-avatar');
 badge.setAttribute('aria-hidden','true');
 const image=node('img');
 image.alt='';
 image.hidden=true;
 image.onload=()=>{image.hidden=false;};
 image.onerror=()=>{image.hidden=true;};
 badge.append(node('span',incoming?'':'U'),image);
 if(!incoming)setAvatarPhoto(image,'logo/assets/umma-icon-192.png');
 return badge;
}
let audienceStats,audiencePoints,audienceList,segment,previousPage,nextPage,pageStatus,offset=0;
const dateTime=new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Ho_Chi_Minh'});
const clock=new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Ho_Chi_Minh'});
const localDay=new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeZone:'Asia/Ho_Chi_Minh'});
const searchText=value=>String(value??'').normalize('NFC').toLocaleLowerCase().replaceAll('ё','е');

function conversationTime(value,now){
 const date=new Date(value);
 if(!value||!Number.isFinite(+date))return null;
 const day=localDay.format(date);
 const label=day===localDay.format(now)?clock.format(date):
  day===localDay.format(now-86400000)?'Вчера':day;
 const time=node('time',label);
 time.dateTime=date.toISOString();
 time.title=dateTime.format(date);
 return time;
}

async function refreshAudience(){
 const data=await api('staffAudience',{segment:segment.value,offset});
 audienceStats.textContent=[
  'Устройств: '+data.devices+' · Визитов: '+data.visits,
  'Впервые: '+data.firstTimers+' · Повторно: '+data.returning+' · Постоянных: '+data.regular,
  'Завершившихся визитов без заказа: '+data.withoutOrder,
  'С установкой приложения: '+data.installed+' · Из них с push: '+data.pushInstalled
 ].join('\n');
 audiencePoints.replaceChildren(...data.points.map(p=>node('li',(p.point||'Прямой вход')+' · '+p.devices+' устройств · '+p.visits+' визитов')));
 audienceList.replaceChildren();
 for(const guest of data.guests){
  const name=guest.name||'Гость '+guest.id.slice(0,8);
  const row=node('li');
  row.append(node('strong',name),node('small',[
   (guest.orders>=2?'Постоянный':guest.visits>1?'Повторный визит':'Первый визит'),
   guest.visits_recent+' визитов за 30 дней',
   guest.orders+' заказов',
   guest.installed?'Приложение установлено':null,
   guest.push_enabled?'Push включён':null
  ].filter(Boolean).join(' · ')));
  row.append(node('small','Первый визит '+dateTime.format(new Date(guest.first_seen_at))+
   ' · Последний '+dateTime.format(new Date(guest.last_seen_at))+' · '+(guest.point||'Прямой вход')));
  if(guest.client_id){
   const contact=node('button','Открыть переписку');contact.type='button';
   contact.onclick=()=>run(()=>openThread(guest.client_id));
   row.append(contact);
  }
  audienceList.append(row);
 }
 if(!data.guests.length)audienceList.append(node('li','В этой группе пока нет посетителей.'));
 previousPage.hidden=offset===0;
 nextPage.hidden=offset+data.guests.length>=data.matched;
 pageStatus.textContent=data.matched&&data.guests.length
  ? (offset+1)+'–'+(offset+data.guests.length)+' из '+data.matched
  : 'Записей: '+data.matched;
}

function buildAudience(){
 const section=node('section');
 audienceStats=node('p');audienceStats.style.whiteSpace='pre-line';
 audiencePoints=node('ol');audienceList=node('ol');
 segment=node('select');
 for(const [value,title] of [['all','Все посетители'],['new','Впервые'],['returning','Вернулись'],['regular','Два заказа и больше'],['viewed','Посмотрели и ушли без заказа'],['push','Установили приложение и включили push']]){
  const option=node('option',title);option.value=value;segment.append(option);
 }
 segment.onchange=()=>{offset=0;void run(refreshAudience);};
 const changePage=step=>()=>run(async()=>{
  const old=offset;offset=Math.max(0,offset+step);
  try{await refreshAudience();}catch(error){offset=old;throw error;}
 });
 previousPage=node('button','Назад');previousPage.type='button';previousPage.hidden=true;previousPage.onclick=changePage(-50);
 nextPage=node('button','Далее');nextPage.type='button';nextPage.hidden=true;nextPage.onclick=changePage(50);
 pageStatus=node('p');
 section.append(node('h3','Посещения меню за 30 дней'),audienceStats,
  node('small','Посетители считаются по браузерам. Новый визит начинается после 30 минут без активности. Входы по разным QR-точкам считаются отдельно. Постоянный клиент оформил два заказа или больше.'),
  node('h4','QR-точки и прямые входы'),audiencePoints,label('Группа посетителей',segment),
  audienceList,pageStatus,previousPage,nextPage);
 return section;
}
function label(text,input){const l=node('label',text);l.append(input);return l;}
function selectView(name){
 if(name!=='inbox')closeThread();
 view=name;
 for(const [key,panel] of Object.entries(panels))panel.hidden=key!==name;
 for(const [key,control] of Object.entries(viewButtons))control.setAttribute('aria-pressed',String(key===name));
 syncChatScreen();
}
async function run(fn,feedback=status){
 if(busy)return;
 busy=true;const buttons=[...root().querySelectorAll('button:not([disabled])')];
 buttons.forEach(b=>b.disabled=true);feedback.textContent='Загрузка…';
 try{await fn();}catch(e){feedback.textContent=e.message;}
 finally{busy=false;buttons.forEach(b=>b.disabled=false);}
}
function openOrder(order){
 const panel=node('dialog',null,'work-chat-dialog');
 const title=node('h2','Заказ №'+order.order_number);
 const close=node('button','Закрыть');close.type='button';close.onclick=()=>panel.close();
 const status=orderStates[order.delivery_status]||orderStates[order.status]||'Оформлен';
 const payment={paid:'Оплачен',pending:'Ожидает оплаты',refunded:'Оплата возвращена',partial:'Частично оплачен'}[order.payment_status];
 panel.append(title,node('p',status),node('p',payment),node('p',dateTime.format(new Date(order.created_at))),close);
 panel.addEventListener('close',()=>panel.remove(),{once:true});
 document.body.append(panel);panel.showModal();
}
function showMessages(data,forceBottom=false){
 const nearBottom=forceBottom||messages.scrollHeight-messages.clientHeight-messages.scrollTop<80;
 const orders=new Map((workflow?.orders||[]).map(order=>[order.id,order]));
 const timeline=(workflow?.orders||[]).map(order=>({
  id:'order:'+order.id,order,created_at:order.created_at
 }));
 for(const order of orders.values()){
  if(order.paid_at)timeline.push({id:'paid:'+order.id,order,event:{to_status:'paid'},created_at:order.paid_at});
  for(const event of order.events||[]){
   if(orderStates[event.to_status])timeline.push({id:'event:'+event.id,order,event,created_at:event.created_at});
  }
 }
 const allMessages=new Map([...history,...(data.messages||[])].map(message=>[message.id,message]));
 const entries=[...timeline,...[...allMessages.values()].filter(m=>!hiddenBefore||compareTimestamp(m.created_at,hiddenBefore)>0)];
 entries.sort((a,b)=>compareTimestamp(a.created_at,b.created_at)||Number(!!b.order&&!b.event)-Number(!!a.order&&!a.event)
  ||Number(b.event?.to_status==='paid')-Number(a.event?.to_status==='paid')||a.id.localeCompare(b.id));
 const target=translationLanguage;
 const defer=limitedChat();
 const playback={defer};
 const labels={album:'Открыть фото и видео',photo:'Открыть фото',video:'Открыть видео',voice:'Прослушать голосовое',error:'Не удалось открыть вложение. Попробуйте ещё раз.'};
 window.ummaConnectMedia.render(messages,entries,m=>{
  if(m.order){
   const li=node('li',null,'work-chat-order');
   const open=node('button','Заказ №'+m.order.order_number);open.type='button';
   open.onclick=()=>openOrder(workflow?.orders.find(order=>order.id===m.order.id)||m.order);
   const caption=m.event?orderStates[m.event.to_status]:'Заказ оформлен';
   li.append(open,node('span',caption),node('small',dateTime.format(new Date(m.created_at))));
   return li;
  }
  const li=node('li',null,'connect-chat-bubble');li.dataset.direction=m.direction;li.dataset.messageId=m.id;
  const videoNote=m.direction!=='campaign'&&m.media_kind==='video'&&(m.video_note===true||m.body==='◉ Видеосообщение');
  const voice=m.media_kind==='voice'&&m.direction!=='campaign';
  const incoming=m.direction==='customer';
  if(videoNote)li.classList.add('connect-video-note');
  if(voice)li.classList.add('connect-chat-voice');
  if(!voice&&!videoNote){
   const author=node('strong',incoming?(data.client.name?.trim()||'Клиент'):m.title||'UMMA');
   if(workspace&&!m.media_kind){
    const header=node('div',null,'work-text-author');
    header.append(messageAvatar(incoming,'text'),author);
    li.append(header);
   }else li.append(author);
  }
  if(m.body&&!videoNote){
   const serverTranslation=()=>translateChat(m.id,target,data.client.id);
   const textTranslation=defer?serverTranslation:
    ()=>window.ummaLocalTranslate.translate(m.body,target).then(text=>({text})).catch(serverTranslation);
   li.append(m.media_kind?node('div',m.body):window.ummaConnectMedia.translatedText(m.body,target,textTranslation,
    defer?'Перевести':undefined,defer?{loading:'Переводим…',error:'Перевод временно недоступен. Показан оригинал.'}:undefined));
  }
  let voicePlayer;
  if(m.media_kind){
   const load=async()=> (await api('staffMediaGet',{clientId:data.client.id,messageId:m.id})).url;
   if(voice)voicePlayer=window.ummaConnectMedia.publicVoice(load,labels.error,{lang:'ru',defer});
   li.append(voicePlayer||(videoNote?window.ummaConnectMedia.videoCircle(load,labels.error,playback)
    :m.media_kind==='album'?window.ummaConnectMedia.inlineAlbum(labels,load,playback)
    :window.ummaConnectMedia.inlineAttachment(m.media_kind,labels[m.media_kind],load,labels.error,playback)));
  }
  if(m.direction==='customer'&&m.media_kind==='voice'&&typeof data.voiceTranslation==='boolean'){
   const voiceTranslation=defer?()=>api('staffVoice',{clientId:data.client.id,messageId:m.id,language:target}):
    async(source)=>{const media=await api('staffMediaGet',{clientId:data.client.id,messageId:m.id});return window.ummaLocalTranslate.voice(media.url,target,source);};
   li.append(window.ummaConnectMedia.voiceTranslation('ru',target,voiceTranslation,true,{local:!defer}));
  }
  const meta=node('div',null,'connect-message-meta');
  const sentAt=new Date(m.created_at);
  const time=node('small',dateTime.format(sentAt));
  if(workspace&&voicePlayer){
   voicePlayer.append(messageAvatar(incoming,'voice'));
   meta.append(voicePlayer.querySelector('.connect-voice-duration'));
   time.title=time.textContent;
   time.textContent=clock.format(sentAt);
  }
  meta.append(time);
  if(m.direction!=='customer')meta.append(node('small',null,'connect-receipt'));
  (voicePlayer||li).append(meta);
  return li;
 },(m,row)=>{const marker=row.querySelector('.connect-receipt');const read=!!m.read_at,delivered=!!m.delivered_at;const label=read?'Прочитано клиентом':delivered?'Доставлено клиенту':'Отправлено';if(marker){marker.style.color=read?'#34B7F1':'#89979B';marker.style.fontWeight='700';marker.style.letterSpacing='-3px';marker.style.paddingRight='3px';marker.title=label+(read?' · '+dateTime.format(new Date(m.read_at)):'');marker.setAttribute('aria-label',label);}return read||delivered?'✓✓':'✓';});
 if(!messages.children.length)messages.append(node('li','Сообщений пока нет.'));
 if(nearBottom)messages.scrollTop=messages.scrollHeight;
 oldestButton.hidden=!workspace||historyFinished||(history.length===0&&(data.messages||[]).length<100);
 assigneeButton.hidden=!workflow?.canAssign;
 threadMenu.hidden=false;
 threadTitle.textContent=data.client.name||'Клиент '+data.client.id.slice(0,8);
 if(workspace){
  renderThreadAvatar(data.client);
  // Refresh existing message avatars without rebuilding the cards or players.
  for(const badge of messages.querySelectorAll('[data-direction=customer] .work-message-avatar')){
   badge.firstElementChild.textContent=avatarInitials.textContent;
   setAvatarPhoto(badge.querySelector('img'),avatarImage.getAttribute('src'));
  }
 }
 replyForm.hidden=false;
 if(callButtons)callButtons.hidden=!callIdentity();
}
async function loadEarlier(){
 if(!thread||!latestThread)return;
 const clientId=thread;
 const beforeId=(history[0]||[...latestThread.messages].sort(compareMessages)[0])?.id;
 if(!beforeId)return;
 await run(async()=>{
  const {messages:older}=await api('staffInboxHistory',{clientId,beforeId});
  if(thread!==clientId)return;
  history=[...older,...history];
  historyFinished=older.length<50;
  const height=messages.scrollHeight,top=messages.scrollTop;
  showMessages(latestThread);
  messages.scrollTop=top+messages.scrollHeight-height;
  status.textContent='';
 });
}
function closeThread(){
 if(!thread)return;
 composer.close();composer.clear();window.ummaConnectMedia.releaseAlbums(messages);
 for(const media of messages.querySelectorAll('audio[src],video[src]')){
  media.pause();
  media.removeAttribute('src');
  media.load();
 }
 messages.replaceChildren();thread=null;workflow=null;replyKey=null;replyBody.value='';
 history=[];latestThread=null;historyFinished=false;oldestButton.hidden=true;
 replyStatus.textContent='';replyForm.hidden=true;threadMenu.open=false;threadMenu.hidden=true;
 if(callButtons)callButtons.hidden=true;
 threadTitle.textContent='Выберите переписку';
 if(workspace)renderThreadAvatar(null);
 syncChatScreen();renderClients();
}
async function readThread(id,background=false){
 let data,details;
 const includeAvatar=!!workspace&&Date.now()-avatarCheckedAt>=30000;
 try{
  [data,details]=await Promise.all([api('staffThread',{clientId:id,...(includeAvatar&&{includeAvatar:true})}),
   workspace?api('staffInboxDetails',{clientId:id}):null]);
 }catch(error){
  if(error.status===403&&thread===id)closeThread();
  throw error;
 }
 if(thread!==id||document.hidden||view!=='inbox'||(background&&(busy||!visible())))return;
 const firstLoad=replyForm.hidden;
 workflow=details;
 if(history.length&&latestThread){
  const latestIds=new Set(data.messages.map(message=>message.id));
  history.push(...latestThread.messages.filter(message=>!latestIds.has(message.id)));
 }
 if(includeAvatar)avatarCheckedAt=typeof data.client.avatar==='string'?Date.now():0;
 latestThread=data;
 showMessages(data,firstLoad);
 const latest=data.messages.filter(m=>m.direction==='customer'&&!m.read_at).at(-1);
 if(latest){await api('staffRead',{clientId:id,before:latest.created_at});await refresh();}
}
async function openThread(id){
 if(thread!==id){
  closeThread();loadStaffHidden(id);thread=id;threadTitle.textContent='Загружаем переписку…';renderClients();
 }
 selectView('inbox');
 await readThread(id);
 if(thread===id)threadTitle.focus({preventScroll:true});
 status.textContent='';
}
function renderClients(){
 if(!clients)return;
 const query=searchText(inboxSearch?.value).trim().split(/\s+/).filter(Boolean);
 const now=Date.now();
 const snapshot=JSON.stringify([thread,query,inboxLoaded,localDay.format(now),inboxClients,[...inboxAvatars]]);
 if(snapshot===clientSnapshot)return;
 const focused=document.activeElement?.dataset.clientThread;
 clientSnapshot=snapshot;clients.replaceChildren();
 const sorted=inboxClients.filter(c=>{
  if(!query.length)return true;
  const searchable=searchText([c.name,c.last_message,mediaNames[c.last_media],c.order_number&&'№'+c.order_number].filter(Boolean).join(' '));
  return query.every(word=>searchable.includes(word));
 }).sort((a,b)=>(workspace?0:Number(!!b.unread)-Number(!!a.unread))||
  (Date.parse(b.last_at)||0)-(Date.parse(a.last_at)||0));
 for(const c of sorted){
  const li=node('li'),b=node('button',null,'work-thread-choice');
  b.type='button';b.dataset.clientThread=c.id;b.setAttribute('aria-pressed',String(thread===c.id));
  const name=c.name||'Клиент '+c.id.slice(0,8);
  const avatar=node('span',clientInitials(c.name),'work-thread-avatar');avatar.setAttribute('aria-hidden','true');
  const photo=inboxAvatars.get(c.id);
  if(photo){
   const image=node('img');
   image.alt='';image.loading='lazy';image.decoding='async';
   image.onload=()=>image.classList.add('is-loaded');
   image.onerror=()=>image.remove();
   image.src=photo;
   avatar.append(image);
  }
  const description=node('span',null,'work-thread-description');
  const heading=node('span',null,'work-thread-summary');heading.append(node('strong',name));
  const time=workspace?conversationTime(c.last_at,now):c.last_at?node('time',dateTime.format(new Date(c.last_at))):null;
  if(time)heading.append(time);
  const preview=node('span',null,'work-thread-preview');
  const media=mediaNames[c.last_media];
  const last=node('small',(workspace?media||c.last_message:c.last_message||media)||'Переписка ещё не началась');
  preview.append(last);
  if(Number(c.unread)>0){
   b.dataset.unread='true';
   const count=node('span',c.unread>99?'99+':String(c.unread),'work-thread-unread');
   count.setAttribute('aria-label','Непрочитанных сообщений: '+c.unread);
   if(workspace)preview.append(count);
   else b.append(count);
  }
  description.append(heading,workspace?preview:last);
  if(workspace){
   const assigned=c.assignee_name||(c.assigned?'Сотрудник':null);
   const metadata=[c.order_number?'№'+c.order_number:null,assigned].filter(Boolean);
   if(metadata.length)description.append(node('small',metadata.join(' · '),'work-thread-context'));
  }
  b.prepend(avatar,description);
  b.onclick=()=>run(()=>openThread(c.id));li.append(b);clients.append(li);
  if(c.id===focused)b.focus({preventScroll:true});
 }
 if(focused&&!clients.contains(document.activeElement))inboxSearch?.focus({preventScroll:true});
 if(!sorted.length){
  const empty=!inboxLoaded&&workspace?'Загружаем переписки…':query.length?'Ничего не найдено.':'Здесь появятся обращения клиентов.';
  clients.append(node('li',empty,'work-inbox-empty'));
 }
}
async function refresh(){
 const includeAvatars=!!workspace&&visible()&&view==='inbox'&&
  (Date.now()>=avatarRefreshAt||inboxClients.some(c=>!inboxAvatars.has(c.id)));
 const d=await api(workspace?'staffInbox':'staffList',includeAvatars?{includeAvatars:true}:{});
 if(checkingCounterAccess){
  checkingCounterAccess=false;
  inboxAccess=true;
  document.dispatchEvent(new Event('umma:staff-counter-inbox-access'));
  syncCallAlerts();
  void updateCallAlerts(false);
  updateSoundButton();
 }
 if(workspace){
  const ids=new Set(d.clients.map(c=>c.id));
  for(const id of inboxAvatars.keys())if(!ids.has(id))inboxAvatars.delete(id);
  if(includeAvatars){
   avatarRefreshAt=Date.now()+300000;
   for(const c of d.clients)inboxAvatars.set(c.id,typeof c.avatar_url==='string'&&c.avatar_url.startsWith('https://')?c.avatar_url:null);
  }
 }
 const unread=d.clients.reduce((total,c)=>total+(Number(c.unread)||0),0);
 if(badge){
  badge.hidden=!unread;
  badge.textContent=unread>99?'99+':String(unread);
  if(unread)messagesTab.setAttribute('aria-label','Сообщения, непрочитанных: '+unread);
  else messagesTab.removeAttribute('aria-label');
 }
 if(button)button.textContent='Сообщения клиентов'+(unread?' · '+unread:'');
 if(workspace)announceUnread(d.clients);
 if(workspace)document.dispatchEvent(new CustomEvent('umma:staff-inbox-counts',{detail:{unread}}));
 inboxClients=d.clients;
 inboxLoaded=true;
 renderClients();
}
function openAssignee(){
 if(!thread||!workflow?.canAssign)return;
 const clientId=thread,details=workflow;
 const panel=node('dialog',null,'work-chat-dialog'),form=node('form');
 const assignee=node('select'),feedback=node('p');
 feedback.setAttribute('role','status');
 assignee.add(new Option('Без ответственного',''));
 for(const person of details.assignees)assignee.add(new Option(person.name,person.id));
 assignee.value=details.assignee||'';
 form.append(label('Ответственный',assignee));
 const save=node('button','Сохранить','primary'),cancel=node('button','Закрыть');
 cancel.type='button';cancel.onclick=()=>panel.close();
 save.type='submit';
 form.append(save,cancel,feedback);
 form.onsubmit=async event=>{
  event.preventDefault();save.disabled=true;
  try{
   await api('staffInboxUpdate',{clientId,revision:details.revision,assignee:assignee.value||null});
   panel.close();
   await refreshView();
  }catch(error){feedback.textContent=error.message;}
  finally{save.disabled=false;}
 };
 panel.append(node('h2','Назначить ответственного'),form);
 panel.addEventListener('close',()=>panel.remove(),{once:true});
 document.body.append(panel);panel.showModal();
}
async function refreshView(){
 if(view==='audience')await refreshAudience();
 else if(view!=='campaign'){
  await refresh();
  if(view==='inbox'&&thread)await readThread(thread);
 }
 connection.hidden=true;
 status.textContent='';
}
const campaignFormats={
 'image/jpeg':['photo',8],'image/png':['photo',8],'image/webp':['photo',8],
 'video/mp4':['video',20],'video/webm':['video',20],'video/quicktime':['video',20],
 'audio/mpeg':['voice',5],'audio/mp4':['voice',5],'audio/webm':['voice',5],'audio/ogg':['voice',5]
};
function buildCampaign(){
 const section=node('section',null,'work-campaign'),form=node('form'),fields=node('fieldset');
 const title=node('input'),body=node('textarea'),language=node('select'),file=node('input');
 title.required=true;title.maxLength=100;body.maxLength=2000;body.rows=4;
 file.type='file';file.accept=Object.keys(campaignFormats).join(',')+',.m4a,.mp3,.mov';
 const installedOnly=node('input');installedOnly.type='checkbox';installedOnly.defaultChecked=Boolean(workspace);
 const installedLabel=label('Только клиенты с установленным приложением',installedOnly);installedLabel.className='connect-check';
 const publicNews=node('input');publicNews.type='checkbox';publicNews.defaultChecked=!workspace;
 const publicLabel=label('Показать текст всем посетителям меню',publicNews);publicLabel.className='connect-check';
 for(const [code,name] of [['all','Все языки'],['ru','Русский'],['en','English'],['vi','Tiếng Việt'],['ko','한국어'],['zh','中文'],['de','Deutsch'],['fr','Français'],['th','ไทย'],['ms','Bahasa Melayu'],['id','Bahasa Indonesia'],['ar','العربية'],['pt','Português']]){
  language.add(new Option(name,code));
 }
 function updateFields(){
  body.required=!file.files.length;
  publicNews.disabled=installedOnly.checked||language.value!=='all'||file.files.length>0;
 }
 const preview=node('section',null,'work-campaign-preview'),previewTitle=node('h4'),previewBody=node('p');
 const previewMedia=node('div'),previewWho=node('p');
 const confirm=node('button','Отправить рассылку','primary'),cancel=node('button','Изменить');
 confirm.type=cancel.type='button';
 preview.hidden=true;
 const actions=node('div',null,'work-campaign-actions');actions.append(confirm,cancel);
 preview.append(previewTitle,previewBody,previewMedia,previewWho,actions);
 const submit=node('button','Предпросмотр','primary');submit.type='submit';
 const hint=node('small','Фото до 8 МБ, видео до 20 МБ, аудио до 5 МБ. Без файла можно отправить текст.');
 fields.append(label('Язык получателей',language),installedLabel,publicLabel,label('Заголовок',title),
  label('Текст',body),label('Фото, видео или аудио',file),hint,submit);
 form.append(fields,preview);
 section.append(node('h3','Акции и новые блюда'),
  node('p','Рассылку увидят в чате клиенты, подписанные на акции. Push получат устройства с разрешёнными уведомлениями.'),form);
 let previewURL='';
 function releasePreview(){
  previewMedia.replaceChildren();
  if(previewURL)URL.revokeObjectURL(previewURL);
  previewURL='';
 }
 function resetPreview(){
  releasePreview();
  fields.hidden=false;
  preview.hidden=true;
  campaign=null;
 }
 fields.addEventListener('input',updateFields);
 cancel.onclick=()=>{resetPreview();title.focus();};
 form.onsubmit=event=>{
  event.preventDefault();
  if(busy||!preview.hidden)return;
  void run(async()=>{
   if(!title.value.trim())throw Error('Введите заголовок.');
   const attachment=file.files[0];
   const mime=attachment?.type==='audio/x-m4a'||(attachment&&!attachment.type&&/\.m4a$/i.test(attachment.name))?'audio/mp4':attachment?.type;
   const format=Object.hasOwn(campaignFormats,mime)?campaignFormats[mime]:null;
   if(attachment&&(!format||!attachment.size))throw Error('Выберите фото JPEG, PNG или WebP, видео MP4, WebM или MOV либо аудио MP3, M4A, WebM или OGG.');
   if(attachment&&attachment.size>format[1]*1024*1024)throw Error('Размер файла превышает '+format[1]+' МБ.');
   if(!attachment&&!body.value.trim())throw Error('Добавьте текст или файл.');
   const details={title:title.value.trim(),body:body.value.trim(),language:language.value,
    installedOnly:installedOnly.checked,publicNews:!publicNews.disabled&&publicNews.checked};
   fields.disabled=true;
   try{
    const recipients=await api('staffCampaignAudience',{language:details.language,installedOnly:details.installedOnly});
    if(!recipients.recipients&&!details.publicNews)throw Error('Условиям рассылки сейчас не соответствует ни один клиент.');
    releasePreview();
    if(attachment){
     previewURL=URL.createObjectURL(attachment);
     const [kind]=format;
     previewMedia.append(window.ummaConnectMedia.player(kind,previewURL,mediaNames[kind]));
    }
    campaign={details,requestKey:crypto.randomUUID(),
     attachment:attachment?{file:new Blob([attachment],{type:mime}),kind:format[0]}:null};
    previewTitle.textContent=details.title;
    previewBody.textContent=details.body;
    previewBody.hidden=!details.body;
    previewWho.textContent='Клиентов в чате: '+recipients.recipients+' · Устройств с push: '+recipients.pushRecipients;
    confirm.textContent=details.publicNews?'Опубликовать и отправить':'Отправить рассылку';
    preview.hidden=false;
    fields.hidden=true;
    status.textContent='';
   }finally{fields.disabled=false;}
  }).then(()=>{if(!preview.hidden)confirm.focus();});
 };
 confirm.onclick=()=>void run(async()=>{
  if(!campaign)return;
  const {details,requestKey,attachment}=campaign;
  const result=attachment?await window.ummaConnectMedia.upload(API,{
   'X-Umma-Staff':credential(),
   'X-Umma-Campaign':encodeURIComponent(JSON.stringify({title:details.title,language:details.language,installedOnly:details.installedOnly}))
  },attachment,requestKey,details.body,code=>({
   MEDIA_SIZE:'Файл превышает допустимый размер.',
   MEDIA_FORMAT:'Не удалось распознать формат файла.',
   MEDIA_UPLOAD:'Не удалось загрузить файл. Повторите отправку.'
  })[code]||'Не удалось отправить рассылку. Повторите попытку.')
   :await api('staffCampaign',{...details,requestKey});
  status.textContent=(details.publicNews?'Опубликовано в меню. ':'')+'Добавлено в чаты: '+result.recipients+
   '. Push поставлены в очередь: '+result.pushRecipients+'.';
  resetPreview();form.reset();updateFields();title.focus();
 });
 updateFields();
 return section;
}
function buildNavigation(){
 const nav=node('nav',null,'work-section-switch');nav.setAttribute('aria-label','Разделы связи с клиентами');
 const tabs=[['inbox','Входящие']];
 if(!workspace){panels.audience=buildAudience();tabs.push(['audience','Посетители']);}
 panels.campaign=buildCampaign();
 tabs.push(['campaign','Рассылки']);
 for(const [key,label] of tabs){
  const tab=node('button',label);tab.type='button';tab.onclick=()=>run(async()=>{selectView(key);await refreshView();});
  viewButtons[key]=tab;nav.append(tab);
 }
 return nav;
}
function build(){
 if(workspace){workspace.classList.add('umma-connect','work-messages');}
 else{dialog=node('dialog',null,'umma-connect');dialog.setAttribute('aria-label','Сообщения клиентов');}
 const section=root(),header=node('header',null,'work-messages-heading');
 if(dialog){
  const close=node('button','Закрыть','connect-close');close.type='button';close.onclick=()=>dialog.close();header.append(close);
 }
 const heading=node(workspace?'h1':'h2',workspace?'Сообщения':'Сообщения клиентов');
 header.append(heading);
 const tools=node('div',null,'work-inbox-tools');
 if(dialog){
  const refreshButton=node('button','Обновить');
  refreshButton.type='button';
  refreshButton.onclick=()=>void run(refreshView);
  tools.append(refreshButton);
 }
 if(workspace&&Audio){
  soundButton=node('button');
  soundButton.type='button';
  updateSoundButton();
  soundButton.onclick=async()=>{
   await enableMessageSound();
   if(alertAudio?.state==='running')playMessageSound();
   else status.textContent='Звук недоступен в этом браузере.';
  };
  tools.append(soundButton);
 }
 if(workspace){
  const settings=node('details',null,'work-inbox-settings');
  const languagePicker=node('select');
  for(const [code,name] of [['ru','Русский'],['vi','Tiếng Việt'],['en','English']]){
   languagePicker.add(new Option(name,code));
  }
  languagePicker.value=translationLanguage;
  languagePicker.onchange=()=>{
   translationLanguage=languagePicker.value;
   try{localStorage.setItem(translationPreferenceKey,translationLanguage);}catch{}
   if(latestThread){
    for(const translation of messages.querySelectorAll('.connect-translated-text,.connect-voice-translation')){
     const row=translation.closest('[data-connect-message]');
     row.dataset.connectMessage+=':previous-language';
    }
    showMessages(latestThread);
   }
  };
  tools.append(label('Язык перевода сообщений',languagePicker));
  settings.append(node('summary','Настройки'),tools);
  header.append(settings);
 }else header.append(tools);
 panels={inbox:node('section',null,'work-inbox')};
 viewButtons={};
 clients=node('ol',null,'work-inbox-list');
 threadTitle=node('h2','Выберите переписку');threadTitle.tabIndex=-1;messages=node('ol',null,'connect-thread');
 replyForm=node('form');replyForm.classList.add('connect-compose');replyForm.hidden=true;replyBody=node('textarea');replyBody.maxLength=2000;
 replyBody.addEventListener('input',()=>{replyKey=null;replyStatus.textContent='';});
 const send=node('button','Отправить ответ','primary connect-send');send.type='submit';
 replyStatus=node('p');replyStatus.setAttribute('role','status');
 replyBody.placeholder='Сообщение';replyBody.rows=1;replyBody.setAttribute('aria-label','Сообщение');send.textContent='➤';send.setAttribute('aria-label','Отправить');replyForm.append(replyBody,send,replyStatus);
 composer=window.ummaConnectComposer({lang:'ru',el:node,form:replyForm,body:replyBody,send,status:replyStatus,
  compact:true,albums:true,onChange:()=>{replyKey=null;},
  onInstantVideo:async file=>{
   if(!thread||busy)throw Error('Чат недоступен');
   const clientId=thread;
   await window.ummaConnectMedia.upload(API,{'X-Umma-Staff':credential(),'X-Umma-Client':clientId},
    {file,kind:'video'},crypto.randomUUID(),'◉ Видеосообщение',composer.error);
   if(thread===clientId)await readThread(clientId);
  }});
 replyForm.onsubmit=e=>{
  e.preventDefault();
  const body=replyBody.value.trim(),draft=composer.draft;
  if(busy||composer.recording||!thread||(!body&&!draft))return;
  replyKey=replyKey||crypto.randomUUID();
  const clientId=thread;
  composer.busy(true);
  void run(async()=>{
   let data;
   if(draft){
    await window.ummaConnectMedia.upload(API,{'X-Umma-Staff':credential(),'X-Umma-Client':clientId},
     draft,replyKey,body,composer.error);
   }else data=await api('staffReply',{clientId,requestKey:replyKey,body});
   replyBody.value='';
   composer.clear();
   replyKey=null;
   if(draft){
    try{data=await api('staffThread',{clientId});}catch{}
   }
   if(data&&thread===clientId){latestThread=data;showMessages(data,true);}
   replyStatus.textContent=''; // Successful sends are reflected in the thread; keep the status area for errors only.
   void refresh().catch(()=>{});
  },replyStatus).finally(()=>composer.busy(false));
 };
 const threadHeading=node('header',null,'work-call-heading connect-chat-header');
 if(workspace){
  threadAvatar=node('span',null,'work-chat-avatar');
  threadAvatar.hidden=true;threadAvatar.setAttribute('aria-hidden','true');
  avatarInitials=node('span');
  avatarImage=node('img');avatarImage.alt='';avatarImage.hidden=true;
  avatarImage.width=avatarImage.height=34;
  avatarImage.onload=()=>{avatarImage.hidden=false;};
  avatarImage.onerror=()=>{
   avatarImage.hidden=true;
   avatarImage.removeAttribute('src');
   avatarCheckedAt=0;
  };
  threadAvatar.append(avatarInitials,avatarImage);threadHeading.append(threadAvatar);
 }
 threadHeading.append(threadTitle);
 if(calls){
  callButtons=calls.buttons(()=>({clientId:thread,name:threadTitle.textContent}));
  callButtons.hidden=true;threadHeading.append(callButtons);
 }
 const back=node('button',null,'work-chat-back');back.type='button';back.setAttribute('aria-label','Назад');back.innerHTML="<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M19 12H5\"/><path d=\"m12 19-7-7 7-7\"/></svg>";for(const [key,value] of Object.entries({display:'inline-flex',alignItems:'center',justifyContent:'center',width:'44px',minWidth:'44px',height:'44px',minHeight:'44px',padding:'0',border:'0',borderRadius:'0',background:'transparent',color:'#fff',flex:'0 0 44px'}))back.style.setProperty(key.replace(/[A-Z]/g,m=>'-'+m.toLowerCase()),value,'important');back.onclick=()=>{const id=thread;closeThread();const target=[...clients.querySelectorAll('button')].find(b=>b.dataset.clientThread===id)||inboxSearch;target?.focus();};threadHeading.prepend(back);
 const menu=node('details',null,'connect-chat-menu');threadMenu=menu;menu.hidden=true;
 const toggle=node('summary',null,'connect-chat-menu-toggle');
 toggle.setAttribute('aria-label','Действия чата');toggle.title='Действия чата';
 const actions=node('div',null,'connect-chat-menu-panel');
 const themeButton=node('button','Тема','connect-theme-menu-button');
 themeButton.type='button';themeButton.setAttribute('aria-haspopup','dialog');
 themeButton.onclick=()=>{
  menu.open=false;
  const modal=node('dialog',null,'connect-theme-dialog');modal.setAttribute('aria-label','Тема чата');
  const key=staffThemeKey();
  const heading=node('h3','Тема чата');
  const grid=node('div',null,'connect-theme-grid');
  for(const [id,name] of staffThemes){
   const choice=node('button',null,'connect-theme-choice');choice.type='button';choice.dataset.chatTheme=id;
   choice.append(node('span',null,'connect-theme-preview'),node('span',name));
   choice.setAttribute('aria-label',name);
   choice.setAttribute('aria-pressed',String(root().dataset.chatTheme===id));
   choice.onclick=()=>{
    if(key===staffThemeKey()){
     root().dataset.chatTheme=id;
     try{if(key)localStorage.setItem(key,id);}catch{}
    }
    modal.close();
   };
   grid.append(choice);
  }
  const close=node('button','Закрыть','connect-theme-close');close.type='button';close.onclick=()=>modal.close();
  modal.append(heading,grid,close);
  modal.addEventListener('close',()=>{modal.remove();toggle.focus();},{once:true});
  document.body.append(modal);modal.showModal();
 };
 const clear=node('button','Очистить чат','connect-clear-chat');clear.type='button';
 clear.onclick=()=>{
  menu.open=false;toggle.focus();
  if(!thread||!window.confirm('Очистить переписку только на этом устройстве? У клиента сообщения останутся.'))return;
  const latest=[...(latestThread?.messages||[])].sort(compareMessages).at(-1);
  if(latest)hiddenBefore=latest.created_at;
  try{localStorage.setItem(staffHiddenKey(thread),hiddenBefore);}catch{}
  if(latestThread)showMessages(latestThread,true);
 };
 assigneeButton=node('button','Ответственный');assigneeButton.type='button';assigneeButton.hidden=true;
 assigneeButton.onclick=()=>{menu.open=false;openAssignee();};
 actions.append(assigneeButton,themeButton,clear);menu.append(toggle,actions);threadHeading.append(menu);
 const wallpaper=node('div',null,'connect-chat-wallpaper');wallpaper.append(messages);
 oldestButton=node('button','Загрузить более ранние сообщения','work-chat-older');
 oldestButton.type='button';oldestButton.hidden=true;oldestButton.onclick=()=>void loadEarlier();
 const threadPanel=node('section',null,'work-thread umma-connect-chat');threadPanel.append(threadHeading,oldestButton,wallpaper,replyForm);
 threadPanel.addEventListener('click',event=>{
  if(menu.open&&!menu.contains(event.target))menu.open=false;
 });
 threadPanel.addEventListener('keydown',event=>{
  if(event.key!=='Escape'||!menu.open)return;
  event.preventDefault();menu.open=false;toggle.focus();
 });
 const listPanel=node('section',null,'work-inbox-sidebar');
 if(workspace){
  listPanel.setAttribute('aria-label','Переписки');
  const controls=node('div',null,'work-inbox-controls');
  const search=node('div',null,'work-inbox-search');
  search.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 4 4"/></svg>';
  inboxSearch=node('input');
  inboxSearch.type='search';inboxSearch.placeholder='Найти переписку';
  inboxSearch.setAttribute('aria-label','Поиск по имени, номеру заказа и последнему сообщению');
  inboxSearch.addEventListener('input',renderClients);
  search.append(inboxSearch);
  controls.append(search);
  if(calls){
   inboxCallAlerts=node('button','Включить уведомления о звонках','web-soft-button');
   inboxCallAlerts.type='button';
   inboxCallAlerts.onclick=()=>void updateCallAlerts(true);
   inboxCallAlertStatus=node('small');
   inboxCallAlertStatus.setAttribute('role','status');
   controls.append(inboxCallAlerts,inboxCallAlertStatus);
   syncCallAlerts();
  }
  listPanel.append(controls);
 }else listPanel.append(node('h2','Переписки'));
 listPanel.append(clients);
 renderClients();
 panels.inbox.append(listPanel,threadPanel);
 section.append(header);
 if(owner())section.append(buildNavigation());
 section.append(connection,status,...Object.values(panels));selectView('inbox');
 if(dialog){document.body.append(dialog);dialog.addEventListener('close',()=>{composer.close();button.focus();});}
}
function owner(){return window.ummaRole==='super_admin'||window.ummaUser?.role==='super_admin';}
function openInbox(){
 if(!panels)build();
 restoreStaffTheme();
 if(workspace)selectView('inbox');
 if(dialog&&!dialog.open)dialog.showModal();
 void run(refreshView);
}
if(button)button.onclick=openInbox;
function syncVisibility(){
 if(callButtons)callButtons.hidden=!thread||!callIdentity();
 if(button){button.hidden=!owner();if(button.hidden&&dialog?.open)dialog.close();}
}
async function poll(){
 if(!(workspace?inboxAccess||checkingCounterAccess||owner():owner())||polling||busy||document.hidden||(!workspace&&!visible()))return;
 polling=true;
 try{
  await refresh();
  if(visible()&&view==='inbox'&&thread&&!busy)await readThread(thread,true);
  connection.hidden=true;
 }catch(error){
  if(error.status===403)checkingCounterAccess=false;
  if(error.status===403&&thread)closeThread();
  if(visible()){
   connection.textContent='Сообщения пока не обновились. Повторим попытку автоматически.';
   connection.hidden=false;
  }
 }finally{polling=false;}
}
document.addEventListener('umma:staff-tab',e=>{
 if(e.detail==='messages'&&(inboxAccess||owner()))openInbox();
 else closeThread();
});
if(workspace){
 const unlock=()=>{
  if(!inboxAccess&&!checkingCounterAccess&&!owner())return;
  soundInteracted=true;
  updateSoundButton();
  if(alertAudio?.state!=='running')void enableMessageSound();
  playPendingSound();
 };
 document.addEventListener('click',unlock,true);
 document.addEventListener('keydown',unlock,true);
 counterSound?.addEventListener('click',()=>{
  const message='Звук сообщений включён.';
  void window.ummaCounterSpeakAlert(message);
 });
}
document.addEventListener('umma:staff-ready',event=>{
 const roles=event.detail?.assignments||[];
 inboxAccess=owner()||roles.some(a=>['manager','cashier','waiter'].includes(a.staff_role));
 checkingCounterAccess=!inboxAccess&&roles.some(a=>a.staff_role==='kitchen'&&a.can_accept_payments);
 updateSoundButton();
 syncCallAlerts();
 void updateCallAlerts(false);
 restoreStaffTheme();
 syncVisibility();void poll();
});
function resumeMessages(){
 if(document.hidden)return;
 if(!callAlertsReady)void updateCallAlerts(false);
 if(workspace&&thread&&visible())avatarCheckedAt=0;
 if(alertAudio)void enableMessageSound();
 playPendingSound();
 void poll();
}
document.addEventListener('visibilitychange',resumeMessages);
window.addEventListener('pageshow',resumeMessages);
window.addEventListener('offline',()=>{
 if(visible()){
  connection.textContent='Нет интернета. Открыта последняя полученная переписка.';
  connection.hidden=false;
 }
});
window.addEventListener('online',()=>void poll());
document.addEventListener('umma:connect-realtime',()=>void poll());setInterval(()=>{syncVisibility();void poll();},8000);
syncVisibility();
})();
