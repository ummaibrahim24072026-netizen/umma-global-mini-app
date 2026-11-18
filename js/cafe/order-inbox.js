/* Persistent order updates with optional sound, installed-app badge and Web Push. */
(()=>{'use strict';const storeKey='umma:order-inbox:v1';let data={states:{},messages:[],readAt:0},translate=x=>(window.ummaMenuI18n?.t||window.ummaI18n?.t||(s=>s))(x);
try{const saved=JSON.parse(localStorage.getItem(storeKey)||'null');if(saved&&saved.states&&Array.isArray(saved.messages))data=saved;}catch{}
const inboxCopy={"ru": ["Мои сообщения", "Закрыть", "Здесь появятся обновления ваших заказов."], "en": ["Order updates", "Close", "Order updates will appear here."], "vi": ["Thông báo", "Đóng", "Thông tin cập nhật đơn hàng sẽ xuất hiện ở đây."], "ko": ["주문 알림", "닫기", "주문 업데이트가 여기에 표시됩니다."], "zh": ["订单消息", "关闭", "订单更新将在此显示。"], "de": ["Bestellmeldungen", "Schließen", "Hier erscheinen Neuigkeiten zu Ihren Bestellungen."], "fr": ["Mes notifications", "Fermer", "Les mises à jour de vos commandes apparaîtront ici."], "th": ["แจ้งเตือนคำสั่งซื้อ", "ปิด", "ข้อมูลอัปเดตคำสั่งซื้อจะแสดงที่นี่"], "ms": ["Kemas kini pesanan", "Tutup", "Kemas kini pesanan anda akan muncul di sini."], "id": ["Notifikasi pesanan", "Tutup", "Pembaruan pesanan Anda akan muncul di sini."], "ar": ["إشعارات الطلبات", "إغلاق", "ستظهر تحديثات طلباتك هنا."], "pt": ["Notificações", "Fechar", "As atualizações dos seus pedidos aparecerão aqui."]};
const ui=()=>inboxCopy[document.documentElement.lang.split('-')[0]]||inboxCopy.en;
const labels={batch_ready_unpaid:'Блюда приготовились — оплатите предзаказ',batch_ready:'Блюда приготовились — собираем ваш предзаказ',pending:'Заказ отправлен',confirmed:'Заказ принят',preparing:'Готовится',ready:'Заказ готов',completed:'Заказ выдан',cancelled:'Заказ отменён',waiting_courier:'Ищем курьера',courier_assigned:'Курьер назначен',picked_up:'Курьер в пути',delivered:'Заказ доставлен',paid:'Оплачено',awaiting_payment:'Ожидаем подтверждение оплаты',refunded:'Возвращено'};
const host=document.getElementById('orderInboxHost'),inHub=!!host?.closest('#customerMessages');
const navigation=inHub?window.ummaCafeNavigation:null;
const inPublicMenu=inHub||!!host?.closest('.customer-actions');
const inboxTitle=()=>inHub&&document.documentElement.lang.split('-')[0]==='ru'?'Уведомления о заказах':ui()[0];
const button=document.createElement('button');button.type='button';button.className='umma-inbox-button';if(!inPublicMenu)button.style.cssText='min-height:44px;padding:10px 14px;border:1px solid #cfac52;border-radius:12px;background:#007c80;color:white;font:700 14px system-ui;white-space:normal';button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','ummaOrderInboxDialog');(host||document.querySelector('header')||document.body).append(button);
function save(){data.messages=data.messages.slice(-100);const ids=new Set(data.messages.map(m=>m.orderId));for(const id of Object.keys(data.states))if(!ids.has(id))delete data.states[id];try{localStorage.setItem(storeKey,JSON.stringify(data));}catch{}render();}
function render(){
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
const inboxStyles=`
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
 const groups=new Map();
 for(const message of data.messages){
  const group=groups.get(message.orderId)||{number:message.orderId,values:new Set(),messages:[]};
  if(message.number)group.number=message.number;
  group.values.add(message.value);
  group.messages.push(message);
  group.at=message.at;
  groups.set(message.orderId,group);
 }
 const language=document.documentElement.lang.split('-')[0];
 const fragment=document.createDocumentFragment();
 for(const [id,group] of [...groups].sort((a,b)=>b[1].at-a[1].at)){
  const state=data.states[id];
  const {values}=group;
  if(state?.status)values.add(state.status);
  if(state?.delivery)values.add(state.delivery);
  const delivery=state?.orderType==='delivery'||deliveryStates.some(key=>values.has(key));
  const cancelled=values.has('cancelled');
  const courier=deliveryStates.findLast(key=>values.has(key));
  const finished=values.has(delivery?'delivered':'completed');
  const progress=orderStages.findLastIndex(key=>values.has(key));
  const kitchen=courier==='picked_up'||finished?Math.max(progress,3):progress;
  const awaitingPayment=inPublicMenu&&state?.payment==='pending'&&state.status==='pending';
  const stages=[
   ['pending',awaitingPayment?'current':kitchen>=0?'done':'future',awaitingPayment?'awaiting_payment':'pending'],
   ['confirmed',kitchen>=1?'done':'future'],
   ['preparing',kitchen>=3?'done':kitchen===2?'current':'future'],
   ['ready',kitchen>=3?'done':'future']
  ];
  if(delivery)stages.push(['picked_up',finished?'done':courier==='picked_up'||(kitchen>=3&&courier)?'current':'future',courier||'picked_up']);
  stages.push([cancelled?'cancelled':delivery?'delivered':'completed',cancelled?'cancelled':finished?'done':'future']);
  const row=document.createElement('li');
  row.className='umma-inbox-order';
  const number=document.createElement('strong');
  number.className='umma-inbox-number';
  number.textContent='№'+group.number;
  number.title=[...new Map(group.messages.map(message=>[message.value,message])).values()]
   .sort((a,b)=>a.at-b.at)
   .map(message=>translate(labels[message.value==='pending'&&awaitingPayment?'awaiting_payment':message.value])+' · '+new Date(message.at).toLocaleString())
   .join('\n');
  const timeline=document.createElement('ol');
  timeline.className='umma-inbox-stages';
  timeline.setAttribute('role','list');
  const activeStage=stages.find(([,value])=>value==='current')?.[0]||orderStages[kitchen];
  for(const [key,status,description=key] of stages){
   const stage=document.createElement('li');
   stage.className='umma-inbox-stage is-'+(cancelled&&status==='current'?'future':status);
   if(key===activeStage&&!finished&&!cancelled)stage.setAttribute('aria-current','step');
   const dot=document.createElement('span');
   dot.className='umma-inbox-dot';
   if(status==='done'||status==='cancelled')dot.setAttribute('role','img');
   else dot.setAttribute('aria-hidden','true');
   dot.textContent=status==='done'?'✓':status==='cancelled'?'×':status==='current'&&!cancelled?'•':'';
   const label=document.createElement('span');
   label.textContent=description==='awaiting_payment'?translate('Оплата'):(description==='picked_up'&&status==='current'?inTransit[language]:'')||
    shortLabels[language]?.[stageKeys.indexOf(key)]||translate(labels[description]);
   label.title=translate(labels[description]);
   stage.append(dot,label);
   timeline.append(stage);
  }
  row.append(number,timeline);
  fragment.append(row);
 }
 list.replaceChildren(fragment);
 list.hidden=groups.size===0;
 list.previousElementSibling.hidden=groups.size>0;
}
function createInbox(){
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
 close.onclick=()=>navigation?navigation.back('messages'):dialog.close();
 const heading=document.createElement('h2');
 heading.id='ummaOrderInboxTitle';
 heading.textContent=inboxTitle();
 heading.style.cssText='margin:0 48px 0 0;min-height:44px;display:grid;align-items:center;font-size:1.25rem';
 const empty=document.createElement('p');
 empty.textContent=ui()[2];
 const list=document.createElement('ol');
 list.className='umma-inbox-orders';
 list.setAttribute('role','list');
 if(navigation){
  const header=document.createElement('div'),body=document.createElement('div');
  header.className='checkout-header';
  body.className='checkout-body';
  close.className='close';
  close.dataset.customerBack='messages';
  close.onclick=null;
  close.removeAttribute('style');
  heading.removeAttribute('style');
  heading.tabIndex=-1;
  header.append(heading,close);
  body.append(empty,list);
  dialog.append(styles,header,body);
  dialog.classList.add('customer-view');
  dialog.hidden=true;
  dialog.setAttribute('role','region');
 }else dialog.append(styles,close,heading,empty,list);
 function enter(){
  if(window.ummaOrderAlerts?.controls)(dialog.querySelector('.checkout-body')||dialog).append(window.ummaOrderAlerts.controls);
  data.readAt=Math.max(Date.now(),...data.messages.map(m=>m.at));
  save();
 }
 function leave(){
  const controls=window.ummaOrderAlerts?.controls;
  if(controls)(document.getElementById('syncState')?.parentNode||document.body).append(controls);
  dialog.remove();
 }
 if(navigation){
  document.getElementById('customerContent').append(dialog);
  dialog.addEventListener('umma:sectionenter',enter);
  dialog.addEventListener('umma:sectionleave',leave);
 }else{
  document.body.append(dialog);
  dialog.addEventListener('close',leave);
  dialog.showModal();
  enter();
 }
 return dialog;
}
if(navigation)navigation.register('inbox',null,createInbox);
function open(){
 if(navigation){navigation.go('inbox');return;}
 if(!document.querySelector('dialog[data-umma-inbox][open]'))createInbox();
}
button.onclick=open;
window.addEventListener('umma-menu:languagechange',render);window.ummaOrderInbox={publish,open,reset(){data={states:{},messages:[],readAt:0};save();if(navigation?.view()==='inbox')navigation.go('messages',{replace:true});else document.querySelector('dialog[data-umma-inbox]')?.close();}};render();
})();
