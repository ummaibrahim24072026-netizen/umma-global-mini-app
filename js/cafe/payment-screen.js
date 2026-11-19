/* The paired device only reads its cashier's current display. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const token=new URLSearchParams(location.hash.slice(1)).get('screen')||'';
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
  const name=document.createElement('span');
  const total=document.createElement('strong');
  name.textContent=line.name+' × '+line.quantity;
  total.textContent=money(line.unitPrice*line.quantity);
  item.append(name,total);
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
 const {order,draft,payment}=data;
 const view=order||draft;
 const paid=order?.paymentStatus==='paid';
 const cancelled=order?.status==='cancelled'||order?.paymentStatus==='refunded';
 const qr=order&&!paid&&!cancelled&&order.method==='qr'&&payment?.qrPayload;
 renderQr(qr?payment:null);
 renderItems(view?.lines||[]);
 text('screenNumber',order?'Заказ · Order · Đơn hàng №'+order.number:draft?'Ваш заказ · Your order · Đơn hàng':'Добро пожаловать · Welcome · Xin chào');
 optional('screenTotalLabel',view?(paid?'Оплачено · Paid':cancelled?'Сумма заказа · Order total':'К оплате · Total'):'');
 optional('screenTotal',view?amount(view):'');
 optional('screenMethod',view?(methods[view.method]||'Способ оплаты уточняет кассир · Payment method pending'):'');
 if(!view){status('Ожидаем заказ от кассира · Waiting for your order');return;}
 if(!order){status(draft.method?'Ожидает оплаты · Unpaid':'Кассир оформляет заказ · Order in progress','pending');return;}
 if(cancelled){status('Заказ закрыт · Order closed');return;}
 if(paid){
  status('✓ Оплата прошла успешно · Payment successful · Đã thanh toán','paid');
  return;
 }
 const instruction=qr?'Сканируйте QR-код в приложении банка · Scan with your bank app':
  order.method==='cash'?'Передайте наличные кассиру · Pay cash at the counter':'Ожидайте подтверждения кассира · Waiting for the cashier';
 status('Ожидает оплаты · Unpaid. '+instruction,'pending');
}
async function poll(){
 if(busy||stopped)return;
 busy=true;clearTimeout(timer);
 try{
  const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({action:'screenPoll',screenToken:token}),cache:'no-store',signal:AbortSignal.timeout(6000)});
  const data=await response.json();
  if(!response.ok||!data.ok)throw Error(response.status===404?'Экран отключён. Подключите его у кассира.':'Не удалось обновить заказ.');
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
if(/^[a-f0-9]{64}$/.test(token)){
 window.addEventListener('online',()=>void poll());
 window.addEventListener('pageshow',()=>{if(stopped){stopped=false;void poll();}});
 window.addEventListener('pagehide',()=>{stopped=true;clearTimeout(timer);});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void poll();});
 void poll();
}else status('Подключите этот экран у кассира.');
})();
