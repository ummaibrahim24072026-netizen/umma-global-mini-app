/* POS and account control for the standalone web staff app. Server prices are authoritative. */
(()=>{'use strict';const $=id=>document.getElementById(id),base='https://zwzojugspldexyyljwpr.supabase.co/functions/v1/',auth=window.ummaStaffAuth;
const money=v=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(Number(v)||0),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let me=null,products=[],inventory=[],stockControl=false,cart=new Map(),sale=null,busy=false,installPrompt=null,currentTab='pos',refreshing=false,basketInView=false,openKitchen=false;
const requested=new URLSearchParams(location.search).get('work');
const invite=new URLSearchParams(location.hash.slice(1)).get('invite');
if(requested==='stock'){
 document.title='UMMA · Склад';
 $('loginTitle').textContent='Вход на склад';
 $('loginHint').textContent='Закупки и остатки ингредиентов кафе.';
}
if(invite){$('webExistingLogin').hidden=false;$('loginTitle').textContent='Создайте веб-доступ';$('loginHint').textContent='Укажите email или придумайте логин и пароль. После этого входите на кухню, в кассу или доставку напрямую из браузера.';$('webLoginSubmit').textContent='Создать доступ';$('webPassword').autocomplete='new-password';}
function notice(s){$('webNotice').textContent=s;}
async function api(action,extra={},endpoint='cafe-web'){const response=await fetch(base+endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,initData:auth.credential(),...extra}),cache:'no-store',signal:AbortSignal.timeout(20000)});const data=await response.json();if(!response.ok||!data.ok){const e=Error(data.error||'Нет связи с кафе');e.status=response.status;throw e;}return data;}
const screenKey=()=> 'umma:pos-screen:'+auth.actorId()+':'+$('posLocation').value;
function screen(){try{return JSON.parse(localStorage.getItem(screenKey())||'null');}catch{return null;}}
function showPair(value){$('screenUnpair').hidden=!value;$('screenPairLink').hidden=!value;$('screenPairQr').replaceChildren();if(!value)return;const url=new URL('payment-screen.html',location.href);url.hash=new URLSearchParams({screen:value.token});$('screenPairLink').href=url.href;drawQr($('screenPairQr'),url.href);$('screenPairState').textContent='Откройте эту ссылку на планшете или отсканируйте QR. Экран привязан к выбранному кафе.';}
function drawQr(root,payload){const qr=qrcode(0,'M');qr.addData(payload);qr.make();root.innerHTML=qr.createSvgTag({cellSize:5,margin:20,scalable:true});}
async function displayOrder(orderId){const s=screen();if(!s){notice('Заказ создан. Для отдельного планшета откройте «Экран оплаты для клиента» и подключите его.');return;}await api('screenSelect',{screenId:s.id,orderId});}
function available(){const id=$('posLocation').value,ready=me?.locations?.find(l=>l.id===id)?.ready_stock_enabled===true;return products.map(p=>{const i=inventory.find(i=>i.location_id===id&&i.product_id===p.id);return {...p,price_vnd:!ready&&stockControl&&i?.price_vnd!=null?Number(i.price_vnd):Number(p.price_vnd),available:ready?(!i?.ready_stock_confirmed||i.ready_stock_state!=='ready'||i.is_available===false?0:Math.max(0,Number(i.quantity)-Number(i.reserved_quantity||0))):stockControl?(i?.is_available===false?0:Number(i?.quantity||0)-Number(i?.reserved_quantity||0)):99};}).filter(p=>p.available>0);}
let lastMenuMarkup;
function menu(){
  const query=$('posSearch').value.trim().toLocaleLowerCase();
  const cards=available().filter(p=>(p.name_ru+' '+p.name_vi+' '+p.name_en).toLocaleLowerCase().includes(query)).map(p=>{
    const photo=window.ummaCafeProductPhoto?.(p);
    const description=p.description_ru||p.description_en||p.description_vi;
    const name=p.name_ru||p.name_en||p.name_vi;
    return '<article class="pos-product" data-pos-product="'+esc(p.id)+'">'+
      '<span class="pos-product-media">'+
      (photo?'<img src="'+esc(photo)+'" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">':'')+
      '<span class="pos-product-no-photo">Фото пока нет</span></span>'+
      '<strong>'+esc(name)+'</strong><span>'+esc(p.name_vi||p.name_en||'')+'</span>'+
      (description?'<details class="pos-product-description"><summary>Описание</summary><p>'+esc(description)+'</p></details>':'')+
      '<div class="pos-product-bottom"><b>'+money(p.price_vnd)+'</b>'+
      '<button type="button" class="primary pos-product-add" data-pos-add="'+esc(p.id)+'" aria-label="Добавить '+esc(name)+'">+</button></div></article>';
  });
  const markup=cards.join('')||(query?'<p>По этому запросу ничего нет.</p>':'<p>Сейчас нет блюд, доступных для продажи.</p>');
  if(markup!==lastMenuMarkup){
    $('posProducts').innerHTML=markup;
    lastMenuMarkup=markup;
  }
}
$('posProducts').addEventListener('error',event=>{
  if(event.target.matches('.pos-product-media img'))event.target.hidden=true;
},true);
const amount=()=>[...cart.values()].reduce((s,x)=>s+x.quantity*x.product.price_vnd,0);
function renderCart(){$('posCart').innerHTML=cart.size?[...cart].map(([id,x])=>'<div class="pos-row"><strong>'+esc(x.product.name_ru||x.product.name_en)+'</strong><span>'+money(x.product.price_vnd*x.quantity)+'</span><div><button type="button" data-pos-delta="-1" data-id="'+esc(id)+'" aria-label="Уменьшить">−</button><b>'+x.quantity+'</b><button type="button" data-pos-delta="1" data-id="'+esc(id)+'" aria-label="Добавить">＋</button></div></div>').join(''):'<p>Добавьте хотя бы один товар.</p>';$('posTotal').textContent=money(amount());const jump=$('posCartJump');if(jump){jump.hidden=!cart.size||currentTab!=='pos'||basketInView;jump.textContent='К оплате · '+[...cart.values()].reduce((n,x)=>n+x.quantity,0)+' шт. · '+money(amount());}paymentFields();}
function paymentFields(){const cash=$('posMethod').value==='cash',received=Number($('posCash').value);$('posCashLabel').hidden=!cash;$('posCash').required=cash;$('posSubmit').disabled=busy||!cart.size||[...cart].some(([id,x])=>x.quantity>(available().find(p=>p.id===id)?.available||0));$('posSubmit').textContent=cash?'Пробить и отметить оплату':'Создать заказ · Показать QR';$('posChange').textContent=cash&&$('posCash').value?(received<amount()?'Недостаточно: '+money(amount()-received):'Сдача: '+money(received-amount())):'';}
function showSale(order,payment=null){sale=order;$('posReceipt').hidden=false;$('posOrderNumber').textContent='Заказ №'+order.orderNumber+' · '+money(order.totalVnd);$('posQr').replaceChildren();const pending=order.paymentStatus!=='paid'&&!['cancelled','completed'].includes(order.status);$('posConfirmQr').hidden=!(pending&&order.paymentMethod==='qr');$('posShowScreen').hidden=!screen();if(pending&&payment)drawQr($('posQr'),payment.qrPayload);$('posPaymentHint').textContent=order.paymentStatus==='paid'?'✓ Оплачено. Соберите и выдайте заказ по номеру.':order.paymentMethod==='qr'?'Сумма уже в QR. Подтвердите оплату после фактического поступления денег.':'Заказ создан, оплата не подтверждена. Примите деньги в разделе «Касса → Ждут оплаты».';}
async function sell(event){event.preventDefault();if(busy||!cart.size)return;const cash=$('posMethod').value==='cash',due=amount(),received=Number($('posCash').value);if(cash&&(!$('posCash').value||!Number.isSafeInteger(received)||received<due)){$('posResult').textContent='Введите полученную сумму не меньше '+money(due);return;}busy=true;paymentFields();$('posResult').textContent='Создаём заказ…';let created=null;
try{
const response=await window.ummaCafeRequests.request(base+'create-cafe-order',{initData:auth.credential(),staffOrder:true,locationId:$('posLocation').value,items:[...cart].map(([productId,x])=>({productId,quantity:x.quantity})),orderType:'pickup',paymentMethod:cash?'cash':'qr',paymentTiming:'now',customerName:'Гость',customerPhone:'',customerNote:'',dispatchMode:'nearest'});const data=await response.json();if(!response.ok||!data.ok||!data.order)throw Error(data.error||'Заказ не подтверждён');
created={...data.order,paymentMethod:cash?'cash':'qr',paymentStatus:'pending'};
// The order has committed: clear the cart before any secondary action can fail.
cart.clear();$('posCash').value='';renderCart();showSale(created);
if(cash){if(Number(created.totalVnd)!==due)throw Error('Цена изменилась. Проверьте итог в заказе и примите оплату в разделе «Касса → Ждут оплаты».');await api('updatePayment',{orderId:created.id,paymentStatus:'paid',paymentMethod:'cash',tenderedAmountVnd:received,changeGivenVnd:received-Number(created.totalVnd)},'cafe-kitchen');created.paymentStatus='paid';showSale(created);$('posResult').textContent='Оплачено · Получено '+money(received)+' · Сдача '+money(received-Number(created.totalVnd));}
else{const {payment}=await api('payment',{orderId:created.id});showSale(created,payment);$('posResult').textContent='Заказ создан. Ожидаем перевод по QR.';}
try{if(screen())await displayOrder(created.id);}catch{notice('Продажа сохранена, но планшет не обновился. Нажмите «Показать на планшете» повторно.');}
}catch(e){$('posResult').textContent=(created?'Заказ №'+created.orderNumber+' уже создан. Не пробивайте повторно. ':'')+e.message;}
finally{busy=false;paymentFields();}}
$('posForm').onsubmit=sell;$('posMethod').onchange=paymentFields;$('posCash').oninput=paymentFields;$('posSearch').oninput=menu;
$('posLocation').onchange=()=>{cart.clear();sale=null;$('posReceipt').hidden=true;renderCart();menu();showPair(screen());if(openKitchen)window.ummaKitchen.rerender?.();};
$('posProducts').onclick=e=>{const b=e.target.closest('[data-pos-add]');if(!b||busy)return;const p=available().find(x=>x.id===b.dataset.posAdd);if(!p)return;const x=cart.get(p.id)||{product:p,quantity:0};if(x.quantity>=Math.min(99,p.available))return;x.quantity++;cart.set(p.id,x);renderCart();};
$('posCart').onclick=e=>{const b=e.target.closest('[data-pos-delta]');if(!b||busy)return;const x=cart.get(b.dataset.id);if(!x)return;const qty=x.quantity+Number(b.dataset.posDelta);if(qty>Math.min(99,x.product.available))return;if(qty<=0)cart.delete(b.dataset.id);else x.quantity=qty;renderCart();};
$('posConfirmQr').onclick=async()=>{if(busy||!sale)return;busy=true;$('posConfirmQr').disabled=true;try{await api('updatePayment',{orderId:sale.id,paymentStatus:'paid',paymentMethod:'qr'},'cafe-kitchen');sale.paymentStatus='paid';showSale(sale);$('posResult').textContent='Оплата подтверждена. Заказ передан на сборку.';}catch(e){$('posResult').textContent=e.message;}finally{busy=false;$('posConfirmQr').disabled=false;}};
$('posShowScreen').onclick=()=>displayOrder(sale?.id).catch(e=>notice(e.message));
$('screenPair').onclick=async()=>{if(busy)return;busy=true;$('screenPair').disabled=true;try{const old=screen();if(old)await api('screenRevoke',{screenId:old.id});const d=await api('screenCreate',{locationId:$('posLocation').value});const value={id:d.id,token:d.screenToken};localStorage.setItem(screenKey(),JSON.stringify(value));showPair(value);if(sale)await displayOrder(sale.id);}catch(e){$('screenPairState').textContent=e.message;}finally{busy=false;$('screenPair').disabled=false;}};
$('screenUnpair').onclick=async()=>{const s=screen();if(!s)return;try{await api('screenRevoke',{screenId:s.id});localStorage.removeItem(screenKey());showPair(null);$('screenPairState').textContent='Планшет отключён.';}catch(e){$('screenPairState').textContent=e.message;}};
let staffLoading;
function filterStaff(){
 const query=$('webStaffSearch').value.trim().toLocaleLowerCase('ru');
 const cards=[...$('webStaffList').querySelectorAll('.staff-account')];
 for(const card of cards)card.hidden=!card.querySelector('.staff-access-copy').textContent.toLocaleLowerCase('ru').includes(query);
 $('webStaffNoMatch').hidden=!cards.length||cards.some(card=>!card.hidden);
}
$('webStaffSearch').oninput=filterStaff;
const roleNames={kitchen_cashier:'Кассир-кухня',kitchen:'Кухня',cashier:'Кассир',courier:'Курьер',manager:'Менеджер'};
const accessNames={active:'Подключён · вход создан',invited:'Ожидает регистрации по приглашению',expired:'Приглашение истекло',not_created:'Веб-доступ ещё не создан',disabled:'Доступ отключён'};
function staffList(){
 if(staffLoading)return staffLoading;
 staffLoading=(async()=>{const d=await api('staffList'),employees=d.employees||d.accounts.map(a=>({...a,name:a.login,status:a.active?'active':'disabled',assignments:[]}));$('webStaffList').innerHTML=employees.map(a=>'<article class="staff-account" data-staff-status="'+esc(a.status)+'">'+expiredInviteButton(a)+'<div class="staff-access-copy"><strong>'+esc(a.name)+'</strong><p>'+esc(a.assignments.map(s=>(roleNames[s.staff_role==='kitchen'&&s.can_accept_payments?'kitchen_cashier':s.staff_role]||s.staff_role)+' · '+s.locationName).join('; ')||'Веб-доступ')+'</p><p class="staff-access-state">'+esc(accessNames[a.status])+'</p>'+(a.login?'<small>Логин: '+esc(a.login)+'</small>':'<small>Сотрудник должен открыть приглашение на своём телефоне и задать логин и пароль.</small>')+'</div>'+a.assignments.map(s=>'<div class="staff-role-editor"><label>Роль · '+esc(s.locationName)+'<select data-staff-role-select="'+a.actor_id+'" data-location="'+esc(s.location_id)+'">'+Object.entries(roleNames).map(([value,label])=>'<option value="'+value+'"'+(value===(s.staff_role==='kitchen'&&s.can_accept_payments?'kitchen_cashier':s.staff_role)?' selected':'')+'>'+label+'</option>').join('')+'</select></label><button type="button" data-save-staff-role="'+a.actor_id+'" data-location="'+esc(s.location_id)+'">Сохранить роль</button></div>').join('')+(['invited','expired','not_created'].includes(a.status)?'<button type="button" data-reinvite-staff="'+a.actor_id+'" data-staff-name="'+esc(a.name)+'">Получить ссылку приглашения</button>':a.status==='active'&&Number(a.actor_id)!==auth.actorId()?'<button type="button" data-disable-staff="'+a.actor_id+'">Отключить</button>':'')+'</article>').join('')||'<p>Сотрудников пока нет. Создайте приглашение выше.</p>';filterStaff();$('webStaffStatus').textContent='Сотрудников в списке: '+employees.length;
 })().finally(()=>{staffLoading=null;});
 return staffLoading;
}
function expiredInviteButton(employee){
 if(employee.status!=='expired'||!employee.inviteExpiresAt)return '';
 return '<button type="button" class="staff-dismiss-expired" data-dismiss-expired-invite="'+esc(employee.actor_id)+'" data-invite-expires="'+esc(employee.inviteExpiresAt)+'" aria-label="Убрать истёкшее приглашение — '+esc(employee.name)+'" title="Убрать истёкшее приглашение"><span aria-hidden="true">×</span></button>';
}
function showInvite(token,name){$('webInvitePanel').open=true;const url=new URL('staff.html',location.href);url.hash=new URLSearchParams({invite:token});$('webInviteLink').href=url.href;$('webInviteLink').textContent='Открыть приглашение для '+name;$('webInviteLink').hidden=false;$('webInviteCopy').hidden=false;$('webInviteResult').textContent='Передайте ссылку сотруднику: он открывает её на своём телефоне и создаёт логин и пароль. Для проверки на вашем телефоне откройте ссылку в режиме «Инкогнито», чтобы сохранить вход владельца. Ссылка действует 48 часов и используется один раз.';}
$('webStaffList').onclick=async e=>{const b=e.target.closest('[data-disable-staff],[data-reinvite-staff],[data-save-staff-role],[data-dismiss-expired-invite]');if(!b)return;b.disabled=true;try{if(b.dataset.dismissExpiredInvite){await api('staffDismissExpiredInvite',{actorId:Number(b.dataset.dismissExpiredInvite),inviteExpiresAt:b.dataset.inviteExpires});await staffLoading?.catch(()=>{});}else if(b.dataset.saveStaffRole){const select=[...$('webStaffList').querySelectorAll('[data-staff-role-select]')].find(s=>s.dataset.staffRoleSelect===b.dataset.saveStaffRole&&s.dataset.location===b.dataset.location);await api('staffRoleUpdate',{actorId:Number(b.dataset.saveStaffRole),locationId:b.dataset.location,role:select.value});}else if(b.dataset.reinviteStaff){const d=await api('inviteExisting',{actorId:Number(b.dataset.reinviteStaff)});showInvite(d.invite,b.dataset.staffName);$('webInviteResult').scrollIntoView({behavior:'smooth',block:'center'});}else await api('staffDisable',{actorId:Number(b.dataset.disableStaff)});await staffList();}catch(err){$('webStaffStatus').textContent=err.message;b.disabled=false;}};
$('webStaffList').onchange=e=>{if(e.target.matches('[data-staff-role-select]'))e.target.dataset.roleDirty='true';};
$('webStaffRefresh').onclick=()=>void staffList().catch(e=>$('webStaffStatus').textContent=e.message);
$('webInviteForm').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;try{const d=await api('inviteStaff',{name:$('webStaffName').value,locationId:$('webStaffLocation').value,role:$('webStaffRole').value});showInvite(d.invite,$('webStaffName').value);await staffList();}catch(err){$('webInviteResult').textContent=err.message;}finally{button.disabled=false;}};
setInterval(()=>{if(me?.user.role==='super_admin'&&currentTab==='admin'&&!document.hidden&&!$('webStaffList').querySelector('[data-role-dirty]')&&!$('webStaffList').contains(document.activeElement))void staffList().catch(e=>$('webStaffStatus').textContent=e.message);},10000);
function tab(name){
 const cash=name==='pos'||name==='cashOrders';
 const counter=name==='pos'&&openKitchen;
 const nav=document.querySelector('[data-web-tab="'+(cash?'pos':name)+'"]');
 if(!nav||nav.hidden)return;
 currentTab=name;notice('');
 document.body.dataset.workspace=name;
 $('posCartJump').hidden=name!=='pos'||!cart.size||basketInView;
 document.querySelector('.web-account-menu')?.removeAttribute('open');
 $('webPos').hidden=name!=='pos';$('webAdmin').hidden=name!=='admin';
 $('webMessages').hidden=name!=='messages';
 $('webCashViews').hidden=!cash;
 $('cafeKitchenPage').hidden=!counter&&!['cashOrders','orders','courier'].includes(name);
 document.querySelectorAll('[data-web-tab]').forEach(b=>b.setAttribute('aria-current',String(b===nav)));
 document.querySelectorAll('[data-cash-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.cashView===name)));
 if(!$('cafeKitchenPage').hidden)window.ummaKitchen.open(name==='courier',name==='cashOrders'?'payment':'active');
 document.dispatchEvent(new CustomEvent('umma:staff-tab',{detail:name}));
 if(name==='admin')void staffList().catch(e=>$('webStaffStatus').textContent=e.message);
}
document.querySelectorAll('[data-web-tab],[data-cash-view]').forEach(b=>b.onclick=()=>{
 tab(b.dataset.webTab||b.dataset.cashView);window.scrollTo({top:0,behavior:'instant'});
});
$('counterOpenOrders').onclick=()=>{tab('orders');window.scrollTo({top:0,behavior:'instant'});};
$('webCashShift').onclick=()=>{
 if(currentTab!=='cashOrders')tab('cashOrders');
 const panel=$('cafeCashPanel');
 if(panel?.hidden)$('cafeCashToggle').click();
 else panel?.scrollIntoView({behavior:'smooth',block:'start'});
};
$('webInviteCopy')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('webInviteLink').href);$('webInviteResult').textContent='Приглашение скопировано. Передайте его сотруднику.';}catch{$('webInviteResult').textContent='Нажмите и удерживайте ссылку приглашения, затем выберите «Копировать ссылку».';}});
function syncWorkKeyboard(){const viewport=window.visualViewport;const field=document.activeElement;const editing=field&&/^(INPUT|TEXTAREA|SELECT)$/.test(field.tagName);const closedHeight=document.documentElement.clientHeight||window.innerHeight;document.body.classList.toggle('work-keyboard-open',Boolean(viewport&&editing&&closedHeight-viewport.height>140));}
window.visualViewport?.addEventListener('resize',syncWorkKeyboard);document.addEventListener('focusin',syncWorkKeyboard);document.addEventListener('focusout',()=>document.body.classList.remove('work-keyboard-open'));
if('IntersectionObserver'in window&&$('posBasket')){const basketObserver=new IntersectionObserver(entries=>{basketInView=entries[0].isIntersecting;const jump=$('posCartJump');if(jump)jump.hidden=!cart.size||currentTab!=='pos'||basketInView;},{threshold:0.15});basketObserver.observe($('posBasket'));}
$('posCartJump')?.addEventListener('click',()=>$('posBasket').scrollIntoView({behavior:'smooth',block:'start'}));
$('posBackToProducts')?.addEventListener('click',()=>{$('posSearch').scrollIntoView({behavior:'smooth',block:'start'});$('posSearch').focus({preventScroll:true});});
$('webLogout').onclick=async()=>{try{await api('logout');}catch{}auth.clear();location.replace(new URL('staff.html',location.href));};
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});$('webInstall').onclick=async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null;}else notice('В меню браузера выберите «Установить приложение» или «Добавить на главный экран». В Safari: «Поделиться» → «На экран Домой».');};
async function boot(){me=await api('me');window.ummaCafeEpoch?.apply(me.cafeResetEpoch);auth.setActor(Number(me.user.id));window.ummaRole=me.user.role;window.ummaUser=me.user;$('webIdentity').textContent=me.user.name||'Сотрудник';$('webLogin').hidden=true;$('webLogout').hidden=false;
const owner=me.user.role==='super_admin',roles=me.assignments||[],sell=owner||roles.some(a=>['cashier','manager','kitchen'].includes(a.staff_role)&&a.can_accept_payments),courier=owner||roles.some(a=>a.staff_role==='courier'),kitchen=owner||roles.some(a=>a.staff_role!=='courier');
const stockLocations=me.locations.filter(l=>owner||roles.some(a=>a.location_id===l.id&&['kitchen','manager'].includes(a.staff_role)));
$('webStockLink').hidden=requested==='stock'||!stockLocations.length;
if(requested==='stock'){
 currentTab='stock';
 document.body.dataset.workspace='stock';
 $('webWorkspace').hidden=true;
 $('webIngredients').hidden=!stockLocations.length;
 $('webStockDenied').hidden=!!stockLocations.length;
 if(stockLocations.length)document.dispatchEvent(new CustomEvent('umma:ingredient-stock-open',{detail:stockLocations}));
 return;
}
$('webWorkspace').hidden=false;
openKitchen=owner||roles.some(a=>['kitchen','manager'].includes(a.staff_role)&&a.can_accept_payments);
$('counterIncoming').hidden=!openKitchen;
if(openKitchen){
  document.querySelector('[data-web-tab="pos"] span').textContent='Стойка';
  document.querySelector('[data-web-tab="orders"] span').firstChild.textContent='Заказы ';
  $('posHeading').textContent='Новый заказ со стойки';
}
for(const [name,allowed]of [['pos',sell],['orders',kitchen],['courier',courier],['admin',owner],['messages',owner]])document.querySelector('[data-web-tab="'+name+'"]').hidden=!allowed;
const options=(sell&& !owner?me.locations.filter(l=>roles.some(a=>a.location_id===l.id&&['cashier','manager','kitchen'].includes(a.staff_role)&&a.can_accept_payments)):me.locations).map(l=>'<option value="'+esc(l.id)+'">'+esc(l.name)+'</option>').join('');$('posLocation').innerHTML=options;$('webStaffLocation').innerHTML=me.locations.map(l=>'<option value="'+esc(l.id)+'">'+esc(l.name)+'</option>').join('');
document.body.classList.toggle('work-owner',owner);
document.dispatchEvent(new CustomEvent('umma:staff-ready',{detail:me}));
tab(owner&&requested==='messages'?'messages':openKitchen?'pos':!owner&&roles.some(a=>a.staff_role==='kitchen')?'orders':sell?'pos':courier?'courier':'orders');
if(sell){
 try{
  const r=await fetch(base+'cafe-menu',{signal:AbortSignal.timeout(15000)}),d=await r.json();
  if(!r.ok||!d.ok)throw Error('Не удалось загрузить меню');
  products=(d.products||[]).filter(p=>p.is_active!==false&&p.price_vnd!=null&&!p.catalog_preview&&!p.photo_only);
  inventory=d.inventory||[];stockControl=d.inventoryControlEnabled===true;renderCart();menu();showPair(screen());
 }catch(error){$('posProducts').textContent=error.message+'. Обновите страницу для повторной загрузки.';}
}
}
$('webLoginForm').onsubmit=async e=>{e.preventDefault();$('webLoginSubmit').disabled=true;$('webLoginSubmit').textContent=invite?'Создаём доступ…':'Входим…';$('webLoginError').textContent='';try{const d=await api(invite?'activate':'login',{login:$('webLoginName').value,password:$('webPassword').value,...(invite?{invite}:{})});auth.save(d.token);history.replaceState(null,'',location.pathname+location.search);$('webPassword').value='';await boot();}catch(err){$('webLoginError').textContent=err.message;}finally{$('webLoginSubmit').disabled=false;$('webLoginSubmit').textContent=invite?'Создать доступ':'Войти';}};
// Recovered creation is shown as pending; a cashier still needs to confirm the actual payment.
document.addEventListener('umma:cafe-operation-recovered',async e=>{if(!e.detail.payload.staffOrder)return;for(const x of cart.values()){const row=inventory.find(i=>i.product_id===x.product.id&&i.location_id===$('posLocation').value);if(row)row.reserved_quantity=Number(row.reserved_quantity||0)+x.quantity;}cart.clear();renderCart();const o={...e.detail.result.order,paymentMethod:e.detail.payload.paymentMethod,paymentStatus:'pending'};showSale(o);if(o.paymentMethod==='qr'){const d=await api('payment',{orderId:o.id});showSale(o,d.payment);}notice('Прежний заказ восстановлен. Проверьте оплату в разделе «Касса → Ждут оплаты».');});
let stockRefreshing=false;async function refreshStock(){if(!me||stockRefreshing||busy||document.hidden||currentTab!=='pos')return;stockRefreshing=true;try{const r=await fetch(base+'cafe-menu',{cache:'no-store',signal:AbortSignal.timeout(12000)}),d=await r.json();if(r.ok&&d.ok){inventory=d.inventory||[];menu();paymentFields();}}catch{}finally{stockRefreshing=false;}}document.addEventListener('umma:stock-changed',()=>void refreshStock());setInterval(()=>void refreshStock(),5000);
async function reconcile(){if(!me||refreshing||busy||document.hidden||currentTab!=='pos'||!sale)return;refreshing=true;try{const d=await api('list',{},'cafe-kitchen');const o=d.orders.find(o=>o.id===sale.id);if(o&&(o.payment_status!==sale.paymentStatus||o.status!==sale.status)){const next={...sale,paymentStatus:o.payment_status,status:o.status};let payment=null;if(next.paymentStatus==='pending'&&next.paymentMethod==='qr'&&!['cancelled','completed'].includes(next.status)){payment=(await api('payment',{orderId:next.id})).payment;}showSale(next,payment);}}catch{}finally{refreshing=false;}}
setInterval(()=>void reconcile(),5000);if(auth.credential()&&!invite)void boot().catch(e=>{$('webLoginError').textContent=e.message;notice(e.message);if(e.status===401)auth.clear();});
})();
