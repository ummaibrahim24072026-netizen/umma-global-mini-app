(() => {
  'use strict';

  const storageKey = 'umma-menu-avatar';
  const get = id => document.getElementById(id);
  const input = get('profileAvatarFile');
  const choose = get('chooseProfileAvatar');
  const remove = get('removeProfileAvatar');
  const status = get('profileAvatarStatus');
  const avatars = [get('topbarAvatar'), get('profileAvatar')];
  const placeholders = [get('topbarAvatarPlaceholder'), get('profileAvatarPlaceholder')];
  const t = window.ummaMenuI18n.t;
  const avatarPattern = /^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/]+=*$/;
  let avatar = '';
  let saving = false;
  let statusKey = '';
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored && avatarPattern.test(stored)) avatar = stored;
  } catch {}

  function render() {
    avatars.forEach((image, index) => {
      image.hidden = !avatar;
      if (avatar) image.src = avatar;
      else image.removeAttribute('src');
      placeholders[index].toggleAttribute('hidden', !!avatar);
    });
    choose.textContent = t(avatar ? 'Заменить фото' : 'Добавить фото');
    choose.disabled = saving;
    remove.hidden = !avatar;
    remove.disabled = saving;
    status.textContent = statusKey ? t(statusKey) : '';
  }

  async function resizePhoto(file) {
    const url = URL.createObjectURL(file);
    try {
      const source = new Image();
      source.src = url;
      await source.decode();
      const size = Math.min(source.naturalWidth, source.naturalHeight);
      if (!size) throw new Error('Empty image');

      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = Math.min(size, 256);
      const context = canvas.getContext('2d');
      context.drawImage(source, (source.naturalWidth - size) / 2, (source.naturalHeight - size) / 2,
        size, size, 0, 0, canvas.width, canvas.height);
      const photo = canvas.toDataURL('image/webp', 0.85);
      if (!avatarPattern.test(photo)) throw new Error('Image encoding failed');
      return photo;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  choose.addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.value = '';
    if (!file || saving) return;
    if (file.size > 20 * 1024 * 1024) {
      statusKey = 'Выберите фото размером до 20 МБ.';
      render();
      return;
    }
    saving = true;
    statusKey = '';
    render();
    try {
      const photo = await resizePhoto(file);
      try {
        localStorage.setItem(storageKey, photo);
        avatar = photo;
        statusKey = 'Фото сохранено.';
      } catch {
        statusKey = 'Не удалось сохранить фото на этом устройстве.';
      }
    } catch {
      statusKey = 'Не удалось открыть фото. Попробуйте JPG, PNG или WebP.';
    } finally {
      saving = false;
      render();
    }
  });
  remove.addEventListener('click', () => {
    try {
      localStorage.removeItem(storageKey);
      avatar = '';
      statusKey = 'Фото удалено.';
    } catch {
      statusKey = 'Не удалось сохранить фото на этом устройстве.';
    }
    render();
    choose.focus();
  });
  window.addEventListener('umma-menu:languagechange', render);
  render();
})();
