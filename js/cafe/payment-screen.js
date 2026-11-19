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
 const key=JSON.stringify(lines);
 $('screenItems').hidden=!lines.length;
 if(key===lastItems)return;
 lastItems=key;
 $('screenItems').replaceChildren(...lines.map(line=>{
  const item=document.createElement('li');
  const label=document.createElement('div');
  const name=document.createElement('strong');
  const units=document.createElement('small');
  const total=document.createElement('strong');
  const photo=window.ummaCafeProductPhoto?.(line);
  if(photo){
   const image=document.createElement('img');
   image.className='display-food-photo';image.alt='';image.loading='lazy';image.decoding='async';image.referrerPolicy='no-referrer';
   image.addEventListener('error',()=>{image.remove();item.classList.remove('has-photo');},{once:true});
   image.src=photo;item.classList.add('has-photo');item.append(image);
  }
  name.textContent=line.name+' × '+line.quantity;
  units.textContent=money(line.unitPrice)+' за шт. · each';
  total.textContent=money(line.unitPrice*line.quantity);
  label.append(name,units);
  item.append(label,total);
  return item;
 }));
}
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
function render(data){
 const {order,draft,payment,transfer,layout,cashChange}=data;
 if(layouts.has(layout))document.documentElement.dataset.displayLayout=layout;
 const view=order||draft;
 const paid=order?.paymentStatus==='paid';
 const cancelled=order?.status==='cancelled'||order?.paymentStatus==='refunded';
 const qr=order&&!paid&&!cancelled&&order.method==='qr'&&payment?.qrPayload;
 renderQr(qr?payment:null);
 const phone=order&&!paid&&!cancelled&&order.paymentStatus==='pending'&&/^\+7[0-9]{10}$/.test(transfer?.phone||'')?transfer.phone:'';
 $('screenTransfer').hidden=!phone;
 text('screenTransferPhone',phone);
 text('screenTransferBank',phone?transfer.bank||'':'');
 text('screenTransferRecipient',phone?transfer.recipient||'':'');
 renderItems(view?.lines||[]);
 text('screenNumber',order?'Заказ · Order · Đơn hàng №'+order.number:draft?'Ваш заказ · Your order · Đơn hàng':'Добро пожаловать · Welcome · Xin chào');
 optional('screenTotalLabel',view?(paid?'Оплачено · Paid':cancelled?'Сумма заказа · Order total':'К оплате · Total'):'');
 optional('screenTotal',view?amount(view):'');
 const showChange=view?.method==='cash'&&!cancelled&&Number.isSafeInteger(cashChange)&&cashChange>=0;
 $('screenChange').hidden=!showChange;
 text('screenChangeAmount',showChange?money(cashChange):'');
 optional('screenMethod',view?(methods[view.method]||'Способ оплаты уточняет кассир · Payment method pending'):'');
 if(!view){status('Ожидаем заказ от кассира · Waiting for your order');return;}
 if(!order){status(draft.method?'Ожидает оплаты · Unpaid':'Кассир оформляет заказ · Order in progress','pending');return;}
 if(cancelled){status('Заказ закрыт · Order closed');return;}
 if(paid){
  status('✓ Оплата прошла успешно · Payment successful · Đã thanh toán','paid');
  return;
 }
 const instruction=qr?'Сканируйте QR-код в приложении банка · Scan with your bank app':
  order.method==='cash'?'Передайте наличные кассиру · Pay cash at the counter':
  phone?'Переведите указанную сумму по номеру · Transfer using the number shown':'Ожидайте подтверждения кассира · Waiting for the cashier';
 status('Ожидает оплаты · Unpaid. '+instruction,'pending');
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
  render({});
  optional('screenConnection',error.message);
  status('Обратитесь к кассиру · Please ask the cashier');
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
