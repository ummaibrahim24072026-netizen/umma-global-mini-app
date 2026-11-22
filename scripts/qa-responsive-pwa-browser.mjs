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
const sizes = [[320,568],[360,800],[375,812],[390,844],[412,915],[430,932],[768,1024],[1024,768],
  [1440,900],[1920,1080],[2560,1440],[1080,1920],[720,1280],[844,390]];
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

async function hasReadableContrast(locator, label) {
  const contrast = await locator.evaluate(node => {
    function luminance(colour) {
      return colour.match(/\d+(?:\.\d+)?/g).slice(0, 3)
        .map(value => Number(value) / 255)
        .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
        .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    }
    const style = getComputedStyle(node);
    const foreground = luminance(style.color);
    const background = luminance(getComputedStyle(node.closest('.checkout-header') || node).backgroundColor);
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });
  assert.ok(contrast >= 4.5, label + ': contrast ' + contrast.toFixed(2));
}

try {
  browser = await chromium.launch({
    executablePath: process.env.QA_CHROMIUM_PATH || undefined,
    args: ['--no-sandbox','--disable-dev-shm-usage','--single-process'],
  });
  const context = await browser.newContext({ locale: 'de-DE', isMobile: true, hasTouch: true });
  context.setDefaultTimeout(12000);
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
  await page.setViewportSize({width:320,height:568});
  await page.locator('#openProfile').click();
  await fits(page, 'Delivery contact in profile', ['#profilePhoneForm', '#profileDeliveryPhone', '#saveProfilePhone']);
  const savedPhone = '+84 901 234 567';
  await page.locator('#profileDeliveryPhone').fill(savedPhone);
  await page.locator('#saveProfilePhone').click();
  await page.reload();
  await page.locator('[data-card]').first().waitFor();
  await page.locator('#openProfile').click();
  assert.equal(await page.locator('#profileDeliveryPhone').inputValue(), savedPhone);
  await page.locator('.dock-menu').click();
  await page.locator('[data-change="1"]').first().click();
  async function selectLanguage(language) {
    await page.locator('#openProfile').click();
    await page.locator('#menuLanguage').selectOption(language);
    await page.locator('.dock-menu').click();
  }
  for (const language of languages) {
    await selectLanguage(language);
    assert.equal(await page.locator('html').getAttribute('dir'), language === 'ar' ? 'rtl' : 'ltr');
    for (const [width,height] of sizes) {
      await page.setViewportSize({ width, height });
      await fits(page, 'Menu ' + language, ['#cafePage','.topbar','.brand','.topbar-actions','.cafe-intro','.menu-sticky','.cafe-product','#openCart','.menu-actions','.customer-dock','.customer-actions']);
    }
    await page.setViewportSize({width:320,height:568});
    await page.evaluate(async () => {
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      window.scrollTo(0, document.body.scrollHeight);
    });
    const dockBottom = await page.locator('.customer-dock').evaluate(node => node.getBoundingClientRect().bottom);
    assert.ok(Math.abs(dockBottom - 568) < 1, 'customer navigation remains visible at the end of the menu');
    assert.ok(await page.locator('.menu-footer').evaluate(footer =>
      footer.getBoundingClientRect().bottom < document.querySelector('.customer-dock').getBoundingClientRect().top),
    'footer remains above the dock at maximum scroll');
    await page.locator('#openCart').click();
    await fits(page, 'Checkout ' + language, ['#checkout','.cart-row','.payment-choice']);
    if (language === 'ar') await page.screenshot({path:output+'/checkout-ar-320.png'});
    await page.locator('.dock-menu').click();
    assert.equal(await page.locator('#checkout').evaluate(dialog => dialog.open), false);
  }
  await selectLanguage('ru');
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({path:output+'/menu-390.png'});
  const viewport = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    visualWidth: window.visualViewport.width,
    scale: window.visualViewport.scale,
    start: window.visualViewport.offsetLeft,
    doubleTap: getComputedStyle(document.body).touchAction,
  }));
  assert.deepEqual(viewport, {width: 390, visualWidth: 390, scale: 1, start: 0, doubleTap: 'manipulation'});
  const session = await context.newCDPSession(page);
  await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1.5 });
  assert.equal(await page.evaluate(() => window.visualViewport.scale), 1.5);
  await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
  await page.setViewportSize({width:844,height:390});
  await page.setViewportSize({width:390,height:844});
  await fits(page, 'Menu after zoom and rotation', ['.topbar','.cafe-intro','.customer-dock']);
  await page.locator('[data-card] .dish-link').first().click();
  await page.locator('#dishDetails[open]').waitFor();
  const before = catalogCalls;
  available = 9;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForFunction(() => document.querySelector('.cafe-stock-count')?.textContent.includes('9'));
  assert.ok(catalogCalls > before);
  assert.equal(await page.locator('#dishDetails').evaluate(dialog => dialog.open), true,
    'catalog refresh preserves the opened description');
  await page.locator('.dock-menu').click();
  await page.keyboard.press('Tab');
  const menuTab = page.locator('.dock-menu');
  await menuTab.focus();
  assert.equal(await menuTab.evaluate(node => getComputedStyle(node).outlineStyle), 'solid');
  await page.locator('#openCart').click();
  await hasReadableContrast(page.locator('#continueCheckout'), 'Cart action');
  await page.locator('#continueCheckout').click();
  await hasReadableContrast(page.locator('#checkout .customer-heading-brand'), 'Checkout heading');
  await hasReadableContrast(page.locator('#submit'), 'Checkout action');
  await page.setViewportSize({width:320,height:568});
  await fits(page, 'Checkout form', ['#checkout','.checkout-body']);
  await page.locator('label:has([name=checkoutOrderMode][value=delivery])').click();
  const deliveryPhone = page.locator('#deliveryPhone');
  assert.equal(await deliveryPhone.inputValue(), savedPhone);
  await deliveryPhone.fill('+84 902 345 678');
  await page.locator('label:has([name=checkoutOrderMode][value=pickup])').click();
  assert.equal(await deliveryPhone.isVisible(), false);
  await page.locator('label:has([name=checkoutOrderMode][value=delivery])').click();
  assert.equal(await deliveryPhone.inputValue(), '+84 902 345 678');
  await page.locator('label:has([name=checkoutOrderMode][value=pickup])').click();
  await page.locator('#submit').click();
  await page.locator('#successNumber').waitFor();
  assert.match(await page.locator('#successNumber').textContent(), /71/);
  assert.equal(checkoutCalls, 1);
  await hasReadableContrast(page.locator('#checkout .customer-heading-brand'), 'Receipt heading');
  await hasReadableContrast(page.locator('#newOrder'), 'Receipt action');

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
  await page.locator('[data-web-tab=pos]').click();
  await page.locator('.pos-product').first().waitFor();
  await page.locator('.pos-product').first().click();
  await page.locator('#counterExit').click();
  for (const tab of ['overview','pos','kitchen','portions','orders','messages','courier','admin']) {
    await page.locator('[data-web-tab='+tab+']').click();
    for (const [width,height] of sizes) {
      await page.setViewportSize({width,height});
      await fits(page, 'Work ' + tab, ['.web-header','.web-tabs','.web-panel','.pos-row']);
    }
    if (tab === 'pos') await page.locator('#counterExit').click();
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

  for (const path of ['delivery-tracking.html','payment-screen.html','pickup-board.html','market-print.html']) {
    await page.goto(base + path);
    for (const [width,height] of sizes) {
      await page.setViewportSize({width,height});
      await fits(page, path);
    }
  }
  assert.deepEqual(errors, []);
  assert.ok(requests.some(([endpoint, action]) => endpoint === 'cafe-web' && action === 'staffList'));
  console.log('PASS '+checks+' Chromium layout checks, 12 menu locales, counter checkout, catalog refresh, offline fallback and recovery, eight staff tabs and kiosk. Isolated API fixtures.');
} finally {
  await browser?.close();
  server.closeAllConnections();
  server.close();
}
