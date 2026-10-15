// Recipient decoded from the owner's Vietcombank VietQR, scoped to HALAL UMMA.
export const QR_LOCATION = 'e22788bd-4734-4b3a-911e-ba103d52617a';
export function crc16(value: string): string {
  let crc = 0xffff;
  for (const character of value) {
    crc ^= character.charCodeAt(0) << 8;
    for (let bit = 0; bit < 8; bit++) crc = ((crc << 1) ^ ((crc & 0x8000) ? 0x1021 : 0)) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
function tlv(tag: string, value: string): string {
  if (value.length > 99) throw new Error('Payment field too long');
  return tag + String(value.length).padStart(2, '0') + value;
}
export function paymentFor(order: any) {
  if (order.location_id !== QR_LOCATION || order.payment_method !== 'qr' || order.payment_status !== 'pending' || order.status === 'cancelled' || order.currency !== 'VND') return null;
  const amount = Number(order.total_vnd);
  const number = String(order.order_number);
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 9999999999999 || !/^[0-9A-Za-z-]{1,30}$/.test(number)) return null;
  const account = '1062679069';
  const reference = 'UMMA ' + number;
  const merchant = tlv('00', 'A000000727') + tlv('01', tlv('00', '970436') + tlv('01', account)) + tlv('02', 'QRIBFTTA');
  const payload = tlv('00', '01') + tlv('01', '12') + tlv('38', merchant) + tlv('53', '704') + tlv('54', String(amount)) + tlv('58', 'VN') + tlv('62', tlv('08', reference)) + '6304';
  return {orderId:order.id, orderNumber:number, bankName:'Vietcombank', bankCode:'vcb', account, amount, currency:'VND', reference, qrPayload:payload + crc16(payload)};
}
