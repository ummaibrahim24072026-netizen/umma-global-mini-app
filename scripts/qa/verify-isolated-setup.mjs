import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {cases,schema} from './multi-session-cases.mjs';
const db=new PGlite();
try{
 await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
 await db.exec(readFileSync('supabase/proposals/qa-isolated-setup.sql','utf8'));
 for(const name of cases){
  const a=await db.query(`SELECT ${schema}.qa_worker($1,'A',0) AS result`,[name]);
  const b=await db.query(`SELECT ${schema}.qa_worker($1,'B',0) AS result`,[name]);
  assert.equal(a.rows[0].result.ok,true,name+' A');
  assert.equal(b.rows[0].result.ok,['same_request','same_addon','same_payment'].includes(name),name+' B');
 }
 assert.equal(Number((await db.query("SELECT count(*) n FROM pg_tables WHERE schemaname='public'")).rows[0].n),0);
 for(const role of ['anon','authenticated','service_role']){
  const p=await db.query(`SELECT has_schema_privilege($1,'${schema}','USAGE') a,has_function_privilege($1,'${schema}.qa_worker(text,text,integer)','EXECUTE') b`,[role]);
  assert.equal(p.rows[0].a,false);assert.equal(p.rows[0].b,false);
 }
 await assert.rejects(db.exec(readFileSync('supabase/proposals/qa-isolated-setup.sql','utf8')),/already exists/);
 console.log('PASS prepared QA setup: seven case definitions, app roles denied, no public objects, existing-schema guard');
 console.log('NOTE: setup validation only; real multi-session execution still needs owner-approved QA schemas.');
}finally{await db.close();}
