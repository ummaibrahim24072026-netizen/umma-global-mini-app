(() => {
  if (!('serviceWorker' in navigator)) return;
  const worker = new URL('umma-menu-sw.js', document.baseURI);
  navigator.serviceWorker.register(worker, { updateViaCache: 'none' }).catch(error => {
    console.warn('UMMA service worker registration failed', error);
  });
})();
