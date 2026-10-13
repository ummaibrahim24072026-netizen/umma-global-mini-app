/* UMMA CAFE — KITCHEN ORDER BOARD */
(() => {
  "use strict";
  const PROOF_URL="https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-transfer-proof";
  const API = "https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-kitchen";
  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" })[c]);
  const money = value => new Intl.NumberFormat("vi-VN", { style:"currency", currency:"VND", maximumFractionDigits:0 }).format(Number(value) || 0);
  const statusNames = { pending:"Ожидает подтверждения", confirmed:"Подтверждён", preparing:"Готовится", ready:"Готов", completed:"Выдан", cancelled:"Отменён" };
  const nextStep = { pending:{status:"preparing",label:"Принять и готовить"}, confirmed:{status:"preparing",label:"Начать готовить"}, preparing:{status:"ready",label:"Заказ готов"}, ready:{status:"completed",label:"Заказ выдан"} };
  let orders = [], couriers = [], locations = [], actorTelegramId = null, filter = "active", busy = false, staffRole = "", staffLocationIds = [], staffMenu = [], staffCart = new Map(), editingBillId = null;

  function isAllowed() {
    return ["super_admin", "admin", "employee"].includes(window.ummaRole);
  }
  function showMessage(text, visible = true) {
    const el = byId("cafeKitchenMessage");
    if (el) { el.textContent = text; el.hidden = !visible; }
  }
  function formatDate(value) {
    try { return new Intl.DateTimeFormat("ru-RU", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" }).format(new Date(value)); }
    catch { return ""; }
  }

  function render() {
    const root = byId("cafeKitchenOrders");
    if (!root) return;
    const shown = filter === "active" ? orders.filter(o => !["completed","cancelled"].includes(o.status)) : orders;
    if (!shown.length) {
      root.innerHTML = "";
      showMessage(filter === "active" ? "Активных заказов пока нет." : "Заказов пока нет.");
      return;
    }
    showMessage("", false);
    root.innerHTML = shown.map(order => {
      const notice=window.ummaKitchenLive?.notice(order)||"";
      const items = Array.isArray(order.cafe_order_items) ? order.cafe_order_items : [];
      const itemHtml = items.map(item => '<li><span>' + esc(item.product_name_ru) + ' × ' + Number(item.quantity) + '</span><strong>' + money(item.line_total_vnd) + '</strong></li>').join("");
      const next = nextStep[order.status];
      const orderStaffRole = order.staffRole || staffRole;
      const allowedForRole = orderStaffRole !== "courier" && ["manager", "cashier", "waiter", "kitchen"].includes(orderStaffRole);
      const completionAllowed = order.payment_status === "paid" && (order.order_type !== "delivery" || order.delivery_status === "delivered");
      const action = next && allowedForRole && (next.status !== "completed" || completionAllowed) ? '<button type="button" class="kitchen-action" data-order-id="' + esc(order.id) + '" data-new-status="' + next.status + '">' + next.label + '</button>' : "";
      const canCancel = !["completed","cancelled"].includes(order.status) &&
        ["manager", "cashier", "waiter", "kitchen"].includes(orderStaffRole);
      const cancel = canCancel ? '<button type="button" class="kitchen-cancel" data-order-id="' + esc(order.id) + '" data-new-status="cancelled">Отменить</button>' : "";
      const type = { pickup:"С собой", dine_in:"В кафе", delivery:"Доставка" }[order.order_type] || order.order_type;
      const paymentMethod = { cash:"Наличные", qr:"QR-платёж", bank_transfer:"Банковский перевод", card:"Карта" }[order.payment_method] || order.payment_method;
      const paymentStatus = order.payment_status === "paid" ? "Оплачено" : "Ожидает оплаты";
      const deliveryNames = { waiting_courier:"Ожидает курьера", courier_assigned:"Курьер назначен", picked_up:"У курьера", delivered:"Доставлено" };
      const deliveryNext = { waiting_courier:{status:"courier_assigned",label:"Назначить курьера"}, courier_assigned:{status:"picked_up",label:"Курьер забрал"}, picked_up:{status:"delivered",label:"Подтвердить доставку"} };
      const canManageDelivery = ["manager","cashier","waiter"].includes(orderStaffRole) ||
        (orderStaffRole === "courier" && ["courier_assigned","picked_up"].includes(order.delivery_status));
      const deliveryAction = order.order_type === "delivery" && canManageDelivery && deliveryNext[order.delivery_status] &&
        !(["manager","cashier","waiter"].includes(orderStaffRole) && order.delivery_status === "waiting_courier")
        && !(orderStaffRole === "courier" && Number(order.courier_telegram_id) !== Number(actorTelegramId))
        ? '<button type="button" class="kitchen-action" data-order-id="' + esc(order.id) + '" data-delivery-status="' + deliveryNext[order.delivery_status].status + '">' + deliveryNext[order.delivery_status].label + '</button>' : "";
      const availableCouriers = couriers.filter(c => String(c.location_id) === String(order.location_id));
      const routeLocation = locations.find(location => String(location.id) === String(order.location_id));
      const routeAction = order.order_type === "delivery" && order.delivery_address
        ? '<button type="button" class="kitchen-action" data-show-route="true" data-route-address="' + esc(order.delivery_address) + '" data-route-origin-lat="' + esc(routeLocation?.latitude ?? "") + '" data-route-origin-lng="' + esc(routeLocation?.longitude ?? "") + '" data-route-origin-name="' + esc(routeLocation?.name ?? "") + '" data-route-order-number="' + esc(order.order_number) + '">🗺️ Маршрут</button>' : "";
      const courierAssignAction = order.order_type === "delivery" && ["manager","cashier","waiter"].includes(orderStaffRole) && ["waiting_courier","courier_assigned"].includes(order.delivery_status)
        ? '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><select aria-label="Выбрать курьера" data-courier-select="' + esc(order.id) + '" style="max-width:210px;padding:9px;border:1px solid #ccd5d5;border-radius:9px"><option value="">Выберите курьера</option>' + availableCouriers.map(c => '<option value="' + esc(c.telegram_id) + '"' + (Number(c.telegram_id)===Number(order.courier_telegram_id)?' selected':'') + '>' + esc(c.name) + '</option>').join("") + '</select><button type="button" class="kitchen-action" data-assign-courier="' + esc(order.id) + '"' + (availableCouriers.length?'':' disabled') + '>Назначить курьера</button></div>' : "";
      const canManagePayment = order.canAcceptPayments === true && ["manager","cashier","waiter","kitchen","courier"].includes(orderStaffRole) && !["completed","cancelled"].includes(order.status);
      const paymentAction = canManagePayment && order.payment_status !== "paid"
        ? '<button type="button" class="kitchen-action" data-order-id="' + esc(order.id) + '" data-payment-status="paid">Подтвердить оплату</button>'
        : "";
      const details = [
        order.customer_name ? '<span>👤 ' + esc(order.customer_name) + '</span>' : "",
        order.customer_phone ? '<span>☎ ' + esc(order.customer_phone) + '</span>' : "",
        '<span>📦 ' + esc(type) + '</span>',
        '<span>💳 ' + esc(paymentMethod) + ' · ' + esc(paymentStatus) + '</span>',
        order.order_type === "delivery" ? '<span>🛵 ' + esc(deliveryNames[order.delivery_status] || "Ожидает курьера") + '</span>' : "",
        order.delivery_address ? '<span>📍 ' + esc(order.delivery_address) + '</span>' : "",
        order.accepted_by_telegram_id ? '<span>✅ Принял сотрудник ID ' + esc(order.accepted_by_telegram_id) + (order.accepted_at ? ' · ' + esc(formatDate(order.accepted_at)) : '') + '</span>' : "",
        order.customer_note ? '<span>💬 ' + esc(order.customer_note) + '</span>' : ""
      ].filter(Boolean).join("");
      return '<article class="kitchen-order-card status-' + esc(order.status) + '">' + notice + '<div class="kitchen-order-top"><div><span class="kitchen-order-number">Заказ №' + esc(order.order_number) + '</span><small>' + esc(formatDate(order.created_at)) + '</small></div><span class="kitchen-status">' + esc(statusNames[order.status] || order.status) + '</span></div><div class="kitchen-order-details">' + details + '</div><ul class="kitchen-order-items">' + itemHtml + '</ul><div class="kitchen-order-total"><span>Итого</span><strong>' + money(order.total_vnd) + '</strong></div><div class="kitchen-order-actions">' + action + cancel + paymentAction + deliveryAction + routeAction + courierAssignAction + '</div></article>';
    }).join("");
  }

  async function api(payload) {
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData) throw new Error("Откройте приложение через Telegram");
    const response = await fetch(API, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ ...payload, initData })
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Ошибка запроса");
    return result;
  }

  let lastOrdersFingerprint = null;
  async function loadOrders(options = {}) {
    if (busy) return;
    const silent = options?.silent === true;
    busy = true;
    if (!silent) showMessage("Загружаем заказы…");
    try {
      const result = await api({ action:"list" });
      staffLocationIds = Array.isArray(result.locationIds) ? result.locationIds : [];
      couriers = Array.isArray(result.couriers) ? result.couriers : [];
      locations = Array.isArray(result.locations) ? result.locations : [];
      window.ummaLocationPins = locations;
      actorTelegramId = result.actorTelegramId ?? null;
      const incomingOrders = Array.isArray(result.orders) ? result.orders : [];
      staffRole = result.staffRole || (window.ummaRole === "super_admin" ? "manager" : "");
      const fingerprint = JSON.stringify(incomingOrders);
      const changed = fingerprint !== lastOrdersFingerprint;
      orders = incomingOrders;
      if (changed) {
        lastOrdersFingerprint = fingerprint;
        window.ummaKitchenLive?.update(orders);
        render();
        renderOpenBills();
        renderStaffActiveOrders();
        renderStaffClosedOrders();
      }
    } catch (error) {
      if (!silent) showMessage(error instanceof Error ? error.message : "Не удалось загрузить заказы");
      else console.warn("Kitchen background refresh failed:", error);

    } finally { busy = false; }
  }

  async function updateStatus(orderId, status) {
    if (busy) return;
    if (!isAllowed()) { if (typeof showToast === "function") showToast("Доступ запрещён"); return; }
    busy = true;
    showMessage("Обновляем статус…");
    try {
      if(status==="preparing"){
        const current=orders.find(order=>String(order.id)===String(orderId));
        if(current?.status==="pending"){
          // Backend enforces pending → confirmed → preparing.
          // Complete both transitions in one staff action while retaining
          // acceptance ownership and the existing audit trail.
          await api({ action:"updateStatus", orderId, status:"confirmed" });
          try {
            await api({ action:"updateStatus", orderId, status:"preparing" });
          } catch (startError) {
            await refreshAfterUpdate();
            throw new Error("Заказ принят, но начало приготовления не подтверждено. Нажмите «Начать готовить» ещё раз. "+(startError instanceof Error?startError.message:""));
          }
        } else {
          await api({ action:"updateStatus", orderId, status });
        }
      } else {
        await api({ action:"updateStatus", orderId, status });
      }
      await refreshAfterUpdate();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Не удалось обновить статус");
    } finally { busy = false; render(); }
  }
  async function refreshAfterUpdate() {
    const result = await api({ action:"list" });
    orders = Array.isArray(result.orders) ? result.orders : [];
    couriers = Array.isArray(result.couriers) ? result.couriers : [];
    locations = Array.isArray(result.locations) ? result.locations : [];
    window.ummaLocationPins = locations;
    actorTelegramId = result.actorTelegramId ?? null;
    window.ummaKitchenLive?.update(orders);
    render();
    renderOpenBills();
    renderStaffActiveOrders();
    renderStaffClosedOrders();
    updateTableAvailability();
  }

  function open() {
    if (!isAllowed()) { if (typeof showToast === "function") showToast("Доступ запрещён"); return; }
    const home = document.querySelector(".app > main");
    const admin = byId("adminPage"), users = byId("adminUsersPage"), cafe = byId("cafePage"), kitchen = byId("cafeKitchenPage"), waiter = byId("cafeWaiterPage"), staffAdmin = byId("cafeStaffAdminPage"), inventory = byId("cafeInventoryPage"), locations = byId("locationAdminPage");
    const nav = document.querySelector(".bottom-nav");
    if (home) home.style.display = "none";
    if (admin) admin.hidden = true;
    if (users) users.hidden = true;
    if (cafe) cafe.hidden = true;
    if (staffAdmin) staffAdmin.hidden = true;
    if (waiter) waiter.hidden = true;
    if (kitchen) kitchen.hidden = false;
    if (nav) nav.style.display = "none";
    loadOrders();
    window.ummaKitchenLive?.start();
    loadCash();
    window.scrollTo({ top:0, behavior:"smooth" });
  }

  async function openWaiterPage() {
    if (!isAllowed()) { if (typeof showToast === "function") showToast("Доступ запрещён"); return; }
    const home = document.querySelector(".app > main");
    const admin = byId("adminPage"), users = byId("adminUsersPage"), cafe = byId("cafePage"), kitchen = byId("cafeKitchenPage"), waiter = byId("cafeWaiterPage"), staffAdmin = byId("cafeStaffAdminPage");
    const nav = document.querySelector(".bottom-nav");
    if (home) home.style.display = "none";
    if (admin) admin.hidden = true;
    if (users) users.hidden = true;
    if (cafe) cafe.hidden = true;
    if (kitchen) kitchen.hidden = true;
    if (staffAdmin) staffAdmin.hidden = true;
    if (waiter) waiter.hidden = false;
    if (nav) nav.style.display = "none";
    showMessage("Загружаем приём заказов…");
    try {
      const result = await api({action:"list"});
      staffLocationIds = Array.isArray(result.locationIds) ? result.locationIds : [];
      staffRole = result.staffRole || "";
      const isSuperAdmin = window.ummaRole === "super_admin";
      if (!isSuperAdmin && staffRole === "courier") {
        if (waiter) waiter.hidden = true;
        open();
        return;
      }
      orders = Array.isArray(result.orders) ? result.orders : [];
      locations = Array.isArray(result.locations) ? result.locations : [];
      const locationLabel=byId("staffOrderLocationLabel"), locationSelect=byId("staffOrderLocation");
      if (locationLabel && locationSelect) {
        locationLabel.hidden = !isSuperAdmin;
        locationSelect.innerHTML = '<option value="">Выберите кафе</option>' + locations.filter(x=>["cafe","restaurant"].includes(x.location_type)).map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+(x.city?' · '+esc(x.city):'')+'</option>').join("");
        if (isSuperAdmin && locations.some(x=>String(x.id)===String(staffLocationIds[0]))) locationSelect.value=staffLocationIds[0];
      }
      if (!staffMenu.length) await loadStaffMenu();
      renderOpenBills();
      renderStaffActiveOrders();
      showStaffWorkspace("order");
      showMessage("", false);
    } catch (e) {
      showMessage(e instanceof Error ? e.message : "Не удалось открыть рабочее место");
    }
    window.scrollTo({top:0,behavior:"smooth"});
  }
  // The kitchen never creates a second order form. All order actions live in one guest workspace.
  byId("cafeKitchenToOrders")?.addEventListener("click",()=>{
    openWaiterPage().then(()=>showStaffWorkspace("active"));
  });
  byId("adminKitchenButton")?.addEventListener("click", open);
  byId("staffEntryButton")?.addEventListener("click",()=>openWaiterPage().then(()=>showStaffWorkspace("order")));
  byId("staffKitchenEntryButton")?.addEventListener("click",open);
  byId("cafeWaiterBack")?.addEventListener("click", () => {
    const waiter=byId("cafeWaiterPage"), home=document.querySelector(".app > main"), nav=document.querySelector(".bottom-nav");
    if(waiter) waiter.hidden=true;
    if(home) home.style.display="";
    if(nav) nav.style.display="";
    if(typeof setActiveNav==="function") setActiveNav("home");
    window.scrollTo({top:0,behavior:"smooth"});
  });
  byId("cafeWaiterKitchen")?.addEventListener("click", open);
  byId("cafeWaiterRefresh")?.addEventListener("click", loadStaffMenu);
  byId("cafeKitchenBack")?.addEventListener("click", () => {
    if (byId("cafeKitchenPage")) byId("cafeKitchenPage").hidden = true;
    if (window.ummaRole === "super_admin" && typeof openAdminPanel === "function") {
      openAdminPanel();
      return;
    }
    const home = document.querySelector(".app > main");
    const nav = document.querySelector(".bottom-nav");
    if (home) home.style.display = "";
    if (nav) nav.style.display = "";
    if (typeof setActiveNav === "function") setActiveNav("home");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  byId("cafeKitchenRefresh")?.addEventListener("click", () => { loadOrders(); loadCash(); });
  document.querySelectorAll("[data-kitchen-filter]").forEach(button => button.addEventListener("click", () => {
    filter = button.getAttribute("data-kitchen-filter") || "active";
    document.querySelectorAll("[data-kitchen-filter]").forEach(other => other.classList.toggle("is-active", other === button));
    render();
  }));
  async function assignCourier(orderId) {
    if (busy) return;
    const select = Array.from(document.querySelectorAll("[data-courier-select]")).find(el => el.getAttribute("data-courier-select") === orderId);
    const courierTelegramId = Number(select?.value);
    if (!Number.isSafeInteger(courierTelegramId) || courierTelegramId <= 0) { showMessage("Сначала выберите курьера."); return; }
    if (!confirm("Назначить выбранного курьера на этот заказ?")) return;
    busy = true; showMessage("Назначаем курьера…");
    try { await api({action:"assignCourier",orderId,courierTelegramId}); await refreshAfterUpdate(); showMessage("Курьер назначен. Уведомление отправлено в Telegram."); }
    catch(error) { showMessage(error instanceof Error ? error.message : "Не удалось назначить курьера"); }
    finally { busy = false; render(); }
  }
  byId("cafeKitchenOrders")?.addEventListener("click", event => {
    const target=event.target;
    if (!(target instanceof Element)) return;
    const button=target.closest("[data-assign-courier]");
    if (button) assignCourier(button.getAttribute("data-assign-courier"));
  });
  async function updateDelivery(orderId, deliveryStatus) {
    if (busy) return;
    busy = true;
    showMessage("Обновляем доставку…");
    try {
      await api({ action:"updateDelivery", orderId, deliveryStatus });
      await refreshAfterUpdate();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Не удалось обновить доставку");
    } finally { busy = false; render(); }
  }
  function openCashPayment(order) {
    let modal=byId("cashPaymentModal");
    if(!modal){
      modal=document.createElement("div"); modal.id="cashPaymentModal";
      modal.style.cssText="position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px";
      modal.innerHTML='<section style="width:min(100%,420px);background:#fff;color:#173333;border-radius:18px;padding:20px"><h2 style="margin:0 0 8px">Приём наличных</h2><p id="cashPayDue" style="margin:0 0 14px"></p><label style="display:block;font-weight:600">Сколько денег дал клиент? (VND)<input id="cashPayTendered" type="number" min="0" step="1000" inputmode="numeric" placeholder="Например, 200000" style="display:block;width:100%;box-sizing:border-box;padding:14px;font-size:20px;border:1px solid #cbd5d5;border-radius:10px;margin-top:6px"></label><div style="margin:14px 0;padding:14px;background:#edf7f7;border-radius:12px"><small>Сдача клиенту</small><div id="cashPayChange" style="font-size:26px;font-weight:800">—</div><small id="cashPayHint"></small></div><div style="display:flex;gap:8px"><button id="cashPayCancel" type="button" style="flex:1;padding:12px;border:1px solid #cbd5d5;border-radius:10px;background:#fff">Отмена</button><button id="cashPayConfirm" type="button" disabled style="flex:1;padding:12px;border:0;border-radius:10px;background:#0f8f93;color:#fff;font-weight:700">Подтвердить оплату</button></div></section>';
      document.body.appendChild(modal);
    }
    const due=Number(order.total_vnd)||0, input=byId("cashPayTendered"), change=byId("cashPayChange"), hint=byId("cashPayHint"), confirm=byId("cashPayConfirm");
    byId("cashPayDue").textContent="Заказ №"+order.order_number+" · к оплате "+money(due);
    input.value=""; change.textContent="—"; hint.textContent="Введите сумму, которую фактически передал клиент."; confirm.disabled=true; modal.style.display="flex";
    const recalc=()=>{const val=input.value.trim()===""?NaN:Number(input.value), valid=Number.isSafeInteger(val)&&val>=due;change.textContent=Number.isSafeInteger(val)&&val>=0?money(Math.max(0,val-due)):"—";hint.textContent=!Number.isSafeInteger(val)||val<0?"Введите корректную сумму.":val<due?"Не хватает: "+money(due-val):"Передайте клиенту указанную сдачу.";confirm.disabled=!valid;};
    input.oninput=recalc; recalc(); input.focus();
    byId("cashPayCancel").onclick=()=>{modal.style.display="none";};
    confirm.onclick=async()=>{if(confirm.disabled)return;const tendered=Number(input.value);const changeAmount=tendered-due;confirm.disabled=true;modal.style.display="none";await updatePayment(order.id,"paid",tendered,changeAmount,"cash");};
  }
  async function updatePayment(orderId, paymentStatus, tenderedAmountVnd=null, changeGivenVnd=null, paymentMethod="") {
    if (busy) return;
    busy = true;
    showMessage("Обновляем оплату…");
    try {
      await api({ action:"updatePayment", orderId, paymentStatus, tenderedAmountVnd, changeGivenVnd, paymentMethod });
      await refreshAfterUpdate();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Не удалось обновить оплату");
    } finally { busy = false; render(); renderOpenBills(); }
  }
  byId("cafeKitchenOrders")?.addEventListener("click", event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const paymentButton = target.closest("[data-order-id][data-payment-status]");
    if (paymentButton) {
      const order=orders.find(o=>String(o.id)===paymentButton.getAttribute("data-order-id"));
      if(paymentButton.getAttribute("data-payment-status")==="paid" && order && order.payment_method==="cash"){openCashPayment(order);}
      else updatePayment(paymentButton.getAttribute("data-order-id"), paymentButton.getAttribute("data-payment-status"));
      return;
    }
    const deliveryButton = target.closest("[data-order-id][data-delivery-status]");
    if (deliveryButton) { updateDelivery(deliveryButton.getAttribute("data-order-id"), deliveryButton.getAttribute("data-delivery-status")); return; }
    const button = target.closest("[data-order-id][data-new-status]");
    if (button) updateStatus(button.getAttribute("data-order-id"), button.getAttribute("data-new-status"));
  });

 
  // Cash collection and end-of-shift handover panel.
  let cashData = null;
  let cashLocationId = "";
  function ensureCashPanel() {
    const page = byId("cafeKitchenPage");
    if (!page || byId("cafeCashPanel")) return;
    const section = document.createElement("section");
    section.id = "cafeCashPanel";
    section.hidden = true;
    section.style.cssText = "margin:16px 0;padding:16px;border:1px solid #d7e3e3;border-radius:16px;background:#fff;color:#172b2b";
    section.innerHTML = '<h2 style="margin:0 0 8px">Касса и сдача смены</h2><p style="margin:0 0 12px;color:#617070">Оплата заказа и передача наличных учитываются отдельно.</p><label style="display:block;margin-bottom:12px">Кафе<select id="cashLocationSelect" style="display:block;width:100%;padding:12px;border:1px solid #cbd5d5;border-radius:10px;margin-top:5px"></select></label><div id="cashSummary" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:14px"></div><div id="cashShiftControls"></div><form id="cashHandoverForm" style="display:grid;gap:10px;padding:12px;background:#f4f8f8;border-radius:12px"><h3 style="margin:0">Передать наличные</h3><label>Получатель<select id="cashReceiver" required style="display:block;width:100%;padding:12px;border:1px solid #cbd5d5;border-radius:10px;margin-top:5px"></select></label><label>Сумма (VND)<input id="cashAmount" type="number" min="1" step="1000" required placeholder="Например, 500000" style="display:block;width:100%;padding:12px;border:1px solid #cbd5d5;border-radius:10px;margin-top:5px"></label><label>Комментарий (необязательно)<input id="cashNote" maxlength="500" placeholder="Например, сдача вечерней смены" style="display:block;width:100%;padding:12px;border:1px solid #cbd5d5;border-radius:10px;margin-top:5px"></label><button type="submit" style="padding:12px;border:0;border-radius:10px;background:#0f8f93;color:white;font-weight:700">Передать на подтверждение</button></form><p id="cashMessage" hidden style="padding:10px;background:#edf7f7;border-radius:8px"></p><h3 style="margin:18px 0 8px">Передачи денег</h3><div id="cashHandovers"></div><h3 style="margin:18px 0 8px">Принятые оплаты за последние 24 часа</h3><div id="cashReceipts"></div>';
    const ordersRoot = byId("cafeKitchenOrders");
    if (ordersRoot) ordersRoot.insertAdjacentElement("afterend", section); else page.append(section);
    const cashToggle = byId("cafeCashToggle");
    cashToggle?.addEventListener("click", () => {
      section.hidden = !section.hidden;
      cashToggle.setAttribute("aria-expanded", String(!section.hidden));
      cashToggle.textContent = section.hidden ? "💰 Касса и смена" : "↑ Скрыть кассу и смену";
      if (!section.hidden) section.scrollIntoView({behavior:"smooth",block:"start"});
    });
    byId("cashLocationSelect")?.addEventListener("change", () => { cashLocationId = byId("cashLocationSelect").value; loadCash(); });
    byId("cashHandoverForm")?.addEventListener("submit", createCashHandover);
    section.addEventListener("click", event => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const action = target.closest("[data-handover-action]");
      if (action) respondCashHandover(action.getAttribute("data-handover-id"), action.getAttribute("data-handover-action") === "accept");
    });
  }
  function cashMessage(message) { const el=byId("cashMessage"); if(el){el.textContent=message;el.hidden=!message;} }
  async function loadCash() {
    ensureCashPanel();
    const root=byId("cashHandovers"); if(!root) return;
    root.textContent="Загружаем кассовые данные…";
    try {
      const result=await api({action:"cashList",locationId:cashLocationId||undefined});
      cashData=result; cashLocationId=result.locationId||cashLocationId;
      const loc=byId("cashLocationSelect");
      if(loc){
        const options=(result.locations||[]).map(x=>'<option value="'+esc(x.id)+'" '+(x.id===cashLocationId?'selected':'')+'>'+esc(x.name)+'</option>').join("");
        loc.innerHTML=options; loc.value=cashLocationId; loc.hidden=(result.locations||[]).length<2;
      }
      const staff=result.staff||[];
      const roleNames={manager:"Администратор",cashier:"Кассир",waiter:"Официант",kitchen:"Кухня",courier:"Курьер"};
      const receivers=staff.filter(x=>Number(x.telegram_id)!==Number(result.actorTelegramId)&&["manager","cashier"].includes(x.staff_role));
      const select=byId("cashReceiver");
      if(select) select.innerHTML='<option value="">Выберите получателя</option>'+receivers.map(x=>'<option value="'+esc(x.telegram_id)+'">'+esc(roleNames[x.staff_role]||x.staff_role)+' · ID '+esc(x.telegram_id)+'</option>').join("");
      const shifts=result.shifts||[];
      const myShift=shifts.find(x=>Number(x.staff_telegram_id)===Number(result.actorTelegramId));
      const shiftRoot=byId("cashShiftControls");
      if(shiftRoot){
        if(myShift){
          shiftRoot.innerHTML='<div style="padding:12px;border:1px solid #b7dddd;border-radius:12px;background:#f0fbfb;margin-bottom:14px"><strong>Смена открыта</strong><div style="margin:6px 0">Начальная касса: '+money(myShift.opening_cash_vnd)+'</div><small>Открыта: '+esc(formatDate(myShift.opened_at))+'</small><form id="cashCloseShiftForm" style="display:grid;gap:8px;margin-top:10px"><label>Фактическая сумма в кассе (VND)<input id="cashCountedAmount" type="number" min="0" step="1000" required style="display:block;width:100%;padding:10px;border:1px solid #cbd5d5;border-radius:8px;margin-top:4px"></label><label>Комментарий к расхождению<input id="cashCloseNote" maxlength="1000" placeholder="Необязательно" style="display:block;width:100%;padding:10px;border:1px solid #cbd5d5;border-radius:8px;margin-top:4px"></label><button type="submit" style="padding:12px;border:0;border-radius:10px;background:#a94736;color:white;font-weight:700">Закрыть смену и сверить кассу</button></form></div>';
          byId("cashCloseShiftForm")?.addEventListener("submit",closeCashShift);
        }else{
          shiftRoot.innerHTML='<form id="cashOpenShiftForm" style="display:grid;gap:8px;padding:12px;background:#f0fbfb;border:1px solid #b7dddd;border-radius:12px;margin-bottom:14px"><h3 style="margin:0">Открытие смены</h3><label>Наличные в кассе на начало (VND)<input id="cashOpeningAmount" type="number" min="0" step="1000" value="0" required style="display:block;width:100%;padding:10px;border:1px solid #cbd5d5;border-radius:8px;margin-top:4px"></label><button type="submit" style="padding:12px;border:0;border-radius:10px;background:#0f8f93;color:white;font-weight:700">Открыть смену</button></form>';
          byId("cashOpenShiftForm")?.addEventListener("submit",openCashShift);
        }
      }
      const allReceipts=(result.receipts||[]);
      const last24h=Date.now()-24*60*60*1000;
      const activeReceipts=allReceipts.filter(x=>x.receipt_status==="confirmed"&&new Date(x.collected_at).getTime()>=last24h);
      const ledgerReceipts=allReceipts;
      const total=activeReceipts.reduce((sum,x)=>sum+Number(x.amount_vnd||0),0);
      const cashTotal=activeReceipts.filter(x=>x.payment_method==="cash").reduce((sum,x)=>sum+Number(x.amount_vnd||0),0);
      const pending=(result.handovers||[]).filter(x=>x.handover_status==="pending");
      const summary=byId("cashSummary");
      if(summary) summary.innerHTML=[
        ["Оплаты за 24 ч.",money(total)],["Наличные за 24 ч.",money(cashTotal)],["Ожидают подтверждения",String(pending.length)],["Кафе",esc(result.cafeName||"")]
      ].map(x=>'<div style="padding:10px;background:#f4f8f8;border-radius:10px"><small style="display:block;color:#617070">'+x[0]+'</small><strong>'+x[1]+'</strong></div>').join("");
      const handovers=result.handovers||[];
      root.innerHTML=handovers.length?handovers.map(h=>{
        const outgoing=Number(h.from_telegram_id)===Number(result.actorTelegramId);
        const incoming=Number(h.to_telegram_id)===Number(result.actorTelegramId);
        const status={pending:"Ожидает подтверждения",accepted:"Принято",rejected:"Отклонено",cancelled:"Отменено"}[h.handover_status]||h.handover_status;
        const controls=h.handover_status==="pending"&&incoming?'<div style="display:flex;gap:8px;margin-top:8px"><button type="button" data-handover-id="'+esc(h.id)+'" data-handover-action="accept" style="padding:9px;border:0;border-radius:8px;background:#0f8f93;color:#fff">Подтвердить приём</button><button type="button" data-handover-id="'+esc(h.id)+'" data-handover-action="reject" style="padding:9px;border:0;border-radius:8px">Отклонить</button></div>':"";
        return '<article style="padding:12px;border:1px solid #d7e3e3;border-radius:10px;margin-bottom:8px"><strong>'+money(h.amount_vnd)+'</strong><div style="font-size:13px;margin-top:4px">'+(outgoing?'Вы передаёте получателю':'Отправитель → получатель')+' · '+esc(formatDate(h.created_at))+'</div><small>'+esc(status)+(h.note?' · '+esc(h.note):"")+'</small>'+controls+'</article>';
      }).join(""):"<p>Передач денег пока нет.</p>";
      const receiptsRoot=byId("cashReceipts");
      if(receiptsRoot) receiptsRoot.innerHTML=ledgerReceipts.length?'<p style="font-size:12px;color:#617070">Последние подтверждённые оплаты (до 100 записей). Сводка выше учитывает последние 24 часа.</p>'+ledgerReceipts.slice(0,100).map(x=>'<div style="display:flex;justify-content:space-between;gap:8px;padding:10px 0;border-bottom:1px solid #e6eeee"><span><strong>'+(x.order_number?'Заказ №'+esc(x.order_number):'Оплата заказа')+'</strong> · '+esc(({cash:'Наличные',qr:'QR-платёж',bank_transfer:'Банковский перевод',card:'Карта'}[x.payment_method]||x.payment_method))+'<small style="display:block;color:#617070">'+esc(formatDate(x.collected_at))+' · Принял: '+esc(x.collector||('Сотрудник ID '+x.collected_by_telegram_id))+'</small>'+(x.receipt_status!=="confirmed"?'<small style="display:block;color:#9b3028">Статус: '+esc(x.receipt_status)+'</small>':'')+(x.payment_method==="cash"&&x.tendered_amount_vnd!=null?'<small style="display:block;color:#617070">Получено: '+money(x.tendered_amount_vnd)+' · Сдача: '+money(x.change_given_vnd||0)+'</small>':'')+'</span><strong>'+money(x.amount_vnd)+'</strong></div>').join(""):"<p>Подтверждённых оплат пока нет.</p>";
    } catch(e) { root.textContent=e instanceof Error?e.message:"Не удалось загрузить кассовые данные"; }
  }
  async function openCashShift(event) {
    event.preventDefault();
    const amount=Number(byId("cashOpeningAmount")?.value);
    if(!Number.isSafeInteger(amount)||amount<0){cashMessage("Укажите корректную начальную сумму.");return;}
    try { await api({action:"openShift",locationId:cashLocationId,openingCashVnd:amount}); cashMessage("Смена открыта."); await loadCash(); }
    catch(e){cashMessage(e instanceof Error?e.message:"Не удалось открыть смену");}
  }
  async function closeCashShift(event) {
    event.preventDefault();
    const amount=Number(byId("cashCountedAmount")?.value);
    const shift=(cashData?.shifts||[]).find(x=>Number(x.staff_telegram_id)===Number(cashData?.actorTelegramId));
    if(!shift||!Number.isSafeInteger(amount)||amount<0){cashMessage("Укажите фактическую сумму в кассе.");return;}
    try {
      const result=await api({action:"closeShift",shiftId:shift.id,countedCashVnd:amount,note:byId("cashCloseNote")?.value||""});
      const closed=result.shift||{};
      cashMessage("Смена закрыта. Расчётная касса: "+money(closed.expected_cash_vnd)+"; фактически: "+money(closed.counted_cash_vnd)+"; расхождение: "+money(closed.variance_vnd)+".");
      await loadCash();
    } catch(e){cashMessage(e instanceof Error?e.message:"Не удалось закрыть смену");}
  }

  async function createCashHandover(event) {
    event.preventDefault();
    const receiver=byId("cashReceiver")?.value, amount=Number(byId("cashAmount")?.value);
    if(!receiver||!Number.isSafeInteger(amount)||amount<=0){cashMessage("Выберите получателя и укажите корректную сумму.");return;}
    try {
      await api({action:"createHandover",locationId:cashLocationId,toTelegramId:Number(receiver),amountVnd:amount,note:byId("cashNote")?.value.trim()||""});
      byId("cashAmount").value=""; byId("cashNote").value=""; cashMessage("Передача создана. Получатель должен подтвердить фактический приём."); await loadCash();
    } catch(e) { cashMessage(e instanceof Error?e.message:"Не удалось создать передачу"); }
  }
  async function respondCashHandover(id,accept) {
    try { await api({action:"respondHandover",handoverId:id,accept}); cashMessage(accept?"Приём денег подтверждён.":"Передача отклонена."); await loadCash(); }
    catch(e) { cashMessage(e instanceof Error?e.message:"Не удалось обработать передачу"); }
  }

  const STAFF_MENU_URL = "https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-menu";
  const STAFF_ORDER_URL = "https://zwzojugspldexyyljwpr.supabase.co/functions/v1/create-cafe-order";
  const staffMoney = value => new Intl.NumberFormat("vi-VN", {style:"currency",currency:"VND",maximumFractionDigits:0}).format(Number(value)||0);
  const staffName = p => p.name_ru || p.name_en || p.name_vi || "Блюдо";
  function renderStaffCart() {
    const root=byId("staffOrderCart"), total=byId("staffOrderTotal"), submit=byId("staffOrderSubmit");
    if(!root||!total) return;
    const items=[...staffCart.values()];
    root.innerHTML=items.length ? items.map(x=>'<div class="cafe-cart-row"><div><strong>'+esc(staffName(x.product))+'</strong><small>'+staffMoney(x.product.price_vnd)+' × '+x.quantity+'</small></div><div class="cafe-cart-controls"><button type="button" data-staff-change="-1" data-product-id="'+esc(x.product.id)+'">−</button><strong>'+x.quantity+'</strong><button type="button" data-staff-change="1" data-product-id="'+esc(x.product.id)+'">+</button></div></div>').join("") : '<p class="cafe-empty-cart">Добавьте блюда из меню.</p>';
    total.textContent=staffMoney(items.reduce((sum,x)=>sum+Number(x.product.price_vnd)*x.quantity,0));
    updateStaffMenuSelection();
    refreshStaffCashFields();
    const summary=byId("staffOrderSummary");
    if(summary)summary.hidden=!items.length;
    if(submit) submit.disabled=!items.length || busy;
  }
  function updateStaffMenuSelection() {
    const root=byId("staffOrderMenu"); if(!root) return;
    root.querySelectorAll("[data-staff-product]").forEach(card=>{
      const id=card.getAttribute("data-staff-product"), item=staffCart.get(id);
      const qty=card.querySelector("[data-staff-quantity]");
      const minus=card.querySelector("[data-staff-minus]");
      const button=card.querySelector("[data-staff-add]");
      card.classList.toggle("staff-product-selected",!!item);
      if(qty){qty.textContent=item?String(item.quantity):"";qty.hidden=!item;}
      if(minus){minus.hidden=!item;minus.setAttribute("aria-label","Уменьшить количество "+(card.querySelector("h3")?.textContent||"товара"));}
      if(button){button.setAttribute("aria-label",item?"Добавить ещё "+staffName(item.product):"Добавить "+(card.querySelector("h3")?.textContent||"товар"));button.textContent="+";}
    });
  }
  async function loadStaffMenu() {
    const root=byId("staffOrderMenu"); if(!root) return;
    root.innerHTML='<div class="cafe-message">Загружаем меню…</div>';
    try {
      const response=await fetch(STAFF_MENU_URL), result=await response.json();
      if(!response.ok||!result.ok) throw new Error(result.error||"Не удалось загрузить меню");
      staffMenu=Array.isArray(result.products)?result.products:[];
      root.innerHTML=staffMenu.map(p=>'<article class="cafe-product" data-staff-product="'+esc(p.id)+'"><h3>'+esc(staffName(p))+'</h3><div class="cafe-product-bottom"><span class="cafe-product-price">'+staffMoney(p.price_vnd)+'</span><div class="staff-product-qty-controls"><button type="button" class="staff-product-minus" data-staff-minus data-staff-change="-1" data-product-id="'+esc(p.id)+'" aria-label="Уменьшить количество" hidden>−</button><span class="staff-product-quantity" data-staff-quantity hidden></span><button type="button" class="cafe-add staff-product-plus" data-staff-add="'+esc(p.id)+'" aria-label="Добавить '+esc(staffName(p))+'">+</button></div></div></article>').join("");
      updateStaffMenuSelection();
    } catch(e) { root.textContent=e instanceof Error?e.message:"Ошибка загрузки меню"; }
  }
  byId("staffOrderToggle")?.addEventListener("click", async()=>{
    const wrap=byId("staffOrderFormWrap"); if(!wrap) return;
    wrap.hidden=!wrap.hidden;
    if(!wrap.hidden){clearPreviousOrderFeedback();if(!staffMenu.length)await loadStaffMenu();}
  });
  function showStaffWorkspace(view) {
    const form=byId("staffOrderFormWrap"), active=byId("staffActiveOrdersWrap"), closed=byId("staffClosedOrdersWrap");
    const tabs=[["waiterOrderToggle","order"],["staffActiveOrdersToggle","active"],["staffClosedOrdersToggle","closed"]];
    if(form)form.hidden=view!=="order";
    if(active)active.hidden=view!=="active";
    if(closed)closed.hidden=view!=="closed";
    tabs.forEach(([id,name])=>{
      const tab=byId(id);if(!tab)return;
      const selected=view===name;
      tab.classList.toggle("is-active",selected);
      tab.setAttribute("aria-selected",String(selected));
    });
    if(view==="active"){renderOpenBills();renderStaffActiveOrders();}
    if(view==="closed")renderStaffClosedOrders();
  }
  function clearPreviousOrderFeedback() {
    const message=byId("staffOrderMessage");
    if(message){message.textContent="";message.hidden=true;}
    const cash=byId("staffCashReceived");
    if(cash)cash.value="";
    refreshStaffCashFields();
  }
  byId("waiterOrderToggle")?.addEventListener("click",async()=>{
    clearPreviousOrderFeedback();
    showStaffWorkspace("order");
    const root=byId("staffOrderMenu");
    if(root&&!staffMenu.length)await loadStaffMenu();
    if(root&&!staffMenu.length&&!root.textContent.trim())root.textContent="Меню пока пустое. Нажмите «Обновить меню» или проверьте товары в каталоге кафе.";
  });
  byId("staffActiveOrdersToggle")?.addEventListener("click",()=>showStaffWorkspace("active"));
  byId("staffClosedOrdersToggle")?.addEventListener("click",()=>showStaffWorkspace("closed"));
  document.addEventListener("click",async event=>{
    const target=event.target; if(!(target instanceof Element)) return;
    const add=target.closest("[data-staff-add]");
    const change=target.closest("[data-staff-change]");
    const addToBill=target.closest("[data-add-to-bill]");
    const settleBill=target.closest("[data-settle-bill]");
    const proofButton=target.closest("[data-proof-order]");
    if(proofButton){
      const orderId=proofButton.getAttribute("data-proof-order");
      const order=orders.find(o=>String(o.id)===String(orderId));
      const initData=window.Telegram?.WebApp?.initData;
      if(!initData){showMessage("Откройте приложение через Telegram");return;}
      proofButton.disabled=true;
      try{
        const res=await fetch(PROOF_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"list",initData,orderId})});
        const data=await res.json();if(!res.ok||!data.ok)throw new Error(data.error||"Не удалось загрузить чек");
        const pending=(data.proofs||[]).filter(x=>x.status==="pending");
        if(!pending.length){window.alert("По этому заказу нет новых скриншотов перевода.");return;}
        const latest=pending[0];
        if(latest.url)window.open(latest.url,"_blank","noopener,noreferrer");
        window.alert("Откройте чек и отдельно проверьте фактическое поступление денег на банковский счёт. Скриншот сам по себе не подтверждает оплату. После проверки нажмите «Принять оплату».");
      }catch(e){showMessage(e.message||"Ошибка проверки чека");}finally{proofButton.disabled=false;}
      return;
    }
    const staffAction=target.closest("#staffActiveOrders [data-order-id][data-new-status], #staffActiveOrders [data-order-id][data-payment-status]");
    if(staffAction){
      const orderId=staffAction.getAttribute("data-order-id");
      const newStatus=staffAction.getAttribute("data-new-status");
      if(newStatus){updateStatus(orderId,newStatus);return;}
      const paymentStatus=staffAction.getAttribute("data-payment-status");
      if(paymentStatus){
        const order=orders.find(o=>String(o.id)===String(orderId));
        if(paymentStatus==="paid"&&order?.payment_method==="cash")openCashPayment(order);
        else if(order&&window.confirm("Подтвердить получение оплаты по заказу №"+order.order_number+"?"))updatePayment(orderId,paymentStatus,Number(order.total_vnd)||0,0,order.payment_method||"qr");
        return;
      }
    }
    if(settleBill) {
      const order=orders.find(o=>String(o.id)===String(settleBill.getAttribute("data-settle-bill")));
      if(!order)return;
      if(order.payment_method==="cash") openCashPayment(order);
      else if(window.confirm("Подтвердить, что оплата по счёту №"+order.order_number+" на "+money(order.total_vnd)+" действительно получена?")) updatePayment(order.id,"paid",Number(order.total_vnd)||0,0,order.payment_method||"qr");
    } else if(addToBill) {
      const wrap=byId("staffOrderFormWrap"); if(wrap){wrap.hidden=false;wrap.style.display="block";}
      clearPreviousOrderFeedback();
      setStaffOrderMode(addToBill.getAttribute("data-add-to-bill"));
      byId("waiterOrderToggle").textContent="− Скрыть форму заказа";
      byId("staffOrderMenu")?.scrollIntoView({behavior:"smooth",block:"start"});
    } else if(add) {
      const product=staffMenu.find(p=>String(p.id)===add.getAttribute("data-staff-add")); if(!product)return;
      const current=staffCart.get(product.id); staffCart.set(product.id,{product,quantity:Math.min(99,(current?.quantity||0)+1)}); renderStaffCart();
    } else if(change) {
      const id=change.getAttribute("data-product-id"), current=staffCart.get(id); if(!current)return;
      const quantity=current.quantity+Number(change.getAttribute("data-staff-change"));
      if(quantity<=0)staffCart.delete(id);else staffCart.set(id,{...current,quantity});
      renderStaffCart();
    }
  });
  function selectedStaffCafeId(){
    return String(byId("staffOrderLocation")?.value||staffLocationIds[0]||"");
  }
  function tableNumberForOrder(order){
    const name=String(order.customer_name||"").trim();
    const match=/^Стол\s*№?\s*([1-6])$/i.exec(name);
    return match?Number(match[1]):null;
  }
  function openBillForTable(tableNumber,source=orders){
    const locationId=selectedStaffCafeId();
    return source.filter(order=>order.order_type==="dine_in"
      &&tableNumberForOrder(order)===Number(tableNumber)
      &&order.payment_status!=="paid"
      &&!["completed","cancelled"].includes(order.status)
      &&(!locationId||String(order.location_id)===locationId))
      .sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0]||null;
  }
  function updateTableAvailability(){
    document.querySelectorAll("[data-staff-table]").forEach(button=>{
      const bill=openBillForTable(button.getAttribute("data-staff-table"));
      button.classList.toggle("has-open-bill",!!bill);
      button.title=bill?"Открытый счёт №"+bill.order_number+" — добавить блюда":"Свободен — новый заказ";
    });
  }
  function selectStaffService(type,tableNumber=null){
    const select=byId("staffOrderType"),guest=byId("staffOrderCustomerName");
    if(!select||!guest)return;
    setStaffOrderMode(null);
    select.value=type;
    guest.value=type==="dine_in"?"Стол №"+tableNumber:"";
    const existingBill=type==="dine_in"?openBillForTable(tableNumber):null;
    setStaffOrderMode(existingBill?.id||null);
    const guestLabel=byId("staffOrderGuestLabel");
    if(guestLabel)guestLabel.firstChild.textContent=type==="dine_in"?"Стол":"Имя гостя";
    guest.placeholder=type==="dine_in"?"Стол №"+tableNumber:"Например, Ахмад";
    const hint=byId("staffTableSelectionHint");
    if(hint)hint.textContent=type==="dine_in"?(existingBill?"Стол №"+tableNumber+" занят. Дозаказ в счёт №"+existingBill.order_number+".":"Стол №"+tableNumber+" свободен. Новый заказ."):type==="pickup"?"С собой: добавьте блюда и укажите имя гостя.":"Доставка: добавьте блюда, имя и адрес.";
    document.querySelectorAll("[data-staff-table],[data-staff-service]").forEach(button=>{
      const selected=type==="dine_in"?button.getAttribute("data-staff-table")===String(tableNumber):button.getAttribute("data-staff-service")===type;
      button.classList.toggle("is-selected",selected);
      button.setAttribute("aria-pressed",String(selected));
    });
    select.dispatchEvent(new Event("change",{bubbles:true}));
  }
  document.addEventListener("click",event=>{
    const table=event.target.closest?.("[data-staff-table]");
    if(table){selectStaffService("dine_in",table.getAttribute("data-staff-table"));return;}
    const service=event.target.closest?.("[data-staff-service]");
    if(service)selectStaffService(service.getAttribute("data-staff-service"));
  });
  byId("staffOrderType")?.addEventListener("change",()=>{
    const type=byId("staffOrderType").value;
    if(byId("staffOrderAddressLabel"))byId("staffOrderAddressLabel").hidden=type!=="delivery";
    if(!editingBillId){
      const guest=byId("staffOrderCustomerName");
      if(type!=="dine_in"&&guest?.value.startsWith("Стол №"))guest.value="";
      const label=byId("staffOrderGuestLabel");if(label)label.firstChild.textContent=type==="dine_in"?"Стол или имя гостя":"Имя гостя";
      document.querySelectorAll("[data-staff-table],[data-staff-service]").forEach(button=>{
        const selected=type!=="dine_in"&&button.getAttribute("data-staff-service")===type;
        if(selected){button.classList.add("is-selected");button.setAttribute("aria-pressed","true");}
        else if(type!=="dine_in"){button.classList.remove("is-selected");button.setAttribute("aria-pressed","false");}
      });
    }
    syncStaffPaymentOptions();
  });
  function renderOpenBills() {
    // Open bills are already represented by active order cards.
    const root=byId("staffOpenBills");
    if(root)root.innerHTML="";
  }
  function renderStaffActiveOrders() {
    const root=byId("staffActiveOrders");if(!root)return;
    const active=orders.filter(o=>!["completed","cancelled"].includes(o.status)).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    updateTableAvailability();
    root.innerHTML=active.length?active.map(o=>{
      const items=Array.isArray(o.cafe_order_items)?o.cafe_order_items:[];
      const itemList=items.map(i=>'<li>'+esc(i.product_name_ru)+' × '+Number(i.quantity)+'</li>').join("");
      const payment=o.payment_status==="paid"?"Оплачено":"Ожидает оплаты";
      const type={dine_in:"В кафе",pickup:"С собой",delivery:"Доставка"}[o.order_type]||o.order_type;
      const next=nextStep[o.status],role=o.staffRole||staffRole;
      const canAdvance=next&&["manager","waiter","cashier","kitchen"].includes(role)&&(next.status!=="completed"||(o.payment_status==="paid"&&(o.order_type!=="delivery"||o.delivery_status==="delivered")));
      const step=canAdvance?'<button type="button" class="kitchen-action" data-order-id="'+esc(o.id)+'" data-new-status="'+next.status+'">'+next.label+'</button>':"";
      const add=o.order_type==="dine_in"&&o.payment_status!=="paid"?'<button type="button" class="kitchen-action" data-add-to-bill="'+esc(o.id)+'">＋ Добавить блюда</button>':"";
      const settle=o.order_type==="dine_in"&&o.payment_status!=="paid"?'<button type="button" class="kitchen-action" data-settle-bill="'+esc(o.id)+'">Перейти к оплате</button>':"";
      return '<article class="staff-active-order"><div class="staff-active-order-head"><strong>Заказ №'+esc(o.order_number)+'</strong><small>'+esc(formatDate(o.created_at))+' · '+esc(type)+'</small></div><div class="staff-active-order-meta"><span class="staff-status-pill">'+esc(statusNames[o.status]||o.status)+'</span><span class="staff-payment-pill '+(o.payment_status==="paid"?"is-paid":"is-unpaid")+'">'+payment+'</span></div><ul class="staff-active-order-items">'+itemList+'</ul>'+'<div class="staff-active-order-total"><span>Итого</span><strong>'+money(o.total_vnd)+'</strong></div><div class="staff-order-actions-inline">'+add+settle+step+'</div></article>';
    }).join(""):'<p class="cafe-empty-cart">Активных заказов пока нет.</p>';
  }
  function renderStaffClosedOrders() {
    const root=byId("staffClosedOrders");if(!root)return;
    const closed=orders.filter(o=>["completed","cancelled"].includes(o.status))
      .sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    root.innerHTML=closed.length?closed.map(o=>{
      const items=Array.isArray(o.cafe_order_items)?o.cafe_order_items:[];
      const itemList=items.map(i=>'<li>'+esc(i.product_name_ru)+' × '+Number(i.quantity)+'</li>').join("");
      const type={dine_in:"В кафе",pickup:"С собой",delivery:"Доставка"}[o.order_type]||o.order_type||"";
      const status=o.status==="completed"?"Завершён":"Отменён";
      const payment=o.payment_status==="paid"?"Оплачено":"Не оплачено";
      return '<article class="staff-active-order"><div class="staff-active-order-head"><strong>Заказ №'+esc(o.order_number)+'</strong><small>'+esc(formatDate(o.created_at))+' · '+esc(type)+'</small></div><div class="staff-active-order-meta"><span class="staff-status-pill">'+status+'</span><span class="staff-payment-pill '+(o.payment_status==="paid"?"is-paid":"is-unpaid")+'">'+payment+'</span></div><ul class="staff-active-order-items">'+itemList+'</ul><div class="staff-active-order-total"><span>Итого</span><strong>'+money(o.total_vnd)+'</strong></div></article>';
    }).join(""):'<p class="cafe-empty-cart">Закрытых заказов пока нет.</p>';
  }
  function syncStaffPaymentOptions(){
    const type=byId("staffOrderType")?.value||"dine_in",timing=byId("staffPaymentTiming"),method=byId("staffOrderPayment");
    if(timing){const later=timing.querySelector('option[value="later"]');if(later)later.disabled=type!=="dine_in";if(type!=="dine_in")timing.value="now";}
    if(method){const courier=method.querySelector('option[value="courier"]');if(courier)courier.hidden=type!=="delivery";if(type!=="delivery"&&method.value==="courier")method.value="qr";}
    const fields=byId("staffPaymentNowFields");if(fields)fields.hidden=!!editingBillId||timing?.value==="later";
    const hint=byId("staffPaymentTimingHint");if(hint)hint.textContent=type==="dine_in"?"В кафе можно оплатить сразу или после трапезы.":type==="pickup"?"С собой: оплата при оформлении заказа.":"Доставка: QR-кодом сейчас или оплата курьеру при вручении.";
    refreshStaffCashFields();
  }
  function setStaffOrderMode(billId=null) {
    editingBillId=billId;
    const notice=byId("staffOrderModeNotice");
    const type=byId("staffOrderType"), timing=byId("staffPaymentTiming");
    const paymentFields=byId("staffPaymentNowFields");
    const submit=byId("staffOrderSubmit");
    const bill=orders.find(o=>String(o.id)===String(billId));
    if(type){type.value=bill?"dine_in":type.value;type.disabled=!!bill;}
    if(timing){timing.value=bill?"later":(timing.value||"now");timing.disabled=!!bill;}
    if(paymentFields)paymentFields.hidden=!!bill || timing?.value==="later";
    if(notice){notice.hidden=!bill;notice.textContent=bill?"Добавление в счёт №"+bill.order_number+". Новый заказ не создаётся; сумма общего счёта пересчитается автоматически.":"";}
    if(submit)submit.textContent=bill?"Добавить позиции в счёт №"+bill.order_number:(timing?.value==="later"?"Открыть счёт и отправить заказ":"Оформить заказ и подтвердить оплату");
    syncStaffPaymentOptions();
  }
  function staffOrderAmount() {
    return [...staffCart.values()].reduce((sum,item)=>sum+Number(item.product.price_vnd)*item.quantity,0);
  }
  function refreshStaffCashFields() {
    const method=byId("staffOrderPayment")?.value||"cash";
    const fields=byId("staffCashPaymentFields");
    const input=byId("staffCashReceived");
    const dueEl=byId("staffCashDue"), changeEl=byId("staffCashChange"), hint=byId("staffCashHint");
    const due=staffOrderAmount();
    if(fields) fields.hidden=method!=="cash" || byId("staffPaymentTiming")?.value==="later";
    if(dueEl) dueEl.textContent=staffMoney(due);
    if(byId("staffPaymentTiming")?.value==="later" || editingBillId) return;
    if(method!=="cash") return;
    const raw=input?.value.trim()||"";
    const received=raw===""?NaN:Number(raw);
    const valid=Number.isSafeInteger(received)&&received>=due;
    if(changeEl) changeEl.textContent=Number.isSafeInteger(received)&&received>=0?staffMoney(Math.max(0,received-due)):"—";
    if(hint) hint.textContent=!Number.isSafeInteger(received)||received<0?"Введите сумму наличных, полученных от гостя.":received<due?"Не хватает: "+staffMoney(due-received):"Сдача рассчитана автоматически.";
  }
  byId("staffOrderPayment")?.addEventListener("change",refreshStaffCashFields);
  byId("staffPaymentTiming")?.addEventListener("change",()=>{setStaffOrderMode(editingBillId);});
  byId("staffCashReceived")?.addEventListener("input",refreshStaffCashFields);
  byId("staffOrderForm")?.addEventListener("submit",async event=>{
    event.preventDefault();
    const message=byId("staffOrderMessage");
    if(!staffCart.size){if(message){message.textContent="Добавьте хотя бы одно блюдо.";message.hidden=false;}return;}
    const selectedLocation=window.ummaRole==="super_admin"?(byId("staffOrderLocation")?.value||""):staffLocationIds[0];
    if(!selectedLocation){if(message){message.textContent=window.ummaRole==="super_admin"?"Выберите кафе / филиал.":"Не удалось определить кафе сотрудника. Обновите заказы.";message.hidden=false;}return;}
    const initData=window.Telegram?.WebApp?.initData;
    if(!initData){if(message){message.textContent="Откройте приложение через Telegram.";message.hidden=false;}return;}
    const type=byId("staffOrderType").value;
    const guestName=byId("staffOrderCustomerName")?.value.trim()||"";
    if(!editingBillId&&!guestName){
      if(message){message.textContent=type==="dine_in"?"Выберите стол 1–6.":"Укажите имя гостя для заказа с собой или доставки.";message.hidden=false;}
      byId("staffOrderCustomerName")?.focus();return;
    }
    const address=byId("staffOrderAddress")?.value.trim()||"";
    const paymentMethod=byId("staffOrderPayment").value;
    const paymentTiming=byId("staffPaymentTiming")?.value||"now";
    if(type!=="dine_in"&&paymentTiming==="later"){if(message){message.textContent="Оплата позже разрешена только для заказа в кафе.";message.hidden=false;}return;}
    if(paymentMethod==="courier"&&type!=="delivery"){if(message){message.textContent="Оплата курьеру доступна только для доставки.";message.hidden=false;}return;}
    const orderTotal=staffOrderAmount();
    const receivedRaw=byId("staffCashReceived")?.value.trim()||"";
    const tendered=paymentMethod==="cash"?(receivedRaw===""?NaN:Number(receivedRaw)):orderTotal;
    if(editingBillId && paymentTiming!=="later"){if(message){message.textContent="Для открытого счёта выберите оплату позже.";message.hidden=false;}return;}
    if(!editingBillId && type==="delivery"&&!address){if(message){message.textContent="Укажите адрес доставки.";message.hidden=false;}return;}
    if(!editingBillId && paymentTiming==="now" && paymentMethod==="cash"&&(!Number.isSafeInteger(tendered)||tendered<orderTotal)){if(message){message.textContent="Укажите полученную наличную сумму не меньше "+staffMoney(orderTotal)+". Сдача рассчитается автоматически.";message.hidden=false;}byId("staffCashReceived")?.focus();return;}
    const changeAmount=paymentMethod==="cash"?tendered-orderTotal:0;
    const submit=byId("staffOrderSubmit"); if(submit){submit.disabled=true;submit.textContent=editingBillId?"Добавляем позиции…":paymentTiming==="later"?"Открываем счёт…":"Оформляем и подтверждаем оплату…";}
    if(message)message.hidden=true;
    try{
      const items=[...staffCart.values()].map(x=>({productId:x.product.id,quantity:x.quantity}));
      // Refresh before creating a dine-in order: another tablet may have
      // opened this table since it was selected.
      if(!editingBillId&&type==="dine_in"){
        const match=/^Стол\s*№?\s*([1-6])$/i.exec(guestName);
        if(match){
          const fresh=await api({action:"list"});
          const bill=openBillForTable(Number(match[1]),Array.isArray(fresh.orders)?fresh.orders:[]);
          if(bill){
            orders=Array.isArray(fresh.orders)?fresh.orders:orders;
            setStaffOrderMode(bill.id);
            if(message){message.textContent="Стол №"+match[1]+" уже имеет неоплаченный счёт №"+bill.order_number+". Новые блюда добавляются к нему.";message.hidden=false;}
          }
        }
      }
      if(editingBillId){
        const added=await api({action:"addItems",orderId:editingBillId,items});
        if(message){message.textContent="Добавлено в общий счёт №"+added.orderNumber+". Новый итог: "+staffMoney(added.totalVnd)+". Оплата остаётся после трапезы.";message.hidden=false;}
      } else {
        const response=await fetch(STAFF_ORDER_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
          initData,staffOrder:true,locationId:selectedLocation,items,orderType:type,paymentMethod,
          customerName:guestName,
          customerPhone:"",
          deliveryAddress:address,customerNote:byId("staffOrderNote").value.trim()
        })});
        const result=await response.json(); if(!response.ok||!result.ok||!result.order)throw new Error(result.error||"Не удалось оформить заказ");
        const order=result.order;
        if(paymentTiming==="now"&&paymentMethod!=="courier"&&paymentMethod!=="bank_transfer"){
          try {
            await api({action:"updatePayment",orderId:order.id,paymentStatus:"paid",tenderedAmountVnd:paymentMethod==="cash"?tendered:orderTotal,changeGivenVnd:changeAmount,paymentMethod});
          } catch(paymentError) {
            if(message){message.textContent="Заказ №"+order.orderNumber+" создан, но подтверждение оплаты не прошло: "+(paymentError instanceof Error?paymentError.message:"ошибка оплаты")+". Не оформляйте повторный заказ; проверьте его в рабочей панели.";message.hidden=false;}
            await loadOrders(); return;
          }
          if(message){message.textContent="Оплата подтверждена. Заказ №"+order.orderNumber+" передан на кухню. Сумма: "+staffMoney(order.totalVnd)+(paymentMethod==="cash"?" · Получено: "+staffMoney(tendered)+" · Сдача: "+staffMoney(changeAmount):" · Оплата: "+({qr:"QR-код",bank_transfer:"перевод на карту",cash:"наличные"}[paymentMethod]||paymentMethod));message.hidden=false;}
        } else if(paymentMethod==="bank_transfer"){
          if(message){message.textContent="Заказ №"+order.orderNumber+" создан. Перевод на карту ожидает скриншот и подтверждение поступления средств. Не отмечайте заказ оплаченным заранее.";message.hidden=false;}
        } else if(paymentMethod==="courier"){
          if(message){message.textContent="Заказ №"+order.orderNumber+" оформлен. Оплата курьеру при вручении; платёж пока не подтверждён.";message.hidden=false;}
        } else {
          if(message){message.textContent="Открыт счёт №"+order.orderNumber+" на "+staffMoney(order.totalVnd)+". Оплата будет после трапезы. Все последующие блюда добавляйте в этот счёт.";message.hidden=false;}
        }
      }
      staffCart.clear();byId("staffOrderForm").reset();
      document.querySelectorAll("[data-staff-table],[data-staff-service]").forEach(button=>{button.classList.remove("is-selected");button.setAttribute("aria-pressed","false");});
      const tableHint=byId("staffTableSelectionHint");if(tableHint)tableHint.textContent="Нажмите стол или «С собой», затем добавляйте блюда.";if(byId("staffOrderAddressLabel"))byId("staffOrderAddressLabel").hidden=true;setStaffOrderMode(null);renderStaffCart();await loadOrders();
    }catch(e){if(message){message.textContent=e instanceof Error?e.message:"Ошибка оформления заказа";message.hidden=false;}}
    finally{if(submit){submit.disabled=!staffCart.size;submit.textContent=editingBillId?"Добавить позиции в счёт":(byId("staffPaymentTiming")?.value==="later"?"Открыть счёт и отправить заказ":"Оформить заказ и подтвердить оплату");}}
  });
  renderStaffCart();
  setStaffOrderMode(null);

  window.ummaKitchen = { open, refresh:loadOrders, rerender:render };
})();