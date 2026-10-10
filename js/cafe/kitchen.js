/* UMMA CAFE — KITCHEN ORDER BOARD */
(() => {
  "use strict";
  const API = "https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-kitchen";
  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" })[c]);
  const money = value => new Intl.NumberFormat("vi-VN", { style:"currency", currency:"VND", maximumFractionDigits:0 }).format(Number(value) || 0);
  const statusNames = { pending:"Ожидает подтверждения", confirmed:"Подтверждён", preparing:"Готовится", ready:"Готов", completed:"Выдан", cancelled:"Отменён" };
  const nextStep = { pending:{status:"confirmed",label:"Принять заказ"}, confirmed:{status:"preparing",label:"Начать готовить"}, preparing:{status:"ready",label:"Заказ готов"}, ready:{status:"completed",label:"Заказ выдан"} };
  let orders = [], filter = "active", busy = false, staffRole = "";

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
      const allowedForRole = staffRole === "manager" ||
        (staffRole === "cashier" && order.status === "pending") ||
        (staffRole === "waiter" && ["pending", "ready"].includes(order.status)) ||
        (staffRole === "kitchen" && ["confirmed", "preparing"].includes(order.status));
      const action = next && allowedForRole ? '<button type="button" class="kitchen-action" data-order-id="' + esc(order.id) + '" data-new-status="' + next.status + '">' + next.label + '</button>' : "";
      const canCancel = !["completed","cancelled"].includes(order.status) &&
        (staffRole === "manager" || (["cashier","waiter"].includes(staffRole) && order.status === "pending"));
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

  window.ummaKitchen = { open, refresh:loadOrders };
})();