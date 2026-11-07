/* Owner-only inbox and explicit, previewed broadcasts. Authorization is enforced server-side. */
(()=>{'use strict';
const API='https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-connect';
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
let dialog=null,busy=false,thread=null,replyKey=null,campaign=null;
const button=node('button','Клиенты и рассылки','umma-connect-button');button.type='button';button.hidden=true;button.setAttribute('aria-haspopup','dialog');
(document.querySelector('.web-account-menu > div')||document.querySelector('header')||document.body).append(button);
const credential=()=>window.ummaStaffAuth?.credential?.()||window.Telegram?.WebApp?.initData||'';
async function api(action,data={}){const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',signal:AbortSignal.timeout(20000),body:JSON.stringify({action,initData:credential(),...data})});const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'Нет связи с кафе');return d;}
const status=node('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
let clients,stats,messages,replyForm,replyBody,threadTitle;
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
   contact.onclick=()=>run(async()=>{await openThread(guest.client_id);threadTitle.scrollIntoView({block:'start'});});
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
async function run(fn){if(busy)return;busy=true;dialog?.querySelectorAll('button').forEach(b=>b.disabled=true);status.textContent='Загрузка…';try{await fn();}catch(e){status.textContent=e.message;}finally{busy=false;dialog?.querySelectorAll('button').forEach(b=>b.disabled=false);}}
function showMessages(data){messages.replaceChildren();for(const m of data.messages||[]){const li=node('li');li.dataset.direction=m.direction;li.append(node('strong',m.direction==='customer'?'Клиент':m.title||'UMMA'),node('div',m.body),node('small',new Date(m.created_at).toLocaleString('ru-RU')));messages.append(li);}threadTitle.textContent=data.client.name||'Клиент '+data.client.id.slice(0,8);replyForm.hidden=false;}
async function openThread(id){thread=id;replyKey=null;replyBody.value='';const d=await api('staffThread',{clientId:id});showMessages(d);const latest=d.messages.filter(m=>m.direction==='customer'&&!m.read_at).at(-1);if(latest)await api('staffRead',{clientId:id,before:latest.created_at});status.textContent='';}
async function refresh(){const d=await api('staffList');stats.textContent='Открыли связь с кафе: '+d.total+' · Подписаны на новости: '+d.subscribers+' · Подписчики с push: '+d.pushDevices;clients.replaceChildren();let unread=0;for(const c of d.clients){unread+=Number(c.unread)||0;const li=node('li'),b=node('button',(c.name||'Клиент '+c.id.slice(0,8))+' · '+c.language+(c.unread?' · новых: '+c.unread:''));b.type='button';b.onclick=()=>run(()=>openThread(c.id));li.append(b,node('small',c.last_message||'Переписка ещё не началась'));clients.append(li);}if(!d.clients.length)clients.append(node('li','Подписавшиеся клиенты появятся здесь.'));button.textContent='Клиенты и рассылки'+(unread?' · '+unread:'');status.textContent='';}
async function refreshDashboard(){await refresh();await refreshAudience();status.textContent='';}
function build(){
 dialog=node('dialog',null,'umma-connect');dialog.setAttribute('aria-label','Клиенты и рассылки');
 const close=node('button','Закрыть','connect-close');close.type='button';close.onclick=()=>dialog.close();stats=node('p');clients=node('ol');
 const refreshButton=node('button','Обновить данные');refreshButton.type='button';refreshButton.onclick=()=>run(refreshDashboard);
 const form=node('form'),title=node('input'),body=node('textarea'),language=node('select');title.required=true;title.maxLength=100;body.required=true;body.maxLength=2000;
 for(const [v,t]of [['ru','Русский'],['en','English'],['vi','Tiếng Việt'],['ko','한국어'],['zh','中文'],['de','Deutsch'],['fr','Français'],['th','ไทย'],['ms','Bahasa Melayu'],['id','Bahasa Indonesia'],['ar','العربية'],['pt','Português'],['all','Все подписчики']]){const o=node('option',t);o.value=v;language.append(o);}
 const installedOnly=node('input');installedOnly.type='checkbox';
 const installedLabel=label('Только установившие приложение и включившие push',installedOnly);installedLabel.className='connect-check';
 const preview=node('section');preview.hidden=true;const previewTitle=node('h3'),previewBody=node('p'),previewWho=node('p'),confirm=node('button','Отправить подписчикам','primary'),cancel=node('button','Изменить');confirm.type=cancel.type='button';preview.append(previewTitle,previewBody,previewWho,confirm,cancel);
 const submit=node('button','Проверить рассылку');submit.type='submit';
 form.append(node('h3','Акции, новинки и напоминания'),node('p','Сообщение получат только клиенты с включённой подпиской на новости. Перевод текста не автоматический — выберите соответствующий язык.'),label('Язык получателей',language),installedLabel,label('Заголовок',title),label('Сообщение',body),submit,preview);
 const resetPreview=()=>{preview.hidden=true;submit.hidden=false;campaign=null;};form.addEventListener('input',resetPreview);cancel.onclick=resetPreview;
 form.onsubmit=e=>{e.preventDefault();campaign={requestKey:crypto.randomUUID(),title:title.value.trim(),body:body.value.trim(),language:language.value,installedOnly:installedOnly.checked};previewTitle.textContent=campaign.title;previewBody.textContent=campaign.body;previewWho.textContent='Получатели: '+language.selectedOptions[0].textContent+(campaign.installedOnly?' · только установили приложение и включили push':'')+'. После отправки отозвать push с телефона нельзя.';preview.hidden=false;submit.hidden=true;};
 confirm.onclick=()=>run(async()=>{if(!campaign)return;const d=await api('staffCampaign',campaign);status.textContent='Сообщение добавлено в переписку '+d.recipients+' клиентам. Фоновая доставка выполняется для устройств с разрешёнными уведомлениями.';resetPreview();form.reset();});
 threadTitle=node('h3','Переписка с клиентом');messages=node('ol',null,'connect-thread');replyForm=node('form');replyForm.hidden=true;replyBody=node('textarea');replyBody.required=true;replyBody.maxLength=2000;replyBody.addEventListener('input',()=>replyKey=null);const send=node('button','Отправить сообщение','primary');send.type='submit';replyForm.append(label('Ответ',replyBody),send);
 replyForm.onsubmit=e=>{e.preventDefault();if(!thread||!replyBody.value.trim())return;replyKey=replyKey||crypto.randomUUID();void run(async()=>{const d=await api('staffReply',{clientId:thread,requestKey:replyKey,body:replyBody.value.trim()});replyBody.value='';replyKey=null;showMessages(d);status.textContent='Ответ сохранён и поставлен в очередь уведомлений, если они включены у клиента.';});};
 dialog.append(close,node('h2','Клиенты и рассылки'),buildAudience(),node('hr'),stats,refreshButton,clients,threadTitle,messages,replyForm,node('hr'),form,status);document.body.append(dialog);dialog.addEventListener('close',()=>button.focus());
}
button.onclick=()=>{if(!dialog)build();if(!dialog.open)dialog.showModal();void run(refreshDashboard);};
function owner(){return window.ummaRole==='super_admin'||window.ummaUser?.role==='super_admin';}
function visibility(){button.hidden=!owner()||!!document.getElementById('webWorkspace')?.hidden;if(button.hidden&&dialog?.open)dialog.close();}
setInterval(()=>{visibility();if(dialog?.open&&!busy&&!document.hidden)void run(async()=>{await refresh();if(thread){const d=await api('staffThread',{clientId:thread});showMessages(d);}});},15000);
document.addEventListener('umma:staff-tab',visibility);visibility();const workspace=document.getElementById('webWorkspace');if(workspace)new MutationObserver(visibility).observe(workspace,{attributes:true,attributeFilter:['hidden']});
})();
