/* Browser guest checkout uses the same bank accounts and VietQR as the mini-app.
   The random request key is a receipt capability. No client action marks an order paid. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const banks=[['vcb','Vietcombank'],['mb','MB Bank'],['bidv','BIDV'],['acb','ACB ONE'],['ocb','OCB OMNI'],['icb','VietinBank']];
let installPrompt=null,translate,order=null,context=null,inFlight=false,lastQr='',lastPoll=0;
let guestProofState=null;
const proofFormats={pdf:'application/pdf',jpeg:'image/jpeg',jpg:'image/jpeg',png:'image/png',webp:'image/webp'};
const proofHint='Чек в PDF, JPG, PNG или WEBP · до 5 МБ';
function renderGuestProof(required,value,{API,t}){
 const section=$('guestTransferProof'), receipt=$('success');
 section.hidden=!(required&&value.requestKey);
 if(section.hidden){
  receipt.removeAttribute('data-proof-sent');
  return;
 }
 const button=$('attachGuestTransferProof'),input=$('guestTransferProofFile'),status=$('guestTransferProofStatus');
 const refresh=state=>{
  if(guestProofState!==state||order?.id!==value.id||section.hidden)return;
  receipt.toggleAttribute('data-proof-sent',state.sent);
  button.hidden=state.sent;
  button.disabled=state.sending;
  status.textContent=t(state.sent?'Чек отправлен':state.sending?'Отправляем чек…':state.message);
 };
 const request=async(action,file={})=>{
  const res=await fetch(API+'cafe-transfer-proof',{
   method:'POST',headers:{'content-type':'application/json'},signal:AbortSignal.timeout(30000),
   body:JSON.stringify({action,requestKey:value.requestKey,orderId:value.id,...file})
  });
  const result=await res.json();
  if(!res.ok||!result.ok)throw Error('Receipt unavailable');
  return result;
 };
 if(guestProofState?.id!==value.id){
  const state=guestProofState={id:value.id,sent:false,sending:false,message:proofHint};
  void request('guestMine').then(result=>{
   if(result.proofs.length){state.sent=true;refresh(state);}
  }).catch(()=>{});
 }
 const state=guestProofState;
 refresh(state);
 button.onclick=()=>input.click();
 input.onchange=async()=>{
  const file=input.files?.[0];
  input.value='';
  if(!file||state.sending||state.sent)return;
  const mimeType=file.type||proofFormats[file.name.split('.').at(-1)?.toLowerCase()];
  if(!Object.values(proofFormats).includes(mimeType)||file.size>5242880||!file.size){
   state.message=proofHint;
   refresh(state);
   return;
  }
  state.sending=true;
  refresh(state);
  try{
   const base64=await new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result).split(',')[1]);
    reader.onerror=()=>reject(reader.error);
    reader.onabort=()=>reject(Error('File reading cancelled'));
    reader.readAsDataURL(file);
   });
   await request('guestSubmit',{mimeType,base64});
   state.sent=true;
  }catch{
   try{state.sent=(await request('guestMine')).proofs.length>0;}catch{}
   state.message='Не удалось отправить чек. Попробуйте ещё раз.';
  }finally{
   state.sending=false;
   refresh(state);
  }
 };
}
const standalone=()=>window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true;
function installText(t){translate=t;$('installApp').hidden=standalone();if(!$('installHelp').hidden)$('installHelp').textContent=t(/iPad|iPhone|iPod/.test(navigator.userAgent)?'В Safari: Поделиться → На экран «Домой».':'В меню браузера нажмите «Установить приложение» или «Добавить на главный экран».');}
function install(t){installText(t);window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});window.addEventListener('appinstalled',()=>{installPrompt=null;$('installApp').hidden=true;$('installHelp').hidden=true;});$('installApp').onclick=async()=>{if(installPrompt){const prompt=installPrompt;installPrompt=null;try{await prompt.prompt();await prompt.userChoice;}catch{$('installHelp').hidden=false;installText(translate);}}else{$('installHelp').hidden=!$('installHelp').hidden;installText(translate);}};}
function bankLink(){if(!order?.payment)return;const p=order.payment,selected=$('paymentBank').value;try{localStorage.setItem('umma-payment-bank',selected);}catch{}const url=new URL('https://dl.vietqr.io/pay');url.search=new URLSearchParams({ba:p.account+'@vcb',am:String(p.amount),tn:p.reference,app:selected,url:location.origin+location.pathname});$('openBank').href=url.href;
// Vietcombank's existing flow uses a saved QR rather than a bank deep link.
$('openBank').hidden=selected==='vcb';}
function receiptDetails(value,{t,money,receiptPhoto}){
 const details=$('receiptDetails');
 details.hidden=!value.items?.length;
 const rows=[];
 const addRow=(label,amount,quantityPrice,photo)=>{
  const row=document.createElement('div'),copy=document.createElement('span'),sum=document.createElement('strong');
  copy.textContent=label;
  if(quantityPrice){
   row.className='receipt-item';
   const quantity=document.createElement('small');
   quantity.textContent=quantityPrice;
   copy.append(quantity);
  }
  sum.textContent=money(amount);
  if(photo){
   const image=document.createElement('img');
   image.className='receipt-item-photo';
   image.alt='';
   image.addEventListener('error',()=>image.remove(),{once:true});
   image.src=photo;
   row.append(image);
  }
  row.append(copy,sum);
  rows.push(row);
 };
 for(const item of value.items||[]){
  addRow(window.ummaMenuI18n.field(item,'name'),item.lineTotalVnd,item.quantity+' × '+money(item.unitPriceVnd),receiptPhoto?.(item,value));
 }
 if(value.deliveryFeeVnd||value.discountVnd)addRow(t('Стоимость блюд'),value.subtotalVnd);
 if(value.deliveryFeeVnd)addRow(t('Стоимость доставки'),value.deliveryFeeVnd);
 if(value.discountVnd)addRow(t('Скидка'),-value.discountVnd);
 details.replaceChildren(...rows);
 const cash=$('receiptCash'),receipt=value.cashReceipt;
 cash.hidden=!(value.paymentMethod==='cash'&&value.paymentStatus==='paid'&&receipt);
 if(!cash.hidden){
  $('receiptTendered').textContent=money(receipt.tenderedVnd);
  $('receiptChange').textContent=money(receipt.changeVnd);
 }
}
function convert(amount,quote){
 const digits=quote.currency==='USDT'?6:2;
 const units=amount/Number(quote.vndPerUnit)*10**digits;
 return (['USD','EUR'].includes(quote.currency)?Math.ceil(units):Math.round(units))/10**digits;
}
function formatForeign(amount,currency){
 const locale=window.ummaMenuI18n?.locale()||'ru';
 return currency==='USDT'
  ?new Intl.NumberFormat(locale,{maximumFractionDigits:6}).format(amount)+' USDT'
  :new Intl.NumberFormat(locale,{style:'currency',currency,currencyDisplay:currency==='KZT'?'narrowSymbol':'symbol'}).format(amount);
}
function renderForeignPayment(value,waiting){
 const payment=waiting&&value.payment;
 const show=payment&&['USD','EUR','USDT'].includes(payment.currency);
 const section=$('guestForeignPayment');
 if(!section)return;
 section.hidden=!show;
 if(!show)return;
 const {currency,vndPerUnit,amount,bankName,recipient,account,network}=payment;
 $('guestForeignAmount').textContent=formatForeign(vndPerUnit?convert(value.totalVnd,payment):amount,currency);
 for(const [id,text] of Object.entries({Bank:bankName,Recipient:recipient,Account:account,Network:network})){
  $('guestForeign'+id+'Row').hidden=!text;
  $('guestForeign'+id).textContent=text||'';
 }
}
function renderNumberTransfer(value,waiting,t,previousOrderId){
 const payment=value.payment;
 const section=$('numberTransfer');
 if(!section)return;
 const status=$('transferCopyStatus');
 if(previousOrderId!==value.id)status.textContent='';
 section.hidden=!(waiting&&['RUB','KZT'].includes(payment?.currency));
 if(section.hidden)return;
 const ruble=payment.currency==='RUB';
 const number=String((ruble?payment.phone:payment.account)??'').trim();
 $('transferAmount').textContent=formatForeign(ruble?payment.kopecks/100:payment.amount,payment.currency);
 $('transferRateRow').hidden=!ruble;
 if(ruble){
  const locale=window.ummaMenuI18n?.locale()||'ru';
  $('transferRate').textContent='1 ₽ = '+new Intl.NumberFormat(locale,{maximumFractionDigits:8}).format(payment.rate)+' ₫';
 }
 $('transferBank').textContent=payment.bankName;
 $('transferRecipient').textContent=payment.recipient;
 const label=ruble?'Телефон для перевода':'Реквизиты';
 $('transferNumberLabel').dataset.i18n=label;
 $('transferNumberLabel').textContent=t(label);
 $('transferNumber').textContent=number;
 $('rubleBankPickerTitle').hidden=!ruble;
 $('rubleBankLinks').hidden=!ruble;
 const copy=$('copyTransferNumber');
 copy.hidden=!number;
 const copyNumber=async()=>{
  let message;
  try{
   await navigator.clipboard.writeText(number);
   message='Номер скопирован';
  }catch{
   message='Скопируйте номер из реквизитов вручную.';
  }
  if(order?.id===value.id&&!section.hidden)status.textContent=t(message);
 };
 copy.onclick=copyNumber;
 $('rubleBankLinks').onclick=event=>{
  if(ruble&&number&&event.target.closest('a'))void copyNumber();
 };
}
function receipt(value,ctx){const previousOrderId=order?.id;order=value;context=ctx;const {t}=ctx;
receiptDetails(value,ctx);
window.ummaOrderInbox?.publish(value,t);let reserve=$('orderReserveUntil');if(!reserve){reserve=document.createElement('p');reserve.id='orderReserveUntil';$('orderState').after(reserve);}reserve.hidden=!(value.status==='pending'&&value.paymentStatus!=='paid'&&Number.isFinite(Date.parse(value.stockReservedUntil)));if(!reserve.hidden)reserve.textContent=t('Резерв до {time}',{time:new Date(value.stockReservedUntil).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})});window.ummaOrderAlerts?.setOrder(value);
const statuses={pending:'Заказ отправлен',confirmed:'Заказ принят',preparing:'Готовится',ready:'Заказ готов',completed:value.greenSmStage==='delivered'?'Заказ доставлен':'Заказ выдан',cancelled:'Заказ отменён'};
const waitingPayment=value.paymentStatus==='pending'&&!['cancelled','completed'].includes(value.status);
renderForeignPayment(value,waitingPayment);
renderGuestProof(waitingPayment&&['qr','bank_transfer'].includes(value.paymentMethod),value,ctx);
$('orderState').removeAttribute('data-i18n');
$('orderState').textContent=waitingPayment?t('Ожидаем подтверждение оплаты')
 :value.preorderWaiting&&!['cancelled','completed'].includes(value.status)?t('Предзаказ · готовится к {time}',{time:new Intl.DateTimeFormat(window.ummaMenuI18n?.locale()||'ru',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(value.preorderExpectedAt))})+' · '+t('Время Нячанга')
 :value.preorderExpectedAt&&value.status==='preparing'?t('Собираем предзаказ')
 :t(statuses[value.status]||'Заказ отправлен');
$('paymentState').textContent=t(value.status==='cancelled'?'Заказ отменён. Не оплачивайте его. Если деньги уже переведены, обратитесь в кафе.':value.paymentStatus==='paid'?'Оплачено':value.paymentStatus==='refunded'?'Возвращено':value.status==='completed'?'':value.paymentMethod==='bank_transfer'?(value.payment?.currency==='RUB'?'Ожидаем перевод в рублях':'Ожидаем подтверждение оплаты'):value.paymentMethod==='qr'?'Ожидаем оплату по QR':'Оплатите наличными у кассира.');
renderNumberTransfer(value,waitingPayment,t,previousOrderId);
const p=value.payment,show=value.paymentMethod==='qr'&&value.paymentStatus!=='paid'&&value.paymentStatus!=='refunded'&&!['cancelled','completed'].includes(value.status)&&p;
$('guestPayment').hidden=!show;
if(show){
 const previous=$('paymentBank').value;let chosen=previous||'vcb';try{if(!previous)chosen=localStorage.getItem('umma-payment-bank')||chosen;}catch{}
 if(!$('paymentBank').options.length)for(const [id,label] of banks){const option=document.createElement('option');option.value=id;option.textContent=label;$('paymentBank').append(option);}
 $('paymentBank').value=banks.some(([id])=>id===chosen)?chosen:'vcb';$('paymentBank').onchange=bankLink;bankLink();
 if(p.qrPayload!==lastQr){const qr=window.qrcode(0,'M');qr.addData(p.qrPayload);qr.make();const n=qr.getModuleCount(),scale=8,pad=4,canvas=document.createElement('canvas');canvas.width=canvas.height=(n+pad*2)*scale;const c=canvas.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,canvas.width,canvas.height);c.fillStyle='#000';for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(qr.isDark(y,x))c.fillRect((x+pad)*scale,(y+pad)*scale,scale,scale);const data=canvas.toDataURL('image/png');$('paymentQr').src=data;$('saveQr').href=data;$('saveQr').download='UMMA-'+value.orderNumber+'.png';lastQr=p.qrPayload;}
 $('paymentAccount').textContent=p.bankName+' · '+p.account+' · '+p.reference;
}
if(Date.now()-lastPoll>2500)void poll();
}
async function poll(){
 if(inFlight||!context)return;
 const ctx=context;
 const active=ctx.activeReceipts().filter(receipt=>receipt.requestKey&&receipt.id);
 if(!active.length)return;
 inFlight=true;
 lastPoll=Date.now();
 try{
  await Promise.all(active.map(async current=>{
   try{
    const r=await fetch(ctx.API+'cafe-guest-order',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'status',requestKey:current.requestKey,orderId:current.id}),cache:'no-store',signal:AbortSignal.timeout(15000)});
    const d=await r.json();
    if(!r.ok||!d.ok)throw Error();
    const update={...d.order,payment:d.payment};
    if(current.orderType==='delivery'&&/^[a-f0-9]{64}$/.test(current.trackingToken||'')){
     try{
      const tr=await fetch(ctx.API+'umma-guest-delivery',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'tracking',token:current.trackingToken}),cache:'no-store',signal:AbortSignal.timeout(8000)});
      const state=await tr.json();
      if(tr.ok&&state.ok&&!update.greenSmStage)update.deliveryStatus=state.state;
     }catch{}
    }
    if(!context?.activeReceipts().includes(current))return;
    Object.assign(current,update);
    ctx.updated(current);
   }catch{
    if(order===current)$('syncState').textContent=ctx.t('Не удалось обновить статус. Не оплачивайте повторно; уточните у сотрудника.');
   }
  }));
 }finally{inFlight=false;}
}
window.setInterval(()=>{if(!document.hidden)void poll();},3000);
document.addEventListener('umma:fulfillment-realtime',()=>void poll());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void poll();});
window.ummaGuestExtras={install,installText,receipt,convert,formatForeign,clearReceipt(){order=null;context=null;}};
})();
