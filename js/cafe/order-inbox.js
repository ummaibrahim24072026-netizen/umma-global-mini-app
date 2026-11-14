/* Persistent order updates with optional sound, installed-app badge and Web Push. */
(()=>{'use strict';const storeKey='umma:order-inbox:v1';let data={states:{},messages:[],readAt:0},translate=x=>(window.ummaMenuI18n?.t||window.ummaI18n?.t||(s=>s))(x);
try{const saved=JSON.parse(localStorage.getItem(storeKey)||'null');if(saved&&saved.states&&Array.isArray(saved.messages))data=saved;}catch{}
const inboxCopy={"ru": ["Мои сообщения", "Закрыть", "Здесь появятся обновления ваших заказов."], "en": ["Order updates", "Close", "Order updates will appear here."], "vi": ["Thông báo", "Đóng", "Thông tin cập nhật đơn hàng sẽ xuất hiện ở đây."], "ko": ["주문 알림", "닫기", "주문 업데이트가 여기에 표시됩니다."], "zh": ["订单消息", "关闭", "订单更新将在此显示。"], "de": ["Bestellmeldungen", "Schließen", "Hier erscheinen Neuigkeiten zu Ihren Bestellungen."], "fr": ["Mes notifications", "Fermer", "Les mises à jour de vos commandes apparaîtront ici."], "th": ["แจ้งเตือนคำสั่งซื้อ", "ปิด", "ข้อมูลอัปเดตคำสั่งซื้อจะแสดงที่นี่"], "ms": ["Kemas kini pesanan", "Tutup", "Kemas kini pesanan anda akan muncul di sini."], "id": ["Notifikasi pesanan", "Tutup", "Pembaruan pesanan Anda akan muncul di sini."], "ar": ["إشعارات الطلبات", "إغلاق", "ستظهر تحديثات طلباتك هنا."], "pt": ["Notificações", "Fechar", "As atualizações dos seus pedidos aparecerão aqui."]};
const ui=()=>inboxCopy[document.documentElement.lang.split('-')[0]]||inboxCopy.en;
const labels={batch_ready_unpaid:'Блюда приготовились — оплатите предзаказ',batch_ready:'Блюда приготовились — собираем ваш предзаказ',pending:'Заказ отправлен',confirmed:'Заказ принят',preparing:'Готовится',ready:'Заказ готов',completed:'Заказ выдан',cancelled:'Заказ отменён',waiting_courier:'Ищем курьера',courier_assigned:'Курьер назначен',picked_up:'Курьер в пути',delivered:'Заказ доставлен',paid:'Оплачено',refunded:'Возвращено'};
const button=document.createElement('button');button.type='button';button.className='umma-inbox-button';button.style.cssText='min-height:44px;padding:10px 14px;border:1px solid #cfac52;border-radius:12px;background:#007c80;color:white;font:700 14px system-ui;white-space:normal';button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','ummaOrderInboxDialog');(document.getElementById('orderInboxHost')||document.querySelector('header')||document.body).append(button);
function save(){data.messages=data.messages.slice(-100);const ids=new Set(data.messages.map(m=>m.orderId));for(const id of Object.keys(data.states))if(!ids.has(id))delete data.states[id];try{localStorage.setItem(storeKey,JSON.stringify(data));}catch{}render();}
function render(){const unread=data.messages.filter(m=>m.at>data.readAt).length;window.ummaOrderAlerts?.badge(unread);button.textContent='🔔 '+ui()[0]+(unread?' · '+unread:'');}
function publish(order,t=null){if(t)translate=t;
 const id=String(order.orderNumber||order.number||order.id),number=String(order.orderNumber||order.number||''),at=Date.parse(order.eventAt)||Date.now(),event=order.eventId;
 data.events=data.events||[];if(event&&data.events.includes(event))return;
 const next={status:order.status||order.orderStatus,payment:order.paymentStatus,delivery:order.deliveryStatus||order.state,preorder:order.preorderWaiting,_at:at},old=data.states[id];let added=0;
 const changes=[];if(event?order.changes?.preorder==='batch_ready':old?.preorder===true&&next.preorder===false)changes.push(next.status==='pending'&&next.payment!=='paid'?'batch_ready_unpaid':'batch_ready');for(const key of ['status','payment','delivery']){const value=event?order.changes?.[key]:next[key];if(value&&labels[value]&&(event||!old||value!==old[key])&&(key!=='payment'||['paid','refunded'].includes(value)))changes.push(value);}
 for(const value of new Set(changes)){if(data.messages.some(m=>m.orderId===id&&m.value===value&&Math.abs(m.at-at)<30000))continue;data.messages.push({orderId:id,number,value,at});added++;}
 if(!old||at>=(old._at||0))data.states[id]=next;
 if(event)data.events=[...data.events,event].slice(-200);data.messages.sort((a,b)=>a.at-b.at);save();
 if(old&&added>0&&at>data.readAt)window.ummaOrderAlerts?.sound();
}
const inboxStyles = `
  dialog[data-umma-inbox] {
    width: min(calc(100% - 24px), 510px);
    max-width: none;
    max-height: min(86vh, 660px);
    max-height: min(86dvh, 660px);
    margin: auto;
    padding: 0;
    overflow: hidden;
    border: 1px solid #d3e6e3;
    border-radius: 24px;
    background: #f3f8f7;
    color: #153b39;
    box-shadow: 0 24px 72px #092c3650;
    font: 400 15px/1.4 Inter, system-ui, sans-serif;
  }
  dialog[data-umma-inbox][open] { display: flex; flex-direction: column; }
  dialog[data-umma-inbox]::backdrop { background: #0c30396b; backdrop-filter: blur(4px); }
  .umma-inbox-header {
    display: flex; align-items: center; gap: 12px;
    padding: 16px; background: #fff; border-bottom: 1px solid #dbeae7;
  }
  .umma-inbox-header h2 {
    flex: 1; min-width: 0; margin: 0;
    font-size: clamp(17px, 5vw, 23px); line-height: 1.15; overflow-wrap: anywhere;
  }
  .umma-inbox-icon, .umma-inbox-close {
    display: grid; place-items: center; flex: none;
    width: 44px; height: 44px; border-radius: 14px;
  }
  .umma-inbox-icon { background: #dff3ef; color: #087374; }
  .umma-inbox-icon svg, .umma-inbox-close svg { width: 22px; height: 22px; }
  .umma-inbox-close {
    border: 1px solid #dbeae7; padding: 0; background: #f7faf9; color: #315e59; cursor: pointer;
  }
  .umma-inbox-scroll {
    min-height: 0; padding: 12px 16px 16px;
    overflow-y: auto; overscroll-behavior: contain;
  }
  .umma-inbox-day {
    margin: 10px 0 7px; color: #45645f; font-size: 12px; font-weight: 700;
  }
  .umma-inbox-day:first-child { margin-top: 0; }
  .umma-inbox-list { display: grid; gap: 6px; list-style: none; margin: 0 0 14px; padding: 0; }
  .umma-inbox-list:last-child { margin-bottom: 0; }
  .umma-inbox-row {
    display: grid; grid-template-columns: 36px minmax(0, 1fr) auto; align-items: start; gap: 10px;
    padding: 10px; border: 1px solid #dcebe7; border-radius: 14px; background: #fff;
  }
  .umma-inbox-row .umma-inbox-icon { width: 36px; height: 36px; border-radius: 11px; }
  .umma-inbox-row .umma-inbox-icon svg { width: 18px; height: 18px; }
  .umma-inbox-row[data-tone="success"] .umma-inbox-icon { background: #dcf5e6; color: #176443; }
  .umma-inbox-row[data-tone="progress"] .umma-inbox-icon { background: #fff0ce; color: #815509; }
  .umma-inbox-row[data-tone="cancelled"] .umma-inbox-icon { background: #fce9e7; color: #9b3733; }
  .umma-inbox-row strong { display: block; font-size: 14px; overflow-wrap: anywhere; }
  .umma-inbox-number, .umma-inbox-row time { color: #45645f; font-size: 12px; }
  .umma-inbox-row time { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .umma-inbox-empty { margin: 0; padding: 24px 8px; text-align: center; color: #45645f; }
  .umma-inbox-footer { padding: 0 16px; background: #fff; border-top: 1px solid #dbeae7; }
  .umma-inbox-footer .umma-order-alerts:has(p:empty) { gap: 0 !important; }
  @media (max-height: 420px) {
    .umma-inbox-header { padding-block: 8px; }
  }
`;
const inboxIcons = {
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
  close: 'm6 6 12 12M18 6 6 18',
  check: 'm5 12 4 4L19 6',
  clock: 'M12 8v4l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  truck: 'M3 6h11v11H3zM14 9h4l3 4v4h-7M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z'
};
const statusAppearance = {
  ready: ['success', 'check'], completed: ['success', 'check'],
  delivered: ['success', 'check'], paid: ['success', 'check'],
  batch_ready: ['success', 'check'], batch_ready_unpaid: ['progress', 'clock'],
  preparing: ['progress', 'clock'], waiting_courier: ['progress', 'clock'],
  cancelled: ['cancelled', 'close'], courier_assigned: ['delivery', 'truck'],
  picked_up: ['delivery', 'truck']
};

function inboxElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function inboxIcon(name) {
  const namespace = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(namespace, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const path = document.createElementNS(namespace, 'path');
  path.setAttribute('d', inboxIcons[name]);
  svg.append(path);
  return svg;
}

function renderInboxMessages(scroll) {
  const language = document.documentElement.lang || undefined;
  const dayFormat = new Intl.DateTimeFormat(language, { dateStyle: 'long' });
  const timeFormat = new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' });
  let list;
  let currentDay;
  for (const message of [...data.messages].reverse()) {
    if (!Object.hasOwn(labels, message.value)) continue;
    const date = new Date(message.at);
    if (!Number.isFinite(date.getTime())) continue;
    const day = dayFormat.format(date);
    if (day !== currentDay) {
      currentDay = day;
      list = inboxElement('ul', 'umma-inbox-list');
      list.setAttribute('role', 'list');
      scroll.append(inboxElement('h3', 'umma-inbox-day', day), list);
    }
    const row = inboxElement('li', 'umma-inbox-row');
    const [tone, icon] = statusAppearance[message.value] || ['neutral', 'bell'];
    row.dataset.tone = tone;
    const symbol = inboxElement('span', 'umma-inbox-icon');
    symbol.append(inboxIcon(icon));
    const copy = inboxElement('div');
    copy.append(inboxElement('strong', '', translate(labels[message.value])));
    if (message.number) copy.append(inboxElement('span', 'umma-inbox-number', '№' + message.number));
    const time = inboxElement('time', '', timeFormat.format(date));
    time.dateTime = date.toISOString();
    row.append(symbol, copy, time);
    list.append(row);
  }
  if (!list) scroll.append(inboxElement('p', 'umma-inbox-empty', ui()[2]));
}

function open() {
  if (document.querySelector('dialog[data-umma-inbox][open]')) return;
  if (!document.getElementById('ummaInboxStyles')) {
    const style = inboxElement('style', '', inboxStyles);
    style.id = 'ummaInboxStyles';
    document.head.append(style);
  }
  const dialog = inboxElement('dialog');
  dialog.dataset.ummaInbox = '';
  dialog.id = 'ummaOrderInboxDialog';
  dialog.setAttribute('aria-labelledby', 'ummaInboxTitle');
  const header = inboxElement('header', 'umma-inbox-header');
  const symbol = inboxElement('span', 'umma-inbox-icon');
  symbol.append(inboxIcon('bell'));
  const heading = inboxElement('h2', '', ui()[0]);
  heading.id = 'ummaInboxTitle';
  const close = inboxElement('button', 'umma-inbox-close');
  close.type = 'button';
  close.setAttribute('aria-label', ui()[1]);
  close.autofocus = true;
  close.append(inboxIcon('close'));
  close.onclick = () => dialog.close();
  header.append(symbol, heading, close);

  const scroll = inboxElement('div', 'umma-inbox-scroll');
  scroll.tabIndex = 0;
  renderInboxMessages(scroll);
  dialog.append(header, scroll);
  const controls = window.ummaOrderAlerts?.controls;
  const controlsParent = controls?.parentNode;
  const controlsNext = controls?.nextSibling;
  if (controls) {
    const footer = inboxElement('div', 'umma-inbox-footer');
    footer.append(controls);
    dialog.append(footer);
  }
  dialog.addEventListener('close', () => {
    if (controls && controlsParent) controlsParent.insertBefore(controls, controlsNext?.parentNode === controlsParent ? controlsNext : null);
    dialog.remove();
    if (document.activeElement === document.body) button.focus();
  });
  document.body.append(dialog);
  dialog.showModal();
  data.readAt = Math.max(Date.now(), ...data.messages.map(message => message.at));
  save();
}
button.onclick = open;
window.addEventListener('umma-menu:languagechange',render);window.ummaOrderInbox={publish,open,reset(){data={states:{},messages:[],readAt:0};save();document.querySelector('dialog[data-umma-inbox]')?.close();}};render();
})();
