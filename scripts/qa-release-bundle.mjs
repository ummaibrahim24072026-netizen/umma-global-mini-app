import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite();try{
 await db.exec(readFileSync('tests/fixtures/supabase-public-schema.sql','utf8'));
 await db.exec('create role anon;create role authenticated;create role service_role;');
 const sql=readFileSync('supabase/release/cafe-launch.sql','utf8');await db.exec(sql);
 const p=(await db.query("select has_function_privilege('anon','refund_cafe_order(uuid,bigint,uuid,text,boolean)','execute') a,has_function_privilege('authenticated','assign_cafe_courier(uuid,bigint,bigint)','execute') b,(select relrowsecurity from pg_class where oid='cafe_order_refunds'::regclass) rls")).rows[0];assert.equal(p.a,false);assert.equal(p.b,false);assert.equal(p.rls,true);
 await assert.rejects(db.exec(sql),/already exists/);await db.exec('ROLLBACK');
 assert.ok((await db.query("select to_regprocedure('refund_cafe_order(uuid,bigint,uuid,text,boolean)') fn")).rows[0].fn);
 await db.exec("create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id integer generated always as identity,bucket_id text not null);alter table storage.objects enable row level security;create policy legacy_read_all on storage.objects for all using(true) with check(true);grant usage on schema storage to anon,authenticated;grant select on storage.objects to anon,authenticated;");
 await db.exec(readFileSync('supabase/proposals/courier-evidence-storage.sql','utf8'));await db.exec("insert into storage.objects(bucket_id) values('cafe-delivery-evidence'),('other-bucket');set role anon;");assert.equal(Number((await db.query('select count(*) n from storage.objects')).rows[0].n),1);await db.exec('reset role');
 console.log('PASS private courier bucket restrictive RLS blocks anonymous access despite legacy permissive policy');
 console.log('PASS atomic release bundle, refund RLS/restricted RPCs and failed replay rollback');
}finally{await db.close();}
