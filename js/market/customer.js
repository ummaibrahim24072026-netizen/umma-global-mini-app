/* UMMA Market customer catalogue and exact-package checkout, inside UMMA Global. */
(() => {
 'use strict';
 const api=window.ummaMarketApi,esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const t=(ru,en,vi)=>{const l=window.ummaI18n?.locale?.()||'ru';return l.startsWith('vi')?vi:l.startsWith('en')?en:ru;};
 const money=n=>new Intl.NumberFormat(window.ummaI18n?.locale?.()||'vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(Number(n)||0);
 const name=o=>window.ummaI18n?.field?.(o.product,'name')||o.product?.name_ru||o.product?.name_en||o.product?.name_vi||'UMMA';
 const carriers=window.ummaDeliveryProviders;
 const qty=(n,m)=>m==='g'?(n/1000).toLocaleString(undefined,{maximumFractionDigits:3})+' kg':n+' '+t('шт.','pcs','cái');
 const page=document.createElement('section');page.id='marketShopPage';page.className='market-shop native-screen';page.hidden=true;
 document.querySelector('.app')?.append(page);
 let catalog=null,warehouse=null,category='all',search='',mode='catalog',orders=[],staff=false,loading=false,checkout=null,cart=new Map(),poll=null;
 const current=()=>catalog?.warehouses.find(w=>w.id===warehouse);
 const offer=id=>catalog?.offers.find(o=>o.warehouse_id===warehouse&&o.variant_id===id);
 const say=(message,bad=false)=>{const el=page.querySelector('[data-shop-status]');if(el){el.textContent=message;el.className=bad?'market-error':'market-status';}};
 const btn=(action,label,attrs='')=>`<button type="button" data-shop-action="${action}" ${attrs}>${esc(label)}</button>`;
 const items=()=>[...cart.values()].map(c=>({variant_id:c.variant_id,unit_id:c.unit_id||null,count:c.count}));
 const cartTotal=()=>[...cart.values()].reduce((s,c)=>s+c.price*c.count,0);
 const key=(v,u)=>v+':'+(u||'');
 const labelStatus=s=>({pending:t('Новый','New','Mới'),preparing:t('Собираем','Picking','Đang soạn'),ready:t('Готов к выдаче','Ready','Sẵn sàng'),completed:t('Завершён','Completed','Hoàn tất'),cancelled:t('Отменён','Cancelled','Đã hủy')})[s]||s;
 function issueView(o){return(o.issues||[]).map(i=>`<div class="market-issue"><strong>${esc(i.kind==='substitution'?t('Согласование замены','Replacement approval','Xác nhận thay thế'):t('Товара не хватает','Item unavailable','Thiếu mặt hàng'))}</strong><p>${esc(i.reason)}</p>${i.replacement_snapshot?.unit_id?`<p>${esc(qty(i.replacement_snapshot.quantity,i.replacement_snapshot.measure))} · ${money(i.replacement_snapshot.price_vnd)} · ${esc(i.replacement_snapshot.unit_id.slice(-8))}</p>`:''}<p>${esc(i.state)}</p>${i.state==='pending'?`<div class="market-order-actions">${i.kind==='substitution'?btn('issue_answer',t('Согласен на эту упаковку','Accept this package','Đồng ý gói này'),`data-order="${o.id}" data-issue="${i.id}" data-answer="accept"`):''}${btn('issue_answer',t('Готов подождать','I can wait','Tôi có thể chờ'),`data-order="${o.id}" data-issue="${i.id}" data-answer="wait"`)}${btn('issue_answer',t('Отменить заказ / запросить возврат','Cancel / request refund','Hủy / yêu cầu hoàn tiền'),`data-order="${o.id}" data-issue="${i.id}" data-answer="cancel"`)}</div>`:''}</div>`).join('');}
 function render(){
  const state=current();
  page.innerHTML=`<div class="market-banner-actions">${btn('back','←',`aria-label="${esc(t('Назад','Back','Quay lại'))}"`)}${staff?btn('warehouse',t('Склад','Warehouse','Kho')):''}</div><header class="market-shop-header"><img class="market-banner-art" src="logo/assets/umma-market-owner-banner.jpg?v=1" width="1536" height="576" decoding="async" alt=""><div class="market-banner-copy"><small>UMMA GLOBAL</small><h1>UMMA Market</h1><p>${esc(t('Продукты для нашей семьи','Groceries for our family','Thực phẩm cho gia đình chúng ta'))}</p></div></header><p data-shop-status role="status" aria-live="polite"></p><div class="market-shop-tools"><label>${esc(t('Магазин','Store','Cửa hàng'))}<select data-shop-store>${(catalog?.warehouses||[]).map(w=>`<option value="${w.id}" ${w.id===warehouse?'selected':''}>${esc(w.name+' · '+w.location.city)}</option>`).join('')}</select></label>${btn('catalog',t('Каталог','Catalogue','Danh mục'))}${btn('orders',t('Мои заказы','My orders','Đơn hàng'))}${btn('refresh','↻',`aria-label="${esc(t('Обновить','Refresh','Làm mới'))}"`)}</div><div data-shop-body></div><div class="market-shop-cart" ${cart.size&&mode==='catalog'?'':'hidden'}>${btn('checkout',t('К заказу','Checkout','Đặt hàng')+' · '+money(cartTotal()))}</div>`;
  const body=page.querySelector('[data-shop-body]');
  if(mode==='orders'){
   body.innerHTML=orders.map(o=>`<article class="market-order"><header><strong>UMMA Market · №${esc(o.order_number)}</strong><span>${esc(labelStatus(o.status))}</span></header><p>${esc(o.payment_status==='paid'?t('Оплачено','Paid','Đã thanh toán'):o.payment_status==='refunded'?t('Возвращено','Refunded','Đã hoàn tiền'):t('Ожидает оплаты','Awaiting payment','Chờ thanh toán'))}${o.refunded_vnd?' · '+money(o.refunded_vnd):''}</p><ul>${o.items.map(i=>`<li>${esc(window.ummaI18n?.field?.(i,'product_name')||i.product_name_ru)} × ${i.quantity} — ${money(i.line_total_vnd)}</li>`).join('')}</ul><strong>${money(o.total_vnd)}</strong>${o.reserve_until&&!['completed','cancelled'].includes(o.status)?`<p>${esc(t('Резерв до','Reserved until','Giữ hàng đến'))}: ${esc(new Date(o.reserve_until).toLocaleString())}</p>`:''}${issueView(o)}${carriers?.card(o,catalog?.warehouses.find(w=>w.id===o.warehouse_id)?.location)||''}<div class="market-order-actions">${o.payment_method==='qr'&&o.payment_status==='pending'&&o.status!=='cancelled'?window.ummaCafePayment?.button(o.id)||'':''}${o.payment_method==='bank_transfer'&&o.payment_status==='pending'&&o.status!=='cancelled'?btn('transfer_info',t('Реквизиты и чек','Transfer details','Thông tin chuyển khoản'),`data-order="${o.id}"`):''}${o.payment_status==='pending'&&!o.picked_at&&!['completed','cancelled'].includes(o.status)?btn('cancel_order',t('Отменить заказ','Cancel order','Hủy đơn'),`data-order="${o.id}"`):''}${o.order_type==='delivery'?`<button type="button" data-delivery-chat="${o.id}">${esc(t('Чат с курьером','Courier chat','Chat với tài xế'))}</button><button type="button" data-track-delivery="${o.id}" data-tracking-address="${esc(o.delivery_address||'')}">${esc(t('Где мой курьер','Track courier','Theo dõi tài xế'))}</button>`:''}</div></article>`).join('')||`<div class="market-empty"><h2>${esc(t('Здесь появятся ваши заказы','Your orders will appear here','Đơn hàng của bạn sẽ hiện ở đây'))}</h2></div>`;
   return;
  }
  if(!state){body.innerHTML=`<div class="market-empty"><h2>${esc(t('Магазин готовится к открытию','The store is preparing to open','Cửa hàng đang chuẩn bị mở cửa'))}</h2><p>${esc(t('Товары появятся после приёмки и проверки качества.','Products will appear after receiving and quality checks.','Sản phẩm sẽ xuất hiện sau khi nhập kho và kiểm tra chất lượng.'))}</p></div>`;return;}
  body.innerHTML=`<label class="market-search"><span>${esc(t('Найти товар','Find a product','Tìm sản phẩm'))}</span><input type="search" data-shop-search value="${esc(search)}" placeholder="${esc(t('Название товара','Product name','Tên sản phẩm'))}"></label><nav class="market-shop-categories"><button type="button" data-shop-category="all" aria-pressed="${category==='all'}">${esc(t('Все','All','Tất cả'))}</button>${catalog.categories.map(c=>`<button type="button" data-shop-category="${c.id}" aria-pressed="${category===c.id}">${esc(window.ummaI18n?.field?.(c,'name')||c.name_ru)}</button>`).join('')}</nav><div class="market-shop-grid" data-shop-grid></div><p class="market-shop-footnote">${esc(t('Точный вес и окончательная стоимость показываются до оплаты. Доставка UMMA — в пределах отмеченной зоны.','Exact weight and final prices are shown before payment. UMMA delivery is limited to the service area.','Trọng lượng và giá cuối cùng được hiển thị trước khi thanh toán. UMMA chỉ giao trong khu vực phục vụ.'))}</p>`;
  renderGrid();
 }
 function renderGrid(){
  const grid=page.querySelector('[data-shop-grid]');if(!grid)return;
  const list=(catalog?.offers||[]).filter(o=>o.warehouse_id===warehouse&&(category==='all'||o.product.category_id===category)&&[o.product.name_ru,o.product.name_en,o.product.name_vi].join(' ').toLowerCase().includes(search.toLowerCase()));
  grid.innerHTML=list.map(o=>{
   const exact=['fixed_weight','individual_weight'].includes(o.sale_mode),priced=o.price_vnd!=null&&Number(o.price_vnd)>0,available=priced&&(exact?o.units.length>0:o.available_quantity>=Number(o.fixed_quantity||1));
   let image='';try{const u=new URL(o.product.image_url);if(u.protocol==='https:')image=`<img src="${esc(u.href)}" alt="${esc(name(o))}" loading="lazy" referrerpolicy="no-referrer">`;}catch{}
   return `<article class="market-product">${image||'<div class="market-product-placeholder" aria-hidden="true">UMMA</div>'}<div class="market-product-content"><h2>${esc(name(o))}</h2><p class="market-product-price">${priced?money(o.price_vnd)+(o.sale_mode==='individual_weight'?' / kg':o.fixed_quantity?' · '+esc(qty(o.fixed_quantity,o.measure)):''):esc(t('Цена уточняется','Price to be confirmed','Giá sẽ được cập nhật'))}</p>${o.halal_evidence?`<span class="market-halal">${esc(t('Проверено UMMA','UMMA reviewed','UMMA đã kiểm tra'))}</span>`:''}<details><summary>${esc(t('О товаре','Details','Chi tiết'))}</summary><p>${esc(window.ummaI18n?.field?.(o.product,'description')||o.product.description_ru||'')}</p><small>${esc(o.storage_conditions||'')}</small><p>${esc(t('Сертификат: не указан','Certificate: not provided','Chứng chỉ: chưa cung cấp'))}</p></details>${!priced?'':!available?`<p class="market-unavailable">${esc(t('Нет в наличии','Out of stock','Hết hàng'))}</p>`:exact?`<label>${esc(t('Выберите упаковку','Choose a package','Chọn gói hàng'))}<select data-unit-for="${o.variant_id}">${o.units.map(u=>`<option value="${u.id}">${esc(qty(u.quantity,o.measure))} · ${money(u.price_vnd)} · ${esc(u.id.slice(-8))}${u.expires_on?' · '+u.expires_on:''}</option>`).join('')}</select></label>`:''}${priced?btn('add',t('Добавить','Add','Thêm'),`data-variant="${o.variant_id}" ${available?'':'disabled'}`):''}</div></article>`;
  }).join('')||`<div class="market-empty"><h2>${esc(t('Пока нет доступных товаров','No products available yet','Chưa có sản phẩm'))}</h2><p>${esc(t('Новые поступления появятся здесь после проверки.','New stock appears here after inspection.','Hàng mới sẽ hiển thị sau khi kiểm tra.'))}</p></div>`;
 }
 async function refresh(){catalog=await api.call('catalog');if(!catalog.warehouses.some(w=>w.id===warehouse)){warehouse=catalog.warehouses[0]?.id||null;cart.clear();}if(mode==='orders')orders=(await api.call('my_orders')).orders;render();}
 async function work(fn){if(loading)return;loading=true;page.setAttribute('aria-busy','true');try{await fn();}catch(e){say(e.name==='AbortError'?t('Ответ задерживается. Повторите запрос: повторного заказа не будет.','Response timed out. Retry safely; the order will not be duplicated.','Phản hồi quá hạn. Có thể thử lại mà không tạo đơn trùng.'):e.message,true);}finally{loading=false;page.removeAttribute('aria-busy');}}
 async function open(){page.hidden=false;await work(async()=>{await refresh();if(window.Telegram?.WebApp?.initData){try{const b=await api.call('bootstrap');staff=b.isSuperAdmin||b.roles.length>0;render();}catch{}}});clearInterval(poll);poll=setInterval(()=>{if(!page.hidden&&mode==='orders'&&!document.hidden&&!loading)work(async()=>{orders=(await api.call('my_orders')).orders;render();});},5000);}
 function summary(dialog,quote){
  const total=Number(quote.subtotal_vnd)+(dialog.querySelector('[name=order_type]').value==='delivery'&&!carriers?.external(dialog.querySelector('[name=carrier]')?.value)?current().delivery_fee_vnd:0);
  dialog.querySelector('[data-final-total]').textContent=money(total);return total;
 }
 async function startCheckout(){
  if(!cart.size)return;if(!window.Telegram?.WebApp?.initData)throw Error(t('Откройте UMMA Global через Telegram для заказа','Open UMMA Global in Telegram to order','Mở UMMA Global trong Telegram để đặt hàng'));
  const quote=await api.call('quote',{warehouse_id:warehouse,items:items()});
  const dialog=document.createElement('dialog');dialog.className='market-checkout';checkout=dialog;let destination=null;
  const user=window.Telegram?.WebApp?.initDataUnsafe?.user;
  dialog.innerHTML=`<header><h2>${esc(t('Ваш заказ','Your order','Đơn hàng của bạn'))}</h2>${btn('close_checkout','×',`aria-label="${esc(t('Закрыть','Close','Đóng'))}"`)}</header><ul class="market-checkout-items">${[...cart.entries()].map(([k,c])=>`<li><div><strong>${esc(c.name)}</strong><small>${c.unit_id?esc(qty(c.weight,c.measure))+' · '+esc(c.unit_id.slice(-8)):c.count+' × '+money(c.price)}</small></div><b>${money(c.price*c.count)}</b><button type="button" data-remove-cart="${esc(k)}" aria-label="${esc(t('Убрать товар','Remove item','Xóa sản phẩm'))}">×</button></li>`).join('')}</ul><form><label>${esc(t('Ваше имя','Your name','Tên của bạn'))}<input name="customer_name" value="${esc(user?.first_name||'')}" required maxlength="120" autocomplete="name"></label><label>${esc(t('Телефон','Phone','Số điện thoại'))}<input name="customer_phone" type="tel" required maxlength="40" autocomplete="tel"></label><label>${esc(t('Получение','Fulfilment','Nhận hàng'))}<select name="order_type"><option value="pickup">${esc(t('Самовывоз','Pickup','Tự đến lấy'))}</option>${current().location.delivery_zone?`<option value="delivery">${esc(t('Доставка','Delivery','Giao hàng'))} · ${money(current().delivery_fee_vnd)}</option>`:''}</select></label><label>${esc(t('Кто доставит заказ','Delivery provider','Đơn vị giao hàng'))}<select name="carrier">${carriers?.options()||'<option value="umma">UMMA</option>'}</select></label><p data-carrier-hint hidden>${esc(t('Товар оплачивается UMMA заранее. Курьера оформляете и оплачиваете отдельно в сервисе.','Pay UMMA for goods first. Arrange and pay for delivery separately in the service.','Thanh toán hàng cho UMMA trước. Đặt và trả phí giao hàng riêng trong dịch vụ.'))}</p><div data-delivery-fields hidden><label>${esc(t('Квартира, этаж, ориентир (необязательно)','Apartment, floor, landmark (optional)','Căn hộ, tầng, điểm mốc (không bắt buộc)'))}<textarea name="delivery_address" maxlength="440"></textarea></label>${btn('map',t('Указать на карте','Choose on map','Chọn trên bản đồ'))}<p data-destination>${esc(t('Выберите точку в зоне доставки','Choose a point in the delivery area','Chọn vị trí trong khu vực giao hàng'))}</p></div><label>${esc(t('Оплата','Payment','Thanh toán'))}<select name="payment_method"><option value="cash">${esc(t('Наличные при получении','Cash on receipt','Tiền mặt khi nhận hàng'))}</option>${current().qr_enabled?`<option value="qr">${esc(t('Банковский QR','Bank QR','Mã QR ngân hàng'))}</option>`:''}${current().transfer_enabled?`<option value="bank_transfer">${esc(t('Перевод на карту РФ/КЗ','RU/KZ bank transfer','Chuyển khoản RU/KZ'))}</option>`:''}</select></label><label>${esc(t('Комментарий','Note','Ghi chú'))}<textarea name="note" maxlength="500"></textarea></label><p class="market-checkout-total">${esc(t('Итого','Total','Tổng cộng'))}<strong data-final-total></strong></p><p role="status" data-checkout-status></p><button type="submit" class="market-primary">${esc(t('Оформить заказ','Place order','Đặt hàng'))}</button></form>`;
  dialog.addEventListener('close',()=>{dialog.remove();if(checkout===dialog)checkout=null;});
  document.body.append(dialog);dialog.showModal();summary(dialog,quote);
  const close=()=>{dialog.close();dialog.remove();if(checkout===dialog)checkout=null;};dialog.querySelector('[data-shop-action=close_checkout]').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  dialog.querySelectorAll('[data-remove-cart]').forEach(b=>b.onclick=()=>{cart.delete(b.dataset.removeCart);close();render();if(cart.size)work(startCheckout);});
  const syncCarrier=()=>{
   const external=!!carriers?.external(dialog.querySelector('[name=carrier]').value),type=dialog.querySelector('[name=order_type]'),address=dialog.querySelector('[name=delivery_address]'),payment=dialog.querySelector('[name=payment_method]');
   type.disabled=external;const pickup=type.querySelector('[value=pickup]');pickup.textContent=external?t('Выдача выбранному курьеру','Pickup by selected courier','Tài xế đã chọn đến lấy'):t('Самовывоз','Pickup','Tự đến lấy');dialog.querySelector('[data-delivery-fields]').hidden=!external&&type.value!=='delivery';
   dialog.querySelector('[data-shop-action=map]').hidden=false;dialog.querySelector('[data-destination]').hidden=false;address.required=false;
   if(destination&&!external&&window.ummaDeliveryZone?.contains(current().location.delivery_zone,[destination.lat,destination.lng])!==true)destination=null;
   dialog.querySelector('[data-destination]').textContent=destination?t('Точка доставки выбрана','Delivery point selected','Đã chọn vị trí giao hàng'):t('Отметьте точку доставки на карте','Mark the delivery point on the map','Đánh dấu điểm giao hàng trên bản đồ');
   dialog.querySelector('[data-carrier-hint]').hidden=!external;const cash=payment.querySelector('[value=cash]');cash.disabled=external;
   if(external&&payment.value==='cash')payment.value=[...payment.options].find(o=>!o.disabled)?.value||'';
   dialog.querySelector('[type=submit]').disabled=external&&!payment.value;dialog.querySelector('[data-checkout-status]').textContent=external&&!payment.value?t('В этом магазине предоплата пока не настроена.','Prepayment is not configured for this store yet.','Cửa hàng chưa thiết lập thanh toán trước.'):'';summary(dialog,quote);
  };
  dialog.querySelector('[name=order_type]').onchange=syncCarrier;
  dialog.querySelector('[name=carrier]').onchange=syncCarrier;
  dialog.querySelector('[data-shop-action=map]').onclick=e=>{
   window.ummaDeliveryLocation?.chooseForLocation(current().location,p=>{destination=p;dialog.querySelector('[data-destination]').textContent=t('Точка доставки выбрана','Delivery point selected','Đã chọn vị trí giao hàng');},e.currentTarget,{unrestricted:!!carriers?.external(dialog.querySelector('[name=carrier]').value),point:destination});
  };
  let submitting=false;
  dialog.querySelector('form').onsubmit=async e=>{
   e.preventDefault();if(submitting||!e.target.reportValidity())return;submitting=true;const button=e.target.querySelector('[type=submit]'),s=dialog.querySelector('[data-checkout-status]');button.disabled=true;
   try{
    const data=Object.fromEntries(new FormData(e.target));
    if(carriers?.external(data.carrier)){
     if(!destination)throw Error(t('Укажите точку доставки на карте','Choose the delivery point on the map','Chọn điểm giao hàng trên bản đồ'));
     if(data.payment_method==='cash')throw Error(t('Выберите предоплату товара.','Prepay for goods.','Thanh toán hàng trước.'));
     data.delivery_address=[data.delivery_address.replace(/^Точка доставки:.*$/gm,'').trim(),'Точка доставки: '+destination.lat.toFixed(6)+','+destination.lng.toFixed(6)].filter(Boolean).join('\n');
     data.order_type='pickup';data.note=carriers.note(data.carrier,data.note||'',500);
    }else if(data.order_type==='delivery'){
     if(!destination)throw Error(t('Укажите точку доставки на карте','Choose the delivery point on the map','Chọn điểm giao hàng trên bản đồ'));
     data.delivery_address=[data.delivery_address.replace(/^Точка доставки:.*$/gm,'').trim(),'Точка доставки: '+destination.lat.toFixed(6)+','+destination.lng.toFixed(6)].join('\n');
    }else data.delivery_address=null;
    const result=await api.execute('order_create',{warehouse_id:warehouse,...data,items:items(),expected_total_vnd:summary(dialog,quote)});
    cart.clear();close();mode='orders';await refresh();say(t('Заказ создан. Товары зарезервированы.','Order created. Your items are reserved.','Đã tạo đơn. Hàng đã được giữ.'));if(data.payment_method==='qr')window.ummaCafePayment?.show(result.order_id);
   }catch(err){s.textContent=err.name==='AbortError'?t('Ответ задерживается. Повторите эту же отправку.','Response timed out. Retry the same submission.','Phản hồi quá hạn. Gửi lại cùng yêu cầu.'):err.message;}finally{submitting=false;button.disabled=false;}
  };
 }
 page.addEventListener('input',e=>{if(e.target.matches('[data-shop-search]')){search=e.target.value;renderGrid();}});
 page.addEventListener('change',e=>{if(e.target.matches('[data-shop-store]')){warehouse=e.target.value;cart.clear();category='all';render();}});
 page.addEventListener('click',e=>{
  const categoryButton=e.target.closest('[data-shop-category]');if(categoryButton){category=categoryButton.dataset.shopCategory;render();return;}
  const button=e.target.closest('[data-shop-action]');if(!button)return;const action=button.dataset.shopAction;
  if(action==='back'){if(!window.ummaNavigation?.back())window.openPage?.('home');return;}
  if(action==='warehouse'){window.ummaMarket.openWarehouse();return;}
  if(action==='add'){
   const o=offer(button.dataset.variant);if(!o||o.price_vnd==null||Number(o.price_vnd)<=0)return;const exact=['individual_weight','fixed_weight'].includes(o.sale_mode),unit=exact?o.units.find(u=>u.id===page.querySelector(`[data-unit-for="${o.variant_id}"]`).value):null;
   const k=key(o.variant_id,unit?.id),old=cart.get(k),count=exact?1:(old?.count||0)+1;
   if(count>99||(!exact&&count*Number(o.fixed_quantity||1)>Number(o.available_quantity))){say(t('Недостаточно товара','Insufficient stock','Không đủ hàng'),true);return;}
   cart.set(k,{variant_id:o.variant_id,unit_id:unit?.id,count,name:name(o),price:unit?.price_vnd||o.price_vnd,weight:unit?.quantity,measure:o.measure});render();return;
  }
  work(async()=>{
   if(action==='catalog'){mode='catalog';render();}
   else if(action==='orders'){mode='orders';await refresh();}
   else if(action==='refresh')await refresh();
   else if(action==='checkout')await startCheckout();
   else if(action==='cancel_order'){const o=orders.find(o=>o.id===button.dataset.order);await api.execute('order_cancel',{warehouse_id:o.warehouse_id,order_id:o.id});await refresh();}
   else if(action==='issue_answer'){const o=orders.find(o=>o.id===button.dataset.order);await api.execute('substitution_answer',{warehouse_id:o.warehouse_id,order_id:o.id,issue_id:button.dataset.issue,answer:button.dataset.answer});await refresh();}
   else if(action==='transfer_info'){const o=orders.find(o=>o.id===button.dataset.order);const d=document.createElement('dialog');d.className='market-checkout';d.innerHTML=`<h2>${esc(t('Банковский перевод','Bank transfer','Chuyển khoản'))}</h2><p>${esc(o.payment_instructions?.details||t('Свяжитесь с магазином для получения реквизитов.','Contact the store for bank details.','Liên hệ cửa hàng để nhận thông tin ngân hàng.'))}</p><p>${money(o.total_vnd)}</p><p>${esc(t('Скриншот не подтверждает получение денег. Оплату проверяет кассир.','A screenshot does not confirm receipt. The cashier checks the payment.','Ảnh chụp không xác nhận đã nhận tiền. Thu ngân sẽ kiểm tra.'))}</p><button type="button">${esc(t('Закрыть','Close','Đóng'))}</button>`;document.body.append(d);d.showModal();d.querySelector('button').onclick=()=>{d.close();d.remove();};}
  });
 });
 window.addEventListener('umma:languagechange',()=>{if(!page.hidden)render();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!page.hidden&&mode==='orders')work(refresh);});
 const old=window.ummaMarket;window.ummaMarket={...old,openWarehouse:old.open,open,closeCheckout:()=>{checkout?.close();checkout?.remove();checkout=null;},isCheckoutOpen:()=>checkout?.open===true};
})();
