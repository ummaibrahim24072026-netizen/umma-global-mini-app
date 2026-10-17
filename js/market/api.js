/* One retry-safe client for customer and staff Market operations. No credentials are stored. */
(() => {
 'use strict';
 const endpoint='https://zwzojugspldexyyljwpr.supabase.co/functions/v1/market-stock';
 const pending=new Map();
 try{for(const [k,v] of JSON.parse(sessionStorage.getItem('umma-market-requests')||'[]'))if(typeof k==='string'&&/^[a-f0-9-]{36}$/i.test(v))pending.set(k,v);}catch{}
 function message(value){
  const l=window.ummaI18n?.locale?.()||'ru',lang=l.startsWith('vi')?2:l.startsWith('en')?1:0;
  const strings={
   'Insufficient stock':['Недостаточно товара. Обновите каталог.','Insufficient stock. Refresh the catalogue.','Không đủ hàng. Hãy làm mới danh mục.'],
   'query returned no rows':['Товар или документ уже недоступен. Обновите страницу.','The item or document is no longer available. Refresh.','Hàng hoặc chứng từ không còn khả dụng. Hãy làm mới.'],
   'Open a cash shift before recording cash':['Откройте смену в разделе «Касса» перед приёмом наличных.','Open a shift in Cash before accepting cash.','Mở ca tại mục Quỹ trước khi nhận tiền mặt.'],
   'DELIVERY_OUTSIDE_ZONE':['Этот адрес вне зоны доставки. Выберите самовывоз или другой адрес.','This address is outside the delivery area. Choose pickup or another address.','Địa chỉ ngoài vùng giao hàng. Chọn tự lấy hoặc địa chỉ khác.'],
   'DELIVERY_POINT_REQUIRED':['Укажите точку доставки на карте.','Choose the delivery point on the map.','Chọn vị trí giao hàng trên bản đồ.'],
   'DELIVERY_UNAVAILABLE':['Доставка из этой точки недоступна. Доступен самовывоз.','Delivery is unavailable here. Choose pickup.','Điểm này chưa giao hàng. Vui lòng tự lấy.'],
   'Price changed; review the final total':['Цена изменилась. Проверьте новую итоговую сумму.','The price changed. Review the final total.','Giá đã thay đổi. Kiểm tra lại tổng tiền.'],
   'Market access denied':['Нет доступа к этому действию.','Access denied.','Không có quyền thực hiện.']
  };
  if(value?.startsWith('Wrong package. Required '))return ['Неверная упаковка. Требуется ','Wrong package. Required ','Sai gói hàng. Cần '][lang]+value.slice(24);
  return strings[value]?.[lang]||value;
 }
 function save(){try{sessionStorage.setItem('umma-market-requests',JSON.stringify([...pending].slice(-100)));}catch{}}
 async function call(action,data={},request_id){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
  try{
   const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,data,request_id,initData:window.Telegram?.WebApp?.initData||''}),signal:controller.signal,cache:'no-store'});
   const result=await r.json();if(!r.ok||!result.ok){const e=new Error(message(result.error)||'Не удалось выполнить операцию');e.confirmed=true;throw e;}return result;
  }finally{clearTimeout(timer);}
 }
 async function execute(action,data){
  const actor=window.Telegram?.WebApp?.initDataUnsafe?.user?.id||'guest',digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(data))),identity=actor+':'+action+':'+Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
  let key=pending.get(identity);if(!key){key=crypto.randomUUID();pending.set(identity,key);save();}
  try{const result=await call(action,data,key);pending.delete(identity);save();return result;}catch(e){if(e.confirmed){pending.delete(identity);save();}throw e;}
 }
 window.ummaMarketApi={call,execute};
})();
