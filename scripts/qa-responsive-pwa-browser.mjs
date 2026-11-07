import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, resolve, sep } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = process.env.QA_OUTPUT_DIR || '/tmp/umma-responsive-qa';
const root = process.cwd();
const prefix = '/umma-global-mini-app/';
const types = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json',
  '.json': 'application/json', '.mp3': 'audio/mpeg',
};
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (!pathname.startsWith(prefix)) return res.writeHead(404).end();
  let file = resolve(root, decodeURIComponent(pathname.slice(prefix.length)));
  if (file !== root && !file.startsWith(root + sep)) return res.writeHead(404).end();
  try {
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    await stat(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    createReadStream(file).pipe(res);
  } catch { res.writeHead(404).end(); }
});
await mkdir(output, { recursive: true });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const base = origin + prefix;
const location = { id: 'e22788bd-4734-4b3a-911e-ba103d52617a', name: 'HALAL UMMA · QA', is_active: true };
const product = {
  id: '11111111-1111-4111-8111-111111111111',
  sku: 'UMMA-CAFE-PLOV', name_ru: 'Плов с бараниной', name_en: 'Lamb pilaf',
  name_vi: 'Cơm cừu', name_de: 'LammreisgerichtmitvielenGewürzenundKräutern',
  name_ar: 'أرز بلحم الضأن والخضار', description_ru: 'Длинное описание блюда',
  price_vnd: 120000, stockManaged: true, available: 10,
};
const sizes = [[320,568],[360,800],[390,844],[430,932],[768,1024],[1024,768],
  [1440,900],[1920,1080],[1080,1920],[720,1280],[844,390]];
const languages = ['ru','en','vi','ko','zh','de','fr','th','ms','id','ar','pt'];
let available = 10;
let catalogCalls = 0;
let checkoutCalls = 0;
const requests = [];
const errors = [];
let browser;
let checks = 0;

async function fits(page, scene, selectors = []) {
  const problems = await page.evaluate(selectors => {
    const viewport = document.documentElement.clientWidth;
    const nodes = [document.documentElement, ...selectors.flatMap(s => [...document.querySelectorAll(s)])];
    return nodes.filter(e => e.getClientRects().length && e.clientWidth > 0 &&
      (e.scrollWidth > e.clientWidth + 1 || e.getBoundingClientRect().right > viewport + 1 ||
       e.getBoundingClientRect().left < -1)).map(e => ({
      id: e.id, classes: e.className, client: e.clientWidth, scroll: e.scrollWidth,
      left: e.getBoundingClientRect().left, right: e.getBoundingClientRect().right,
    }));
  }, selectors);
  if (problems.length) {
    const overhang = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e =>
      e.getBoundingClientRect().right > document.documentElement.clientWidth + 1).slice(0, 12)
      .map(e => [e.tagName, e.id, e.className, e.getBoundingClientRect().right]));
    assert.fail(scene + ' at ' + JSON.stringify({ viewport: page.viewportSize(), problems, overhang }));
  }
  checks++;
}

try {
  browser = await chromium.launch({
    executablePath: process.env.QA_CHROMIUM_PATH || undefined,
    args: ['--no-sandbox','--disable-dev-shm-usage','--single-process'],
  });
  const context = await browser.newContext({ locale: 'de-DE' });
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (!url.pathname.startsWith('/functions/v1/')) return route.abort();
    const headers = {
      'access-control-allow-origin': '*', 'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
    };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const body = request.postData() ? request.postDataJSON() : {};
    const endpoint = url.pathname.split('/').at(-1);
    requests.push([endpoint, body.action || request.method()]);
    let payload = { ok: true };
    if (endpoint === 'cafe-menu') payload = { ...payload, products: [product], locations: [location], inventory: [] };
    if (endpoint === 'cafe-guest-order' && request.method() === 'GET') {
      catalogCalls++;
      payload.products = [{ ...product, available }];
    }
    if (endpoint === 'cafe-guest-order' && body.action === 'create') {
      checkoutCalls++;
      assert.equal(body.tableNumber, '');
      assert.equal(body.paymentMethod, 'cash');
      payload.order = { id: 'qa-order', orderNumber: 71, totalVnd: 120000, paymentMethod: 'cash',
        status: 'pending', paymentStatus: 'pending' };
    }
    if (endpoint === 'cafe-kiosk' && body.action === 'config') Object.assign(payload, { location, qrAvailable: true });
    if (endpoint === 'cafe-web') {
      if (body.action === 'login') payload.token = 'a'.repeat(64);
      if (body.action === 'me') Object.assign(payload, {
        user: { id: 11, name: 'Длинное имя сотрудника для проверки', role: 'super_admin' },
        assignments: [], locations: [location],
      });
      if (body.action === 'staffList') payload.accounts = [];
    }
    if (endpoint === 'cafe-kitchen') Object.assign(payload, {
      orders: [], locations: [location], locationIds: [location.id], couriers: [], staffRole: 'manager',
    });
    return route.fulfill({ headers, json: payload });
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().startsWith(base) && response.status() === 404) errors.push('404 ' + response.url());
  });
  await page.goto(base + 'order.html?point=responsive-fixture');
  await page.locator('[data-card]').first().waitFor();
  assert.equal(await page.locator('html').getAttribute('lang'), 'de', 'device language');
  await page.locator('[data-change="1"]').first().click();
  for (const language of languages) {
    await page.locator('#menuLanguage').selectOption(language);
    assert.equal(await page.locator('html').getAttribute('dir'), language === 'ar' ? 'rtl' : 'ltr');
    for (const [width,height] of sizes) {
      await page.setViewportSize({ width, height });
      await fits(page, 'Menu ' + language, ['.cafe-product','.order-bar','.menu-actions']);
    }
    await page.setViewportSize({width:320,height:568});
    await page.locator('#openCart').click();
    await fits(page, 'Checkout ' + language, ['#checkout','.cart-row','.payment-choice']);
    if (language === 'ar') await page.screenshot({path:output+'/checkout-ar-320.png'});
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#checkout').evaluate(dialog => dialog.open), false);
  }
  await page.locator('#menuLanguage').selectOption('ru');
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:output+'/menu-390.png'});
  const summary = page.locator('[data-card] summary').first();
  await summary.click();
  await summary.focus();
  const before = catalogCalls;
  available = 9;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForFunction(() => document.querySelector('.cafe-stock-count')?.textContent.includes('9'));
  assert.ok(catalogCalls > before);
  assert.equal(await summary.evaluate(node => node.parentElement.open && node === document.activeElement), true,
    'catalog refresh preserves opened description and keyboard focus');
  await page.locator('#openCart').click();
  await page.locator('#submit').click();
  await page.locator('#successNumber').waitFor();
  assert.match(await page.locator('#successNumber').textContent(), /71/);
  assert.equal(checkoutCalls, 1);

  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  const offline = await page.goto(base+'menu/');
  assert.equal(offline.status(), 503);
  assert.match(await page.locator('main').textContent(), /Offline/);
  assert.equal(await page.locator('#checkout').count(), 0);
  await context.setOffline(false);
  await page.locator('button').click();
  await page.locator('[data-card]').first().waitFor();

  await page.goto(base + 'staff.html');
  for (const [width,height] of sizes) {
    await page.setViewportSize({width,height});
    await fits(page, 'Staff login', ['#webLogin','.web-header']);
  }
  await page.locator('#webLoginName').fill('qa');
  await page.locator('#webPassword').fill('test-only-password');
  await page.locator('#webLoginSubmit').click();
  await page.locator('.pos-product').first().waitFor();
  await page.locator('.pos-product').first().click();
  for (const tab of ['pos','orders','messages','courier','ingredients','admin']) {
    await page.locator('[data-web-tab='+tab+']').click();
    for (const [width,height] of sizes) {
      await page.setViewportSize({width,height});
      await fits(page, 'Work ' + tab, ['.web-header','.web-tabs','.web-panel','.pos-row']);
    }
  }
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:output+'/staff-admin-390.png'});

  await page.goto(base + 'kiosk.html#activate='+'a'.repeat(64));
  await page.locator('[data-action=start]').click();
  await page.locator('[data-change="1"]').first().click();
  for (const [width,height] of sizes) {
    await page.setViewportSize({width,height});
    await fits(page, 'Kiosk menu', ['header','header nav','.layout','.menu-head','.product','.product footer','.qty','.basket','.categories']);
  }
  await page.locator('[data-action=review]').click();
  assert.equal(await page.locator('#table').count(), 0);
  for (const [width,height] of sizes) {
    await page.setViewportSize({width,height});
    await fits(page, 'Kiosk checkout', ['header','.checkout','.checkout-section']);
  }
  await page.setViewportSize({width:1080,height:1920});
  await page.screenshot({path:output+'/kiosk-checkout-portrait.png'});

  for (const path of ['delivery-tracking.html','payment-screen.html','market-print.html']) {
    await page.goto(base + path);
    for (const [width,height] of sizes) {
      await page.setViewportSize({width,height});
      await fits(page, path);
    }
  }
  assert.deepEqual(errors, []);
  assert.ok(requests.some(([endpoint, action]) => endpoint === 'cafe-web' && action === 'staffList'));
  console.log('PASS '+checks+' Chromium layout checks, 12 menu locales, counter checkout, catalog focus, offline fallback and recovery, six staff tabs and kiosk. Isolated API fixtures.');
} finally {
  await browser?.close();
  server.closeAllConnections();
  server.close();
}
