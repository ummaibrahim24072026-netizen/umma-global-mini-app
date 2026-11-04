/* Browser guest checkout uses the same bank accounts and VietQR as the mini-app.
   The random request key is a receipt capability. No client action marks an order paid. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const banks=[['vcb','Vietcombank'],['mb','MB Bank'],['bidv','BIDV'],['acb','ACB ONE'],['ocb','OCB OMNI'],['icb','VietinBank']];
let installPrompt=null,translate,order=null,context=null,inFlight=false,lastQr='',lastPoll=0;
const standalone=()=>window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true;
function installText(t){translate=t;$('installApp').hidden=standalone();if(!$('installHelp').hidden)$('installHelp').textContent=t(/iPad|iPhone|iPod/.test(navigator.userAgent)?'В Safari: Поделиться → На экран «Домой».':'В меню браузера нажмите «Установить приложение» или «Добавить на главный экран».');}
function install(t){installText(t);window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});window.addEventListener('appinstalled',()=>{installPrompt=null;$('installApp').hidden=true;$('installHelp').hidden=true;});$('installApp').onclick=async()=>{if(installPrompt){const prompt=installPrompt;installPrompt=null;try{await prompt.prompt();await prompt.userChoice;}catch{$('installHelp').hidden=false;installText(translate);}}else{$('installHelp').hidden=!$('installHelp').hidden;installText(translate);}};}
function bankLink(){if(!order?.payment)return;const p=order.payment,selected=$('paymentBank').value;try{localStorage.setItem('umma-payment-bank',selected);}catch{}const url=new URL('https://dl.vietqr.io/pay');url.search=new URLSearchParams({ba:p.account+'@vcb',am:String(p.amount),tn:p.reference,app:selected,url:location.origin+location.pathname});$('openBank').href=url.href;
// Vietcombank's existing flow uses a saved QR rather than a bank deep link.
$('openBank').hidden=selected==='vcb';}
function receipt(value,ctx){order=value;context=ctx;const {t}=ctx;
window.ummaOrderInbox?.publish(value,t);window.ummaOrderAlerts?.setOrder(value);
const statuses={pending:'Заказ отправлен',confirmed:'Заказ принят',preparing:'Готовится',ready:'Заказ готов',completed:'Заказ выдан',cancelled:'Заказ отменён'};
$('orderState').removeAttribute('data-i18n');$('orderState').textContent=t(value.orderType!=='delivery'&&value.status==='pending'&&value.paymentStatus!=='paid'?(value.paymentMethod==='qr'?'Ожидаем оплату по QR':'Ожидает оплаты у кассира'):statuses[value.status]||'Заказ отправлен');
$('paymentState').textContent=t(value.paymentStatus==='paid'?'Оплачено':value.paymentStatus==='refunded'?'Возвращено':value.paymentMethod==='qr'?'Ожидаем оплату по QR':value.orderType==='delivery'?'Оплата наличными при получении.':'Оплатите наличными у кассира. Приготовление начнётся после оплаты.');
const p=value.payment,show=value.paymentMethod==='qr'&&value.paymentStatus!=='paid'&&value.paymentStatus!=='refunded'&&!['cancelled','completed'].includes(value.status)&&p;
$('guestPayment').hidden=!show;
if(show){
 const previous=$('paymentBank').value;let chosen=previous||'vcb';try{if(!previous)chosen=localStorage.getItem('umma-payment-bank')||chosen;}catch{}
 if(!$('paymentBank').options.length)for(const [id,label] of banks){const option=document.createElement('option');option.value=id;option.textContent=label;$('paymentBank').append(option);}
 $('paymentBank').value=banks.some(([id])=>id===chosen)?chosen:'vcb';$('paymentBank').onchange=bankLink;bankLink();
 if(p.qrPayload!==lastQr){const qr=window.qrcode(0,'M');qr.addData(p.qrPayload);qr.make();const n=qr.getModuleCount(),scale=8,pad=4,canvas=document.createElement('canvas');canvas.width=canvas.height=(n+pad*2)*scale;const c=canvas.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,canvas.width,canvas.height);c.fillStyle='#000';for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(qr.isDark(y,x))c.fillRect((x+pad)*scale,(y+pad)*scale,scale,scale);const data=canvas.toDataURL('image/png');$('paymentQr').src=data;$('saveQr').href=data;$('saveQr').download='UMMA-'+value.orderNumber+'.png';lastQr=p.qrPayload;}
 $('paymentAccount').textContent=p.bankName+' · '+p.account+' · '+p.reference;
}
if(value.requestKey&&value.id&&Date.now()-lastPoll>2500)void poll();
}
async function poll(){if(inFlight||!order?.requestKey||!order?.id||!context)return;const current=order,ctx=context;inFlight=true;lastPoll=Date.now();try{const r=await fetch(ctx.API+'cafe-guest-order',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'status',requestKey:current.requestKey,orderId:current.id}),cache:'no-store',signal:AbortSignal.timeout(15000)});const d=await r.json();if(!r.ok||!d.ok)throw Error();if(order!==current)return;Object.assign(current,d.order,{payment:d.payment});if(current.orderType==='delivery'&&/^[a-f0-9]{64}$/.test(current.trackingToken||'')){try{const tr=await fetch(ctx.API+'umma-guest-delivery',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'tracking',token:current.trackingToken}),cache:'no-store',signal:AbortSignal.timeout(8000)});const state=await tr.json();if(tr.ok&&state.ok)current.deliveryStatus=state.state;}catch{}}ctx.save();$('syncState').textContent='';ctx.refresh();}catch{if(order===current)$('syncState').textContent=ctx.t('Не удалось обновить статус. Не оплачивайте повторно; уточните у сотрудника.');}finally{inFlight=false;}}
window.setInterval(()=>{if(!document.hidden&&order&&!['completed','cancelled'].includes(order?.status))void poll();},3000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&order)void poll();});
window.ummaGuestExtras={install,installText,receipt};
})();
