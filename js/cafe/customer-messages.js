(() => {
  'use strict';
  const dialog = document.getElementById('customerMessages');
  const trigger = document.getElementById('customerMessagesButton');
  const totalBadge = trigger.querySelector('.messages-unread');
  const sections = [...dialog.querySelectorAll('.customer-message-sections button')];
  const badges = sections.map(() => {
    const badge = document.createElement('span');
    badge.className = 'messages-unread';
    return badge;
  });

  function showCount(badge, count) {
    badge.textContent = count ? String(count) : '';
    badge.hidden = count === 0;
  }

  function renderCounts() {
    let total = 0;
    sections.forEach((button, index) => {
      const count = Number(button.dataset.unread) || 0;
      const badge = badges[index];
      showCount(badge, count);
      button.append(badge);
      total += count;
    });
    showCount(totalBadge, total);
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
