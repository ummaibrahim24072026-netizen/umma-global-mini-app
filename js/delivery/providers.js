/* Customer-arranged carrier pickup. Never dispatches or claims to track an external courier. */
(() => {
  'use strict';
  const providers = Object.freeze({
    umma: { name: 'Курьер UMMA', enabled: true },
    grab: { name: 'GrabExpress', enabled: true, url: 'https://grab.onelink.me/2695613898/GESMS' },
    maxim: { name: 'Maxim', enabled: true, url: 'https://maxim-android.onelink.me/ezSa' },
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
    if(id==='maxim'){
      // Official launch links from Maxim's Nha Trang ordering-app page.
      // Only the app home URI is confirmed; do not invent delivery/route parameters.
      const platform=window.Telegram?.WebApp?.platform;
      const ios=platform==='ios'||(platform!=='android'&&(/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)));
      const app=new URL(ios?'https://maxim-ios.onelink.me/IqHi':p.url);
      app.searchParams.set('af_web_dp',ios?'https://apps.apple.com/app/id579985456':'https://play.google.com/store/apps/details?id=com.taxsee.taxsee');
      app.searchParams.set('c','main');
      app.searchParams.set('pid','taximaxim_site');
      app.searchParams.set('is_retargeting','true');
      app.searchParams.set('af_dp','maximzakaz://app');
      app.searchParams.set('af_force_deeplink','true');
      return app.href;
    }
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
  function handoffFields(order,location) {
    const details=routeDetails(order,location);
    const pin=p=>p.latitude!=null&&p.longitude!=null?p.latitude.toFixed(6)+','+p.longitude.toFixed(6):'';
    const items=(Array.isArray(order.cafe_order_items)?order.cafe_order_items:[]).map(item=>{
      const name=item.product_name_vi||item.product_name_en||item.product_name_ru;
      const quantity=Number(item.quantity);
      return name&&Number.isFinite(quantity)&&quantity>0?`${name} × ${quantity}`:null;
    }).filter(Boolean);
    // Remove only our persisted carrier metadata, retaining the customer's instructions.
    const note=String(order.customer_note||'').replace(/^\[UMMA-DELIVERY:(grab|maxim)\]\n[^\n]*\n/,'').trim();
    const comment=[`Lấy đơn hàng UMMA #${order.order_number} tại ${details.pickup.address}.`,
      items.length?`Món hàng: ${items.join('; ')}.`:null,
      order.customer_name?`Người nhận: ${order.customer_name}.`:null,
      order.customer_phone?`SĐT người nhận: ${order.customer_phone}.`:null,
      location?.phone?`SĐT quán: ${location.phone}.`:null,
      note?`Ghi chú khách hàng: ${note}`:null,
      order.payment_status==='paid'?'Tiền hàng đã thanh toán cho UMMA. Không thu tiền hàng.':null,
      'Phí giao hàng thanh toán riêng.'].filter(Boolean).join('\n');
    return [
      {key:'pickup',label:t('Откуда забрать','Pickup','Điểm lấy hàng'),value:pin(details.pickup)||details.pickup.address,address:details.pickup.address,rows:2},
      {key:'dropoff',label:t('Куда доставить','Drop-off','Điểm giao hàng'),value:pin(details.dropoff)||details.dropoff.address,address:details.dropoff.address,rows:2},
      {key:'comment',label:t('Комментарий для курьера','Courier comment','Ghi chú cho tài xế'),value:comment,rows:6}
    ];
  }
  function copyFields(order,location) {
    return handoffFields(order,location).map(f=>`<div data-carrier-field="${f.key}"><label><strong>${esc(f.label)}</strong>${f.address&&f.value!==f.address?`<small>${esc(f.address)}</small>`:''}<textarea readonly rows="${f.rows}" aria-label="${esc(f.label)}">${esc(f.value)}</textarea></label><button type="button" data-copy-carrier-field>${esc(t('Скопировать','Copy','Sao chép'))}</button><p role="status" aria-live="polite" data-copy-status></p></div>`).join('');
  }
  function card(order,location) {
    const id=provider(order);if(!id)return '';
    const p=providers[id],closed=order.status==='cancelled'||order.payment_status==='refunded';
    const details=routeDetails(order,location),pickup=details.pickup.address;
    return `<section class="external-delivery"><strong>${esc(t('Доставка через ','Delivery via ','Giao hàng qua ')+p.name)}</strong><p>${esc(t('Доставку оформляете и оплачиваете отдельно в сервисе. Отслеживание — там же.','Arrange and pay for delivery separately in the service. Track your courier there.','Đặt và trả phí giao hàng riêng trong dịch vụ. Theo dõi tài xế tại đó.'))}</p>${closed?'':order.status==='completed'?`<a class="kitchen-action" href="${esc(link(id))}" target="_blank" rel="noopener noreferrer" data-open-carrier>${esc(t('Открыть ','Open ','Mở ')+p.name)}</a>`:order.payment_status!=='paid'?`<p role="status">${esc(t('После подтверждения оплаты товара здесь появится переход к доставке.','Delivery setup will appear here once payment for goods is confirmed.','Liên kết đặt giao hàng sẽ xuất hiện sau khi xác nhận thanh toán hàng.'))}</p>`:pickup&&order.delivery_address?`${copyFields(order,location)}<a class="kitchen-action" href="${esc(link(id,pickup,order.delivery_address))}" target="_blank" rel="noopener noreferrer" data-open-carrier>${esc(t('Открыть ','Open ','Mở ')+p.name)}</a><small>${esc(t('В Maxim/Grab выберите доставку и вставьте каждое поле отдельно. Автозаполнение пока недоступно.','Choose delivery in Maxim/Grab and paste each field separately. Autofill is not available yet.','Chọn giao hàng trong Maxim/Grab và dán từng trường riêng. Chưa hỗ trợ tự động điền.'))}</small>`:`<p>${esc(t('Уточните адрес выдачи и доставки у UMMA.','Confirm pickup and delivery addresses with UMMA.','Xác nhận địa chỉ lấy và giao hàng với UMMA.'))}</p>`}</section>`;
  }
  document.addEventListener('click',async event=>{
    const b=event.target.closest?.('[data-copy-carrier-field]');
    if(b){
      const root=b.closest('[data-carrier-field]'),field=root.querySelector('textarea'),status=root.querySelector('[data-copy-status]');
      try{await navigator.clipboard.writeText(field.value);status.textContent=t('Скопировано','Copied','Đã sao chép');}
      catch{field.focus();field.select();status.textContent=t('Выделено — скопируйте текст.','Selected — copy the text.','Đã chọn — hãy sao chép.');}
      return;
    }
    const a=event.target.closest?.('[data-open-carrier]');
    if(a&&window.Telegram?.WebApp?.openLink){event.preventDefault();window.Telegram.WebApp.openLink(a.href);}
  });
  window.ummaDeliveryProviders={providers,options,external,note,provider,link,routeDetails,handoffFields,card};
})();
