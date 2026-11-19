(() => {
  'use strict';

  const storageKey = 'umma-menu-avatar';
  const pendingRemovalKey = 'umma-menu-avatar-remove';
  const chatTokenKey = 'umma:connect:token:v1';
  const chatApi = 'https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-connect';
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
  let syncedPhoto;
  let syncedToken;
  let syncingPhoto = false;
  let saving = false;
  let statusKey = '';
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored && avatarPattern.test(stored)) avatar = stored;
  } catch {}

  async function syncChatAvatar() {
    if (syncingPhoto || navigator.onLine === false) return;
    let token, photo, latest;
    try {
      token = localStorage.getItem(chatTokenKey);
      latest = localStorage.getItem(storageKey);
      photo = latest && avatarPattern.test(latest) ? latest : null;
      if (token === syncedToken && photo === syncedPhoto) return;
      if (!token || (!photo && !localStorage.getItem(pendingRemovalKey))) return;
      syncingPhoto = true;
      const body = JSON.stringify({action:'avatar',token,avatar:photo});
      const response = await fetch(chatApi, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body,
        keepalive:body.length <= 60_000,
        signal:AbortSignal.timeout?.(15000)
      });
      if (response.ok && (await response.json()).ok) {
        syncedPhoto = photo;
        syncedToken = token;
        if (!photo && !localStorage.getItem(storageKey)) localStorage.removeItem(pendingRemovalKey);
      }
    } catch {} finally {
      if (syncingPhoto) {
        syncingPhoto = false;
        try {
          if (latest !== localStorage.getItem(storageKey) || token !== localStorage.getItem(chatTokenKey)) {
            void syncChatAvatar();
          }
        } catch {}
      }
    }
  }
  window.ummaMenuSyncChatAvatar = syncChatAvatar;

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
        void syncChatAvatar();
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
      localStorage.setItem(pendingRemovalKey, '1');
      localStorage.removeItem(storageKey);
      avatar = '';
      statusKey = 'Фото удалено.';
      void syncChatAvatar();
    } catch {
      statusKey = 'Не удалось сохранить фото на этом устройстве.';
    }
    render();
    choose.focus();
  });
  window.addEventListener('storage', event => {
    if (event.key === chatTokenKey) {
      void syncChatAvatar();
      return;
    }
    if (event.key !== storageKey) return;
    avatar = event.newValue && avatarPattern.test(event.newValue) ? event.newValue : '';
    render();
    void syncChatAvatar();
  });
  window.addEventListener('pageshow', syncChatAvatar);
  window.addEventListener('online', syncChatAvatar);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void syncChatAvatar();
  });
  window.addEventListener('umma-menu:languagechange', render);
  render();
  void syncChatAvatar();
})();
