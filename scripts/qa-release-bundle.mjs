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
 console.log('PASS atomic release bundle, refund RLS/restricted RPCs and failed replay rollback');
}finally{await db.close();}
