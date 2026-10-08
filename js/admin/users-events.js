/* =====================================================
   ADMIN USERS BUTTON
   ===================================================== */

document.addEventListener(
  "click",
  event => {

    const adminCard =
      event.target.closest(
        ".admin-card"
      );


    if (!adminCard) return;


    const title =
      adminCard
        .querySelector("strong");


    if (!title) return;


    if (
      title.textContent.trim() ===
      "Пользователи"
    ) {

      loadAdminUsers();

    }

  }
);



/* =====================================================
   ADMIN — CHANGE USER ROLE
   ===================================================== */

document.addEventListener(
  "click",
  event => {

    const button =
      event.target.closest(
        ".umma-change-role"
      );


    if (!button) return;


    const userId =
      button.getAttribute(
        "data-user-id"
      );


    const users =
      window.ummaAdminUsers || [];


    const user =
      users.find(
        item =>
          String(item.id) ===
          String(userId)
      );


    if (!user) {

      showToast(
        "Пользователь не найден"
      );

      return;

    }


    openAdminRoleModal(user);

  }
);


