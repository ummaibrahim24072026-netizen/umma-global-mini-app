/* UMMA B2B: business enquiries. Supply and delivery terms are confirmed by a manager. */
(() => {
  'use strict';
  const api = window.ummaMarketApi;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const t = (ru, en, vi) => { const l = window.ummaI18n?.locale?.() || 'ru'; return l.startsWith('vi') ? vi : l.startsWith('en') ? en : ru; };
  const field = (obj, key) => window.ummaI18n?.field?.(obj, key) || obj[key + '_ru'] || obj[key + '_en'] || '';
  const page = document.createElement('section');
  page.id = 'b2bPage'; page.className = 'market-shop b2b-page native-screen'; page.hidden = true;
  document.querySelector('.app')?.append(page);
  let catalog = null, warehouse = '', category = 'all', query = '', mode = 'catalog', busy = false, manager = false;
  let requests = [], hasMore = false, cursor = null, generation = 0;
  const selected = new Map();
  let draft = {};
  const statusName = status => ({submitted:t('Отправлена','Submitted','Đã gửi'),in_review:t('На рассмотрении','Under review','Đang xem xét'),quoted:t('Предложение менеджера','Manager proposal','Đề xuất từ quản lý'),closed:t('Закрыта','Closed','Đã đóng'),cancelled:t('Отменена','Cancelled','Đã hủy')})[status] || status;
  const units = () => [['kg',t('кг','kg','kg')],['pcs',t('шт.','pcs','cái')],['pack',t('упаковок','packs','gói')],['box',t('коробок','boxes','thùng')],['l',t('л','l','l')]];
  const unitName = unit => units().find(u => u[0] === unit)?.[1] || unit;
  const button = (action, label, attrs = '') => `<button type="button" data-b2b="${action}" ${attrs}>${esc(label)}</button>`;
  const options = (rows, value) => rows.map(([id,label]) => `<option value="${esc(id)}" ${id===value?'selected':''}>${esc(label)}</option>`).join('');
  const input = (label, key, attrs = '') => `<label>${esc(label)}<input name="${key}" value="${esc(draft[key])}" ${attrs}></label>`;
  const select = (label, key, rows) => `<label>${esc(label)}<select name="${key}">${options(rows,draft[key] || rows[0][0])}</select></label>`;
  function message(text, bad = false) {
    const el = page.querySelector('[data-b2b-status]');
    if (el) { el.textContent = text; el.className = bad ? 'market-error' : 'market-status'; }
  }
  function errorText(err) {
    const messages = {
      B2B_ACCESS_DENIED: t('Нет доступа к этой заявке.','Access denied.','Không có quyền truy cập.'),
      B2B_STALE_REQUEST: t('Заявка уже изменена. Обновите список перед сохранением.','This request changed. Refresh before saving.','Yêu cầu đã thay đổi. Hãy làm mới trước khi lưu.'),
      B2B_REQUEST_CLOSED: t('Заявка уже закрыта.','This request is closed.','Yêu cầu đã đóng.'),
      B2B_RATE_LIMIT: t('Лимит заявок на сегодня достигнут.','Daily request limit reached.','Đã đạt giới hạn yêu cầu trong ngày.'),
      B2B_PRODUCT_UNAVAILABLE: t('Товар изменился. Обновите каталог.','Product changed. Refresh the catalogue.','Sản phẩm đã thay đổi. Hãy làm mới danh mục.'),
      B2B_STORE_UNAVAILABLE: t('Эта точка временно недоступна.','This location is unavailable.','Địa điểm này tạm thời không hoạt động.'),
    };
    return messages[err.message] || t('Не удалось выполнить действие. Данные сохранены на этом экране; попробуйте ещё раз.','Could not complete the action. Your inputs remain on this screen; try again.','Chưa thể hoàn tất. Dữ liệu vẫn còn trên màn hình; hãy thử lại.');
  }
  function saveDraft() {
    const form = page.querySelector('[data-b2b-form]');
    if (form) draft = {...draft, ...Object.fromEntries(new FormData(form))};
    page.querySelectorAll('[data-line-quantity]').forEach(input => {
      const line = selected.get(input.dataset.lineQuantity); if (line) line.quantity = input.value;
    });
    page.querySelectorAll('[data-line-unit]').forEach(input => {
      const line = selected.get(input.dataset.lineUnit); if (line) line.unit = input.value;
    });
  }
  function render() {
    page.innerHTML = `<header class="market-shop-header"><button type="button" id="b2bBack" aria-label="${esc(t('Назад','Back','Quay lại'))}">←</button><div><small>UMMA GLOBAL · BUSINESS</small><h1>UMMA B2B</h1><p>${esc(t('Продукты и товары для бизнеса','Food and supplies for businesses','Thực phẩm và hàng hóa cho doanh nghiệp'))}</p></div></header>
      <div data-b2b-status role="status" aria-live="polite"></div>
      <nav class="b2b-tabs" aria-label="UMMA B2B">${button('catalog',t('Каталог','Catalogue','Danh mục'),`aria-pressed="${mode==='catalog'}"`)}${button('mine',t('Мои заявки','My requests','Yêu cầu của tôi'),`aria-pressed="${mode==='mine'}"`)}${manager?button('manage',t('Заявки бизнеса','Business requests','Yêu cầu doanh nghiệp'),`aria-pressed="${mode==='manage'}"`):''}${button('wholesale',t('Оптовые заказы и склад','Wholesale orders & warehouse','Đơn hàng và kho'))}${button('refresh',t('Обновить','Refresh','Làm mới'))}</nav><div data-b2b-body></div>`;
    const body = page.querySelector('[data-b2b-body]');
    if (mode === 'form') { renderForm(body); return; }
    if (mode === 'mine' || mode === 'manage') { renderRequests(body); return; }
    body.innerHTML = `<div class="b2b-intro"><strong>${esc(t('Оптовые поставки для вашей организации','Wholesale supplies for your business','Cung ứng bán buôn cho doanh nghiệp'))}</strong><p>${esc(t('Для кафе, ресторанов, отелей и магазинов. Выберите товары или опишите другие потребности. Цены, минимальные партии, наличие и сроки согласуем по заявке.','For cafés, restaurants, hotels and stores. Select products or describe other needs. Prices, minimum quantities, availability and timing are agreed after your enquiry.','Dành cho quán cà phê, nhà hàng, khách sạn và cửa hàng. Chọn sản phẩm hoặc mô tả nhu cầu khác. Giá, số lượng tối thiểu, tồn kho và thời gian sẽ được thỏa thuận.'))}</p></div>
      <label class="market-search">${esc(t('Точка поставки','Supply location','Điểm cung ứng'))}<select data-b2b-store>${options((catalog?.warehouses||[]).map(w=>[w.id,w.name+' · '+w.city]),warehouse)}</select></label>
      <label class="market-search">${esc(t('Поиск товаров','Search products','Tìm sản phẩm'))}<input type="search" data-b2b-search value="${esc(query)}"></label>
      <nav class="market-shop-categories">${button('category',t('Все','All','Tất cả'),`data-category="all" aria-pressed="${category==='all'}"`)}${(catalog?.categories||[]).map(c=>button('category',field(c,'name'),`data-category="${c.id}" aria-pressed="${category===c.id}"`)).join('')}</nav><div class="market-shop-grid" data-b2b-grid></div>
      <div class="b2b-request-bar">${button('compose',t('Составить заявку','Create an enquiry','Tạo yêu cầu')+(selected.size?' · '+selected.size:''),catalog?.warehouses?.length?'':'disabled')}</div>`;
    renderGrid();
  }
  function renderGrid() {
    const grid = page.querySelector('[data-b2b-grid]'); if (!grid) return;
    const rows = (catalog?.products||[]).filter(p=>p.warehouse_id===warehouse && (category==='all'||p.category_id===category) && [p.name_ru,p.name_en,p.name_vi].join(' ').toLowerCase().includes(query.toLowerCase()));
    grid.innerHTML = rows.map(p=>{
      let photo = ''; try { const url = new URL(p.image_url); if(url.protocol==='https:') photo=`<img src="${esc(url.href)}" alt="${esc(field(p,'name'))}" loading="lazy">`; } catch {}
      return `<article class="market-product" data-b2b-product="${p.id}">${photo||'<div class="market-product-placeholder">UMMA</div>'}<div class="market-product-content"><h2>${esc(field(p,'name'))}</h2><p class="market-unavailable">${esc(t('Оптовые условия по запросу','Wholesale terms on request','Điều kiện bán buôn theo yêu cầu'))}</p>${button('toggle',selected.has(p.id)?t('В заявке ✓','Selected ✓','Đã chọn ✓'):t('В заявку','Select','Chọn'),`data-product="${p.id}" aria-pressed="${selected.has(p.id)}"`)}</div></article>`;
    }).join('') || `<p class="market-empty">${esc(t('Товары не найдены. Опишите нужные позиции в заявке.','No products found. Describe your needs in the enquiry.','Không tìm thấy sản phẩm. Hãy mô tả nhu cầu trong yêu cầu.'))}</p>`;
  }
  function renderForm(body) {
    body.innerHTML = `<h2>${esc(t('Заявка на поставку','Supply enquiry','Yêu cầu cung ứng'))}</h2><p>${esc(t('Это запрос условий. Поставка, доставка и стоимость подтверждаются менеджером.','This is an enquiry. Supply, delivery and prices require manager confirmation.','Đây là yêu cầu báo giá. Cung ứng, giao hàng và giá cần quản lý xác nhận.'))}</p><form data-b2b-form class="b2b-form">
      <ul class="b2b-lines">${[...selected].map(([id,line])=>`<li><strong>${esc(field(line.product,'name'))}</strong><div><label>${esc(t('Количество','Quantity','Số lượng'))}<input type="number" required min="0.001" max="1000000" step="0.001" value="${esc(line.quantity)}" data-line-quantity="${id}"></label><label>${esc(t('Единица','Unit','Đơn vị'))}<select data-line-unit="${id}">${options(units(),line.unit)}</select></label>${button('remove',t('Убрать','Remove','Bỏ'),`data-product="${id}"`)}</div></li>`).join('')}</ul>
      ${input(t('Название организации','Business name','Tên doanh nghiệp'),'company_name','required minlength="2" maxlength="160" autocomplete="organization"')}
      ${select(t('Тип бизнеса','Business type','Loại hình kinh doanh'),'business_type',[['cafe',t('Кафе','Café','Quán cà phê')],['restaurant',t('Ресторан','Restaurant','Nhà hàng')],['hotel',t('Отель','Hotel','Khách sạn')],['shop',t('Магазин','Store','Cửa hàng')],['business',t('Другая организация','Other business','Doanh nghiệp khác')]])}
      ${input(t('Контактное лицо','Contact person','Người liên hệ'),'contact_name','required maxlength="120" autocomplete="name"')}
      ${input(t('Телефон / Zalo','Phone / Zalo','Điện thoại / Zalo'),'contact_phone','type="tel" required minlength="5" maxlength="80" autocomplete="tel"')}
      ${input(t('Город','City','Thành phố'),'city','required minlength="2" maxlength="120" autocomplete="address-level2"')}
      ${select(t('Получение','Fulfilment','Nhận hàng'),'fulfillment',[['pickup',t('Самовывоз','Pickup','Tự lấy')],['delivery',t('Доставка по согласованию','Delivery by agreement','Giao hàng theo thỏa thuận')]])}
      ${input(t('Адрес доставки','Delivery address','Địa chỉ giao hàng'),'address',`maxlength="500" ${draft.fulfillment==='delivery'?'required minlength="5"':''}`)}
      ${select(t('Периодичность','Frequency','Tần suất'),'frequency',[['once',t('Разовая поставка','One-off','Một lần')],['weekly',t('Еженедельно','Weekly','Hàng tuần')],['regular',t('Регулярно по графику','Regular schedule','Theo lịch định kỳ')]])}
      <label>${esc(t('Другие товары и объёмы','Other products and quantities','Sản phẩm và số lượng khác'))}<textarea name="other_needs" maxlength="2000" ${selected.size?'':'required minlength="3"'}>${esc(draft.other_needs)}</textarea></label>
      <label>${esc(t('Комментарий и пожелания по срокам','Comments and preferred timing','Ghi chú và thời gian mong muốn'))}<textarea name="comment" maxlength="2000">${esc(draft.comment)}</textarea></label>
      <p class="market-shop-footnote">${esc(t('Контакты и состав заявки будут доступны менеджеру выбранной точки.','Your contact details and enquiry will be available to the selected location’s manager.','Thông tin liên hệ và yêu cầu sẽ được gửi đến quản lý điểm đã chọn.'))}</p><button type="submit">${esc(t('Отправить заявку','Send enquiry','Gửi yêu cầu'))}</button>${button('catalog',t('Вернуться к товарам','Back to products','Quay lại sản phẩm'))}</form>`;
  }
  function renderRequests(body) {
    body.innerHTML = requests.map(r=>`<article class="market-order" data-b2b-request="${r.id}"><header><strong>№${esc(r.request_number)} · ${esc(r.company_name)}</strong><span>${esc(statusName(r.status))}</span></header><p>${esc(r.city)} · ${esc(r.fulfillment==='delivery'?t('Доставка по согласованию','Delivery by agreement','Giao hàng theo thỏa thuận'):t('Самовывоз','Pickup','Tự lấy'))}</p>
      <p>${esc(r.contact_name)} · <bdi>${esc(r.contact_phone)}</bdi></p>${r.address?`<p>${esc(r.address)}</p>`:''}<p>${esc(({once:t('Разовая поставка','One-off','Một lần'),weekly:t('Еженедельно','Weekly','Hàng tuần'),regular:t('Регулярно по графику','Regular schedule','Theo lịch định kỳ')})[r.frequency])}</p>
      <ul>${r.items.map(i=>`<li>${esc(field(i,'name'))} — ${esc(i.quantity)} ${esc(unitName(i.unit))}</li>`).join('')}</ul>${r.other_needs?`<p class="b2b-text">${esc(r.other_needs)}</p>`:''}${r.comment?`<p class="b2b-text">${esc(r.comment)}</p>`:''}
      ${r.manager_reply?`<div class="b2b-reply"><strong>${esc(t('Ответ менеджера','Manager reply','Phản hồi từ quản lý'))}</strong><p class="b2b-text">${esc(r.manager_reply)}</p></div>`:''}
      ${['closed','cancelled'].includes(r.status)?'':mode==='manage'?`<form data-b2b-response="${r.id}"><label>${esc(t('Статус','Status','Trạng thái'))}<select name="status">${options([...(r.status==='quoted'?[]:[['in_review',statusName('in_review')]]),['quoted',statusName('quoted')],['closed',statusName('closed')]],r.status==='submitted'?'in_review':r.status)}</select></label><label>${esc(t('Ответ покупателю: условия, цены и сроки','Reply to buyer: terms, prices and timing','Trả lời khách: điều kiện, giá và thời gian'))}<textarea name="manager_reply" maxlength="4000">${esc(r.manager_reply)}</textarea></label><button type="submit">${esc(t('Сохранить ответ','Save reply','Lưu phản hồi'))}</button></form>`:button('cancel',t('Отменить заявку','Cancel enquiry','Hủy yêu cầu'),`data-id="${r.id}"`)}
    </article>`).join('') || `<p class="market-empty">${esc(t('Заявок пока нет.','No enquiries yet.','Chưa có yêu cầu.'))}</p>`;
    if (hasMore) body.insertAdjacentHTML('beforeend',button('more',t('Показать ещё','Load more','Xem thêm')));
  }
  async function loadRequests(append = false) {
    if (!window.Telegram?.WebApp?.initData) throw Error('telegram');
    const data = await api.call('b2b_requests',{staff:mode==='manage',...(append?cursor:{})});
    manager = data.manager_warehouses.length > 0;
    requests = append ? [...requests,...data.requests] : data.requests;
    hasMore = data.requests.length === 50;
    const last = requests.at(-1); cursor = last ? {before_time:last.created_at,before_id:last.id} : null;
  }
  async function refresh() {
    if (mode==='mine'||mode==='manage') await loadRequests();
    else {
      catalog = await api.call('b2b_catalog');
      if (!catalog.warehouses.some(w=>w.id===warehouse)) { warehouse=catalog.warehouses[0]?.id||''; selected.clear(); }
    }
    render();
  }
  async function work(fn) {
    if (busy) return;
    busy = true; page.setAttribute('aria-busy','true');
    const locked=[...page.querySelectorAll('form input,form select,form textarea,button[type=submit]')].map(el=>[el,el.disabled]);
    locked.forEach(([el])=>el.disabled=true);
    try { await fn(); } catch(err) {
      message(err.message==='telegram'?t('Откройте приложение через Telegram, чтобы отправлять и видеть заявки.','Open the app in Telegram to send and view enquiries.','Mở ứng dụng qua Telegram để gửi và xem yêu cầu.'):errorText(err),true);
    } finally { locked.forEach(([el,was])=>el.disabled=was);busy=false;page.removeAttribute('aria-busy');page.querySelectorAll('button[type=submit]').forEach(b=>b.disabled=false); }
  }
  async function open(target='catalog') {
    if (busy) return;
    saveDraft();mode=target;if(target==='manage')requests=[];page.hidden=false;
    document.querySelectorAll('.native-screen').forEach(el=>{if(el!==page)el.hidden=true;});
    document.querySelector('.app>main').style.display='none';
    render();
    const current=++generation;
    await work(async()=>{
      await refresh();
      if (window.Telegram?.WebApp?.initData && mode==='catalog') {
        const data=await api.call('b2b_requests',{});manager=data.manager_warehouses.length>0;
        if(current===generation&&!page.hidden)render();
      }
    });
  }
  function backToCatalog() {
    if(page.hidden||mode==='catalog')return false;
    saveDraft();mode='catalog';render();return true;
  }
  page.addEventListener('input',event=>{
    if (event.target.matches('[data-b2b-search]')) { query=event.target.value;renderGrid(); }
    else saveDraft();
  });
  page.addEventListener('change',event=>{
    if(event.target.matches('[data-b2b-store]')) { warehouse=event.target.value;selected.clear();category='all';render(); }
    else if(event.target.name==='fulfillment') { saveDraft();const input=page.querySelector('[name=address]');input.required=event.target.value==='delivery';input.minLength=5; }
    else saveDraft();
  });
  page.addEventListener('click',event=>{
    if(event.target.closest('#b2bBack')) { if(backToCatalog())return;if(!window.ummaNavigation?.back())window.openPage?.('home');return; }
    const b=event.target.closest('[data-b2b]');if(!b||b.disabled||busy)return;
    const action=b.dataset.b2b;saveDraft();
    if(action==='wholesale'){window.ummaB2BManager?.open();return;}\n    if(action==='toggle'){
      const p=catalog.products.find(p=>p.id===b.dataset.product&&p.warehouse_id===warehouse);if(!p)return;
      if(selected.has(p.id))selected.delete(p.id);else if(selected.size<50)selected.set(p.id,{product:p,quantity:'1',unit:p.weight_value?'pack':'kg'});
      render();return;
    }
    if(action==='remove'){selected.delete(b.dataset.product);render();return;}
    if(action==='category'){category=b.dataset.category;render();return;}
    if(action==='compose'){
      if(!window.Telegram?.WebApp?.initData){message(t('Откройте приложение через Telegram.','Open the app in Telegram.','Mở ứng dụng qua Telegram.'),true);return;}
      draft.contact_name ||= [window.Telegram.WebApp.initDataUnsafe?.user?.first_name,window.Telegram.WebApp.initDataUnsafe?.user?.last_name].filter(Boolean).join(' ');
      mode='form';render();page.querySelector('[name=company_name]')?.focus();return;
    }
    work(async()=>{
      if(action==='catalog'){mode='catalog';render();}
      else if(action==='mine'||action==='manage'){mode=action;requests=[];await loadRequests();render();}
      else if(action==='refresh')await refresh();
      else if(action==='more'){await loadRequests(true);render();}
      else if(action==='cancel'){
        const r=requests.find(r=>r.id===b.dataset.id);if(!r)return;
        const result=await api.execute('b2b_cancel',{id:r.id,version:r.version});requests=requests.map(x=>x.id===r.id?result.request:x);render();
      }
    });
  });
  page.addEventListener('submit',event=>{
    event.preventDefault();if(busy)return;
    const form=event.target;if(!form.checkValidity()){form.reportValidity();return;}
    if(form.matches('[data-b2b-form]')){
      saveDraft();
      const items=[...selected].map(([product_id,l])=>({product_id,quantity:Number(l.quantity),unit:l.unit}));
      if(!items.length&&String(draft.other_needs||'').trim().length<3)return;
      work(async()=>{
        const result=await api.execute('b2b_create',{...draft,warehouse_id:warehouse,items});
        selected.clear();draft={};mode='mine';requests=[result.request];hasMore=false;render();
        message(t('Заявка отправлена. Ответ менеджера появится здесь.','Enquiry sent. The manager’s reply will appear here.','Đã gửi yêu cầu. Phản hồi của quản lý sẽ hiển thị tại đây.'));
      });
    } else if(form.matches('[data-b2b-response]')) {
      const r=requests.find(r=>r.id===form.dataset.b2bResponse);if(!r)return;
      const values=Object.fromEntries(new FormData(form));
      if(['quoted','closed'].includes(values.status)&&String(values.manager_reply).trim().length<3){form.querySelector('textarea').focus();message(t('Добавьте ответ покупателю.','Add a reply to the buyer.','Vui lòng thêm phản hồi cho khách.'),true);return;}
      work(async()=>{
        const result=await api.execute('b2b_respond',{id:r.id,version:r.version,...values});requests=requests.map(x=>x.id===r.id?result.request:x);render();
        message(t('Ответ сохранён и доступен покупателю.','Reply saved and visible to the buyer.','Đã lưu phản hồi, khách hàng có thể xem.'));
      });
    }
  });
  document.querySelectorAll('[data-b2b-manage]').forEach(b=>b.addEventListener('click',()=>open('manage')));
  window.addEventListener('umma:languagechange',()=>{if(!page.hidden){saveDraft();render();}});
  function refreshOwnRequests() {
    if(page.hidden||mode!=='mine'||document.hidden||busy||!window.Telegram?.WebApp?.initData)return;
    work(async()=>{const prior=JSON.stringify(requests);await loadRequests();if(JSON.stringify(requests)!==prior)render();});
  }
  window.setInterval(refreshOwnRequests,15000);
  document.addEventListener('visibilitychange',refreshOwnRequests);
  window.ummaB2B={open,backToCatalog};
})();
