/* Staff handoff for prepaid deliveries placed through the standalone menu. */
(() => {
  'use strict';
  const launchUrl = 'https://vn.greensm.com/3eCA/8li1xfm7';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char =>
    ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[char]);

  function handles(order) {
    return order.order_type === 'delivery' && order.dispatch_mode === 'manual' &&
      order.created_via === 'customer' && order.customer_telegram_id == null &&
      order.requires_prepayment === true && order.courier_telegram_id == null;
  }

  function card(order, location) {
    if (order.status !== 'ready' || order.payment_status !== 'paid' || order.preorder_waiting) return '';
    const pickup = location?.address;
    const point = window.ummaMapLinks?.parseAddress(order.delivery_address);
    const address = order.delivery_address?.split(/\nТочка доставки: /)[0];
    if (!pickup || !address) return '<p>Проверьте адрес кафе и адрес доставки.</p>';

    const fields = [
      ['Откуда забрать', pickup],
      ['Куда доставить', address],
      ...(point ? [['Точка доставки', window.ummaMapLinks.coords(point)]] : []),
      ...(order.customer_phone ? [['Телефон клиента', order.customer_phone]] : []),
      ['Комментарий для курьера', `Đơn HALAL UMMA #${order.order_number}. Tiền món đã thanh toán. Không thu tiền người nhận. Bên gửi trả phí giao hàng.`],
    ];
    return `<a class="kitchen-action" href="${launchUrl}" target="_blank" rel="noopener noreferrer">Вызвать Green SM</a>
    <details class="kitchen-secondary-actions"><summary>Адреса и телефон для Green SM</summary>
      <p>Скопируйте данные в «Giao hàng». Выберите «Tiền mặt» (наличные), плательщик — «Người gửi» (отправитель). Оплатите доставку, когда курьер заберёт заказ. Оформите без наложенного платежа.</p>
      ${fields.map(([label, value]) => `<label class="field">${escape(label)}<input readonly value="${escape(value)}"></label>
        <button type="button" class="kitchen-action" data-green-copy>Скопировать</button>`).join('')}
      <p data-green-copy-status role="status"></p>
    </details>`;
  }

  document.addEventListener('click', async event => {
    const button = event.target.closest?.('[data-green-copy]');
    if (!button) return;
    const field = button.previousElementSibling.querySelector('input');
    const status = button.closest('details').querySelector('[data-green-copy-status]');
    try {
      await navigator.clipboard.writeText(field.value);
      status.textContent = 'Скопировано';
    } catch {
      field.focus();
      field.select();
      status.textContent = 'Текст выделен для копирования';
    }
  });

  window.ummaGreenSm = {handles, card};
})();
