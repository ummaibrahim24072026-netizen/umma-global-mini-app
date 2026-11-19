import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

const db = new PGlite();
const cafe = randomUUID();
const product = randomUUID();
const q = (sql, params = []) => db.query(sql, params);
const action = async (name, args, actor = 13) =>
  (await q('select cafe_counter_foreign_payment($1,$2,$3::jsonb) result', [actor, name, JSON.stringify(args)])).rows[0].result;
const file = path => readFileSync(path, 'utf8');
const sale = method => ({
  method, locationId: cafe, requestKey: randomUUID(), items: [{ productId: product, quantity: 1 }],
  vndPerRub: 300, vndPerKzt: 50, quotedAt: new Date().toISOString(),
});
const state = async id => (await q('select payment_status,status from cafe_orders where id=$1', [id])).rows[0];
const orderCount = async () => (await q('select count(*)::int n from cafe_orders')).rows[0].n;

try {
  await db.exec(file('tests/fixtures/supabase-public-schema.sql'));
  await db.exec('create role anon; create role authenticated; create role service_role; create schema umma_private;');
  await db.exec(file('supabase/proposals/cafe-lifecycle-hardening.sql'));
  await db.exec(file('supabase/proposals/cafe-order-idempotency.sql'));
  await db.exec("alter table cafe_orders add column if not exists source_module text not null default 'cafe'");
  await db.exec(file('supabase/proposals/cafe-self-service-prepayment.sql'));
  await db.exec("create table umma_private.cafe_web_rub_recipient(singleton boolean primary key,bank text,recipient text,phone text);");
  await db.exec("insert into umma_private.cafe_web_rub_recipient values(true,'Сбербанк QA','QA recipient','+79000000000');");
  await db.exec(file('supabase/migrations/20261119104311_cafe_counter_foreign_payments.sql'));
  await db.exec(file('supabase/migrations/20261119111555_cafe_counter_google_tenge.sql'));
  await db.exec("insert into telegram_users(telegram_id,role) values (13,'employee'), (14,'employee'); insert into umma_runtime_settings(id,inventory_control_enabled) values(true,false)");
  await q("insert into locations(id,name,location_type,self_service_enabled) values($1,'QA','cafe',true)", [cafe]);
  await q("insert into cafe_staff(telegram_id,location_id,staff_role,can_accept_payments) values(13,$1,'cashier',true),(14,$1,'kitchen',false)", [cafe]);
  await q("insert into products(id,name_ru,name_vi,name_en,product_type,price_vnd) values($1,'QA dish','QA','QA','cafe',120000)", [product]);
  const flags = await action('options', { locationId: cafe });
  assert.deepEqual(flags.methods, { rub: true, sber: true, tenge: false, kaspi: false, usdt: false });
  const noRate = sale('rub');
  delete noRate.vndPerRub;
  await assert.rejects(action('create', noRate), /COUNTER_RATE/);
  await assert.rejects(action('create', sale('usdt')), /COUNTER_UNAVAILABLE/);
  assert.equal(await orderCount(), 0);
  await assert.rejects(action('create', sale('rub'), 14), /COUNTER_ACCESS/);
  const original = sale('rub');
  const rub = await action('create', original);
  assert.equal(rub.payment.currency, 'RUB');
  assert.equal(rub.payment.amount, 400);
  assert.equal(rub.paymentStatus, 'pending');
  assert.equal((await action('create', { ...original, vndPerRub: undefined })).order.id, rub.order.id);
  assert.equal((await action('details', { orderId: rub.order.id })).payment.amount, 400);
  await assert.rejects(action('details', { orderId: rub.order.id }, 14), /COUNTER_ACCESS/);
  await assert.rejects(q("select update_cafe_order_payment_cash($1,13,'paid')", [rub.order.id]), /через раздел/);
  const receipt = { orderId: rub.order.id, verified: true, reference: 'bank-00123' };
  await assert.rejects(action('confirm', { ...receipt, verified: false }), /COUNTER_REFERENCE/);
  await action('confirm', receipt);
  assert.deepEqual(await state(rub.order.id), {payment_status: 'paid', status: 'preparing'});
  assert.equal((await action('confirm', receipt)).replayed, true);
  const sber = await action('create', sale('sber'));
  await assert.rejects(action('confirm', { ...receipt, orderId: sber.order.id }), /COUNTER_DUPLICATE_REFERENCE/);
  assert.equal((await state(sber.order.id)).payment_status, 'pending');
  await q("insert into umma_private.cafe_counter_recipients values($1,'kaspi','QA KZ','QA123456',null,null),($1,'usdt','QA wallet','QA654321','QA network',25324)", [cafe]);
  const beforeInvalid = await orderCount();
  await assert.rejects(action('create', { ...sale('kaspi'), vndPerKzt: undefined }), /COUNTER_KZT_RATE/);
  await assert.rejects(action('create', { ...sale('tenge'), quotedAt: '2000-01-01T00:00:00Z' }), /COUNTER_KZT_RATE/);
  assert.equal(await orderCount(), beforeInvalid);
  const kaspiDraft = sale('kaspi');
  const kaspiOrder = await action('create', kaspiDraft);
  const kaspiReplay = await action('create', { ...kaspiDraft, vndPerKzt: 60 });
  assert.equal(kaspiReplay.order.id, kaspiOrder.order.id);
  assert.equal(kaspiReplay.payment.amount, kaspiOrder.payment.amount);
  for (const method of ['tenge','kaspi','usdt']) {
    const item = await action('create', sale(method));
    assert.equal(item.payment.currency, method==='usdt'?'USDT':'KZT');
    assert.equal(item.payment.amount, method==='usdt'?4.738588:2400);
    assert.equal(item.payment.network, method==='usdt'?'QA network':null);
  }
  const grants = await q("select has_function_privilege('anon','public.cafe_counter_foreign_payment(bigint,text,jsonb)','execute') as anon, has_function_privilege('authenticated','public.cafe_counter_foreign_payment(bigint,text,jsonb)','execute') as authenticated");
  assert.deepEqual(grants.rows[0], {anon:false,authenticated:false});
  console.log('PASS PostgreSQL counter payments: frozen RUB/KZT/USDT amount, role and branch scope, rollback without setup, same-order retry, confirmation guard, one bank payment per reference and paid-to-kitchen transition.');
} finally {
  await db.close();
}
