/* VietQR is rendered locally; opening a bank never confirms payment. */
(() => {
  'use strict';
  const endpoint = 'https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-my-orders';
  const proofEndpoint = 'https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-transfer-proof';
  const uploads=new Map();
  const banks = [['vcb','Vietcombank'],['mb','MB Bank'],['bidv','BIDV'],['acb','ACB ONE'],['ocb','OCB OMNI'],['icb','VietinBank']];
  let dialog, sequence = 0;
  const el = (tag, text, className) => {const node=document.createElement(tag);if(text)node.textContent=text;if(className)node.className=className;return node;};
  const money = amount => new Intl.NumberFormat('ru-RU').format(amount)+' ₫';
  function ensureDialog() {
    if(dialog)return dialog;
    dialog=el('dialog',null,'cafe-payment-sheet');
    dialog.setAttribute('aria-labelledby','cafePaymentTitle');
    dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
    dialog.addEventListener('close',()=>{sequence++;dialog.replaceChildren();});
    document.body.append(dialog);return dialog;
  }
  function heading() {
    const header=el('header'),title=el('h2','Оплата заказа');title.id='cafePaymentTitle';
    const close=el('button','×','cafe-payment-close');close.type='button';close.setAttribute('aria-label','Закрыть оплату');close.onclick=()=>dialog.close();header.append(title,close);dialog.append(header);
  }
  function copyRow(label,value) {
    const row=el('div',null,'cafe-payment-copy'),text=el('div'),button=el('button','Копировать');button.type='button';button.setAttribute('aria-label','Копировать: '+label);
    text.append(el('small',label),el('strong',value));
    button.onclick=async()=>{try{await navigator.clipboard.writeText(value);button.textContent='Скопировано';}catch{button.textContent='Выделите текст';const range=document.createRange();range.selectNodeContents(text.lastChild);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);}};
    row.append(text,button);return row;
  }
  function receiptForm(orderId) {
    const section=el('section',null,'cafe-payment-receipt'),title=el('h3','Уже перевели?'),help=el('p','Прикрепите фото или скриншот перевода. JPG, PNG или WEBP до 5 МБ.','cafe-payment-help');
    const label=el('label','Выбрать скриншот','cafe-payment-file'),input=el('input');input.type='file';input.accept='image/jpeg,image/png,image/webp';input.setAttribute('aria-label','Скриншот подтверждения оплаты');label.append(input);
    const preview=el('img',null,'cafe-payment-preview');preview.alt='Выбранный скриншот перевода';preview.hidden=true;
    const send=el('button','Отправить чек','cafe-payment-open');send.type='button';send.disabled=true;
    const status=el('p',null,'cafe-payment-help');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    let selected=null,selection=0;
    function showSaved(proofs) {
      const latest=proofs?.[0];if(!latest)return;
      status.textContent=latest.status==='confirmed'?'Чек проверен сотрудником.':latest.status==='rejected'?'Чек отклонён. Проверьте перевод и прикрепите другой скриншот.':'Чек отправлен на проверку. Оплату подтвердит сотрудник после поступления денег.';
    }
    input.onchange=()=>{
      const current=++selection;selected=null;send.disabled=true;preview.hidden=true;preview.removeAttribute('src');const file=input.files?.[0];if(!file)return;
      if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5242880||file.size===0){status.textContent='Выберите JPG, PNG или WEBP до 5 МБ.';return;}
      const reader=new FileReader();reader.onload=()=>{if(current!==selection)return;selected={mimeType:file.type,base64:String(reader.result).split(',')[1]};preview.src=String(reader.result);preview.hidden=false;send.disabled=uploads.has(orderId);status.textContent='Скриншот выбран. Нажмите «Отправить чек».';};reader.onerror=()=>{if(current===selection)status.textContent='Не удалось прочитать фото. Выберите его ещё раз.';};reader.readAsDataURL(file);
    };
    send.onclick=async()=>{
      if(!selected||uploads.has(orderId))return;
      send.disabled=true;input.disabled=true;send.textContent='Отправляем…';send.setAttribute('aria-busy','true');
      const payload={action:'submit',initData:window.Telegram?.WebApp?.initData,orderId,bankCountry:'VN',...selected};
      const upload=(async()=>{const response=await fetch(proofEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store',signal:window.AbortSignal?.timeout?.(30000)});const data=await response.json();if(!response.ok||!data.ok)throw Error(data.error||'Не удалось отправить чек');return data;})();uploads.set(orderId,upload);
      try{await upload;showSaved([{status:'pending'}]);selected=null;input.value='';preview.hidden=true;preview.removeAttribute('src');send.textContent='Чек отправлен';}
      catch(error){status.textContent=(error.name==='TimeoutError'?'Ответ задерживается. Откройте оплату ещё раз, чтобы проверить отправку чека.':error.message)||'Не удалось отправить чек. Попробуйте ещё раз.';send.textContent='Повторить отправку';}
      finally{uploads.delete(orderId);input.disabled=false;send.disabled=!selected;send.removeAttribute('aria-busy');}
    };
    section.append(title,help,label,preview,send,status);
    const initData=window.Telegram?.WebApp?.initData;
    const loadSaved=()=>fetch(proofEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'mine',initData,orderId}),cache:'no-store',signal:window.AbortSignal?.timeout?.(12000)})
      .then(async response=>{const data=await response.json();if(!response.ok||!data.ok)throw Error();if(selection===0&&!selected&&!uploads.has(orderId))showSaved(data.proofs);})
      .catch(()=>{if(selection===0&&!selected&&!uploads.has(orderId))status.textContent='Не удалось проверить ранее отправленные чеки. Если вы уже отправляли чек, откройте оплату ещё раз перед повторной отправкой.';});
    const inFlight=uploads.get(orderId);
    if(inFlight){input.disabled=true;status.textContent='Чек отправляется…';inFlight.then(loadSaved,loadSaved).finally(()=>{input.disabled=false;send.disabled=!selected;});}else loadSaved();
    return section;
  }
  function render(payment) {
    if(!payment || !/^\d{6,19}$/.test(payment.account) || !Number.isSafeInteger(payment.amount) || payment.amount<=0 || typeof payment.qrPayload!=='string' || payment.bankCode!=='vcb')throw Error('Некорректные реквизиты');
    const qr=qrcode(0,'M');qr.addData(payment.qrPayload);qr.make();
    const count=qr.getModuleCount(),scale=8,padding=4,canvas=document.createElement('canvas');canvas.width=canvas.height=(count+padding*2)*scale;
    const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.fillStyle='#000';
    for(let y=0;y<count;y++)for(let x=0;x<count;x++)if(qr.isDark(y,x))context.fillRect((x+padding)*scale,(y+padding)*scale,scale,scale);
    const image=el('img',null,'cafe-payment-qr');image.src=canvas.toDataURL('image/png');image.alt='VietQR для оплаты заказа №'+payment.orderNumber;
    const qrLink=el('a');qrLink.target='_blank';qrLink.rel='noopener noreferrer';qrLink.setAttribute('aria-label','Открыть выбранный банк для оплаты');qrLink.append(image);
    dialog.append(el('p','Заказ №'+payment.orderNumber+' · '+payment.bankName,'cafe-payment-meta'),el('p',money(payment.amount),'cafe-payment-amount'),qrLink);
    const save=el('a','Сохранить QR','cafe-payment-save');save.href=image.src;save.download='UMMA-'+payment.orderNumber+'.png';dialog.append(save);
    dialog.append(el('p','Сохраните QR и выберите его в сканере вашего банка. Сумма и назначение уже включены в код. Проверьте получателя перед переводом.','cafe-payment-help'));
    dialog.append(copyRow('Счёт · '+payment.bankName,payment.account),copyRow('Назначение',payment.reference),copyRow('Сумма, VND',String(payment.amount)));
    const label=el('p','Ваш банк','cafe-payment-bank'),chooser=el('details',null,'cafe-payment-chooser'),summary=el('summary','Vietcombank'),list=el('div',null,'cafe-payment-banks');
    let selected='vcb';
    const open=el('a','Открыть банк','cafe-payment-open');open.rel='noopener noreferrer';open.target='_blank';
    function updateLink(){const url=new URL('https://dl.vietqr.io/pay');url.search=new URLSearchParams({ba:payment.account+'@vcb',am:String(payment.amount),tn:payment.reference,app:selected,url:location.origin+location.pathname}).toString();open.href=url.href;qrLink.href=url.href;}
    banks.forEach(([value,name])=>{const button=el('button',name);button.type='button';button.setAttribute('aria-pressed',String(value===selected));button.onclick=()=>{selected=value;summary.textContent=name;chooser.open=false;list.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));updateLink();summary.focus();};list.append(button);});
    chooser.append(summary,list);updateLink();dialog.append(label,chooser,open);
    dialog.append(el('p','Заполнение перевода по ссылке зависит от банка и телефона. Если реквизиты не появились — используйте QR или скопируйте счёт.','cafe-payment-help'),el('p','После перевода дождитесь подтверждения кафе. Повторно не оплачивайте заказ.','cafe-payment-notice'));
    dialog.append(receiptForm(payment.orderId));
  }
  async function show(orderId) {
    const sheet=ensureDialog();if(sheet.open)sheet.close();sheet.replaceChildren();heading();const status=el('p','Загружаем реквизиты…');status.setAttribute('role','status');sheet.append(status);sheet.showModal();const request=++sequence;
    try {
      const initData=window.Telegram?.WebApp?.initData;if(!initData)throw Error('Откройте приложение через Telegram.');
      const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'paymentDetails',initData,orderId}),cache:'no-store',signal:window.AbortSignal?.timeout?.(12000)});
      const data=await response.json();if(request!==sequence||!sheet.open)return;
      if(!response.ok||!data.ok)throw Error(data.error||'Не удалось загрузить оплату');
      status.remove();render(data.payment);
    }catch(error){if(request===sequence&&sheet.open){status.textContent=error.message||'Не удалось загрузить оплату';if(!status.isConnected)sheet.append(status);}}
  }
  document.addEventListener('click',event=>{const button=event.target.closest('[data-pay-order]');if(button)show(button.dataset.payOrder);});
  window.ummaCafePayment={show,button:id=>/^[0-9a-f-]{36}$/i.test(String(id))?'<button type="button" class="cafe-payment-open" data-pay-order="'+id+'">Оплатить по QR</button>':''};
})();
