/* =====================================================
   APPLY USER ROLE
   ===================================================== */

function applyUserRole(
  user,
  permissions = null
) {

  if (!user) return;


  const role =
    user.role || "user";


  window.ummaUser =
    user;


  window.ummaRole =
    role;


  window.ummaIsSuperAdmin =
    role === "super_admin";


  if (permissions) {

    window.ummaPermissions = {

      isSuperAdmin:
        permissions.isSuperAdmin === true,

      isAdmin:
        permissions.isAdmin === true,

      isEntrepreneur:
        permissions.isEntrepreneur === true,

      isEmployee:
        permissions.isEmployee === true

    };

  } else {

    window.ummaPermissions = {

      isSuperAdmin:
        role === "super_admin",

      isAdmin:
        role === "admin" ||
        role === "super_admin",

      isEntrepreneur:
        role === "entrepreneur",

      isEmployee:
        role === "employee"

    };

  }


  if (document.body) {

    document.body.dataset.ummaRole =
      role;

  }


  updateAdminUI(role);


  console.log(
    "UMMA: пользователь:",
    user
  );


  console.log(
    "UMMA: роль:",
    role
  );


  console.log(
    "UMMA: permissions:",
    window.ummaPermissions
  );


  console.log(
    "UMMA: super_admin:",
    window.ummaIsSuperAdmin
  );

}


/* =====================================================
   TELEGRAM AUTHENTICATION
   ===================================================== */

async function authenticateTelegramUser() {

  console.log(
    "UMMA: начинаем Telegram авторизацию..."
  );


  if (!tg) {

    console.error(
      "UMMA: Telegram WebApp не обнаружен."
    );

    return;

  }


  const initData =
    tg.initData;


  if (!initData) {

    console.error(
      "UMMA: Telegram initData отсутствует."
    );

    showToast(
      "Откройте приложение через Telegram"
    );

    return;

  }


  console.log(
    "UMMA: Telegram initData получен"
  );


  if (tg.initDataUnsafe?.user) {

    updateTelegramUserInterface(
      tg.initDataUnsafe.user
    );

  }


  try {

    console.log(
      "UMMA: отправляем запрос:",
      TELEGRAM_AUTH_URL
    );


    const response =
      await fetch(

        TELEGRAM_AUTH_URL,

        {

          method: "POST",

          headers: {

            "Content-Type":
              "application/json"

          },

          body: JSON.stringify({

            initData:
              initData

          })

        }

      );


    console.log(
      "UMMA: ответ сервера:",
      response.status
    );


    const contentType =
      response.headers.get(
        "content-type"
      ) || "";


    let result;


    if (
      contentType.includes(
        "application/json"
      )
    ) {

      result =
        await response.json();

    } else {

      const text =
        await response.text();


      console.error(
        "UMMA: сервер вернул не JSON:",
        text
      );


      showToast(
        "Ошибка ответа сервера"
      );


      return;

    }


    if (!response.ok) {

      console.error(
        "UMMA: ошибка авторизации:",
        result
      );


      showToast(

        result?.error ||
        "Не удалось выполнить вход"

      );


      return;

    }


    if (
      result.ok &&
      result.user
    ) {

      applyUserRole(

        result.user,

        result.permissions

      );


      updateTelegramUserInterface(

        result.user

      );


      console.log(

        "UMMA: пользователь авторизован",

        result.user

      );


      console.log(

        "UMMA: роль:",

        result.user.role

      );


      console.log(

        "UMMA: права:",

        result.permissions

      );


      console.log(

        "UMMA: SUPER ADMIN UI:",

        result.user.role === "super_admin"

      );


      return;

    }


    console.error(

      "UMMA: сервер не вернул пользователя:",

      result

    );


    showToast(

      "Не удалось получить данные пользователя"

    );

  } catch (error) {

    console.error(

      "UMMA: ошибка соединения:",

      error

    );


    showToast(

      "Ошибка соединения с сервером"

    );

  }

}


