/* Persistent order updates with optional sound, installed-app badge and Web Push. */
(()=>{'use strict';const storeKey='umma:order-inbox:v1';let data={states:{},messages:[],readAt:0},translate=x=>(window.ummaMenuI18n?.t||window.ummaI18n?.t||(s=>s))(x);
// Polling and push can report the same milestone hours apart.
const eventValue=value=>value==='green_delivered'?'delivered':value;
const messageKey=(orderId,value)=>JSON.stringify([orderId,eventValue(value)]);
try{
 const saved=JSON.parse(localStorage.getItem(storeKey)||'null');
 if(saved?.states&&Array.isArray(saved.messages)){
  const unique=new Map();
  for(const message of saved.messages){
   const key=messageKey(message.orderId,message.value);
   const previous=unique.get(key);
   if(!previous||message.at<previous.at)unique.set(key,message);
  }
  data={...saved,messages:[...unique.values()].sort((a,b)=>a.at-b.at)};
  if(data.messages.length!==saved.messages.length)localStorage.setItem(storeKey,JSON.stringify(data));
 }
}catch{}
const inboxCopy={"ru": ["Мои сообщения", "Закрыть", "Здесь появятся обновления ваших заказов."], "en": ["Order updates", "Close", "Order updates will appear here."], "vi": ["Thông báo", "Đóng", "Thông tin cập nhật đơn hàng sẽ xuất hiện ở đây."], "ko": ["주문 알림", "닫기", "주문 업데이트가 여기에 표시됩니다."], "zh": ["订单消息", "关闭", "订单更新将在此显示。"], "de": ["Bestellmeldungen", "Schließen", "Hier erscheinen Neuigkeiten zu Ihren Bestellungen."], "fr": ["Mes notifications", "Fermer", "Les mises à jour de vos commandes apparaîtront ici."], "th": ["แจ้งเตือนคำสั่งซื้อ", "ปิด", "ข้อมูลอัปเดตคำสั่งซื้อจะแสดงที่นี่"], "ms": ["Kemas kini pesanan", "Tutup", "Kemas kini pesanan anda akan muncul di sini."], "id": ["Notifikasi pesanan", "Tutup", "Pembaruan pesanan Anda akan muncul di sini."], "ar": ["إشعارات الطلبات", "إغلاق", "ستظهر تحديثات طلباتك هنا."], "pt": ["Notificações", "Fechar", "As atualizações dos seus pedidos aparecerão aqui."]};
const ui=()=>inboxCopy[document.documentElement.lang.split('-')[0]]||inboxCopy.en;
const greenStages=['booked','assigned','arrived','picked_up','delivered'];
const greenLabels={
 ru:['Курьер вызван','Курьер назначен','Курьер прибыл','Курьер забрал заказ','Заказ доставлен','Отследить доставку'],
 en:['Courier booked','Courier assigned','Courier arrived','Courier collected the order','Delivered','Track delivery'],
 vi:['Đã đặt tài xế','Đã có tài xế','Tài xế đã đến','Tài xế đã lấy hàng','Đã giao hàng','Theo dõi giao hàng'],
};
function greenTracking(value){
 if(typeof value!=='string'||!/^https:\/\/(?:[a-z0-9-]+\.)?(?:greensm\.com|xanhsm\.com)\/[a-z0-9][^\s\\]*$/i.test(value))return null;
 return new URL(value).href;
}
const labels={green_booked:'Курьер вызван',green_assigned:'Курьер назначен',green_arrived:'Курьер прибыл',green_picked_up:'Курьер забрал заказ',green_delivered:'Заказ доставлен',batch_ready_unpaid:'Блюда приготовились — оплатите предзаказ',batch_ready:'Блюда приготовились — собираем ваш предзаказ',pending:'Заказ отправлен',confirmed:'Заказ принят',preparing:'Готовится',ready:'Заказ готов',completed:'Заказ выдан',cancelled:'Заказ отменён',waiting_courier:'Ищем курьера',courier_assigned:'Курьер назначен',picked_up:'Курьер в пути',delivered:'Заказ доставлен',paid:'Оплачено',awaiting_payment:'Ожидаем подтверждение оплаты',refunded:'Возвращено'};
const host=document.getElementById('orderInboxHost'),messagesSection=host?.closest('#customerMessages'),inHub=!!messagesSection;
const inPublicMenu=inHub||!!host?.closest('.customer-actions');
const inboxTitle=()=>inHub&&document.documentElement.lang.split('-')[0]==='ru'?'Уведомления':ui()[0];
const button=document.createElement('button');button.type='button';button.className='umma-inbox-button';if(!inPublicMenu)button.style.cssText='min-height:44px;padding:10px 14px;border:1px solid #cfac52;border-radius:12px;background:#007c80;color:white;font:700 14px system-ui;white-space:normal';button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','ummaOrderInboxDialog');(host||document.querySelector('header')||document.body).append(button);
function save(feedChanged=true){data.messages=data.messages.slice(-100);const ids=new Set(data.messages.map(m=>m.orderId));for(const id of Object.keys(data.states))if(!ids.has(id))delete data.states[id];try{localStorage.setItem(storeKey,JSON.stringify(data));}catch{}render(feedChanged);}
const chatCopy={
 ru:{order:'Заказ',detail:'Детали заказа',expand:'Показать этапы',collapse:'Скрыть этапы',timeline:'Этапы заказа',done:'Пройден',upcoming:'Впереди',
  pending:'Заказ оформлен',confirmed:'Кафе приняло заказ',preparing:'Готовится на кухне',ready:'Заказ готов',completed:'Заказ выдан',
  waiting_courier:'Ищем курьера',courier_assigned:'Курьер назначен',picked_up:'Курьер забрал заказ',delivered:'Заказ доставлен',
  cancelled:'Заказ отменён',paid:'Оплата подтверждена',awaiting_payment:'Ожидается оплата',refunded:'Оплата возвращена'},
 en:{order:'Order',detail:'Order details',expand:'Show stages',collapse:'Hide stages',timeline:'Order stages',done:'Complete',upcoming:'Upcoming',
  pending:'Order placed',confirmed:'Accepted by the cafe',preparing:'In the kitchen',ready:'Order ready',completed:'Order collected',
  waiting_courier:'Finding a courier',courier_assigned:'Courier assigned',picked_up:'Courier picked up the order',delivered:'Order delivered',
  cancelled:'Order cancelled',paid:'Payment confirmed',awaiting_payment:'Awaiting payment',refunded:'Payment refunded'},
 vi:{order:'Đơn hàng',detail:'Chi tiết đơn',expand:'Xem các bước',collapse:'Ẩn các bước',timeline:'Các bước của đơn hàng',done:'Đã xong',upcoming:'Sắp tới',
  pending:'Đã đặt hàng',confirmed:'Quán đã nhận đơn',preparing:'Đang chuẩn bị',ready:'Đơn đã sẵn sàng',completed:'Đã nhận hàng',
  waiting_courier:'Đang tìm tài xế',courier_assigned:'Đã có tài xế',picked_up:'Tài xế đã lấy hàng',delivered:'Đã giao hàng',
  cancelled:'Đơn đã hủy',paid:'Đã xác nhận thanh toán',awaiting_payment:'Chờ thanh toán',refunded:'Đã hoàn tiền'}
};
const deliveryMilestones=['waiting_courier','courier_assigned','picked_up','delivered'];
function orderTimeline(messages,state,copy,greenCopy,clock,id){
 const events=new Map(messages.map(message=>[eventValue(message.value),message.at]));
 const cancelled=state.status==='cancelled'||events.has('cancelled');
 const cancelledAt=events.get('cancelled');
 if(cancelledAt!==undefined){
  for(const [key,at] of events)if(key!=='refunded'&&at>cancelledAt)events.delete(key);
 }
 const green=state.greenOrder===true||greenStages.includes(state.greenStage)||
  greenStages.some(stage=>events.has('green_'+stage));
 const delivery=green||state.orderType==='delivery'||deliveryMilestones.some(key=>events.has(key)||state.delivery===key);
 const stages=['pending','confirmed','preparing','ready'];
 if(green)stages.push('green_booked','green_picked_up','delivered');
 else if(delivery)stages.push('courier_assigned','picked_up','delivered');
 else stages.push('completed');

 const reached=new Set(events.keys());
 if(!cancelled){
  reached.add(state.status).add(state.delivery).add(state.payment);
  if(state.greenStage)reached.add(eventValue('green_'+state.greenStage));
 }
 if(reached.has('green_assigned')||reached.has('green_arrived'))reached.add('green_booked');
 const lastReached=stages.findLastIndex(key=>reached.has(key));
 const finished=cancelled||state.status==='completed'||reached.has('completed')||reached.has('delivered');
 const findingCourier=!finished&&!green&&lastReached===stages.indexOf('ready')&&reached.has('waiting_courier');
 if(findingCourier)stages[lastReached+1]='waiting_courier';
 const current=findingCourier?'waiting_courier':stages[lastReached];
 const payment=reached.has('paid')||reached.has('refunded')?'paid':'awaiting_payment';
 const showPayment=payment==='paid'||(!finished&&['pending','awaiting_payment'].includes(state.payment));
 const paymentAt=events.get('paid');
 const paymentAfter=Math.max(0,Math.min(lastReached,stages.indexOf('ready'),
  paymentAt===undefined?1:stages.findLastIndex(key=>events.get(key)<=paymentAt)));
 const timeline=document.createElement('ol');
 timeline.id='umma-order-stages-'+id;
 timeline.className='umma-order-stages';
 timeline.setAttribute('role','list');
 timeline.setAttribute('aria-label',copy.timeline);
 const text=key=>key==='green_booked'?greenCopy[0]:key==='green_picked_up'?greenCopy[3]:copy[key];

 function addStep(key,kind,at){
  const row=document.createElement('li');
  row.className='umma-order-stage';
  row.dataset.stage=key;
  row.dataset.state=kind;
  if(kind==='current'||kind==='cancelled')row.setAttribute('aria-current','step');
  const marker=document.createElement('span');
  marker.className='umma-order-stage-marker';
  if(kind==='done')marker.textContent='✓';
  if(kind==='cancelled')marker.textContent='×';
  if(kind==='done'||kind==='upcoming'){
   marker.setAttribute('role','img');
   marker.setAttribute('aria-label',copy[kind]);
  }else marker.setAttribute('aria-hidden','true');
  const name=document.createElement('span');
  name.className='umma-order-stage-name';
  name.textContent=text(key);
  row.append(marker,name);
  if(Number.isFinite(at)){
   const time=document.createElement('time');
   const date=new Date(at);
   time.dateTime=date.toISOString();
   time.title=date.toLocaleString(clock.resolvedOptions().locale);
   time.textContent=clock.format(date);
   row.append(time);
  }
  timeline.append(row);
 }

 const addPayment=()=>addStep(payment,payment==='paid'?'done':'upcoming',paymentAt);
 if(showPayment&&lastReached===-1)addPayment();
 for(const [index,key] of stages.entries()){
  if(!finished||index<=lastReached){
   const kind=!finished&&key===current?'current':index<=lastReached?'done':'upcoming';
   addStep(key,kind,events.get(key));
  }
  if(showPayment&&index===paymentAfter&&lastReached>=0)addPayment();
 }
 if(cancelled)addStep('cancelled','cancelled',events.get('cancelled'));
 if(reached.has('refunded'))addStep('refunded','done',events.get('refunded'));
 const greenStatus=greenCopy[greenStages.indexOf(state.greenStage)];
 const status=cancelled?copy.cancelled:reached.has('delivered')?copy.delivered:
  greenStatus||(reached.has('completed')?copy.completed:text(current)||copy.pending);
 return {timeline,status,finished,cancelled};
}
// The chat refreshes its DOM when messages arrive, so keep disclosure state on the thread.
let stagePreferences=new WeakMap();
function renderChatFeed(list,openOrderId){
 if(!list)return;
 let preferences=stagePreferences.get(list);
 if(!preferences){
  preferences=new Map();
  stagePreferences.set(list,preferences);
 }
 list.querySelectorAll('.umma-chat-order-card').forEach(card=>card.remove());
 let targetCard;
 const language=document.documentElement.lang.split('-')[0];
 const copy=chatCopy[language]||chatCopy.en;
 const greenCopy=greenLabels[language]||greenLabels.en;
 const clock=new Intl.DateTimeFormat(language,{hour:'2-digit',minute:'2-digit'});
 const groups=new Map();
 for(const message of data.messages){
  if(!groups.has(message.orderId))groups.set(message.orderId,[]);
  groups.get(message.orderId).push(message);
 }
 for(const id of preferences.keys())if(!groups.has(id))preferences.delete(id);
 for(const [id,messages] of groups){
  const state=data.states[id]||{};
  const {timeline,status,finished,cancelled}=orderTimeline(messages,state,copy,greenCopy,clock,id);
  const card=document.createElement('li');
  card.className='umma-chat-order-card';
  card.dataset.orderId=id;
  if(finished)card.classList.add('umma-chat-order-card--finished');
  if(cancelled)card.classList.add('umma-chat-order-card--cancelled');

  const header=document.createElement('div');
  header.className='umma-chat-order-header';
  const title=document.createElement('strong');
  title.textContent=copy.order+' №'+(messages.at(-1).number||id);
  const statusLine=document.createElement('span');
  statusLine.className='umma-chat-order-status';
  statusLine.textContent=status;
  header.append(title,statusLine);

  const detail=document.createElement('button');
  detail.type='button';
  detail.className='umma-chat-order-action';
  detail.textContent=copy.detail;
  detail.onclick=()=>window.dispatchEvent(new CustomEvent('umma:open-specific-order',{detail:{orderId:id}}));
  const actions=[detail];
  const trackingUrl=!cancelled&&greenTracking(state.trackingUrl);
  if(trackingUrl){
   const tracking=document.createElement('a');
   tracking.className='umma-chat-order-action';
   tracking.textContent=greenCopy[5];
   tracking.href=trackingUrl;
   tracking.target='_blank';
   tracking.rel='noopener noreferrer';
   actions.push(tracking);
  }

  const selected=id===openOrderId;
  if(selected)targetCard=card;
  const toggle=document.createElement('button');
  toggle.type='button';
  toggle.className='umma-chat-order-toggle';
  toggle.setAttribute('aria-controls',timeline.id);
  const showStages=expanded=>{
   toggle.setAttribute('aria-expanded',String(expanded));
   toggle.textContent=expanded?copy.collapse:copy.expand;
   timeline.hidden=!expanded;
   for(const action of actions)action.hidden=!expanded;
  };
  showStages(preferences.get(id)??(selected||!finished));
  toggle.onclick=()=>{
   const expanded=timeline.hidden;
   preferences.set(id,expanded);
   showStages(expanded);
  };
  card.append(header,toggle,timeline,...actions);
  // Order updates belong in the chronological chat stream, never in a pinned footer.
  const orderTime=Number(messages[0].at)||0;
  card.dataset.timelineAt=String(orderTime);
  const chatMessages=[...list.children].filter(node=>!node.classList.contains('umma-chat-order-card'));
  const nextMessage=chatMessages.find(node=>{
    const time=node.querySelector('time[datetime]')?.dateTime||node.dataset.createdAt;
    return time&&Date.parse(time)>orderTime;
  });
  if(nextMessage)list.insertBefore(card,nextMessage);
  else list.append(card);
 }
 if(inHub&&list.closest('#customerChatDialog[open]'))markChatRead();
 return targetCard;
}
function markChatRead(){
 if(document.hidden)return;
 const latest=data.messages.at(-1)?.at;
 if(!(latest>data.readAt))return;
 data.readAt=latest;
 // Refresh the counters without rebuilding the order cards that just rendered.
 save(false);
}
document.addEventListener('visibilitychange',()=>{
 if(inHub&&document.getElementById('customerChatDialog')?.open)markChatRead();
});
function render(feedChanged=true){
 if(feedChanged)window.dispatchEvent(new Event('umma:order-feed-change'));
 const list=document.querySelector('dialog[data-umma-inbox][open] .umma-inbox-orders');
 if(list)renderOrders(list);
 const unread=data.messages.filter(m=>m.at>data.readAt).length;
 window.ummaOrderAlerts?.badge(unread);
 button.textContent=(inPublicMenu?'':'🔔 ')+inboxTitle()+(unread&&!inHub?' · '+unread:'');
 if(inHub){
  button.dataset.unread=String(unread);
  window.dispatchEvent(new Event('umma:messages-count'));
 }
}
function publish(order,t=null){
 if(t)translate=t;
 const id=String(order.orderNumber||order.number||order.id);
 const number=String(order.orderNumber||order.number||'');
 const at=Date.parse(order.eventAt)||Date.now();
 const event=order.eventId;
 data.events=data.events||[];
 if(event&&data.events.includes(event))return;
 const old=data.states[id];
 const next={
  greenStage:order.greenSmStage===undefined?old?.greenStage:order.greenSmStage,
  greenOrder:order.isGreenSm===undefined?old?.greenOrder:order.isGreenSm,
  trackingUrl:order.greenSmTrackingUrl===undefined?old?.trackingUrl:greenTracking(order.greenSmTrackingUrl),
  status:order.status||order.orderStatus||old?.status,
  payment:order.paymentStatus??old?.payment,
  delivery:order.deliveryStatus||order.state||old?.delivery,
  preorder:order.preorderWaiting??old?.preorder,
  orderType:order.orderType||old?.orderType,
  _at:at,
 };
 const changes=[];
 if(next.greenStage!==old?.greenStage&&greenStages.includes(next.greenStage))changes.push('green_'+next.greenStage);
 const batchReady=event?order.changes?.preorder==='batch_ready':old?.preorder===true&&next.preorder===false;
 if(batchReady)changes.push(next.status==='pending'&&next.payment!=='paid'?'batch_ready_unpaid':'batch_ready');
 for(const key of ['status','payment','delivery']){
  const value=event?order.changes?.[key]:next[key];
  if(value&&labels[value]&&(event||value!==old?.[key])&&(key!=='payment'||['paid','refunded'].includes(value)))changes.push(value);
 }
 const known=new Set(data.messages.filter(m=>m.orderId===id).map(m=>eventValue(m.value)));
 let added=0;
 for(const value of changes){
  const milestone=eventValue(value);
  if(known.has(milestone))continue;
  known.add(milestone);
  data.messages.push({orderId:id,number,value,at});
  added++;
 }
 if(!old||at>=(old._at||0))data.states[id]=next;
 if(event)data.events=[...data.events,event].slice(-200);
 data.messages.sort((a,b)=>a.at-b.at);
 const shouldSound=old&&added>0&&at>data.readAt;
 save();
 if(shouldSound)window.ummaOrderAlerts?.sound();
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
dialog.umma-inbox-fixed-header #ummaOrderInboxTitle:focus{outline:none}
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
  const finished=values.has('cancelled')||values.has('completed')||values.has('delivered')||values.has('green_delivered')||state?.greenStage==='delivered';
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
   back.onclick=()=>{
    dialog.close();
    if(!messagesSection.open){
     if(window.ummaCustomerConnect?.open)void window.ummaCustomerConnect.open();
     else messagesSection.show();
     window.dispatchEvent(new Event('umma:order-inbox-visibility'));
    }
   };
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
   if(focus===document.body||dialog.contains(focus)){
    document.getElementById('customerMessagesButton')?.focus({preventScroll:true});
   }
   window.dispatchEvent(new Event('umma:order-inbox-visibility'));
  }
 });
 if(inPublicMenu&&brandTemplate){
  dialog.show();
  if(messagesSection)messagesSection.inert=true;
  heading.focus({preventScroll:true});
  if(inHub)window.dispatchEvent(new Event('umma:order-inbox-visibility'));
 }else dialog.showModal();
 data.readAt=Math.max(Date.now(),...data.messages.map(m=>m.at));
 save();
}
button.onclick=()=>{if(window.ummaCustomerConnect?.open)window.ummaCustomerConnect.open();else open();};
if(inHub){button.hidden=true;button.setAttribute('aria-hidden','true');}
window.addEventListener('umma-menu:languagechange',render);window.ummaOrderInbox={publish,open,renderChatFeed,reset(){stagePreferences=new WeakMap();data={states:{},messages:[],readAt:0};save();document.querySelector('dialog[data-umma-inbox]')?.close();}};render();
})();
