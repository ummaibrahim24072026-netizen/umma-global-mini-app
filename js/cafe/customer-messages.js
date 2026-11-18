(() => {
  'use strict';
  const dialog = document.getElementById('customerMessages');
  const trigger = document.getElementById('customerMessagesButton');
  const totalBadge = trigger.querySelector('.messages-unread');
  function renderCounts() {
    let total=0;
    for(const button of dialog.querySelectorAll('button[data-unread]')){
      const count=Math.max(0,Number(button.dataset.unread)||0);
      total+=count;
      const badge=button.querySelector('.messages-unread')||document.createElement('span');
      badge.className='messages-unread';
      badge.textContent=count>99?'99+':count?String(count):'';
      badge.hidden=!count;
      if(!badge.parentNode)button.append(badge);
    }
    totalBadge.textContent=total>99?'99+':total?String(total):'';
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
