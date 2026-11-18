(() => {
  'use strict';

  const storageKey = 'umma-menu-profile-name';
  const form = document.getElementById('profileNameForm');
  const field = document.getElementById('profileDisplayName');
  const save = document.getElementById('saveProfileName');
  const status = document.getElementById('profileNameStatus');
  const t = window.ummaMenuI18n.t;
  let savedName = '';
  let statusKey = '';
  try {
    savedName = (localStorage.getItem(storageKey) || '').trim().slice(0, field.maxLength);
  } catch {}
  field.value = savedName;

  function renderStatus() {
    status.textContent = statusKey ? t(statusKey) : '';
  }

  field.addEventListener('input', () => {
    save.disabled = field.value.trim() === savedName;
    statusKey = '';
    renderStatus();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const name = field.value.trim().slice(0, field.maxLength);
    try {
      if (name) localStorage.setItem(storageKey, name);
      else localStorage.removeItem(storageKey);
      savedName = field.value = name;
      save.disabled = true;
      statusKey = name ? 'Имя сохранено.' : 'Имя удалено.';
    } catch {
      statusKey = 'Не удалось сохранить имя на этом устройстве.';
    }
    renderStatus();
  });
  window.addEventListener('umma-menu:languagechange', renderStatus);
})();
