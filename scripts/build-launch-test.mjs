import { readFileSync, writeFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const banner = '<div style="padding:8px;text-align:center;background:#fff4d7;color:#563f16;font:14px system-ui">Тестовая версия · учебные заказы и оплата</div>';
const photo = (path, mime) => 'data:' + mime + ';base64,' + readFileSync(path).toString('base64');
const photos = [
  photo('logo/assets/menu/plov-white-v2.webp', 'image/webp'),
  photo('logo/assets/menu/manti.png', 'image/png'),
  photo('logo/assets/menu/shurpa-white-v2.webp', 'image/webp')
];
const guard = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; form-action 'none'; base-uri 'none'">
<script>
window.fetch = (url, options) => parent.ummaTestRequest(url, options);
try { delete Object.getPrototypeOf(navigator).serviceWorker; } catch {}
for (const key of ['localStorage', 'sessionStorage']) {
  const entries = new Map();
  Object.defineProperty(window, key, {value: {
    getItem: name => entries.get(name) ?? null, setItem: (name, value) => entries.set(name, String(value)),
    removeItem: name => entries.delete(name)
  }});
}
localStorage.setItem('umma-menu-language', 'ru');
if (location.hash === '#staff') localStorage.setItem('umma:web-staff-session', 'test-only');
</script>`;

function inlinePage(path, staff = false) {
  return read(path)
    .replace(/<base\b[^>]*>/gi, '')
    .replace(/<meta charset="utf-8">/i, match => match + guard.replace("if (location.hash === '#staff')", 'if (' + staff + ')'))
    .replace(/<link\b[^>]*>/gi, tag => {
      const css = tag.match(/href="(css\/[^"?]+)/)?.[1];
      return css ? '<style>' + read(css) + '</style>' : '';
    })
    .replace(/<script\b[^>]*src="([^"?]+)[^"]*"[^>]*><\/script>/gi, (_tag, path) =>
      path.startsWith('js/') && !['js/core/pwa-registration.js','js/maps/nha-trang-router.js'].includes(path)
        ? '<script>' + (path === 'js/cafe/product-photo.js'
          ? "window.ummaCafeProductPhoto = product => product.image_url || '';"
          : read(path)).replace(/<\/script/gi, '<\\/script') + '</script>' : '')
    .replace(/<body([^>]*)>/i, '<body$1>' + banner);
}

function setup(photos) {
  const location = { id: 'e22788bd-4734-4b3a-911e-ba103d52617a', name: 'HALAL UMMA · Тест', location_type: 'cafe', is_active: true };
  const products = [
    ['Плов с бараниной', 'Cơm cừu', 'Lamb pilaf', 120000, 'PLOV'],
    ['Манты (4 шт.)', 'Bánh hấp', 'Manti (4 pcs)', 150000, 'MANTI'],
    ['Шурпа', 'Súp thịt cừu', 'Lamb soup', 90000, 'SHURPA'],
  ].map(([name_ru, name_vi, name_en, price_vnd, sku], i) => ({
    id: 'demo-' + i, sku: 'UMMA-CAFE-' + sku, name_ru, name_vi, name_en, price_vnd, image_url: photos[i], stockManaged: true, is_active: true
  }));
  let orders = [];
  const terminal = order => ['completed', 'cancelled'].includes(order.status);
  const catalog = () => products.map(product => ({ ...product, available: 12 - orders.filter(order => order.status !== 'cancelled')
    .flatMap(order => order.items).filter(item => item.productId === product.id).reduce((sum, item) => sum + item.quantity, 0) }));
  const receipt = order => ({
    id: order.id, orderNumber: order.order_number, status: order.status, totalVnd: order.total_vnd,
    paymentStatus: order.payment_status, paymentMethod: order.payment_method,
    items: order.cafe_order_items.map(item => ({ name_ru: item.product_name_ru, quantity: item.quantity,
      lineTotalVnd: item.line_total_vnd, unitPriceVnd: item.line_total_vnd / item.quantity }))
  });
  const reply = (data = {}, status = 200) => new Response(JSON.stringify({ ok: status < 400, ...data }), { status });
  window.ummaTestRequest = async (url, options = {}) => {
    const endpoint = new URL(url, window.location.href).pathname.split('/').at(-1);
    const body = options.body ? JSON.parse(options.body) : {};
    const order = orders.find(item => item.id === body.orderId);
    if (endpoint === 'cafe-connect' && body.action === 'news') return reply({ news: [] });
    if (endpoint === 'cafe-menu') return reply({ products: catalog(), locations: [location], inventory: [] });
    if (endpoint === 'cafe-guest-order' && !options.body) return reply({ products: catalog() });
    if (endpoint === 'cafe-guest-order' && body.action === 'status') {
      return order && body.requestKey === order.requestKey ? reply({ order: receipt(order) }) : reply({}, 404);
    }
    if ((endpoint === 'cafe-guest-order' && body.action === 'create') || endpoint === 'create-cafe-order') {
      const replay = orders.find(item => item.requestKey === body.requestKey);
      if (replay) return reply({ order: receipt(replay) });
      if (body.orderType === 'delivery' || body.paymentMethod !== 'cash') return reply({}, 400);
      const available = catalog();
      if (!body.items?.length || body.items.some(item => !Number.isSafeInteger(item.quantity) || item.quantity < 1 ||
          item.quantity > (available.find(product => product.id === item.productId)?.available ?? 0))) {
        return reply({ code: 'STOCK_UNAVAILABLE' }, 409);
      }
      const lines = body.items.map(item => {
        const product = products.find(candidate => candidate.id === item.productId);
        return { id: product.id, product_name_ru: product.name_ru, quantity: item.quantity, line_total_vnd: product.price_vnd * item.quantity };
      });
      const created = { id: crypto.randomUUID(), requestKey: body.requestKey, order_number: orders.length + 1,
        location_id: location.id, order_type: 'pickup', created_via: body.staffOrder ? 'staff' : 'customer', created_at: new Date().toISOString(),
        status: 'pending', payment_status: 'pending', payment_method: 'cash', customer_name: body.name || 'Тестовый гость',
        requires_prepayment: !body.staffOrder, canAcceptPayments: true, staffRole: 'manager', items: body.items,
        total_vnd: lines.reduce((sum, line) => sum + line.line_total_vnd, 0), cafe_order_items: lines };
      orders.unshift(created);
      return reply({ order: receipt(created) });
    }
    if (endpoint === 'cafe-web' && body.action === 'me') return reply({
      user: { id: 11, role: 'super_admin', name: 'Тестовый кассир' }, assignments: [], locations: [location]
    });
    if (endpoint === 'cafe-kitchen' && body.action === 'list') return reply({
      orders, locations: [location], locationIds: [location.id], staffRole: 'manager', actorTelegramId: 11
    });
    if (endpoint === 'cafe-kitchen' && body.action === 'cashList') return reply({ locationId: location.id, locations: [location], staff: [], receipts: [], handovers: [], shifts: [] });
    if (endpoint === 'cafe-kitchen' && body.action === 'updatePayment' && order && !terminal(order) &&
        body.paymentStatus === 'paid' && body.tenderedAmountVnd - body.changeGivenVnd === order.total_vnd) {
      order.payment_status = 'paid';
      return reply({ order: receipt(order) });
    }
    if (endpoint === 'cafe-kitchen' && body.action === 'updateStatus' && order && !terminal(order)) {
      const next = { pending: 'confirmed', confirmed: 'preparing', preparing: 'ready', ready: 'completed' };
      if ((body.status === next[order.status] && order.payment_status === 'paid') ||
          (body.status === 'cancelled' && order.payment_status !== 'paid')) {
        order.status = body.status;
        return reply();
      }
      return reply({ error: 'Проверьте статус и оплату заказа' }, 409);
    }
    return reply({ error: 'Действие недоступно в тестовой версии' }, 400);
  };
}

const safeJson = value => JSON.stringify(value).replace(/</g, '\\u003c');
const destination = process.argv[2];
if (!destination) throw new Error('Pass the output HTML path');
writeFileSync(destination, `<!doctype html><html lang="ru"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>UMMA · Проверка заказа</title>
<style>
body{margin:0;font:16px system-ui;color:#183b39;background:#eff8f6}
header{padding:12px 16px;background:#fff}h1{font-size:20px;margin:0 0 4px}
p{margin:0 0 10px;font-size:14px}nav{display:flex;gap:8px;flex-wrap:wrap}
button{min-height:42px;padding:5px 14px;border:1px solid #067876;border-radius:9px;background:#fff;color:#075b59;font:inherit}
button[aria-pressed=true]{background:#067876;color:#fff}
iframe{display:block;border:0;width:100%;height:75vh;background:#fff}iframe[hidden]{display:none}
</style>
<header><h1>HALAL UMMA · Проверка заказа</h1>
<p>Добавьте блюдо → оформите самовывоз за наличные → откройте «Касса и кухня» → оплатите и выдайте заказ → проверьте историю в меню. Используйте вымышленные данные.</p>
<nav><button type="button" data-panel="guest" aria-pressed="true">Меню клиента</button>
<button type="button" data-panel="staff" aria-pressed="false">Касса и кухня</button></nav></header>
<iframe id="guest" title="Меню клиента" sandbox="allow-scripts allow-same-origin allow-modals"></iframe>
<iframe id="staff" title="Касса и кухня" sandbox="allow-scripts allow-same-origin allow-modals" hidden></iframe>
<script>
(${setup.toString()})(${safeJson(photos)});
const pages = {guest:${safeJson(inlinePage('menu/index.html'))},staff:${safeJson(inlinePage('staff.html',true))}};
for (const button of document.querySelectorAll('[data-panel]')) button.onclick = () => {
  for (const toggle of document.querySelectorAll('[data-panel]')) {
    const frame = document.getElementById(toggle.dataset.panel);
    frame.hidden = toggle !== button;
    toggle.setAttribute('aria-pressed', String(!frame.hidden));
    if (!frame.hidden && !frame.srcdoc) frame.srcdoc = pages[frame.id];
    else if (!frame.hidden) frame.contentWindow.dispatchEvent(new Event('online'));
  }
};
document.querySelector('[data-panel=guest]').click();
</script></html>`);
