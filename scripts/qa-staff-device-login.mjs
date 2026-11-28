import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';
import {JSDOM, VirtualConsole} from 'jsdom';
import QRCode from 'qrcode';
import {PNG} from 'pngjs';

const read = path => readFileSync(path, 'utf8');
const db = new PGlite();
await db.exec(`
  create role anon;
  create role authenticated;
  create role service_role bypassrls;
  create table public.telegram_users (telegram_id bigint primary key, is_active boolean, role text);
  create table public.locations (id uuid primary key, is_active boolean, location_type text);
  create table public.cafe_staff (telegram_id bigint, location_id uuid, is_active boolean);
  insert into public.telegram_users values (42,true,'employee'), (43,true,'user');
  insert into public.locations values ('00000000-0000-0000-0000-000000000001',true,'cafe');
  insert into public.cafe_staff values (42,'00000000-0000-0000-0000-000000000001',true);
`);
await db.exec(read('supabase/proposals/cafe-web-operations.sql').split('CREATE TABLE public.cafe_payment_screens')[0]);
await db.exec(`
  insert into public.cafe_web_accounts(actor_id,login,password_hash,salt) values (42,'staff','hash','salt'), (43,'guest','hash','salt');
  grant all on all tables in schema public to service_role;
`);
const migration = readdirSync('supabase/migrations').find(name => name.endsWith('_cafe_staff_device_login.sql'));
await db.exec(read('supabase/migrations/' + migration));
const query = async (sql, args = []) => (await db.query(sql, args)).rows[0];
assert.deepEqual(await query(`
  select has_table_privilege('anon','public.cafe_web_device_codes','select') as codes,
    has_function_privilege('authenticated','public.cafe_web_redeem_device_code(text,text)','execute') as redeem
`), {codes: false, redeem: false});

const edge = vm.createContext({
  crypto: globalThis.crypto, TextEncoder, Uint8Array, Response, console,
  Deno: {env: {get() {}}, serve(handler) {edge.handle = handler;}},
  createClient: () => ({
    async rpc(name, params) {
      const args = Object.values(params);
      const result = await query('select public.' + name + '($1,$2) as ok', args);
      return {data: result.ok};
    },
    from(table) {
      const args = [];
      const request = {
        delete() {return this;},
        eq(_, value) {args.push(value); return this;},
        async then(resolve) {
          await query('delete from public.' + table + ' where source_hash=$1 and code_hash=$2', args);
          resolve({error: null});
        },
      };
      return request;
    },
  }),
});
const loadTypeScript = path => stripTypeScriptTypes(read(path).replace(/^import .*\n/gm, '').replace(/^export /gm, ''));
vm.runInContext(loadTypeScript('supabase/functions/_shared/web-staff-auth.ts'), edge);
vm.runInContext(loadTypeScript('supabase/functions/cafe-device-login/index.ts'), edge);

const sha256 = vm.runInContext('sha256', edge);
const phone = 'a'.repeat(64), guest = 'b'.repeat(64);
const phoneHash = await sha256(phone);
await query('insert into public.cafe_web_sessions(token_hash,actor_id) values ($1,42),($2,43)', [phoneHash, await sha256(guest)]);
const post = body => edge.handle(new Request('https://test.invalid/qr', {method:'POST', body:JSON.stringify(body)}));
const issue = (source = phone) => post({action:'issue', credential:'web:' + source});
const redeem = code => post({action:'redeem', code});
const newCode = async () => {
  const response = await issue();
  assert.equal(response.status, 200);
  return (await response.json()).code;
};

assert.equal((await issue(guest)).status, 401);
assert.equal((await issue('invalid')).status, 401);
assert.equal((await redeem('invalid')).status, 400);

const replaced = await newCode();
const code = await newCode();
assert.equal((await redeem(replaced)).status, 410);
const claims = await Promise.all([redeem(code), redeem(code)]);
assert.deepEqual(claims.map(response => response.status).sort(), [200, 410]);
const {token} = await claims.find(response => response.ok).json();
assert.notEqual(token, phone);
const session = await query(`
  select actor_id, expires_at > now() and expires_at <= now() + interval '12 hours' as limited
  from public.cafe_web_sessions where token_hash=$1
`, [await sha256(token)]);
assert.deepEqual(session, {actor_id:42, limited:true});
assert.equal(await query('select 1 from public.cafe_web_device_codes where code_hash=$1', [await sha256(code)]), undefined);

const expired = await newCode();
await db.exec("update public.cafe_web_device_codes set expires_at=now()-interval '1 second'");
assert.equal((await redeem(expired)).status, 410);
const cancelled = await newCode();
await post({action:'cancel', code:cancelled, credential:'web:' + phone});
assert.equal((await redeem(cancelled)).status, 410);
const revoked = await newCode();
await query('update public.cafe_web_sessions set revoked_at=now() where token_hash=$1', [phoneHash]);
assert.equal((await redeem(revoked)).status, 410);
assert.equal((await issue()).status, 401);
await query('update public.cafe_web_sessions set revoked_at=null where token_hash=$1', [phoneHash]);
const removed = await newCode();
await db.exec('update public.cafe_staff set is_active=false');
assert.equal((await redeem(removed)).status, 410);
await db.close();

const html = read('staff.html');
const staffUrl = 'https://test.invalid/app/staff.html';
const qrUrl = staffUrl + '#device=' + code;
const script = read('js/cafe/web-device-login.js').replace('document.currentScript.src', 'location.href');
function staffPage(url, credential, fetch) {
  const {window:w} = new JSDOM(html, {url, runScripts:'outside-only', virtualConsole:new VirtualConsole()});
  w.HTMLDialogElement.prototype.showModal = function () {this.open = true;};
  w.AbortSignal = AbortSignal;
  w.fetch = async (_, options) => {
    const data = await fetch(JSON.parse(options.body));
    return Response.json(data, {status: data.ok ? 200 : 410});
  };
  w.eval(read('js/cafe/web-session.js'));
  if (credential) w.ummaStaffAuth.save(credential);
  w.eval(read('js/vendor/qrcode-generator.js'));
  w.eval(script);
  return w;
}
const tick = () => new Promise(resolve => setTimeout(resolve, 10));
const onPhone = staffPage(staffUrl, phone, async body => {
  assert.deepEqual(body, {action:'issue', credential:'web:' + phone});
  return {ok:true, code, validForSeconds:60};
});
onPhone.ummaStaffDeviceLogin.enable();
onPhone.document.getElementById('webAddDevice').click();
await tick();
assert.ok(onPhone.document.querySelector('#webDeviceQr svg'));
assert.match(onPhone.document.getElementById('webDeviceCountdown').textContent, /[0-9]+ сек/);
onPhone.close();

const onTablet = staffPage(qrUrl, null, async body => {
  assert.deepEqual(body, {action:'redeem', code});
  return {ok:true, token};
});
await tick();
assert.equal(onTablet.location.hash, '');
assert.equal(onTablet.ummaStaffAuth.credential(), 'web:' + token);
onTablet.close();

const occupiedTablet = staffPage(qrUrl, guest, () => assert.fail('An existing staff session must stay active'));
assert.equal(occupiedTablet.ummaStaffAuth.credential(), 'web:' + guest);
assert.match(occupiedTablet.document.getElementById('webDeviceScanStatus').textContent, /Выйдите/);
occupiedTablet.close();

const bitmap = PNG.sync.read(await QRCode.toBuffer(qrUrl, {errorCorrectionLevel:'M', scale:5}));
const vendor = vm.createContext({});
vm.runInContext(read('js/vendor/jsqr-1.4.0.js'), vendor);
assert.equal(vendor.jsQR(new Uint8ClampedArray(bitmap.data), bitmap.width, bitmap.height).data, qrUrl);
console.log('PASS staff QR login: role checks, separate session, one-time claim, expiry, cancellation, and tablet sign-in.');
