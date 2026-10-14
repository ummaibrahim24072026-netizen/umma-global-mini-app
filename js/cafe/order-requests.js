/* Preserve an operation key across lost responses and page reloads. Never store Telegram credentials. */
(() => {
  'use strict';
  const base='https://zwzojugspldexyyljwpr.supabase.co/functions/v1/';
  const allowed=new Set([base+'create-cafe-order',base+'cafe-kitchen']);
  let inFlight=false;
  const storageKey=()=>{
    const id=window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if(!id)throw new Error('Откройте приложение через Telegram.');
    return 'umma:cafe-operation:'+id;
  };
  const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?
    Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
  function pending(){
    const raw=sessionStorage.getItem(storageKey());
    if(!raw)return null;
    const value=JSON.parse(raw);
    if(!allowed.has(value.url)||typeof value.requestKey!=='string'||!value.payload)throw new Error('Не удалось восстановить незавершённый заказ. Обратитесь к администратору.');
    return value;
  }
  async function request(url,payload){
    if(!allowed.has(url))throw new Error('Недопустимый адрес операции кафе.');
    if(inFlight)throw new Error('Предыдущий запрос ещё выполняется.');
    const {initData,requestKey:ignored,...draft}=payload;
    const fingerprint=JSON.stringify(canonical({url,payload:draft}));
    let operation=pending();
    if(operation&&operation.fingerprint!==fingerprint)throw new Error('Сначала нажмите «Проверить прежний заказ»: результат предыдущего запроса ещё неизвестен.');
    if(!operation){
      operation={url,payload:draft,requestKey:crypto.randomUUID(),fingerprint};
      // A storage failure must stop BEFORE the request, otherwise a safe retry cannot be guaranteed.
      sessionStorage.setItem(storageKey(),JSON.stringify(operation));
    }
    inFlight=true;render();
    try {
      const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...draft,initData,requestKey:operation.requestKey}),signal:AbortSignal.timeout(25000)});
      let result;
      try{result=await response.clone().json();}catch{return response;}
      if((response.ok&&result.ok===true)||(response.status>=400&&response.status<500&&result.ok===false))sessionStorage.removeItem(storageKey());
      return response;
    }finally{inFlight=false;render();}
  }
  function render(){
    let operation;
    try{operation=pending();}catch{return;}
    for(const [id,staff] of [['cafePage',false],['staffOrderFormWrap',true],['cafeKitchenPage',true]]){
      const root=document.getElementById(id);if(!root)continue;
      let panel=root.querySelector('[data-cafe-recovery]');
      if(!panel){
        panel=document.createElement('div');panel.dataset.cafeRecovery='';panel.className='cafe-message';panel.hidden=true;
        const text=document.createElement('p');text.textContent='Связь с кафе могла прерваться. Проверьте прежний заказ перед оформлением нового.';
        const button=document.createElement('button');button.type='button';button.className='cafe-submit';button.textContent='Проверить прежний заказ';
        const message=document.createElement('p');message.setAttribute('role','status');
        button.addEventListener('click',async()=>{
          try{
            const saved=pending();if(!saved)return;
            const response=await request(saved.url,{...saved.payload,initData:window.Telegram?.WebApp?.initData});
            const result=await response.json();
            if(!response.ok||!result.ok)throw new Error(result.error||'Результат заказа пока неизвестен.');
            document.dispatchEvent(new CustomEvent('umma:cafe-operation-recovered',{detail:{result,payload:saved.payload}}));
          }catch(error){message.textContent=error.message;}
        });
        panel.append(text,button,message);root.prepend(panel);
      }
      const isStaff=operation&&(operation.payload.staffOrder===true||['addItems','refundOrder','uploadDeliveryProof'].includes(operation.payload.action));
      panel.hidden=!operation||!!isStaff!==staff;
      const isPhoto=operation?.payload.action==='uploadDeliveryProof';
      const isRefund=operation?.payload.action==='refundOrder';
      panel.querySelector('p').textContent=isRefund?'Связь могла прерваться после записи возврата. Проверьте запись; повторно выдавать деньги гостю не нужно.':'Связь с кафе могла прерваться. Проверьте прежний заказ перед оформлением нового.';
      panel.querySelector('button').textContent=isRefund?'Проверить запись возврата':'Проверить прежний заказ';
      if(isPhoto){panel.querySelector('p').textContent='Фото могло сохраниться до обрыва связи. Проверьте запись перед повторной загрузкой.';panel.querySelector('button').textContent='Проверить сохранение фото';}
      panel.querySelector('button').disabled=inFlight;
    }
  }
  window.ummaCafeRequests={request,pending,render};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render);else render();
})();
