/* UMMA CAFE — LIVE MENU, CART AND ORDER CREATION */
(() => {
  "use strict";
  const MENU_URL = "https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-menu";
  const ORDER_URL = "https://zwzojugspldexyyljwpr.supabase.co/functions/v1/create-cafe-order";
  const MY_ORDERS_URL = "https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-my-orders";
  const money = value => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(value) || 0);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" })[char]);
  const icons = { "UMMA-CAFE-SHURPA":"🍲", "UMMA-CAFE-PLOV":"🍛", "UMMA-CAFE-MANTI":"🥟", "UMMA-CAFE-FLATBREAD":"🫓", "UMMA-CAFE-SALAD":"🥗", "UMMA-CAFE-SAMSA":"🥮", "UMMA-CAFE-AYRAN":"🥛" };
  let products = [], locationId = null, loading = false;
  const cart = new Map();
  const byId = id => document.getElementById(id);
  const name = p => p.name_ru || p.name_en || p.name_vi || "Блюдо";
  const description = p => p.description_ru || p.description_en || "";
  const count = () => Array.from(cart.values()).reduce((sum, item) => sum + item.quantity, 0);
  const total = () => Array.from(cart.values()).reduce((sum, item) => sum + item.quantity * Number(item.price_vnd), 0);

  function setError(message) {
    const el = byId("cafeError");
    if (el) { el.textContent = message; el.hidden = !message; }
  }

  function renderProducts() {
    const root = byId("cafeProducts");
    if (!root) return;
    if (!products.length) { root.innerHTML = '<div class="cafe-message">Меню пока не опубликовано. Попробуйте позже.</div>'; return; }
    root.innerHTML = products.map(p => {
      const weight = p.weight_value ? Number(p.weight_value) + (p.weight_unit === "ml" ? " мл" : " г") : "";
      return '<article class="cafe-product"><div class="cafe-product-top"><span class="cafe-product-icon">' + (icons[p.sku] || "🍽️") + '</span><span class="cafe-product-weight">' + esc(weight) + '</span></div><h3>' + esc(name(p)) + '</h3><p>' + esc(description(p)) + '</p><div class="cafe-product-bottom"><span class="cafe-product-price">' + money(p.price_vnd) + '</span><button type="button" class="cafe-add" data-add-product="' + esc(p.id) + '" aria-label="Добавить ' + esc(name(p)) + '">+</button></div></article>';
    }).join("");
  }

  function renderCart() {
    const root = byId("cafeCartItems"), countEl = byId("cafeCartCount"), totalEl = byId("cafeCartTotal"), submit = byId("cafeSubmitOrder");
    if (!root || !countEl || !totalEl) return;
    const entries = Array.from(cart.values());
    countEl.textContent = count() + (count() === 1 ? " позиция" : " позиций");
    totalEl.textContent = money(total());
    if (!entries.length) root.innerHTML = '<p class="cafe-empty-cart">Добавьте блюда из меню.</p>';
    else root.innerHTML = entries.map(item => '<div class="cafe-cart-row"><div><strong>' + esc(name(item.product)) + '</strong><small>' + money(item.price_vnd) + ' × ' + item.quantity + ' = ' + money(item.price_vnd * item.quantity) + '</small></div><div class="cafe-cart-controls"><button type="button" data-cart-change="-1" data-product-id="' + esc(item.product.id) + '" aria-label="Уменьшить">−</button><strong>' + item.quantity + '</strong><button type="button" data-cart-change="1" data-product-id="' + esc(item.product.id) + '" aria-label="Увеличить">+</button></div></div>').join("");
    if (submit) submit.disabled = loading || !entries.length;
  }

  async function loadMenu() {
    const loadingEl = byId("cafeLoading");
    if (loadingEl) loadingEl.hidden = false;
    setError("");
    try {
      const response = await fetch(MENU_URL);
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Не удалось загрузить меню");
      products = Array.isArray(result.products) ? result.products : [];
      locationId = result.location?.id || null;
      renderProducts();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ошибка загрузки меню");
    } finally { if (loadingEl) loadingEl.hidden = true; }
  }

  function changeProduct(productId, delta) {
    const product = products.find(p => String(p.id) === String(productId));
    if (!product) return;
    const current = cart.get(product.id);
    const quantity = (current?.quantity || 0) + delta;
    if (quantity <= 0) cart.delete(product.id);
    else if (quantity <= 99) cart.set(product.id, { product, quantity, price_vnd: Number(product.price_vnd) });
    else if (typeof showToast === "function") showToast("Максимум 99 единиц одного блюда");
    renderCart();
  }

  document.addEventListener("click", event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const add = target.closest("[data-add-product]");
    if (add) { changeProduct(add.getAttribute("data-add-product"), 1); return; }
    const change = target.closest("[data-cart-change]");
    if (change) changeProduct(change.getAttribute("data-product-id"), Number(change.getAttribute("data-cart-change")));
  });

  const orderType = byId("cafeOrderType"), addressLabel = byId("cafeAddressLabel"), addressInput = byId("cafeDeliveryAddress");
  orderType?.addEventListener("change", () => {
    const delivery = orderType.value === "delivery";
    if (addressLabel) addressLabel.hidden = !delivery;
    if (addressInput) addressInput.required = delivery;
  });

  byId("cafeOrderForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    const resultEl = byId("cafeOrderResult"), submit = byId("cafeSubmitOrder");
    if (!cart.size) { if (typeof showToast === "function") showToast("Сначала добавьте блюда в заказ"); return; }
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData) { if (typeof showToast === "function") showToast("Откройте приложение через Telegram"); return; }
    if (orderType?.value === "delivery" && !addressInput?.value.trim()) { addressInput?.focus(); if (typeof showToast === "function") showToast("Укажите адрес доставки"); return; }

    loading = true; renderCart();
    if (resultEl) resultEl.hidden = true;
    if (submit) submit.textContent = "Оформляем заказ…";
    try {
      const response = await fetch(ORDER_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData,
          items: Array.from(cart.values()).map(item => ({ productId: item.product.id, quantity: item.quantity })),
          orderType: orderType?.value || "pickup",
          paymentMethod: byId("cafePaymentMethod")?.value || "cash",
          locationId,
          customerName: byId("cafeCustomerName")?.value.trim() || "",
          customerPhone: byId("cafeCustomerPhone")?.value.trim() || "",
          deliveryAddress: addressInput?.value.trim() || "",
          customerNote: byId("cafeCustomerNote")?.value.trim() || ""
        })
      });
      const result = await response.json();
      if (!response.ok || !result.ok || !result.order) throw new Error(result.error || "Не удалось оформить заказ");
      const order = result.order;
      cart.clear(); renderCart();
      if (resultEl) {
        resultEl.innerHTML = "Заказ №" + esc(order.orderNumber) + " принят.<br>Статус: ожидает подтверждения кафе.<br>Сумма: " + money(order.totalVnd);
        resultEl.hidden = false;
      }
      byId("cafeOrderForm")?.reset();
      if (addressLabel) addressLabel.hidden = true;
      if (addressInput) addressInput.required = false;
    } catch (error) {
      if (resultEl) { resultEl.textContent = error instanceof Error ? error.message : "Ошибка оформления заказа"; resultEl.hidden = false; }
    } finally {
      loading = false; renderCart();
      if (submit) submit.textContent = "Оформить заказ";
    }
  });

  const statusNames = {
    pending: "Ожидает подтверждения",
    confirmed: "Принят кафе",
    preparing: "Готовится",
    ready: "Готов к выдаче",
    completed: "Выдан",
    cancelled: "Отменён"
  };
  let myOrdersLoaded = false;
  let myOrdersLoading = false;

  async function loadMyOrders() {
    if (myOrdersLoading) return;
    const initData = window.Telegram?.WebApp?.initData;
    const message = byId("cafeMyOrdersMessage");
    const root = byId("cafeMyOrdersList");
    if (!initData) {
      if (message) { message.textContent = "Откройте приложение через Telegram."; message.hidden = false; }
      return;
    }
    myOrdersLoading = true;
    if (message) { message.textContent = "Загружаем ваши заказы…"; message.hidden = false; }
    if (root) root.innerHTML = "";
    try {
      const response = await fetch(MY_ORDERS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Не удалось загрузить заказы");
      const orders = Array.isArray(result.orders) ? result.orders : [];
      myOrdersLoaded = true;
      if (!orders.length) {
        if (message) { message.textContent = "У вас пока нет заказов."; message.hidden = false; }
        return;
      }
      if (message) message.hidden = true;
      if (root) root.innerHTML = orders.map(order => {
        const items = Array.isArray(order.cafe_order_items) ? order.cafe_order_items : [];
        const events = Array.isArray(order.cafe_order_events) ? order.cafe_order_events : [];
        const itemsHtml = items.map(item => "<li><span>" + esc(item.product_name_ru || item.product_name_en || "Блюдо") + " × " + Number(item.quantity) + "</span><strong>" + money(item.line_total_vnd) + "</strong></li>").join("");
        const historyHtml = events.map(item => "<li><span>" + esc(statusNames[item.to_status] || item.to_status) + "</span><small>" + esc(item.created_at ? new Date(item.created_at).toLocaleString("ru-RU", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" }) : "") + "</small></li>").join("");
        const orderTypeName = { pickup:"Самовывоз", dine_in:"В кафе", delivery:"Доставка" }[order.order_type] || order.order_type;
        return '<article class="cafe-my-order-card"><div class="cafe-my-order-head"><div><strong>Заказ №' + esc(order.order_number) + '</strong><small>' + esc(order.created_at ? new Date(order.created_at).toLocaleString("ru-RU", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" }) : "") + '</small></div><span class="cafe-my-order-status status-' + esc(order.status) + '">' + esc(statusNames[order.status] || order.status) + '</span></div><p class="cafe-my-order-type">' + esc(orderTypeName) + '</p><ul class="cafe-my-order-items">' + itemsHtml + '</ul><div class="cafe-my-order-total"><span>Итого</span><strong>' + money(order.total_vnd) + '</strong></div>' + (historyHtml ? '<details class="cafe-my-order-history"><summary>История статусов</summary><ul>' + historyHtml + '</ul></details>' : "") + '</article>';
      }).join("");
    } catch (error) {
      if (message) { message.textContent = error instanceof Error ? error.message : "Не удалось загрузить заказы"; message.hidden = false; }
    } finally { myOrdersLoading = false; }
  }

  byId("cafeMyOrdersToggle")?.addEventListener("click", async () => {
    const section = byId("cafeMyOrdersSection");
    const refresh = byId("cafeMyOrdersRefresh");
    if (!section) return;
    section.hidden = !section.hidden;
    if (refresh) refresh.hidden = section.hidden;
    if (!section.hidden) await loadMyOrders();
  });
  byId("cafeMyOrdersRefresh")?.addEventListener("click", loadMyOrders);

  byId("cafeBack")?.addEventListener("click", () => { if (typeof openPage === "function") openPage("home"); });
  window.ummaCafe = {
    refreshMenu: loadMenu,
    refreshMyOrders: loadMyOrders,
    open: () => { if (typeof openPage === "function") openPage("cafe"); if (!products.length) loadMenu(); }
  };
  renderCart();
})();