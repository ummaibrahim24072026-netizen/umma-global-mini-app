/* Standalone shared screen. A device token can only create unpaid cafe orders. */
(() => {
 'use strict';
 const endpoint='https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-kiosk',menuEndpoint='https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-menu';
 const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let lang='ru',token='',config=null,products=[],inventory=[],stockControl=false,cart=new Map(),stage='welcome',category='all',mode='pickup',payment='cash',table='',busy=false,error='',order=null,lastTouch=Date.now(),warningAt=0,statusBusy=false;
 const tr=(ru,en,vi)=>lang==='vi'?vi:lang==='en'?en:ru;
 const money=n=>new Intl.NumberFormat(lang==='ru'?'ru-RU':lang==='vi'?'vi-VN':'en-US',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(Number(n)||0);
 const title=p=>p['name_'+lang]||p.name_en||p.name_ru||p.name_vi||'';
 const groups=[['soups','Супы','Soups','Súp',/SHURPA|BORSCH/],['mains','Горячее','Mains','Món chính',/PLOV|MANTI|CHICKEN-LEG/],['bakery','Выпечка','Bakery','Bánh',/FLATBREAD|SAMSA|KHACHAPURI/],['salads','Салаты','Salads','Salad',/SALAD|OLIVIER|VINAIGRETTE/],['drinks','Напитки','Drinks','Đồ uống',/AYRAN|TEA|COMPOTE/],['desserts','Десерты','Desserts','Tráng miệng',/DESSERT|BAKLAVA|CROISSANT/]];
 const photoOverrides={'UMMA-CAFE-PLOV':'logo/assets/menu/plov-white-v2.webp','UMMA-CAFE-SHURPA':'logo/assets/menu/shurpa-white-v2.webp','UMMA-CAFE-MANTI':'logo/assets/menu/manti.png','UMMA-CAFE-FLATBREAD':'logo/assets/menu/flatbread-white-v2.webp','UMMA-CAFE-SALAD':'logo/assets/menu/salad.png'};
 const group=p=>groups.find(g=>g[4].test(p.sku||''))?.[0]||'other';
 const pending=()=>{try{return JSON.parse(localStorage.getItem('umma:kiosk:pending')||'null');}catch{return null;}};
 function reset(){if(busy)return;cart.clear();stage='welcome';category='all';mode='pickup';payment='cash';table='';order=null;error='';lang='ru';lastTouch=Date.now();warningAt=0;if($('idle').open)$('idle').close();render();}
 async function api(body){const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,token}),signal:AbortSignal.timeout(20000)});const data=await r.json();if(!r.ok||!data.ok){const e=Error(data.error||tr('Нет связи с кафе','Cafe unavailable','Không thể kết nối'));e.status=r.status;throw e;}return data;}
 function connection(){$('connection').hidden=navigator.onLine!==false;$('connection').textContent=tr('Нет интернета. Заказ не отправляется. Обратитесь к кассиру.','No internet. Please contact the cashier.','Không có internet. Vui lòng liên hệ thu ngân.');}
 function cartRows(){return [...cart].map(([id,q])=>{const p=products.find(x=>x.id===id);return p?'<div class="cart-row"><strong>'+esc(title(p))+'</strong><span>'+money(p.price_vnd*q)+'</span><div class="qty"><button data-change="-1" data-id="'+esc(id)+'" aria-label="'+esc(tr('Уменьшить','Decrease','Giảm'))+'">−</button><b>'+q+'</b><button data-change="1" data-id="'+esc(id)+'" aria-label="'+esc(tr('Добавить','Add','Thêm'))+'">+</button></div></div>':'';}).join('');}
 const total=()=>[...cart].reduce((s,[id,q])=>s+(products.find(p=>p.id===id)?.price_vnd||0)*q,0);
 const totalHtml=()=>'<div class="total"><span>'+tr('Итого','Total','Tổng cộng')+'</span><strong>'+money(total())+'</strong></div>';
 function render(){
  document.documentElement.lang=lang;document.querySelectorAll('[data-lang]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lang===lang)));connection();
  const root=$('screen');if(!config)return;
  $('location').textContent=[config.location.name,config.location.address].filter(Boolean).join(' · ');
  if(stage==='welcome'){
   root.innerHTML='<section class="welcome"><img src="logo/assets/umma-logo.webp" alt="UMMA"><p class="eyebrow">HALAL · UMMA FAMILY</p><h1>'+tr('Добро пожаловать!','Welcome!','Xin chào!')+'</h1><p>'+tr('Выберите блюда на экране. Заказ поступит в наше кафе.','Choose your food on this screen. Your order goes to our cafe.','Chọn món trên màn hình. Đơn hàng sẽ được gửi đến quán.')+'</p><button class="primary" data-action="start">'+tr('Начать заказ','Start order','Bắt đầu đặt món')+'</button></section>';
  }else if(stage==='menu'){
   const cats=[['all',tr('Всё меню','Full menu','Tất cả')],...groups.filter(g=>products.some(p=>group(p)===g[0])).map(g=>[g[0],tr(g[1],g[2],g[3])]),...(products.some(p=>group(p)==='other')?[['other',tr('Другое','Other','Khác')]]:[])];
   root.innerHTML='<div class="menu-head"><div><p class="steps">1 · '+tr('Меню → Проверка → Номер заказа','Menu → Review → Order number','Thực đơn → Kiểm tra → Số đơn')+'</p><h1>'+tr('Что приготовим для вас?','What would you like?','Bạn muốn dùng món gì?')+'</h1></div><button data-action="cancel">'+tr('Начать заново','Start over','Bắt đầu lại')+'</button></div><div class="layout"><section><nav class="categories">'+cats.map(([id,label])=>'<button data-category="'+id+'" aria-pressed="'+(id===category)+'">'+label+'</button>').join('')+'</nav><div class="products">'+products.filter(p=>category==='all'||group(p)===category).map(p=>{
    let image='';try{const source=photoOverrides[p.sku]||p.image_url;const u=new URL(source||'',document.baseURI);if(source&&(u.protocol==='https:'||u.origin===location.origin))image='<img src="'+esc(u.href)+'" alt="" loading="lazy" referrerpolicy="no-referrer">';}catch{}
    return '<article class="product">'+image+'<h2>'+esc(title(p))+'</h2><small>'+esc(p.weight_value?(p.weight_unit==='ml'?'':'~ ')+p.weight_value+' '+(p.weight_unit||'g'):'')+'</small><footer><b>'+money(p.price_vnd)+'</b><div class="qty">'+(cart.has(p.id)?'<button data-id="'+esc(p.id)+'" data-change="-1" aria-label="'+esc(tr('Уменьшить','Decrease','Giảm'))+'">−</button><b>'+cart.get(p.id)+'</b>':'')+'<button class="primary" data-id="'+esc(p.id)+'" data-change="1" aria-label="'+esc(tr('Добавить','Add','Thêm')+' '+title(p))+'">+</button></div></footer></article>';
   }).join('')+'</div>'+(products.length?'':'<p class="empty">'+tr('Нет доступных блюд. Обратитесь к кассиру.','No dishes available. Please ask the cashier.','Chưa có món. Vui lòng hỏi thu ngân.')+'</p>')+'</section><aside class="basket"><h2>'+tr('Ваш заказ','Your order','Đơn hàng')+'</h2>'+cartRows()+totalHtml()+'<button class="primary" data-action="review" '+(!cart.size?'disabled':'')+'>'+tr('Далее','Continue','Tiếp tục')+'</button></aside></div>';
  }else if(stage==='checkout'){
   root.innerHTML='<section class="checkout"><button data-action="menu">← '+tr('Вернуться к меню','Back to menu','Quay lại thực đơn')+'</button><h1>'+tr('Проверьте заказ','Review your order','Kiểm tra đơn hàng')+'</h1><section class="checkout-section">'+cartRows()+totalHtml()+'</section><section class="checkout-section"><h2>'+tr('Где будете есть?','Where will you eat?','Bạn dùng ở đâu?')+'</h2><div class="choice">'+[['pickup',tr('С собой','Takeaway','Mang đi')],['dine_in',tr('В кафе','Dine in','Tại quán')]].map(([id,label])=>'<button data-mode="'+id+'" aria-pressed="'+(mode===id)+'">'+label+'</button>').join('')+'</div>'+(mode==='dine_in'?'<label>'+tr('Ваш стол','Your table','Bàn của bạn')+'<select id="table"><option value="">'+tr('Выберите стол','Choose a table','Chọn bàn')+'</option>'+[1,2,3,4,5,6].map(n=>'<option value="'+n+'" '+(table===String(n)?'selected':'')+'>'+n+'</option>').join('')+'</select></label>':'')+'</section><section class="checkout-section"><h2>'+tr('Как оплатите?','Payment','Thanh toán')+'</h2><div class="choice">'+[['cash',tr('Наличными у кассы','Cash at counter','Tiền mặt tại quầy')],...(config.qrAvailable?[['qr',tr('QR с телефона','QR from phone','QR bằng điện thoại')]]:[])].map(([id,label])=>'<button data-payment="'+id+'" aria-pressed="'+(payment===id)+'">'+label+'</button>').join('')+'</div><p>'+tr('Оплата подтверждается после получения денег.','Payment is confirmed after funds are received.','Thanh toán được xác nhận sau khi nhận tiền.')+'</p></section><button class="primary" data-action="submit" '+(busy||!cart.size?'disabled':'')+'>'+tr('Подтвердить заказ','Confirm order','Xác nhận đơn hàng')+'</button></section>';
  }else if(stage==='receipt'){
   root.innerHTML='<section class="receipt"><p class="eyebrow">UMMA CAFE</p><h1>'+tr('Ваш номер заказа','Your order number','Số đơn hàng')+'</h1><div class="number">'+esc(order.orderNumber||order.number)+'</div><p>'+tr('Запомните или сфотографируйте номер. Получите заказ у сотрудника.','Remember or photograph this number. Collect your order from our staff.','Ghi nhớ hoặc chụp số đơn. Nhận món từ nhân viên.')+'</p><h2>'+money(order.totalVnd??order.total)+'</h2><div id="qr"></div><p id="paymentStatus" role="status">'+tr('Наличными оплатите у кассы. Если выбрали QR, реквизиты появятся здесь.','Pay cash at the counter. For QR payment, details appear here.','Trả tiền mặt tại quầy. Nếu chọn QR, thông tin sẽ hiện ở đây.')+'</p><button data-action="check">'+tr('Проверить оплату','Check payment','Kiểm tra thanh toán')+'</button><button class="primary" data-action="new">'+tr('Следующий посетитель','Next customer','Khách tiếp theo')+'</button></section>';
   void status();
  }else if(stage==='recovery'){
   root.innerHTML='<section class="receipt"><h1>'+tr('Проверяем отправленный заказ','Check submitted order','Kiểm tra đơn đã gửi')+'</h1><p>'+tr('Ответ кафе мог потеряться. Проверьте прежний заказ, чтобы не оформить второй.','The response may have been lost. Check the previous order to avoid a duplicate.','Có thể mất phản hồi. Kiểm tra đơn trước để tránh đặt trùng.')+'</p><button class="primary" data-action="recover" '+(busy?'disabled':'')+'>'+tr('Проверить прежний заказ','Check previous order','Kiểm tra đơn trước')+'</button></section>';
  }
  if(error)root.insertAdjacentHTML('afterbegin','<p class="error" role="alert">'+esc(error)+'</p>');
  if(busy)root.querySelectorAll('button,select').forEach(b=>b.disabled=true);
 }
 async function loadMenu(){const r=await fetch(menuEndpoint,{signal:AbortSignal.timeout(15000),cache:'no-store'});const data=await r.json();if(!r.ok||!data.ok)throw Error(tr('Не удалось загрузить меню','Could not load menu','Không tải được thực đơn'));inventory=data.inventory||[];stockControl=data.inventoryControlEnabled===true;products=(data.products||[]).filter(p=>p.price_vnd!=null&&!p.catalog_preview&&!p.photo_only&&p.is_active!==false).map(p=>{const row=inventory.find(i=>i.product_id===p.id&&i.location_id===config.location.id);return {...p,price_vnd:stockControl&&row?.price_vnd!=null?row.price_vnd:p.price_vnd,available:stockControl?(row?.is_available===false?0:Number(row?.quantity||0)-Number(row?.reserved_quantity||0)):99};}).filter(p=>p.available>0);}
 async function submit(saved=null){
  if(busy)return;
  if(!saved&&mode==='dine_in'&&!/^[1-6]$/.test(table)){error=tr('Выберите номер стола','Choose your table','Chọn số bàn');render();return;}
  if(navigator.onLine===false){error=tr('Нет интернета. Попробуйте после подключения.','No internet. Please reconnect.','Không có internet. Vui lòng kết nối lại.');render();return;}
  busy=true;error='';
  const draft=saved||{action:'create',requestKey:crypto.randomUUID(),items:[...cart].map(([productId,quantity])=>({productId,quantity})),orderType:mode,paymentMethod:payment,table:mode==='dine_in'?table:null};
  try{localStorage.setItem('umma:kiosk:pending',JSON.stringify(draft));render();const result=await api(draft);order=result.order;localStorage.removeItem('umma:kiosk:pending');cart.clear();stage='receipt';}
  catch(e){error=e.message;if(e.status>=400&&e.status<500){localStorage.removeItem('umma:kiosk:pending');stage='checkout';}else stage=pending()?'recovery':'checkout';}
  finally{busy=false;lastTouch=Date.now();render();}
 }
 async function status(){if(stage!=='receipt'||!order||statusBusy)return;statusBusy=true;const id=order.id;try{const result=await api({action:'status',orderId:id});if(stage!=='receipt'||order?.id!==id)return;
  const paid=result.order.paymentStatus==='paid',cancelled=result.order.status==='cancelled';
  $('paymentStatus').textContent=cancelled?tr('Заказ отменён. Обратитесь к кассиру.','Order cancelled. Please contact the cashier.','Đơn đã hủy. Vui lòng gặp thu ngân.'):paid?tr('✓ Оплата подтверждена. Спасибо!','✓ Payment confirmed. Thank you!','✓ Đã thanh toán. Cảm ơn!'):result.payment?tr('Отсканируйте QR банковским приложением. Не меняйте сумму и назначение.','Scan QR with your bank app. Keep amount and reference unchanged.','Quét QR bằng ứng dụng ngân hàng. Giữ nguyên số tiền và nội dung.'):tr('Ожидает оплаты у кассы','Awaiting payment at counter','Chờ thanh toán tại quầy');
  $('qr').replaceChildren();if(!paid&&!cancelled&&result.payment&&window.qrcode){const code=window.qrcode(0,'M');code.addData(result.payment.qrPayload);code.make();$('qr').innerHTML=code.createSvgTag({cellSize:6,margin:4,scalable:true});}
 }catch{if(stage==='receipt'&&order?.id===id&&$('paymentStatus'))$('paymentStatus').textContent=tr('Нет связи. Не оплачивайте повторно; обратитесь к кассиру.','Connection lost. Do not pay twice; contact the cashier.','Mất kết nối. Không thanh toán lại; gặp thu ngân.');}finally{statusBusy=false;}}
 document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;lastTouch=Date.now();if(busy)return;
  if(b.dataset.lang){lang=b.dataset.lang;render();return;}
  if(b.dataset.category){category=b.dataset.category;render();return;}
  if(b.dataset.mode){mode=b.dataset.mode;error='';render();return;}
  if(b.dataset.payment){payment=b.dataset.payment;render();return;}
  if(b.dataset.change){const p=products.find(p=>p.id===b.dataset.id);if(!p)return;const q=(cart.get(p.id)||0)+Number(b.dataset.change);if(q<=0)cart.delete(p.id);else if(q<=Math.min(99,p.available))cart.set(p.id,q);if(!cart.size&&stage==='checkout')stage='menu';render();return;}
  const action=b.dataset.action;
  if(action==='start'){if(pending()){stage='recovery';render();return;}busy=true;b.disabled=true;try{await loadMenu();stage='menu';error='';}catch(e){error=e.message;}finally{busy=false;render();}}
  if(action==='review'){stage='checkout';error='';render();window.scrollTo(0,0);}
  if(action==='menu'){stage='menu';error='';render();}
  if(action==='submit')void submit();
  if(action==='recover'&&pending())void submit(pending());
  if(action==='new')reset();
  if(action==='check')void status();
  if(action==='cancel'){if(cart.size){const dlg=$('idle');$('idleTitle').textContent=tr('Начать заново?','Start over?','Bắt đầu lại?');$('idleText').textContent=tr('Текущий список блюд будет очищен.','Your current selection will be cleared.','Các món đã chọn sẽ được xóa.');$('continue').textContent=tr('Продолжить заказ','Continue ordering','Tiếp tục đặt món');if(!dlg.querySelector('[data-reset]')){const x=document.createElement('button');x.dataset.reset='true';x.onclick=()=>{x.remove();reset();};dlg.append(x);}dlg.querySelector('[data-reset]').textContent=tr('Очистить заказ','Clear order','Xóa đơn');dlg.showModal();}else reset();}
 });
 document.addEventListener('change',e=>{if(e.target.id==='table')table=e.target.value;lastTouch=Date.now();});
 document.addEventListener('pointerdown',()=>{lastTouch=Date.now();},{passive:true});
 $('continue').onclick=()=>{$('idle').querySelector('[data-reset]')?.remove();$('idle').close();warningAt=0;lastTouch=Date.now();};
 $('idle').addEventListener('cancel',()=>{warningAt=0;lastTouch=Date.now();});
 $('fullscreen').onclick=()=>document.documentElement.requestFullscreen?.().catch(()=>{});
 setInterval(()=>{if(!config||busy||stage==='welcome')return;const elapsed=Date.now()-lastTouch;
  if(stage==='receipt'&&elapsed>45000){reset();return;}
  if(stage==='recovery')return;
  if(warningAt&&Date.now()-warningAt>=15000){reset();return;}
  if(!warningAt&&elapsed>90000&&!$('idle').open){warningAt=Date.now();$('idleTitle').textContent=tr('Вы ещё выбираете?','Still ordering?','Bạn vẫn đang chọn?');$('idleText').textContent=tr('Через 15 секунд начнётся новый заказ.','A new session starts in 15 seconds.','Phiên mới sẽ bắt đầu sau 15 giây.');$('continue').textContent=tr('Продолжить заказ','Continue ordering','Tiếp tục đặt món');$('idle').querySelector('[data-reset]')?.remove();$('idle').showModal();}
 },1000);
 setInterval(()=>{if(stage==='receipt'&&!document.hidden)void status();},5000);
 window.addEventListener('online',()=>{connection();void status();});window.addEventListener('offline',connection);
 async function init(){
  try{const fragment=new URLSearchParams(location.hash.slice(1));const fresh=fragment.get('activate');if(fresh&&/^[a-f0-9]{64}$/.test(fresh)){localStorage.setItem('umma:kiosk:token',fresh);history.replaceState(null,'',location.pathname);}
   token=localStorage.getItem('umma:kiosk:token')||'';if(!token)throw Error(tr('Экран ещё не подключён. Администратор: откройте приложение UMMA → рабочее место кафе → «Уличный экран» и создайте ссылку подключения.','Screen not activated. Ask the cafe administrator to connect it.','Màn hình chưa được kích hoạt. Vui lòng nhờ quản lý kết nối.'));
   config=await api({action:'config'});if(pending())stage='recovery';render();
  }catch(e){$('screen').innerHTML='<section class="setup"><h1>UMMA CAFE</h1><p role="status">'+esc(e.message)+'</p><button id="retryInit">'+tr('Повторить','Retry','Thử lại')+'</button></section>';$('retryInit').onclick=()=>void init();}
 }
 void init();
})();
