(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const t = window.ummaMenuI18n.t;

  function bindField({key, form, field, save, status, messages, onSave}) {
    const input = $(field);
    const button = $(save);
    const feedback = $(status);
    let savedValue = null;
    let statusKey = '';

    try {
      savedValue = localStorage.getItem(key)?.trim().slice(0, input.maxLength) ?? null;
    } catch {}
    input.value = savedValue ?? '';

    function renderStatus() {
      feedback.textContent = statusKey ? t(statusKey) : '';
    }

    input.addEventListener('input', () => {
      button.disabled = input.value.trim() === (savedValue ?? '');
      statusKey = '';
      renderStatus();
    });
    $(form).addEventListener('submit', event => {
      event.preventDefault();
      const value = input.value.trim().slice(0, input.maxLength);
      try {
        localStorage.setItem(key, value);
        savedValue = input.value = value;
        button.disabled = true;
        statusKey = value ? messages.saved : messages.removed;
      } catch {
        statusKey = messages.failed;
        renderStatus();
        return;
      }
      renderStatus();
      onSave?.();
    });
    window.addEventListener('umma-menu:languagechange', renderStatus);
    return () => savedValue;
  }

  window.ummaMenuProfileName = bindField({
    key: 'umma-menu-profile-name', form: 'profileNameForm', field: 'profileDisplayName',
    save: 'saveProfileName', status: 'profileNameStatus',
    messages: {
      saved: 'Имя сохранено.', removed: 'Имя удалено.',
      failed: 'Не удалось сохранить имя на этом устройстве.',
    },
  });
  window.ummaMenuProfilePhone = bindField({
    key: 'umma-menu-profile-delivery-phone', form: 'profilePhoneForm', field: 'profileDeliveryPhone',
    save: 'saveProfilePhone', status: 'profilePhoneStatus',
    messages: {
      saved: 'Номер сохранён.', removed: 'Номер удалён.',
      failed: 'Не удалось сохранить номер на этом устройстве.',
    },
    onSave: () => window.dispatchEvent(new Event('umma-menu:profile-phone-change')),
  });
})();
