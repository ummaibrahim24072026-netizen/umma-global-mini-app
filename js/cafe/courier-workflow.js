/* Courier offers and private delivery evidence; confirmed pickup starts delivery GPS. */
(() => {
 'use strict';
 const endpoint='https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-kitchen';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
 async function api(payload){const initData=(window.ummaStaffAuth?.credential()||window.Telegram?.WebApp?.initData);if(!initData)throw Error('Откройте приложение через Telegram');const response=payload.action==='uploadDeliveryProof'?await window.ummaCafeRequests.request(endpoint,{...payload,initData}):await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,initData}),signal:AbortSignal.timeout(15000)});const result=await response.json();if(!response.ok||!result.ok){const error=Error(result.error||'Операция доставки не выполнена');error.status=response.status;throw error;}return result;}
 let busy=false,lastOfferSignature='';
 const completing=new Map();
 let retryTimer=null, transitionQueue=null;
 const transitionKey=()=> 'umma:courier-photo-transition:'+String((window.ummaStaffAuth?.actorId()||window.Telegram?.WebApp?.initDataUnsafe?.user?.id)||'');
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
    if(kind==='handover' && window.ummaCourierTracking?.isSharing(orderId)) await window.ummaCourierTracking.stop().catch(()=>{});
    await window.ummaKitchen.refresh({afterMutation:true}).catch(()=>{});
    if(kind==='pickup' && state.deliveryStatus==='picked_up' && !['completed','cancelled'].includes(state.status)) await window.ummaCourierTracking?.start(orderId);
    message(kind==='pickup'?'Фото сохранено. Заказ получен курьером.':'Заказ передан. Фото сохранено.');
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
 async function respond(id,accept,reason=null,button=null,market=false){if(busy)return;busy=true;const label=button?.textContent;if(button){button.disabled=true;button.textContent=accept?'Принимаем…':'Отправляем…';button.setAttribute('aria-busy','true');}message(accept?'Принимаем доставку…':'Отправляем отказ…');try{await api({action:'respondCourierOffer',orderId:id,accept,reason,market});if(accept)window.ummaCourierDesk?.showTab('work');await window.ummaKitchen.refresh({afterMutation:true});if(document.getElementById('webOverview'))message(accept?'Доставка принята.':'Отказ отправлен.');}catch(e){message(e.message);const feedback=button?.closest('article')?.querySelector('[data-courier-offer-feedback]');if(feedback)feedback.textContent=e.message;}finally{busy=false;lastOfferSignature='';if(button?.isConnected){button.disabled=false;button.textContent=label;button.removeAttribute('aria-busy');}await window.ummaKitchen.refresh();}}
 function decline(id){if(busy||document.querySelector('.cafe-refund-dialog'))return;const dialog=document.createElement('dialog');dialog.className='cafe-refund-dialog';dialog.innerHTML='<form class="cafe-order-form"><h3>Причина отказа</h3><label>Причина<textarea minlength="3" maxlength="500" required></textarea></label><div class="kitchen-order-actions"><button type="button">Назад</button><button type="submit" class="kitchen-cancel">Отправить отказ</button></div><p role="status"></p></form>';document.body.append(dialog);dialog.showModal();dialog.querySelector('[type="button"]').onclick=()=>dialog.remove();dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();const reason=dialog.querySelector('textarea').value.trim();if(reason.length<3)return;dialog.remove();await respond(id,false,reason);};}
 function readPhoto(file){
  return new Promise((resolve,reject)=>{
   const reader=new FileReader();
   reader.onload=()=>resolve(reader.result);
   reader.onerror=()=>reject(Error('Не удалось прочитать фотографию'));
   reader.readAsDataURL(file);
  });
 }
 function encodePhoto(source,width,height){
  if(!width||!height)throw Error('Не удалось открыть фотографию');
  const canvas=document.createElement('canvas');
  try{
   // Bound the encoded image so a photo and its retry data fit in session storage.
   for(const edge of [1280,960,640]){
    const scale=Math.min(1,edge/Math.max(width,height));
    canvas.width=Math.max(1,Math.round(width*scale));
    canvas.height=Math.max(1,Math.round(height*scale));
    canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);
    const photo=canvas.toDataURL('image/jpeg',0.78).split(',')[1];
    if(photo && photo.length<=350000)return photo;
   }
   throw Error('Не удалось подготовить снимок. Сделайте другое фото.');
  }finally{canvas.width=0;canvas.height=0;}
 }
 async function jpeg(file){
  if(!file?.size || (file.type&&!file.type.startsWith('image/')))throw Error('Выберите фотографию');
  if(file.size>20000000)throw Error('Исходное фото слишком большое');
  const canUseObjectUrl=typeof URL.createObjectURL==='function';
  const url=canUseObjectUrl?URL.createObjectURL(file):await readPhoto(file);
  try{
   const image=await new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>resolve(img);
    img.onerror=()=>reject(Error('Не удалось открыть фотографию. Сделайте новый снимок или выберите JPEG.'));
    img.src=url;
   });
   return encodePhoto(image,image.naturalWidth||image.width,image.naturalHeight||image.height);
  }finally{if(canUseObjectUrl)URL.revokeObjectURL(url);}
 }
 async function confirmPhoto(imageBase64,kind,sendPhoto){
  const dialog=document.createElement('dialog');
  dialog.className='cafe-refund-dialog courier-photo-preview';
  dialog.innerHTML='<form method="dialog"><h3>'+(kind==='pickup'?'Фото заказа':'Фото вручения')+'</h3>'+
   '<img alt="Снимок для подтверждения доставки"><div class="kitchen-order-actions">'+
   '<button type="submit" class="kitchen-action" value="send">Отправить фото</button>'+
   '<button type="button" class="kitchen-cancel" value="cancel">Назад</button></div><p role="status"></p></form>';
  dialog.setAttribute('aria-label',kind==='pickup'?'Подтвердить получение':'Подтвердить вручение');
  dialog.querySelector('img').src='data:image/jpeg;base64,'+imageBase64;
  const send=dialog.querySelector('[value="send"]');
  const back=dialog.querySelector('[value="cancel"]');
  const status=dialog.querySelector('[role="status"]');
  document.body.append(dialog);
  try{
   return await new Promise(resolve=>{
    back.onclick=()=>resolve(false);
    dialog.addEventListener('cancel',event=>{event.preventDefault();if(!send.disabled)resolve(false);});
    dialog.querySelector('form').onsubmit=async event=>{
     event.preventDefault();
     if(send.disabled)return;
     send.disabled=back.disabled=true;
     status.textContent='Отправляем фото…';
     try{
      await sendPhoto(imageBase64);
      resolve(true);
     }catch(error){
      status.textContent='Не удалось отправить фото: '+error.message;
      send.textContent='Повторить отправку';
      send.disabled=back.disabled=false;
     }
    };
    dialog.showModal();
   });
  }finally{dialog.remove();}
 }
 function openCamera(title,processPhoto,openFile,cleanup){
  const camera=document.createElement('dialog');
  camera.className='cafe-refund-dialog courier-photo-preview';
  camera.setAttribute('aria-label',title);
  camera.innerHTML='<h3></h3><video autoplay muted playsinline hidden></video><p role="status">Открываем камеру…</p>'+
   '<div class="kitchen-order-actions"><button type="button" class="kitchen-action" data-take-photo disabled>Сделать снимок</button>'+
   '<button type="button" class="kitchen-action" data-choose-photo>Выбрать фото</button>'+
   '<button type="button" class="kitchen-cancel" data-close-camera>Назад</button></div>';
  camera.querySelector('h3').textContent=title;
  const video=camera.querySelector('video');
  const take=camera.querySelector('[data-take-photo]');
  const status=camera.querySelector('[role="status"]');
  let stream;
  const close=()=>{
   stream?.getTracks().forEach(track=>track.stop());
   video.srcObject=null;
   camera.remove();
  };
  camera.querySelector('[data-close-camera]').onclick=()=>{close();cleanup();};
  camera.addEventListener('cancel',event=>{event.preventDefault();close();cleanup();});
  camera.querySelector('[data-choose-photo]').onclick=()=>{close();openFile();};
  video.addEventListener('loadeddata',()=>{
   take.disabled=false;
   video.hidden=false;
   status.textContent='';
  });
  take.onclick=()=>{
   try{
    const image=encodePhoto(video,video.videoWidth,video.videoHeight);
    close();
    void processPhoto(()=>image);
   }catch(error){status.textContent=error.message;}
  };
  document.body.append(camera);
  camera.showModal();
  navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false}).then(result=>{
   if(!camera.isConnected){result.getTracks().forEach(track=>track.stop());return;}
   stream=result;
   video.srcObject=stream;
  }).catch(()=>{
   if(camera.isConnected)status.textContent='Камера недоступна. Выберите фото.';
  });
 }
 let cameraInput=null;
 async function photo(id,kind,button){
  if(busy||completing.has(id)||cameraInput)return;
  const web=!!document.getElementById('webOverview');
  const input=document.createElement('input');cameraInput=input;
  input.type='file';input.accept='image/*';input.hidden=true;
  if(!web||!navigator.mediaDevices?.getUserMedia)input.setAttribute('capture','environment');
  input.dataset.courierCamera=id;
  const label=button.textContent;
  button.disabled=true;button.textContent='Выберите или сделайте фото…';
  const stepMessage=text=>{message(text);document.querySelectorAll('[data-courier-step-status]').forEach(el=>{if(el.dataset.courierStepStatus===id)el.textContent=text;});};
  const cleanup=()=>{input.remove();if(cameraInput===input)cameraInput=null;if(button.isConnected){button.disabled=false;button.textContent=label;button.removeAttribute('aria-busy');}};
  const sendPhoto=async imageBase64=>{
   const result=await api({action:'uploadDeliveryProof',orderId:id,kind,imageBase64});
   rememberTransition(id,kind);
   await completePhoto(id,kind,result.order,result.proof);
  };
  const processPhoto=async prepare=>{
   if(busy){cleanup();return;}
   busy=true;button.textContent='Сохраняем фото…';button.setAttribute('aria-busy','true');
   try{
    const imageBase64=await prepare();
    if(web)await confirmPhoto(imageBase64,kind,sendPhoto);
    else await sendPhoto(imageBase64);
   }catch(error){stepMessage('Фото не подтверждено: '+error.message);}
   finally{busy=false;cleanup();}
  };
  const openFile=()=>{
   try{input.click();}catch(error){stepMessage(error.message);cleanup();}
  };
  input.oncancel=cleanup;
  input.onchange=()=>{
   const file=input.files?.[0];
   if(!file){cleanup();return;}
   void processPhoto(()=>jpeg(file));
  };
  document.body.append(input);
  try{
   const pending=web?window.ummaCafeRequests?.pending?.()?.payload:null;
   if(pending?.action==='uploadDeliveryProof'&&pending.orderId===id&&pending.kind===kind){
    void processPhoto(()=>pending.imageBase64);
   }else if(web&&navigator.mediaDevices?.getUserMedia)openCamera(kind==='pickup'?'Фото заказа':'Фото вручения',processPhoto,openFile,cleanup);
   else openFile();
  }catch(error){stepMessage(error.message);cleanup();}
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
