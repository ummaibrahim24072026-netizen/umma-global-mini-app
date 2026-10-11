/* UMMA CAFE — ACCOUNTING WORKSPACE */
(() => {
  "use strict";
  const API = "https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-accounting-admin";
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const money = v => new Intl.NumberFormat("vi-VN", {style:"currency",currency:"VND",maximumFractionDigits:0}).format(Number(v)||0);
  const qty = v => new Intl.NumberFormat("ru-RU",{maximumFractionDigits:3}).format(Number(v)||0);
  const unitNames = {kg:"кг",g:"г",l:"л",ml:"мл",pcs:"шт.",portion:"порц."};
  const itemNames = {raw_material:"Сырьё",finished_good:"Готовая продукция",packaging:"Упаковка",other:"Прочее"};
  const categoryNames = {rent:"Аренда",utilities:"Коммунальные услуги",payroll:"Зарплата",delivery:"Доставка",maintenance:"Ремонт",marketing:"Реклама",supplies:"Расходные материалы",taxes:"Налоги",bank_fees:"Комиссии",other:"Прочее"};
  let locations=[], locationId="all", role="", tab="dashboard", busy=false, refreshTimer=null, returnView="home";
  let data={summary:{},suppliers:[],stockItems:[],products:[],stockBalances:[],purchases:[],expenses:[],production:[],recipes:[]};

  async function api(payload) {
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData) throw new Error("Откройте приложение через Telegram");
    const r = await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...payload,initData})});
    const d = await r.json();
    if (!r.ok || !d.ok) throw new Error(d.error || "Ошибка запроса");
    return d;
  }
  function message(text, show=true, error=false) {
    const el=$("accountingMessage"); if(!el)return;
    el.textContent=text; el.hidden=!show; el.classList.toggle("is-error",!!error);
  }
  function locationOptions() {
    const all = role==="super_admin" ? '<option value="all">Вся сеть Umma</option>' : "";
    return all + locations.map(l=>'<option value="'+esc(l.id)+'">'+esc(l.name)+(l.city?' — '+esc(l.city):"")+'</option>').join("");
  }
  function scopedPayload(resource) {
    const p={action:"list",resource};
    if(locationId!=="all")p.locationId=locationId;
    return p;
  }
  async function refreshData() {
    message("Загружаем учётные данные…");
    const resources=[
      ["suppliers",{action:"list",resource:"suppliers"}],
      ["stockItems",{action:"list",resource:"stockItems"}],
      ["products",{action:"list",resource:"products"}],
      ["stockBalances",scopedPayload("stockBalances")],
      ["purchases",scopedPayload("purchases")],
      ["expenses",scopedPayload("expenses")],
      ["production",scopedPayload("production")],
      ["summary",{action:"summary",...(locationId==="all"?{}:{locationId})}],
      ["recipes",scopedPayload("recipes")]
    ];
    const result=await Promise.all(resources.map(async ([key,p])=>{
      const responseData=await api(p);
      return [key,key==="summary"?(responseData.summary||{}):(responseData.rows||[])];
    }));
    result.forEach(([key,value])=>data[key]=value);
    message("Данные обновлены.",true,false);
    render();
  }
  function selectOptions(items, valueKey, labelFn, placeholder) {
    return (placeholder?'<option value="">'+esc(placeholder)+'</option>':"")+items.map(x=>'<option value="'+esc(x[valueKey])+'">'+esc(labelFn(x))+'</option>').join("");
  }
  function stockItemLabel(s){return s.name_ru+" ("+(unitNames[s.base_unit]||s.base_unit)+")";}
  function supplierOptions(){return selectOptions(data.suppliers.filter(s=>s.is_active),"id",s=>s.name,"Без поставщика");}
  function stockOptions(filter) {
    const items=data.stockItems.filter(s=>s.is_active && (!filter || filter.includes(s.item_type)));
    return selectOptions(items,"id",stockItemLabel,"Выберите складскую позицию");
  }
  function productOptions(){return selectOptions(data.products,"id",p=>p.name_ru+" — "+money(p.price_vnd),"Не привязывать к меню");}
  function locationName(id){return locations.find(x=>x.id===id)?.name||"—";}
  function renderDashboard() {
    const summary=data.summary||{};
    const revenue=Number(summary.revenueVnd||0);
    const expenses=Number(summary.operatingExpensesVnd||0);
    const paidExpenses=Number(summary.paidExpensesVnd||0);
    const purchases=Number(summary.postedPurchasesVnd||0);
    const stockValue=Number(summary.stockValueVnd||0);
    const cogs=Number(summary.cogsVnd||0);
    const pendingCash=Number(summary.pendingCashHandoverVnd||0);
    const pendingCount=Number(summary.pendingCashHandovers||0);
    const profit=revenue-cogs-expenses;
    return '<div class="accounting-metrics">'+
      '<article><small>Выручка по выданным оплаченным заказам</small><strong>'+money(revenue)+'</strong><span>'+Number(summary.completedPaidOrders||0)+' завершённых заказов</span></article>'+
      '<article><small>Себестоимость проданного</small><strong>'+money(cogs)+'</strong><span>По складским движениям готовой продукции</span></article>'+
      '<article><small>Операционные расходы</small><strong>'+money(expenses)+'</strong><span>Оплачено: '+money(paidExpenses)+'</span></article>'+
      '<article><small>Расчётный результат</small><strong>'+money(profit)+'</strong><span>Выручка − себестоимость − расходы</span></article>'+
      '<article><small>Учётная стоимость остатков</small><strong>'+money(stockValue)+'</strong><span>По средней стоимости на складе</span></article>'+
      '<article><small>Проведённые закупки</small><strong>'+money(purchases)+'</strong><span>Закупки увеличивают запасы и не списываются целиком в прибыль</span></article>'+
      '<article><small>Наличные к передаче администратору</small><strong>'+money(pendingCash)+'</strong><span>'+pendingCount+' передач ожидают подтверждения</span></article>'+
      '</div><div class="accounting-note"><strong>Точность прибыли:</strong> показатель предварительный. Себестоимость отражается для блюд, привязанных к складским позициям, и заказов, проведённых после включения учётного склада. Проверьте начальные остатки и привязки меню перед использованием показателя как бухгалтерской отчётности.</div>'+
      '<h3>Последние закупки</h3>'+renderPurchaseList(5)+'<h3>Последние расходы</h3>'+renderExpenseList(5);
  }
  function renderStock() {
    const balanceByItem=new Map(data.stockBalances.filter(b=>locationId==="all"||b.location_id===locationId).map(b=>[b.stock_item_id,b]));
    let rows;
    if(locationId==="all") {
      rows=data.stockBalances;
    } else {
      rows=data.stockItems.filter(s=>s.is_active).map(s=>balanceByItem.get(s.id)||{
        stock_item_id:s.id,location_id:locationId,quantity_on_hand:0,quantity_reserved:0,average_unit_cost_vnd:0,stock_items:s
      });
    }
    const balanceRows=rows.map(b=>{
      const item=b.stock_items||data.stockItems.find(s=>s.id===b.stock_item_id)||{};
      const action=locationId==="all"?'Выберите конкретный филиал для изменения остатка':'<button type="button" data-set-balance="'+esc(b.stock_item_id)+'" data-location-id="'+esc(b.location_id)+'" data-current-qty="'+esc(b.quantity_on_hand||0)+'" data-current-cost="'+esc(b.average_unit_cost_vnd||0)+'">Установить остаток</button>';
      return '<tr><td>'+esc(item.name_ru||"—")+'<small>'+esc(itemNames[item.item_type]||item.item_type||"")+'</small></td><td>'+esc(locationName(b.location_id))+'</td><td>'+qty(b.quantity_on_hand)+' '+esc(unitNames[item.base_unit]||item.base_unit||"")+'<small>Резерв: '+qty(b.quantity_reserved||0)+'</small></td><td>'+money(b.average_unit_cost_vnd)+'</td><td>'+money(Number(b.quantity_on_hand||0)*Number(b.average_unit_cost_vnd||0))+'</td><td>'+action+'</td></tr>';
    }).join("");
    return '<div class="accounting-form"><h3>Добавить складскую позицию</h3><form id="accountingStockForm" class="accounting-fields">'+
      '<label>Название (русский)<input name="nameRu" required maxlength="180"></label><label>English<input name="nameEn" maxlength="180"></label><label>Tiếng Việt<input name="nameVi" maxlength="180"></label>'+
      '<label>Тип<select name="itemType"><option value="raw_material">Сырьё</option><option value="finished_good">Готовая продукция</option><option value="packaging">Упаковка</option><option value="other">Прочее</option></select></label>'+
      '<label>Единица<select name="baseUnit"><option value="kg">кг</option><option value="g">г</option><option value="l">л</option><option value="ml">мл</option><option value="pcs">шт.</option><option value="portion">порция</option></select></label>'+
      '<label>Артикул / SKU<input name="sku" maxlength="80"></label><label>Связать с блюдом меню<select name="linkedProductId">'+productOptions()+'</select></label>'+
      '<label class="accounting-check"><input type="checkbox" name="isHalal" checked> Халяль подтверждён</label><button class="accounting-primary" type="submit">Сохранить позицию</button></form></div>'+
      '<h3>Остатки по филиалам</h3><p class="accounting-note">Чтобы исправить начальный остаток или результат инвентаризации, нажмите «Установить остаток». Система запишет разницу в журнал движений. При выбранной «Вся сеть» изменение недоступно — сначала выберите филиал.</p>'+
      '<div class="accounting-table-wrap"><table class="accounting-table"><thead><tr><th>Позиция</th><th>Филиал</th><th>Остаток</th><th>Средняя цена</th><th>Стоимость</th><th>Действие</th></tr></thead><tbody>'+(balanceRows||'<tr><td colspan="6">Пока нет складских позиций.</td></tr>')+'</tbody></table></div>'+
      '<h3>Каталог складских позиций</h3><div class="accounting-list">'+data.stockItems.map(s=>'<article><strong>'+esc(s.name_ru)+'</strong><small>'+esc(itemNames[s.item_type]||s.item_type)+' · '+esc(unitNames[s.base_unit]||s.base_unit)+(s.sku?' · '+esc(s.sku):"")+'</small><span>'+(s.is_active?'Активна':'Отключена')+'</span></article>').join("")+'</div>';
  }
  function renderPurchaseList(limit=100) {
    const rows=data.purchases.slice(0,limit);
    if(!rows.length)return '<div class="accounting-empty">Закупок пока нет.</div>';
    return '<div class="accounting-list">'+rows.map(p=>{
      const remaining=Math.max(0,Number(p.subtotal_vnd||0)-Number(p.paid_amount_vnd||0));
      const payButton=p.status==="posted"&&remaining>0?'<button type="button" data-record-purchase-payment="'+esc(p.id)+'" data-remaining="'+remaining+'">Оплатить</button>':"";
      return '<article><div><strong>'+esc(p.document_number||("Закупка "+p.id.slice(0,8)))+'</strong><small>'+esc(p.purchase_date)+' · '+esc(p.suppliers?.name||"Поставщик не указан")+' · '+esc(locationName(p.location_id))+'</small></div><div class="accounting-list-end"><strong>'+money(p.subtotal_vnd)+'</strong><span class="accounting-status '+esc(p.status)+'">'+(p.status==="posted"?"Проведена":p.status==="cancelled"?"Отменена":"Черновик")+'</span><small>Оплачено '+money(p.paid_amount_vnd||0)+' · Остаток '+money(remaining)+'</small>'+(p.status==="draft"?'<button type="button" data-post-purchase="'+esc(p.id)+'">Принять на склад</button>':"")+payButton+'</div><small>'+((p.purchase_items||[]).map(i=>esc(i.stock_items?.name_ru||"позиция")+" × "+qty(i.quantity)).join(" · "))+'</small></article>';
    }).join("")+'</div>';
  }
  function purchaseRow() {
    return '<div class="accounting-line accounting-purchase-line"><select data-purchase-item required>'+stockOptions()+'</select><input data-purchase-qty type="number" min="0.001" step="0.001" placeholder="Кол-во" required><input data-purchase-cost type="number" min="0" step="1" placeholder="Цена за ед. VND" required><button type="button" data-remove-line aria-label="Удалить">×</button></div>';
  }
  function renderPurchases() {
    return '<div class="accounting-form"><h3>Новая закупка</h3><form id="accountingPurchaseForm">'+
      '<div class="accounting-fields"><label>Поставщик<select name="supplierId">'+supplierOptions()+'</select></label><label>Дата<input type="date" name="purchaseDate" value="'+new Date().toISOString().slice(0,10)+'" required></label><label>Номер накладной<input name="documentNumber" maxlength="100"></label></div>'+
      '<div id="accountingPurchaseLines">'+purchaseRow()+'</div><button type="button" class="accounting-secondary" id="accountingAddPurchaseLine">+ Добавить позицию</button><label>Комментарий<input name="notes" maxlength="1000"></label><button type="submit" class="accounting-primary">Создать черновик закупки</button></form></div>'+
      '<h3>Закупки и накладные</h3>'+renderPurchaseList();
  }
  function renderExpenseList(limit=100) {
    const rows=data.expenses.slice(0,limit);
    if(!rows.length)return '<div class="accounting-empty">Расходов пока нет.</div>';
    return '<div class="accounting-list">'+rows.map(e=>{
      const remaining=Math.max(0,Number(e.amount_vnd||0)-Number(e.paid_amount_vnd||0));
      const payButton=remaining>0?'<button type="button" data-record-expense-payment="'+esc(e.id)+'" data-remaining="'+remaining+'">Оплатить</button>':"";
      return '<article><div><strong>'+esc(e.description)+'</strong><small>'+esc(e.expense_date)+' · '+esc(categoryNames[e.category]||e.category)+' · '+esc(locationName(e.location_id))+'</small></div><div class="accounting-list-end"><strong>'+money(e.amount_vnd)+'</strong><span class="accounting-status '+esc(e.payment_status)+'">'+(e.payment_status==="paid"?"Оплачен":e.payment_status==="partially_paid"?"Частично":"Не оплачен")+'</span><small>Оплачено '+money(e.paid_amount_vnd||0)+' · Остаток '+money(remaining)+'</small>'+payButton+'</div></article>';
    }).join("")+'</div>';
  }
  function renderExpenses() {
    return '<div class="accounting-form"><h3>Записать расход</h3><form id="accountingExpenseForm" class="accounting-fields">'+
      '<label>Описание<input name="description" required maxlength="500" placeholder="Например, аренда за месяц"></label><label>Категория<select name="category">'+Object.entries(categoryNames).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join("")+'</select></label>'+
      '<label>Сумма, VND<input name="amountVnd" type="number" min="1" step="1" required></label><label>Дата<input name="expenseDate" type="date" value="'+new Date().toISOString().slice(0,10)+'" required></label><label>Чек / ссылка<input name="receiptReference" maxlength="160"></label><label>Комментарий<input name="notes" maxlength="1000"></label><button class="accounting-primary" type="submit">Сохранить расход</button></form></div><h3>Операционные расходы</h3>'+renderExpenseList();
  }
  function renderSuppliers() {
    return '<div class="accounting-form"><h3>Добавить поставщика</h3><form id="accountingSupplierForm" class="accounting-fields">'+
      '<label>Название компании / поставщика<input name="name" required maxlength="180"></label><label>Контактное лицо<input name="contactName" maxlength="120"></label><label>Телефон<input name="phone" maxlength="60"></label><label>Email<input name="email" type="email" maxlength="180"></label><label>Адрес<input name="address" maxlength="500"></label><label class="accounting-check"><input type="checkbox" name="isHalalVerified"> Халяль поставщика проверен</label><button class="accounting-primary" type="submit">Сохранить поставщика</button></form></div>'+
      '<h3>Поставщики</h3><div class="accounting-list">'+(data.suppliers.map(s=>'<article><strong>'+esc(s.name)+'</strong><small>'+esc(s.phone||"Телефон не указан")+(s.address?' · '+esc(s.address):"")+'</small><span>'+(s.is_halal_verified?'Халяль проверен':'Проверка халяль не отмечена')+'</span></article>').join("")||'<div class="accounting-empty">Поставщиков пока нет.</div>')+'</div>';
  }
  function productionRow(direction, filter) {
    return '<div class="accounting-line accounting-production-line" data-direction="'+direction+'"><select data-production-item required>'+stockOptions(filter)+'</select><input data-production-qty type="number" min="0.001" step="0.001" placeholder="Кол-во" required>'+(direction==="input"?'<button type="button" data-remove-line aria-label="Удалить">×</button>':'')+'</div>';
  }
  function renderProductionList() {
    if(!data.production.length)return '<div class="accounting-empty">Производственных партий пока нет.</div>';
    return '<div class="accounting-list">'+data.production.map(b=>'<article><div><strong>'+esc(b.batch_number||("Партия "+b.id.slice(0,8)))+'</strong><small>'+esc(b.production_date)+' · '+esc(locationName(b.location_id))+'</small></div><div class="accounting-list-end"><strong>'+money(b.total_cost_vnd)+'</strong><span class="accounting-status '+esc(b.status)+'">'+(b.status==="posted"?"Проведена":b.status==="cancelled"?"Отменена":"Черновик")+'</span>'+(b.status==="draft"?'<button type="button" data-post-production="'+esc(b.id)+'">Провести производство</button>':"")+'</div><small>'+((b.production_batch_items||[]).map(i=>esc(i.stock_items?.name_ru||"позиция")+" · "+(i.movement_direction==="output"?"выпуск":"расход")+" "+qty(i.quantity)).join(" · "))+'</small></article>').join("")+'</div>';
  }
  function renderProduction() {
    const raw=data.stockItems.filter(s=>s.is_active&&s.item_type!=="finished_good");
    const finished=data.stockItems.filter(s=>s.is_active&&s.item_type==="finished_good");
    if(!raw.length||!finished.length)return '<div class="accounting-note">Для производства сначала добавьте в разделе «Склад» хотя бы одну позицию сырья и одну позицию типа «Готовая продукция».</div>'+renderProductionList();
    return '<div class="accounting-form"><h3>Новая производственная партия</h3><form id="accountingProductionForm">'+
      '<div class="accounting-fields"><label>Дата<input type="date" name="productionDate" value="'+new Date().toISOString().slice(0,10)+'" required></label><label>Номер партии<input name="batchNumber" maxlength="100"></label><label>План выпуска<input name="plannedQuantity" type="number" min="0.001" step="0.001" required></label><label>Рецептура<select name="recipeId" id="accountingProductionRecipe">'+selectOptions(data.recipes.filter(r=>r.is_active),"id",r=>(r.products?.name_ru||"Блюдо")+" · v"+r.version,"Вручную без рецептуры")+'</select></label></div><button type="button" class="accounting-secondary" id="accountingApplyRecipe">Заполнить состав по рецептуре</button>'+
      '<h4>Сырьё</h4><div id="accountingProductionInputs">'+productionRow("input",["raw_material","packaging","other"])+'</div><button type="button" class="accounting-secondary" id="accountingAddProductionInput">+ Добавить ингредиент</button>'+
      '<h4>Готовая продукция</h4><div id="accountingProductionOutput">'+productionRow("output",["finished_good"])+'</div><label>Комментарий<input name="notes" maxlength="1000"></label><button class="accounting-primary" type="submit">Создать черновик производства</button></form></div>'+
      '<h3>Производственные партии</h3>'+renderProductionList();
  }
  function recipeRow() {
    return '<div class="accounting-line accounting-production-line accounting-recipe-line"><select data-recipe-item required>'+stockOptions(["raw_material","packaging","other"])+'</select><input data-recipe-qty type="number" min="0.001" step="0.001" placeholder="Кол-во" required><button type="button" data-remove-line aria-label="Удалить">×</button></div>';
  }
  function renderRecipes() {
    return '<div class="accounting-form"><h3>Создать рецептуру блюда</h3><form id="accountingRecipeForm">'+
      '<div class="accounting-fields"><label>Блюдо меню<select name="productId" required>'+selectOptions(data.products,"id",p=>p.name_ru,"Выберите блюдо меню")+'</select></label><label>Выход рецептуры<input name="yieldQuantity" type="number" min="0.001" step="0.001" value="1" required></label><label>Единица выхода<input name="yieldUnit" maxlength="30" value="portion" required></label><label>Комментарий<input name="notes" maxlength="1000"></label></div>'+
      '<h4>Ингредиенты на указанный выход</h4><div id="accountingRecipeLines">'+recipeRow()+'</div><button type="button" class="accounting-secondary" id="accountingAddRecipeItem">+ Добавить ингредиент</button><button class="accounting-primary" type="submit">Сохранить рецептуру</button></form></div>'+
      '<div class="accounting-note">Для автоматического выпуска готового блюда создайте складскую позицию типа «Готовая продукция» и привяжите её к блюду меню. Рецептура задаёт расход сырья на указанное количество выхода.</div>'+
      '<h3>Сохранённые рецептуры</h3><div class="accounting-list">'+(data.recipes.map(r=>'<article><strong>'+esc(r.products?.name_ru||"Блюдо")+' · версия '+esc(r.version)+'</strong><small>Выход: '+qty(r.yield_quantity)+' '+esc(r.yield_unit)+' · '+((r.recipe_items||[]).map(i=>esc(i.stock_items?.name_ru||"ингредиент")+" × "+qty(i.quantity)+" "+esc(unitNames[i.stock_items?.base_unit]||"")).join(" · "))+'</small><span>'+(r.is_active?"Активна":"Неактивна")+'</span></article>').join("")||'<div class="accounting-empty">Рецептуры пока не созданы.</div>')+'</div>';
  }
  function render() {
    const root=$("accountingContent"); if(!root)return;
    const views={dashboard:renderDashboard,stock:renderStock,purchases:renderPurchases,production:renderProduction,expenses:renderExpenses,suppliers:renderSuppliers,recipes:renderRecipes};
    root.innerHTML=(views[tab]||renderDashboard)();
    document.querySelectorAll("[data-accounting-tab]").forEach(b=>b.classList.toggle("active",b.dataset.accountingTab===tab));
  }
  function open() {
    if(!(window.ummaRole==="super_admin"||window.ummaRole==="admin"||window.ummaRole==="employee")){showToast("Доступ запрещён");return;}
    returnView=window.ummaRole==="super_admin"&&$("adminPage")&&!$("adminPage").hidden?"admin":$("cafeKitchenPage")&&!$("cafeKitchenPage").hidden?"kitchen":"home";
    ["adminPage","adminUsersPage","cafeStaffAdminPage","cafeKitchenPage","cafeProductsAdminPage","cafeInventoryPage","cafePage"].forEach(id=>{if($(id))$(id).hidden=true;});
    const home=document.querySelector(".app > main"),nav=document.querySelector(".bottom-nav");
    if(home)home.style.display="none";if(nav)nav.style.display="none";
    $("cafeAccountingPage").hidden=false;
    window.scrollTo({top:0,behavior:"smooth"});
    if(refreshTimer)clearInterval(refreshTimer);
    refreshTimer=setInterval(()=>{if(!$("cafeAccountingPage")?.hidden&&!busy)reload();},60000);
    init();
  }
  function close() {
    $("cafeAccountingPage").hidden=true;
    if(refreshTimer){clearInterval(refreshTimer);refreshTimer=null;}
    const home=document.querySelector(".app > main"),nav=document.querySelector(".bottom-nav");
    if(returnView==="admin") {
      if(home)home.style.display="none";
      if(nav)nav.style.display="none";
      if($("adminPage"))$("adminPage").hidden=false;
    } else if(returnView==="kitchen") {
      if(home)home.style.display="none";
      if(nav)nav.style.display="none";
      if($("cafeKitchenPage"))$("cafeKitchenPage").hidden=false;
    } else {
      if($("adminPage"))$("adminPage").hidden=true;
      if($("cafeKitchenPage"))$("cafeKitchenPage").hidden=true;
      if(home)home.style.display="";
      if(nav)nav.style.display="";
    }
    window.scrollTo({top:0,behavior:"smooth"});
  }
  async function init() {
    if(busy)return;busy=true;
    try {
      const d=await api({action:"bootstrap"});
      locations=d.locations||[];role=d.role||window.ummaRole||"";
      if(!locations.length){message("Для вашей учётной записи не назначено доступных филиалов.",true,true);busy=false;return;}
      if(role!=="super_admin")locationId=locations[0].id;
      else if(!locations.some(l=>l.id===locationId)&&locationId!=="all")locationId="all";
      const select=$("accountingLocation");select.innerHTML=locationOptions();select.value=locationId;
      await refreshData();
    } catch(e) {message(e.message||"Не удалось открыть учёт",true,true);}
    finally {busy=false;}
  }
  async function reload() {
    if(busy)return;busy=true;
    try{await refreshData();}catch(e){message(e.message||"Не удалось обновить данные",true,true);}
    finally{busy=false;}
  }
  document.addEventListener("click",async event=>{
    const target=event.target instanceof Element?event.target:null;if(!target)return;
    const tabButton=target.closest("[data-accounting-tab]");
    if(tabButton){tab=tabButton.dataset.accountingTab;render();return;}
    if(target.closest("#accountingEntryButton")||target.closest("#adminAccountingButton")){open();return;}
    if(target.closest("#accountingBack")){close();return;}
    if(target.closest("#accountingRefresh")){await reload();return;}
    if(target.closest("#accountingAddPurchaseLine")){$("accountingPurchaseLines")?.insertAdjacentHTML("beforeend",purchaseRow());return;}
    if(target.closest("#accountingAddProductionInput")){$("accountingProductionInputs")?.insertAdjacentHTML("beforeend",productionRow("input",["raw_material","packaging","other"]));return;}
    if(target.closest("#accountingAddRecipeItem")){$("accountingRecipeLines")?.insertAdjacentHTML("beforeend",recipeRow());return;}
    if(target.closest("#accountingApplyRecipe")){
      const form=$("accountingProductionForm");
      const recipeId=$("accountingProductionRecipe")?.value;
      const recipe=data.recipes.find(r=>r.id===recipeId);
      if(!recipe){message("Сначала выберите сохранённую рецептуру.",true,true);return;}
      const planned=Number(form?.elements.namedItem("plannedQuantity")?.value||0);
      if(!Number.isFinite(planned)||planned<=0){message("Сначала укажите план выпуска.",true,true);return;}
      const outputItem=data.stockItems.find(s=>s.linked_product_id===recipe.product_id&&s.is_active&&s.item_type==="finished_good");
      if(!outputItem){message("Для блюда из рецептуры создайте складскую позицию «Готовая продукция» и привяжите её к этому блюду меню.",true,true);return;}
      const inputs=recipe.recipe_items||[];
      if(!inputs.length){message("В выбранной рецептуре нет ингредиентов.",true,true);return;}
      $("accountingProductionInputs").innerHTML=inputs.map(()=>productionRow("input",["raw_material","packaging","other"])).join("");
      Array.from($("accountingProductionInputs").querySelectorAll(".accounting-production-line")).forEach((row,i)=>{
        row.querySelector("[data-production-item]").value=inputs[i].stock_item_id;
        row.querySelector("[data-production-qty]").value=(Number(inputs[i].quantity)*planned/Number(recipe.yield_quantity||1)).toFixed(3);
      });
      $("accountingProductionOutput").innerHTML=productionRow("output",["finished_good"]);
      const outputRow=$("accountingProductionOutput").querySelector(".accounting-production-line");
      outputRow.querySelector("[data-production-item]").value=outputItem.id;
      outputRow.querySelector("[data-production-qty]").value=String(planned);
      message("Состав заполнен по рецептуре. Проверьте количества перед сохранением.",true,false);
      return;
    }

    const remove=target.closest("[data-remove-line]");if(remove){remove.closest(".accounting-line")?.remove();return;}
    const setBalance=target.closest("[data-set-balance]");
    if(setBalance){
      if(locationId==="all"){message("Выберите конкретный филиал.",true,true);return;}
      const stockItemId=setBalance.dataset.setBalance;
      const location= setBalance.dataset.locationId;
      const currentQty=Number(setBalance.dataset.currentQty||0);
      const currentCost=Number(setBalance.dataset.currentCost||0);
      const countText=prompt("Фактический остаток на складе",String(currentQty));
      if(countText===null)return;
      const countedQuantity=Number(countText);
      if(!Number.isFinite(countedQuantity)||countedQuantity<0||countedQuantity>999999999){message("Укажите корректный остаток.",true,true);return;}
      const costText=prompt("Средняя себестоимость за единицу в VND (оставьте пустым, чтобы сохранить текущую)",String(currentCost));
      if(costText===null)return;
      const unitCostVnd=costText.trim()===""?null:Number(costText);
      if(unitCostVnd!==null&&(!Number.isFinite(unitCostVnd)||unitCostVnd<0)){message("Укажите корректную среднюю себестоимость.",true,true);return;}
      const note=prompt("Причина изменения (инвентаризация, начальный остаток и т. п.)","Инвентаризация");
      if(note===null)return;
      try{message("Сохраняем остаток…");await api({action:"setStockBalance",locationId:location,stockItemId,countedQuantity,unitCostVnd,note});await reload();message("Остаток обновлён, движение записано в журнал.",true,false);}
      catch(e){message(e.message||"Не удалось обновить остаток",true,true);}
      return;
    }
    const payPurchase=target.closest("[data-record-purchase-payment]");
    const payExpense=target.closest("[data-record-expense-payment]");
    if(payPurchase||payExpense){
      const purchase=!!payPurchase, id=(payPurchase||payExpense).dataset[purchase?"recordPurchasePayment":"recordExpensePayment"];
      const remaining=Number((payPurchase||payExpense).dataset.remaining||0);
      const amountText=prompt("Сумма оплаты в VND (остаток "+remaining+")",String(remaining));
      if(amountText===null)return;
      const amountVnd=Number(amountText);
      if(!Number.isSafeInteger(amountVnd)||amountVnd<=0||amountVnd>remaining){message("Сумма должна быть целым числом в пределах остатка.",true,true);return;}
      const paymentMethod=(prompt("Способ оплаты: cash, qr, bank_transfer, card или other","cash")||"").trim();
      if(!["cash","qr","bank_transfer","card","other"].includes(paymentMethod)){message("Неизвестный способ оплаты.",true,true);return;}
      const idempotencyKey="umma-"+(purchase?"purchase":"expense")+"-"+id+"-"+(window.crypto?.randomUUID?.()||String(Date.now())+"-"+String(Math.floor(Math.random()*1000000)));
      try{
        message("Записываем оплату…");
        await api(purchase?{action:"recordPurchasePayment",documentId:id,amountVnd,paymentMethod,idempotencyKey}:{action:"recordExpensePayment",expenseId:id,amountVnd,paymentMethod,idempotencyKey});
        await reload();message("Оплата записана в финансовый журнал.",true,false);
      }catch(e){message(e.message||"Не удалось записать оплату",true,true);}
      return;
    }
    const postPurchase=target.closest("[data-post-purchase]");
    if(postPurchase){if(!confirm("Провести закупку и увеличить складские остатки?"))return;try{message("Проводим закупку…");await api({action:"postPurchase",documentId:postPurchase.dataset.postPurchase});await reload();}catch(e){message(e.message,true,true);}return;}
    const postProduction=target.closest("[data-post-production]");
    if(postProduction){if(!confirm("Провести производство, списать сырьё и принять готовую продукцию?"))return;try{message("Проводим производство…");await api({action:"postProduction",batchId:postProduction.dataset.postProduction});await reload();}catch(e){message(e.message,true,true);}return;}
  });
  document.addEventListener("change",async event=>{
    if(event.target?.id==="accountingLocation"){locationId=event.target.value;await reload();}
    if(event.target?.name==="itemType"){
      const link=$("accountingStockForm")?.elements.namedItem("linkedProductId");
      if(link)link.disabled=event.target.value!=="finished_good";
    }
  });
  document.addEventListener("submit",async event=>{
    const form=event.target;if(!(form instanceof HTMLFormElement))return;
    try{
      if(form.id==="accountingStockForm"){
        event.preventDefault();const f=new FormData(form);
        const itemType=String(f.get("itemType"));
        await api({action:"saveStockItem",nameRu:f.get("nameRu"),nameEn:f.get("nameEn"),nameVi:f.get("nameVi"),itemType,baseUnit:f.get("baseUnit"),sku:f.get("sku"),linkedProductId:itemType==="finished_good"?(f.get("linkedProductId")||null):null,isHalal:f.get("isHalal")==="on"});
        form.reset();await reload();message("Складская позиция добавлена.",true,false);
      } else if(form.id==="accountingSupplierForm"){
        event.preventDefault();const f=new FormData(form);
        await api({action:"saveSupplier",name:f.get("name"),contactName:f.get("contactName"),phone:f.get("phone"),email:f.get("email"),address:f.get("address"),isHalalVerified:f.get("isHalalVerified")==="on"});
        form.reset();await reload();message("Поставщик сохранён.",true,false);
      } else if(form.id==="accountingPurchaseForm"){
        event.preventDefault();const f=new FormData(form);
        const items=Array.from(form.querySelectorAll(".accounting-purchase-line")).map(row=>({stockItemId:row.querySelector("[data-purchase-item]").value,quantity:Number(row.querySelector("[data-purchase-qty]").value),unitCostVnd:Number(row.querySelector("[data-purchase-cost]").value)}));
        if(items.some(i=>!i.stockItemId||!i.quantity||!Number.isFinite(i.unitCostVnd))){message("Заполните все строки закупки.",true,true);return;}
        if(locationId==="all")throw new Error("Перед созданием закупки выберите конкретный филиал.");
        await api({action:"createPurchase",locationId:locationId,supplierId:f.get("supplierId")||null,purchaseDate:f.get("purchaseDate"),documentNumber:f.get("documentNumber"),notes:f.get("notes"),items});
        await reload();message("Черновик закупки создан. Проверьте позиции и нажмите «Принять на склад».",true,false);
      } else if(form.id==="accountingExpenseForm"){
        event.preventDefault();const f=new FormData(form);
        if(locationId==="all")throw new Error("Перед записью расхода выберите конкретный филиал.");
        await api({action:"createExpense",locationId:locationId,description:f.get("description"),category:f.get("category"),amountVnd:Number(f.get("amountVnd")),expenseDate:f.get("expenseDate"),receiptReference:f.get("receiptReference"),notes:f.get("notes")});
        form.reset();await reload();message("Расход записан как неоплаченный. Нажмите «Оплатить» в списке, когда деньги будут переданы.",true,false);
      } else if(form.id==="accountingRecipeForm"){
        event.preventDefault();const f=new FormData(form);
        const items=Array.from(form.querySelectorAll(".accounting-recipe-line")).map(row=>({stockItemId:row.querySelector("[data-recipe-item]").value,quantity:Number(row.querySelector("[data-recipe-qty]").value)}));
        if(items.some(i=>!i.stockItemId||!i.quantity)){message("Заполните все ингредиенты рецептуры.",true,true);return;}
        await api({action:"createRecipe",productId:f.get("productId"),yieldQuantity:Number(f.get("yieldQuantity")),yieldUnit:f.get("yieldUnit"),notes:f.get("notes"),items});
        await reload();message("Рецептура сохранена новой версией.",true,false);
      } else if(form.id==="accountingProductionForm"){
        event.preventDefault();const f=new FormData(form);
        const items=Array.from(form.querySelectorAll(".accounting-production-line")).map(row=>({direction:row.dataset.direction,stockItemId:row.querySelector("[data-production-item]").value,quantity:Number(row.querySelector("[data-production-qty]").value)}));
        if(items.some(i=>!i.stockItemId||!i.quantity)){message("Заполните сырьё и готовую продукцию.",true,true);return;}
        if(locationId==="all")throw new Error("Перед созданием производства выберите конкретный филиал.");
        await api({action:"createProduction",locationId:locationId,recipeId:f.get("recipeId")||null,productionDate:f.get("productionDate"),batchNumber:f.get("batchNumber"),plannedQuantity:Number(f.get("plannedQuantity")),notes:f.get("notes"),items});
        await reload();message("Черновик производства создан. Проведение спишет сырьё и оприходует готовую продукцию.",true,false);
      }
    } catch(e){message(e.message||"Операция не выполнена",true,true);}
  });
  window.ummaCafeAccounting={open,close};
})();