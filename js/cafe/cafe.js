/* UMMA CAFE — LIVE MENU, CART AND ORDER CREATION */
(() => {
  "use strict";
  const MENU_URL = "https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-menu";
  const ORDER_URL = "https://zwzojugspldexyyljwpr.supabase.co/functions/v1/create-cafe-order";
  const PROOF_URL = "https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-transfer-proof";
  const MY_ORDERS_URL = "https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-my-orders";
  const money = value => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(value) || 0);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" })[char]);
  const icons = { "UMMA-CAFE-SHURPA":"🍲", "UMMA-CAFE-PLOV":"🍛", "UMMA-CAFE-MANTI":"🥟", "UMMA-CAFE-FLATBREAD":"🫓", "UMMA-CAFE-SALAD":"🥗", "UMMA-CAFE-SAMSA":"🥮", "UMMA-CAFE-AYRAN":"🥛" };
  let products = [], inventoryRows = [], locations = [], locationId = null, loading = false, locationMode = "nearest", inventoryControlEnabled = false;
  let menuQuery = "", menuCategory = "all";
  // Explicit SKU assignment avoids classifying chicken with salad as a salad.
  const menuCategories = [
    { id: "soups", label: "Супы", skus: ["SHURPA", "BORSCHT"] },
    { id: "mains", label: "Горячее", skus: ["PLOV", "MANTI", "CHICKEN-LEG-SALAD"] },
    { id: "salads", label: "Салаты", skus: ["SALAD", "OLIVIER", "VINAIGRETTE", "CRUNCHY-SALAD"] },
    { id: "bakery", label: "Выпечка", skus: ["FLATBREAD", "SAMSA", "SAMSA-CHICKEN", "CHEESE-KHACHAPURI"] },
    { id: "desserts", label: "Десерты", skus: ["CROISSANT"] },
    { id: "drinks", label: "Напитки", skus: ["AYRAN", "AYRAN-500", "TURKISH-AYRAN-1000", "GREEN-TEA-900", "BLACK-TEA-LEMON-900", "BLACKBERRY-COMPOTE-500", "BLACKBERRY-COMPOTE-1000"] },
    { id: "sauces", label: "Соусы", skus: ["ADJIKA"] },
    { id: "other", label: "Другое", skus: [] }
  ];
  const categoryFor = product => menuCategories.find(category => category.skus.some(sku => product.sku === "UMMA-CAFE-" + sku))?.id || "other";
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

  const productPhotos = new Map([
    ["UMMA-CAFE-SHURPA", "logo/assets/menu/shurpa-white-v2.webp"],
    ["UMMA-CAFE-PLOV", "logo/assets/menu/plov-white-v2.webp"],
    ["UMMA-CAFE-FLATBREAD", "logo/assets/menu/flatbread-white-v2.webp"],
    ["UMMA-CAFE-MANTI", "logo/assets/menu/manti.png"],
    ["UMMA-CAFE-SALAD", "logo/assets/menu/salad.png"],
    ["UMMA-CAFE-AYRAN", "logo/assets/menu/ayran-300.png"],
    ["UMMA-CAFE-SAMSA", "logo/assets/menu/samsa-white.webp"],
    ["UMMA-CAFE-SAMSA-CHICKEN", "logo/assets/menu/samsa-white.webp"]
  ]);
  const halalBadge = '<svg class="cafe-halal-badge" viewBox="0 0 100 100" role="img" aria-label="Халяль" focusable="false"><path d="M50 3 64 17 83 17 83 36 97 50 83 64 83 83 64 83 50 97 36 83 17 83 17 64 3 50 17 36 17 17 36 17Z" fill="#fffdf5" stroke="#bd963e" stroke-width="3" stroke-linejoin="round"/><path d="M50 13 62 25 75 25 75 38 87 50 75 62 75 75 62 75 50 87 38 75 25 75 25 62 13 50 25 38 25 25 38 25Z" fill="none" stroke="#bd963e" stroke-width="1.4"/><text x="50" y="48" text-anchor="middle" fill="#075e65" font-family="Times New Roman,serif" font-size="28" lang="ar">حلال</text><text x="50" y="70" text-anchor="middle" fill="#075e65" font-family="Arial,sans-serif" font-size="11" font-weight="700">HALAL</text></svg>';
  function productPhoto(product) {
    const source = productPhotos.get(product.sku) || product.image_url;
    if (!source) return "";
    try {
      const url = new URL(source, document.baseURI);
      if (url.protocol !== "https:" || url.username || url.password) return "";
      return '<div class="cafe-product-media"><img class="cafe-product-photo" src="' + esc(url.href) + '" alt="' + esc(name(product)) + '" loading="lazy" decoding="async" referrerpolicy="no-referrer"></div>';
    } catch { return ""; }
  }
  byId("cafeProducts")?.addEventListener("error", event => {
    if (event.target.matches?.(".cafe-product-photo")) {
      event.target.hidden = true;
      const frame = event.target.closest(".cafe-product-media");
      if (frame) frame.hidden = true;
      event.target.closest(".cafe-product")?.classList.add("cafe-product-no-photo");
    }
  }, true);
  byId("cafeMenuSearch")?.addEventListener("input", event => {
    menuQuery = event.target.value;
    const clear = byId("cafeMenuSearchClear");
    if (clear) clear.hidden = !menuQuery;
    renderProducts();
  });
  byId("cafeMenuSearchClear")?.addEventListener("click", () => {
    menuQuery = "";
    const input = byId("cafeMenuSearch");
    if (input) { input.value = ""; input.focus(); }
    byId("cafeMenuSearchClear").hidden = true;
    renderProducts();
  });

  byId("cafeMenuCategories")?.addEventListener("click", event => {
    const button = event.target.closest("[data-menu-category]");
    if (!button) return;
    menuCategory = button.dataset.menuCategory;
    renderProducts();
    byId("cafeMenuCategories").querySelector('[data-menu-category="' + menuCategory + '"]')?.focus({ preventScroll: true });
  });
  byId("cafeMenuReset")?.addEventListener("click", () => {
    menuQuery = "";
    menuCategory = "all";
    const input = byId("cafeMenuSearch");
    if (input) input.value = "";
    if (byId("cafeMenuSearchClear")) byId("cafeMenuSearchClear").hidden = true;
    renderProducts();
    input?.focus({ preventScroll: true });
  });

  function renderCategories(availableProducts) {
    const root = byId("cafeMenuCategories");
    if (!root) return;
    const counts = new Map(menuCategories.map(category => [category.id, availableProducts.filter(p => categoryFor(p) === category.id).length]));
    // Reset a vanished section when switching cafe or refreshing stock.
    if (menuCategory !== "all" && !counts.get(menuCategory)) menuCategory = "all";
    const categories = [{ id: "all", label: "Все", count: availableProducts.length }, ...menuCategories.map(category => ({ ...category, count: counts.get(category.id) })).filter(category => category.count)];
    root.innerHTML = categories.map(category => '<button type="button" class="cafe-category" data-menu-category="' + category.id + '" aria-pressed="' + (menuCategory === category.id) + '" aria-controls="cafeProducts">' + category.label + '<span aria-hidden="true">' + category.count + '</span></button>').join("");
    const reset = byId("cafeMenuReset");
    if (reset) reset.hidden = !menuQuery && menuCategory === "all";
  }

  function renderProducts() {
    const root = byId("cafeProducts");
    if (!root) return;
    const availableProducts = products.map(p => {
      const stock = inventoryRows.find(i => String(i.product_id) === String(p.id) && String(i.location_id) === String(locationId));
      if (!inventoryControlEnabled) return { ...p, stockAvailable: 99, stockIsAvailable: true };
      return stock ? { ...p, price_vnd: stock.price_vnd == null ? p.price_vnd : stock.price_vnd,
        stockAvailable: Number(stock.quantity) - Number(stock.reserved_quantity || 0), stockIsAvailable: stock.is_available !== false } : null;
    }).filter(p => p && p.stockIsAvailable && p.stockAvailable > 0);
    renderCategories(availableProducts);
    const query = menuQuery.trim().toLocaleLowerCase();
    const visibleProducts = availableProducts.filter(p => (menuCategory === "all" || categoryFor(p) === menuCategory) && (!query || [p.name_ru, p.name_en, p.name_vi, p.description_ru, p.description_en, p.description_vi].some(value => String(value || "").toLocaleLowerCase().includes(query))));
    const resultCount = byId("cafeMenuCount");
    if (resultCount) resultCount.textContent = (query || menuCategory !== "all") ? "Найдено: " + visibleProducts.length + " из " + availableProducts.length : "Доступно в меню: " + availableProducts.length;
    if (availableProducts.length && !visibleProducts.length) { root.innerHTML = '<div class="cafe-message">Ничего не найдено. Измените запрос, выберите другую категорию или нажмите «Показать всё меню».</div>'; return; }
    if (!visibleProducts.length) { root.innerHTML = '<div class="cafe-message">В выбранном кафе пока нет товаров с доступным остатком. Выберите другое кафе или попробуйте позже.</div>'; return; }
    const productCard = p => {
      const weight = p.weight_value ? (p.weight_unit === "ml" ? Number(p.weight_value) + " мл" : "≈ " + Number(p.weight_value) + " г") : "";
      const selected = cart.get(p.id);
      const quantity = selected?.quantity || 0;
      const productId = esc(p.id);
      const photo = productPhoto(p);
      return '<article class="cafe-product' + (photo ? '' : ' cafe-product-no-photo') + (quantity ? ' cafe-product-selected' : '') + '" data-product-card="' + productId + '">' +
        photo + halalBadge + '<div class="cafe-product-top"><span class="cafe-product-icon">' + (icons[p.sku] || "🍽️") + '</span><span class="cafe-product-weight">' + esc(weight) + '</span></div>' +
        '<h3>' + esc(name(p)) + '</h3>' +
        (description(p).trim() ? '<details class="cafe-product-description"><summary>Описание</summary><p>' + esc(description(p)) + '</p></details>' : '') +
        '<div class="cafe-product-selection' + (quantity ? ' is-visible' : '') + '"' + (quantity ? '' : ' hidden') + '><span>В заказе</span><strong class="cafe-product-quantity">' + quantity + '</strong></div>' +
        '<div class="cafe-product-bottom"><span class="cafe-product-price">' + money(p.price_vnd) + '</span>' +
        (quantity
          ? '<div class="cafe-card-quantity"><button type="button" class="cafe-qty-btn" data-cart-change="-1" data-product-id="' + productId + '" aria-label="Уменьшить ' + esc(name(p)) + '">−</button><strong>' + quantity + '</strong><button type="button" class="cafe-qty-btn" data-add-product="' + productId + '" aria-label="Добавить ещё ' + esc(name(p)) + '">+</button></div>'
          : '<button type="button" class="cafe-add" data-add-product="' + productId + '" aria-label="Добавить ' + esc(name(p)) + '">+</button>') +
        '</div></article>';
    };
    const groups = menuCategories.map(category => ({ ...category, products: visibleProducts.filter(p => categoryFor(p) === category.id) })).filter(category => category.products.length);
    root.innerHTML = groups.map(category => '<h3 class="cafe-category-heading">' + category.label + '<span>' + category.products.length + '</span></h3>' + category.products.map(productCard).join("")).join("");
  }

  function fillTelegramCustomerName() {
    const input = byId("cafeCustomerName");
    if (!input || input.value.trim()) return;
    // Display data only: authentication continues to use signed initData server-side.
    const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (!user) return;
    const fullName = [user.first_name, user.last_name].filter(value => typeof value === "string" && value.trim()).map(value => value.trim()).join(" ");
    const id = String(user.id ?? "");
    const fallback = /^\d+$/.test(id) && Number(id) > 0 ? "Telegram ID: " + id : "";
    input.value = (fullName || fallback).slice(0, 120);
  }

  function renderCart() {
    fillTelegramCustomerName();
    const root = byId("cafeCartItems"), countEl = byId("cafeCartCount"), totalEl = byId("cafeCartTotal"), submit = byId("cafeSubmitOrder");
    if (!root || !countEl || !totalEl) return;
    const entries = Array.from(cart.values());
    countEl.textContent = count() + (count() === 1 ? " позиция" : " позиций");
    totalEl.textContent = money(total());
    if (!entries.length) root.innerHTML = '<p class="cafe-empty-cart">Добавьте блюда из меню.</p>';
    else root.innerHTML = entries.map(item => '<div class="cafe-cart-row"><div><strong>' + esc(name(item.product)) + '</strong><small>' + money(item.price_vnd) + ' × ' + item.quantity + ' = ' + money(item.price_vnd * item.quantity) + '</small></div><div class="cafe-cart-controls"><button type="button" data-cart-change="-1" data-product-id="' + esc(item.product.id) + '" aria-label="Уменьшить">−</button><strong>' + item.quantity + '</strong><button type="button" data-cart-change="1" data-product-id="' + esc(item.product.id) + '" aria-label="Увеличить">+</button></div></div>').join("");
    if (submit) submit.disabled = loading || !entries.length;
    if(byId("cafeOrderForm"))byId("cafeOrderForm").hidden=entries.length===0;
    const sticky = byId("cafeStickyOrder");
    const stickyCount = byId("cafeStickyCount");
    const stickyTotal = byId("cafeStickyTotal");
    if (stickyCount) stickyCount.textContent = count() + (count() === 1 ? " блюдо" : " блюд");
    if (stickyTotal) stickyTotal.textContent = money(total());
    if (sticky) sticky.hidden = entries.length === 0;
    renderProductSelection();
  }

  function renderProductSelection() {
    const root = byId("cafeProducts");
    if (!root) return;
    root.querySelectorAll("[data-product-card]").forEach(card => {
      const id = card.getAttribute("data-product-card");
      const item = cart.get(id);
      const quantity = item?.quantity || 0;
      card.classList.toggle("cafe-product-selected", quantity > 0);
      const badge = card.querySelector(".cafe-product-selection");
      if (badge) {
        badge.hidden = quantity === 0;
        badge.classList.toggle("is-visible", quantity > 0);
        const value = badge.querySelector(".cafe-product-quantity");
        if (value) value.textContent = String(quantity);
      }
      const bottom = card.querySelector(".cafe-product-bottom");
      if (!bottom) return;
      const price = bottom.querySelector(".cafe-product-price");
      const priceHtml = price ? price.outerHTML : "";
      const productName = card.querySelector("h3")?.textContent || "блюдо";
      const safeName = esc(productName);
      const safeId = esc(id);
      bottom.innerHTML = priceHtml + (quantity
        ? '<div class="cafe-card-quantity"><button type="button" class="cafe-qty-btn" data-cart-change="-1" data-product-id="' + safeId + '" aria-label="Уменьшить ' + safeName + '">−</button><strong>' + quantity + '</strong><button type="button" class="cafe-qty-btn" data-add-product="' + safeId + '" aria-label="Добавить ещё ' + safeName + '">+</button></div>'
        : '<button type="button" class="cafe-add" data-add-product="' + safeId + '" aria-label="Добавить ' + safeName + '">+</button>');
    });
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
      inventoryRows = Array.isArray(result.inventory) ? result.inventory : [];
      inventoryControlEnabled = result.inventoryControlEnabled === true;
      locations = Array.isArray(result.locations) ? result.locations : (result.location ? [result.location] : []);
      locationId = result.location?.id || locations[0]?.id || null;
      renderProducts();
      renderLocationOptions();
      if (byId("cafeLocationMode")?.value !== "manual") requestNearestLocation();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ошибка загрузки меню");
    } finally { if (loadingEl) loadingEl.hidden = true; }
  }

  function renderLocationOptions() {
    const select = byId("cafeLocationSelect");
    if (!select) return;
    select.innerHTML = locations.map(location => {
      const label = [location.name, location.address, location.city].filter(Boolean).join(" — ");
      return '<option value="' + esc(location.id) + '">' + esc(label) + '</option>';
    }).join("");
    if (locationId) select.value = locationId;
    const manual = byId("cafeLocationSelectLabel");
    if (manual) manual.hidden = byId("cafeLocationMode")?.value !== "manual";
    updateLocationMessage();
  }

  function updateLocationMessage(text) {
    const el = byId("cafeLocationMessage");
    if (!el) return;
    if (text) { el.textContent = text; return; }
    const selected = locations.find(location => String(location.id) === String(locationId));
    window.ummaDeliveryLocation?.setCafeLocation(selected);
    el.textContent = selected ? "Заказ будет отправлен в кафе: " + selected.name + (selected.address ? " · " + selected.address : "") : "Выберите кафе для заказа.";
  }

  function haversineKm(lat1, lon1, lat2, lon2) {
    const rad = value => value * Math.PI / 180;
    const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
    const a = Math.sin(dLat/2)**2 + Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLon/2)**2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  function requestNearestLocation() {
    locationMode = "nearest";
    const mode = byId("cafeLocationMode"), manual = byId("cafeLocationSelectLabel");
    if (mode) mode.value = "nearest";
    if (manual) manual.hidden = true;
    if (locations.length === 1) {
      setSelectedLocation(locations[0].id);
      if(mode?.closest("label"))mode.closest("label").hidden=true;
      updateLocationMessage("Кафе: " + locations[0].name);
      return;
    }
    const allHaveCoordinates = locations.length > 0 && locations.every(location =>
      Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude)) &&
      location.latitude !== null && location.longitude !== null && location.latitude !== "" && location.longitude !== ""
    );
    if (!allHaveCoordinates) {
      if (mode) mode.value = "manual";
      locationMode = "manual";
      if (manual) manual.hidden = false;
      updateLocationMessage("Автовыбор пока недоступен: у каждого кафе должны быть указаны координаты. Выберите кафе вручную.");
      return;
    }
    if (!navigator.geolocation) {
      if (mode) mode.value = "manual";
      locationMode = "manual";
      if (manual) manual.hidden = false;
      updateLocationMessage("Геолокация недоступна на этом устройстве. Выберите кафе вручную.");
      return;
    }
    updateLocationMessage("Определяем ваше местоположение…");
    navigator.geolocation.getCurrentPosition(position => {
      const userLat = position.coords.latitude, userLon = position.coords.longitude;
      const nearest = locations.map(location => ({
        location,
        distance: haversineKm(userLat, userLon, Number(location.latitude), Number(location.longitude))
      })).sort((a,b) => a.distance - b.distance)[0];
      if (!nearest) {
        if (mode) mode.value = "manual";
        locationMode = "manual";
        if (manual) manual.hidden = false;
        updateLocationMessage("Не удалось выбрать кафе. Выберите его вручную.");
        return;
      }
      setSelectedLocation(nearest.location.id);
      updateLocationMessage("Ближайшее кафе: " + nearest.location.name + " · примерно " + nearest.distance.toFixed(1) + " км по прямой.");
    }, error => {
      if (mode) mode.value = "manual";
      locationMode = "manual";
      if (manual) manual.hidden = false;
      const message = error.code === 1
        ? "Доступ к геолокации не разрешён. Выберите кафе вручную."
        : "Не удалось определить геолокацию. Выберите кафе вручную.";
      updateLocationMessage(message);
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  }

  byId("cafeLocationMode")?.addEventListener("change", event => {
    const mode = event.target.value;
    locationMode = mode;
    const manual = byId("cafeLocationSelectLabel");
    if (mode === "manual") {
      if (manual) manual.hidden = false;
      updateLocationMessage();
    } else {
      requestNearestLocation();
    }
  });
  function setSelectedLocation(nextId) {
    if (String(nextId || "") !== String(locationId || "")) { cart.clear(); renderCart(); }
    locationId = nextId || null;
    const select = byId("cafeLocationSelect");
    if (select) select.value = locationId || "";
    renderProducts();
    updateLocationMessage();
  }
  byId("cafeLocationSelect")?.addEventListener("change", event => setSelectedLocation(event.target.value));

  byId("cafeStickyGoToOrder")?.addEventListener("click", () => {
    const cartSection = document.querySelector("#cafePage .cafe-cart");
    if (cartSection) cartSection.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  function changeProduct(productId, delta) {
    const baseProduct = products.find(p => String(p.id) === String(productId));
    const stock = inventoryRows.find(i => String(i.product_id) === String(productId) && String(i.location_id) === String(locationId));
    if (!baseProduct) return;
    if (inventoryControlEnabled && (!stock || stock.is_available === false)) return;
    const product = inventoryControlEnabled
      ? { ...baseProduct, price_vnd: stock.price_vnd == null ? baseProduct.price_vnd : stock.price_vnd,
          stockAvailable: Number(stock.quantity) - Number(stock.reserved_quantity || 0) }
      : { ...baseProduct, stockAvailable: 99 };
    const current = cart.get(product.id);
    const quantity = (current?.quantity || 0) + delta;
    if (quantity <= 0) cart.delete(product.id);
    else if (quantity <= 99 && quantity <= Number(product.stockAvailable)) cart.set(product.id, { product, quantity, price_vnd: Number(product.price_vnd) });
    else if (quantity > Number(product.stockAvailable) && typeof showToast === "function") showToast("Доступный остаток: " + Math.max(0, Number(product.stockAvailable)));
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
  function syncCustomerPayment(){
    const type=orderType?.value||"pickup", timing=byId("cafePaymentTiming"), method=byId("cafePaymentMethod");
    if(timing){const later=timing.querySelector('option[value="later"]');if(later)later.disabled=type!=="dine_in";if(type!=="dine_in")timing.value="now";}
    const country=byId("cafeTransferCountryLabel");if(country)country.hidden=method?.value!=="bank_transfer";
    if(method){const cash=method.querySelector('option[value="cash"]');if(cash)cash.textContent=type==="delivery"?"Оплата курьеру при доставке":"Наличными в кафе";}
    const hint=byId("cafePaymentHint");if(hint)hint.textContent=type==="delivery"?"QR-оплата заранее либо наличными курьеру при получении.":type==="pickup"?"Для заказа с собой оплата производится сразу.":"В кафе можно оплатить сразу или после трапезы.";
  }
  function syncOrderMode() {
    const delivery = orderType?.value === "delivery";
    byId("cafeOrderModes")?.querySelectorAll("[data-order-mode]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.orderMode === orderType?.value));
    });
    if (addressLabel) addressLabel.hidden = !delivery;
    if (addressInput) addressInput.required = delivery && !window.ummaDeliveryLocation?.hasPoint();
    if (byId("cafeDeliveryLocation")) byId("cafeDeliveryLocation").hidden = !delivery;
    syncCustomerPayment();
  }
  orderType?.addEventListener("change", syncOrderMode);
  document.addEventListener("umma:delivery-location-change", syncOrderMode);
  byId("cafeOrderModes")?.addEventListener("click", event => {
    const button = event.target.closest("[data-order-mode]");
    if (!button || !orderType || !["dine_in", "pickup", "delivery"].includes(button.dataset.orderMode)) return;
    orderType.value = button.dataset.orderMode;
    orderType.dispatchEvent(new Event("change", { bubbles: true }));
  });
  byId("cafeOrderForm")?.addEventListener("reset", () => queueMicrotask(() => { window.ummaDeliveryLocation?.reset(); syncOrderMode(); fillTelegramCustomerName(); }));
  byId("cafePaymentTiming")?.addEventListener("change",syncCustomerPayment);
  byId("cafePaymentMethod")?.addEventListener("change",syncCustomerPayment);
  syncOrderMode();

  byId("cafeOrderForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    if (loading) return;
    const resultEl = byId("cafeOrderResult"), submit = byId("cafeSubmitOrder");
    if (!cart.size) { if (typeof showToast === "function") showToast("Сначала добавьте блюда в заказ"); return; }
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData) { if (typeof showToast === "function") showToast("Откройте приложение через Telegram"); return; }
    if (orderType?.value === "delivery" && !addressInput?.value.trim() && !window.ummaDeliveryLocation?.hasPoint()) { addressInput?.focus(); if (typeof showToast === "function") showToast("Укажите адрес доставки"); return; }

    fillTelegramCustomerName();
    const paymentTiming=orderType?.value==="delivery"&&byId("cafePaymentMethod")?.value==="cash"?"on_delivery":(byId("cafePaymentTiming")?.value||"now");
    if(orderType?.value!=="dine_in"&&paymentTiming==="later"){if(typeof showToast==="function")showToast("Оплата позже возможна только в кафе");return;}
    const submittedItems = Array.from(cart.values()).map(item => ({ productId: item.product.id, quantity: item.quantity }));
    loading = true; renderCart();
    if (resultEl) resultEl.hidden = true;
    if (submit) submit.textContent = "Оформляем заказ…";
    try {
      const response = await window.ummaCafeRequests.request(ORDER_URL, {
          initData,
          items: Array.from(cart.values()).map(item => ({ productId: item.product.id, quantity: item.quantity })),
          orderType: orderType?.value || "pickup",
          paymentTiming,
          paymentMethod: byId("cafePaymentMethod")?.value || "cash",
          locationId,
          customerName: byId("cafeCustomerName")?.value.trim() || "",
          customerPhone: byId("cafeCustomerPhone")?.value.trim() || "",
          deliveryAddress: orderType?.value === "delivery" && window.ummaDeliveryLocation ? window.ummaDeliveryLocation.getAddress(addressInput?.value) : addressInput?.value.trim() || "",
          customerNote: byId("cafeCustomerNote")?.value.trim() || ""
      });
      const result = await response.json();
      if (!response.ok || !result.ok || !result.order) throw new Error(result.error || "Не удалось оформить заказ");
      const order = result.order;
      for (const item of submittedItems) {
        const stock = inventoryRows.find(i => String(i.product_id) === String(item.productId) && String(i.location_id) === String(locationId));
        if (stock) stock.reserved_quantity = Number(stock.reserved_quantity || 0) + Number(item.quantity);
      }
      cart.clear(); renderCart(); renderProducts();
      if (resultEl) {
        const selectedCafe = locations.find(location => String(location.id) === String(locationId));
        const notificationLine = Number(result.staffNotified) > 0
          ? "<br>Уведомления сотрудникам кафе: " + Number(result.staffNotified)
          : "<br>Внимание: уведомление сотрудникам не подтверждено. Свяжитесь с кафе, если заказ срочный.";
        resultEl.innerHTML = "Заказ №" + esc(order.orderNumber) + " принят.<br>Кафе: " + esc(selectedCafe?.name || "Umma Cafe") + "<br>Статус: ожидает подтверждения кафе.<br>Сумма: " + money(order.totalVnd) + notificationLine;
        if(byId("cafePaymentMethod")?.value==="bank_transfer"){
          const country=byId("cafeTransferCountry")?.value||"RU";
          resultEl.innerHTML += '<div><p>Переведите сумму по реквизитам, полученным от кафе. Приложите скриншот перевода. Оплату подтвердит сотрудник после проверки поступления денег.</p><label>Скриншот перевода<input id="cafeTransferFile" type="file" accept="image/png,image/jpeg,image/webp"></label><button type="button" id="cafeTransferSend" class="cafe-submit">Отправить чек</button><p id="cafeTransferMessage"></p></div>';
          byId("cafeTransferSend")?.addEventListener("click",async()=>{
            const file=byId("cafeTransferFile")?.files?.[0],msg=byId("cafeTransferMessage"),btn=byId("cafeTransferSend");
            if(!file||!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>5242880){if(msg)msg.textContent="Выберите JPG, PNG или WEBP до 5 МБ.";return;}
            if(btn)btn.disabled=true;
            try{
              const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=()=>reject(new Error("Не удалось прочитать файл"));reader.readAsDataURL(file);});
              const response=await fetch(PROOF_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"submit",initData:window.Telegram?.WebApp?.initData,orderId:order.id,bankCountry:country,mimeType:file.type,base64})});
              const data=await response.json();if(!response.ok||!data.ok)throw new Error(data.error||"Ошибка отправки");
              if(msg)msg.textContent="Чек отправлен. Ожидайте подтверждения сотрудником кафе.";if(btn)btn.hidden=true;
            }catch(e){if(msg)msg.textContent=e.message||"Ошибка отправки";if(btn)btn.disabled=false;}
          });
        }
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

  document.addEventListener("umma:cafe-operation-recovered",event=>{
    if(event.detail.payload.staffOrder||event.detail.payload.action)return;
    cart.clear();renderCart();renderProducts();
    const result=byId("cafeOrderResult"),order=event.detail.result.order;
    if(result){result.hidden=false;result.textContent="Восстановлен заказ №"+order.orderNumber+". Проверьте его во вкладке «Мои заказы».";}
    loadMyOrders();
  });
  const statusNames = {
    pending: "Ожидает подтверждения",
    confirmed: "Принят кафе",
    preparing: "Готовится",
    ready: "Готов к выдаче",
    completed: "Выдан",
    cancelled: "Отменён", waiting_courier:"Ожидает курьера",courier_assigned:"Курьер принял заказ",picked_up:"Курьер в пути",delivered:"Доставлено"
  };
  let myOrdersLoaded = false;
  let myOrdersLoading = false,myOrdersQueued=false;

  let myOrdersFingerprint=null;
  async function loadMyOrders(options = {}) {
    const silent=options?.silent === true;
    if (myOrdersLoading) {myOrdersQueued=true;return;}
    const initData = window.Telegram?.WebApp?.initData;
    const message = byId("cafeMyOrdersMessage");
    const root = byId("cafeMyOrdersList");
    if (!initData) {
      if (message) { message.textContent = "Откройте приложение через Telegram."; message.hidden = false; }
      return;
    }
    myOrdersLoading = true;
    if (!silent && message) { message.textContent = "Загружаем ваши заказы…"; message.hidden = false; }
    try {
      const response = await fetch(MY_ORDERS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData }),cache:"no-store",signal:window.AbortSignal?.timeout?.(12000)
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Не удалось загрузить заказы");
      const orders = Array.isArray(result.orders) ? result.orders : [];
      myOrdersLoaded = true;
      const fingerprint=JSON.stringify(orders);
      if(silent&&fingerprint===myOrdersFingerprint){if(message)message.hidden=true;return;}
      myOrdersFingerprint=fingerprint;
      if (!orders.length) {
        if(root)root.innerHTML="";
        if (message) { message.textContent = "У вас пока нет заказов."; message.hidden = false; }
        return;
      }
      if (message) message.hidden = true;
      if (root) root.innerHTML = orders.map(order => {
        const items = Array.isArray(order.cafe_order_items) ? order.cafe_order_items : [];
        const events = Array.isArray(order.cafe_order_events) ? order.cafe_order_events : [];
        const itemsHtml = items.map(item => "<li><span>" + esc(item.product_name_ru || item.product_name_en || "Блюдо") + " × " + Number(item.quantity) + "</span><strong>" + money(item.line_total_vnd) + "</strong></li>").join("");
        const historyHtml = events.map(item => "<li><span>" + esc(statusNames[item.to_status] || item.to_status) + "</span><small>" + esc(item.created_at ? new Date(item.created_at).toLocaleString("ru-RU", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" }) : "") + "</small></li>").join("");
        const orderTypeName = { pickup:"С собой", dine_in:"В кафе", delivery:"Доставка" }[order.order_type] || order.order_type;
        return '<article class="cafe-my-order-card"><div class="cafe-my-order-head"><div><strong>Заказ №' + esc(order.order_number) + '</strong><small>' + esc(order.created_at ? new Date(order.created_at).toLocaleString("ru-RU", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" }) : "") + '</small></div><span class="cafe-my-order-status status-' + esc(order.status) + '">' + esc(statusNames[order.status] || order.status) + '</span></div><p class="cafe-my-order-type">' + esc(orderTypeName) + '</p>'+(order.order_type==='delivery'?'<p class="cafe-my-order-delivery">'+esc(statusNames[order.delivery_status]||'Ожидает курьера')+'</p>':'')+'<ul class="cafe-my-order-items">' + itemsHtml + '</ul><div class="cafe-my-order-total"><span>Итого</span><strong>' + money(order.total_vnd) + '</strong></div>' + (order.order_type==='delivery'&&!['completed','cancelled'].includes(order.status)&&order.delivery_status!=='delivered'?'<button type="button" class="kitchen-action" data-tracking-address="'+esc(order.delivery_address||'')+'" data-track-delivery="'+esc(order.id)+'">Где мой курьер</button>':'') + (historyHtml ? '<details class="cafe-my-order-history"><summary>История статусов</summary><ul>' + historyHtml + '</ul></details>' : "") + '</article>';
      }).join("");
    } catch (error) {
      if (message) { message.textContent = error instanceof Error ? error.message : "Не удалось загрузить заказы"; message.hidden = false; }
    } finally { myOrdersLoading = false;if(myOrdersQueued){myOrdersQueued=false;Promise.resolve().then(()=>loadMyOrders({silent:true}));} }
  }

  byId("cafeMyOrdersToggle")?.addEventListener("click",()=>{if(typeof openPage==="function")openPage("orders");});
  byId("cafeOrdersBack")?.addEventListener("click",()=>{if(typeof openPage==="function")openPage("home");});
  byId("cafeMyOrdersRefresh")?.addEventListener("click", loadMyOrders);
  const refreshVisibleOrders=()=>{if(!document.hidden&&(!byId("cafePage")?.hidden||byId("cafeOrdersPage")?.hidden===false)&&window.Telegram?.WebApp?.initData)loadMyOrders({silent:true});};
  document.addEventListener("umma:cafe-events",refreshVisibleOrders);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)refreshVisibleOrders();});
  window.addEventListener("online",refreshVisibleOrders);
  window.setInterval(refreshVisibleOrders,5000);

  byId("cafeBack")?.addEventListener("click", () => { if (typeof openPage === "function") openPage("home"); });
  window.ummaCafe = {
    refreshMenu: loadMenu,
    refreshMyOrders: loadMyOrders,
    openOrders:()=>{const section=byId("cafeMyOrdersSection"),refresh=byId("cafeMyOrdersRefresh");if(section)section.hidden=false;if(refresh)refresh.hidden=false;loadMyOrders();section?.scrollIntoView?.({block:"start",behavior:"smooth"});},
    open: () => { if (typeof openPage === "function") openPage("cafe"); if (!products.length) loadMenu(); }
  };
  renderCart();
})();
