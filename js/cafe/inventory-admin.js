/* UMMA CAFE — BRANCH STOCK AND PRICES */
(() => {
  "use strict";
  const API="https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-inventory-admin";
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const money=v=>new Intl.NumberFormat("vi-VN",{style:"currency",currency:"VND",maximumFractionDigits:0}).format(Number(v)||0);
  let locations=[],products=[],locationId=null,busy=false,canManage=false;
  async function api(payload){const initData=window.Telegram?.WebApp?.initData;if(!initData)throw new Error("Откройте приложение через Telegram");const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...payload,initData})});const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||"Ошибка запроса");return d;}
  function message(text,show=true){const el=$("cafeInventoryMessage");if(el){el.textContent=text;el.hidden=!show;}}
  function renderLocations(){const s=$("cafeInventoryLocation");if(!s)return;s.innerHTML=locations.map(l=>'<option value="'+esc(l.id)+'">'+esc(l.name)+(l.city?' — '+esc(l.city):'')+'</option>').join("");if(locationId)s.value=locationId;}
  function renderProducts(){
    const root=$("cafeInventoryProducts");if(!root)return;
    if(!products.length){root.innerHTML='<div class="cafe-message">Каталог пуст. Добавьте первый товар.</div>';return;}
    root.innerHTML=products.map(p=>{
      const inv=p.inventory||{},qty=inv.quantity??0,price=inv.price_vnd??p.price_vnd,reserved=Number(inv.reserved_quantity||0),available=inv.is_available!==false;
      return '<article class="cafe-staff-card" style="margin-bottom:12px"><div class="cafe-staff-card-head"><div><strong>'+esc(p.name_ru)+'</strong><small>'+esc(p.name_vi||"")+' · '+esc(p.name_en||"")+'</small></div><span class="cafe-staff-role">'+(p.is_active?'В каталоге':'Скрыт')+'</span></div><p style="margin:8px 0;color:#607171;font-size:13px">В активных заказах зарезервировано: '+reserved+' · Доступно сейчас: '+Math.max(0,Number(qty)-reserved)+'</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label>Остаток всего<input type="number" min="'+reserved+'" max="100000" step="1" data-qty="'+esc(p.id)+'" value="'+esc(qty)+'" '+(!canManage?'disabled':'')+'></label><label>Цена в VND<input type="number" min="0" max="100000000" step="1000" data-price="'+esc(p.id)+'" value="'+esc(price)+'" '+(!canManage?'disabled':'')+'></label></div><label style="display:flex;align-items:center;gap:8px;margin-top:8px"><input type="checkbox" data-available="'+esc(p.id)+'" '+(available?'checked':'')+' '+(!canManage?'disabled':'')+'> Доступен для заказа</label><div class="cafe-staff-card-foot"><span>'+money(price)+'</span><button type="button" class="cafe-staff-payment-permission" data-save-inventory="'+esc(p.id)+'" '+(!canManage?'disabled':'')+'>Сохранить остаток и цену</button></div></article>';
    }).join("");
  }
  async function loadProducts(){
    if(!locationId)return;
    message("Загружаем товары и остатки…");
    try{const d=await api({action:"list",locationId});products=d.products||[];canManage=!!d.canManage;renderProducts();message(canManage?"Изменения сохраняются только для выбранного кафе. Зарезервированные заказы не позволят уменьшить остаток ниже резерва.":"Просмотр доступен, но менять остатки и цены может только менеджер этого кафе.",true);}
    catch(e){message(e.message||"Не удалось загрузить остатки");}
  }
  async function load(){
    if(busy)return;busy=true;
    try{const d=await api({action:"list"});locations=d.locations||[];if(!locations.length){message("Для вашей учётной записи не назначено кафе.");return;}locationId=locationId||locations[0].id;renderLocations();await loadProducts();}
    catch(e){message(e.message||"Не удалось открыть склад");}
    finally{busy=false;}
  }
  function open(){
    ["adminPage","adminUsersPage","cafeStaffAdminPage","cafeKitchenPage","cafeProductsAdminPage","cafePage"].forEach(id=>{if($(id))$(id).hidden=true;});
    const home=document.querySelector(".app > main"),nav=document.querySelector(".bottom-nav");if(home)home.style.display="none";if(nav)nav.style.display="none";
    $("cafeInventoryPage").hidden=false;load();window.scrollTo({top:0,behavior:"smooth"});
  }
  $("cafeInventoryOpen")?.addEventListener("click",open);
  $("cafeInventoryBack")?.addEventListener("click",()=>{if($("cafeInventoryPage"))$("cafeInventoryPage").hidden=true;if(typeof openCafeKitchen==="function")openCafeKitchen();else if($("cafeKitchenPage")){$("cafeKitchenPage").hidden=false;}});
  $("cafeInventoryRefresh")?.addEventListener("click",load);
  $("cafeInventoryLocation")?.addEventListener("change",e=>{locationId=e.target.value;loadProducts();});
  $("cafeInventoryCreateProduct")?.addEventListener("submit",async e=>{
    e.preventDefault();if(busy)return;busy=true;const button=$("cafeInventoryCreateSubmit");if(button)button.disabled=true;
    try{await api({action:"createProduct",locationId,product:{name_ru:$("cafeInvNameRu").value.trim(),name_vi:$("cafeInvNameVi").value.trim(),name_en:$("cafeInvNameEn").value.trim(),price_vnd:Number($("cafeInvNewPrice").value),quantity:Number($("cafeInvNewQty").value),weight_value:$("cafeInvWeight").value===""?null:Number($("cafeInvWeight").value),weight_unit:$("cafeInvWeightUnit").value,sku:$("cafeInvSku").value.trim()}});$("cafeInventoryCreateProduct").reset();await loadProducts();message("Товар добавлен в каталог и остаток выбранного кафе сохранён.");}
    catch(e){message(e.message||"Не удалось создать товар");}
    finally{busy=false;if(button)button.disabled=false;}
  });
  $("cafeInventoryProducts")?.addEventListener("click",async e=>{
    const b=e.target instanceof Element?e.target.closest("[data-save-inventory]"):null;if(!b||busy)return;
    const id=b.getAttribute("data-save-inventory"),qty=$("cafeInventoryProducts").querySelector('[data-qty="'+id+'"]'),price=$("cafeInventoryProducts").querySelector('[data-price="'+id+'"]'),available=$("cafeInventoryProducts").querySelector('[data-available="'+id+'"]');
    busy=true;b.disabled=true;
    try{await api({action:"save",locationId,productId:id,quantity:Number(qty.value),price_vnd:price.value,is_available:available.checked});await loadProducts();message("Остаток и цена сохранены.");}
    catch(e){message(e.message||"Не удалось сохранить остаток");}
    finally{busy=false;b.disabled=false;}
  });
})();