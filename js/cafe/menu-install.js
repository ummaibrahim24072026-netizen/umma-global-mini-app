(() => {
  'use strict';

  const displayMode = window.matchMedia?.('(display-mode: standalone)');
  const installedKey = 'umma:menu:installed';
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let installPrompt = null;
  let installed = false;
  let opening = false;
  let button;
  let help;

  function rememberInstallation(value) {
    installed = value;
    try {
      if (value) localStorage.setItem(installedKey, '1');
      else localStorage.removeItem(installedKey);
    } catch {}
  }

  function setHelp(visible) {
    help.hidden = !visible;
    button.setAttribute('aria-expanded', String(visible));
  }

  function render() {
    const inApp = navigator.standalone === true || displayMode?.matches === true;
    document.documentElement.classList.toggle('menu-app-installed', inApp || installed);
    if (!button) return;
    button.disabled = opening;
    if (inApp || installed) setHelp(false);
  }

  function readInstallation() {
    try { installed ||= localStorage.getItem(installedKey) === '1'; } catch {}
    render();
  }

  // Capture a native offer before the rest of the menu loads.
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    rememberInstallation(false);
    installPrompt = event;
    render();
  });
  window.addEventListener('appinstalled', () => {
    rememberInstallation(true);
    installPrompt = null;
    opening = false;
    render();
  });
  window.addEventListener('storage', event => {
    if (event.key !== installedKey && event.key !== null) return;
    installed = event.newValue === '1';
    if (installed) installPrompt = null;
    render();
  });
  window.addEventListener('pageshow', readInstallation);
  displayMode?.addEventListener?.('change', render);
  readInstallation();

  document.addEventListener('DOMContentLoaded', () => {
    button = document.getElementById('installApp');
    help = document.getElementById('installHelp');
    document.getElementById(isIOS ? 'installHelpIOS' : 'installHelpBrowser').hidden = false;
    button.addEventListener('click', async () => {
      if (opening || installed) return;
      if (!installPrompt) {
        setHelp(help.hidden);
        return;
      }
      const prompt = installPrompt;
      installPrompt = null;
      opening = true;
      setHelp(false);
      render();
      try {
        await prompt.prompt();
        await prompt.userChoice;
      } catch {
        if (!installed && !installPrompt) setHelp(true);
      } finally {
        opening = false;
        render();
      }
    });
    render();
  }, { once: true });
})();
