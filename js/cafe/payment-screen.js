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
const languageKey='umma:customer-display-language';
const translations={
 ru:{order:'Заказ №',draft:'Ваш заказ',welcome:'Добро пожаловать',total:'К оплате',paid:'Оплачено',orderTotal:'Сумма заказа',change:'Сдача',each:'за шт.',pending:'Ожидает оплаты',inProgress:'Кассир оформляет заказ',closed:'Заказ закрыт',success:'Оплата прошла успешно',cash:'Наличными',rub:'Рубли · RUB',sber:'Сбербанк · RUB',tenge:'Тенге · KZT',kaspi:'Kaspi · KZT',bank_transfer:'Банковский перевод',wait:'Ожидаем заказ от кассира',scan:'Сканируйте QR-код в приложении банка',payCash:'Передайте наличные кассиру',transfer:'Переведите указанную сумму по номеру',cashier:'Ожидайте подтверждения кассира',phone:'Номер для перевода',ask:'Обратитесь к кассиру'},
 en:{order:'Order #',draft:'Your order',welcome:'Welcome',total:'Total to pay',paid:'Paid',orderTotal:'Order total',change:'Change',each:'each',pending:'Awaiting payment',inProgress:'Cashier is preparing your order',closed:'Order closed',success:'Payment successful',cash:'Cash',rub:'Rubles · RUB',sber:'Sberbank · RUB',tenge:'Tenge · KZT',kaspi:'Kaspi · KZT',bank_transfer:'Bank transfer',wait:'Waiting for cashier',scan:'Scan QR with your banking app',payCash:'Pay cash at the counter',transfer:'Transfer the amount to the number shown',cashier:'Waiting for cashier confirmation',phone:'Transfer phone number',ask:'Please ask the cashier'},
 vi:{order:'Đơn hàng số ',draft:'Đơn hàng của bạn',welcome:'Chào mừng quý khách',total:'Tổng thanh toán',paid:'Đã thanh toán',orderTotal:'Tổng đơn hàng',change:'Tiền thừa',each:'mỗi phần',pending:'Chờ thanh toán',inProgress:'Nhân viên đang nhập đơn',closed:'Đơn hàng đã đóng',success:'Thanh toán thành công',cash:'Tiền mặt',rub:'Rúp · RUB',sber:'Sberbank · RUB',tenge:'Tenge · KZT',kaspi:'Kaspi · KZT',bank_transfer:'Chuyển khoản',wait:'Đang chờ nhân viên',scan:'Quét mã QR bằng ứng dụng ngân hàng',payCash:'Thanh toán tiền mặt tại quầy',transfer:'Chuyển số tiền trên đến số điện thoại',cashier:'Đang chờ nhân viên xác nhận',phone:'Số điện thoại chuyển khoản',ask:'Vui lòng liên hệ nhân viên'}
};
let language=['ru','en','vi'].includes(localStorage.getItem(languageKey))?localStorage.getItem(languageKey):'en';
const tr=key=>translations[language][key]||key;
let latestData=null;
const picker=document.createElement('select');
picker.id='screenLanguage';picker.setAttribute('aria-label','Display language');
picker.innerHTML='<option value="ru">RU</option><option value="en">EN</option><option value="vi">VI</option>';
picker.value=language;
picker.style.cssText='margin-left:auto;border:1px solid #d8ad45;border-radius:999px;background:#e8fbfb;color:#07565a;padding:9px 14px;font:700 16px system-ui;cursor:pointer';
document.querySelector('.display-brand')?.append(picker);
picker.addEventListener('change',()=>{language=picker.value;localStorage.setItem(languageKey,language);lastItems='';if(latestData)render(latestData);});

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
  units.textContent=money(line.unitPrice)+' '+tr('each');
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
function render(data,connected=true){
 latestData=data;document.documentElement.lang=language;const {order:currentOrder,draft,payment,transfer,layout,cashChange}=data;
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
 renderQr(qr?payment:null);
 const phone=order&&!paid&&!cancelled&&order.paymentStatus==='pending'&&/^\+7[0-9]{10}$/.test(transfer?.phone||'')?transfer.phone:'';
 $('screenTransfer').hidden=!phone;
 text('screenTransferPhone',phone);
 text('screenTransferBank',phone?transfer.bank||'':'');
 text('screenTransferRecipient',phone?transfer.recipient||'':'');
 renderItems(view?.lines||[]);
 text('screenNumber',order?tr('order')+order.number:draft?tr('draft'):tr('welcome'));
 optional('screenTotalLabel',view?(paid?tr('paid'):cancelled?tr('orderTotal'):tr('total')):'');
 optional('screenTotal',view?amount(view):'');
 const showChange=view?.method==='cash'&&!cancelled&&Number.isSafeInteger(cashChange)&&cashChange>=0;
 $('screenChange').hidden=!showChange;
 text('screenChangeAmount',showChange?money(cashChange):'');document.querySelector('#screenChange span').textContent=tr('change');document.querySelector('.display-transfer-label').textContent=tr('phone');
 optional('screenMethod',view?(tr(view.method)||tr('cashier')):'');
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
