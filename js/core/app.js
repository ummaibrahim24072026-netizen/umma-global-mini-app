/* =====================================================
   UMMA GLOBAL
   Telegram Mini App
   ===================================================== */

const tg = window.Telegram?.WebApp;


/* =====================================================
   TELEGRAM AUTH
   ===================================================== */

const TELEGRAM_AUTH_URL =
  "https://zwzojugspldexyyljwpr.supabase.co/functions/v1/telegram-auth";


/* =====================================================
   TELEGRAM
   ===================================================== */

if (tg) {

  tg.ready?.();

  tg.expand?.();

  tg.setHeaderColor?.("#ffffff");

  tg.setBackgroundColor?.("#F1FAFA");
  tg.setBottomBarColor?.("#ffffff");

  tg.enableClosingConfirmation?.();

}


/* =====================================================
   ELEMENTS
   ===================================================== */

const toast =
  document.getElementById("toast");

const menuBtn =
  document.getElementById("menuBtn");

const languageBtn =
  document.getElementById("languageBtn");

const notificationBtn =
  document.getElementById("notificationBtn");

const profileBtn =
  document.getElementById("profileBtn");

const allServicesBtn =
  document.getElementById("allServicesBtn");


/* =====================================================
   USER STATE
   ===================================================== */

window.ummaUser = null;

window.ummaRole = "user";

window.ummaPermissions = {
  isSuperAdmin: false,
  isAdmin: false,
  isEntrepreneur: false,
  isEmployee: false
};

window.ummaIsSuperAdmin = false;


/* =====================================================
   TOAST
   ===================================================== */

let toastTimer;
function showToast(message) {
  if (!toast) return;
  clearTimeout(toastTimer);
  toast.textContent = window.ummaI18n?.t(message) ?? String(message);
  toast.setAttribute("aria-hidden","false");
  toast.classList.add("show");
  toastTimer=setTimeout(()=>{toast.classList.remove("show");toast.setAttribute("aria-hidden","true");},2600);
}


/* =====================================================
   NAVIGATION
   ===================================================== */

function openPage(page) {
  if(page === "b2b") { window.ummaB2B?.open(); return; }
  if(page === "market") { window.ummaMarket?.open(); return; }
  if(page === "notifications") {
    const bell=document.getElementById("cafeNotificationBell");
    if(bell&&!bell.hidden)bell.click();else showToast("Откройте приложение через Telegram, чтобы видеть уведомления");
    return;
  }
  if(!["home","cafe","orders"].includes(page)) {
    window.ummaNativeShell?.openService(page);return;
  }
  const ids=["adminPage","adminUsersPage","locationAdminPage","cafeProductsAdminPage","cafeStaffAdminPage","cafeWaiterPage","cafeKitchenPage","cafeInventoryPage","cafePage","cafeOrdersPage","cafeAccountingPage","marketPage","marketShopPage","b2bPage","rentPage","servicesPage"];
  ids.forEach(id=>{const el=document.getElementById(id);if(el)el.hidden=!((id==="cafePage"&&page==="cafe")||(id==="cafeOrdersPage"&&page==="orders"));});
  const home=document.querySelector(".app > main"),nav=document.querySelector(".bottom-nav");
  if(home)home.style.display=page==="home"?"":"none";
  if(nav)nav.style.display="";
  setActiveNav(page);
  if(page==="orders")window.ummaCafe?.openOrders();
  else if(page==="cafe")window.ummaCafe?.refreshMenu();
}

/* =====================================================
   SERVICE BUTTONS
   ===================================================== */

document
  .querySelectorAll("[data-page]")
  .forEach(button => {

    button.addEventListener("click", () => {

      const page =
        button.getAttribute("data-page");

      if(button.classList.contains('brand-art-action')){
        if(button.disabled)return;
        button.disabled=true;button.setAttribute('aria-busy','true');
        try{openPage(page);}finally{window.setTimeout(()=>{button.disabled=false;button.removeAttribute('aria-busy');},450);}
      }else openPage(page);

    });

  });


/* =====================================================
   BOTTOM NAV
   ===================================================== */

function setActiveNav(page) {

  document
    .querySelectorAll(".nav-item")
    .forEach(item => {

      item.classList.remove("active");item.removeAttribute("aria-current");

    });


  const active =
    document.querySelector(
      `.nav-item[data-page="${page}"]`
    );


  if (active) {

    active.classList.add("active");active.setAttribute("aria-current","page");

  }

}


/* =====================================================
   MENU
   ===================================================== */

menuBtn?.addEventListener("click", () => {

  showToast("Меню Umma Global");

});


/* =====================================================
   LANGUAGE
   ===================================================== */

languageBtn?.addEventListener("click", () => {

  window.ummaI18n?.openPicker();

});


/* =====================================================
   NOTIFICATIONS
   ===================================================== */

notificationBtn?.addEventListener("click", () => {

  showToast("Новых уведомлений: 3");

});


/* =====================================================
   PROFILE
   ===================================================== */

profileBtn?.addEventListener("click", () => {

  showToast("Профиль пользователя");

});


/* =====================================================
   ALL SERVICES
   ===================================================== */

allServicesBtn?.addEventListener("click", () => {

  openPage("more");

});


/* =====================================================
   TELEGRAM USER INTERFACE
   ===================================================== */

function updateTelegramUserInterface(user) {
  const title=document.querySelector('.welcome-content h2');
  if(!title)return;
  const name=String(tg?.initDataUnsafe?.user?.first_name||user?.first_name||'').replace(/\s+/gu,' ').trim();
  const firstLine=document.createElement('span');firstLine.className='greeting-first-line';firstLine.textContent='Ассаляму алейкум';
  const blessing=document.createElement('span');blessing.className='greeting-blessing';blessing.textContent=name?'ва рахматуллахи ва баракатуху,':'ва рахматуллахи ва баракатуху';
  title.replaceChildren(firstLine,blessing);
  if(name){const personal=document.createElement('strong');personal.className='greeting-name';personal.setAttribute('translate','no');personal.setAttribute('dir','auto');personal.textContent=name;title.append(personal);}
  window.ummaI18n?.translate(title);
}


/* =====================================================
   HTML ESCAPE
   ===================================================== */

function escapeHtml(value) {

  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


