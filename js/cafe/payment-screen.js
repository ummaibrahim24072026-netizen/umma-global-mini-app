/* The paired device only reads its cashier's current display. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const tokenKey='umma:customer-display-token';
const linkedToken=new URLSearchParams(location.hash.slice(1)).get('screen');
const isToken=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
function savedToken(){
 try{return localStorage.getItem(tokenKey);}catch{return null;}
}
const token=linkedToken===null?savedToken():linkedToken;
const layouts=new Set(['auto','phone','tablet-small','tablet-large','monitor']);
const endpoint='https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-web';
const methods={
 cash:'Наличными · Cash · Tiền mặt',
 qr:'QR Vietcombank',
 rub:'Рубли · RUB',
 sber:'Сбербанк · RUB',
 tenge:'Тенге · KZT',
 kaspi:'Kaspi · KZT',
 usdt:'USDT',
 bank_transfer:'Банковский перевод · Bank transfer',
};
let timer,busy=false,stopped=false,lastQr='',lastItems='';
const translations={
 ru:{received:'Получено',order:'Заказ №',draft:'Ваш заказ',welcome:'Добро пожаловать',total:'К оплате',paid:'Оплачено',orderTotal:'Сумма заказа',change:'Сдача',each:'за шт.',pending:'Ожидает оплаты',inProgress:'Кассир оформляет заказ',closed:'Заказ закрыт',success:'Оплата прошла успешно',cash:'Наличными',rub:'Рубли · RUB',sber:'Сбербанк · RUB',tenge:'Тенге · KZT',kaspi:'Kaspi · KZT',bank_transfer:'Банковский перевод',wait:'Ожидаем заказ от кассира',scan:'Сканируйте QR-код в приложении банка',payCash:'Передайте наличные кассиру',transfer:'Переведите указанную сумму по номеру',cashier:'Ожидайте подтверждения кассира',phone:'Номер для перевода',ask:'Обратитесь к кассиру'},
 en:{received:'Received',order:'Order #',draft:'Your order',welcome:'Welcome',total:'Total to pay',paid:'Paid',orderTotal:'Order total',change:'Change',each:'each',pending:'Awaiting payment',inProgress:'Cashier is preparing your order',closed:'Order closed',success:'Payment successful',cash:'Cash',rub:'Rubles · RUB',sber:'Sberbank · RUB',tenge:'Tenge · KZT',kaspi:'Kaspi · KZT',bank_transfer:'Bank transfer',wait:'Waiting for cashier',scan:'Scan QR with your banking app',payCash:'Pay cash at the counter',transfer:'Transfer the amount to the number shown',cashier:'Waiting for cashier confirmation',phone:'Transfer phone number',ask:'Please ask the cashier'},
 vi:{received:'Đã nhận',order:'Đơn hàng số ',draft:'Đơn hàng của bạn',welcome:'Chào mừng quý khách',total:'Tổng thanh toán',paid:'Đã thanh toán',orderTotal:'Tổng đơn hàng',change:'Tiền thừa',each:'mỗi phần',pending:'Chờ thanh toán',inProgress:'Nhân viên đang nhập đơn',closed:'Đơn hàng đã đóng',success:'Thanh toán thành công',cash:'Tiền mặt',rub:'Rúp · RUB',sber:'Sberbank · RUB',tenge:'Tenge · KZT',kaspi:'Kaspi · KZT',bank_transfer:'Chuyển khoản',wait:'Đang chờ nhân viên',scan:'Quét mã QR bằng ứng dụng ngân hàng',payCash:'Thanh toán tiền mặt tại quầy',transfer:'Chuyển số tiền trên đến số điện thoại',cashier:'Đang chờ nhân viên xác nhận',phone:'Số điện thoại chuyển khoản',ask:'Vui lòng liên hệ nhân viên'}
};
let language='en';
const tr=key=>translations[language][key]||key;
let latestData=null;
const money=v=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(Number(v));
const text=(id,value)=>{
 const node=$(id);
 if(node.textContent!==value)node.textContent=value;
};
function optional(id,value){
 text(id,value);
 $(id).hidden=!value;
}
function amount(order){
 if(order.foreignTotal?.currency==='USDT')return new Intl.NumberFormat('ru',{maximumFractionDigits:6}).format(order.foreignTotal.amount)+' USDT';
 if(['RUB','KZT'].includes(order.foreignTotal?.currency))return new Intl.NumberFormat('ru',{style:'currency',currency:order.foreignTotal.currency}).format(order.foreignTotal.amount);
 return money(order.total);
}
function renderItems(lines=[]){
 const key=language+JSON.stringify(lines);
 $('screenItems').hidden=!lines.length;
 if(key===lastItems){scheduleFit();return;}
 lastItems=key;
 $('screenItems').replaceChildren(...lines.map(line=>{
  const item=document.createElement('li');
  const label=document.createElement('div');
  const name=document.createElement('strong');
  const units=document.createElement('small');
  const total=document.createElement('strong');
  total.className='display-item-price';
  const photo=window.ummaCafeProductPhoto?.(line);
  if(photo){
   const image=document.createElement('img');
   image.className='display-food-photo';image.alt='';image.loading='lazy';image.decoding='async';image.referrerPolicy='no-referrer';
   image.addEventListener('error',()=>{image.remove();item.classList.remove('has-photo');},{once:true});
   image.src=photo;item.classList.add('has-photo');item.append(image);
  }
  name.textContent=line['name_'+language]||line.name_ru||line.name_en||line.name_vi||line.name;
  units.className='display-item-quantity';
  units.textContent=String(line.quantity)+' '+(language==='ru'?(line.quantity%10===1&&line.quantity%100!==11?'порция':line.quantity%10>=2&&line.quantity%10<=4&&(line.quantity%100<12||line.quantity%100>14)?'порции':'порций'):language==='vi'?'phần':line.quantity===1?'portion':'portions');
  total.textContent=money(line.unitPrice*line.quantity);
  label.append(name,units);
  item.append(label,total);
  return item;
 }));
 scheduleFit();
}
function fitOrderToScreen(){
 const list=$('screenItems');const panel=list.closest('.display-order');
 if(!document.body.classList.contains('display-qr-active')||list.hidden){list.style.removeProperty('--item-font');list.style.removeProperty('--item-photo');list.style.removeProperty('--item-pad');list.style.removeProperty('--item-gap');return;}
 const count=list.children.length;
 // Recalculate from a clean baseline after every change of order or viewport.
 list.style.setProperty('--item-font','18px');list.style.setProperty('--item-photo','56px');list.style.setProperty('--item-pad','8px');list.style.setProperty('--item-gap','8px');
 const available=Math.max(0,panel.clientHeight-parseFloat(getComputedStyle(panel).paddingTop)-parseFloat(getComputedStyle(panel).paddingBottom)-$('screenNumber').offsetHeight-8);
 if(!available||!count)return;
 const columns=matchMedia('(orientation: portrait)').matches?2:1;
 const rows=Math.ceil(count/columns);
 const rowBudget=available/rows;
 const font=Math.max(7,Math.min(18,rowBudget*.34));
 const photo=Math.max(0,Math.min(56,rowBudget-3));
 list.style.setProperty('--item-font',font+'px');
 list.style.setProperty('--item-photo',photo+'px');
 list.style.setProperty('--item-pad',Math.max(0,Math.min(7,rowBudget*.06))+'px');
 list.style.setProperty('--item-gap',Math.max(1,Math.min(8,rowBudget*.08))+'px');
 // Keep all lines in the DOM. For unusually large orders use the full area,
 // and let the font shrink further rather than clipping entries.
 let size=font;
 for(let i=0;i<9&&list.scrollHeight>list.clientHeight+1&&size>5;i++){
  size=Math.max(5,size-1.5);
  list.style.setProperty('--item-font',size+'px');
  list.style.setProperty('--item-photo',Math.max(0,Math.min(photo,rowBudget*.65))+'px');
 }
}
let fitFrame=0;
function scheduleFit(){cancelAnimationFrame(fitFrame);fitFrame=requestAnimationFrame(fitOrderToScreen);}
addEventListener('resize',scheduleFit);
addEventListener('orientationchange',scheduleFit);
function renderQr(payment){
 const payload=payment?.qrPayload||'';
 $('screenQr').hidden=!payload;
 if(lastQr!==payload){
  $('screenQr').replaceChildren();
  if(payload){
   const qr=qrcode(0,'M');qr.addData(payload);qr.make();
   $('screenQr').innerHTML=qr.createSvgTag({cellSize:8,margin:32,scalable:true});
  }
  lastQr=payload;
 }
 optional('screenBank',payload?[payment.bankName,payment.account,payment.reference].filter(Boolean).join(' · '):'');
}
function status(value,state='idle'){
 text('screenStatus',value);
 $('screenStatus').dataset.state=state;
}
function render(data,connected=true){
 latestData=data;if(['ru','en','vi'].includes(data.language)){language=data.language;}document.documentElement.lang=language;const {order:currentOrder,draft,payment,transfer,layout,cashReceived,cashChange}=data;
 if(layouts.has(layout))document.documentElement.dataset.displayLayout=layout;
 const handedOut=currentOrder?.status==='completed'&&currentOrder.paymentStatus==='paid';
 const order=handedOut?null:currentOrder;
 const view=order||draft;
 const idle=connected&&!view;
 $('screenWelcome').hidden=!idle;
 $('screenWelcome').parentElement.classList.toggle('is-idle',idle);
 const paid=order?.paymentStatus==='paid';
 const cancelled=order?.status==='cancelled'||order?.paymentStatus==='refunded';
 const qr=order&&!paid&&!cancelled&&order.method==='qr'&&payment?.qrPayload;
 document.body.classList.toggle('display-qr-active',Boolean(qr));
 scheduleFit();
 renderQr(qr?payment:null);
 const rawPhone=String(transfer?.phone||'').replace(/[\s()\-]/g,'');
 const phone=order&&!paid&&!cancelled&&order.paymentStatus==='pending'&&/^\+?7[0-9]{10}$/.test(rawPhone)?rawPhone:'';
 $('screenTransfer').hidden=!phone;
 text('screenTransferPhone',phone);
 text('screenTransferBank',phone?transfer.bank||'':'');
 text('screenTransferRecipient',phone?transfer.recipient||'':'');
 renderItems(view?.lines||[]);
 text('screenNumber',order?tr('order')+order.number:draft?tr('draft'):tr('welcome'));
 optional('screenTotalLabel',view?(paid?tr('paid'):cancelled?tr('orderTotal'):tr('total')):'');
 optional('screenTotal',view?amount(view):'');
 const showCash=view?.method==='cash'&&!cancelled&&Number.isSafeInteger(cashReceived)&&cashReceived>=0;
 $('screenCashSummary').hidden=!showCash;
 text('screenCashReceivedLabel',tr('received'));
 text('screenCashReceivedAmount',showCash?money(cashReceived):'');
 text('screenCashDueLabel',tr('total'));
 text('screenCashDueAmount',showCash?money(view.total):'');
 text('screenChangeLabel',tr('change'));
 text('screenChangeAmount',showCash?money(Math.max(0,Number.isSafeInteger(cashChange)?cashChange:cashReceived-view.total)):'');
 $('screenChange').classList.toggle('is-short',showCash&&cashReceived<view.total);
 document.querySelector('.display-transfer-label').textContent=tr('phone');
 optional('screenMethod',view?(translations[language][view.method]||methods[view.method]||tr('cashier')):'');
 if(!view){status(tr('wait'));return;}
 if(!order){status(tr(draft.method?'pending':'inProgress'),'pending');return;}
 if(cancelled){status(tr('closed'));return;}
 if(paid){
  status('✓ '+tr('success'),'paid');
  return;
 }
 const instruction=qr?tr('scan'):order.method==='cash'?tr('payCash'):phone?tr('transfer'):tr('cashier');
 status(tr('pending')+'. '+instruction,'pending');
}
async function poll(){
 if(busy||stopped)return;
 busy=true;clearTimeout(timer);
 try{
  const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({action:'screenPoll',screenToken:token}),cache:'no-store',signal:AbortSignal.timeout(6000)});
  const data=await response.json();
  if(response.status===404){
   if(savedToken()===token){try{localStorage.removeItem(tokenKey);}catch{}}
   stopped=true;
   throw Error('Экран отключён. Подключите его у кассира.');
  }
  if(!response.ok||!data.ok)throw Error('Не удалось обновить заказ.');
  if(savedToken()!==token){try{localStorage.setItem(tokenKey,token);}catch{}}
  optional('screenConnection','');
  render(data);
 }catch(error){
  render({},false);
  optional('screenConnection',error.message);
  status(tr('ask'));
 }finally{
  busy=false;
  if(!stopped)timer=setTimeout(poll,document.hidden?4000:1200);
 }
}
function fullscreenControl(){
 const button=$('screenFullscreen');
 const appMode=window.matchMedia?.('(display-mode: fullscreen)')?.matches;
 button.hidden=Boolean(document.fullscreenElement||appMode);
}
$('screenFullscreen').onclick=async()=>{
 const request=document.documentElement.requestFullscreen||document.documentElement.webkitRequestFullscreen;
 void window.ummaScreenAwake?.retry();
 try{
  if(!request)throw Error('Fullscreen unavailable');
  await request.call(document.documentElement);
  optional('screenDeviceHint','');
 }catch{
  optional('screenDeviceHint','Откройте меню браузера и выберите «Добавить на главный экран» или включите полноэкранный режим браузера.');
 }
 fullscreenControl();
};
if(isToken(token)){
 fullscreenControl();
 document.addEventListener('fullscreenchange',fullscreenControl);
 document.addEventListener('webkitfullscreenchange',fullscreenControl);
 window.addEventListener('online',()=>void poll());
 window.addEventListener('pageshow',()=>{if(stopped){stopped=false;void poll();}});
 window.addEventListener('pagehide',()=>{stopped=true;clearTimeout(timer);});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void poll();});
 void poll();
}else status('Подключите этот экран у кассира.');
})();
