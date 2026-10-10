/* =====================================================
   SUPER ADMIN UI AND CLIENT-SIDE ACCESS GUARDS
   ===================================================== */

/*
 * This is a UI safeguard only. Sensitive data and mutations
 * must also be authorized by the Supabase Edge Functions.
 */
function isUmmaSuperAdmin() {
  return (
    window.ummaRole === "super_admin" &&
    window.ummaPermissions?.isSuperAdmin === true
  );
}


function updateAdminUI(role) {
  const adminEntry = document.getElementById("adminEntry");
  const adminPage = document.getElementById("adminPage");
  const adminUsersPage = document.getElementById("adminUsersPage");
  const isSuperAdmin =
    role === "super_admin" &&
    window.ummaPermissions?.isSuperAdmin === true;

  if (adminEntry) {
    adminEntry.hidden = !isSuperAdmin;
    adminEntry.setAttribute("aria-hidden", String(!isSuperAdmin));
  }

  /*
   * Keep protected views closed until the server-confirmed role
   * has been applied. Also close them if access is lost.
   */
  if (!isSuperAdmin) {
    if (adminPage) adminPage.hidden = true;
    if (adminUsersPage) adminUsersPage.hidden = true;

    document.getElementById("ummaAdminUsersModal")?.remove();
    document.getElementById("ummaAdminRoleModal")?.remove();

    const home = document.querySelector(".app > main");
    const bottomNav = document.querySelector(".bottom-nav");

    if (home) home.style.display = "";
    if (bottomNav) bottomNav.style.display = "";
  }
}


/* =====================================================
   OPEN ADMIN PANEL
   ===================================================== */
function openAdminPanel() {
  if (!isUmmaSuperAdmin()) {
    closeAdminPanel();
    showToast("Доступ запрещён");
    return;
  }

  const home = document.querySelector(".app > main");
  const adminPage = document.getElementById("adminPage");
  const adminUsersPage = document.getElementById("adminUsersPage");
  const bottomNav = document.querySelector(".bottom-nav");

  if (!adminPage) {
    console.warn("UMMA: adminPage не найден");
    return;
  }

  if (adminUsersPage) adminUsersPage.hidden = true;
  if (home) home.style.display = "none";

  adminPage.hidden = false;

  if (bottomNav) bottomNav.style.display = "none";

  window.scrollTo({ top: 0, behavior: "smooth" });
}


/* =====================================================
   CLOSE ADMIN PANEL
   ===================================================== */
function closeAdminPanel() {
  const home = document.querySelector(".app > main");
  const adminPage = document.getElementById("adminPage");
  const adminUsersPage = document.getElementById("adminUsersPage");
  const bottomNav = document.querySelector(".bottom-nav");

  if (adminUsersPage) adminUsersPage.hidden = true;
  if (adminPage) adminPage.hidden = true;

  document.getElementById("ummaAdminUsersModal")?.remove();
  document.getElementById("ummaAdminRoleModal")?.remove();

  if (home) home.style.display = "";
  if (bottomNav) bottomNav.style.display = "";

  window.scrollTo({ top: 0, behavior: "smooth" });
}


/* =====================================================
   ADMIN BUTTONS
   ===================================================== */
document.addEventListener("click", event => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  if (target.closest("#adminEntry")) {
    if (!isUmmaSuperAdmin()) {
      showToast("Доступ запрещён");
      return;
    }

    openAdminPanel();
    return;
  }

  if (target.closest("#adminBack")) {
    closeAdminPanel();
  }
});
