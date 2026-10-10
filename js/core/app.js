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

  tg.ready();

  tg.expand();

  tg.setHeaderColor("#ffffff");

  tg.setBackgroundColor("#edfafa");

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

function showToast(message) {

  if (!toast) return;

  toast.textContent = message;

  toast.classList.add("show");

  setTimeout(() => {

    toast.classList.remove("show");

  }, 2200);

}


/* =====================================================
   NAVIGATION
   ===================================================== */

function openPage(page) {
  const home = document.querySelector(".app > main");
  const cafePage = document.getElementById("cafePage");
  const adminPage = document.getElementById("adminPage");
  const adminUsersPage = document.getElementById("adminUsersPage");
  const bottomNav = document.querySelector(".bottom-nav");

  if (page === "home") {
    if (home) home.style.display = "";
    if (cafePage) cafePage.hidden = true;
    if (adminPage) adminPage.hidden = true;
    if (adminUsersPage) adminUsersPage.hidden = true;
    if (bottomNav) bottomNav.style.display = "";
    setActiveNav("home");
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  if (page === "cafe") {
    if (home) home.style.display = "none";
    if (adminPage) adminPage.hidden = true;
    if (adminUsersPage) adminUsersPage.hidden = true;
    if (cafePage) cafePage.hidden = false;
    if (bottomNav) bottomNav.style.display = "";
    setActiveNav("cafe");
    if (window.ummaCafe && typeof window.ummaCafe.refreshMenu === "function") {
      window.ummaCafe.refreshMenu();
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  const names = {
    market: "Рынок Umma",
    travel: "Путешествия",
    hotels: "Отели Umma",
    realestate: "Недвижимость",
    community: "Сообщество",
    business: "Бизнес",
    education: "Образование",
    health: "Здоровье",
    services: "Услуги",
    more: "Дополнительные сервисы"
  };

  showToast(`${names[page] || "Раздел"} — скоро будет доступен`);
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

      item.classList.remove("active");

    });


  const active =
    document.querySelector(
      `.nav-item[data-page="${page}"]`
    );


  if (active) {

    active.classList.add("active");

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

  showToast("Выбор языка");

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

  showToast("Все сервисы Umma");

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
       <strong>${escapeHtml(firstName)}!</strong>`;

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


