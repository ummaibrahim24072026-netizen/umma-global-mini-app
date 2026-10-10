/* =====================================================
   ADMIN USERS BUTTON
   ===================================================== */
document.addEventListener("click", event => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const adminCard = target.closest(".admin-card");
  if (!adminCard) return;

  const title = adminCard.querySelector("strong");
  if (!title || title.textContent.trim() !== "Пользователи") return;

  if (!isUmmaSuperAdmin()) {
    showToast("Доступ запрещён");
    closeAdminPanel();
    return;
  }

  loadAdminUsers();
});


/* =====================================================
   ADMIN — CHANGE USER ROLE
   ===================================================== */
document.addEventListener("click", event => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const button = target.closest(".umma-change-role");
  if (!button) return;

  if (!isUmmaSuperAdmin()) {
    showToast("Доступ запрещён");
    document.getElementById("ummaAdminUsersModal")?.remove();
    closeAdminPanel();
    return;
  }

  const userId = button.getAttribute("data-user-id");
  const users = window.ummaAdminUsers || [];
  const user = users.find(item => String(item.id) === String(userId));

  if (!user) {
    showToast("Пользователь не найден");
    return;
  }

  openAdminRoleModal(user);
});
