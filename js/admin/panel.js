/* =====================================================
   SUPER ADMIN UI
   ===================================================== */

function updateAdminUI(role) {

  const adminEntry =
    document.getElementById("adminEntry");

  if (!adminEntry) return;

  const isSuperAdmin =
    role === "super_admin";

  adminEntry.hidden = !isSuperAdmin;

  if (isSuperAdmin) {

    adminEntry.removeAttribute(
      "aria-hidden"
    );

  } else {

    adminEntry.setAttribute(
      "aria-hidden",
      "true"
    );

  }

}


/* =====================================================
   OPEN ADMIN PANEL
   ===================================================== */

function openAdminPanel() {

  if (window.ummaRole !== "super_admin") {

    showToast("Доступ запрещён");

    return;

  }


  const home =
    document.querySelector(".app > main");

  const adminPage =
    document.getElementById("adminPage");

  const adminUsersPage =
    document.getElementById("adminUsersPage");

  const bottomNav =
    document.querySelector(".bottom-nav");


  if (!adminPage) {

    console.warn(
      "UMMA: adminPage не найден"
    );

    return;

  }


  /* Закрываем страницу пользователей,
     если она была открыта */

  if (adminUsersPage) {

    adminUsersPage.hidden = true;

  }


  /* Скрываем главную */

  if (home) {

    home.style.display = "none";

  }


  /* Показываем админ-панель */

  adminPage.hidden = false;


  /* Скрываем нижнюю навигацию */

  if (bottomNav) {

    bottomNav.style.display = "none";

  }


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

}


/* =====================================================
   CLOSE ADMIN PANEL
   ===================================================== */

function closeAdminPanel() {

  const home =
    document.querySelector(".app > main");

  const adminPage =
    document.getElementById("adminPage");

  const adminUsersPage =
    document.getElementById("adminUsersPage");

  const bottomNav =
    document.querySelector(".bottom-nav");


  /* Закрываем страницу пользователей */

  if (adminUsersPage) {

    adminUsersPage.hidden = true;

  }


  /* Закрываем админ-панель */

  if (adminPage) {

    adminPage.hidden = true;

  }


  /* Возвращаем главную */

  if (home) {

    home.style.display = "";

  }


  /* Возвращаем нижнюю навигацию */

  if (bottomNav) {

    bottomNav.style.display = "";

  }


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

}


/* =====================================================
   ADMIN BUTTONS
   ===================================================== */

document.addEventListener("click", event => {

  /* Кнопка / карточка администрирования */

  const adminEntry =
    event.target.closest(
      "#adminEntry"
    );


  if (adminEntry) {

    openAdminPanel();

    return;

  }


  /* Кнопка Назад */

  const adminBack =
    event.target.closest(
      "#adminBack"
    );


  if (adminBack) {

    closeAdminPanel();

  }

});
