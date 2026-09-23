/* =====================================================
   UMMA GLOBAL
   Telegram Mini App
   ===================================================== */

const tg = window.Telegram?.WebApp;


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

const toast = document.getElementById("toast");

const menuBtn = document.getElementById("menuBtn");

const languageBtn =
  document.getElementById("languageBtn");

const notificationBtn =
  document.getElementById("notificationBtn");

const profileBtn =
  document.getElementById("profileBtn");

const allServicesBtn =
  document.getElementById("allServicesBtn");


/* =====================================================
   TOAST
   ===================================================== */

function showToast(message) {

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

  const names = {

    home: "Главная",

    cafe: "Кафе Umma",

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


  if (page === "home") {

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

    setActiveNav("home");

    return;
  }


  showToast(
    `${names[page] || "Раздел"} — скоро будет доступен`
  );

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
   TELEGRAM USER
   ===================================================== */

function updateTelegramUser() {

  if (!tg?.initDataUnsafe?.user) {
    return;
  }


  const user =
    tg.initDataUnsafe.user;


  const firstName =
    user.first_name || "";


  const welcomeTitle =
    document.querySelector(".welcome-text h2");


  if (welcomeTitle && firstName) {

    welcomeTitle.textContent =
      `Ас-саляму алейкум, ${firstName}!`;

  }

}


updateTelegramUser();


/* =====================================================
   HAPTIC FEEDBACK
   ===================================================== */

document
  .querySelectorAll("button")
  .forEach(button => {

    button.addEventListener("click", () => {

      try {

        tg?.HapticFeedback?.impactOccurred("light");

      } catch (error) {}

    });

  });
