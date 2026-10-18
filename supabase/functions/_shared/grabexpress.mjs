// Server-only GrabExpress sandbox foundation. Not a public Edge Function.
// Production dispatch requires a durable shipment ledger and confirmed Grab access.
const HOST = 'https://partner-api.grab.com';
const BASE = `${HOST}/grab-express-sandbox`;
const TOKEN = `${HOST}/grabid/v1/oauth2/token`;
const SCOPE = 'grab_express.partner_deliveries';

export class GrabExpressError extends Error {
  constructor(code, status = 0, requestId = null) {
    super(code);
    this.name = 'GrabExpressError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

function text(value, key, limit = 500) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > limit) {
    throw new GrabExpressError(`INVALID_${key}`);
  }
  return value.trim();
}
function positive(value, key) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new GrabExpressError(`INVALID_${key}`);
  return value;
}
function point(value, key) {
  const { latitude, longitude } = value || {};
  if (typeof latitude !== 'number' || typeof longitude !== 'number' ||
      !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    throw new GrabExpressError(`INVALID_${key}_COORDINATES`);
  }
  return { address: text(value.address, `${key}_ADDRESS`), cityCode: 'KHA',
    coordinates: { latitude, longitude } };
}
function contact(value, key) {
  const phone = text(value?.phone, `${key}_PHONE`, 16).replace(/[\s()+.-]/g, '');
  // Require an explicit Vietnam country code; never guess a local-number prefix.
  if (!/^84\d{8,10}$/.test(phone)) throw new GrabExpressError(`INVALID_${key}_PHONE`);
  return { firstName: text(value.name, `${key}_NAME`), phone, smsEnabled: false };
}

/** Input must come from server-verified order/location data, never trusted browser totals. */
export function buildGrabSandboxDraft(input) {
  if (input?.paymentStatus !== 'paid') throw new GrabExpressError('GOODS_NOT_PAID');
  if (!['pending', 'confirmed', 'preparing', 'ready'].includes(input.orderStatus) || input.refunded) {
    throw new GrabExpressError('ORDER_NOT_DISPATCHABLE');
  }
  const merchantOrderID = text(input.orderId, 'ORDER_ID', 128);
  if (!/^[a-zA-Z0-9_-]+$/.test(merchantOrderID)) throw new GrabExpressError('INVALID_ORDER_ID');
  if (!Array.isArray(input.items) || input.items.length === 0) throw new GrabExpressError('EMPTY_ITEMS');
  const description = input.items.map(item =>
    `${text(item.name, 'ITEM_NAME')} × ${positive(item.quantity, 'ITEM_QUANTITY')}`
  ).join('; ');
  if (description.length > 500) throw new GrabExpressError('PACKAGE_DESCRIPTION_TOO_LONG');
  const dimensions = {};
  for (const key of ['height', 'width', 'depth', 'weight']) {
    dimensions[key] = positive(input.parcel?.[key], `PARCEL_${key.toUpperCase()}`);
  }
  const sender = contact(input.sender, 'SENDER');
  sender.instruction = text(input.instruction, 'INSTRUCTION', 1000);
  return {
    merchantOrderID, serviceType: 'INSTANT', vehicleType: 'BIKE',
    paymentMethod: 'CASH', payer: 'RECIPIENT',
    packages: [{ name: `UMMA ${merchantOrderID}`.slice(0, 500), description, quantity: 1, dimensions }],
    origin: point(input.pickup, 'PICKUP'), destination: point(input.dropoff, 'DROPOFF'),
    sender, recipient: contact(input.recipient, 'RECIPIENT'),
    // No cashOnDelivery / codType: goods have already been paid to UMMA.
  };
}

export function grabQuotePayload(draft) {
  if (draft.paymentMethod !== 'CASH' || draft.payer !== 'RECIPIENT' || draft.cashOnDelivery) {
    throw new GrabExpressError('UNSUPPORTED_PAYMENT_MODEL');
  }
  const { serviceType, vehicleType, paymentMethod, packages, origin, destination } = draft;
  return { serviceType, vehicleType, paymentMethod, packages, origin, destination };
}

/** Sandbox only. A booking response loss is ambiguous: do not auto-retry creation. */
export function createGrabSandboxClient({ clientId, clientSecret, fetchImpl = fetch,
  now = Date.now, timeoutMs = 15000, environment = 'sandbox' } = {}) {
  if (environment !== 'sandbox') throw new GrabExpressError('PRODUCTION_NOT_IMPLEMENTED');
  text(clientId, 'CLIENT_ID', 1000);
  text(clientSecret, 'CLIENT_SECRET', 4000);
  let token = null, expiresAt = 0, pendingToken = null;
  async function jsonRequest(url, init, booking = false) {
    let response;
    try {
      response = await fetchImpl(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
    } catch {
      throw new GrabExpressError(booking ? 'BOOKING_OUTCOME_UNKNOWN' : 'GRAB_NETWORK_ERROR');
    }
    const requestId = response.headers.get('X-Request-ID') || response.headers.get('X-Grabkit-Grab-RequestId');
    if (!response.ok) {
      if (response.status === 401) { token = null; expiresAt = 0; }
      throw new GrabExpressError(booking && response.status >= 500 ? 'BOOKING_OUTCOME_UNKNOWN' : 'GRAB_HTTP_ERROR', response.status, requestId);
    }
    try { return await response.json(); }
    catch { throw new GrabExpressError(booking ? 'BOOKING_OUTCOME_UNKNOWN' : 'GRAB_INVALID_RESPONSE', response.status, requestId); }
  }
  async function accessToken() {
    if (token && now() < expiresAt) return token;
    if (!pendingToken) pendingToken = (async () => {
      const data = await jsonRequest(TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret,
          grant_type: 'client_credentials', scope: SCOPE }) });
      if (typeof data.access_token !== 'string' || !data.access_token ||
          !Number.isFinite(data.expires_in) || data.expires_in <= 0) throw new GrabExpressError('GRAB_INVALID_TOKEN_RESPONSE');
      token = data.access_token;
      expiresAt = now() + Math.max(0, data.expires_in - 30) * 1000;
      return token;
    })().finally(() => { pendingToken = null; });
    return pendingToken;
  }
  async function request(path, method, body, booking = false) {
    const bearer = await accessToken();
    return jsonRequest(`${BASE}${path}`, { method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
      ...(body ? { body: JSON.stringify(body) } : {}) }, booking);
  }
  return Object.freeze({
    quote: draft => request('/v1/deliveries/quotes', 'POST', grabQuotePayload(draft)),
    createDelivery: draft => {
      grabQuotePayload(draft);
      text(draft.merchantOrderID, 'ORDER_ID', 128);
      return request('/v1/deliveries', 'POST', draft, true);
    },
    getDelivery: deliveryId => request(`/v1/deliveries/${encodeURIComponent(text(deliveryId, 'DELIVERY_ID', 128))}`, 'GET'),
  });
}
