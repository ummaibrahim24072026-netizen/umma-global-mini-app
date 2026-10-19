import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite();
const hadith='10000000-0000-4000-8000-000000000001',lesson='20000000-0000-4000-8000-000000000001',step='30000000-0000-4000-8000-000000000001',u1='40000000-0000-4000-8000-000000000001',u2='40000000-0000-4000-8000-000000000002';
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values('${u1}'),('${u2}');`);
 await db.exec(readFileSync('supabase/proposals/islam-foundation.sql','utf8'));
 assert.equal((await db.query("select count(*) n from pg_tables where schemaname='public' and rowsecurity")).rows[0].n,14);
 await db.exec(`insert into hadith_collections values('test','FIXTURE ONLY','https://example.test','fixture');insert into hadith_records(id,collection_id,number,book,edition,arabic,narrator,grade,source_url,license_note) values('${hadith}','test','1','test','test','اختبار','test','fixture','https://example.test','fixture');`);
 await assert.rejects(db.exec(`update hadith_records set status='published' where id='${hadith}'`),/seven-check/);
 await db.exec(`insert into hadith_translations(hadith_id,language,text,translator,source_url,license_note) values('${hadith}','ru','TEST ONLY','fixture','https://example.test','fixture');update hadith_records set status='review' where id='${hadith}';`);
 const approve=async(kind,table,id)=>db.exec(`insert into religious_content_reviews(content_kind,content_id,content_hash,reviewer,reviewer_qualification,checks,decision) select '${kind}',id,islam_content_hash(to_jsonb(t)),'TEST ONLY','fixture','{"sources":true,"arabic":true,"translation":true,"authenticity_context":true,"explanation":true,"differences":true,"final":true}','approved' from ${table} t where id='${id}';`);
 await approve('hadith','hadith_records',hadith);await db.exec(`update hadith_records set status='published' where id='${hadith}';`);
 await assert.rejects(db.exec(`update hadith_translations set text='CHANGED' where hadith_id='${hadith}'`),/draft/);
 await assert.rejects(db.exec(`update hadith_records set arabic='تغيير' where id='${hadith}'`),/seven-check/);
 await db.exec(`insert into prayer_lessons(id,slug,category,title,source_url,license_note) values('${lesson}','fixture','fixture','TEST ONLY','https://example.test','fixture');insert into prayer_lesson_steps(id,lesson_id,position,title,explanation) values('${step}','${lesson}',1,'fixture','fixture');`);
 await approve('lesson','prayer_lessons',lesson);await assert.rejects(db.exec(`update prayer_lessons set status='published' where id='${lesson}'`),/requires evidence/);
 await db.exec(`insert into lesson_evidences(lesson_id,step_id,hadith_id,citation,source_url) values('${lesson}','${step}','${hadith}','fixture','https://example.test');`);
 await assert.rejects(db.exec(`update prayer_lessons set status='published' where id='${lesson}'`),/seven-check/);
 await approve('lesson','prayer_lessons',lesson);await db.exec(`update prayer_lessons set status='published' where id='${lesson}';`);
 await db.exec('set role anon');assert.equal((await db.query('select count(*) n from hadith_records')).rows[0].n,1);assert.equal((await db.query('select count(*) n from hadith_translations')).rows[0].n,1);assert.equal((await db.query('select count(*) n from prayer_lessons')).rows[0].n,1);assert.equal((await db.query('select count(*) n from hadith_collections')).rows[0].n,1);
 await assert.rejects(db.exec("insert into hadith_collections values('bad','bad','https://example.test','bad')"),/permission denied/);await assert.rejects(db.query('select * from religious_content_reviews'),/permission denied/);await db.exec('reset role');
 await db.exec(`update hadith_records set status='draft' where id='${hadith}';set role anon;`);assert.equal((await db.query('select count(*) n from hadith_records')).rows[0].n,0);assert.equal((await db.query('select count(*) n from hadith_translations')).rows[0].n,0);await db.exec('reset role');
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${u1}';insert into qibla_preferences(user_id) values('${u1}');`);
 await assert.rejects(db.exec(`insert into qibla_preferences(user_id) values('${u2}')`),/row-level security/);await db.exec(`set request.jwt.claim.sub='${u2}';`);assert.equal((await db.query('select count(*) n from qibla_preferences')).rows[0].n,0);await db.exec(`update qibla_preferences set city_id='bad' where user_id='${u1}';reset role;`);assert.equal((await db.query('select city_id from qibla_preferences')).rows[0].city_id,'nha');
 console.log('PASS Islam database: 14 RLS tables; exact-revision seven-check publication; children frozen after review; evidence required; anonymous drafts/reviews hidden; public writes denied; cross-user reads/writes blocked.');
}finally{await db.close();}
