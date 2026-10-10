/* UMMA CAFE — SUPER-ADMIN STAFF ASSIGNMENTS */
(() => {
  "use strict";
  const API = "https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-staff-admin";
  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" })[c]);
  const roleNames = { manager:"Менеджер", cashier:"Кассир", waiter:"Официант", kitchen:"Кухня" };
  let staff = [], users = [], locations = [], busy = false;

  function isSuperAdmin() {
    return typeof isUmmaSuperAdmin === "function" && isUmmaSuperAdmin();
  }
  function showMessage(text, visible = true) {
    const el = byId("cafeStaffAdminMessage");
    if (el) { el.textContent = text; el.hidden = !visible; }
  }
  async function api(payload) {
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData) throw new Error("Откройте приложение через Telegram");
    const response = await fetch(API, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ ...payload, initData })
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Ошибка запроса");
    return result;
  }
  function populateLocations() {
    const select = byId("cafeStaffLocation");
    if (!select) return;
    const active = locations.filter(location => location.is_active);
    select.innerHTML = '<option value="">Выберите кафе</option>' + active.map(location =>
      '<option value="' + esc(location.id) + '">' + esc(location.name) + (location.city ? " — " + esc(location.city) : "") + '</option>'
    ).join("");
  }
  function renderStaff() {
    const root = byId("cafeStaffAssignments");
    if (!root) return;
    if (!staff.length) {
      root.innerHTML = '<div class="cafe-message">Сотрудники пока не назначены.</div>';
      return;
    }
    const userById = new Map(users.map(user => [String(user.telegram_id), user]));
    const locationById = new Map(locations.map(location => [String(location.id), location]));
    root.innerHTML = staff.map(assignment => {
      const user = userById.get(String(assignment.telegram_id));
      const location = locationById.get(String(assignment.location_id));
      const name = user ? [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || String(user.telegram_id) : String(assignment.telegram_id);
      const status = assignment.is_active ? "Активен" : "Отключён";
      const action = assignment.is_active
        ? '<button type="button" class="cafe-staff-deactivate" data-deactivate-assignment="' + esc(assignment.id) + '">Отключить</button>'
        : '<span class="cafe-staff-inactive">Отключён</span>';
      return '<article class="cafe-staff-card"><div class="cafe-staff-card-head"><div><strong>' + esc(name) + '</strong><small>Telegram ID: ' + esc(assignment.telegram_id) + '</small></div><span class="cafe-staff-role">' + esc(roleNames[assignment.staff_role] || assignment.staff_role) + '</span></div><p>' + esc(location?.name || "Кафе не найдено") + (location?.city ? " · " + esc(location.city) : "") + '</p><div class="cafe-staff-card-foot"><span class="' + (assignment.is_active ? "cafe-staff-active" : "cafe-staff-inactive") + '">' + status + '</span>' + action + '</div></article>';
    }).join("");
  }
  async function loadStaff() {
    if (busy) return;
    if (!isSuperAdmin()) { showMessage("Доступ только для суперадминистратора"); return; }
    busy = true;
    showMessage("Загружаем список сотрудников…");
    try {
      const result = await api({ action:"list" });
      staff = Array.isArray(result.staff) ? result.staff : [];
      users = Array.isArray(result.users) ? result.users : [];
      locations = Array.isArray(result.locations) ? result.locations : [];
      populateLocations();
      renderStaff();
      showMessage("", false);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Не удалось загрузить сотрудников");
    } finally { busy = false; }
  }
  function open() {
    if (!isSuperAdmin()) { if (typeof showToast === "function") showToast("Доступ запрещён"); return; }
    const home = document.querySelector(".app > main");
    const admin = byId("adminPage"), usersPage = byId("adminUsersPage"), staffPage = byId("cafeStaffAdminPage"), kitchen = byId("cafeKitchenPage"), cafe = byId("cafePage");
    const nav = document.querySelector(".bottom-nav");
    if (home) home.style.display = "none";
    if (admin) admin.hidden = true;
    if (usersPage) usersPage.hidden = true;
    if (kitchen) kitchen.hidden = true;
    if (cafe) cafe.hidden = true;
    if (staffPage) staffPage.hidden = false;
    if (nav) nav.style.display = "none";
    loadStaff();
    window.scrollTo({ top:0, behavior:"smooth" });
  }

  byId("adminStaffButton")?.addEventListener("click", open);
  byId("cafeStaffAdminBack")?.addEventListener("click", () => {
    if (byId("cafeStaffAdminPage")) byId("cafeStaffAdminPage").hidden = true;
    if (typeof openAdminPanel === "function") openAdminPanel();
  });
  byId("cafeStaffAdminRefresh")?.addEventListener("click", loadStaff);
  byId("cafeStaffAssignForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy) return;
    if (!isSuperAdmin()) { showMessage("Доступ запрещён"); return; }
    const telegramId = byId("cafeStaffTelegramId")?.value.trim();
    const locationId = byId("cafeStaffLocation")?.value;
    const staffRole = byId("cafeStaffRole")?.value;
    if (!telegramId || !locationId || !staffRole) { showMessage("Заполните все поля"); return; }
    busy = true;
    const submit = byId("cafeStaffAssignSubmit");
    if (submit) { submit.disabled = true; submit.textContent = "Сохраняем…"; }
    showMessage("Сохраняем назначение…");
    try {
      await api({ action:"assign", telegramId, locationId, staffRole });
      if (byId("cafeStaffTelegramId")) byId("cafeStaffTelegramId").value = "";
      showMessage("Назначение сохранено.");
      const result = await api({ action:"list" });
      staff = Array.isArray(result.staff) ? result.staff : [];
      users = Array.isArray(result.users) ? result.users : [];
      locations = Array.isArray(result.locations) ? result.locations : [];
      populateLocations();
      renderStaff();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Не удалось сохранить назначение");
    } finally {
      busy = false;
      if (submit) { submit.disabled = false; submit.textContent = "Сохранить назначение"; }
    }
  });
  byId("cafeStaffAssignments")?.addEventListener("click", async event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest("[data-deactivate-assignment]");
    if (!button || busy || !isSuperAdmin()) return;
    const assignmentId = button.getAttribute("data-deactivate-assignment");
    if (!assignmentId) return;
    busy = true;
    showMessage("Отключаем доступ…");
    try {
      await api({ action:"deactivate", assignmentId });
      staff = staff.map(item => item.id === assignmentId ? { ...item, is_active:false } : item);
      renderStaff();
      showMessage("Доступ сотрудника отключён.");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Не удалось отключить доступ");
    } finally { busy = false; }
  });
  window.ummaCafeStaffAdmin = { open, refresh:loadStaff };
})();