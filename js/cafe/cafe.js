/* UMMA CAFE — LIVE MENU, CART AND ORDER CREATION */
(() => {
  "use strict";
  const MENU_URL = "https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-menu";
  const ORDER_URL = "https://zwzojugspldexyyljwpr.supabase.co/functions/v1/create-cafe-order";
  const PROOF_URL = "https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-transfer-proof";
  const MY_ORDERS_URL = "https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-my-orders";
  const money = value => new Intl.NumberFormat(window.ummaI18n?.locale() || "vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(value) || 0);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" })[char]);
  let products = [], inventoryRows = [], locations = [], locationId = null, loading = false, locationMode = "nearest", inventoryControlEnabled = false;
  let menuQuery = "", menuCategory = "all";
  let menuRevision = 0, locationRevision = 0, locating = false;
  // Explicit SKU assignment avoids classifying chicken with salad as a salad.
  const menuCategories = [
    { id: "soups", label: "Супы", skus: ["SHURPA", "BORSCHT"] },
    { id: "mains", label: "Горячее", skus: ["PLOV", "MANTI", "CHICKEN-LEG-SALAD"] },
    { id: "salads", label: "Салаты", skus: ["SALAD", "OLIVIER", "VINAIGRETTE", "CRUNCHY-SALAD"] },
    { id: "bakery", label: "Выпечка", skus: ["FLATBREAD", "SAMSA", "SAMSA-CHICKEN", "CHEESE-KHACHAPURI"] },
    { id: "desserts", label: "Десерты", skus: ["CROISSANT", "BAKLAVA-ALMOND", "BAKLAVA-WALNUT", "DESSERT-PLOMBIR", "DESSERT-HONEY", "DESSERT-RED-VELVET", "DESSERT-CHOCOLATE", "DESSERT-NAPOLEON"] },
    { id: "drinks", label: "Напитки", skus: ["AYRAN", "AYRAN-500", "TURKISH-AYRAN-1000", "GREEN-TEA-900", "BLACK-TEA-LEMON-900", "BLACKBERRY-COMPOTE-500", "BLACKBERRY-COMPOTE-1000"] },
    { id: "sauces", label: "Соусы", skus: ["ADJIKA"] },
    { id: "other", label: "Другое", skus: [] }
  ];
  const categoryFor = product => product.photo_only ? "desserts" : menuCategories.find(category => category.skus.some(sku => product.sku === "UMMA-CAFE-" + sku))?.id || "other";
  // Dessert catalogue previews until the owner supplies prices. Never orderable.
  const dessertPreviews = [["Пломбир", "Plombir cake", "Bánh kem Plombir"], ["Медовик", "Honey cake", "Bánh mật ong"], ["Красный бархат", "Red velvet cake", "Bánh nhung đỏ"], ["Шоколад", "Chocolate cake", "Bánh sô cô la"], ["Наполеон", "Napoleon cake", "Bánh Napoleon"]].map(([name_ru, name_en, name_vi], i) => ({
    name_ru, name_en, name_vi,
    sku: "UMMA-CAFE-DESSERT-" + ["PLOMBIR", "HONEY", "RED-VELVET", "CHOCOLATE", "NAPOLEON"][i],
    id: "dessert-preview-" + (i + 1),
    image_url: "assets/cafe/dessert-" + (i + 1) + "-white.webp"
  }));
  const cart = new Map();
  const byId = id => document.getElementById(id);
  const name = p => window.ummaI18n?.field(p, "name") || p.name_ru || p.name_en || p.name_vi || "Блюдо";
  const description = p => window.ummaI18n?.field(p, "description") || p.description_ru || p.description_en || "";
  const searchText = value => String(value ?? "").normalize("NFKC").toLocaleLowerCase(window.ummaI18n?.locale());
  const count = () => Array.from(cart.values()).reduce((sum, item) => sum + item.quantity, 0);
  const total = () => Array.from(cart.values()).reduce((sum, item) => sum + item.quantity * Number(item.price_vnd), 0);

  function setError(message) {
    const el = byId("cafeError");
    if (el) { el.textContent = message; el.hidden = !message; }
    if (byId("cafeMenuRetry")) byId("cafeMenuRetry").hidden = !message;
  }

  byId("cafeMenuRetry")?.addEventListener("click", () => loadMenu());

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
    const categoryBar=byId("cafeMenuCategories");
    const page=byId("cafePage");
    if(categoryBar&&page){
      const top=Math.max(0,(byId("cafeProducts")?.getBoundingClientRect().top||0)-page.getBoundingClientRect().top+page.scrollTop-categoryBar.getBoundingClientRect().height-12);
      if(page.scrollTop>top)page.scrollTop=top;
    }
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
    const categoryScroll=root.scrollLeft;
    root.innerHTML = categories.map(category => '<button type="button" class="cafe-category" data-menu-category="' + category.id + '" aria-pressed="' + (menuCategory === category.id) + '" aria-controls="cafeProducts">' + category.label + '<span aria-hidden="true">' + category.count + '</span></button>').join("");
    root.scrollLeft=categoryScroll;
    const reset = byId("cafeMenuReset");
    if (reset) reset.hidden = !menuQuery && menuCategory === "all";
  }

  function renderProducts() {
    const root = byId("cafeProducts");
    if (!root) return;
    if (locating || (locations.length && !locationId)) {
      root.innerHTML = '<p class="cafe-message">Выберите кафе, чтобы увидеть его меню.</p>';
      if (byId("cafeMenuCategories")) byId("cafeMenuCategories").replaceChildren();
      if (byId("cafeMenuCount")) byId("cafeMenuCount").textContent = "";
      return;
    }
    const availableProducts = [...products, ...dessertPreviews.filter(p => !products.some(product => product.sku === p.sku)).map(p => ({ ...p, photo_only: true, catalog_preview: true }))].map(p => {
      if (p.catalog_preview || p.price_vnd == null) return { ...p, catalog_preview: true };
      const stock = inventoryRows.find(i => String(i.product_id) === String(p.id) && String(i.location_id) === String(locationId));
      if (!inventoryControlEnabled) return { ...p, stockAvailable: 99, stockIsAvailable: true };
      return stock ? { ...p, price_vnd: stock.price_vnd == null ? p.price_vnd : stock.price_vnd,
        stockAvailable: Number(stock.quantity) - Number(stock.reserved_quantity || 0), stockIsAvailable: stock.is_available !== false } : null;
    }).filter(p => p && (p.catalog_preview || (p.stockIsAvailable && p.stockAvailable > 0)));
    renderCategories(availableProducts);
    const query = searchText(menuQuery).trim();
    const visibleProducts = availableProducts.filter(p => (menuCategory === "all" || categoryFor(p) === menuCategory) && (!query || [name(p), description(p), p.name_ru, p.name_en, p.name_vi, p.description_ru, p.description_en, p.description_vi, ...Object.values(window.ummaTranslations?.[p.name_ru] || {})].some(value => searchText(value).includes(query))));
    const resultCount = byId("cafeMenuCount");
    if (resultCount) resultCount.textContent = (query || menuCategory !== "all") ? "Найдено: " + visibleProducts.length + " из " + availableProducts.length : "Доступно в меню: " + availableProducts.length;
    if (availableProducts.length && !visibleProducts.length) { root.innerHTML = '<div class="cafe-message">Ничего не найдено. Измените запрос, выберите другую категорию или нажмите «Показать всё меню».</div>'; return; }
    if (!visibleProducts.length) { root.innerHTML = '<div class="cafe-message">В выбранном кафе пока нет товаров с доступным остатком. Выберите другое кафе или попробуйте позже.</div>'; return; }
    const productCard = p => {
      if (p.photo_only) return '<article class="cafe-product cafe-dessert-preview" data-dessert-preview="' + esc(p.id) + '" aria-label="' + esc(name(p)) + '">' +
        '<div class="cafe-product-media"><img class="cafe-product-photo" src="' + esc(p.image_url) + '" alt="' + esc(name(p)) + ' на белой тарелке" loading="lazy" decoding="async"></div><h3 translate="no" dir="auto">' + esc(name(p)) + '</h3></article>';

      const weight = p.sku?.startsWith("UMMA-CAFE-BAKLAVA-") ? "1 шт." : p.sku?.startsWith("UMMA-CAFE-DESSERT-") ? "1 порция" : p.weight_value ? (p.weight_unit === "ml" ? Number(p.weight_value) + " мл" : "≈ " + Number(p.weight_value) + " г") : "";
      const selected = cart.get(p.id);
      const quantity = selected?.quantity || 0;
      const productId = esc(p.id);
      const photo = productPhoto(p);
      return '<article class="cafe-product' + (photo ? '' : ' cafe-product-no-photo') + (quantity ? ' cafe-product-selected' : '') + '" data-product-card="' + productId + '">' +
        photo + '<div class="cafe-product-placeholder" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 17h18M5 17a7 7 0 0 1 14 0M10 5h4M12 5v3M6 21h12"/></svg></div>' + halalBadge +
        '<h3 translate="no" dir="auto">' + esc(name(p)) + '</h3>' +
        '<div class="cafe-product-top"><span class="cafe-product-weight" dir="ltr">' + esc(weight) + '</span></div>' +
        (description(p).trim() ? '<details class="cafe-product-description"><summary>Описание</summary><p translate="no" dir="auto">' + esc(description(p)) + '</p></details>' : '') +
        '<div class="cafe-product-selection' + (quantity ? ' is-visible' : '') + '"' + (quantity ? '' : ' hidden') + '><span>В заказе</span><strong class="cafe-product-quantity">' + quantity + '</strong></div>' +
        '<div class="cafe-product-bottom"><span class="cafe-product-price">' + (p.catalog_preview ? 'Цена уточняется' : money(p.price_vnd)) + '</span>' +
        (p.catalog_preview ? '' : quantity
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

  const countLabel=(amount,one,few,many)=>amount+" "+(amount%100>=11&&amount%100<=14?many:amount%10===1?one:amount%10>=2&&amount%10<=4?few:many);

  const externalDelivery = () => orderType?.value === "delivery" && window.ummaDeliveryProviders?.external(byId("cafeCarrier")?.value);
  function deliveryBlocked() { return orderType?.value === "delivery" && (externalDelivery()?!window.ummaDeliveryLocation?.hasPoint?.():window.ummaDeliveryLocation?.availability?.() !== "available"); }
  function renderCart() {
    fillTelegramCustomerName();
    syncCheckoutSummaries();
    const root = byId("cafeCartItems"), countEl = byId("cafeCartCount"), totalEl = byId("cafeCartTotal"), submit = byId("cafeSubmitOrder");
    if (!root || !countEl || !totalEl) return;
    const entries = Array.from(cart.values());
    countEl.textContent = countLabel(count(),"позиция","позиции","позиций");
    totalEl.textContent = money(total());
    if (!entries.length) root.innerHTML = '<p class="cafe-empty-cart">Добавьте блюда из меню.</p>';
    else root.innerHTML = entries.map(item => '<div class="cafe-cart-row"><div><strong translate="no" dir="auto">' + esc(name(item.product)) + '</strong><small>' + money(item.price_vnd) + ' × ' + item.quantity + ' = ' + money(item.price_vnd * item.quantity) + '</small></div><div class="cafe-cart-controls"><button type="button" data-cart-change="-1" data-product-id="' + esc(item.product.id) + '" aria-label="Уменьшить">−</button><strong>' + item.quantity + '</strong><button type="button" data-cart-change="1" data-product-id="' + esc(item.product.id) + '" aria-label="Увеличить">+</button></div></div>').join("");
    if (submit) submit.disabled = loading || locating || !entries.length || !locationId || deliveryBlocked();
    if(byId("cafeOrderForm"))byId("cafeOrderForm").hidden=entries.length===0;
    const success = byId("cafeOrderResult")?.dataset.state === "success";
    if (byId("cafeEmptyOrder")) byId("cafeEmptyOrder").hidden = entries.length > 0 || success;
    if (byId("cafeCheckoutItems")) byId("cafeCheckoutItems").hidden = entries.length === 0;
    const hint = byId("cafeCheckoutHint");
    if (hint) {
      hint.textContent = !locationId ? "Приём заказов временно приостановлен." : deliveryBlocked() ? (byId("cafeDeliveryZoneStatus")?.textContent || "Укажите адрес на карте, чтобы проверить возможность доставки.") : "";
      hint.hidden = !hint.textContent || !entries.length;
    }
    byId("cafeOrderForm")?.setAttribute("aria-busy", String(loading));
    const sticky = byId("cafeStickyOrder");
    const stickyCount = byId("cafeStickyCount");
    const stickyTotal = byId("cafeStickyTotal");
    if (stickyCount) stickyCount.textContent = countLabel(count(),"блюдо","блюда","блюд");
    if (stickyTotal) stickyTotal.textContent = money(total());
    if (sticky) sticky.hidden = entries.length === 0;
    const go = byId("cafeStickyGoToOrder");
    if (go) { go.textContent = checkoutOpen ? (!locationId ? "Приём заказов приостановлен" : loading ? "Оформляем заказ…" : "Оформить заказ") : "Перейти к заказу"; go.disabled = loading || locating || !entries.length || (checkoutOpen && (!locationId || deliveryBlocked())); go.setAttribute("aria-busy", String(loading)); }
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
      const product = products.find(p => String(p.id) === String(id));
      const preview = product?.catalog_preview || product?.price_vnd == null;
      bottom.innerHTML = priceHtml + (preview ? '' : quantity
        ? '<div class="cafe-card-quantity"><button type="button" class="cafe-qty-btn" data-cart-change="-1" data-product-id="' + safeId + '" aria-label="Уменьшить ' + safeName + '">−</button><strong>' + quantity + '</strong><button type="button" class="cafe-qty-btn" data-add-product="' + safeId + '" aria-label="Добавить ещё ' + safeName + '">+</button></div>'
        : '<button type="button" class="cafe-add" data-add-product="' + safeId + '" aria-label="Добавить ' + safeName + '">+</button>');
    });
  }

  async function loadMenu() {
    if (loading) return;
    const revision = ++menuRevision;
    const loadingEl = byId("cafeLoading");
    if (loadingEl) loadingEl.hidden = false;
    setError("");
    try {
      const response = await fetch(MENU_URL);
      const result = await response.json();
      if (revision !== menuRevision || loading) return;
      if (!response.ok || !result.ok) throw new Error(result.error || "Не удалось загрузить меню");
      products = Array.isArray(result.products) ? result.products : [];
      inventoryRows = Array.isArray(result.inventory) ? result.inventory : [];
      inventoryControlEnabled = result.inventoryControlEnabled === true;
      locations = Array.isArray(result.locations) ? result.locations : (result.location ? [result.location] : []);
      const retained = locations.some(location => String(location.id) === String(locationId));
      if (!retained) {
        locationRevision++; locating = false;
        if (locationId) cart.clear();
        locationId = null;
      }
      renderLocationOptions();
      if (!retained && locations.length) requestNearestLocation();
      else if (!locations.length) updateLocationMessage("Приём заказов временно приостановлен.");
      renderProducts();
      const notice=byId("cafeAvailabilityNotice");if(notice)notice.hidden=locations.length>0;
      renderCart();
    } catch (error) {
      if (revision === menuRevision) setError(error instanceof Error ? error.message : "Ошибка загрузки меню");
    } finally { if (revision === menuRevision && loadingEl) loadingEl.hidden = true; }
  }

  function renderLocationOptions() {
    const select = byId("cafeLocationSelect");
    if (!select) return;
    select.innerHTML = locations.map(location => {
      const label = [location.name, location.address, location.city].filter(Boolean).join(" — ");
      return '<option value="' + esc(location.id) + '">' + esc(label) + '</option>';
    }).join("");
    select.insertAdjacentHTML("afterbegin", '<option value="" disabled>Выберите кафе</option>');
    select.value = locationId || "";
    for (const option of select.options) option.defaultSelected = option.value === (locationId || "");
    const nearby = byId("cafeNearbySelect");
    if (nearby) { nearby.innerHTML = select.innerHTML; nearby.value = locationId || ""; }
    if (byId("cafeNearby")) byId("cafeNearby").hidden = !locations.length;
    if (byId("cafeNearbySelectLabel")) byId("cafeNearbySelectLabel").hidden = !!locationId && locations.length === 1;
    select.required=locations.length>0;
    const multiple=locations.length>1;
    if(byId("cafeLocationDetails"))byId("cafeLocationDetails").hidden=!multiple;
    const modeLabel=byId("cafeLocationMode")?.closest("label");
    if(modeLabel)modeLabel.hidden=!multiple;
    const manual = byId("cafeLocationSelectLabel");
    if (manual) manual.hidden = !multiple || byId("cafeLocationMode")?.value !== "manual";
    updateLocationMessage();
  }

  function updateLocationMessage(text) {
    const selected = locations.find(location => String(location.id) === String(locationId));
    window.ummaDeliveryLocation?.setCafeLocation?.(selected);
    const message = text || (selected ? "Кафе: " + selected.name + (selected.address ? " · " + selected.address : "") : locations.length ? "Выберите кафе, чтобы увидеть его меню." : "Приём заказов временно приостановлен.");
    for (const id of ["cafeLocationMessage", "cafeNearbyStatus"]) if (byId(id)) byId(id).textContent = message;
    if (byId("cafeMenuLocation")) byId("cafeMenuLocation").textContent = selected ? [selected.name, selected.address, selected.city].filter(Boolean).join(" · ") : "";
    if (byId("cafeNearbyDetect")) { byId("cafeNearbyDetect").disabled = locating || loading || !locations.length; byId("cafeNearbyDetect").setAttribute("aria-busy", String(locating)); }
  }

  function haversineKm(lat1, lon1, lat2, lon2) {
    const rad = value => value * Math.PI / 180;
    const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
    const a = Math.sin(dLat/2)**2 + Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLon/2)**2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  const validCoordinates = (lat, lon) => lat !== null && lon !== null && lat !== "" && lon !== "" && lat !== undefined && lon !== undefined && Number.isFinite(Number(lat)) && Number.isFinite(Number(lon)) && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lon)) <= 180;
  function useManualLocation(message) {
    locating = false;
    if (byId("cafeNearbyDetails")) byId("cafeNearbyDetails").open = true;
    locationMode = "manual";
    if (byId("cafeLocationMode")) byId("cafeLocationMode").value = "manual";
    if (byId("cafeLocationSelectLabel")) byId("cafeLocationSelectLabel").hidden = false;
    if (byId("cafeLocationDetails")) byId("cafeLocationDetails").open = true;
    if (byId("cafeNearbySelectLabel")) byId("cafeNearbySelectLabel").hidden = false;
    updateLocationMessage(message);
    renderProducts(); renderCart();
    window.ummaCheckoutChoices?.sync();
  }
  function requestNearestLocation() {
    if (loading || locating || !locations.length) return;
    const revision = ++locationRevision;
    locationMode = "nearest";
    if (byId("cafeLocationMode")) byId("cafeLocationMode").value = "nearest";
    const configured = locations.every(location => validCoordinates(location.latitude, location.longitude));
    // A sole cafe remains usable without coordinates; never call it the nearest.
    if (locations.length === 1 && (!configured || !navigator.geolocation)) {
      setSelectedLocation(locations[0].id);
      return;
    }
    if (!configured) { useManualLocation("Не у всех кафе указаны координаты. Выберите кафе вручную."); return; }
    if (!navigator.geolocation) { useManualLocation("Геолокация недоступна на этом устройстве. Выберите кафе вручную."); return; }
    locating = true;
    updateLocationMessage("Разрешите геолокацию — мы выберем ближайшее кафе.");
    renderProducts(); renderCart();
    const fail = error => {
      if (revision !== locationRevision) return;
      useManualLocation(error?.code === 1 ? "Доступ к геолокации не разрешён. Выберите кафе вручную." : "Не удалось определить геолокацию. Выберите кафе вручную.");
    };
    try {
      navigator.geolocation.getCurrentPosition(position => {
        if (revision !== locationRevision) return;
        const lat = position?.coords?.latitude, lon = position?.coords?.longitude;
        if (!validCoordinates(lat, lon)) { fail(); return; }
        const nearest = locations.map(location => ({ location, distance: haversineKm(Number(lat), Number(lon), Number(location.latitude), Number(location.longitude)) })).sort((a,b) => a.distance - b.distance)[0];
        if (!nearest) { fail(); return; }
        locating = false;
        setSelectedLocation(nearest.location.id);
        updateLocationMessage("Ближайшее кафе: " + nearest.location.name + " · примерно " + nearest.distance.toFixed(1) + " км по прямой.");
      }, fail, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
    } catch { fail(); }
  }
  byId("cafeNearbyDetect")?.addEventListener("click", requestNearestLocation);
  byId("cafeLocationMode")?.addEventListener("change", event => {
    if (loading) return;
    if (event.target.value === "manual") { locationRevision++; useManualLocation(); }
    else requestNearestLocation();
  });
  function setSelectedLocation(nextId) {
    if (loading) return;
    const selected = locations.find(location => String(location.id) === String(nextId));
    const next = selected?.id || null;
    if (String(next || "") !== String(locationId || "")) cart.clear();
    locationId = next;
    if (byId("cafeNearbyDetails")) byId("cafeNearbyDetails").open = !next;
    for (const id of ["cafeLocationSelect", "cafeNearbySelect"]) if (byId(id)) {
      byId(id).value = locationId || "";
      for (const option of byId(id).options) option.defaultSelected = option.value === (locationId || "");
    }
    updateLocationMessage();
    renderProducts(); renderCart();
    window.ummaCheckoutChoices?.sync();
  }
  const manualSelection = event => {
    if (loading) return;
    locationRevision++; locating = false; locationMode = "manual";
    if (byId("cafeLocationMode")) byId("cafeLocationMode").value = "manual";
    setSelectedLocation(event.target.value);
  };
  byId("cafeLocationSelect")?.addEventListener("change", manualSelection);
  byId("cafeNearbySelect")?.addEventListener("change", manualSelection);

  let checkoutOpen = false, menuScroll = 0;
  function closeCheckout() {
    if (!checkoutOpen) return;
    checkoutOpen = false;
    const page = byId("cafePage");
    page?.classList.remove("is-checkout-open");
    renderCart();
    if (page) page.scrollTop = menuScroll;
    byId("cafeStickyGoToOrder")?.focus({preventScroll:true});
  }
  function showCheckoutError(message, field) {
    const result = byId("cafeOrderResult");
    if (result) { result.dataset.state = "error"; result.textContent = message; result.hidden = false; }
    if (field) {
      const details = field.closest("details");
      if (details) details.open = true;
      field.scrollIntoView?.({block:"center",behavior:"smooth"});
      field.focus({preventScroll:true});
    } else result?.scrollIntoView?.({block:"nearest",behavior:"smooth"});
  }
  // Native validation happens before submit; reveal collapsed invalid fields first.
  byId("cafeOrderForm")?.addEventListener("invalid", event => {
    event.preventDefault();
    const field = event.target;
    const message = field.id === "cafeTable" ? "Выберите номер стола, чтобы мы знали, куда принести заказ." : field.id === "cafeCustomerPhone"
      ? "Укажите телефон для связи с курьером."
      : field.validationMessage || "Проверьте данные заказа.";
    showCheckoutError(message, field);
  }, true);
  byId("cafeCheckoutBack")?.addEventListener("click", closeCheckout);
  byId("cafeEmptyOrderBack")?.addEventListener("click", closeCheckout);
  byId("cafeResultMenu")?.addEventListener("click", closeCheckout);
  byId("cafeResultOrders")?.addEventListener("click", () => { closeCheckout(); byId("cafeMyOrdersToggle")?.click(); });
  byId("cafeStickyGoToOrder")?.addEventListener("click", () => {
    if (loading || locating || !cart.size) return;
    if (checkoutOpen) {
      const form = byId("cafeOrderForm");
      if (typeof form?.requestSubmit === "function") form.requestSubmit(byId("cafeSubmitOrder"));
      else if (form?.reportValidity()) form.dispatchEvent(new Event("submit", {bubbles:true,cancelable:true}));
      return;
    }
    const page = byId("cafePage");
    menuScroll = page?.scrollTop || 0;
    checkoutOpen = true;
    page?.classList.add("is-checkout-open");
    if (page) page.scrollTop = 0;
    const inner = page?.querySelector(".cafe-page-inner");
    if (inner) inner.scrollTop = 0;
    if (byId("cafeCheckoutItems")) byId("cafeCheckoutItems").open = true;
    renderCart();
    byId("cafeCheckoutBack")?.focus({preventScroll:true});
  });

  function changeProduct(productId, delta) {
    if (loading || locating || (locations.length && !locationId)) return;
    const baseProduct = products.find(p => String(p.id) === String(productId));
    const stock = inventoryRows.find(i => String(i.product_id) === String(productId) && String(i.location_id) === String(locationId));
    if (!baseProduct || baseProduct.catalog_preview || baseProduct.price_vnd == null) return;
    if (inventoryControlEnabled && (!stock || stock.is_available === false)) return;
    const product = inventoryControlEnabled
      ? { ...baseProduct, price_vnd: stock.price_vnd == null ? baseProduct.price_vnd : stock.price_vnd,
          stockAvailable: Number(stock.quantity) - Number(stock.reserved_quantity || 0) }
      : { ...baseProduct, stockAvailable: 99 };
    const result = byId("cafeOrderResult");
    if (result) { result.hidden = true; delete result.dataset.state; }
    if (byId("cafeResultActions")) byId("cafeResultActions").hidden = true;
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

  function syncCheckoutSummaries(){
    const customerName=byId("cafeCustomerName")?.value.trim()||"";
    const phone=byId("cafeCustomerPhone")?.value.trim()||"";
    const contact=byId("cafeContactSummary");
    if(contact)contact.textContent=[customerName.startsWith("Telegram ID:")?"Профиль Telegram":customerName,phone].filter(Boolean).join(" · ")||"Ваш профиль Telegram";
    const note=byId("cafeCustomerNote")?.value.trim()||"";
    if(byId("cafeNoteSummary"))byId("cafeNoteSummary").textContent=note||"Необязательно";
  }
  ["cafeCustomerName","cafeCustomerPhone","cafeCustomerNote"].forEach(id=>byId(id)?.addEventListener("input",syncCheckoutSummaries));
  const orderType = byId("cafeOrderType"), addressLabel = byId("cafeAddressLabel"), addressInput = byId("cafeDeliveryAddress");
  function syncCustomerPayment(){
    const type=orderType?.value||"pickup", timing=byId("cafePaymentTiming"), method=byId("cafePaymentMethod");
    if(timing){const later=timing.querySelector('option[value="later"]');if(later)later.disabled=type!=="dine_in";if(type!=="dine_in")timing.value="now";}
    const country=byId("cafeTransferCountryLabel");if(country)country.hidden=method?.value!=="bank_transfer";
    if(method){const cash=method.querySelector('option[value="cash"]');if(cash){cash.disabled=!!externalDelivery();if(cash.disabled&&method.value==="cash")method.value="qr";}if(cash)cash.textContent=type==="delivery"?"Оплата курьеру при доставке":"Наличными в кафе";}
    const hint=byId("cafePaymentHint");if(hint)hint.textContent=externalDelivery()?"Товар оплачивается UMMA заранее. Доставку оформляете и оплачиваете отдельно в выбранном сервисе.":type==="delivery"?"QR-оплата заранее либо наличными курьеру при получении.":type==="pickup"?"Наличными при получении в кафе или переводом после оформления.":"Наличными в кафе или переводом после оформления.";
  }
  function syncOrderMode() {
    if (loading) return;
    const delivery = orderType?.value === "delivery";
    const dineIn = orderType?.value === "dine_in";
    if (byId("cafeTableLabel")) byId("cafeTableLabel").hidden = !dineIn;
    const table = byId("cafeTable");
    if (table) { table.disabled = !dineIn; table.required = dineIn; }
    if (byId("cafeModeHint")) byId("cafeModeHint").textContent = delivery ? "Выберите блюда — адрес и доставку уточним при оформлении." : dineIn ? "Выберите блюда — укажите свой стол при оформлении." : "Выберите блюда — заберите заказ в кафе.";
    byId("cafePage")?.querySelectorAll("[data-order-mode]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.orderMode === orderType?.value));
    });
    if (addressLabel) addressLabel.hidden = !delivery;
    if(byId("cafeCarrierLabel"))byId("cafeCarrierLabel").hidden=!delivery;
    if(byId("cafeCarrierHint"))byId("cafeCarrierHint").textContent=externalDelivery()?"Курьера оформляете в выбранном сервисе после подтверждения оплаты товара. Доставка оплачивается отдельно.":"Курьер UMMA доставит заказ в пределах зоны обслуживания.";
    window.ummaDeliveryLocation?.setCarrierMode?.(!!externalDelivery());
    if (addressInput) addressInput.required = false;
    const phone = byId("cafeCustomerPhone"), needsPhone = !!externalDelivery();
    if (phone) phone.required = needsPhone;
    if (byId("cafeCustomerPhoneTitle")) byId("cafeCustomerPhoneTitle").textContent = needsPhone ? "Телефон для курьера (обязательно)" : "Телефон (необязательно)";
    if (needsPhone && !phone?.value.trim() && byId("cafeContactDetails")) byId("cafeContactDetails").open = true;
    if(byId("cafeAddressTitle"))byId("cafeAddressTitle").textContent="Квартира, этаж, ориентир (необязательно)";
    if (byId("cafeDeliveryLocation")) byId("cafeDeliveryLocation").hidden = !delivery;
    syncCustomerPayment();
    renderCart();
  }
  orderType?.addEventListener("change", syncOrderMode);
  byId("cafeCarrier")?.addEventListener("change",syncOrderMode);
  document.addEventListener("umma:delivery-location-change", syncOrderMode);
  byId("cafePage")?.addEventListener("click", event => {
    const button = event.target.closest("[data-order-mode]");
    if (loading || !button || !orderType || !["dine_in", "pickup", "delivery"].includes(button.dataset.orderMode)) return;
    orderType.value = button.dataset.orderMode;
    orderType.dispatchEvent(new Event("change", { bubbles: true }));
  });
  byId("cafeOrderForm")?.addEventListener("reset", () => queueMicrotask(() => { window.ummaDeliveryLocation?.reset(); syncOrderMode(); fillTelegramCustomerName(); syncCheckoutSummaries(); ["cafeContactDetails","cafeNoteDetails"].forEach(id=>{if(byId(id))byId(id).open=false;}); }));
  byId("cafePaymentTiming")?.addEventListener("change",syncCustomerPayment);
  byId("cafePaymentMethod")?.addEventListener("change",syncCustomerPayment);
  syncOrderMode();

  byId("cafeOrderForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    if (loading) return;
    if(locating)return;
    if(!locationId){if(typeof showToast==="function")showToast("Приём заказов временно приостановлен");return;}
    const resultEl = byId("cafeOrderResult"), submit = byId("cafeSubmitOrder");
    if (!cart.size) { if (typeof showToast === "function") showToast("Сначала добавьте блюда в заказ"); return; }
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData) { showCheckoutError("Откройте приложение через Telegram, чтобы оформить заказ."); return; }
    if (deliveryBlocked()) { byId("cafeDeliveryMapOpen")?.focus(); if (typeof showToast === "function") showToast(byId("cafeDeliveryZoneStatus")?.textContent || "Выберите точку доставки на карте, чтобы проверить зону обслуживания."); return; }

    const carrier=externalDelivery()?byId("cafeCarrier").value:"umma";
    if(carrier!=="umma"&&!byId("cafeCustomerPhone")?.value.trim()){showCheckoutError("Укажите телефон для связи с курьером.",byId("cafeCustomerPhone"));return;}
    if(carrier!=="umma"&&(!window.ummaDeliveryLocation?.hasPoint?.()||byId("cafePaymentMethod")?.value==="cash")){showCheckoutError("Отметьте точку на карте и выберите предоплату товара.");return;}
    const table = byId("cafeTable");
    if (orderType?.value === "dine_in" && !/^[1-6]$/.test(table?.value || "")) { showCheckoutError("Выберите номер стола, чтобы мы знали, куда принести заказ.", table); return; }
    fillTelegramCustomerName();
    const paymentTiming=orderType?.value==="delivery"&&byId("cafePaymentMethod")?.value==="cash"?"on_delivery":(byId("cafePaymentTiming")?.value||"now");
    if(orderType?.value!=="dine_in"&&paymentTiming==="later"){if(typeof showToast==="function")showToast("Оплата позже возможна только в кафе");return;}
    const submittedItems = Array.from(cart.values()).map(item => ({ productId: item.product.id, quantity: item.quantity }));
    loading = true; renderCart();
    // Lock only this draft; preserve each control's disabled state for restoration.
    const lockedControls = Array.from(byId("cafePage").querySelectorAll("input,select,textarea,button[data-order-mode],.cafe-choice-trigger,[data-cart-change],#cafeCheckoutBack")).map(control => [control, control.disabled]);
    lockedControls.forEach(([control]) => { control.disabled = true; });
    if (resultEl) resultEl.hidden = true;
    if (submit) submit.textContent = "Оформляем заказ…";
    try {
      const response = await window.ummaCafeRequests.request(ORDER_URL, {
          initData,
          items: Array.from(cart.values()).map(item => ({ productId: item.product.id, quantity: item.quantity })),
          orderType: carrier!=="umma"?"pickup":orderType?.value || "pickup",
          paymentTiming,
          paymentMethod: byId("cafePaymentMethod")?.value || "cash",
          locationId,
          customerName: byId("cafeCustomerName")?.value.trim() || "",
          customerPhone: byId("cafeCustomerPhone")?.value.trim() || "",
          deliveryAddress: orderType?.value === "delivery" && window.ummaDeliveryLocation ? window.ummaDeliveryLocation.getAddress(addressInput?.value) : addressInput?.value.trim() || "",
          customerNote: [orderType?.value === "dine_in" ? "Стол №" + table.value : "", window.ummaDeliveryProviders?.note(carrier,byId("cafeCustomerNote")?.value.trim()||"") || byId("cafeCustomerNote")?.value.trim() || ""].filter(Boolean).join("\n").slice(0,1000)
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
        resultEl.dataset.state = "success";
        const selectedCafe = locations.find(location => String(location.id) === String(locationId));
        const notificationLine = Number(result.staffNotified) > 0
          ? "<br>Уведомления сотрудникам кафе: " + Number(result.staffNotified)
          : "<br>Внимание: уведомление сотрудникам не подтверждено. Свяжитесь с кафе, если заказ срочный.";
        resultEl.innerHTML = "Заказ №" + esc(order.orderNumber) + " принят.<br>Кафе: " + esc(selectedCafe?.name || "Umma Cafe") + "<br>Статус: ожидает подтверждения кафе.<br>Сумма: " + money(order.totalVnd) + notificationLine;
        if(byId("cafePaymentMethod")?.value==="qr") {
          resultEl.innerHTML += '<p>QR с суммой заказа готов. Оплату подтвердит кафе после поступления денег.</p>' + window.ummaCafePayment.button(order.id);
        }
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
        if(carrier!=="umma")resultEl.innerHTML+='<p>Доставка через '+esc(window.ummaDeliveryProviders.providers[carrier].name)+'. После подтверждения оплаты откройте «Мои заказы», чтобы оформить курьера. Стоимость доставки оплачивается отдельно.</p>';
        resultEl.hidden = false;
        if(byId("cafePaymentMethod")?.value==="qr") window.ummaCafePayment?.show(order.id);
      }
      if (byId("cafeResultActions")) byId("cafeResultActions").hidden = false;
      byId("cafeOrderForm")?.reset();
      if (addressLabel) addressLabel.hidden = true;
      if (addressInput) addressInput.required = false;
    } catch (error) {
      if (resultEl) { resultEl.dataset.state = "error"; resultEl.textContent = error instanceof Error ? error.message : "Ошибка оформления заказа"; resultEl.hidden = false; }
    } finally {
      lockedControls.forEach(([control, disabled]) => { control.disabled = disabled; });
      loading = false; syncOrderMode(); window.ummaCheckoutChoices?.sync();
      if (checkoutOpen && resultEl && !resultEl.hidden) resultEl.scrollIntoView?.({block:"nearest",behavior:"smooth"});
      if (submit) submit.textContent = "Оформить заказ";
    }
  });

  document.addEventListener("umma:cafe-operation-recovered",event=>{
    if(event.detail.payload.staffOrder||event.detail.payload.action)return;
    cart.clear();renderCart();renderProducts();
    const result=byId("cafeOrderResult"),order=event.detail.result.order;
    if(result){result.dataset.state="success";result.hidden=false;result.textContent="Восстановлен заказ №"+order.orderNumber+". Проверьте его во вкладке «Мои заказы».";}
    if(byId("cafeResultActions"))byId("cafeResultActions").hidden=false;
    renderCart();
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
        const itemsHtml = items.map(item => "<li><span>" + esc(window.ummaI18n?.field(item, "product_name") || item.product_name_ru || item.product_name_en || "Блюдо") + " × " + Number(item.quantity) + "</span><strong>" + money(item.line_total_vnd) + "</strong></li>").join("");
        const historyHtml = events.map(item => "<li><span>" + esc(statusNames[item.to_status] || item.to_status) + "</span><small>" + esc(item.created_at ? new Date(item.created_at).toLocaleString(window.ummaI18n?.locale() || "ru-RU", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" }) : "") + "</small></li>").join("");
        const paymentLabel = order.payment_status==='paid'?'✓ Оплачено':order.payment_status==='refunded'?'Оплата возвращена':'Ожидается оплата';
        const externalCarrier=window.ummaDeliveryProviders?.provider(order);
        const orderTypeName = externalCarrier?"Доставка через "+window.ummaDeliveryProviders.providers[externalCarrier].name:{ pickup:"С собой", dine_in:"В кафе", delivery:"Доставка" }[order.order_type] || order.order_type;
        return '<article class="cafe-my-order-card"><div class="cafe-my-order-head"><div><strong>Заказ №' + esc(order.order_number) + '</strong><small>' + esc(order.created_at ? new Date(order.created_at).toLocaleString(window.ummaI18n?.locale() || "ru-RU", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" }) : "") + '</small></div><span class="cafe-my-order-status status-' + esc(order.status) + '">' + esc(statusNames[order.status] || order.status) + '</span></div><p class="cafe-my-order-type">' + esc(orderTypeName) + '</p><p class="cafe-payment-status" data-payment-status="'+esc(order.payment_status)+'">'+paymentLabel+'</p>'+(order.order_type==='delivery'?'<p class="cafe-my-order-delivery">'+esc(statusNames[order.delivery_status]||'Ожидает курьера')+'</p>':'')+'<ul class="cafe-my-order-items">' + itemsHtml + '</ul><div class="cafe-my-order-total"><span>Итого</span><strong>' + money(order.total_vnd) + '</strong></div>' + (order.order_type==='delivery'&&!['completed','cancelled'].includes(order.status)&&order.delivery_status!=='delivered'?'<button type="button" class="kitchen-action" data-tracking-address="'+esc(order.delivery_address||'')+'" data-track-delivery="'+esc(order.id)+'">Где мой курьер</button>':'') + (order.order_type==='delivery'?'<button type="button" class="kitchen-action" data-delivery-chat="'+esc(order.id)+'">Чат с курьером</button>':'') + (window.ummaDeliveryProviders?.card(order,locations.find(l=>String(l.id)===String(order.location_id)))||'') + (order.qr_payment_available ? window.ummaCafePayment?.button(order.id) || '' : '') + (historyHtml ? '<details class="cafe-my-order-history"><summary>История статусов</summary><ul>' + historyHtml + '</ul></details>' : "") + '</article>';
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
    isCheckoutOpen: () => checkoutOpen && !byId("cafePage")?.hidden,
    closeCheckout,
    refreshMenu: loadMenu,
    refreshMyOrders: loadMyOrders,
    openOrders:()=>{const section=byId("cafeMyOrdersSection"),refresh=byId("cafeMyOrdersRefresh");if(section)section.hidden=false;if(refresh)refresh.hidden=false;loadMyOrders();section?.scrollIntoView?.({block:"start",behavior:"smooth"});},
    open: () => { if (typeof openPage === "function") openPage("cafe"); else loadMenu(); }
  };
  window.addEventListener("umma:languagechange", () => {
    const expanded = [...document.querySelectorAll("[data-product-card] details[open]")].map(el => el.closest("[data-product-card]").dataset.productCard);
    renderProducts(); renderCart();
    for (const card of document.querySelectorAll("[data-product-card]")) if (expanded.includes(card.dataset.productCard)) { const details=card.querySelector("details"); if(details)details.open=true; }
    myOrdersFingerprint="";
    if(byId("cafeOrdersPage")?.hidden===false)loadMyOrders();
  });
  renderCart();
})();
