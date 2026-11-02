/**
 * UMMA Delivery network dispatch candidate selection.
 * Integrates with existing cafe_orders.location_id and cafe_staff records.
 * Server must authenticate operator and re-check eligibility before any write.
 */
export function eligibleCouriers({ order, cafes, couriers, memberships = [] }) {
  if (!order || !order.location_id || order.order_type !== "delivery") return [];
  const cafe = cafes.find(c => c.id === order.location_id && c.is_active);
  if (!cafe) return [];
  return couriers.filter(c => {
    if (!c || !c.available || c.active_order_id) return false;
    if (!["umma", "partner", "shared"].includes(c.kind)) return false;
    const own = memberships.some(m =>
      m.courier_id === c.id && m.location_id === cafe.id && m.is_active);
    if (own) return true;
    if (!cafe.shared_dispatch_enabled || !c.network_opt_in) return false;
    if (c.kind === "shared") return true;
    return memberships.some(m =>
      m.courier_id === c.id && m.allow_network_dispatch && m.is_active);
  });
}

export function nearestCafe({ latitude, longitude, cafes }) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  const rad = Math.PI / 180;
  const distance = c => {
    const dLat = (c.latitude - latitude) * rad;
    const dLon = (c.longitude - longitude) * rad;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(latitude * rad) * Math.cos(c.latitude * rad) *
      Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };
  return cafes.filter(c => c.is_active &&
    Number.isFinite(Number(c.latitude)) &&
    Number.isFinite(Number(c.longitude)) &&
    Math.abs(Number(c.latitude)) <= 90 && Math.abs(Number(c.longitude)) <= 180)
    .map(c => ({ ...c, distance_km: distance(c) }))
    .sort((a, b) => a.distance_km - b.distance_km)[0] ?? null;
}
