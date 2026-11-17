/* =====================================================
   INITIAL ADMIN UI STATE
   ===================================================== */

updateAdminUI(
  window.ummaRole
);


/* =====================================================
   START TELEGRAM AUTH
   ===================================================== */

if (tg?.initData) authenticateTelegramUser();


/* Haptics for static and dynamic buttons are delegated by native-shell.js. */
