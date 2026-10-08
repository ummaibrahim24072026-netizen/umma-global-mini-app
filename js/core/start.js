/* =====================================================
   INITIAL ADMIN UI STATE
   ===================================================== */

updateAdminUI(
  window.ummaRole
);


/* =====================================================
   START TELEGRAM AUTH
   ===================================================== */

authenticateTelegramUser();


/* =====================================================
   HAPTIC FEEDBACK
   ===================================================== */

document
  .querySelectorAll("button")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        try {

          tg?.HapticFeedback?.impactOccurred(
            "light"
          );

        } catch (error) {}

      }
    );

  });
