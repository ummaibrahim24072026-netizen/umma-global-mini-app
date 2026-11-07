/* Owner-only inbox and explicit, previewed broadcasts. Authorization is enforced server-side. */
(()=>{'use strict';
const API='https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-connect';
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
let dialog=null,busy=false,polling=false,thread=null,replyKey=null,campaign=null,view='inbox';
let panels,viewButtons,clientSnapshot='';
const workspace=document.getElementById('webMessages');
const badge=document.getElementById('webInboxCount');
const button=workspace?null:node('button','Сообщения клиентов','umma-connect-button');
if(button){
 button.type='button';button.hidden=true;button.setAttribute('aria-haspopup','dialog');
 (document.querySelector('header')||document.body).append(button);
}
const root=()=>workspace||dialog;
const visible=()=>workspace?!workspace.hidden&&!!workspace.parentElement&&!workspace.parentElement.hidden:!!dialog?.open;
const credential=()=>window.ummaStaffAuth?.credential?.()||window.Telegram?.WebApp?.initData||'';
async function api(action,data={}){const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',signal:AbortSignal.timeout(20000),body:JSON.stringify({action,initData:credential(),...data})});const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'Нет связи с кафе');return d;}
const status=node('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
let clients,stats,messages,replyForm,replyBody,replyStatus,threadTitle;
let audienceStats,audiencePoints,audienceList,segment,previousPage,nextPage,pageStatus,offset=0;
const dateTime=new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Ho_Chi_Minh'});

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
 view=name;
 for(const [key,panel] of Object.entries(panels))panel.hidden=key!==name;
 for(const [key,control] of Object.entries(viewButtons))control.setAttribute('aria-pressed',String(key===name));
}
async function run(fn,feedback=status){
 if(busy)return;
 busy=true;const buttons=[...root().querySelectorAll('button:not([disabled])')];
 buttons.forEach(b=>b.disabled=true);feedback.textContent='Загрузка…';
 try{await fn();}catch(e){feedback.textContent=e.message;}
 finally{busy=false;buttons.forEach(b=>b.disabled=false);}
}
function showMessages(data){
 const labels={photo:'Открыть фото',video:'Открыть видео',voice:'Прослушать голосовое'};
 window.ummaConnectMedia.render(messages,data.messages||[],m=>{
  const li=node('li');li.dataset.direction=m.direction;
  li.append(node('strong',m.direction==='customer'?'Клиент':m.title||'UMMA'));
  if(m.body)li.append(node('div',m.body));
  if(m.media_kind)li.append(window.ummaConnectMedia.attachment(m.media_kind,labels[m.media_kind],
   async()=> (await api('staffMediaGet',{clientId:data.client.id,messageId:m.id})).url,
   'Не удалось открыть вложение. Попробуйте ещё раз.'));
  li.append(node('small',dateTime.format(new Date(m.created_at))));
  if(m.direction!=='customer')li.append(node('small',null,'connect-receipt'));
  return li;
 },m=>m.read_at?'Прочитано клиентом · '+dateTime.format(new Date(m.read_at)):'Отправлено');
 if(!messages.children.length)messages.append(node('li','Сообщений пока нет.'));
 threadTitle.textContent=data.client.name||'Клиент '+data.client.id.slice(0,8);
 replyForm.hidden=false;
}
async function readThread(id,background=false){
 const d=await api('staffThread',{clientId:id});
 if(thread!==id||document.hidden||!visible()||view!=='inbox'||(background&&busy))return;
 showMessages(d);
 const latest=d.messages.filter(m=>m.direction==='customer'&&!m.read_at).at(-1);
 if(latest){await api('staffRead',{clientId:id,before:latest.created_at});await refresh();}
}
async function openThread(id){
 if(thread!==id){thread=id;replyKey=null;replyBody.value='';replyStatus.textContent='';}
 selectView('inbox');
 await readThread(id);
 threadTitle.focus({preventScroll:true});
 threadTitle.scrollIntoView?.({block:'start'});
 status.textContent='';
}
async function refresh(){
 const d=await api('staffList');
 if(!owner())return;
 const unread=d.clients.reduce((total,c)=>total+(Number(c.unread)||0),0);
 if(badge){badge.hidden=!unread;badge.textContent=unread>99?'99+':String(unread);badge.setAttribute('aria-label','Непрочитанных: '+unread);}
 if(button)button.textContent='Сообщения клиентов'+(unread?' · '+unread:'');
 if(!clients)return;
 stats.textContent='Подписаны на новости: '+d.subscribers+' · Подписчики с push: '+d.pushDevices;
 const snapshot=JSON.stringify([thread,d.clients]);
 if(snapshot===clientSnapshot)return;
 const focused=document.activeElement?.dataset.clientThread;
 clientSnapshot=snapshot;clients.replaceChildren();
 const sorted=[...d.clients].sort((a,b)=>Number(!!b.unread)-Number(!!a.unread)||Number(!!b.last_message)-Number(!!a.last_message));
 for(const c of sorted){
  const li=node('li'),b=node('button',null,'work-thread-choice');
  b.type='button';b.dataset.clientThread=c.id;b.setAttribute('aria-pressed',String(thread===c.id));
  b.append(node('strong',c.name||'Клиент '+c.id.slice(0,8)),node('small',c.last_message||'Переписка ещё не началась'));
  if(c.unread){b.dataset.unread='true';b.append(node('span','Новых: '+c.unread,'work-thread-unread'));}
  b.onclick=()=>run(()=>openThread(c.id));li.append(b);clients.append(li);
  if(c.id===focused)b.focus({preventScroll:true});
 }
 if(!d.clients.length)clients.append(node('li','Здесь появятся обращения из меню «Связь с UMMA».'));
}
async function refreshView(){
 if(view==='audience')await refreshAudience();
 else await refresh();
 status.textContent='';
}
function build(){
 if(workspace){workspace.classList.add('umma-connect','work-messages');}
 else{dialog=node('dialog',null,'umma-connect');dialog.setAttribute('aria-label','Сообщения клиентов');}
 const section=root(),header=node('header',null,'work-messages-heading');
 if(dialog){
  const close=node('button','Закрыть','connect-close');close.type='button';close.onclick=()=>dialog.close();header.append(close);
 }
 const heading=node(workspace?'h1':'h2','Сообщения клиентов');
 const refreshButton=node('button','Обновить');refreshButton.type='button';refreshButton.onclick=()=>run(refreshView);
 header.append(heading,refreshButton);
 const nav=node('nav',null,'work-section-switch');nav.setAttribute('aria-label','Разделы связи с клиентами');
 panels={inbox:node('section',null,'work-inbox'),audience:buildAudience(),campaign:node('section',null,'work-campaign')};
 viewButtons={};
 for(const [key,label] of [['inbox','Входящие'],['audience','Посетители'],['campaign','Рассылки']]){
  const tab=node('button',label);tab.type='button';tab.onclick=()=>run(async()=>{selectView(key);await refreshView();});
  viewButtons[key]=tab;nav.append(tab);
 }
 stats=node('p');clients=node('ol',null,'work-inbox-list');
 const form=node('form'),title=node('input'),body=node('textarea'),language=node('select');title.required=true;title.maxLength=100;body.required=true;body.maxLength=2000;
 for(const [v,t]of [['ru','Русский'],['en','English'],['vi','Tiếng Việt'],['ko','한국어'],['zh','中文'],['de','Deutsch'],['fr','Français'],['th','ไทย'],['ms','Bahasa Melayu'],['id','Bahasa Indonesia'],['ar','العربية'],['pt','Português'],['all','Все языки']]){const o=node('option',t);o.value=v;language.append(o);}
 language.value='all';
 const installedOnly=node('input');installedOnly.type='checkbox';
 const installedLabel=label('Только установившие приложение и включившие push',installedOnly);installedLabel.className='connect-check';
 const publicNews=node('input');publicNews.type='checkbox';publicNews.defaultChecked=true;
 const publicLabel=label('Показать всем в меню',publicNews);publicLabel.className='connect-check';
 const updatePublic=()=>{publicNews.disabled=installedOnly.checked||language.value!=='all';};
 language.addEventListener('change',updatePublic);installedOnly.addEventListener('change',updatePublic);
 const preview=node('section');preview.hidden=true;const previewTitle=node('h3'),previewBody=node('p'),previewWho=node('p'),confirm=node('button','Опубликовать','primary'),cancel=node('button','Изменить');confirm.type=cancel.type='button';preview.append(previewTitle,previewBody,previewWho,confirm,cancel);
 const submit=node('button','Проверить рассылку');submit.type='submit';
 form.append(node('h3','Акции, новинки и напоминания'),node('p','Публикацию в меню увидят все посетители. Сообщение в чат и push получат подписчики. Чтобы показать акцию всем, выберите «Все языки» и снимите ограничение по установке.'),label('Язык получателей',language),installedLabel,publicLabel,label('Заголовок',title),label('Сообщение',body),submit,preview);
 const resetPreview=()=>{preview.hidden=true;submit.hidden=false;campaign=null;};form.addEventListener('input',resetPreview);cancel.onclick=resetPreview;
 form.onsubmit=e=>{e.preventDefault();campaign={requestKey:crypto.randomUUID(),title:title.value.trim(),body:body.value.trim(),language:language.value,installedOnly:installedOnly.checked,publicNews:publicNews.checked&&!installedOnly.checked&&language.value==='all'};confirm.textContent=campaign.publicNews?'Опубликовать и отправить подписчикам':'Отправить подписчикам';previewTitle.textContent=campaign.title;previewBody.textContent=campaign.body;previewWho.textContent=(campaign.publicNews?'В меню увидят все. ':'')+'Получатели рассылки: '+language.selectedOptions[0].textContent+(campaign.installedOnly?' · только установили приложение и включили push':'')+'. После отправки отозвать push с телефона нельзя.';preview.hidden=false;submit.hidden=true;};
 confirm.onclick=()=>run(async()=>{if(!campaign)return;const d=await api('staffCampaign',campaign);status.textContent=(campaign.publicNews?'Опубликовано в меню. ':'')+'Сообщение добавлено в переписку '+d.recipients+' клиентам. Фоновая доставка выполняется для устройств с разрешёнными уведомлениями.';resetPreview();form.reset();language.value='all';updatePublic();});
 threadTitle=node('h2','Выберите переписку');threadTitle.tabIndex=-1;messages=node('ol',null,'connect-thread');
 replyForm=node('form');replyForm.hidden=true;replyBody=node('textarea');replyBody.required=true;replyBody.maxLength=2000;
 replyBody.addEventListener('input',()=>{replyKey=null;replyStatus.textContent='';});
 const send=node('button','Отправить ответ','primary');send.type='submit';
 replyStatus=node('p');replyStatus.setAttribute('role','status');
 replyForm.append(label('Ответ',replyBody),send,replyStatus);
 replyForm.onsubmit=e=>{
  e.preventDefault();
  const body=replyBody.value.trim();
  if(!thread||!body)return;
  replyKey=replyKey||crypto.randomUUID();
  void run(async()=>{
   const d=await api('staffReply',{clientId:thread,requestKey:replyKey,body});
   if(replyBody.value.trim()===body){replyBody.value='';replyKey=null;}
   showMessages(d);
   replyStatus.textContent=d.client.pushEnabled?'Ответ отправлен в чат. Уведомление поставлено в очередь.':'Ответ отправлен в чат. У клиента выключены уведомления об ответах.';
   void refresh().catch(()=>{});
  },replyStatus);
 };
 const threadPanel=node('section',null,'work-thread');threadPanel.append(threadTitle,messages,replyForm);
 const listPanel=node('section',null,'work-inbox-sidebar');listPanel.append(node('h2','Переписки'),clients);
 panels.inbox.append(listPanel,threadPanel);panels.campaign.append(stats,form);
 section.append(header,nav,status,...Object.values(panels));selectView('inbox');
 if(dialog){document.body.append(dialog);dialog.addEventListener('close',()=>button.focus());}
}
function owner(){return window.ummaRole==='super_admin'||window.ummaUser?.role==='super_admin';}
function openInbox(){
 if(!panels)build();
 if(workspace)selectView('inbox');
 if(dialog&&!dialog.open)dialog.showModal();
 void run(refreshView);
}
if(button)button.onclick=openInbox;
function syncVisibility(){
 if(button){button.hidden=!owner();if(button.hidden&&dialog?.open)dialog.close();}
}
async function poll(){
 if(!owner()||polling||busy||document.hidden||(!workspace&&!visible()))return;
 polling=true;
 try{
  await refresh();
  if(visible()&&view==='inbox'&&thread&&!busy)await readThread(thread,true);
 }catch{}finally{polling=false;}
}
document.addEventListener('umma:staff-tab',e=>{if(e.detail==='messages'&&owner())openInbox();});
document.addEventListener('umma:staff-ready',()=>{syncVisibility();void poll();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void poll();});
setInterval(()=>{syncVisibility();void poll();},15000);
syncVisibility();
})();
