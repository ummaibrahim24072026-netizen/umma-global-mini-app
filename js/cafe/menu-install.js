(() => {
  'use strict';

  const displayMode = window.matchMedia?.('(display-mode: standalone)');
  let installPrompt = null;
  let opening = false;
  let button;

  function render() {
    if (!button) return;
    button.hidden = navigator.standalone === true || displayMode?.matches === true ||
      (!installPrompt && !opening);
    button.disabled = opening;
  }

  // Capture the browser's offer even if the menu is still being parsed.
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    render();
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    opening = false;
    render();
  });
  displayMode?.addEventListener?.('change', render);

  document.addEventListener('DOMContentLoaded', () => {
    button = document.getElementById('installApp');
    if (!button) return;
    button.addEventListener('click', async () => {
      if (!installPrompt || opening) return;
      const prompt = installPrompt;
      installPrompt = null;
      opening = true;
      render();
      try {
        await prompt.prompt();
        await prompt.userChoice;
      } catch {
        // The browser may withdraw the offer before the user confirms it.
      } finally {
        opening = false;
        render();
      }
    });
    render();
  }, {once: true});
})();
