/* =====================================================
   ADMIN — USERS
   ===================================================== */

const ADMIN_USERS_URL =
  "https://zwzojugspldexyyljwpr.supabase.co/functions/v1/admin-users";

const ADMIN_USER_UPDATE_URL =
  "https://zwzojugspldexyyljwpr.supabase.co/functions/v1/admin-user-update";


async function loadAdminUsers() {

  if (window.ummaRole !== "super_admin") {

    showToast("Доступ запрещён");

    return;

  }


  if (!tg || !tg.initData) {

    showToast(
      "Откройте Umma Global через Telegram"
    );

    return;

  }


  showToast("Загружаем пользователей...");


  try {

    const response =
      await fetch(
        ADMIN_USERS_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            initData:
              tg.initData
          })
        }
      );


    const result =
      await response.json();


    if (!response.ok) {

      console.error(
        "UMMA: ошибка загрузки пользователей:",
        result
      );

      showToast(
        result?.error ||
        "Не удалось загрузить пользователей"
      );

      return;

    }


    if (
      !result.ok ||
      !Array.isArray(result.users)
    ) {

      console.error(
        "UMMA: неверный ответ admin-users:",
        result
      );

      showToast(
        "Сервер вернул неверные данные"
      );

      return;

    }


    window.ummaAdminUsers =
      result.users;


    renderAdminUsers(
      result.users
    );


  } catch (error) {

    console.error(
      "UMMA: ошибка соединения admin-users:",
      error
    );

    showToast(
      "Ошибка соединения с сервером"
    );

  }

}


async function updateAdminUserRole(userId, role) {

  if (window.ummaRole !== "super_admin") {

    showToast("Доступ запрещён");

    return;

  }


  if (!tg || !tg.initData) {

    showToast(
      "Откройте Umma Global через Telegram"
    );

    return;

  }


  try {

    showToast("Сохраняем роль...");


    const response =
      await fetch(
        ADMIN_USER_UPDATE_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            initData: tg.initData,
            userId: userId,
            role: role
          })
        }
      );


    const result =
      await response.json();


    if (!response.ok || !result.ok) {

      console.error(
        "UMMA: ошибка изменения роли:",
        result
      );

      showToast(
        result?.error ||
        "Не удалось изменить роль"
      );

      return;

    }


    showToast("Роль успешно изменена");

    const modal =
      document.getElementById(
        "ummaAdminRoleModal"
      );

    if (modal) {

      modal.remove();

    }

    await loadAdminUsers();

  } catch (error) {

    console.error(
      "UMMA: ошибка соединения admin-user-update:",
      error
    );

    showToast(
      "Ошибка соединения с сервером"
    );

  }

}


