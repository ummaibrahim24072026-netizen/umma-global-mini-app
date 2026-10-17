/* UMMA Stock & Scan — staff warehouse workspace; transactional server operations only. */
(() => {
 'use strict';
 const endpoint='https://zwzojugspldexyyljwpr.supabase.co/functions/v1/market-stock';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const text=(ru,en,vi)=>{const l=window.ummaI18n?.locale?.()||document.documentElement.lang||'ru';return l.startsWith('vi')?vi:l.startsWith('en')?en:ru;};
 const money=v=>new Intl.NumberFormat('vi-VN',{maximumFractionDigits:0}).format(Number(v)||0)+' ₫';
 const page=document.createElement('section');page.id='marketPage';page.hidden=true;page.className='market-page native-screen';
 page.innerHTML=`<header class="market-header"><button type="button" id="marketBack" class="cafe-back">← ${text('Назад','Back','Quay lại')}</button><div><small>UMMA STOCK & SCAN</small><h1>UMMA Market</h1></div><button type="button" data-market-action="refresh" aria-label="Refresh">↻</button></header><div id="marketStatus" role="status" aria-live="polite"></div><div id="marketWorkspace"></div>`;
 document.querySelector('.app')?.append(page);
 let boot=null,state=null,warehouse=null,tab='overview',busy=false,cameraControls=null,scanDialog=null;
 const selectedUnits=new Set(), pending=new Map();
 const status=(msg,bad=false)=>{const el=page.querySelector('#marketStatus');el.textContent=msg;el.className=bad?'market-error':'market-status';};
 const api=async(action,data={},key)=>{
  if(window.ummaMarketApi)return window.ummaMarketApi.call(action,data,key);
  const initData=window.Telegram?.WebApp?.initData;if(!initData)throw new Error(text('Откройте приложение через Telegram','Open the app in Telegram','Mở ứng dụng trong Telegram'));
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);
  try{const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({initData,action,data,request_id:key}),signal:controller.signal});const result=await response.json();if(!response.ok||!result.ok){const e=new Error(result.error||'Market request failed');e.confirmed=true;throw e;}return result;}finally{clearTimeout(timeout);}
 };
 // Keep the same key after an uncertain network response. Repeated submits cannot duplicate stock.
 const mutate=async(action,data)=>{
  const payload={warehouse_id:warehouse,...data},identity=JSON.stringify([action,payload]);
  let key=pending.get(identity);if(!key){key=crypto.randomUUID();pending.set(identity,key);}
  try{const result=await api(action,payload,key);pending.delete(identity);return result;}catch(e){if(e.confirmed)pending.delete(identity);throw e;}
 };
 const variant=id=>state?.variants.find(v=>v.id===id);
 const product=id=>variant(id)?.products||{};
 const name=id=>{const p=product(id);return window.ummaI18n?.field?.(p,'name')||p.name_ru||p.name_en||p.name_vi||id;};
 const batchName=b=>name(b.variant_id)+' · '+b.batch_number;
 const quantity=(q,v)=>v?.measure==='g'?(Number(q)/1000).toLocaleString(undefined,{maximumFractionDigits:3})+' kg':q+' '+text('шт.','pcs','cái');
 const rawQuantity=q=>String(q??0);
 const unitBatch=u=>state.batches.find(b=>b.id===u.batch_id);
 const isBlocked=(b,u)=>b?.status!=='available'||u&&u.status!=='available'||Boolean(b?.expires_on&&b.expires_on<new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));
 const can=(...roles)=>state?.roles?.includes('admin')||roles.some(r=>state?.roles?.includes(r));
 const btn=(action,label,attrs='')=>`<button type="button" data-market-action="${action}" ${attrs}>${esc(label)}</button>`;
 const field=(label,name,type='text',extra='')=>`<label>${esc(label)}<input name="${name}" type="${type}" ${extra}></label>`;
 const select=(label,name,options,extra='')=>`<label>${esc(label)}<select name="${name}" ${extra}>${options}</select></label>`;
 const options=(list,value,label)=>list.map(x=>`<option value="${esc(value(x))}">${esc(label(x))}</option>`).join('');
 const variantOptions=()=>options(state.variants.filter(v=>v.is_active),v=>v.id,v=>name(v.id)+' · '+v.measure);
 const batchOptions=()=>options(state.batches,b=>b.id,b=>batchName(b)+' · '+quantity(b.raw_quantity,variant(b.variant_id))+' · '+b.status);
 const form=(action,body,submit)=>`<form data-market-form="${action}" class="market-form">${body}<button type="submit" class="market-primary">${esc(submit)}</button></form>`;
 const docTitle=d=>`#${d.number} · ${d.kind} · ${d.status}`;
 function render(){
  const workspace=page.querySelector('#marketWorkspace');
  if(!boot){workspace.replaceChildren();return;}
  const top=`<div class="market-toolbar">${select(text('Склад','Warehouse','Kho'),'warehouse',options(boot.warehouses,w=>w.id,w=>w.name))}${(boot.isSuperAdmin||can('admin'))?btn('warehouse_create',text('Добавить склад','Add warehouse','Thêm kho')):''}</div>`;
  if(!state){workspace.innerHTML=top+`<p>${esc(text('Нет доступных складов. Администратор может создать первый склад.','No accessible warehouses. An administrator can create one.','Chưa có kho. Quản trị viên có thể tạo kho.'))}</p>`;return;}
  const tabs=[['orders','Заказы и сборка','Orders & picking','Đơn hàng & soạn'],['overview','Остатки','Stock','Tồn kho'],['products','Товары','Products','Sản phẩm'],['receive','Приёмка','Receiving','Nhập kho'],['pack','Фасовка','Packing','Đóng gói'],['control','Контроль','Stock control','Kiểm soát'],['count','Инвентаризация','Stocktake','Kiểm kê'],['labels','Этикетки','Labels','Nhãn'],['history','История','History','Lịch sử'],['supplies','Поставки','Supplies','Đơn nhập'],['transfers','Перемещения','Transfers','Chuyển kho'],['returns','Возвраты','Returns','Trả hàng'],['analytics','Отчёты','Reports','Báo cáo'],['cash','Касса','Cash','Quỹ'],['settings','Настройки','Settings','Cài đặt']];
  workspace.innerHTML=top+`<nav class="market-tabs" aria-label="Market">${tabs.map(([id,ru,en,vi])=>`<button type="button" data-market-tab="${id}" aria-current="${id===tab?'page':'false'}">${esc(text(ru,en,vi))}</button>`).join('')}</nav><div class="market-tools">${btn('scan',text('Сканировать код','Scan code','Quét mã'))}<span>${esc(text('Вес вводится в целых граммах. Деньги — в VND.','Enter weight in whole grams; money in VND.','Nhập trọng lượng bằng gam nguyên; tiền bằng VND.'))}</span></div><div id="marketBody"></div>`;
  workspace.querySelector('[name="warehouse"]').value=warehouse;
  let html='';
  if(tab==='overview'){
   const units=state.units.filter(u=>u.status!=='written_off'),cost=state.batches.reduce((s,b)=>s+Number(b.raw_cost_vnd||0),0)+units.reduce((s,u)=>s+Number(u.cost_vnd||0),0);
   html=`<div class="market-metrics"><article><small>${esc(text('Стоимость запасов','Stock at cost','Giá trị tồn kho'))}</small><strong>${state.financial?money(cost):'—'}</strong></article><article><small>${esc(text('Упаковок','Packages','Gói hàng'))}</small><strong>${units.length}</strong></article><article><small>${esc(text('Проверка и сроки','Blocked batches','Lô bị chặn'))}</small><strong>${state.batches.filter(b=>isBlocked(b)).length}</strong></article></div>`;
   html+=state.batches.map(b=>`<article class="market-card"><div><h3>${esc(batchName(b))}</h3><p>${esc(text('Нерасфасовано','Unpacked','Chưa đóng gói'))}: <strong>${esc(quantity(b.raw_quantity,variant(b.variant_id)))}</strong></p><p>${esc(b.storage_place||'—')} · ${esc(b.expires_on||'—')}</p></div><span class="market-badge ${isBlocked(b)?'blocked':''}">${esc(isBlocked(b)?text('Заблокировано','Blocked','Bị chặn'):text('Доступно','Available','Có sẵn'))}</span></article>`).join('')||`<p>${esc(text('Товар ещё не принят.','No stock received yet.','Chưa nhập hàng.'))}</p>`;
  } else if(tab==='products'){
   html=state.variants.map(v=>`<article class="market-card"><div><h3>${esc(name(v.id))}</h3><p>${esc(v.sale_mode)} · ${esc(v.measure)} · ${money(v.products?.price_vnd)}</p></div></article>`).join('');
   if(can('admin'))html+=`<details class="market-card" open><summary>${esc(text('Новый товар','New product','Sản phẩm mới'))}</summary>${form('product_create',select(text('Категория','Category','Danh mục'),'category_id','<option value="">—</option>'+options(state.categories||[],c=>c.id,c=>c.name_ru),'required')+field('Название RU','name_ru','text','required maxlength="160"')+field('Name EN','name_en','text','maxlength="160"')+field('Tên VI','name_vi','text','maxlength="160"')+select(text('Способ продажи','Sale mode','Hình thức bán'),'sale_mode',options([{id:'piece',n:'Поштучно / Piece'},{id:'set',n:'Набор / Set'},{id:'fixed_weight',n:'Фиксированный вес / Fixed weight'},{id:'individual_weight',n:'Индивидуальный вес / Individual weight'}],x=>x.id,x=>x.n))+select(text('Базовая единица','Base unit','Đơn vị cơ bản'),'measure','<option value="g">g</option><option value="pcs">pcs</option>')+field('VND','price_vnd','number','required min="0" step="1"')+field(text('Размер упаковки (г / шт.)','Pack size (g / pcs)','Khối lượng gói (g / cái)'),'fixed_quantity','number','min="1" step="1"')+field(text('Заводской штрих-код','Manufacturer barcode','Mã vạch nhà sản xuất'),'barcode')+field('Описание / состав RU','description_ru')+field('Description / ingredients EN','description_en')+field('Mô tả / thành phần VI','description_vi')+field('Фото URL (HTTPS)','image_url','url')+field(text('Условия хранения','Storage conditions','Điều kiện bảo quản'),'storage_conditions')+field(text('Основание халяльности','Halal evidence','Chứng nhận halal'),'halal_evidence'),text('Создать товар','Create product','Tạo sản phẩm'))}</details>`;
  if(can('admin'))html+=form('barcode_link',select(text('Существующий товар','Existing product','Sản phẩm hiện có'),'variant_id',variantOptions())+field(text('Заводской штрих-код','Manufacturer barcode','Mã vạch nhà sản xuất'),'code','text','required maxlength="128"'),text('Связать код с товаром','Link barcode','Liên kết mã vạch'));
  } else if(tab==='receive'){
   if(can('receiver'))html=form('receive',select(text('Поставщик','Supplier','Nhà cung cấp'),'supplier_id',options(state.suppliers,s=>s.id,s=>s.name),'required')+btn('supplier_create',text('Добавить поставщика','Add supplier','Thêm nhà cung cấp'))+select(text('Товар','Product','Sản phẩm'),'variant_id',variantOptions(),'required')+field(text('План (г / шт.)','Planned (g / pcs)','Dự kiến (g / cái)'),'planned_quantity','number','required min="1" step="1"')+field(text('Принято (г / шт.)','Accepted (g / pcs)','Thực nhận (g / cái)'),'quantity','number','required min="1" step="1"')+field(text('Закупочная стоимость всей строки VND','Total line cost VND','Tổng giá mua VND'),'cost_vnd','number','required min="0" step="1"')+field(text('Номер партии','Batch number','Số lô'),'batch_number','text','required')+field(text('Срок годности','Expiry date','Hạn sử dụng'),'expires_on','date')+field(text('Место хранения','Storage place','Vị trí lưu trữ'),'storage_place')+select(text('Контроль качества','Quality check','Kiểm tra chất lượng'),'quality',`<option value="quarantine">${esc(text('Карантин: требуется проверка','Quarantine: check required','Cách ly: cần kiểm tra'))}</option><option value="passed">${esc(text('Проверка пройдена','Passed','Đã đạt'))}</option>`)+field(text('Температура °C','Temperature °C','Nhiệt độ °C'),'temperature_c','number','step="0.1"')+field(text('Происхождение','Provenance','Nguồn gốc'),'provenance')+field(text('Халяль-документ / путь','Halal document / path','Tài liệu halal / đường dẫn'),'halal_document')+field(text('Примечание','Notes','Ghi chú'),'notes'),text('Подтвердить приёмку','Receive stock','Xác nhận nhập kho'));
  } else if(tab==='pack'){
   if(can('packer'))html=form('pack',select(text('Исходная партия','Source batch','Lô nguồn'),'batch_id',batchOptions(),'required')+`<label>${esc(text('Точный вес / количество каждой упаковки — через запятую','Exact quantity of every package, comma separated','Số lượng chính xác mỗi gói, cách nhau bằng dấu phẩy'))}<textarea name="quantities" placeholder="1000, 1000, 500" required></textarea></label>`+field(text('Остаток нерасфасованного (г / шт.)','Unpacked remainder (g / pcs)','Phần còn lại (g / cái)'),'remaining_quantity','number','required min="0" step="1"')+field(text('Потери (г / шт.)','Loss (g / pcs)','Hao hụt (g / cái)'),'loss_quantity','number','value="0" min="0" step="1"')+`<p>${esc(text('Баланс: исходное количество = упаковки + остаток. Потери сначала оформляются подтверждённым списанием.','Balance: source = packages + remainder. Record and approve any loss before packing.','Cân bằng: nguồn = các gói + phần còn lại. Ghi nhận và duyệt hao hụt trước khi đóng gói.'))}</p>`,text('Расфасовать и создать QR','Pack and create QR codes','Đóng gói và tạo mã QR'));
  } else if(tab==='control'){
   if(can('warehouse'))html=form('writeoff_request',select(text('Партия','Batch','Lô'),'batch_id',batchOptions(),'required')+field(text('ID упаковки (пусто — нерасфасованный товар)','Package ID (blank for unpacked stock)','ID gói (để trống cho hàng chưa đóng gói)'),'unit_id')+field(text('Количество (г / шт.)','Quantity (g / pcs)','Số lượng (g / cái)'),'quantity','number','min="1" step="1"')+field(text('Причина','Reason','Lý do'),'reason','text','required maxlength="1000"'),text('Отправить списание на проверку','Request writeoff approval','Gửi yêu cầu hủy hàng'));
   if(can('warehouse'))html+=form('quarantine',select(text('Партия','Batch','Lô'),'batch_id',batchOptions())+field(text('Причина карантина','Quarantine reason','Lý do cách ly'),'reason','text','required'),text('Перевести в карантин','Quarantine','Cách ly'));
   if(can('admin'))html+=form('release',select(text('Партия','Batch','Lô'),'batch_id',batchOptions())+field(text('Результат проверки','Inspection result','Kết quả kiểm tra'),'reason','text','required')+field('Temperature °C','temperature_c','number','step="0.1"')+field('Provenance','provenance')+field('Halal document / path','halal_document'),text('Разрешить продажу после проверки','Release after inspection','Cho phép bán sau kiểm tra'));
   html+=state.documents.filter(d=>d.kind==='writeoff'&&d.status==='pending').map(d=>`<article class="market-card"><div><h3>${esc(docTitle(d))}</h3><p>${esc(d.reason)}</p><p>${esc(d.payload.quantity)} · ${esc(d.payload.unit_id||d.payload.batch_id)}</p></div>${can('admin')?btn('writeoff_approve',text('Подтвердить','Approve','Duyệt'),`data-id="${d.id}"`)+btn('writeoff_reject',text('Отклонить','Reject','Từ chối'),`data-id="${d.id}"`):''}</article>`).join('');
  } else if(tab==='count'){
   const active=state.documents.find(d=>d.kind==='count'&&d.status==='pending');
   if(!active){if(can('warehouse'))html=btn('count_start',text('Начать инвентаризацию','Start stocktake','Bắt đầu kiểm kê'));}
   else {
    html=`<p>${esc(text('Движения склада приостановлены до завершения проверки. Считайте отдельно нерасфасованный товар и индивидуальные упаковки.','Warehouse movements are paused until the count is resolved. Count unpacked goods separately from individual packages.','Tạm dừng xuất nhập kho đến khi hoàn tất kiểm kê. Đếm riêng hàng chưa đóng gói và từng gói.'))}</p>`;
    html+=state.counts.map(c=>{const b=state.batches.find(x=>x.id===c.batch_id);return `<details class="market-card" open><summary>${esc(batchName(b))}</summary>${form('count_submit',`<input type="hidden" name="document_id" value="${active.id}"><input type="hidden" name="batch_id" value="${b.id}">`+field(text('Фактический нерасфасованный остаток (г / шт.)','Actual unpacked amount (g / pcs)','Hàng chưa đóng gói thực tế (g / cái)'),'actual_raw','number',`required min="0" step="1" value="${esc(c.actual_raw??'')}"`)+`<label>${esc(text('ID найденных упаковок (по одному в строке, можно сканировать)','Found package IDs (one per line; scan to append)','ID gói tìm thấy (mỗi dòng một ID; có thể quét)'))}<textarea name="actual_units" data-count-units="${b.id}">${esc((c.actual_units||[]).join('\n'))}</textarea></label>`+field(text('Стоимость излишка VND (только при излишке)','Surplus cost VND (only for surplus)','Giá trị hàng thừa VND (nếu có)'),'surplus_cost_vnd','number','min="0" step="1"')+btn('scan_count',text('Сканировать упаковку','Scan package','Quét gói hàng'),`data-id="${b.id}"`),text('Сохранить подсчёт партии','Save batch count','Lưu kiểm kê lô'))}</details>`;}).join('');
    if(can('admin'))html+=btn('count_approve',text('Утвердить инвентаризацию','Approve stocktake','Duyệt kiểm kê'),`data-id="${active.id}"`)+btn('count_reject',text('Отменить подсчёт','Cancel count','Hủy kiểm kê'),`data-id="${active.id}"`);
   }
  } else if(tab==='labels'){
   const units=state.units.filter(u=>u.status!=='written_off');
   html=btn('labels_all',text('Выбрать все','Select all','Chọn tất cả'))+btn('labels_preview',text('Предпросмотр этикеток','Preview labels','Xem trước nhãn'))+`<div class="market-label-options">${field('Ширина / Width mm','label_width','number','value="60" min="20" max="150"')}${field('Высота / Height mm','label_height','number','value="40" min="20" max="150"')}</div>`;
   html+=units.map(u=>{const b=unitBatch(u);return `<label class="market-card"><input type="checkbox" data-unit-select="${u.id}" ${selectedUnits.has(u.id)?'checked':''}><span><strong>${esc(name(b.variant_id))} · ${esc(quantity(u.quantity,variant(b.variant_id)))}</strong><small>${esc(u.id)}<br>${esc(b.batch_number)} · ${esc(b.expires_on||'—')}</small></span></label>`;}).join('');
  } else if(tab==='history'){
   html=state.documents.map(d=>`<article class="market-card"><div><h3>${esc(docTitle(d))}</h3><p>${esc(new Date(d.created_at).toLocaleString())} · ${esc(d.actor_telegram_id)}</p><p>${esc(d.reason||'')}</p>${d.result?.cost_vnd!=null?`<p>${money(d.result.cost_vnd)}</p>`:''}</div></article>`).join('');
  }
  page.querySelector('#marketBody').innerHTML=html||`<p>${esc(text('Нет доступных действий.','No available actions.','Không có thao tác khả dụng.'))}</p>`;
  document.dispatchEvent(new CustomEvent('umma:market-render',{detail:{tab,state,warehouse,boot}}));
 }
 async function refresh(){
  boot=await api('bootstrap');
  if(!boot.warehouses.some(w=>w.id===warehouse))warehouse=boot.warehouses[0]?.id||null;
  state=warehouse?await api('snapshot',{warehouse_id:warehouse}):null;render();
 }
 async function run(task){
  if(busy)return;busy=true;page.setAttribute('aria-busy','true');
  try{await task();}catch(e){status(e.name==='AbortError'?text('Ответ задерживается. Повторите ту же операцию: защита от дублей сохранена.','Response timed out. Retry the same operation; duplicate protection is retained.','Phản hồi quá hạn. Hãy thử lại cùng thao tác; hệ thống vẫn ngăn trùng lặp.'):e.message,true);}
  finally{busy=false;page.removeAttribute('aria-busy');}
 }
 async function open(){page.hidden=false;await run(async()=>{status(text('Загрузка склада…','Loading warehouse…','Đang tải kho…'));await refresh();status('');});}
 function closeScanner(){cameraControls?.stop();cameraControls=null;scanDialog?.querySelector('video')?.srcObject?.getTracks?.().forEach(t=>t.stop());scanDialog?.close();scanDialog?.remove();scanDialog=null;}
 async function scan(onResult){
  closeScanner();const dialog=document.createElement('dialog');scanDialog=dialog;dialog.className='market-scanner';
  dialog.innerHTML=`<h2>UMMA Scan</h2><video playsinline muted></video><p role="status"></p><form>${field(text('Код вручную','Enter code','Nhập mã'),'code','text','required maxlength="128" autocomplete="off"')}<button type="submit">${esc(text('Проверить','Verify','Kiểm tra'))}</button></form>${btn('scanner_close',text('Закрыть','Close','Đóng'))}`;
  document.body.append(dialog);dialog.showModal();let handling=false,lastCode='',lastTime=0;
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeScanner();});
  dialog.querySelector('[data-market-action="scanner_close"]').onclick=closeScanner;
  const read=async code=>{
   if(handling||(code===lastCode&&Date.now()-lastTime<1500))return;handling=true;lastCode=code;lastTime=Date.now();
   try{const result=await mutate('scan',{code});await onResult(result,code);closeScanner();}
   catch(e){dialog.querySelector('[role="status"]').textContent=e.message;handling=false;}
  };
  dialog.querySelector('form').onsubmit=e=>{e.preventDefault();read(new FormData(e.target).get('code').trim());};
  const video=dialog.querySelector('video');
  if(!navigator.mediaDevices?.getUserMedia||!window.ZXingBrowser){dialog.querySelector('[role="status"]').textContent=text('Камера недоступна. Введите код вручную.','Camera unavailable. Enter the code manually.','Không có camera. Hãy nhập mã thủ công.');return;}
  try{const reader=new window.ZXingBrowser.BrowserMultiFormatReader();const controls=await reader.decodeFromVideoDevice(undefined,video,(result)=>{if(result)read(result.getText());});if(scanDialog!==dialog)controls.stop();else cameraControls=controls;}
  catch{dialog.querySelector('[role="status"]').textContent=text('Разрешите доступ к камере или введите код вручную.','Allow camera access or enter the code manually.','Cho phép camera hoặc nhập mã thủ công.');}
 }
 async function previewLabels(){
  const ids=[...selectedUnits].filter(id=>state.units.some(u=>u.id===id&&u.status!=='written_off'));
  if(!ids.length)throw new Error(text('Выберите упаковки','Select packages','Chọn các gói'));
  const width=Number(page.querySelector('[name="label_width"]').value),height=Number(page.querySelector('[name="label_height"]').value);
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<20||width>150||height<20||height>150)throw new Error('Invalid label size');
  const labels=ids.map(id=>{const u=state.units.find(x=>x.id===id),b=unitBatch(u),v=variant(b.variant_id),qr=window.qrcode(0,'M');qr.addData('UMMA:'+u.id);qr.make();return `<article class="label"><div><b>UMMA Market</b><strong>${esc(name(b.variant_id))}</strong><span>${esc(quantity(u.quantity,v))}</span><small>${esc(u.id)}<br>Batch: ${esc(b.batch_number)}<br>Pack: ${esc(u.created_at.slice(0,10))}<br>EXP: ${esc(b.expires_on||'—')}<br>${esc(v.storage_conditions||'')}</small></div>${qr.createSvgTag({cellSize:2,margin:8,scalable:true})}</article>`;}).join('');
  const dialog=document.createElement('dialog');dialog.className='market-print-preview';dialog.innerHTML=`<h2>${esc(text('Предпросмотр этикеток','Label preview','Xem trước nhãn'))}</h2><p>${esc(text('Системная печать откроет выбор принтера. Статус «отправлено» означает передачу в диалог печати, а не подтверждение физической печати.','System printing opens printer selection. Sent means handed to the print dialog, not confirmed physical printing.','In hệ thống cho phép chọn máy in. Trạng thái gửi không xác nhận nhãn đã được in.'))}</p><iframe title="Labels" sandbox="allow-same-origin allow-modals"></iframe><button type="button" data-print>${esc(text('Печатать','Print','In'))}</button><button type="button" data-close>${esc(text('Закрыть','Close','Đóng'))}</button>`;
  document.body.append(dialog);const frame=dialog.querySelector('iframe');
  frame.srcdoc=`<!doctype html><html><head><meta charset="utf-8"><style>@page{size:${width}mm ${height}mm;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif}.label{width:${width}mm;height:${height}mm;padding:2mm;display:flex;gap:1mm;align-items:center;page-break-after:always;overflow:hidden;border:1px solid #ccc}.label>div{flex:1;min-width:0}.label b,.label strong,.label span{display:block;font-size:9pt}.label small{font-size:5.5pt;overflow-wrap:anywhere}.label svg{width:21mm;height:21mm;flex-shrink:0}@media print{.label{border:0}}</style></head><body>${labels}</body></html>`;
  dialog.showModal();dialog.querySelector('[data-close]').onclick=()=>{dialog.close();dialog.remove();};dialog.addEventListener('cancel',()=>dialog.remove());
  dialog.querySelector('[data-print]').onclick=()=>run(async()=>{const job=await mutate('print',{unit_ids:ids,width_mm:width,height_mm:height});try{frame.contentWindow.focus();frame.contentWindow.print();await mutate('print_result',{job_id:job.job_id,status:'sent'});status(text('Передано в системную печать','Sent to system print dialog','Đã gửi đến hộp thoại in hệ thống'));}catch(e){await mutate('print_result',{job_id:job.job_id,status:'failed',error:e.message});throw e;}});
 }
 page.addEventListener('change',e=>{
  if(e.target.name==='warehouse')run(async()=>{warehouse=e.target.value;selectedUnits.clear();await refresh();status('');});
  if(e.target.dataset.unitSelect){if(e.target.checked)selectedUnits.add(e.target.dataset.unitSelect);else selectedUnits.delete(e.target.dataset.unitSelect);}
 });
 page.addEventListener('submit',e=>{
  const f=e.target.closest('[data-market-form]');if(!f)return;e.preventDefault();if(!f.reportValidity())return;
  run(async()=>{
   const data=Object.fromEntries(new FormData(f));let action=f.dataset.marketForm;
   let payload=data;
   if(action==='receive'){const {supplier_id,...item}=data;payload={supplier_id,items:[{...item,quality_evidence:{temperature_c:item.temperature_c,provenance:item.provenance,halal_document:item.halal_document}}]};}
   if(action==='pack')payload={...data,quantities:data.quantities.split(/[,;\n]+/).map(s=>s.trim()).filter(Boolean),loss_quantity:Number(data.loss_quantity||0)};
   if(action==='count_submit')payload={document_id:data.document_id,items:[{batch_id:data.batch_id,actual_raw:data.actual_raw,surplus_cost_vnd:data.surplus_cost_vnd,actual_units:data.actual_units.split(/[\s,;]+/).filter(Boolean)}]};
   if(action==='release'&&[data.temperature_c,data.provenance,data.halal_document].some(Boolean))payload={...data,quality_evidence:{temperature_c:data.temperature_c,provenance:data.provenance,halal_document:data.halal_document}};
   if(action==='pack'&&Number(data.loss_quantity)>0)action='pack_with_loss';
   const result=await mutate(action,payload);if(result.unit_ids){selectedUnits.clear();result.unit_ids.forEach(id=>selectedUnits.add(id));tab='labels';}
   await refresh();status(result.approval_required?text('Потери отправлены на утверждение. После подтверждения повторите фасовку без повторного списания.','Loss approval requested. After approval, pack without recording the loss again.','Đã gửi duyệt hao hụt. Sau khi duyệt, đóng gói mà không ghi hao hụt lần nữa.'):text('Операция сохранена','Operation saved','Đã lưu thao tác'));
  });
 });
 page.addEventListener('click',e=>{
  const t=e.target.closest('[data-market-tab]');if(t){tab=t.dataset.marketTab;render();return;}
  const b=e.target.closest('[data-market-action]');if(!b)return;
  const action=b.dataset.marketAction;
  if(action==='scan'||action==='scan_count'){
   scan(async (result,code)=>{
    if(action==='scan_count'){
     if(result.type==='product'){
      const batch=state.batches.find(x=>x.id===b.dataset.id),v=variant(batch.variant_id);
      if(result.variant.stock_item_id!==v.stock_item_id)throw new Error('Неверный товар для этой партии');
      const amount=window.prompt(text('Фактическое количество (г / шт.)','Actual quantity (g / pcs)','Số lượng thực tế (g / cái)'),'1');
      if(amount===null)return;if(!/^\d+$/.test(amount))throw new Error('Введите целое количество');
      const input=page.querySelector(`[data-count-units="${b.dataset.id}"]`).closest('form').querySelector('[name=actual_raw]');input.value=Number(input.value||0)+Number(amount);return;
     }
     if(result.type!=='unit'||result.unit.batch_id!==b.dataset.id||result.unit.status==='written_off')throw new Error(text('Нужна упаковка выбранной партии','Scan a package from the selected batch','Quét gói thuộc lô đã chọn'));
     const area=page.querySelector(`[data-count-units="${b.dataset.id}"]`),ids=new Set(area.value.split(/\s+/).filter(Boolean));ids.add(result.unit.id);area.value=[...ids].join('\n');
    }else if(result.type==='unknown'){status(text('Код неизвестен. Добавьте товар или привяжите код к существующему.','Unknown code. Create a product or link it to an existing one.','Mã chưa có. Tạo sản phẩm hoặc liên kết với sản phẩm hiện có.'));tab='products';render();const input=page.querySelector('[name="barcode"]');if(input)input.value=code||'';}
    else if(result.type==='unit')status(`${name(result.batch.variant_id)} · ${quantity(result.unit.quantity,variant(result.batch.variant_id))} · ${result.blocked?text('Заблокировано','Blocked','Bị chặn'):result.unit.id}`);
    else status(name(result.variant.id));
   }).catch(err=>status(err.message,true));return;
  }
  run(async()=>{
   if(action==='refresh'){await refresh();status('');return;}
   if(action==='labels_all'){state.units.filter(u=>u.status!=='written_off').forEach(u=>selectedUnits.add(u.id));render();return;}
   if(action==='labels_preview'){await previewLabels();return;}
   if(action==='supplier_create'){
    const name=window.prompt(text('Название поставщика','Supplier name','Tên nhà cung cấp'));if(!name?.trim())return;
    await mutate(action,{name:name.trim()});await refresh();return;
   }
   if(action==='warehouse_create'){
    if(!boot.isSuperAdmin)throw new Error('Market access denied');
    const d=document.createElement('dialog');d.className='market-scanner';d.innerHTML=form('warehouse_create',select(text('Точка','Location','Địa điểm'),'location_id',options(boot.locations,l=>l.id,l=>l.name))+field(text('Название склада','Warehouse name','Tên kho'),'name','text','required'),text('Создать склад','Create warehouse','Tạo kho'))+btn('close','×');document.body.append(d);d.showModal();d.querySelector('[data-market-action="close"]').onclick=()=>{d.close();d.remove();};d.querySelector('form').onsubmit=async event=>{event.preventDefault();const data=Object.fromEntries(new FormData(event.target));try{await api('warehouse_create',data);d.close();d.remove();await refresh();}catch(err){status(err.message,true);}};return;
   }
   await mutate(action,b.dataset.id?{document_id:b.dataset.id}:{});await refresh();status(text('Операция сохранена','Operation saved','Đã lưu thao tác'));
  });
 });
 page.querySelector('#marketBack').onclick=()=>{closeScanner();if(!window.ummaNavigation?.back())window.openPage?.('home');};
 document.addEventListener('visibilitychange',()=>{if(document.hidden)closeScanner();});
 new MutationObserver(()=>{if(page.hidden)closeScanner();}).observe(page,{attributes:true,attributeFilter:['hidden']});
 window.ummaMarket={open,closeScanner,scan,refreshWorkspace:refresh,getWorkspace:()=>({state,warehouse,boot}),openTab:id=>{tab=id;render();}};
})();
