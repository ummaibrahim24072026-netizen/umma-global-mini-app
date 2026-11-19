import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const read = path => readFileSync(path, 'utf8');
const first = '11111111-1111-4111-8111-111111111111';
const second = '22222222-2222-4222-8222-222222222222';
const firstOrder = '33333333-3333-4333-8333-333333333333';
const secondOrder = '44444444-4444-4444-8444-444444444444';
const locations = [
  { id: first, name: 'QA Нячанг', location_type: 'cafe', is_active: true, ready_stock_enabled: true },
  { id: second, name: 'QA Второе кафе', location_type: 'cafe', is_active: true, ready_stock_enabled: true }
];
const orders = [
  { id: firstOrder, order_number: 165, location_id: first, status: 'pending', payment_status: 'pending', payment_timing: null },
  { id: secondOrder, order_number: 201, location_id: second, status: 'pending', payment_status: 'pending', payment_timing: 'on_delivery' }
].map(order => ({
  ...order, source_module: 'cafe', requires_prepayment: true, preorder_waiting: false,
  delivery_status: 'not_applicable', order_type: 'pickup', payment_method: 'cash', canAcceptPayments: true,
  total_vnd: 25000, created_at: new Date().toISOString()
}));
const assignments = [
  { telegram_id: 11, location_id: first, staff_role: 'manager', can_accept_payments: true, is_active: true },
  { telegram_id: 12, location_id: first, staff_role: 'kitchen', can_accept_payments: false, is_active: true },
  { telegram_id: 13, location_id: second, staff_role: 'manager', can_accept_payments: true, is_active: true }
];
const users = [
  { telegram_id: 10, first_name: 'QA Владелец', role: 'super_admin', is_active: true },
  ...assignments.map(a => ({ telegram_id: a.telegram_id, first_name: 'QA ' + a.telegram_id, role: 'employee', is_active: true }))
];
const notes = [{ order_id: firstOrder, from_status: 'pending', to_status: 'cancelled', note: 'QA Ошибка заказа', created_at: new Date().toISOString() }];
const tables = { locations, cafe_orders: orders, cafe_staff: assignments, telegram_users: users, cafe_order_events: notes };
let actor = 11;
const db = {
  from(table) {
    const filters = [];
    const result = () => {
      const data = (tables[table] || []).filter(row => filters.every(test => test(row)));
      return { data, count: data.length, error: null };
    };
    const query = {
      select() { return query; },
      eq(key, value) { filters.push(row => row[key] === value); return query; },
      neq(key, value) { filters.push(row => row[key] !== value); return query; },
      in(key, values) { filters.push(row => values.includes(row[key])); return query; },
      not(key, op, values) {
        assert.equal(op, 'in');
        filters.push(row => !values.slice(1, -1).split(',').includes(row[key]));
        return query;
      },
      gte(key, value) { filters.push(row => row[key] >= value); return query; },
      or(conditions) {
        filters.push(row => conditions.split(',').some(condition => {
          const [key, op, value] = condition.split('.');
          if (op === 'is') return row[key] === null;
          return op === 'eq' ? String(row[key]) === value : String(row[key]) !== value;
        }));
        return query;
      },
      order() { return query; },
      async maybeSingle() { return { data: result().data[0] ?? null, error: null }; },
      then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); }
    };
    return query;
  },
  async rpc(action, args) {
    assert.equal(args.p_location_id || args.p_location, first);
    if (action === 'get_cafe_cash_summary') return { data: { total24hVnd: 150000 } };
    assert.equal(action, 'cafe_ready_list');
    return { data: { products: [
      { name: '<QA Манты>', confirmed: true, state: 'ready', available: 0 },
      { name: 'QA Хлеб', confirmed: true, state: 'ready', available: 4 }
    ] } };
  }
};

function loadEdge(name) {
  let handler;
  const source = read('supabase/functions/' + name + '/index.ts').replace(/^import[\s\S]*?;\n/gm, '');
  vm.runInNewContext(stripTypeScriptTypes(source), {
    Deno: { serve: callback => { handler = callback; }, env: { get: () => 'isolated-qa' } },
    createClient: () => db, verifyWebStaffSession: async () => actor, Response, console
  });
  return (action, extra) => handler(new Request('https://qa.invalid', {
    method: 'POST', body: JSON.stringify({ initData: 'web:' + 'a'.repeat(64), action, ...extra })
  }));
}

const web = loadEdge('cafe-web');
let response = await web('managerOverview', { locationId: first });
assert.equal(response.status, 200);
assert.deepEqual(await response.json(), {
  ok: true, metrics: { new: 0, payment: 1, preparing: 0, ready: 0, delivery: 0, completed: 0, cancelled: 0, revenue: 150000 },
  soldOut: ['<QA Манты>']
});
assert.equal((await web('managerOverview', { locationId: second })).status, 403);
const roster = await (await web('managerRoster')).json();
assert.deepEqual(roster.employees.map(e => e.name), ['QA 11', 'QA 12']);
assert.doesNotMatch(JSON.stringify(roster), /telegram_id|actor_id|login|password/);
assert.equal((await web('staffList')).status, 403);
assert.equal((await web('staffRoleUpdate')).status, 403);
actor = 12;
assert.equal((await web('managerOverview', { locationId: first })).status, 403);
assert.equal((await web('managerRoster')).status, 403);
actor = 10;
assert.equal((await web('managerOverview', { locationId: first })).status, 200);

const kitchen = loadEdge('cafe-kitchen');
actor = 11;
response = await kitchen('managerOrderHistory', { orderId: firstOrder });
assert.equal(response.status, 200);
assert.equal((await response.json()).events[0].note, notes[0].note);
assert.equal((await kitchen('managerOrderHistory', { orderId: secondOrder })).status, 404);
actor = 12;
assert.equal((await kitchen('managerOrderHistory', { orderId: firstOrder })).status, 403);
assert.equal((await kitchen('cashList', { locationId: first })).status, 403);
actor = 11;
assert.equal((await kitchen('cashList', { locationId: second })).status, 403);
assert.equal((await kitchen('updateStatus', { orderId: firstOrder, status: 'cancelled', note: '   ' })).status, 400);

const dom = new JSDOM(read('staff.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, ''), {
  url: 'https://qa.invalid/staff.html', runScripts: 'outside-only', pretendToBeVisual: true
});
const w = dom.window;
const document = w.document;
let unavailable = false;
w.scrollTo = () => {};
w.HTMLElement.prototype.scrollIntoView = () => {};
w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
w.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new w.Event('close')); };
w.AbortSignal = AbortSignal;
w.ummaStaffAuth = { credential: () => 'web:' + 'a'.repeat(64), setActor() {} };
let cancellation;
w.fetch = async (url, options) => {
  const request = JSON.parse(options?.body || '{}');
  if (url.endsWith('cafe-menu')) return Response.json({ ok: true, products: [], inventory: [] });
  if (request.action === 'me') return Response.json({ ok: true, user: { id: 11, role: 'employee', name: 'QA' }, locations: locations.slice(0, 1), assignments: assignments.slice(0, 1) });
  if (request.action === 'list') return Response.json({
    ok: true, orders: orders.map((order, i) => ({ ...order, status: i ? 'pending' : cancellation ? 'cancelled' : 'pending', staffRole: 'manager' }))
  });
  if (request.action === 'updateStatus') {
    cancellation = request.note;
    return Response.json({ ok: true });
  }
  if (request.action === 'managerOverview' && unavailable) throw Error('Сеть недоступна');
  return request.action === 'managerOrderHistory' ? kitchen(request.action, request) : web(request.action, request);
};
const settle = () => new Promise(resolve => setTimeout(resolve, 30));
for (const name of ['kitchen','web-operations']) w.eval(read('js/cafe/' + name + '.js'));
await settle();
assert.equal(document.body.dataset.workspace, 'overview');
assert.equal(document.querySelector('[data-overview=payment]').textContent, '1');
assert.equal(document.getElementById('webOverviewCafeName').textContent, locations[0].name);
assert.equal(document.querySelector('[data-order-filter=payment]').hasAttribute('data-has-items'), true);
assert.equal(document.querySelector('[data-order-filter=new]').hasAttribute('data-has-items'), false);
document.dispatchEvent(new w.CustomEvent('umma:staff-inbox-counts', { detail: { unread: 3 } }));
assert.equal(document.querySelector('[data-inbox-metric=unread]').textContent, '3');
assert.equal(document.querySelector('[data-inbox-filter=unread]').hasAttribute('data-has-items'), true);
assert.equal(document.querySelector('[data-inbox-filter=attention]'), null);

let inboxFilter;
document.addEventListener('umma:staff-inbox-filter', event => { inboxFilter = event.detail; });
document.querySelector('[data-inbox-metric=unread]').click();
assert.equal(document.body.dataset.workspace, 'messages');
assert.equal(inboxFilter, 'unread');
document.querySelector('[data-web-tab=overview]').click();
await settle();
document.querySelector('[data-overview=payment]').click();
await settle();
assert.equal(document.body.dataset.workspace, 'orders');
assert.equal(document.querySelector('[data-kitchen-filter=payment]').classList.contains('is-active'), true);
document.querySelector('[data-web-tab=overview]').click();
await settle();
assert.equal(document.getElementById('webOverviewStockList').textContent, '<QA Манты>');
assert.equal(document.getElementById('webOverviewStockList').querySelector('qa'), null);
unavailable = true;
document.getElementById('webOverviewRefresh').click();
await settle();
assert.match(document.getElementById('webOverviewStatus').textContent, /последние полученные данные/);
unavailable = false;
w.dispatchEvent(new w.Event('online'));
await settle();
assert.equal(document.getElementById('webOverviewStatus').textContent, '');

document.querySelector('[data-overview-tab=cashOrders]').click();
await settle();
assert.equal(document.querySelectorAll('[data-kitchen-order]').length, 1);
const search = document.getElementById('webCashSearch');
search.value = '999';
search.dispatchEvent(new w.Event('input'));
assert.match(document.getElementById('cafeKitchenMessage').textContent, /не найден/);
search.value = '165';
search.dispatchEvent(new w.Event('input'));
document.querySelector('[data-new-status=cancelled]').click();
const form = document.querySelector('.work-order-dialog form');
form.querySelector('textarea').value = 'Ошибка при оформлении';
form.dispatchEvent(new w.Event('submit', { cancelable: true }));
await settle();
assert.equal(cancellation, 'Ошибка при оформлении');
assert.equal(document.querySelectorAll('[data-kitchen-order]').length, 0);

document.querySelector('[data-web-tab=admin]').click();
await settle();
assert.equal(document.querySelectorAll('.staff-account').length, 2);
assert.equal(document.getElementById('webInvitePanel').hidden, true);
assert.equal(document.querySelector('[data-save-staff-role]'), null);
dom.window.close();
console.log('PASS manager and cashier: branch-restricted overview, order history and roster, cash scope, mandatory cancellation note, cashier search and overview reconnect.');
