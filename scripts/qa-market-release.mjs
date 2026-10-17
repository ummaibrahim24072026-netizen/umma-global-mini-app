import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite();
try{
 await db.exec(readFileSync('tests/fixtures/supabase-public-schema.sql','utf8'));
 await db.exec(`create role anon;create role authenticated;create role service_role;alter table locations add column if not exists delivery_zone jsonb;alter table cafe_orders add column if not exists payment_timing text;alter table cafe_orders add column if not exists dispatch_mode text default 'nearest';`);
 for(const f of ['supabase/release/cafe-launch.sql','supabase/proposals/cafe-delivery-zone.sql','supabase/proposals/umma-pay.sql','supabase/proposals/umma-pay-reparse.sql'])await db.exec(readFileSync(f,'utf8'));
 // Storage/Cron are Supabase extensions, mocked only for release assembly validation.
 await db.exec(`create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid,bucket_id text);alter table storage.objects enable row level security;create schema cron;create table cron.job(jobname text,schedule text,command text);create function cron.schedule(text,text,text)returns bigint language sql as $$insert into cron.job values($1,$2,$3) returning 1::bigint$$;insert into locations(name,location_type,city)values('HALAL UMMA','cafe','Nha Trang');`);
 await db.exec(readFileSync('supabase/release/market-launch.sql','utf8'));
 const val=async(s)=>(await db.query(s)).rows[0].n;
 assert.equal(await val("select count(*)::int n from categories where category_type='market'"),14);
 assert.equal(await val('select count(*)::int n from market_warehouses'),1);
 assert.equal(await val('select count(*)::int n from market_batches'),0);
 assert.equal(await val('select count(*)::int n from storage.buckets'),2);
 assert.equal(await val("select count(*)::int n from cron.job where jobname='umma-market-maintenance'"),1);
 assert.equal(await val("select count(*)::int n from pg_policies where schemaname='storage' and policyname='market_files_service_only' and permissive='RESTRICTIVE'"),1);
 assert.equal(await val("select count(*)::int n from pg_tables where schemaname='public' and tablename like 'market_%' and not rowsecurity"),0);
 assert.equal((await db.query("select has_function_privilege('anon','public.market_catalog(uuid)','execute') v")).rows[0].v,false);
 console.log('PASS atomic Market release: schema, least-privilege seed, categories, empty stock, storage policy and scheduled maintenance');
}finally{await db.close();}
