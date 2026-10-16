import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {parseVcb} from '../supabase/functions/umma-pay/parser.mjs';
const acct='1212121212';
const good='VCB Digibank\nTK 1212121212 +120,000 VND luc 10:00. So du 500,000 VND. ND: UMMA 123';
assert.deepEqual(parseVcb(good,acct),{amount:120000,orderNumber:'123'});
for(const text of [good.replace('+','-'),good.replace(acct,'1234567890'),good.replace('UMMA 123','UMMA 123 UMMA 124'),good.replace('+120,000 VND','120,000 VND'),good.replace(acct,'***9069'),good+' TK 1234567890',good.replace('UMMA 123','UMMA 1234abc')])assert.equal(parseVcb(text,acct),null,text);
const bankFormat='Thông báo VCB\nSố dư TK VCB 1212121212 +10,000 VND lúc 16-10-2026 14:32:28. Số dư 123,456 VND. Ref UMMA 76#SP#synthetic-reference';
assert.deepEqual(parseVcb(bankFormat,acct),{amount:10000,orderNumber:'76'});
assert.equal(parseVcb(bankFormat.replace(acct,'9999999999'),acct),null);
assert.equal(parseVcb(bankFormat.replace('+10,000','-10,000'),acct),null);
assert.equal(parseVcb(bankFormat.replace(acct,'***1212'),acct),null);
const db=new PGlite();
try{
 await db.exec(readFileSync('tests/fixtures/supabase-public-schema.sql','utf8'));
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
 await db.exec(readFileSync('supabase/proposals/cafe-courier-workflow.sql','utf8'));
 await db.exec(readFileSync('supabase/proposals/cafe-notifications.sql','utf8'));
 await db.exec(readFileSync('supabase/proposals/umma-pay.sql','utf8'));
 await db.exec(readFileSync('supabase/proposals/umma-pay-reparse.sql','utf8'));
 await db.exec("insert into locations(name,location_type) values('QA','cafe'); insert into telegram_users(telegram_id,role) values(99,'user');");
 const loc=(await db.query('select id from locations')).rows[0].id;
 const device=(await db.query("insert into umma_private.pay_devices(location_id,account,activation_hash,activation_expires) values($1,$2,'code',now()+interval '1 hour') returning id",[loc,acct])).rows[0].id;
 const pair=()=>db.query("select umma_pay_pair('code','token') r");await pair();await pair();await assert.rejects(db.query("select umma_pay_pair('code','other')"),/Invalid/);
 async function order(number,total=120000){return(await db.query("insert into cafe_orders(location_id,customer_telegram_id,order_number,order_type,payment_method,total_vnd,subtotal_vnd) overriding system value values($1,99,$2,'pickup','qr',$3,$3) returning id",[loc,number,total])).rows[0].id;}
 async function ingest(key,number=123,amount=120000,text=key,stamp=new Date().toISOString(),token='token'){return(await db.query('select umma_pay_ingest($1,$2,$3,$4,$5,$6,$7) r',[token,key,text,text,stamp,amount,number])).rows[0].r;}
 const recovered=await order(76,10000);
 assert.equal((await ingest('reparse',null,null,bankFormat)).reason,'unrecognized_notification');
 assert.equal((await ingest('reparse',76,10000,'changed text')).duplicate,true);
 const recognized=parseVcb(bankFormat,acct);
 // Preserve the original Android post timestamp on retry.
 const saved=(await db.query("select posted_at from umma_private.pay_events where event_key='reparse'")).rows[0].posted_at.toISOString();
 assert.equal((await ingest('reparse',recognized.orderNumber,recognized.amount,bankFormat,saved)).state,'confirmed');
 assert.equal((await ingest('reparse',76,10000,bankFormat,saved)).duplicate,true);
 assert.equal(Number((await db.query('select count(*) n from cafe_payment_receipts where order_id=$1',[recovered])).rows[0].n),1);
 const id=await order(123);assert.equal((await ingest('ok')).state,'confirmed');
 assert.equal((await ingest('ok')).duplicate,true);
 assert.equal((await ingest('new-key',123,120000,'ok')).duplicate,true);
 assert.equal((await ingest('different-text')).reason,'order_not_pending');
 assert.equal(Number((await db.query('select count(*) n from cafe_payment_receipts where order_id=$1',[id])).rows[0].n),1);
 assert.equal((await db.query('select payment_status from cafe_orders where id=$1',[id])).rows[0].payment_status,'paid');
 assert.equal(Number((await db.query("select count(*) n from umma_private.cafe_notifications where order_id=$1 and kind='payment' and recipient=99",[id])).rows[0].n),1);
 await order(124);assert.equal((await ingest('wrong-amount',124,100)).reason,'amount_mismatch');
 assert.equal((await ingest('unknown',null,null)).reason,'unrecognized_notification');
 assert.equal((await ingest('missing',999)).reason,'order_not_found');
 assert.equal((await ingest('old',124,120000,'old','2020-01-01T00:00:00Z')).reason,'notification_outside_window');
 await db.query("update cafe_orders set status='cancelled' where order_number=124");assert.equal((await ingest('cancelled',124)).reason,'order_closed');
 await assert.rejects(ingest('bad',123,120000,'bad',new Date().toISOString(),'bad'),/unauthorized/);
 await db.query('update umma_private.pay_devices set enabled=false where id=$1',[device]);await assert.rejects(ingest('disabled'),/unauthorized/);
 for(const role of ['anon','authenticated'])assert.equal((await db.query("select has_function_privilege($1,'public.umma_pay_ingest(text,text,text,text,timestamptz,integer,bigint)','execute') v",[role])).rows[0].v,false);
 console.log('PASS UMMA Pay: strict parser, pairing replay, revoked devices, exact matching, duplicate events, single receipt, private notification, amount/time/cancelled checks, restricted RPCs');
}finally{await db.close();}
