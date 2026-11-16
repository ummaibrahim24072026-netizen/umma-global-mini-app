// Green SM delivery integration boundary. Not loaded by production until merchant/API approval.
// Never place partner credentials in browser code or GitHub Pages.
export const GREEN_SM_PROVIDER = Object.freeze({
  id: 'green-sm',
  label: 'Green SM',
  enabled: false,
  automaticDispatchEnabled: false,
  trackingEnabled: false
});

export function greenSmDispatchEligibility(order, config = GREEN_SM_PROVIDER) {
  if (!config.enabled) return {ok:false, reason:'provider_not_enabled'};
  if (!config.automaticDispatchEnabled) return {ok:false, reason:'api_not_approved'};
  if (!order || order.orderType !== 'delivery') return {ok:false, reason:'not_delivery'};
  if (!order.deliveryAddress || !order.customerPhone) return {ok:false, reason:'missing_delivery_details'};
  if (!['ready','ready_for_pickup'].includes(order.kitchenStatus)) return {ok:false, reason:'kitchen_not_ready'};
  if (order.deliveryJobId) return {ok:false, reason:'already_dispatched'};
  return {ok:true};
}

export function greenSmManualHandoff(order) {
  // No undocumented Green SM deep link, no auto-submission or fabricated booking.
  // An operator must open the official app themselves and confirm dispatch manually.
  return {
    provider:'green-sm',
    mode:'manual',
    status:'requires_operator_action',
    reference: order?.orderNumber ?? order?.id ?? null,
    address: order?.deliveryAddress ?? '',
    customerPhone: order?.customerPhone ?? ''
  };
}
