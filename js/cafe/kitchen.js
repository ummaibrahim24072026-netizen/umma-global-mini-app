/* UMMA CAFE — KITCHEN ORDER BOARD */
(() => {
  "use strict";
  const API = "https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-kitchen";
  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" })[c]);
  const money = value => new Intl.NumberFormat("vi-VN", { style:"currency", currency:"VND", maximumFractionDigits:0 }).format(Number(value) || 0);
  const statusNames = { pending:"Ожидает подтверждения", confirmed:"Подтверждён", preparing:"Готовится", ready:"Готов", completed:"Выдан", cancelled:"Отменён" };
  const nextStep = { pending:{status:"confirmed",label:"Принять заказ"}, confirmed:{status:"preparing",label:"Начать готовить"}, preparing:{status:"ready",label:"Заказ готов"}, ready:{status:"completed",label:"Заказ выдан"} };
  let orders = [], filter = "active", busy = false, staffRole = "", staffLocationIds = [], staffMenu = [], staffCart = new Map();

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
      const items = Array.isArray(order.cafe_order_items) ? order.cafe_order_items : [];
      const itemHtml = items.map(item => '<li><span>' + esc(item.product_name_ru) + ' × ' + Number(item.quantity) + '</span><strong>' + money(item.line_total_vnd) + '</strong></li>').join("");
      const next = nextStep[order.status];
      const orderStaffRole = order.staffRole || staffRole;
      const allowedForRole = orderStaffRole === "manager" ||
        (orderStaffRole === "cashier" && order.status === "pending") ||
        (orderStaffRole === "waiter" && ["pending", "ready"].includes(order.status)) ||
        (orderStaffRole === "kitchen" && ["confirmed", "preparing"].includes(order.status));
      const action = next && allowedForRole ? '<button type="button" class="kitchen-action" data-order-id="' + esc(order.id) + '" data-new-status="' + next.status + '">' + next.label + '</button>' : "";
      const canCancel = !["completed","cancelled"].includes(order.status) &&
        (orderStaffRole === "manager" || (["cashier","waiter"].includes(orderStaffRole) && order.status === "pending"));
      const cancel = canCancel ? '<button type="button" class="kitchen-cancel" data-order-id="' + esc(order.id) + '" data-new-status="cancelled">Отменить</button>' : "";
      const type = { pickup:"Самовывоз", dine_in:"В кафе", delivery:"Доставка" }[order.order_type] || order.order_type;
      const details = [
        order.customer_name ? '<span>👤 ' + esc(order.customer_name) + '</span>' : "",
        order.customer_phone ? '<span>☎ ' + esc(order.customer_phone) + '</span>' : "",
        '<span>📦 ' + esc(type) + '</span>',
        order.delivery_address ? '<span>📍 ' + esc(order.delivery_address) + '</span>' : "",
        order.customer_note ? '<span>💬 ' + esc(order.customer_note) + '</span>' : ""
      ].filter(Boolean).join("");
      return '<article class="kitchen-order-card status-' + esc(order.status) + '"><div class="kitchen-order-top"><div><span class="kitchen-order-number">Заказ №' + esc(order.order_number) + '</span><small>' + esc(formatDate(order.created_at)) + '</small></div><span class="kitchen-status">' + esc(statusNames[order.status] || order.status) + '</span></div><div class="kitchen-order-details">' + details + '</div><ul class="kitchen-order-items">' + itemHtml + '</ul><div class="kitchen-order-total"><span>Итого</span><strong>' + money(order.total_vnd) + '</strong></div><div class="kitchen-order-actions">' + action + cancel + '</div></article>';
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

  async function loadOrders() {
    if (busy) return;
    busy = true;
    showMessage("Загружаем заказы…");
    try {
      const result = await api({ action:"list" });
      staffLocationIds = Array.isArray(result.locationIds) ? result.locationIds : [];
      orders = Array.isArray(result.orders) ? result.orders : [];
      staffRole = result.staffRole || (window.ummaRole === "super_admin" ? "manager" : "");
      render();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Не удалось загрузить заказы");
    } finally { busy = false; }
  }

  async function updateStatus(orderId, status) {
    if (busy) return;
    if (!isAllowed()) { if (typeof showToast === "function") showToast("Доступ запрещён"); return; }
    busy = true;
    showMessage("Обновляем статус…");
    try {
      await api({ action:"updateStatus", orderId, status });
      await refreshAfterUpdate();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Не удалось обновить статус");
    } finally { busy = false; render(); }
  }
  async function refreshAfterUpdate() {
    const result = await api({ action:"list" });
    orders = Array.isArray(result.orders) ? result.orders : [];
  }

  function open() {
    if (!isAllowed()) { if (typeof showToast === "function") showToast("Доступ запрещён"); return; }
    const home = document.querySelector(".app > main");
    const admin = byId("adminPage"), users = byId("adminUsersPage"), cafe = byId("cafePage"), kitchen = byId("cafeKitchenPage"), staffAdmin = byId("cafeStaffAdminPage");
    const nav = document.querySelector(".bottom-nav");
    if (home) home.style.display = "none";
    if (admin) admin.hidden = true;
    if (users) users.hidden = true;
    if (cafe) cafe.hidden = true;
    if (staffAdmin) staffAdmin.hidden = true;
    if (kitchen) kitchen.hidden = false;
    if (nav) nav.style.display = "none";
    loadOrders();
    window.scrollTo({ top:0, behavior:"smooth" });
  }

  byId("adminKitchenButton")?.addEventListener("click", open);
  byId("staffEntryButton")?.addEventListener("click", open);
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
  byId("cafeKitchenRefresh")?.addEventListener("click", loadOrders);
  document.querySelectorAll("[data-kitchen-filter]").forEach(button => button.addEventListener("click", () => {
    filter = button.getAttribute("data-kitchen-filter") || "active";
    document.querySelectorAll("[data-kitchen-filter]").forEach(other => other.classList.toggle("is-active", other === button));
    render();
  }));
  byId("cafeKitchenOrders")?.addEventListener("click", event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest("[data-order-id][data-new-status]");
    if (button) updateStatus(button.getAttribute("data-order-id"), button.getAttribute("data-new-status"));
  });

 
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
    if(submit) submit.disabled=!items.length || busy;
  }
  function updateStaffMenuSelection() {
    const root=byId("staffOrderMenu"); if(!root) return;
    root.querySelectorAll("[data-staff-product]").forEach(card=>{
      const id=card.getAttribute("data-staff-product"), item=staffCart.get(id), qty=card.querySelector("[data-staff-quantity]"), button=card.querySelector("[data-staff-add]");
      card.classList.toggle("staff-product-selected",!!item);
      if(qty){qty.textContent=item?"✓ Выбрано: "+item.quantity:"";qty.hidden=!item;}
      if(button){button.setAttribute("aria-label",item?"Добавить ещё "+staffName(item.product):"Добавить "+(card.querySelector("h3")?.textContent||"товар"));button.textContent=item?"+ "+item.quantity:"+ Добавить";}
    });
  }
  async function loadStaffMenu() {
    const root=byId("staffOrderMenu"); if(!root) return;
    root.innerHTML='<div class="cafe-message">Загружаем меню…</div>';
    try {
      const response=await fetch(STAFF_MENU_URL), result=await response.json();
      if(!response.ok||!result.ok) throw new Error(result.error||"Не удалось загрузить меню");
      staffMenu=Array.isArray(result.products)?result.products:[];
      root.innerHTML=staffMenu.map(p=>'<article class="cafe-product" data-staff-product="'+esc(p.id)+'"><h3>'+esc(staffName(p))+'</h3><span class="staff-product-quantity" data-staff-quantity hidden></span><div class="cafe-product-bottom"><span class="cafe-product-price">'+staffMoney(p.price_vnd)+'</span><button type="button" class="cafe-add" data-staff-add="'+esc(p.id)+'">+ Добавить</button></div></article>').join("");
      updateStaffMenuSelection();
    } catch(e) { root.textContent=e instanceof Error?e.message:"Ошибка загрузки меню"; }
  }
  byId("staffOrderToggle")?.addEventListener("click", async()=>{
    const wrap=byId("staffOrderFormWrap"); if(!wrap) return;
    wrap.hidden=!wrap.hidden;
    if(!wrap.hidden && !staffMenu.length) await loadStaffMenu();
  });
  document.addEventListener("click",event=>{
    const target=event.target; if(!(target instanceof Element)) return;
    const add=target.closest("[data-staff-add]");
    const change=target.closest("[data-staff-change]");
    if(add) {
      const product=staffMenu.find(p=>String(p.id)===add.getAttribute("data-staff-add")); if(!product)return;
      const current=staffCart.get(product.id); staffCart.set(product.id,{product,quantity:Math.min(99,(current?.quantity||0)+1)}); renderStaffCart();
    } else if(change) {
      const id=change.getAttribute("data-product-id"), current=staffCart.get(id); if(!current)return;
      const quantity=current.quantity+Number(change.getAttribute("data-staff-change"));
      if(quantity<=0)staffCart.delete(id);else staffCart.set(id,{...current,quantity});
      renderStaffCart();
    }
  });
  byId("staffOrderType")?.addEventListener("change",()=>{const delivery=byId("staffOrderType").value==="delivery";if(byId("staffOrderAddressLabel"))byId("staffOrderAddressLabel").hidden=!delivery;});
  byId("staffOrderForm")?.addEventListener("submit",async event=>{
    event.preventDefault();
    const message=byId("staffOrderMessage");
    if(!staffCart.size){if(message){message.textContent="Добавьте хотя бы одно блюдо.";message.hidden=false;}return;}
    if(!staffLocationIds.length){if(message){message.textContent="Не удалось определить кафе сотрудника. Обновите заказы.";message.hidden=false;}return;}
    const initData=window.Telegram?.WebApp?.initData;
    if(!initData){if(message){message.textContent="Откройте приложение через Telegram.";message.hidden=false;}return;}
    const type=byId("staffOrderType").value;
    const address=byId("staffOrderAddress")?.value.trim()||"";
    if(type==="delivery"&&!address){if(message){message.textContent="Укажите адрес доставки.";message.hidden=false;}return;}
    const submit=byId("staffOrderSubmit"); if(submit){submit.disabled=true;submit.textContent="Оформляем…";}
    if(message)message.hidden=true;
    try{
      const response=await fetch(STAFF_ORDER_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        initData,staffOrder:true,locationId:staffLocationIds[0],
        items:[...staffCart.values()].map(x=>({productId:x.product.id,quantity:x.quantity})),
        orderType:type,paymentMethod:byId("staffOrderPayment").value,
        customerName:byId("staffOrderCustomerName").value.trim(),
        customerPhone:byId("staffOrderCustomerPhone").value.trim(),
        deliveryAddress:address,customerNote:byId("staffOrderNote").value.trim()
      })});
      const result=await response.json(); if(!response.ok||!result.ok||!result.order)throw new Error(result.error||"Не удалось оформить заказ");
      if(message){message.textContent="Заказ №"+result.order.orderNumber+" отправлен на кухню. Сумма: "+staffMoney(result.order.totalVnd);message.hidden=false;}
      staffCart.clear();byId("staffOrderForm").reset();if(byId("staffOrderAddressLabel"))byId("staffOrderAddressLabel").hidden=true;renderStaffCart();await loadOrders();
    }catch(e){if(message){message.textContent=e instanceof Error?e.message:"Ошибка оформления заказа";message.hidden=false;}}
    finally{if(submit){submit.textContent="Отправить заказ на кухню";submit.disabled=!staffCart.size;}}
  });
  renderStaffCart();

  window.ummaKitchen = { open, refresh:loadOrders };
})();