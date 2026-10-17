import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {marketRelease} from './build-market-release.mjs';
const db=new PGlite();
try{
 const sql=readFileSync('supabase/release/market-launch.sql','utf8');assert.equal(sql,marketRelease(),'Release bundle must match reviewed sources');
 await db.exec(readFileSync('tests/fixtures/supabase-public-schema.sql','utf8'));
 await db.exec("create role anon;create role authenticated;create role service_role;alter table locations add column delivery_zone jsonb;alter table cafe_orders add column payment_timing text;alter table cafe_orders add column dispatch_mode text default 'nearest';create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id integer generated always as identity,bucket_id text);alter table storage.objects enable row level security;create policy legacy_all on storage.objects for all using(true) with check(true);grant usage on schema storage to anon,authenticated;grant select on storage.objects to anon,authenticated;create schema cron;create function cron.schedule(text,text,text) returns bigint language sql as $$ select 1::bigint $$;");
 await db.exec(readFileSync('supabase/release/cafe-launch.sql','utf8'));
 await db.exec("insert into locations(name,location_type,city)values('HALAL UMMA','cafe','Nha Trang')");
 await db.exec(sql);
 await db.exec(readFileSync('supabase/proposals/market-postlaunch-hardening.sql','utf8'));await db.exec(readFileSync('supabase/proposals/market-postlaunch-hardening.sql','utf8'));
 await db.exec(readFileSync('supabase/proposals/market-vegetables-catalog.sql','utf8'));await db.exec(readFileSync('supabase/proposals/market-vegetables-catalog.sql','utf8'));
 const previews=(await db.query('select market_catalog(null) r')).rows[0].r.offers;assert.equal(previews.length,9);assert.ok(previews.every(x=>x.price_vnd===null&&x.available_quantity===0&&x.units.length===0));assert.equal(new Set(previews.map(x=>x.product.image_url)).size,9);
 assert.equal(Number((await db.query('select count(*) n from market_warehouses')).rows[0].n),1);
 assert.equal(Number((await db.query("select count(*) n from categories where category_type='market'")).rows[0].n),14);
 assert.equal(Number((await db.query("select count(*) n from market_batches")).rows[0].n),0,'no fictional inventory');
 assert.equal(Number((await db.query("select count(*) n from cafe_orders where source_module='market'")).rows[0].n),0,'no fictional orders');
 assert.ok((await db.query("select allowed_mime_types from storage.buckets where id='market-evidence'")).rows[0].allowed_mime_types.includes('application/pdf'));
 await db.exec("insert into storage.objects(bucket_id)values('market-evidence'),('market-catalog'),('other');set role anon;");
 assert.equal(Number((await db.query('select count(*) n from storage.objects')).rows[0].n),1,'restrictive policy overrides legacy policies');
 await assert.rejects(db.query('select market_catalog(null)'),/permission denied/);await db.exec('reset role');
 assert.equal((await db.query("select bool_and(relrowsecurity) r from pg_class where relname like 'market_%' and relkind='r'")).rows[0].r,true);
 await assert.rejects(db.exec(sql),/already exists/);await db.exec('rollback');
 assert.equal((await db.query('select market_catalog(null) r')).rows[0].r.ok,true,'failed replay rolls back without removing installed API');
 console.log('PASS atomic Market release: exact source bundle, initial store/categories, no fictional inventory, private evidence including PDF, RLS and failed replay rollback');
}finally{await db.close();}
