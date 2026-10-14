/* Signed private inbox. No Telegram credentials or notification text in browser storage. */
(() => {
 'use strict';
 const endpoint='https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-my-orders';
 const byId=id=>document.getElementById(id);
 let busy=false,readBusy=false,actor=null,known=new Set(),items=[],generation=0,loaded=false,dialog=null;
 async function api(payload){
  const initData=window.Telegram?.WebApp?.initData;
  if(!initData)throw Error('Откройте приложение через Telegram');
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',signal:AbortSignal.timeout(12000),body:JSON.stringify({...payload,initData})});
  const result=await response.json();if(!response.ok||!result.ok)throw Error(result.error||'Нет связи с кафе');return result;
 }
 function online(value){const el=byId('cafeLiveConnection');if(el){el.textContent=value?'Онлайн':'Связь прервана';el.setAttribute('aria-label',value?'Онлайн: автоматическое обновление включено':'Связь прервана: повторяем подключение');el.dataset.online=String(value);}}
 function apply(result){
  const incoming=result.notifications||[];
  const fresh=incoming.filter(n=>!known.has(n.id));
  items=incoming;incoming.forEach(n=>known.add(n.id));
  if(known.size>500)known=new Set([...known].slice(-300));
  const count=Number(result.unreadCount)||0,badge=byId('cafeNotificationCount'),bell=byId('cafeNotificationBell');
  badge.textContent=count>99?'99+':String(count);badge.hidden=count===0;
  const navBadge=byId('navNotificationCount');if(navBadge){navBadge.textContent=badge.textContent;navBadge.hidden=count===0;}
  bell.setAttribute('aria-label','Уведомления: '+count+' непрочитанных');
  if(loaded&&fresh.length){
   const status=byId('cafeNotificationAnnouncement');status.textContent=fresh[0].title;
   document.dispatchEvent(new CustomEvent('umma:cafe-events',{detail:{events:fresh}}));
   if(typeof showToast==='function')showToast(fresh[0].title);
   try{window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.('success');}catch{}
  }
  loaded=true;online(true);render();
 }
 async function refresh(){
  if(document.hidden||busy)return;
  const id=window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
  const root=byId('cafeNotificationBar');if(!root)return;
  const signed=!!id&&!!window.Telegram?.WebApp?.initData;root.hidden=false;
  byId('cafeNotificationBell').hidden=!signed;byId('cafeLiveConnection').hidden=!signed;
  if(!signed){if(actor!==null){actor=null;known.clear();items=[];loaded=false;generation++;dialog?.close();}return;}
  if(actor!==id){actor=id;known.clear();items=[];loaded=false;generation++;byId('cafeNotificationCount').hidden=true;}
  const current=generation;busy=true;
  try{const result=await api({action:'notifications'});if(current===generation)apply(result);}
  catch{if(current===generation)online(false);}
  finally{busy=false;}
 }
 function render(){
  if(!dialog?.open)return;
  const list=dialog.querySelector('[data-notification-list]');list.replaceChildren();
  if(!items.length){const p=document.createElement('p');p.textContent='Новых событий пока нет';list.append(p);}
  for(const n of items){
   const button=document.createElement('button');button.type='button';button.className='cafe-notification-item';button.dataset.unread=String(!n.read_at);
   const title=document.createElement('span');title.textContent=n.title;
   const time=document.createElement('small');time.textContent=new Date(n.created_at).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
   button.append(title,time);button.onclick=()=>{dialog.close();if(n.workspace==='courier')window.ummaKitchen?.open(true);else if(n.workspace==='staff')window.ummaKitchen?.open();else{window.ummaCafe?.open();const section=byId('cafeMyOrdersSection');if(section)section.hidden=false;window.ummaCafe?.refreshMyOrders({silent:true});}read([n.id]);};list.append(button);
  }
 }
 async function read(ids){
  if(readBusy||!ids.length)return;readBusy=true;const current=++generation;
  try{const result=await api({action:'readNotifications',ids});if(current===generation)apply(result);}
  catch{online(false);}
  finally{readBusy=false;}
 }
 byId('cafeNotificationBell')?.addEventListener('click',()=>{
  if(!dialog){dialog=document.createElement('dialog');dialog.className='cafe-notifications-dialog';dialog.setAttribute('aria-label','Уведомления UMMA Cafe');
   const close=document.createElement('button');close.type='button';close.className='cafe-back';close.textContent='← Назад';close.onclick=()=>dialog.close();
   const title=document.createElement('h2');title.textContent='Уведомления';
   const list=document.createElement('div');list.dataset.notificationList='';
   const seen=document.createElement('button');seen.type='button';seen.className='kitchen-action';seen.textContent='Отметить показанные как прочитанные';seen.onclick=()=>read(items.filter(n=>!n.read_at).map(n=>n.id));
   dialog.append(close,title,list,seen);document.body.append(dialog);
  }
  dialog.onclose=()=>byId("cafeNotificationBell")?.focus();dialog.showModal();render();refresh();
 });
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 window.addEventListener('online',refresh);
 window.setInterval(refresh,2000);
 window.ummaNotifications={refresh,isOpen:()=>dialog?.open===true,close:()=>dialog?.close()};refresh();
})();
