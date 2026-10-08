function openAdminRoleModal(user) {

  const existing =
    document.getElementById(
      "ummaAdminRoleModal"
    );


  if (existing) {

    existing.remove();

  }


  const modal =
    document.createElement("div");

  modal.id =
    "ummaAdminRoleModal";

  modal.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 100000;
    background: rgba(0,0,0,.45);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  `;


  const panel =
    document.createElement("div");

  panel.style.cssText = `
    width: 100%;
    max-width: 420px;
    background: #ffffff;
    border-radius: 20px;
    padding: 22px;
    box-shadow: 0 20px 60px rgba(0,0,0,.25);
  `;


  const name =
    [
      user.first_name,
      user.last_name
    ]
      .filter(Boolean)
      .join(" ")
    || "Без имени";


  panel.innerHTML = `
    <div style="
      font-size:12px;
      font-weight:700;
      letter-spacing:.08em;
      color:#888;
      margin-bottom:5px;
    ">
      UMMA GLOBAL
    </div>

    <div style="
      font-size:22px;
      font-weight:800;
      color:#173f3d;
    ">
      Изменить роль
    </div>

    <div style="
      margin-top:8px;
      font-size:15px;
      color:#555;
    ">
      ${escapeHtml(name)}
    </div>

    <div style="
      margin-top:18px;
      font-size:13px;
      font-weight:700;
      color:#173f3d;
    ">
      Роль пользователя
    </div>

    <select id="ummaAdminRoleSelect" style="
      width:100%;
      margin-top:8px;
      padding:13px 14px;
      border:1px solid #d9e4e4;
      border-radius:12px;
      background:#fff;
      color:#173f3d;
      font-size:15px;
    ">
      <option value="user">Пользователь</option>
      <option value="entrepreneur">Предприниматель</option>
      <option value="employee">Сотрудник</option>
      <option value="admin">Администратор</option>
    </select>

    <div style="
      display:flex;
      gap:10px;
      margin-top:18px;
    ">
      <button id="ummaAdminRoleCancel" type="button" style="
        flex:1;
        padding:13px;
        border:0;
        border-radius:12px;
        background:#edfafa;
        color:#173f3d;
        font-weight:700;
        cursor:pointer;
      ">
        Отмена
      </button>

      <button id="ummaAdminRoleSave" type="button" style="
        flex:1;
        padding:13px;
        border:0;
        border-radius:12px;
        background:#0fa3a8;
        color:#fff;
        font-weight:700;
        cursor:pointer;
      ">
        Сохранить
      </button>
    </div>
  `;


  modal.appendChild(panel);

  document.body.appendChild(modal);


  const select =
    document.getElementById(
      "ummaAdminRoleSelect"
    );

  select.value =
    user.role || "user";


  document
    .getElementById("ummaAdminRoleCancel")
    .addEventListener(
      "click",
      () => modal.remove()
    );


  document
    .getElementById("ummaAdminRoleSave")
    .addEventListener(
      "click",
      () => {
        updateAdminUserRole(
          user.id,
          select.value
        );
      }
    );


  modal.addEventListener(
    "click",
    event => {
      if (event.target === modal) {
        modal.remove();
      }
    }
  );

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

              ${
                user.telegram_id === tg?.initDataUnsafe?.user?.id
                  ? ""
                  : `
                    <button
                      type="button"
                      class="umma-change-role"
                      data-user-id="${escapeHtml(String(user.id))}"
                      style="
                        margin-top:9px;
                        padding:7px 10px;
                        border:0;
                        border-radius:9px;
                        background:#edfafa;
                        color:#173f3d;
                        font-size:11px;
                        font-weight:700;
                        cursor:pointer;
                      "
                    >
                      Изменить роль
                    </button>
                  `
              }

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


