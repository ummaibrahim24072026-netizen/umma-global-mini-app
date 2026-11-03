/* A read-only screen capability can display exactly one cashier-selected order. */
(()=>{'use strict';const $=id=>document.getElementById(id),token=new URLSearchParams(location.hash.slice(1)).get('screen')||'';let timer,busy=false,last='';
const money=v=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(v);
function clearQr(){$('screenQr').replaceChildren();last='';$('screenBank').textContent='';}
async function poll(){if(busy)return;busy=true;clearTimeout(timer);try{const r=await fetch('https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-web',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'screenPoll',screenToken:token}),cache:'no-store',signal:AbortSignal.timeout(8000)});const d=await r.json();if(!r.ok||!d.ok)throw Error(r.status===404?'Экран отключён. Подключите его у кассира.':'Нет связи. QR временно скрыт.');$('screenConnection').textContent='';
if(!d.order){clearQr();$('screenNumber').textContent='Добро пожаловать · Welcome · Xin chào';$('screenTotal').textContent='UMMA CAFE';$('screenStatus').textContent='Ожидаем заказ от кассира · Waiting for your order';return;}
const o=d.order;$('screenNumber').textContent='Заказ · Order · Đơn hàng №'+o.number;$('screenTotal').textContent=money(o.total);
if(o.status==='cancelled'){clearQr();$('screenStatus').textContent='Заказ отменён · Order cancelled';}
else if(o.paymentStatus==='paid'){clearQr();$('screenStatus').textContent='✓ Оплачено · Paid · Đã thanh toán';}
else if(d.payment){const p=d.payment;if(last!==p.qrPayload){const qr=qrcode(0,'M');qr.addData(p.qrPayload);qr.make();$('screenQr').innerHTML=qr.createSvgTag({cellSize:8,margin:32,scalable:true});last=p.qrPayload;}$('screenStatus').textContent='Сканируйте в приложении банка · Scan with your bank app';$('screenBank').textContent=p.bankName+' · '+p.account+' · '+p.reference+' · Сумма уже указана / Amount included';}
else{clearQr();$('screenStatus').textContent=o.method==='cash'?'Оплата наличными у кассира · Pay cash at the counter':'Ожидайте подтверждения кассира · Please ask the cashier';}
}catch(e){clearQr();$('screenConnection').textContent=e.message;$('screenStatus').textContent='Обратитесь к кассиру · Please ask the cashier';}finally{busy=false;timer=setTimeout(poll,2000);}}
window.addEventListener('online',()=>void poll());window.addEventListener('pagehide',()=>clearTimeout(timer));if(/^[a-f0-9]{64}$/.test(token))void poll();else $('screenStatus').textContent='Подключите этот экран через «Экран оплаты для клиента» на кассе.';
})();
