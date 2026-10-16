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
  if(page === "notifications") {
    const bell=document.getElementById("cafeNotificationBell");
    if(bell&&!bell.hidden)bell.click();else showToast("Откройте приложение через Telegram, чтобы видеть уведомления");
    return;
  }
  if(!["home","cafe","orders"].includes(page)) {
    window.ummaNativeShell?.openService(page);return;
  }
  const ids=["adminPage","adminUsersPage","locationAdminPage","cafeProductsAdminPage","cafeStaffAdminPage","cafeWaiterPage","cafeKitchenPage","cafeInventoryPage","cafePage","cafeOrdersPage","cafeAccountingPage","servicesPage"];
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

      openPage(page);

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

  if (!user) return;


  const firstName =
    String(user.first_name || "").trim();


  const welcomeTitle =
    document.querySelector(
      ".welcome-content h2"
    );


  if (!welcomeTitle) {

    console.warn(
      "UMMA: блок приветствия не найден"
    );

    return;

  }


  if (firstName) {

    welcomeTitle.innerHTML =
      `Ассаляму алейкум<br>
       ва рахматуллахи ва баракатух,<br>
       <strong translate="no" dir="auto">${escapeHtml(firstName)}!</strong>`;

  } else {

    welcomeTitle.innerHTML =
      `Ассаляму алейкум<br>
       ва рахматуллахи ва баракатух!`;

  }

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


