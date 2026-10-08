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

  if (!isSuperAdmin) {

    adminEntry.setAttribute(
      "aria-hidden",
      "true"
    );

  } else {

    adminEntry.removeAttribute(
      "aria-hidden"
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
    document.querySelector(".home");

  const adminPage =
    document.getElementById("adminPage");

  const bottomNav =
    document.querySelector(".bottom-nav");


  if (!adminPage) return;


  if (home) {

    home.style.display = "none";

  }


  adminPage.hidden = false;


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
    document.querySelector(".home");

  const adminPage =
    document.getElementById("adminPage");

  const bottomNav =
    document.querySelector(".bottom-nav");


  if (adminPage) {

    adminPage.hidden = true;

  }


  if (home) {

    home.style.display = "";

  }


  if (bottomNav) {

    bottomNav.style.display = "";

  }


  window.scrollTo({

    top: 0,

    behavior: "smooth"

  });

}


/* =====================================================
   ADMIN BUTTON
   ===================================================== */

document.addEventListener("click", event => {

  const adminEntry =
    event.target.closest("#adminEntry");


  if (adminEntry) {

    openAdminPanel();

    return;

  }


  const adminBack =
    event.target.closest("#adminBack");


  if (adminBack) {

    closeAdminPanel();

  }

});


