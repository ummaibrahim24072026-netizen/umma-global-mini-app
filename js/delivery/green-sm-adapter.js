/* Staff handoff for prepaid cafe deliveries. */
(() => {
  'use strict';
  const launchUrl = 'https://vn.greensm.com/3eCA/8li1xfm7';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char =>
    ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[char]);

  function handles(order) {
    return order.order_type === 'delivery' && order.dispatch_mode === 'manual' &&
      ['customer','staff'].includes(order.created_via) && order.customer_telegram_id == null && order.chat_available !== true &&
      order.requires_prepayment === true && order.courier_telegram_id == null &&
      Boolean(order.green_sm_stage || order.green_sm_booking_id || order.green_sm_tracking_url);
  }

  const deliverySteps = [
    ['booked','Подтвердить вызов','Курьер вызван'],
    ['assigned','Курьер назначен','Курьер назначен'],
    ['arrived','Курьер прибыл','Курьер прибыл'],
    ['picked_up','Передать курьеру','Заказ передан курьеру'],
    ['delivered','Подтвердить вручение','Заказ доставлен'],
  ];
  const roles = {kitchen:'Кухня', manager:'Руководитель', cashier:'Кассир', waiter:'Стойка'};

  function form(order) {
    const index = deliverySteps.findIndex(step => step[0] === order.green_sm_stage);
    const next = deliverySteps[index + 1];
    return `<section class="green-delivery-controls" data-green-order="${escape(order.id)}">
      <p><strong>${deliverySteps[index]?.[2] || 'Курьер ещё не вызван'}</strong></p>
      ${next ? `<button type="button" class="kitchen-action" data-green-stage="${next[0]}">${next[1]}</button>` : ''}
      <button type="button" class="kitchen-action" data-green-details
        data-booking="${escape(order.green_sm_booking_id)}" data-tracking="${escape(order.green_sm_tracking_url)}">Номер и ссылка доставки</button>
      <p role="status" data-green-status></p>
    </section>`;
  }

  function card(order, location) {
    if (order.status !== 'ready' || order.payment_status !== 'paid' || order.preorder_waiting) return '';
    const pickup = location?.address;
    const point = window.ummaMapLinks?.parseAddress(order.delivery_address);
    const address = order.delivery_address?.split(/\nТочка доставки: /)[0];
    if (!pickup || !address) return '<p>Проверьте адрес кафе и адрес доставки.</p>' + form(order);

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
    </details>${form(order)}`;
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

  async function mutate(orderId, operation, values = {}) {
    const endpoint = 'https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-kitchen';
    const response = await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({action:'webFulfillment',initData:window.ummaStaffAuth?.credential(),orderId,operation,...values}),
      signal:AbortSignal.timeout(15000)});
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || 'Не удалось сохранить изменение');
    return result;
  }

  const refresh = () => document.dispatchEvent(new Event('umma:fulfillment-realtime'));
  function dialog(title, fields, save) {
    const modal = document.createElement('dialog');
    modal.className = 'web-fulfillment-dialog';
    modal.innerHTML = `<form><h2>${title}</h2>${fields}
      <p role="status"></p><div class="kitchen-order-actions">
      <button type="button" class="kitchen-action">Закрыть</button>
      <button type="submit" class="kitchen-action">Сохранить</button></div></form>`;
    const form = modal.querySelector('form');
    const submit = form.querySelector('[type="submit"]');
    form.querySelector('[type="button"]').onclick = () => modal.close();
    modal.addEventListener('close', () => modal.remove(), {once:true});
    form.onsubmit = async event => {
      event.preventDefault();
      submit.disabled = true;
      try {
        await save(Object.fromEntries(new FormData(form)));
        modal.close();
        refresh();
      } catch (error) {
        form.querySelector('[role="status"]').textContent = error.message;
      } finally { submit.disabled = false; }
    };
    document.body.append(modal);
    modal.showModal();
  }

  document.addEventListener('click', async event => {
    const button = event.target.closest?.('[data-green-stage],[data-green-details],[data-preparation-transfer]');
    if (!button) return;
    const panel = button.closest('[data-green-order]');
    const orderId = panel?.dataset.greenOrder || button.dataset.preparationTransfer;
    const status = panel?.querySelector('[data-green-status]') || button.nextElementSibling;
    if (button.hasAttribute('data-green-details')) {
      dialog('Доставка Green SM', `<label class="field">Номер бронирования<input name="bookingId" maxlength="120" value="${escape(button.dataset.booking)}"></label>
        <label class="field">Ссылка отслеживания<input name="trackingUrl" type="url" maxlength="1000" value="${escape(button.dataset.tracking)}"></label>`,
        values => mutate(orderId,'greenDetails',values));
      return;
    }
    button.disabled = true;
    status.textContent = '';
    try {
      if (button.dataset.greenStage) {
        await mutate(orderId,'greenStage',{stage:button.dataset.greenStage});
        status.textContent = 'Подтверждено';
        refresh();
        return;
      }
      const {staff} = await mutate(orderId,'staff');
      if (!staff.length) { status.textContent = 'Нет доступных сотрудников'; return; }
      dialog('Передать приготовление', `<label class="field">Сотрудник<select name="targetId" required>
        <option value="">Выберите сотрудника</option>${staff.map(person =>
          `<option value="${escape(person.id)}">${escape(person.name)} · ${escape(roles[person.role])}</option>`).join('')}
        </select></label>`, values => mutate(orderId,'transfer',{...values,expectedOwner:button.dataset.owner||null}));
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  });

  function transfer(order, actor) {
    if (order.status !== 'preparing' || order.payment_status !== 'paid' || order.preorder_waiting ||
        !roles[order.staffRole] || (order.staffRole !== 'manager' && String(order.accepted_by_telegram_id) !== String(actor))) return '';
    return `<button type="button" class="kitchen-action" data-preparation-transfer="${escape(order.id)}"
      data-owner="${escape(order.accepted_by_telegram_id)}">Передать приготовление</button><small role="status"></small>`;
  }

  window.ummaGreenSm = {handles, card, transfer};
})();
