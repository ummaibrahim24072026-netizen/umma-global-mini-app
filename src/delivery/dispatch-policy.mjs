/**
 * Pure, dependency-free dispatch eligibility rules.
 * These checks are UI/service prefilters, NOT authorization.
 * Enforce identical tenant and assignment constraints server-side with RLS.
 */
export function canOfferDelivery({ cafe, courier, order }) {
  if (!cafe || !courier || !order) return false;
  if (!cafe.id || !order.cafeId || cafe.id !== order.cafeId) return false;
  if (order.status !== "ready_for_dispatch") return false;
  if (courier.status !== "available" || courier.activeDeliveryId) return false;
  if (!["umma", "partner", "shared"].includes(courier.kind)) return false;
  if (courier.kind === "shared") return cafe.sharedDispatchEnabled === true;
  if (courier.cafeId === cafe.id) return true;
  return cafe.sharedDispatchEnabled === true &&
    courier.crossCafeOptIn === true &&
    courier.partnerCafeSharedDispatchEnabled === true;
}

export const DELIVERY_STATES = Object.freeze([
  "ready_for_dispatch", "offered", "accepted",
  "picked_up", "in_transit", "delivered", "cancelled"
]);

const allowed = {
  ready_for_dispatch: ["offered", "cancelled"],
  offered: ["accepted", "ready_for_dispatch", "cancelled"],
  accepted: ["picked_up", "cancelled"],
  picked_up: ["in_transit", "delivered", "cancelled"],
  in_transit: ["delivered", "cancelled"],
  delivered: [],
  cancelled: []
};

export function canTransitionDelivery(from, to) {
  return Boolean(allowed[from]?.includes(to));
}
