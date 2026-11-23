import {PGlite} from "@electric-sql/pglite";
import {readFileSync} from "node:fs";
import {randomUUID} from "node:crypto";
import assert from "node:assert/strict";

const db=new PGlite();
const [cafe,product,rice,plov]=Array.from({length:4},()=>randomUUID());
const q=(sql,args=[])=>db.query(sql,args);
const result=async(sql,args=[])=>(await q(sql,args)).rows[0].result;
const row=(itemId,quantity,unit,more={})=>({itemId,quantity,unit,...more});
const post=(payload,key=randomUUID(),actor=10)=>result("select cafe_owner_post($1,$2,$3,$4::jsonb) result",
  [actor,cafe,key,JSON.stringify({source:"manual",...payload})]);
const dashboard=(actor=10)=>result("select cafe_owner_dashboard($1,$2,7) result",[actor,cafe]);
const balance=async id=>(await dashboard()).stock.find(s=>s.id===id);
const day=new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Ho_Chi_Minh"}).format(new Date());
try{
  await db.exec(readFileSync("tests/fixtures/supabase-public-schema.sql","utf8"));
  await db.exec("create role anon;create role authenticated;create role service_role;create schema if not exists auth;create function auth.role() returns text language sql as $$select 'service_role'::text$$;create schema if not exists umma_private;create schema cron;create function cron.schedule(text,text,text) returns bigint language sql as $$select 1::bigint$$;");
  await db.exec("create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit integer,allowed_mime_types text[]);create table storage.objects(bucket_id text,name text,primary key(bucket_id,name));create table public.market_product_variants(stock_item_id uuid);create table public.cafe_order_refunds(order_id uuid);");
  await q("insert into locations(id,name,location_type) values($1,'QA cafe','cafe')",[cafe]);
  await db.exec("insert into telegram_users(telegram_id,role) values(10,'super_admin'),(11,'employee'),(12,'employee'),(13,'employee');insert into umma_runtime_settings(id,inventory_control_enabled) values(true,false);");
  await q("insert into cafe_staff(telegram_id,location_id,staff_role,can_accept_payments) values(11,$1,'cashier',true),(12,$1,'kitchen',false),(13,$1,'manager',true)",[cafe]);
  await q("insert into products(id,name_ru,name_vi,name_en,product_type,price_vnd) values($1,'Плов','Cơm','Plov','cafe',120000)",[product]);
  await db.exec(readFileSync("supabase/proposals/cafe-lifecycle-hardening.sql","utf8"));
  await db.exec("alter table umma_runtime_settings add column cafe_reset_epoch uuid;create function cafe_guest_order_status(uuid,uuid) returns jsonb language plpgsql as $$declare v_order cafe_orders%rowtype;begin return jsonb_build_object('status',v_order.status);end$$;alter table products add column catalog_preview boolean not null default false;alter table cafe_orders add column source_module text not null default 'cafe';");
  await db.exec(readFileSync("supabase/proposals/cafe-ready-stock.sql","utf8"));
  await db.exec(readFileSync("supabase/migrations/20261123155657_cafe_owner_manager.sql","utf8"));
  await q("insert into stock_items(id,name_ru,item_type,base_unit,linked_product_id) values($1,'Рис','raw_material','kg',null),($2,'Плов','finished_good','portion',$3)",[rice,plov,product]);
  await q("update locations set ready_stock_enabled=true where id=$1",[cafe]);
  await assert.rejects(dashboard(11),/Нет доступа/);
  await assert.rejects(post({kind:"mode",mode:"C"},randomUUID(),13),/Недостаточно прав/);
  assert.equal(await result("select has_function_privilege('anon','cafe_owner_post(bigint,uuid,uuid,jsonb)','execute') result"),false);
  const key=randomUUID();
  const purchase={kind:"purchase",source:"voice",date:day,supplier:"QA",lines:[row(rice,20,"kg",{unitCost:25000})]};
  const receipt=await post(purchase,key);
  assert.equal(receipt.total,500000);
  assert.deepEqual(await post(purchase,key),receipt);
  assert.equal((await balance(rice)).quantity,20);
  const hash="a".repeat(64);
  const invoice={...purchase,source:"invoice",hash,number:"A",delivery:10000,total:60000,lines:[row(rice,2000,"g",{unitCost:25,lineTotal:50000})]};
  await assert.rejects(post(invoice),/оригинал/);
  await q("insert into storage.objects values('cafe-owner-invoices',$1)",[cafe+"/"+hash]);
  await post(invoice);
  await assert.rejects(post(invoice),/уже зарегистрирована/);
  assert.equal((await balance(rice)).quantity,22);
  const transfer={kind:"transfer",lines:[row(rice,5,"kg")]};
  const transferId=randomUUID();
  await Promise.all([post(transfer,transferId,12),post(transfer,transferId,12)]);
  assert.equal((await balance(rice)).quantity,17);
  assert.equal((await balance(rice)).kitchen,5);
  await assert.rejects(post({kind:"count",lines:[row(rice,17,"kg",{expected:22})]}),/изменился/);
  await post({kind:"count",full:true,lines:[row(rice,17,"kg",{expected:17}),row(rice,5,"kg",{expected:5,area:"kitchen"}),row(plov,0,"portion",{expected:0})]});
  assert.ok((await dashboard()).initialCount);
  const batch={kind:"production",lines:[row(plov,10,"portion")],inputs:[row(rice,1,"kg")]};
  assert.ok((await post(batch)).total>25000);
  await post(batch);
  assert.equal((await dashboard()).norms[0].quantity,0.1);
  const order=(await result("select create_cafe_staff_order(11,$1,$2::jsonb,'pickup','QA',null,null,'cash') result",
    [cafe,JSON.stringify([{productId:product,quantity:2}])])).order;
  for(const state of ["confirmed","preparing","ready"]) await result("select update_cafe_order_status($1,12,$2) result",[order.id,state]);
  await result("select update_cafe_order_payment_cash($1,11,'paid',null,240000,0) result",[order.id]);
  await result("select update_cafe_order_status($1,11,'completed') result",[order.id]);
  assert.equal((await balance(plov)).quantity,18);
  assert.equal((await balance(rice)).kitchen,3);
  assert.equal((await dashboard()).sales.portions,2);
  assert.equal((await dashboard()).sales.unpricedPortions,0);
  assert.ok((await dashboard()).sales.knownCost>5000);
  assert.ok((await dashboard()).sales.grossProfit>0);
  await post({kind:"reorder",itemId:rice,leadDays:1,shelfDays:5});
  assert.equal((await dashboard()).reorder[0].leadDays,1);
  await post({kind:"waste",area:"kitchen",note:"Порча",lines:[row(rice,0.5,"kg")]});
  assert.equal((await balance(rice)).kitchen,2.5);
  assert.equal((await post({kind:"production",lines:[row(plov,3,"portion")]})).total,null);
  for(let i=0;i<2;i++){
    const before=await balance(rice), ready=await balance(plov);
    await post({kind:"count",full:true,lines:[row(rice,before.quantity,"kg",{expected:before.quantity}),
      row(rice,before.kitchen,"kg",{expected:before.kitchen,area:"kitchen"}),row(plov,ready.quantity,"portion",{expected:ready.quantity})]});
    await post({kind:"production",lines:[row(plov,10,"portion")]});
    const counted=await balance(rice), after=await balance(plov);
    await post({kind:"count",full:true,lines:[row(rice,counted.quantity,"kg",{expected:counted.quantity}),
      row(rice,counted.kitchen-0.5,"kg",{expected:counted.kitchen,area:"kitchen"}),row(plov,after.quantity,"portion",{expected:after.quantity})]});
  }
  assert.equal((await dashboard()).norms[0].observations,4);
  await post({kind:"transfer",lines:[row(rice,1,"kg")]});
  await post({...batch,kind:"recipe"});
  await post({kind:"mode",mode:"C"});
  assert.equal((await post({kind:"production",lines:batch.lines})).usedRecipe,true);
  assert.equal((await balance(rice)).kitchen,1.5);
  await assert.rejects(post({kind:"production",lines:[row(plov,200,"portion")]}),/Недостаточно/);
  assert.equal((await balance(plov)).quantity,51);
  console.log("PASS: owner receipt, duplicate invoice, roles, transfer, count, completed sale, write-off, measured norms and approved recipe.");
}catch(error){
  console.error(error.message);
  if(error.where) console.error(error.where);
  if(error.internalQuery) console.error(error.internalQuery);
  process.exitCode=1;
}finally{await db.close();}
