/* One anonymous visitor per browser store. No account, fingerprint or IP in the visit log. */
(() => {
  'use strict';
  const endpoint = 'https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-connect';
  const contactKey = 'umma:connect:token:v1';
  const visitorKey = 'umma:menu:visitor:v1';
  const activityInterval = 5 * 60 * 1000;
  let token = '';
  let point = '';
  let nextActivity = 0;
  let installed = navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
  let started = false;

  function identity() {
    if (token) return token;
    try {
      const saved = localStorage.getItem(contactKey) || localStorage.getItem(visitorKey);
      const candidate = /^[a-f0-9]{64}$/.test(saved || '') ? saved
        : Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(visitorKey, candidate);
      token = candidate;
    } catch {}
    return token;
  }

  async function record(order = {}) {
    const visitor = identity();
    if (!visitor || !started) return;
    nextActivity = Date.now() + activityInterval;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({action: 'visit', token: visitor, point, installed, ...order}),
        keepalive: true,
        signal: AbortSignal.timeout(12000)
      });
      if (!response.ok) nextActivity = Math.min(nextActivity, Date.now() + 30_000);
    } catch {
      nextActivity = Math.min(nextActivity, Date.now() + 30_000);
    }
  }

  function activity() {
    if (!document.hidden && Date.now() >= nextActivity) void record();
  }

  function start(source) {
    if (started) return;
    started = true;
    point = /^[a-zA-Z0-9_-]{1,80}$/.test(source) ? source : '';
    activity();
    document.addEventListener('visibilitychange', activity);
    window.addEventListener('pageshow', activity);
    window.addEventListener('online', activity);
    for (const event of ['pointerdown', 'scroll', 'keydown']) {
      window.addEventListener(event, activity, {passive: true});
    }
    window.addEventListener('appinstalled', () => {
      installed = true;
      void record();
    });
  }

  window.ummaMenuAudience = {
    start,
    identity,
    orderPlaced: (orderId, requestKey) => void record({orderId, requestKey})
  };
})();
