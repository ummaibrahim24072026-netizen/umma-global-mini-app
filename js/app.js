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


/* =====================================================
   ADMIN — USERS
   ===================================================== */

const ADMIN_USERS_URL =
  "https://zwzojugspldexyyljwpr.supabase.co/functions/v1/admin-users";


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


function renderAdminUsers(users) {

  const existing =
    document.getElementById(
      "ummaAdminUsersModal"
    );


  if (existing) {

    existing.remove();

  }


  const modal =
    document.createElement("div");

  modal.id =
    "ummaAdminUsersModal";


  modal.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 99999;
    background: rgba(0,0,0,.45);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 24px 14px;
    overflow-y: auto;
  `;


  const panel =
    document.createElement("div");

  panel.style.cssText = `
    width: 100%;
    max-width: 720px;
    background: #ffffff;
    border-radius: 20px;
    padding: 20px;
    box-shadow: 0 20px 60px rgba(0,0,0,.2);
  `;


  const header =
    document.createElement("div");

  header.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 18px;
  `;


  const title =
    document.createElement("div");

  title.innerHTML = `
    <div style="
      font-size:12px;
      font-weight:700;
      letter-spacing:.08em;
      color:#888;
      margin-bottom:4px;
    ">
      UMMA GLOBAL
    </div>

    <div style="
      font-size:24px;
      font-weight:800;
      color:#173f3d;
    ">
      Пользователи
    </div>

    <div style="
      font-size:14px;
      color:#777;
      margin-top:4px;
    ">
      Всего: ${users.length}
    </div>
  `;


  const closeButton =
    document.createElement("button");

  closeButton.type = "button";

  closeButton.textContent = "✕";

  closeButton.style.cssText = `
    width:40px;
    height:40px;
    border:0;
    border-radius:12px;
    background:#edfafa;
    color:#173f3d;
    font-size:20px;
    cursor:pointer;
    flex:none;
  `;


  closeButton.addEventListener(
    "click",
    () => modal.remove()
  );


  header.appendChild(title);
  header.appendChild(closeButton);


  panel.appendChild(header);


  if (!users.length) {

    const empty =
      document.createElement("div");

    empty.textContent =
      "Пользователей пока нет.";

    empty.style.cssText = `
      padding:30px 10px;
      text-align:center;
      color:#777;
    `;

    panel.appendChild(empty);

  } else {

    users.forEach(
      user => {

        const card =
          document.createElement("div");

        card.style.cssText = `
          padding:14px 0;
          border-top:1px solid #eeeeee;
        `;


        const name =
          [
            user.first_name,
            user.last_name
          ]
            .filter(Boolean)
            .join(" ")
          ||
          "Без имени";


        const username =
          user.username
            ? `@${user.username}`
            : "без username";


        const role =
          user.role || "user";


        const status =
          user.is_active
            ? "Активен"
            : "Отключён";


        card.innerHTML = `
          <div style="
            display:flex;
            justify-content:space-between;
            gap:12px;
            align-items:flex-start;
          ">

            <div>

              <div style="
                font-size:16px;
                font-weight:700;
                color:#173f3d;
              ">
                ${escapeHtml(name)}
              </div>

              <div style="
                font-size:13px;
                color:#777;
                margin-top:4px;
              ">
                ${escapeHtml(username)}
              </div>

              <div style="
                font-size:12px;
                color:#999;
                margin-top:4px;
              ">
                Telegram ID:
                ${escapeHtml(String(user.telegram_id))}
              </div>

            </div>

            <div style="
              text-align:right;
              flex:none;
            ">

              <div style="
                font-size:12px;
                font-weight:700;
                color:#173f3d;
              ">
                ${escapeHtml(role)}
              </div>

              <div style="
                font-size:12px;
                color:#777;
                margin-top:4px;
              ">
                ${escapeHtml(status)}
              </div>

            </div>

          </div>
        `;


        panel.appendChild(card);

      }
    );

  }


  modal.appendChild(panel);

  document.body.appendChild(modal);


  modal.addEventListener(
    "click",
    event => {

      if (
        event.target === modal
      ) {

        modal.remove();

      }

    }
  );

}


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


/* =====================================================
   INITIAL ADMIN UI STATE
   ===================================================== */

updateAdminUI(
  window.ummaRole
);


/* =====================================================
   START TELEGRAM AUTH
   ===================================================== */

authenticateTelegramUser();


/* =====================================================
   HAPTIC FEEDBACK
   ===================================================== */

document
  .querySelectorAll("button")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        try {

          tg?.HapticFeedback?.impactOccurred(
            "light"
          );

        } catch (error) {}

      }
    );

  });
