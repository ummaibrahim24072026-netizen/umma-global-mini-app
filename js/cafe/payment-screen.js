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
const methods={qr:'QR Vietcombank',usdt:'USDT'};
let timer,busy=false,stopped=false,lastQr='',lastItems='',lastFitState='';
const orderPanel=document.querySelector('.display-order');
const totalRow=document.querySelector('.display-total-row');
const methodRow=document.querySelector('.display-method-row');
const translations={
 ru:{received:'Получено',order:'Заказ №',draft:'Ваш заказ',welcome:'Добро пожаловать',total:'К оплате',paid:'Оплачено',orderTotal:'Сумма заказа',change:'Сдача',pending:'Ожидает оплаты',inProgress:'Кассир оформляет заказ',closed:'Заказ закрыт',success:'Оплата прошла успешно',cash:'Наличными',rub:'Рубли · RUB',sber:'Сбербанк · RUB',tenge:'Тенге · KZT',kaspi:'Kaspi · KZT',bank_transfer:'Банковский перевод',wait:'Ожидаем заказ от кассира',scan:'Сканируйте QR-код в приложении банка',payCash:'Передайте наличные кассиру',transfer:'Переведите указанную сумму по номеру',cashier:'Ожидайте подтверждения кассира',remaining:'Осталось оплатить',fullscreen:'На весь экран',ask:'Обратитесь к кассиру'},
 en:{received:'Received',order:'Order #',draft:'Your order',welcome:'Welcome',total:'Total to pay',paid:'Paid',orderTotal:'Order total',change:'Change',pending:'Awaiting payment',inProgress:'Cashier is preparing your order',closed:'Order closed',success:'Payment successful',cash:'Cash',rub:'Rubles · RUB',sber:'Sberbank · RUB',tenge:'Tenge · KZT',kaspi:'Kaspi · KZT',bank_transfer:'Bank transfer',wait:'Waiting for cashier',scan:'Scan QR with your banking app',payCash:'Pay cash at the counter',transfer:'Transfer the amount to the number shown',cashier:'Waiting for cashier confirmation',remaining:'Still due',fullscreen:'Fullscreen',ask:'Please ask the cashier'},
 vi:{received:'Đã nhận',order:'Đơn hàng số ',draft:'Đơn hàng của bạn',welcome:'Chào mừng quý khách',total:'Tổng thanh toán',paid:'Đã thanh toán',orderTotal:'Tổng đơn hàng',change:'Tiền thừa',pending:'Chờ thanh toán',inProgress:'Nhân viên đang nhập đơn',closed:'Đơn hàng đã đóng',success:'Thanh toán thành công',cash:'Tiền mặt',rub:'Rúp · RUB',sber:'Sberbank · RUB',tenge:'Tenge · KZT',kaspi:'Kaspi · KZT',bank_transfer:'Chuyển khoản',wait:'Đang chờ nhân viên',scan:'Quét mã QR bằng ứng dụng ngân hàng',payCash:'Thanh toán tiền mặt tại quầy',transfer:'Chuyển số tiền trên đến số điện thoại',cashier:'Đang chờ nhân viên xác nhận',remaining:'Còn phải trả',fullscreen:'Toàn màn hình',ask:'Vui lòng liên hệ nhân viên'}
};
let language='ru';
const tr=key=>translations[language][key]||key;
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
 orderPanel.hidden=!lines.length;
 if(key===lastItems)return;
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
   image.addEventListener('error',()=>{image.remove();item.classList.remove('has-photo');scheduleFit();},{once:true});
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
 delete orderPanel.dataset.density;
 orderPanel.removeAttribute('tabindex');
 if(orderPanel.hidden||getComputedStyle(orderPanel).overflowY!=='auto')return;
 if(orderPanel.scrollHeight<=orderPanel.clientHeight+1)return;
 orderPanel.dataset.density='compact';
 if(orderPanel.scrollHeight>orderPanel.clientHeight+1)orderPanel.dataset.density='dense';
 if(orderPanel.scrollHeight>orderPanel.clientHeight+1)orderPanel.tabIndex=0;
}
let fitFrame=0;
function scheduleFit(){
 cancelAnimationFrame(fitFrame);
 fitFrame=requestAnimationFrame(fitOrderToScreen);
}
addEventListener('resize',scheduleFit);
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
function status(value,state='idle',instruction=''){
 text('screenStatus',value);
 $('screenStatus').dataset.state=state;
 optional('screenInstruction',instruction);
}
function formatPhone(phone){
 return '+'+phone.replace(/^\+?(7)([0-9]{3})([0-9]{3})([0-9]{2})([0-9]{2})$/,'$1 $2 $3 $4 $5');
}
function render(data,connected=true){
 if(['ru','en','vi'].includes(data.language))language=data.language;
 document.documentElement.lang=language;
 const fullscreen=$('screenFullscreen');
 fullscreen.setAttribute('aria-label',tr('fullscreen'));
 fullscreen.title=tr('fullscreen');
 const {order:currentOrder,draft,payment,transfer,layout,cashReceived,cashChange}=data;
 if(layouts.has(layout))document.documentElement.dataset.displayLayout=layout;
 const handedOut=currentOrder?.status==='completed'&&currentOrder.paymentStatus==='paid';
 const order=handedOut?null:currentOrder;
 const view=handedOut?null:order||draft;
 const idle=connected&&!view;
 $('screenWelcome').hidden=!idle;
 $('screenWelcome').parentElement.classList.toggle('is-idle',idle);
 const paid=order?.paymentStatus==='paid';
 const cancelled=order?.status==='cancelled'||order?.paymentStatus==='refunded';
 const qr=Boolean(order&&!paid&&!cancelled&&order.method==='qr'&&payment?.qrPayload);
 document.body.classList.toggle('display-qr-active',qr);
 const fitState=JSON.stringify([qr,payment?.bankName,payment?.account,payment?.reference,language,layout]);
 if(fitState!==lastFitState){lastFitState=fitState;scheduleFit();}
 renderQr(qr?payment:null);
 const rawPhone=String(transfer?.phone||'').replace(/[\s()\-]/g,'');
 const phone=order&&!paid&&!cancelled&&order.paymentStatus==='pending'&&/^\+?7[0-9]{10}$/.test(rawPhone)?formatPhone(rawPhone):'';
 $('screenTransfer').hidden=!phone;
 text('screenTransferPhone',phone);
 optional('screenTransferRecipient',phone?transfer.recipient||'':'');
 renderItems(view?.lines||[]);
 text('screenNumber',order?tr('order')+order.number:draft&&!handedOut?tr('draft'):tr('welcome'));
 totalRow.hidden=!view;
 optional('screenTotalLabel',view?(paid?tr('paid'):cancelled?tr('orderTotal'):tr('total')):'');
 optional('screenTotal',view?amount(view):'');
 const showCash=view?.method==='cash'&&!cancelled&&Number.isSafeInteger(cashReceived)&&cashReceived>=0;
 const stillDue=showCash&&!paid&&cashReceived<view.total;
 const change=showCash?Math.max(0,Number.isSafeInteger(cashChange)?cashChange:cashReceived-view.total):0;
 $('screenCashSummary').hidden=!showCash;
 text('screenCashReceivedLabel',tr('received'));
 text('screenCashReceivedAmount',showCash?money(cashReceived):'');
 text('screenChangeLabel',tr(stillDue?'remaining':'change'));
 text('screenChangeAmount',showCash?money(stillDue?view.total-cashReceived:change):'');
 $('screenChange').classList.toggle('is-short',stillDue);
 let method=view?.method?(translations[language][view.method]||methods[view.method]||tr('cashier')):'';
 if(phone&&transfer.bank){
  const currency=order.foreignTotal?.currency;
  method=currency&&!transfer.bank.includes(currency)?transfer.bank+' · '+currency:transfer.bank;
 }
 methodRow.hidden=!method;
 optional('screenMethod',method);
 orderPanel.setAttribute('aria-label',tr('draft'));
 $('screenQr').setAttribute('aria-label',tr('scan'));
 if(!view){status(tr('wait'));return;}
 if(!order){status(tr(draft.method?'pending':'inProgress'),'pending');return;}
 if(cancelled){status(tr('closed'));return;}
 if(paid){status('✓ '+tr('success'),'paid');return;}
 const instruction=qr?tr('scan'):order.method==='cash'?tr('payCash'):phone?tr('transfer'):tr('cashier');
 status(tr('pending'),'pending',instruction);
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
