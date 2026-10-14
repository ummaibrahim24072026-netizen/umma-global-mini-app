export function sandboxCanAdvance(role: string, order: any, status: string) {
  const roleAllowed = role==='manager' || (role==='cashier'&&['confirmed','cancelled'].includes(status)) ||
    (role==='kitchen'&&['preparing','ready'].includes(status)) || (role==='waiter'&&status==='completed');
  if (!roleAllowed) return false;
  const next: Record<string,string[]> = {new:['confirmed','cancelled'],confirmed:['preparing','cancelled'],preparing:['ready','cancelled'],ready:['completed','cancelled']};
  if (!next[order.status]?.includes(status)) return false;
  if (status==='cancelled'&&order.payment_status==='paid') return false;
  if (status==='completed'&&(order.payment_status!=='paid'||(order.order_type==='delivery'&&order.delivery_status!=='delivered'))) return false;
  return true;
}
