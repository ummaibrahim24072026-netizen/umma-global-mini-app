/* Courier offers and private delivery evidence; confirmed pickup starts delivery GPS. */
(() => {
 'use strict';
 const endpoint='https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-kitchen';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
 async function api(payload){const initData=window.Telegram?.WebApp?.initData;if(!initData)throw Error('Откройте приложение через Telegram');const response=payload.action==='uploadDeliveryProof'?await window.ummaCafeRequests.request(endpoint,{...payload,initData}):await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,initData}),signal:AbortSignal.timeout(15000)});const result=await response.json();if(!response.ok||!result.ok){const error=Error(result.error||'Операция доставки не выполнена');error.status=response.status;throw error;}return result;}
 let busy=false,lastOfferSignature='';
 const completing=new Map();
 let retryTimer=null, transitionQueue=null;
 const transitionKey=()=> 'umma:courier-photo-transition:'+String(window.Telegram?.WebApp?.initDataUnsafe?.user?.id||'');
 function pendingTransitions(){
  if(transitionQueue!==null)return transitionQueue;
  try { const value=JSON.parse(sessionStorage.getItem(transitionKey())||'[]');transitionQueue=Array.isArray(value)?value.filter(x=>typeof x.orderId==='string'&&['pickup','handover'].includes(x.kind)):[]; } catch { transitionQueue=[]; }
  return transitionQueue;
 }
 function rememberTransition(orderId,kind){
  const pending=pendingTransitions().filter(x=>x.orderId!==orderId);pending.push({orderId,kind});
  transitionQueue=pending;
  try {sessionStorage.setItem(transitionKey(),JSON.stringify(pending));}catch{}
 }
 function forgetTransition(orderId){
  const pending=pendingTransitions().filter(x=>x.orderId!==orderId);
  transitionQueue=pending;
  try {if(pending.length)sessionStorage.setItem(transitionKey(),JSON.stringify(pending));else sessionStorage.removeItem(transitionKey());}catch{}
 }
 function scheduleTransitions(){
  if(retryTimer)return;
  retryTimer=setTimeout(()=>{retryTimer=null;void resumeTransitions();},10000);
 }
 async function completePhoto(orderId,kind,confirmedOrder=null,proof=null){
  if(completing.has(orderId))return completing.get(orderId);
  const task=(async()=>{
   try {
    const target=kind==='pickup'?'picked_up':'delivered';
    const committed=confirmedOrder && (confirmedOrder.deliveryStatus===target || confirmedOrder.status==='completed');
    const result=committed?{order:confirmedOrder}:await api({action:'updateDelivery',orderId,deliveryStatus:target});
    const state=result.order||{deliveryStatus:target};
    window.ummaKitchen?.applyCourierState?.(orderId,state,proof);
    forgetTransition(orderId);
    if(kind==='handover' && window.ummaCourierTracking?.isSharing(orderId)) await window.ummaCourierTracking.stop();
    await window.ummaKitchen.refresh({afterMutation:true}).catch(()=>{});
    if(kind==='pickup' && state.deliveryStatus==='picked_up' && !['completed','cancelled'].includes(state.status)) await window.ummaCourierTracking?.start(orderId);
    message(kind==='pickup'?'Фото сохранено. Заказ получен курьером.':'Фото сохранено. Заказ вручён клиенту.');
   } catch(error) {
    message('Фото сохранено. '+(error.status>=400&&error.status<500?'Не удалось подтвердить этап: '+error.message:'Подтверждаем этап доставки после восстановления связи…'));
    if(error.status>=400&&error.status<500)forgetTransition(orderId);else scheduleTransitions();
    await window.ummaKitchen.refresh().catch(()=>{});
   }
  })();
  completing.set(orderId,task);
  try {await task;}finally{completing.delete(orderId);}
 }
 async function resumeTransitions(){
  if(busy||document.hidden){if(pendingTransitions().length)scheduleTransitions();return;}
  for(const pending of pendingTransitions())await completePhoto(pending.orderId,pending.kind);
 }
 window.addEventListener('online',()=>void resumeTransitions());
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void resumeTransitions();});
 // Resume only a recorded successful upload, never a cancelled camera selection.
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>void resumeTransitions(),{once:true});else void resumeTransitions();
 function message(text){const own=document.getElementById('courierDeskMessage')||document.getElementById('courierWorkflowMessage');const root=own&&!document.getElementById('courierOffers')?.hidden?own:document.getElementById('cafeKitchenMessage');if(root){root.hidden=false;root.textContent=text;}}
 function renderOffers(offers,role,board=null){const root=document.getElementById('courierOffers');if(!root)return;root.hidden=role!=='courier';if(root.hidden){lastOfferSignature='';return;}const signature=JSON.stringify({offers,board});if(signature===lastOfferSignature||busy)return;lastOfferSignature=signature;
 if(window.ummaCourierDesk){window.ummaCourierDesk.render(offers,board);return;}
 root.innerHTML='<h2>Предложения доставок</h2><p>Заказ получит первый подтвердивший курьер. Отказ требует причины.</p><button type="button" id="courierGeoOnce" class="kitchen-action">Обновить геопозицию для подбора на 10 минут</button><div id="courierWorkflowMessage" role="status"></div>'+offers.map(o=>'<article class="kitchen-order-card"><strong>Доставка №'+esc(o.orderNumber)+'</strong><p>'+esc(o.locationName)+' · '+esc(o.kitchenStatus==='ready'?'Готов':'Готовится')+'</p><div class="kitchen-order-actions"><button class="kitchen-action" data-courier-accept="'+esc(o.orderId)+'">Принять доставку</button><button class="kitchen-cancel" data-courier-decline="'+esc(o.orderId)+'">Отказаться с причиной</button></div></article>').join('');
 }
 async function respond(id,accept,reason=null,button=null,market=false){if(busy)return;busy=true;const label=button?.textContent;if(button){button.disabled=true;button.textContent=accept?'Принимаем…':'Отправляем…';button.setAttribute('aria-busy','true');}message(accept?'Принимаем доставку…':'Отправляем отказ…');try{await api({action:'respondCourierOffer',orderId:id,accept,reason,market});if(accept)window.ummaCourierDesk?.showTab('work');await window.ummaKitchen.refresh({afterMutation:true});}catch(e){message(e.message);const feedback=button?.closest('article')?.querySelector('[data-courier-offer-feedback]');if(feedback)feedback.textContent=e.message;}finally{busy=false;lastOfferSignature='';if(button?.isConnected){button.disabled=false;button.textContent=label;button.removeAttribute('aria-busy');}await window.ummaKitchen.refresh();}}
 function decline(id){if(busy||document.querySelector('.cafe-refund-dialog'))return;const dialog=document.createElement('dialog');dialog.className='cafe-refund-dialog';dialog.innerHTML='<form class="cafe-order-form"><h3>Причина отказа</h3><label>Причина<textarea minlength="3" maxlength="500" required></textarea></label><div class="kitchen-order-actions"><button type="button">Назад</button><button type="submit" class="kitchen-cancel">Отправить отказ</button></div><p role="status"></p></form>';document.body.append(dialog);dialog.showModal();dialog.querySelector('[type="button"]').onclick=()=>dialog.remove();dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();const reason=dialog.querySelector('textarea').value.trim();if(reason.length<3)return;dialog.remove();await respond(id,false,reason);};}
 async function jpeg(file){if(!file||!file.type.startsWith('image/'))throw Error('Выберите фотографию');if(file.size>20000000)throw Error('Исходное фото слишком большое');
  const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
  const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Не удалось открыть фотографию'));img.src=data;});
  const canvas=document.createElement('canvas'),scale=Math.min(1,1600/Math.max(image.width,image.height));canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
  // Re-encoding also removes device EXIF metadata; the server stamps actor/time/hash.
  return canvas.toDataURL('image/jpeg',0.8).split(',')[1];
 }
 let cameraInput=null;
 async function photo(id,kind,button){
  if(busy||completing.has(id)||cameraInput)return;
  const input=document.createElement('input');cameraInput=input;
  input.type='file';input.accept='image/*';input.setAttribute('capture','environment');input.hidden=true;
  input.dataset.courierCamera=id;
  const label=button.textContent;
  button.disabled=true;button.textContent='Выберите или сделайте фото…';
  const stepMessage=text=>{message(text);document.querySelectorAll('[data-courier-step-status]').forEach(el=>{if(el.dataset.courierStepStatus===id)el.textContent=text;});};
  const cleanup=()=>{input.remove();if(cameraInput===input)cameraInput=null;if(button.isConnected){button.disabled=false;button.textContent=label;button.removeAttribute('aria-busy');}};
  input.oncancel=cleanup;
  input.onchange=async()=>{
   if(busy||!input.files?.length){cleanup();return;}
   busy=true;button.textContent='Сохраняем фото…';button.setAttribute('aria-busy','true');
   try {
    stepMessage('Сохраняем фото…');
    const imageBase64=await jpeg(input.files[0]);
    const result=await api({action:'uploadDeliveryProof',orderId:id,kind,imageBase64});
    rememberTransition(id,kind);
    button.textContent=kind==='pickup'?'Подтверждаем получение…':'Подтверждаем вручение…';
    await completePhoto(id,kind,result.order,result.proof);
   }catch(e){stepMessage('Фото не подтверждено: '+e.message);}
   finally{busy=false;cleanup();}
  };
  // Keep a real, connected file input alive while the Telegram WebView opens its camera.
  document.body.append(input);
  try{input.click();}catch(e){stepMessage(e.message);cleanup();}
 }
 document.addEventListener('click',async event=>{const target=event.target.closest?.('button');if(!target)return;
 if(target.dataset.courierClaim)await respond(target.dataset.courierClaim,true,null,target,true);
 if(target.dataset.courierAccept)await respond(target.dataset.courierAccept,true,null,target);
 if(target.dataset.courierDecline)decline(target.dataset.courierDecline);
 if(target.dataset.deliveryPhoto)await photo(target.dataset.orderId,target.dataset.deliveryPhoto,target);
 if(target.dataset.viewProof){if(target.disabled)return;target.disabled=true;const label=target.textContent;target.textContent='Открываем фото…';try{const result=await api({action:'viewDeliveryProof',proofId:target.dataset.viewProof});const dialog=document.createElement('dialog');dialog.className='cafe-refund-dialog';const image=document.createElement('img');image.style.width='100%';image.alt='Фото доставки';image.referrerPolicy='no-referrer';image.src=result.url;const close=document.createElement('button');close.textContent='← Назад';close.onclick=()=>dialog.remove();dialog.append(close,image);document.body.append(dialog);dialog.showModal();}catch(e){message(e.message);}finally{target.disabled=false;target.textContent=label;}}
 if(target.id==='courierGeoOnce'){if(!navigator.geolocation){message('Геопозиция недоступна. Общие предложения всё равно доступны.');return;}if(target.disabled)return;const label=target.textContent;target.disabled=true;target.textContent='Определяем позицию…';const restore=()=>{target.disabled=false;target.textContent=label;};message('Запрашиваем геопозицию…');navigator.geolocation.getCurrentPosition(async p=>{try{await api({action:'courierPosition',latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy});message('Геопозиция обновлена; используется для подбора ближайшего курьера 10 минут.');}catch(e){message(e.message);}finally{restore();}},()=>{message('Геопозиция не получена. Вы можете принимать общие предложения.');restore();},{maximumAge:60000,timeout:10000,enableHighAccuracy:true});}
 });
 document.addEventListener('umma:cafe-operation-recovered',async event=>{const payload=event.detail.payload;if(payload.action==='uploadDeliveryProof'){rememberTransition(payload.orderId,payload.kind);await completePhoto(payload.orderId,payload.kind,event.detail.result?.order,event.detail.result?.proof);}});
 window.ummaCourierWorkflow={renderOffers};
})();
