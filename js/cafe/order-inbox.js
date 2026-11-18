/* Persistent order updates with optional sound, installed-app badge and Web Push. */
(()=>{'use strict';const storeKey='umma:order-inbox:v1';let data={states:{},messages:[],readAt:0},translate=x=>(window.ummaMenuI18n?.t||window.ummaI18n?.t||(s=>s))(x);
try{const saved=JSON.parse(localStorage.getItem(storeKey)||'null');if(saved&&saved.states&&Array.isArray(saved.messages))data=saved;}catch{}
const inboxCopy={"ru": ["Мои сообщения", "Закрыть", "Здесь появятся обновления ваших заказов."], "en": ["Order updates", "Close", "Order updates will appear here."], "vi": ["Thông báo", "Đóng", "Thông tin cập nhật đơn hàng sẽ xuất hiện ở đây."], "ko": ["주문 알림", "닫기", "주문 업데이트가 여기에 표시됩니다."], "zh": ["订单消息", "关闭", "订单更新将在此显示。"], "de": ["Bestellmeldungen", "Schließen", "Hier erscheinen Neuigkeiten zu Ihren Bestellungen."], "fr": ["Mes notifications", "Fermer", "Les mises à jour de vos commandes apparaîtront ici."], "th": ["แจ้งเตือนคำสั่งซื้อ", "ปิด", "ข้อมูลอัปเดตคำสั่งซื้อจะแสดงที่นี่"], "ms": ["Kemas kini pesanan", "Tutup", "Kemas kini pesanan anda akan muncul di sini."], "id": ["Notifikasi pesanan", "Tutup", "Pembaruan pesanan Anda akan muncul di sini."], "ar": ["إشعارات الطلبات", "إغلاق", "ستظهر تحديثات طلباتك هنا."], "pt": ["Notificações", "Fechar", "As atualizações dos seus pedidos aparecerão aqui."]};
const ui=()=>inboxCopy[document.documentElement.lang.split('-')[0]]||inboxCopy.en;
const labels={batch_ready_unpaid:'Блюда приготовились — оплатите предзаказ',batch_ready:'Блюда приготовились — собираем ваш предзаказ',pending:'Заказ отправлен',confirmed:'Заказ принят',preparing:'Готовится',ready:'Заказ готов',completed:'Заказ выдан',cancelled:'Заказ отменён',waiting_courier:'Ищем курьера',courier_assigned:'Курьер назначен',picked_up:'Курьер в пути',delivered:'Заказ доставлен',paid:'Оплачено',awaiting_payment:'Ожидаем подтверждение оплаты',refunded:'Возвращено'};
const host=document.getElementById('orderInboxHost'),messagesSection=host?.closest('#customerMessages'),inHub=!!messagesSection;
const inPublicMenu=inHub||!!host?.closest('.customer-actions');
const inboxTitle=()=>inHub&&document.documentElement.lang.split('-')[0]==='ru'?'Уведомления':ui()[0];
const button=document.createElement('button');button.type='button';button.className='umma-inbox-button';if(!inPublicMenu)button.style.cssText='min-height:44px;padding:10px 14px;border:1px solid #cfac52;border-radius:12px;background:#007c80;color:white;font:700 14px system-ui;white-space:normal';button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','ummaOrderInboxDialog');(host||document.querySelector('header')||document.body).append(button);
function save(){data.messages=data.messages.slice(-100);const ids=new Set(data.messages.map(m=>m.orderId));for(const id of Object.keys(data.states))if(!ids.has(id))delete data.states[id];try{localStorage.setItem(storeKey,JSON.stringify(data));}catch{}render();}
// Render order status cards inside the existing UMMA chat, without a second inbox screen.
function renderChatFeed(list){
 if(!list)return;
 list.querySelectorAll('.umma-chat-order-card').forEach(node=>node.remove());
 const language=document.documentElement.lang.split('-')[0];
 const dictionary={ru:{order:'Заказ',detail:'Детали заказа',cancel:'Отменён',steps:['Принят','Готовится','Готов','Курьер','Доставлен'],pickup:['Принят','Готовится','Готов','Выдан']},en:{order:'Order',detail:'Order details',cancel:'Cancelled',steps:['Accepted','Preparing','Ready','Courier','Delivered'],pickup:['Accepted','Preparing','Ready','Collected']},vi:{order:'Đơn hàng',detail:'Chi tiết đơn',cancel:'Đã hủy',steps:['Đã nhận','Đang nấu','Đã xong','Tài xế','Đã giao'],pickup:['Đã nhận','Đang nấu','Đã xong','Đã lấy']}};
 const copy=dictionary[language]||dictionary.en;
 const groups=new Map();
 for(const m of data.messages){const group=groups.get(m.orderId)||[];group.push(m);groups.set(m.orderId,group);}
 for(const [id,messages] of [...groups].sort((a,b)=>a[1].at(-1).at-b[1].at(-1).at)){
  const state=data.states[id]||{},values=new Set(messages.map(m=>m.value));
  const delivery=state.orderType==='delivery'||['waiting_courier','courier_assigned','picked_up','delivered'].some(v=>values.has(v)||state.delivery===v);
  const steps=delivery?copy.steps:copy.pickup;
  const cancelled=state.status==='cancelled'||values.has('cancelled');
  const status=state.delivery==='delivered'?'delivered':state.status||messages.at(-1).value;
  const stage=cancelled?0:status==='completed'||status==='delivered'?steps.length:status==='ready'?3:status==='preparing'?2:status==='confirmed'||status==='pending'?1:1;
  const progress=delivery&&(state.delivery==='courier_assigned'||state.delivery==='waiting_courier')?3:delivery&&state.delivery==='picked_up'?4:stage;
  const card=document.createElement('li');card.className='umma-chat-order-card';card.dataset.orderId=id;
  card.style.cssText='list-style:none;display:grid;gap:10px;max-width:100%;width:100%;padding:14px;border:1px solid #c9e2df;border-radius:18px;background:#f5fbfa;color:#153b39;box-sizing:border-box;overflow-wrap:anywhere';
  const head=document.createElement('strong');head.textContent=copy.order+' №'+(messages.at(-1).number||id);
  const statusLine=document.createElement('div');statusLine.textContent=cancelled?copy.cancel:(labels[state.delivery]||labels[status]||status);statusLine.style.cssText='font-size:13px;color:#137b7c;font-weight:650';
  const progressBar=document.createElement('div');progressBar.style.cssText='display:grid;grid-template-columns:repeat('+steps.length+',minmax(0,1fr));gap:4px';
  for(let i=0;i<steps.length;i++){const segment=document.createElement('span');segment.style.cssText='height:7px;border-radius:99px;background:'+(i<progress&&!cancelled?'#0a9b9b':'#d9e9e7');progressBar.append(segment);}
  const stageLabels=document.createElement('div');stageLabels.style.cssText='display:flex;justify-content:space-between;gap:4px;font-size:10px;color:#55716e';
  const first=document.createElement('span');first.textContent=steps[0];const last=document.createElement('span');last.textContent=steps.at(-1);stageLabels.append(first,last);
  const latest=document.createElement('time');latest.style.cssText='font-size:11px;color:#647c7a';latest.dateTime=new Date(messages.at(-1).at).toISOString();latest.textContent=new Date(messages.at(-1).at).toLocaleString(language);
  const detail=document.createElement('button');detail.type='button';detail.textContent=copy.detail;detail.style.cssText='border:1px solid #0a9b9b;border-radius:999px;padding:10px 12px;background:#fff;color:#087c80;font:700 13px system-ui;cursor:pointer';
  detail.onclick=()=>window.dispatchEvent(new CustomEvent('umma:open-specific-order',{detail:{orderId:String(id)}}));
  card.append(head,statusLine,progressBar,stageLabels,latest,detail);
  // Order updates belong in the chronological chat stream, never in a pinned footer.
  const orderTime=Number(messages.at(-1).at)||0;
  card.dataset.timelineAt=String(orderTime);
  const chatMessages=[...list.children].filter(node=>!node.classList.contains('umma-chat-order-card'));
  const nextMessage=chatMessages.find(node=>{
    const time=node.querySelector('time[datetime]')?.dateTime||node.dataset.createdAt;
    return time&&Date.parse(time)>orderTime;
  });
  if(nextMessage)list.insertBefore(card,nextMessage);
  else list.append(card);
 }
}
function render(){
 const list=document.querySelector('dialog[data-umma-inbox][open] .umma-inbox-orders');
 if(list)renderOrders(list);
 const unread=data.messages.filter(m=>m.at>data.readAt).length;
 window.ummaOrderAlerts?.badge(unread);
 window.dispatchEvent(new Event('umma:order-feed-change'));
 button.textContent=(inPublicMenu?'':'🔔 ')+inboxTitle()+(unread&&!inHub?' · '+unread:'');
 if(inHub){
  button.dataset.unread=String(unread);
  window.dispatchEvent(new Event('umma:messages-count'));
 }
}
function publish(order,t=null){if(t)translate=t;
 const id=String(order.orderNumber||order.number||order.id),number=String(order.orderNumber||order.number||''),at=Date.parse(order.eventAt)||Date.now(),event=order.eventId;
 data.events=data.events||[];if(event&&data.events.includes(event))return;
 const next={status:order.status||order.orderStatus,payment:order.paymentStatus,delivery:order.deliveryStatus||order.state,preorder:order.preorderWaiting,orderType:order.orderType||data.states[id]?.orderType,_at:at},old=data.states[id];let added=0;
 const changes=[];if(event?order.changes?.preorder==='batch_ready':old?.preorder===true&&next.preorder===false)changes.push(next.status==='pending'&&next.payment!=='paid'?'batch_ready_unpaid':'batch_ready');for(const key of ['status','payment','delivery']){const value=event?order.changes?.[key]:next[key];if(value&&labels[value]&&(event||!old||value!==old[key])&&(key!=='payment'||['paid','refunded'].includes(value)))changes.push(value);}
 for(const value of new Set(changes)){if(data.messages.some(m=>m.orderId===id&&m.value===value&&Math.abs(m.at-at)<30000))continue;data.messages.push({orderId:id,number,value,at});added++;}
 if(!old||at>=(old._at||0))data.states[id]=next;
 if(event)data.events=[...data.events,event].slice(-200);data.messages.sort((a,b)=>a.at-b.at);save();
 if(old&&added>0&&at>data.readAt)window.ummaOrderAlerts?.sound();
}
const orderStages=['pending','confirmed','preparing','ready','completed'];
const deliveryStates=['waiting_courier','courier_assigned','picked_up','delivered'];
const shortLabels={
 ru:['Отправка','Принят','Кухня','Готов','Курьер','Выдан','Вручён','Отменён'],
 en:['Sent','Accepted','Cooking','Ready','Courier','Pickup','Delivered','Cancelled'],
 vi:['Đã gửi','Đã nhận','Đang nấu','Đã xong','Tài xế','Đã lấy','Đã giao','Đã hủy']
};
const inTransit={ru:'В пути',en:'On the way',vi:'Đang giao'};
const stageKeys=['pending','confirmed','preparing','ready','picked_up','completed','delivered','cancelled'];
let inboxHistory=false;
const inboxStyles=`
.umma-inbox-event{list-style:none;margin:0 0 10px}.umma-inbox-event-button{width:100%;display:grid;gap:7px;text-align:left;background:#fff;border:1px solid #c9e2df;border-radius:18px;padding:15px;color:#153b39;cursor:pointer;font:inherit}.umma-inbox-event-button strong{font-size:15px}.umma-inbox-event-button time{font-size:12px;color:#647c7a}.umma-inbox-event-hint{color:#078f91;font-weight:700;font-size:13px}.umma-inbox-event-button:focus-visible{outline:3px solid #0aa3a4;outline-offset:2px}

.umma-inbox-tabs{display:flex;gap:8px;margin-bottom:12px}.umma-inbox-tabs button{flex:1;min-height:42px;border:1px solid #b9d8d4;border-radius:14px;background:#fff;color:#164d4b;font-weight:700}.umma-inbox-tabs button[aria-selected=true]{background:#0aa3a4;color:#fff;border-color:#0aa3a4}
.umma-inbox-meta{font-size:12px;color:#637b79;font-weight:500;white-space:nowrap}.umma-inbox-order{grid-template-columns:minmax(0,1fr)!important;gap:10px!important}.umma-inbox-order-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.umma-inbox-orders:empty{display:none}

/* The order list scrolls beneath an opaque, stationary heading. */
dialog.umma-inbox-fixed-header{display:flex;flex-direction:column;overflow:hidden;max-height:calc(100dvh - 120px);padding:0!important}
dialog.umma-inbox-fixed-header:not([open]){display:none}
dialog.umma-inbox-fixed-header>.checkout-header{position:relative;top:auto;flex:0 0 auto;z-index:5;background:#f4faf9;isolation:isolate;border-radius:20px 20px 0 0;padding:16px 20px;box-shadow:0 2px 8px #153b3910}
dialog.umma-inbox-fixed-header>.checkout-header .customer-heading-copy{min-width:0}
dialog.umma-inbox-fixed-header>.checkout-header h2{margin:0;max-width:none}
dialog.umma-inbox-fixed-header>.checkout-body{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:16px 20px 24px;scrollbar-gutter:stable}
.umma-inbox-orders,.umma-inbox-stages{list-style:none;margin:0;padding:0}
.umma-inbox-order{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:start;gap:6px;padding:12px 0;border-bottom:1px solid #d9e8e4}
.umma-inbox-number{font-size:12px;line-height:20px;color:#153b39;white-space:nowrap}
.umma-inbox-stages{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr)}
.umma-inbox-stage{position:relative;display:grid;justify-items:center;align-content:start;gap:4px;color:#51686a;font-size:clamp(10px,2.7vw,12px);line-height:1.15;text-align:center;overflow-wrap:anywhere}
.umma-inbox-stage:not(:first-child)::before{content:'';position:absolute;inset-inline-end:50%;top:9px;width:100%;height:2px;background:#cfdfdc}
.umma-inbox-stage.is-done::before,.umma-inbox-stage[aria-current]::before{background:#71b9af}
.umma-inbox-dot{position:relative;z-index:1;display:grid;place-items:center;box-sizing:border-box;width:20px;height:20px;border:2px solid #c3d7d3;border-radius:50%;background:#f4faf9;font:700 12px system-ui}
.umma-inbox-stage.is-done .umma-inbox-dot{border-color:#087970;background:#087970;color:white}
.umma-inbox-stage[aria-current]{color:#005d57;font-weight:700}
.umma-inbox-stage[aria-current]:not(.is-done) .umma-inbox-dot{border-color:#087970;color:#087970}
.umma-inbox-stage.is-cancelled{color:#a12b39;font-weight:700}
.umma-inbox-stage.is-cancelled .umma-inbox-dot{border-color:#bd4653;background:#fff0f1}
`;

function renderOrders(list){
 const language=document.documentElement.lang.split('-')[0];
 const groups=new Map();
 for(const message of data.messages){
  const group=groups.get(message.orderId)||{number:message.orderId,values:new Set(),messages:[]};
  if(message.number)group.number=message.number;
  group.values.add(message.value);
  group.messages.push(message);
  groups.set(message.orderId,group);
 }
 const fragment=document.createDocumentFragment();
 let visible=0;
 const dateLabel=at=>new Date(at).toLocaleString(language,{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
 const openOrder=id=>window.dispatchEvent(new CustomEvent('umma:open-specific-order',{detail:{orderId:String(id)}}));
 for(const [id,group] of [...groups].sort((a,b)=>Math.max(...b[1].messages.map(m=>m.at))-Math.max(...a[1].messages.map(m=>m.at)))){
  const state=data.states[id],values=group.values;
  if(state?.status)values.add(state.status);
  if(state?.delivery)values.add(state.delivery);
  const finished=values.has('cancelled')||values.has('completed')||values.has('delivered');
  if(finished!==inboxHistory)continue;
  for(const message of [...group.messages].reverse()){
   visible++;
   const item=document.createElement('li');item.className='umma-inbox-event';
   const action=document.createElement('button');action.type='button';action.className='umma-inbox-event-button';
   const title=document.createElement('strong');title.textContent='№'+group.number+' · '+translate(labels[message.value]||message.value);
   const date=document.createElement('time');date.dateTime=new Date(message.at).toISOString();date.textContent=dateLabel(message.at);
   const hint=document.createElement('span');hint.className='umma-inbox-event-hint';hint.textContent=({ru:'Посмотреть заказ ›',en:'View order ›',vi:'Xem đơn hàng ›'}[language]||'View order ›');
   action.append(title,date,hint);action.onclick=()=>openOrder(id);
   item.append(action);fragment.append(item);
  }
 }
 list.replaceChildren(fragment);list.hidden=visible===0;
 const empty=list.parentElement.querySelector('.umma-inbox-empty');
 if(empty){empty.hidden=visible>0;empty.textContent=visible?'':inboxHistory?({ru:'Нет завершённых уведомлений.',en:'No completed updates.',vi:'Chưa có thông báo hoàn tất.'}[language]||'No completed updates.'):ui()[2];}
}

function open(){
 if(document.querySelector('dialog[data-umma-inbox][open]'))return;
 const dialog=document.createElement('dialog');
 dialog.dataset.ummaInbox='';
 dialog.id='ummaOrderInboxDialog';
 dialog.setAttribute('aria-labelledby','ummaOrderInboxTitle');
 dialog.style.cssText='box-sizing:border-box;width:min(94vw,560px);max-height:80vh;border:1px solid #cfac52;border-radius:20px;padding:14px;color:#153b39;background:#f4faf9';
 const styles=document.createElement('style');
 styles.textContent=inboxStyles;
 const close=document.createElement('button');
 close.type='button';
 close.textContent='✕';
 close.setAttribute('aria-label',ui()[1]);
 close.style.cssText='float:inline-end;width:44px;height:44px;min-height:44px;border:1px solid #c8dbd8;border-radius:12px;background:white;color:#145354';
 close.onclick=()=>dialog.close();
 const heading=document.createElement('h2');
 heading.id='ummaOrderInboxTitle';
 heading.textContent=inboxTitle();
 heading.style.cssText='margin:0 48px 0 0;min-height:44px;display:grid;align-items:center;font-size:1.25rem';
 const empty=document.createElement('p');empty.className='umma-inbox-empty';
 empty.textContent=ui()[2];
 const tabs=document.createElement('div');tabs.className='umma-inbox-tabs';tabs.setAttribute('role','tablist');
 const tabLabels=({ru:['Активные','История'],en:['Active','History'],vi:['Đang xử lý','Lịch sử']})[document.documentElement.lang.split('-')[0]]||['Active','History'];
 for(let i=0;i<2;i++){const tab=document.createElement('button');tab.type='button';tab.textContent=tabLabels[i];tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(inboxHistory===Boolean(i)));tab.onclick=()=>{inboxHistory=Boolean(i);for(const item of tabs.children)item.setAttribute('aria-selected',String(item===tab));renderOrders(list);};tabs.append(tab);}
 const list=document.createElement('ol');
 list.className='umma-inbox-orders';
 list.setAttribute('role','list');
 const brandTemplate=document.getElementById('customerHeadingTemplate');
 if(inPublicMenu&&brandTemplate){
  const header=document.createElement('div');
  header.className='checkout-header';
  dialog.classList.add('customer-section');
  dialog.setAttribute('closedby','closerequest');
  dialog.removeAttribute('style');
  close.className='close';
  close.removeAttribute('style');
  heading.tabIndex=-1;
  const brandHeading=brandTemplate.content.firstElementChild.cloneNode(true);
  heading.removeAttribute('style');
  brandHeading.querySelector('.customer-heading-copy').append(heading);
  // The inbox is a nested screen: Back returns to the Messages hub.
  if(inHub){
   const back=document.createElement('button');
   back.type='button';
   back.className='umma-notifications-back';
   back.textContent=document.documentElement.lang.startsWith('ru')?'← Назад':document.documentElement.lang.startsWith('vi')?'← Quay lại':'← Back';
   back.setAttribute('aria-label',back.textContent.replace(/^←\\s*/, ''));
   back.onclick=()=>dialog.close();
   header.append(back);
  }
  header.append(brandHeading);
  dialog.classList.add('umma-inbox-fixed-header');
  const body=document.createElement('div');
  body.className='checkout-body';
  body.append(tabs,empty,list);
  if(window.ummaOrderAlerts?.controls)body.append(window.ummaOrderAlerts.controls);
  dialog.append(styles,header,body);
 }else{
  dialog.append(styles,close,heading,tabs,empty,list);
  if(window.ummaOrderAlerts?.controls)dialog.append(window.ummaOrderAlerts.controls);
 }
 document.body.append(dialog);
 dialog.addEventListener('close',()=>{
  const controls=window.ummaOrderAlerts?.controls;
  if(controls&&dialog.contains(controls))(document.getElementById('syncState')?.parentNode||document.body).append(controls);
  const focus=document.activeElement;
  dialog.remove();
  if(messagesSection&&!document.querySelector('dialog[data-umma-inbox][open]')){
   messagesSection.inert=false;
   if(messagesSection.open&&(focus===document.body||dialog.contains(focus)))button.focus({preventScroll:true});
  }
 });
 if(inPublicMenu&&brandTemplate){
  dialog.show();
  if(messagesSection)messagesSection.inert=true;
  heading.focus({preventScroll:true});
 }else dialog.showModal();
 data.readAt=Math.max(Date.now(),...data.messages.map(m=>m.at));
 save();
}
button.onclick=()=>{if(window.ummaCustomerConnect?.open)window.ummaCustomerConnect.open();else open();};
if(inHub){button.hidden=true;button.setAttribute('aria-hidden','true');}
window.addEventListener('umma-menu:languagechange',render);window.ummaOrderInbox={publish,open,renderChatFeed,reset(){data={states:{},messages:[],readAt:0};save();document.querySelector('dialog[data-umma-inbox]')?.close();}};render();
})();
