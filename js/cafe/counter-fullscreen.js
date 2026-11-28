(() => {
  'use strict';

  const root = document.documentElement;
  const button = document.getElementById('counterFullscreen');
  const help = document.getElementById('counterFullscreenHelp');
  const standalone = window.matchMedia?.('(display-mode: standalone)');
  const fullscreen = window.matchMedia?.('(display-mode: fullscreen)');
  const installed = () => navigator.standalone === true || standalone?.matches || fullscreen?.matches;
  let wanted = false;
  let ownsFullscreen = false;
  let pending;

  function update() {
    button.hidden = Boolean(installed() || document.fullscreenElement);
    if (!document.fullscreenElement) ownsFullscreen = false;
  }

  function leave() {
    wanted = false;
    if (!ownsFullscreen || document.fullscreenElement !== root) return;
    void document.exitFullscreen().catch(() => {});
  }

  async function enter() {
    if (installed() || document.fullscreenElement) return true;
    if (!root.requestFullscreen) return false;

    wanted = true;
    if (pending) return pending.then(() => ownsFullscreen, () => false);
    try {
      pending = root.requestFullscreen();
      await pending;
      ownsFullscreen = document.fullscreenElement === root;
      if (!wanted) leave();
      return ownsFullscreen;
    } catch {
      return false;
    } finally {
      pending = null;
      update();
    }
  }

  button.addEventListener('click', async () => {
    if (!await enter() && document.body.dataset.workspace === 'pos') help.showModal();
  });
  document.addEventListener('umma:staff-tab', event => {
    if (!['pos', 'workModes'].includes(event.detail)) leave();
  });
  document.addEventListener('fullscreenchange', update);
  standalone?.addEventListener?.('change', update);
  fullscreen?.addEventListener?.('change', update);

  update();
  window.ummaCounterFullscreen = {enter, leave};
})();
