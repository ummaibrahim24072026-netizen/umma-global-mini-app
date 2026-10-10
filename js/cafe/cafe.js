/* UMMA CAFE — LIVE MENU, CART AND ORDER CREATION */
(() => {
  "use strict";
  const MENU_URL = "https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-menu";
  const ORDER_URL = "https://zwzojugspldexyyljwpr.supabase.co/functions/v1/create-cafe-order";
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

  byId("cafeBack")?.addEventListener("click", () => { if (typeof openPage === "function") openPage("home"); });
  window.ummaCafe = {
    refreshMenu: loadMenu,
    open: () => { if (typeof openPage === "function") openPage("cafe"); if (!products.length) loadMenu(); }
  };
  renderCart();
})();