/* Import creates unpublished drafts; no certificate is required or asserted. */
(() => {
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const t=(ru,en,vi)=>{const l=window.ummaI18n?.locale?.()||'ru';return l.startsWith('vi')?vi:l.startsWith('en')?en:ru;};
 let context=null,working=false,generation=0,jobs=[];
 const root=()=>document.getElementById('marketBody');
 const msg=(value,bad=false)=>{const el=document.getElementById('marketStatus');if(el){el.textContent=value;el.className=bad?'market-error':'market-status';}};
 const options=rows=>rows.map(x=>`<option value="${esc(x.id)}">${esc(x.name||x.name_ru)}</option>`).join('');
 const execute=(action,data={})=>window.ummaMarketApi.execute(action,{warehouse_id:context.warehouse,...data});
 function render(){
  if(context?.tab!=='import'||!root())return;
  root().innerHTML=`<h2>${esc(t('Массовый импорт','Bulk import','Nhập hàng loạt'))}</h2><p>${esc(t('CSV из Excel: до 100 строк. Сертификаты сейчас не обязательны. Новые товары сохраняются черновиками без цен продажи, остатков и халяль-отметки. Фотографии добавляются отдельно с подтверждением прав.','CSV from Excel: up to 100 rows. Certificates are not required at this stage. New products are unpublished drafts without sale prices, stock or a halal badge. Add authorized photos separately.','CSV từ Excel: tối đa 100 dòng. Chưa bắt buộc chứng chỉ. Sản phẩm mới là bản nháp, không có giá bán, tồn kho hoặc dấu halal. Thêm ảnh được phép riêng.'))}</p><form class="market-form" data-import-form><label>${esc(t('Поставщик','Supplier','Nhà cung cấp'))}<select name="supplier_id" required>${options(context.state.suppliers)}</select></label><label>${esc(t('Категория по умолчанию','Default category','Danh mục mặc định'))}<select name="category_id" required>${options(context.state.categories||[])}</select></label><label>CSV<input name="csv" type="file" accept=".csv,text/csv" required></label><p><code>name_ru,name_en,name_vi,supplier_sku,gtin,sale_mode,measure,fixed_quantity,purchase_price_vnd</code></p><p>${esc(t('Обязательно: name_ru и supplier_sku. По умолчанию sale_mode=piece, measure=pcs. GTIN сохраняйте текстом, включая нули в начале. Закупочная цена необязательна.','Required: name_ru and supplier_sku. Defaults: sale_mode=piece, measure=pcs. Store GTIN as text, preserving leading zeroes. Purchase price is optional.','Bắt buộc: name_ru và supplier_sku. Mặc định: sale_mode=piece, measure=pcs. Giữ GTIN dạng văn bản, kể cả số 0 đầu. Giá mua là tùy chọn.'))}</p><button type="submit" ${working?'disabled':''}>${esc(t('Проверить и показать изменения','Validate and preview','Kiểm tra và xem trước'))}</button></form><div data-import-jobs>${jobs.map(j=>`<details class="market-card" open><summary>${esc(j.source_name)} · ${esc(j.state)}</summary><div class="market-import-preview">${(j.preview||[]).map(p=>`<p><strong>${p.row_number}. ${esc(p.name)}</strong> · ${esc(p.action==='create_draft'?t('Новый черновик','New draft','Bản nháp mới'):p.action==='update_supplier'?t('Обновить закупочную цену поставщика','Update supplier purchase price','Cập nhật giá mua nhà cung cấp'):t('Ошибка','Error','Lỗi'))}<br>${(p.errors||[]).map(esc).join('; ')}</p>`).join('')}</div>${j.state==='staged'?`<button type="button" data-import-commit="${esc(j.id)}" ${working||j.preview.some(p=>p.action==='blocked')?'disabled':''}>${esc(t('Подтвердить импорт','Confirm import','Xác nhận nhập'))}</button>`:`<p>${esc(t('Обработано строк','Rows processed','Số dòng xử lý'))}: ${Number(j.result?.processed||0)}</p>`}</details>`).join('')}</div>`;
 }
 async function run(fn){if(working)return;working=true;render();try{await fn();}catch(e){msg(e.message,true);}finally{working=false;render();}}
 async function load(){const token=generation,data=await execute('import_list');if(token!==generation)return;jobs=data.jobs||[];render();}
 document.addEventListener('umma:market-render',event=>{
  context=event.detail;generation++;jobs=[];
  if(context.tab!=='import')return;
  if(!context.state.roles.includes('admin')){root().textContent=t('Нет доступа','Access denied','Không có quyền');return;}
  render();load().catch(e=>msg(e.message,true));
 });
 document.addEventListener('submit',event=>{
  const f=event.target.closest('[data-import-form]');if(!f)return;event.preventDefault();if(working||!f.reportValidity())return;
  // Capture before run() replaces the form, and pin this operation to its warehouse.
  const file=f.elements.csv.files?.[0],supplier=f.elements.supplier_id.value,category=f.elements.category_id.value,warehouse=context.warehouse,token=generation;
  run(async()=>{
   if(!file||file.size>80000)throw Error('CSV: максимум 80 КБ');
   const {parseCSV}=await import('./catalog/csv.js');
   const rows=parseCSV(await file.text()).map(r=>({name_ru:r.name_ru||'',name_en:r.name_en||'',name_vi:r.name_vi||'',supplier_sku:r.supplier_sku||'',gtin:r.gtin||'',sale_mode:r.sale_mode||'piece',measure:r.measure||'pcs',fixed_quantity:r.fixed_quantity||'',purchase_price_vnd:r.purchase_price_vnd||'',supplier_id:supplier,category_id:r.category_id||category}));
   if(JSON.stringify(rows).length>90000)throw Error(t('Разделите файл на меньшие части.','Split the file into smaller parts.','Chia tệp thành các phần nhỏ hơn.'));
   await window.ummaMarketApi.execute('import_stage',{warehouse_id:warehouse,rows,source_name:file.name});
   if(token===generation){await load();msg(t('Проверьте строки и подтвердите импорт.','Review the rows and confirm import.','Kiểm tra các dòng và xác nhận.'));}
  });
 });
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-import-commit]');if(!button||working)return;
  const warehouse=context.warehouse,token=generation,id=button.dataset.importCommit;
  run(async()=>{await window.ummaMarketApi.execute('import_commit',{warehouse_id:warehouse,job_id:id});if(token===generation){await load();msg(t('Импорт завершён. Откройте «Товары» для проверки карточек и назначения цен.','Import complete. Open Products to review drafts and set prices.','Đã nhập xong. Mở Sản phẩm để kiểm tra bản nháp và đặt giá.'));}});
 });
})();
