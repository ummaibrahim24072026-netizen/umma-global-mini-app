/* One greeting per opening. Browsers may require a real user gesture for sound. */
(() => {
  'use strict';
  if (window.ummaWelcomeAudio || typeof Audio !== 'function') return;
  const script = document.currentScript;
  const source = new URL('../../assets/audio/welcome-ru.mp3', script.src).href;
  const audio = new Audio(source);
  audio.preload = 'auto';
  let started = false;
  let pending = false;
  let disposed = false;
  const gestures = ['click', 'touchend', 'keydown'];

  function removeGestures() {
    gestures.forEach(type => document.removeEventListener(type, onGesture, true));
  }
  function onGesture(event) {
    if (!event.isTrusted || event.repeat) return;
    play();
  }
  function play() {
    if (started || pending || disposed || document.visibilityState === 'hidden') return;
    pending = true;
    try {
      // Call synchronously inside the gesture, before any await.
      const result = audio.play();
      Promise.resolve(result).then(() => {
        started = true;
        removeGestures();
        // Do not keep speaking after the user leaves the app.
        if (disposed || document.visibilityState === 'hidden') audio.pause();
      }).catch(() => {
        // Autoplay rejection is normal; the next real tap retries this same file.
      }).finally(() => { pending = false; });
    } catch {
      pending = false;
    }
  }
  function onVisibility() {
    if (document.visibilityState === 'hidden') audio.pause();
    else if (!started) play();
  }
  function dispose() {
    disposed = true;
    audio.pause();
    removeGestures();
    document.removeEventListener('visibilitychange', onVisibility);
  }
  window.ummaWelcomeAudio = { play, pause: () => audio.pause() };
  gestures.forEach(type => document.addEventListener(type, onGesture, {capture: true, passive: true}));
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', dispose, {once: true});
  // Returning from the back/forward cache is another opening.
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    disposed = false;
    started = false;
    audio.currentTime = 0;
    gestures.forEach(type => document.addEventListener(type, onGesture, {capture: true, passive: true}));
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', dispose, {once: true});
    play();
  });
  play();
})();
