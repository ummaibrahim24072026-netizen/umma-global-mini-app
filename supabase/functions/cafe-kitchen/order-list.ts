// Closed history must never crowd active orders out of the staff workspace.
const columns = "id, order_number, customer_name, customer_phone, delivery_address, customer_note, order_type, payment_method, payment_status, paid_at, paid_by_telegram_id, delivery_status, courier_telegram_id, status, accepted_by_telegram_id, accepted_at, subtotal_vnd, delivery_fee_vnd, discount_vnd, total_vnd, created_at, location_id, cafe_order_items(id, product_name_ru, quantity, unit_price_vnd, line_total_vnd)";

export async function loadCafeOrders(client: any, scope: { locationIds: string[] | null; courierId: number | null }) {
  const query = () => {
    let q = client.from("cafe_orders").select(columns);
    if (scope.locationIds !== null) q = q.in("location_id", scope.locationIds);
    if (scope.courierId !== null) q = q.eq("courier_telegram_id", scope.courierId).eq("order_type", "delivery");
    return q;
  };
  const active = [];
  // Keyset pagination is stable when earlier orders are closed during polling.
  let cursor: string | null = null;
  for (;;) {
    let q = query().not("status", "in", "(completed,cancelled)").order("id", { ascending: true }).limit(200);
    if (cursor !== null) q = q.gt("id", cursor);
    const { data, error } = await q;
    if (error) return { data: null, error };
    active.push(...(data ?? []));
    if (!data || data.length < 200) break;
    cursor = data[data.length - 1].id;
  }
  const { data: closed, error } = await query().in("status", ["completed", "cancelled"])
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(100);
  if (error) return { data: null, error };
  return { data: [...active, ...(closed ?? [])], error: null };
}
