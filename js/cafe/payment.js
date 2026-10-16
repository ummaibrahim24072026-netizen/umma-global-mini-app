/* VietQR is rendered locally; opening a bank never confirms payment. */
(() => {
  'use strict';
  const endpoint = 'https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-my-orders';
  const proofEndpoint = 'https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-transfer-proof';
  const uploads=new Map();
  const banks = [['vcb','Vietcombank'],['mb','MB Bank'],['bidv','BIDV'],['acb','ACB ONE'],['ocb','OCB OMNI'],['icb','VietinBank']];
  let dialog, sequence = 0, activeOrder = null, paymentOpened = false;
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
      try{await upload;showSaved([{status:'pending'}]);selected=null;input.value='';preview.hidden=true;preview.removeAttribute('src');send.textContent='Чек отправлен';if(section.isConnected&&dialog.open){dialog.close();if(typeof showToast==='function')showToast('Скриншот отправлен. Ожидайте проверки кафе.');}}
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
  function disclosure(label,className,build) {
    const details=el('details',null,className),summary=el('summary',label);details.append(summary);
    let built=false;details.addEventListener('toggle',()=>{if(details.open&&!built){built=true;build(details);}});return details;
  }
  function render(payment) {
    if(!payment || !/^\d{6,19}$/.test(payment.account) || !Number.isSafeInteger(payment.amount) || payment.amount<=0 || typeof payment.qrPayload!=='string' || payment.bankCode!=='vcb')throw Error('Некорректные реквизиты');
    dialog.append(el('p','Заказ №'+payment.orderNumber,'cafe-payment-meta'),el('p',money(payment.amount),'cafe-payment-amount'));
    const label=el('p','Ваш банк','cafe-payment-bank'),chooser=el('details',null,'cafe-payment-chooser'),summary=el('summary'),list=el('div',null,'cafe-payment-banks');
    let selected='vcb';try{const saved=localStorage.getItem('umma-payment-bank');if(banks.some(([id])=>id===saved))selected=saved;}catch{}
    const open=el('a','Оплатить','cafe-payment-open');open.rel='noopener noreferrer';open.target='_blank';open.dataset.bankPay='';
    const status=el('p','Оплата подтвердится автоматически. Скриншот не нужен.','cafe-payment-live');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const qrPrimary=el('section',null,'cafe-payment-qr-primary');
    const qrDetails=disclosure('Показать QR-код','cafe-payment-alternative',details=>buildQr(details,false));
    function buildQr(container,primary) {
      const qr=qrcode(0,'M');qr.addData(payment.qrPayload);qr.make();
      const count=qr.getModuleCount(),scale=8,padding=4,canvas=document.createElement('canvas');canvas.width=canvas.height=(count+padding*2)*scale;
      const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.fillStyle='#000';
      for(let y=0;y<count;y++)for(let x=0;x<count;x++)if(qr.isDark(y,x))context.fillRect((x+padding)*scale,(y+padding)*scale,scale,scale);
      const image=el('img',null,'cafe-payment-qr');image.src=canvas.toDataURL('image/png');image.alt='VietQR для оплаты заказа №'+payment.orderNumber;
      const save=el('button',primary?'Сохранить QR для оплаты':'Сохранить QR',primary?'cafe-payment-open':'cafe-payment-save');save.type='button';save.dataset.saveQr='';
      const saveStatus=el('p',null,'cafe-payment-help');saveStatus.setAttribute('role','status');saveStatus.setAttribute('aria-live','polite');
      let saving=false;
      save.onclick=async()=>{
        if(saving)return;saving=true;save.disabled=true;save.setAttribute('aria-busy','true');saveStatus.textContent='Подготавливаем QR…';
        try {
          const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'paymentDetails',initData:window.Telegram?.WebApp?.initData,orderId:payment.orderId}),cache:'no-store',signal:window.AbortSignal?.timeout?.(12000)});
          const data=await response.json();if(!response.ok||!data.ok)throw Error(data.error||'Не удалось подготовить QR');
          if(!save.isConnected||!dialog.open)return;
          if(data.payment?.qrPayload!==payment.qrPayload)throw Error('Заказ изменился. Закройте оплату и откройте её снова.');
          const url=new URL(data.payment.downloadUrl),api=new URL(endpoint);
          if(url.origin!==api.origin||url.pathname!==api.pathname||!url.searchParams.has('qr')||!url.searchParams.has('sig'))throw Error('Не удалось получить ссылку на QR');
          const webApp=window.Telegram?.WebApp,fileName='UMMA-'+payment.orderNumber+'.png';
          if(typeof webApp?.downloadFile==='function'&&(typeof webApp.isVersionAtLeast!=='function'||webApp.isVersionAtLeast('8.0'))){
            saveStatus.textContent='Подтвердите сохранение изображения в Telegram.';
            await new Promise((resolve,reject)=>{try{webApp.downloadFile({url:url.href,file_name:fileName},accepted=>{if(save.isConnected)saveStatus.textContent=accepted?'Скачивание запрошено. После загрузки выберите QR в банке: QR → изображение из галереи или файлов.':'Сохранение отменено. Нажмите ещё раз, чтобы повторить.';resolve();});}catch(error){reject(error);}});
          }else{
            const link=el('a');link.href=url.href;link.download=fileName;link.target='_blank';link.rel='noopener noreferrer';document.body.append(link);link.click();link.remove();
            saveStatus.textContent='Открыта загрузка PNG. Если Telegram её блокирует, откройте мини-приложение в браузере и повторите сохранение.';
          }
        }catch(error){saveStatus.textContent=(error.message||'Не удалось сохранить QR')+'. Попробуйте ещё раз.';}
        finally{saving=false;save.disabled=false;save.removeAttribute('aria-busy');}
      };
      container.append(image,save,saveStatus);
      if(primary){
        const steps=el('ol',null,'cafe-payment-steps');
        ['Сохраните QR на телефон или сделайте скриншот.','Откройте Vietcombank → QR → выберите изображение из галереи.','Проверьте получателя и подтвердите перевод.'].forEach(text=>steps.append(el('li',text)));
        container.append(steps);
      }
      container.append(el('p',primary?'Сумма и номер заказа уже в QR. Не меняйте их при оплате.':'Выберите сохранённый QR в сканере банка. Сумма и номер заказа уже указаны.','cafe-payment-help'));
    }
    function updateLink(){
      summary.textContent=banks.find(([id])=>id===selected)[1];
      const useQr=selected==='vcb';open.hidden=useQr;qrPrimary.hidden=!useQr;qrDetails.hidden=useQr;
      if(useQr){open.removeAttribute('href');qrDetails.open=false;if(!qrPrimary.childElementCount)buildQr(qrPrimary,true);}
      else{const url=new URL('https://dl.vietqr.io/pay');url.search=new URLSearchParams({ba:payment.account+'@vcb',am:String(payment.amount),tn:payment.reference,app:selected,url:location.origin+location.pathname}).toString();open.href=url.href;}
    }
    banks.forEach(([value,name])=>{const button=el('button',name);button.type='button';button.setAttribute('aria-pressed',String(value===selected));button.onclick=()=>{selected=value;try{localStorage.setItem('umma-payment-bank',value);}catch{}chooser.open=false;list.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));updateLink();summary.focus();};list.append(button);});
    chooser.append(summary,list);updateLink();
    let lastOpen=0;
    open.onclick=event=>{
      if(selected==='vcb'){event.preventDefault();return;}
      if(lastOpen&&Date.now()-lastOpen<1500){event.preventDefault();return;}
      lastOpen=Date.now();paymentOpened=true;open.textContent='Открыть банк снова';dialog.dataset.paymentState='waiting';status.textContent='Ждём подтверждение банка… Если уже оплатили, не переводите повторно.';
      const webApp=window.Telegram?.WebApp;
      if(typeof webApp?.openLink==='function'){event.preventDefault();try{webApp.openLink(open.href);}catch{window.location.assign(open.href);}}
    };
    dialog.append(label,chooser,open,qrPrimary,status);
    const help=disclosure('Оплатили, но статус не изменился?','cafe-payment-alternative cafe-payment-support',details=>{
      details.append(el('p','Не оплачивайте повторно. Если изменили сумму или назначение, автоматическое подтверждение не сработает. Отправьте скриншот: сотрудник проверит поступление и поможет с разницей в сумме.','cafe-payment-help'),receiptForm(payment.orderId));
    });
    dialog.append(qrDetails,help);
  }
  async function show(orderId) {
    activeOrder=orderId;paymentOpened=false;
    const sheet=ensureDialog();if(sheet.open)sheet.close();sheet.replaceChildren();sheet.dataset.paymentState='pending';heading();const status=el('p','Загружаем реквизиты…');status.setAttribute('role','status');sheet.append(status);sheet.showModal();const request=++sequence;
    try {
      const initData=window.Telegram?.WebApp?.initData;if(!initData)throw Error('Откройте приложение через Telegram.');
      const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'paymentDetails',initData,orderId}),cache:'no-store',signal:window.AbortSignal?.timeout?.(12000)});
      const data=await response.json();if(request!==sequence||!sheet.open)return;
      if(!response.ok||!data.ok)throw Error(data.error||'Не удалось загрузить оплату');
      status.remove();render(data.payment);
    }catch(error){if(request===sequence&&sheet.open){status.textContent=error.message||'Не удалось загрузить оплату';if(!status.isConnected)sheet.append(status);}}
  }
  document.addEventListener('umma:cafe-events',event=>{
    if(!dialog?.open||!activeOrder)return;
    if(event.detail?.events?.some(n=>n.order_id===activeOrder&&n.kind==='payment'))checkPaid();
  });
  let checking=false;
  async function checkPaid(){
    if(checking||!dialog?.open||!activeOrder||document.hidden)return;
    checking=true;const orderId=activeOrder,request=sequence;
    try{const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({initData:window.Telegram?.WebApp?.initData}),cache:'no-store',signal:AbortSignal.timeout(10000)});
      const data=await response.json();if(!response.ok||!data.ok)throw Error('Payment status unavailable');
      if(response.ok&&data.ok&&dialog.open&&request===sequence&&data.orders?.some(o=>o.id===orderId&&o.payment_status==='paid')){
        sequence++;dialog.replaceChildren();dialog.dataset.paymentState='paid';heading();const success=el('p','✓ Оплачено','cafe-payment-amount');success.setAttribute('role','status');success.setAttribute('aria-live','polite');dialog.append(success,el('p','Спасибо! Оплата заказа подтверждена.','cafe-payment-help'));activeOrder=null;paymentOpened=false;window.ummaCafe?.refreshMyOrders({silent:true});
      }else if(request===sequence&&dialog.open){const status=dialog.querySelector('.cafe-payment-live');if(status)status.textContent=paymentOpened?'Ждём подтверждение банка… Если уже оплатили, не переводите повторно.':'Оплата подтвердится автоматически. Скриншот не нужен.';}
    }catch{if(request===sequence&&dialog?.open){const status=dialog.querySelector('.cafe-payment-live');if(status)status.textContent='Нет связи. Проверим оплату автоматически после восстановления.';}}finally{checking=false;}
  }
  window.setInterval(checkPaid,3000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(paymentOpened){const status=dialog?.querySelector('.cafe-payment-live');if(status)status.textContent='Проверяем поступление оплаты…';}checkPaid();}});
  document.addEventListener('click',event=>{const button=event.target.closest('[data-pay-order]');if(button)show(button.dataset.payOrder);});
  window.ummaCafePayment={show,button:id=>/^[0-9a-f-]{36}$/i.test(String(id))?'<button type="button" class="cafe-payment-open" data-pay-order="'+id+'">Оплатить</button>':''};
})();
