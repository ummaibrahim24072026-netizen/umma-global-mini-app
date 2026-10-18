/* Customer-arranged carrier pickup. Never dispatches or claims to track an external courier. */
(() => {
  'use strict';
  const providers = Object.freeze({
    umma: { name: 'Курьер UMMA', enabled: true },
    grab: { name: 'GrabExpress', enabled: true, url: 'https://grab.onelink.me/2695613898/GESMS' },
    maxim: { name: 'Maxim', enabled: true, url: 'https://taximaxim.com/l/app' },
    lalamove: { name: 'Lalamove', enabled: false, url: 'https://web.lalamove.com/' }
  });
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const t = (ru,en,vi) => { const l=window.ummaI18n?.locale?.()||'ru'; return l.startsWith('vi')?vi:l.startsWith('en')?en:ru; };
  function options() {
    return Object.entries(providers).map(([id,p])=>`<option value="${id}" ${p.enabled?'':'disabled'}>${esc(id==='umma'?t(p.name,'UMMA courier','Tài xế UMMA'):p.name)}${p.enabled?'':esc(t(' · Нячанг: проверяем доступность',' · Nha Trang: checking availability',' · Nha Trang: đang kiểm tra'))}</option>`).join('');
  }
  function external(id) { return id !== 'umma' && providers[id]?.enabled === true; }
  function note(id, text='', limit=1000) {
    if(!external(id))return text;
    const header=`[UMMA-DELIVERY:${id}]\n${providers[id].name}: курьера оформляет клиент. Доставка оплачивается отдельно; товар оплатить UMMA до выдачи.\n`;
    return header+text.slice(0,Math.max(0,limit-header.length));
  }
  function provider(order) {
    if(order?.order_type!=='pickup')return null;
    const id=/^\[UMMA-DELIVERY:(grab|maxim)\]\n/.exec(order.customer_note||'')?.[1];
    return external(id)?id:null;
  }
  function link(id,pickup,dropoff) {
    const p=providers[id];if(!p?.url)throw Error('Unknown delivery provider');
    const url=new URL(p.url);
    if(id==='lalamove' && pickup?.trim() && dropoff?.trim()){
      url.searchParams.set('pickup',pickup.trim());url.searchParams.set('dropoff',dropoff.trim());
    }
    return url.href;
  }
  function coordinate(lat,lng) {
    if(lat==null||lng==null)return null;
    const a=Number(lat),b=Number(lng);
    return Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a)<=90&&Math.abs(b)<=180?{latitude:a,longitude:b}:null;
  }
  function routeDetails(order,location) {
    const pin=window.ummaMapLinks?.parseAddress(order?.delivery_address);
    return {pickup:{address:[location?.name,location?.address].filter(Boolean).join(', '),...coordinate(location?.latitude,location?.longitude)},dropoff:{address:order?.delivery_address||'',...coordinate(pin?.lat,pin?.lng)}};
  }
  function card(order,location) {
    const id=provider(order);if(!id)return '';
    const p=providers[id],closed=order.status==='cancelled'||order.payment_status==='refunded';
    const details=routeDetails(order,location),pickup=details.pickup.address;
    const pin=p=>p.latitude!=null&&p.longitude!=null?p.latitude.toFixed(6)+','+p.longitude.toFixed(6):'';
    const pickupPin=pin(details.pickup),dropoffPin=pin(details.dropoff);
    const route=[`UMMA #${order.order_number}`,`Pickup: ${pickup}`,pickupPin?`Pickup coordinates: ${pickupPin}`:null,`Drop-off: ${order.delivery_address||''}`,dropoffPin?`Drop-off coordinates: ${dropoffPin}`:null,`Recipient: ${order.customer_name||''}`,`Phone: ${order.customer_phone||''}`,`Store phone: ${location?.phone||''}`,'Goods paid to UMMA. Do not collect payment for goods. Delivery fee paid separately.'].filter(Boolean).join('\n');
    return `<section class="external-delivery"><strong>${esc(t('Доставка через ','Delivery via ','Giao hàng qua ')+p.name)}</strong><p>${esc(t('Доставку оформляете и оплачиваете отдельно в сервисе. Отслеживание — там же.','Arrange and pay for delivery separately in the service. Track your courier there.','Đặt và trả phí giao hàng riêng trong dịch vụ. Theo dõi tài xế tại đó.'))}</p>${closed?'':order.status==='completed'?`<a class="kitchen-action" href="${esc(link(id))}" target="_blank" rel="noopener noreferrer" data-open-carrier>${esc(t('Открыть ','Open ','Mở ')+p.name)}</a>`:order.payment_status!=='paid'?`<p role="status">${esc(t('После подтверждения оплаты товара здесь появится переход к доставке.','Delivery setup will appear here once payment for goods is confirmed.','Liên kết đặt giao hàng sẽ xuất hiện sau khi xác nhận thanh toán hàng.'))}</p>`:pickup&&order.delivery_address?`${dropoffPin?`<p>${esc(t('Точка доставки','Delivery point','Điểm giao hàng'))}: <b>${esc(dropoffPin)}</b></p><button type="button" data-copy-point="${esc(dropoffPin)}">${esc(t('Скопировать координаты','Copy coordinates','Sao chép tọa độ'))}</button><p role="status" data-point-copy-status></p>`:''}<details><summary>${esc(t('Данные для курьера','Courier details','Thông tin cho tài xế'))}</summary><textarea readonly rows="5" aria-label="${esc(t('Данные для курьера','Courier details','Thông tin cho tài xế'))}">${esc(route)}</textarea><button type="button" data-copy-carrier>${esc(t('Скопировать данные','Copy details','Sao chép thông tin'))}</button><p role="status" data-copy-status></p></details><a class="kitchen-action" href="${esc(link(id,pickup,order.delivery_address))}" target="_blank" rel="noopener noreferrer" data-open-carrier>${esc(t('Открыть ','Open ','Mở ')+p.name)}</a><small>${esc(t('В сервисе выберите доставку и вставьте адреса. Переход не вызывает курьера автоматически.','Choose delivery and paste the addresses in the service. Opening it does not book a courier.','Chọn giao hàng và dán địa chỉ trong dịch vụ. Mở liên kết chưa đặt tài xế.'))}</small>`:`<p>${esc(t('Уточните адрес выдачи и доставки у UMMA.','Confirm pickup and delivery addresses with UMMA.','Xác nhận địa chỉ lấy và giao hàng với UMMA.'))}</p>`}</section>`;
  }
  document.addEventListener('click',async event=>{
    const pointButton=event.target.closest?.('[data-copy-point]');
    if(pointButton){const root=pointButton.closest('.external-delivery'),status=root.querySelector('[data-point-copy-status]');try{await navigator.clipboard.writeText(pointButton.dataset.copyPoint);status.textContent=t('Скопировано','Copied','Đã sao chép');}catch{const field=root.querySelector('textarea');field?.focus();field?.select();status.textContent=t('Скопируйте координаты из данных для курьера.','Copy coordinates from courier details.','Sao chép tọa độ trong thông tin tài xế.');}return;}
    const b=event.target.closest?.('[data-copy-carrier]');
    if(b){const root=b.closest('.external-delivery'),field=root.querySelector('textarea'),status=root.querySelector('[data-copy-status]');try{await navigator.clipboard.writeText(field.value);status.textContent=t('Скопировано','Copied','Đã sao chép');}catch{field.focus();field.select();status.textContent=t('Выделено — скопируйте текст.','Selected — copy the text.','Đã chọn — hãy sao chép.');}return;}
    const a=event.target.closest?.('[data-open-carrier]');
    if(a&&window.Telegram?.WebApp?.openLink){event.preventDefault();window.Telegram.WebApp.openLink(a.href);}
  });
  window.ummaDeliveryProviders={providers,options,external,note,provider,link,routeDetails,card};
})();
