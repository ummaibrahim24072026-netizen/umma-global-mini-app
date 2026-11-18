(() => {
  'use strict';
  const dialog = document.getElementById('customerMessages');
  const trigger = document.getElementById('customerMessagesButton');
  const totalBadge = trigger.querySelector('.messages-unread');
  function renderCounts() {
    const total = [...dialog.querySelectorAll('button[data-unread]')].reduce(
      (sum, button) => sum + Math.max(0, Number(button.dataset.unread) || 0), 0
    );
    totalBadge.textContent = total > 99 ? '99+' : total ? String(total) : '';
    totalBadge.hidden = !total;
  }

  trigger.addEventListener('click', () => {
    // The bottom Messages tab opens the conversation directly, not an intermediate hub.
    if (dialog.open) dialog.close();
    if (window.ummaCustomerConnect?.open) window.ummaCustomerConnect.open();
    else dialog.show(); // Graceful fallback if the chat module failed to load.
  });
  window.addEventListener('umma:messages-count', renderCounts);
  renderCounts();
})();
