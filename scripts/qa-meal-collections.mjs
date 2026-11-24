import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const db=new PGlite();
const cafe='e22788bd-4734-4b3a-911e-ba103d52617a';
const otherCafe='11111111-1111-4111-8111-111111111111';
const croissant='22222222-2222-4222-8222-222222222222';
const plov='33333333-3333-4333-8333-333333333333';
try {
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role BYPASSRLS;
    CREATE TABLE public.locations(id uuid PRIMARY KEY,is_active boolean);
    CREATE TABLE public.products(id uuid PRIMARY KEY, sku text, product_type text, is_active boolean, catalog_preview boolean);
    GRANT SELECT ON public.products TO service_role;
    INSERT INTO locations VALUES ('${cafe}',true), ('${otherCafe}',true);
    INSERT INTO products VALUES
      ('${croissant}','UMMA-CAFE-CROISSANT','cafe',true,false),
      ('${plov}','UMMA-CAFE-PLOV','cafe',true,false),
      ('44444444-4444-4444-8444-444444444444','UMMA-CAFE-SAMSA','cafe',false,false);
  `);
  await db.exec(fs.readFileSync(new URL('../supabase/proposals/cafe-web-storefront.sql',import.meta.url),'utf8'));
  await db.exec(`INSERT INTO cafe_web_sections(location_id,product_id,section,service_date)
    VALUES ('${cafe}','${plov}','dish-day','2000-01-01');`);
  const catalog='SELECT cafe_web_section_catalog($1) AS sections';
  await db.exec('SET ROLE service_role');
  assert.deepEqual((await db.query(catalog,[cafe])).rows[0].sections,[
    {section:'breakfast',productId:croissant,allowPreorder:true},
    {section:'dinner',productId:plov,allowPreorder:true},
    {section:'lunch',productId:plov,allowPreorder:true},
  ]);
  assert.deepEqual((await db.query(catalog,[otherCafe])).rows[0].sections,[]);
  await db.query('UPDATE cafe_web_sections SET enabled=false WHERE section=$1 AND product_id=$2',['lunch',plov]);
  assert.equal((await db.query(catalog,[cafe])).rows[0].sections.some(row=>row.section==='lunch'),false);
  for(const role of ['anon','authenticated']){
    await db.exec('SET ROLE '+role);
    await assert.rejects(db.query(catalog,[cafe]),/permission denied/);
    await assert.rejects(db.query('SELECT * FROM cafe_web_sections'),/permission denied/);
  }
  console.log('PASS meal collections: curated initial SKUs, local date filter, location isolation, manager changes, private table and RPC.');
}finally{
  await db.close();
}
