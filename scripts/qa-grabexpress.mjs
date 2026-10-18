import assert from 'node:assert/strict';
import { buildGrabSandboxDraft, grabQuotePayload, createGrabSandboxClient } from '../supabase/functions/_shared/grabexpress.mjs';

const input = {
  orderId: 'qa-order-1', orderStatus: 'ready', paymentStatus: 'paid',
  items: [{ name: 'Cơm cừu', quantity: 2 }, { name: 'Ayran', quantity: 1 }],
  parcel: { height: 15, width: 25, depth: 25, weight: 1400 },
  pickup: { address: 'QA pickup', latitude: 12.250001, longitude: 109.190001 },
  dropoff: { address: 'QA dropoff', latitude: 12.260002, longitude: 109.200002 },
  sender: { name: 'QA UMMA', phone: '+84 900 000 001' },
  recipient: { name: 'QA recipient', phone: '+84 900 000 002' },
  instruction: 'QA order. Goods prepaid. Do not collect goods payment.',
};
const draft = buildGrabSandboxDraft(input);
assert.equal(draft.payer, 'RECIPIENT');
assert.equal(draft.paymentMethod, 'CASH');
assert.equal(draft.sender.phone, '84900000001');
assert.equal(draft.recipient.smsEnabled, false, 'sandbox does not request recipient SMS');
assert.equal(draft.origin.cityCode, 'KHA');
assert.deepEqual(draft.destination.coordinates, { latitude: 12.260002, longitude: 109.200002 });
assert.equal(draft.packages[0].description, 'Cơm cừu × 2; Ayran × 1');
assert.equal(draft.packages[0].quantity, 1, 'one measured packed parcel');
assert.ok(!('cashOnDelivery' in draft));
assert.ok(!('codType' in draft));
assert.ok(!('recipient' in grabQuotePayload(draft)), 'quote does not transmit customer contact');
for (const change of [
  { paymentStatus: 'pending' }, { orderStatus: 'completed' }, { orderStatus: 'cancelled' },
  { orderStatus: undefined }, { refunded: true }, { items: [] },
  { pickup: { ...input.pickup, latitude: '' } }, { dropoff: { ...input.dropoff, longitude: 200 } },
  { recipient: { name: 'QA', phone: '0900000002' } }, { parcel: { ...input.parcel, weight: 0 } },
  { items: [{ name: 'QA', quantity: -1 }] }, { instruction: 'x'.repeat(1001) },
]) assert.throws(() => buildGrabSandboxDraft({ ...input, ...change }));
assert.throws(() => grabQuotePayload({ ...draft, paymentMethod: 'CASHLESS' }));
assert.throws(() => createGrabSandboxClient({ clientId: 'qa', clientSecret: 'qa', environment: 'production' }));
assert.throws(() => createGrabSandboxClient());

let calls = [], clock = 100000, fail = null;
const mockFetch = async (url, init) => {
  calls.push({ url, init });
  assert.equal(init.redirect, 'error');
  if (url.includes('/oauth2/token')) return Response.json({ access_token: 'qa-token', expires_in: 120 });
  if (fail === 'network') throw new Error('sensitive transport detail');
  if (fail === 'json') return new Response('invalid json');
  if (fail) return new Response('sensitive upstream detail', { status: fail, headers: { 'X-Request-ID': 'qa-request' } });
  return Response.json({ deliveryID: 'qa-delivery', quotes: [] });
};
const client = createGrabSandboxClient({ clientId: 'qa-id', clientSecret: 'qa-secret', fetchImpl: mockFetch, now: () => clock });
await Promise.all([client.quote(draft), client.quote(draft)]);
assert.equal(calls.filter(c => c.url.includes('/oauth2/token')).length, 1, 'concurrent calls share token request');
assert.deepEqual(JSON.parse(calls[0].init.body), {
  client_id: 'qa-id', client_secret: 'qa-secret', grant_type: 'client_credentials', scope: 'grab_express.partner_deliveries',
});
assert.ok(calls.slice(1).every(c => c.url.startsWith('https://partner-api.grab.com/grab-express-sandbox/')));
assert.equal(calls[1].init.headers.Authorization, 'Bearer qa-token');
clock += 100000;
await client.quote(draft);
assert.equal(calls.filter(c => c.url.includes('/oauth2/token')).length, 2, 'expiring token refreshes');
await client.createDelivery(draft);
assert.equal(calls.at(-1).url, 'https://partner-api.grab.com/grab-express-sandbox/v1/deliveries');
assert.deepEqual(JSON.parse(calls.at(-1).init.body), draft);
await client.getDelivery('QA/ID');
assert.ok(calls.at(-1).url.endsWith('/QA%2FID'));
for (const failure of ['network', 'json', 503]) {
  fail = failure;
  const before = calls.length;
  await assert.rejects(client.createDelivery(draft), e => e.code === 'BOOKING_OUTCOME_UNKNOWN' && !e.message.includes('sensitive'));
  assert.equal(calls.length, before + 1, 'ambiguous booking is never automatically retried');
}
fail = 401;
await assert.rejects(client.quote(draft), e => e.status === 401 && e.requestId === 'qa-request');
fail = null;
const tokenCalls = calls.filter(c => c.url.includes('/oauth2/token')).length;
await client.quote(draft);
assert.equal(calls.filter(c => c.url.includes('/oauth2/token')).length, tokenCalls + 1, '401 invalidates token for next explicit request');
console.log('PASS GrabExpress sandbox: prepaid goods, recipient-paid delivery, coordinates, items, measured parcel, validation, OAuth reuse/expiry, redacted failures and no duplicate booking retries. No live calls.');
