(function(){
  "use strict";
  const API="https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-kitchen";
  const $=id=>document.getElementById(id);
  const roleNames={waiter:"Официант",cashier:"Кассир",kitchen:"Кухня",manager:"Менеджер",courier:"Курьер"};
  const statusNames={new:"Новый",confirmed:"Принят",preparing:"Готовится",ready:"Готов",completed:"Завершён",cancelled:"Отменён"};
  const deliveryNames={not_required:"Не требуется",waiting_courier:"Ожидает курьера",courier_assigned:"Курьер назначен",picked_up:"В пути",delivered:"Доставлен"};
  const money=v=>new Intl.NumberFormat("vi-VN",{style:"currency",currency:"VND",maximumFractionDigits:0}).format(Number(v)||0);
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let locations=[], locationId="", role="waiter", orders=[], shifts=[];
  async function call(action,extra={}){
    const initData=window.Telegram?.WebApp?.initData;
    if(!initData) throw new Error("Откройте приложение через Telegram.");
    const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({initData,action,locationId,testRole:role,...extra})});
    const data=await r.json();
    if(!r.ok||!data.ok) throw new Error(data.error||"Ошибка тестового режима");
    return data;
  }
  function message(s){const e=$("ummaSandboxMessage");if(e){e.textContent=s;e.hidden=!s;}}
  function build(){
    const page=$("cafeKitchenPage");if(!page||$("ummaSandboxPanel"))return;
    const panel=document.createElement("section");panel.id="ummaSandboxPanel";
    panel.style.cssText="margin:16px 0;padding:16px;border:2px solid #d2a84a;border-radius:16px;background:#fffdf6;color:#243333";
    panel.innerHTML='<div style="display:flex;gap:10px;align-items:flex-start"><div style="font-size:26px">🧪</div><div><h2 style="margin:0 0 4px">Тестовый режим суперадминистратора</h2><p style="margin:0 0 10px;font-size:13px">Все тестовые заказы, оплаты и смены хранятся отдельно. Реальные заказы и касса не изменяются.</p></div></div>'+
      '<div style="display:grid;gap:10px;margin:12px 0"><label>Кафе<select id="ummaSandboxLocation" style="display:block;width:100%;padding:10px;margin-top:4px;border:1px solid #ccd5d5;border-radius:8px"></select></label>'+
      '<label>Тестовая должность<select id="ummaSandboxRole" style="display:block;width:100%;padding:10px;margin-top:4px;border:1px solid #ccd5d5;border-radius:8px"><option value="waiter">Официант</option><option value="cashier">Кассир</option><option value="kitchen">Кухня</option><option value="manager">Менеджер</option><option value="courier">Курьер</option></select></label></div>'+
      '<div id="ummaSandboxMessage" hidden style="padding:10px;margin:8px 0;background:#fbe9e6;border-radius:8px;color:#8a2f24"></div>'+
      '<div id="ummaSandboxActions" style="display:grid;gap:10px"></div><div id="ummaSandboxOrders" style="margin-top:14px"></div><div id="ummaSandboxEvents" style="margin-top:14px"></div>';
    const header=page.querySelector(".cafe-kitchen-header");header?.after(panel);
    $("ummaSandboxLocation").addEventListener("change",async e=>{locationId=e.target.value;await refresh();});
    $("ummaSandboxRole").addEventListener("change",async e=>{role=e.target.value;renderActions();await refresh();});
    renderActions(); init();
  }
  function renderActions(){
    const root=$("ummaSandboxActions");if(!root)return;
    let html="";
    if(role==="waiter"||role==="manager"){
      html+='<form id="ummaSandboxCreate" style="display:grid;gap:8px;padding:12px;border:1px solid #e3e8e8;border-radius:12px"><strong>Создать тестовый заказ</strong><label>Сумма, VND<input id="ummaSandboxAmount" type="number" min="1000" step="1000" value="120000" required style="display:block;width:100%;padding:10px;margin-top:4px"></label><label>Тип<select id="ummaSandboxType" style="display:block;width:100%;padding:10px;margin-top:4px"><option value="dine_in">В кафе</option><option value="pickup">Самовывоз</option><option value="delivery">Доставка</option></select></label><label>Оплата<select id="ummaSandboxPaymentMethod" style="display:block;width:100%;padding:10px;margin-top:4px"><option value="cash">Наличные</option><option value="qr">QR</option></select></label><button class="cafe-submit" type="submit">＋ Создать тестовый заказ</button></form>';
    }
    if(role==="cashier"||role==="manager"){
      html+='<form id="ummaSandboxOpenShift" style="display:grid;gap:8px;padding:12px;border:1px solid #e3e8e8;border-radius:12px"><strong>Тестовая кассовая смена</strong><label>Начальная касса, VND<input id="ummaSandboxOpening" type="number" min="0" step="1000" value="0" required style="display:block;width:100%;padding:10px;margin-top:4px"></label><button class="cafe-submit" type="submit">Открыть тестовую смену</button></form>';
    }
    if(role==="manager") html+='<button id="ummaSandboxReset" type="button" style="padding:10px;border:1px solid #b94b40;background:#fff;color:#9b3028;border-radius:9px">Очистить тестовые данные этого кафе</button>';
    html+='<button id="ummaSandboxRefresh" type="button" style="padding:10px;border:1px solid #ccd5d5;background:#fff;border-radius:9px">↻ Обновить тестовые данные</button>';
    root.innerHTML=html;
    $("ummaSandboxCreate")?.addEventListener("submit",async e=>{e.preventDefault();try{await call("sandboxCreateOrder",{totalVnd:Number($("ummaSandboxAmount").value),orderType:$("ummaSandboxType").value,paymentMethod:$("ummaSandboxPaymentMethod").value,customerName:"Тестовый гость",note:"Создано в изолированном тестовом режиме"});message("Тестовый заказ создан. Реальные заказы не затронуты.");await refresh();}catch(err){message(err.message);}});
    $("ummaSandboxOpenShift")?.addEventListener("submit",async e=>{e.preventDefault();try{await call("sandboxOpenShift",{openingCashVnd:Number($("ummaSandboxOpening").value)});message("Тестовая смена открыта.");await refresh();}catch(err){message(err.message);}});
    $("ummaSandboxReset")?.addEventListener("click",async()=>{if(!confirm("Удалить все тестовые заказы, события и тестовые смены выбранного кафе? Реальные данные не затрагиваются."))return;try{await call("sandboxReset");message("Тестовые данные очищены.");await refresh();}catch(err){message(err.message);}});
    $("ummaSandboxRefresh")?.addEventListener("click",refresh);
  }
  async function init(){
    try{
      const data=await call("cashList");
      locations=data.locations||[];
      const select=$("ummaSandboxLocation");
      select.innerHTML=locations.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join("");
      locationId=locations[0]?.id||"";
      if(!locationId){message("Не найдено активное кафе для тестирования.");return;}
      select.value=locationId;await refresh();
    }catch(e){message(e.message);}
  }
  function orderActions(o){
    let buttons="";
    if((role==="cashier"||role==="manager")&&o.payment_status!=="paid") buttons+='<button data-sandbox-action="pay" data-id="'+esc(o.id)+'">Подтвердить тестовую оплату</button>';
    if(role==="cashier"||role==="manager"){
      if(o.status==="new")buttons+='<button data-sandbox-status="confirmed" data-id="'+esc(o.id)+'">Принять</button>';
      if(o.status!=="cancelled"&&o.status!=="completed")buttons+='<button data-sandbox-status="cancelled" data-id="'+esc(o.id)+'">Отменить</button>';
    }
    if(role==="kitchen"||role==="manager"){
      if(o.status==="confirmed"||o.status==="new")buttons+='<button data-sandbox-status="preparing" data-id="'+esc(o.id)+'">Начать готовить</button>';
      if(o.status==="preparing")buttons+='<button data-sandbox-status="ready" data-id="'+esc(o.id)+'">Отметить «Готов»</button>';
    }
    if(role==="courier"&&o.order_type==="delivery"){
      const next={waiting_courier:["courier_assigned","Назначить курьера"],courier_assigned:["picked_up","Забрал заказ"],picked_up:["delivered","Доставлено"]}[o.delivery_status];
      if(next)buttons+='<button data-sandbox-delivery="'+next[0]+'" data-id="'+esc(o.id)+'">'+next[1]+'</button>';
    }
    if(role==="waiter"&&o.status==="ready"&&o.payment_status==="paid"&&o.order_type!=="delivery")buttons+='<button data-sandbox-status="completed" data-id="'+esc(o.id)+'">Выдать / завершить</button>';
    if(role==="manager"&&o.status==="ready"&&o.payment_status==="paid"&&o.order_type!=="delivery")buttons+='<button data-sandbox-status="completed" data-id="'+esc(o.id)+'">Завершить</button>';
    if(role==="manager"&&o.order_type==="delivery"&&o.delivery_status==="delivered"&&o.payment_status==="paid"&&o.status==="ready")buttons+='<button data-sandbox-status="completed" data-id="'+esc(o.id)+'">Завершить</button>';
    return buttons;
  }
  async function refresh(){
    if(!locationId)return;
    try{
      const data=await call("sandboxList");orders=data.orders||[];shifts=data.shifts||[];
      const root=$("ummaSandboxOrders");
      root.innerHTML='<h3 style="margin:0 0 8px">Тестовые заказы ('+orders.length+')</h3>'+(orders.length?orders.map(o=>'<article style="padding:12px;border:1px solid #dbe4e4;border-radius:12px;margin-bottom:8px"><div style="display:flex;justify-content:space-between;gap:8px"><strong>Тест №'+esc(o.order_number)+'</strong><strong>'+money(o.total_vnd)+'</strong></div><p style="margin:6px 0;font-size:13px">'+esc(o.customer_name)+' · '+esc(o.order_type)+' · '+esc(o.payment_method)+'</p><p style="margin:6px 0;font-size:13px">Статус: <b>'+esc(statusNames[o.status]||o.status)+'</b> · Оплата: <b>'+ (o.payment_status==="paid"?"Оплачено":"Ожидает")+'</b>'+(o.order_type==="delivery"?' · Доставка: '+esc(deliveryNames[o.delivery_status]||o.delivery_status):"")+'</p><div style="display:flex;gap:6px;flex-wrap:wrap" class="sandbox-order-buttons">'+orderActions(o)+'</div></article>').join(""):'<p>Тестовых заказов пока нет. Переключитесь на «Официант» и создайте первый.</p>');
      root.querySelectorAll("button").forEach(b=>b.style.cssText="padding:8px;border:1px solid #ccd5d5;background:white;border-radius:8px;margin:2px");
      root.querySelectorAll("[data-sandbox-action=pay]").forEach(b=>b.addEventListener("click",async()=>{try{await call("sandboxSetPayment",{orderId:b.dataset.id});message("Тестовая оплата подтверждена.");await refresh();}catch(e){message(e.message);}}));
      root.querySelectorAll("[data-sandbox-status]").forEach(b=>b.addEventListener("click",async()=>{try{await call("sandboxSetStatus",{orderId:b.dataset.id,status:b.dataset.sandboxStatus});message("Статус тестового заказа изменён.");await refresh();}catch(e){message(e.message);}}));
      root.querySelectorAll("[data-sandbox-delivery]").forEach(b=>b.addEventListener("click",async()=>{try{await call("sandboxSetDelivery",{orderId:b.dataset.id,deliveryStatus:b.dataset.sandboxDelivery});message("Статус тестовой доставки изменён.");await refresh();}catch(e){message(e.message);}}));
      const openShift=shifts.find(s=>s.shift_status==="open");
      const shiftSummary=$("ummaSandboxEvents");
      shiftSummary.innerHTML='<h3 style="margin:0 0 8px">Тестовая смена</h3>'+(openShift?'<div style="padding:12px;border:1px solid #dbe4e4;border-radius:12px">Открыта · Начальная сумма: '+money(openShift.opening_cash_vnd)+'<form id="ummaSandboxCloseShift" style="display:grid;gap:8px;margin-top:8px"><label>Фактически пересчитано, VND<input id="ummaSandboxCounted" type="number" min="0" step="1000" value="'+esc(openShift.opening_cash_vnd)+'" required style="display:block;width:100%;padding:10px;margin-top:4px"></label><button class="cafe-submit" type="submit">Закрыть тестовую смену</button></form></div>':'<p>Открытой тестовой смены для этой роли нет.</p>')+'<p style="font-size:12px;color:#667">Смены доступны в тестовых ролях «Кассир» и «Менеджер».</p>';
      $("ummaSandboxCloseShift")?.addEventListener("submit",async e=>{e.preventDefault();try{const result=await call("sandboxCloseShift",{shiftId:openShift.id,countedCashVnd:Number($("ummaSandboxCounted").value)});message("Тестовая смена закрыта. Расхождение: "+money(result.varianceVnd));await refresh();}catch(err){message(err.message);}});
    }catch(e){message(e.message);}
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",build);else build();
})();