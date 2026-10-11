/* UMMA CAFE — PRODUCT CATALOG ADMIN */
(() => {
  "use strict";
  const API = "https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-products-admin";
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const money = v => new Intl.NumberFormat("vi-VN", {style:"currency",currency:"VND",maximumFractionDigits:0}).format(Number(v)||0);
  let products = [], categories = [], busy = false;
  const allowed = () => typeof isUmmaSuperAdmin === "function" && isUmmaSuperAdmin();
  function message(value, visible = true) { const el=$("cafeProductsAdminMessage"); if(el){el.textContent=value;el.hidden=!visible;} }
  async function api(payload) {
    const initData=window.Telegram?.WebApp?.initData;
    if(!initData) throw new Error("Откройте приложение через Telegram");
    const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...payload,initData})});
    const d=await r.json(); if(!r.ok||!d.ok) throw new Error(d.error||"Ошибка запроса"); return d;
  }
  function resetForm() { $("cafeProductForm")?.reset(); $("cafeProductId").value=""; $("cafeProductFormTitle").textContent="Добавить товар"; $("cafeProductSave").textContent="Сохранить товар"; }
  function fillCategories() { $("cafeProductCategory").innerHTML='<option value="">Без категории</option>'+categories.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name_ru)+'</option>').join(""); }
  function edit(p) {
    $("cafeProductId").value=p.id; $("cafeProductRu").value=p.name_ru||""; $("cafeProductVi").value=p.name_vi||""; $("cafeProductEn").value=p.name_en||"";
    $("cafeProductCategory").value=p.category_id||""; $("cafeProductPrice").value=p.price_vnd; $("cafeProductWeight").value=p.weight_value??"";
    $("cafeProductWeightUnit").value=p.weight_unit||"g"; $("cafeProductDescRu").value=p.description_ru||""; $("cafeProductDescVi").value=p.description_vi||"";
    $("cafeProductDescEn").value=p.description_en||""; $("cafeProductImage").value=p.image_url||""; $("cafeProductSku").value=p.sku||"";
    $("cafeProductFormTitle").textContent="Редактировать товар"; $("cafeProductSave").textContent="Сохранить изменения"; window.scrollTo({top:0,behavior:"smooth"});
  }
  function render() {
    const root=$("cafeProductsAdminList"); if(!root)return;
    if(!products.length){root.innerHTML='<div class="cafe-message">Товаров пока нет. Добавьте первый товар выше.</div>';return;}
    root.innerHTML=products.map(p=>'<article class="cafe-staff-card"><div class="cafe-staff-card-head"><div><strong>'+esc(p.name_ru)+'</strong><small>'+esc(p.name_vi)+' · '+esc(p.name_en)+'</small></div><span class="cafe-staff-role">'+money(p.price_vnd)+'</span></div><p>'+(p.weight_value?esc(p.weight_value)+(p.weight_unit==="ml"?" мл":" г"):"Вес не указан")+' · '+(p.is_active?"Опубликован":"Скрыт из меню")+'</p><div class="cafe-staff-card-foot"><button type="button" data-edit="'+esc(p.id)+'" class="cafe-staff-payment-permission">Изменить</button><button type="button" data-toggle="'+esc(p.id)+'" data-active="'+(!p.is_active)+'" class="cafe-staff-deactivate">'+(p.is_active?"Скрыть из меню":"Вернуть в меню")+'</button></div></article>').join("");
  }
  async function load() {
    if(busy)return; if(!allowed()){message("Доступ только для суперадминистратора");return;}
    busy=true;message("Загружаем каталог…");
    try{const d=await api({action:"list"});products=d.products||[];categories=d.categories||[];fillCategories();render();message("",false);}
    catch(e){message(e.message||"Не удалось загрузить каталог");}finally{busy=false;}
  }
  function open() {
    if(!allowed()){if(typeof showToast==="function")showToast("Доступ запрещён");return;}
    ["adminPage","adminUsersPage","cafeStaffAdminPage","cafeKitchenPage","cafePage"].forEach(id=>{if($(id))$(id).hidden=true;});
    const home=document.querySelector(".app > main"),nav=document.querySelector(".bottom-nav");if(home)home.style.display="none";if(nav)nav.style.display="none";
    $("cafeProductsAdminPage").hidden=false;load();window.scrollTo({top:0,behavior:"smooth"});
  }
  $("adminProductsButton")?.addEventListener("click",open);
  $("cafeProductsAdminBack")?.addEventListener("click",()=>{$("cafeProductsAdminPage").hidden=true;if(typeof openAdminPanel==="function")openAdminPanel();});
  $("cafeProductsAdminRefresh")?.addEventListener("click",load);
  $("cafeProductCancelEdit")?.addEventListener("click",()=>{resetForm();message("",false);});
  $("cafeProductForm")?.addEventListener("submit",async e=>{
    e.preventDefault();if(busy)return;if(!allowed()){message("Доступ запрещён");return;}busy=true;$("cafeProductSave").disabled=true;message("Сохраняем товар…");
    try{
      const product={id:$("cafeProductId").value||undefined,name_ru:$("cafeProductRu").value.trim(),name_vi:$("cafeProductVi").value.trim(),name_en:$("cafeProductEn").value.trim(),category_id:$("cafeProductCategory").value||null,price_vnd:Number($("cafeProductPrice").value),weight_value:$("cafeProductWeight").value===""?null:Number($("cafeProductWeight").value),weight_unit:$("cafeProductWeightUnit").value,description_ru:$("cafeProductDescRu").value,description_vi:$("cafeProductDescVi").value,description_en:$("cafeProductDescEn").value,image_url:$("cafeProductImage").value,sku:$("cafeProductSku").value};
      await api({action:"save",product});resetForm();await load();message("Товар сохранён. Активные товары доступны в меню кафе.");
    }catch(err){message(err.message||"Не удалось сохранить товар");}finally{busy=false;$("cafeProductSave").disabled=false;}
  });
  $("cafeProductsAdminList")?.addEventListener("click",async e=>{
    const t=e.target;if(!(t instanceof Element)||busy||!allowed())return;
    const editButton=t.closest("[data-edit]");if(editButton){const p=products.find(x=>x.id===editButton.getAttribute("data-edit"));if(p)edit(p);return;}
    const b=t.closest("[data-toggle]");if(!b)return;const p=products.find(x=>x.id===b.getAttribute("data-toggle"));if(!p)return;
    const active=b.getAttribute("data-active")==="true";if(!confirm(active?"Вернуть товар в меню кафе?":"Скрыть товар из меню? История старых заказов сохранится."))return;
    busy=true;message("Обновляем товар…");
    try{await api({action:"setActive",id:p.id,is_active:active});await load();message(active?"Товар снова опубликован.":"Товар скрыт из меню; история заказов сохранена.");}
    catch(err){message(err.message||"Не удалось обновить товар");}finally{busy=false;}
  });
})();