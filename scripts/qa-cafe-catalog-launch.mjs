import {PGlite} from '@electric-sql/pglite';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite();let dom;
try{
 await db.exec(`create table categories(id uuid primary key default gen_random_uuid(),category_type text,name_ru text,is_active boolean);
 create table products(id uuid primary key default gen_random_uuid(),category_id uuid,sku text unique,name_ru text,name_en text,name_vi text,description_ru text,description_en text,description_vi text,price_vnd int,product_type text,catalog_preview boolean default false,image_url text,sort_order int default 0,is_active boolean default true,updated_at timestamptz default now());
 create table inventory(product_id uuid,price_vnd int,quantity numeric,reserved_quantity numeric,updated_at timestamptz default now());
 insert into categories(category_type,name_ru,is_active) values('cafe','Выпечка',true);
 insert into products(sku,name_ru,name_en,name_vi,price_vnd,product_type,catalog_preview) values
 ('UMMA-CAFE-SHURPA','Шурпа','Shurpa','Shurpa',90000,'cafe',false),('UMMA-CAFE-BORSCHT','Борщ','Borscht','Borscht',90000,'cafe',false),('UMMA-CAFE-PLOV','Плов','Plov','Plov',120000,'cafe',false),
 ('UMMA-CAFE-BAKLAVA-ALMOND','Пахлава с миндалем','Baklava','Baklava',null,'cafe',true),('UMMA-CAFE-BAKLAVA-WALNUT','Пахлава с грецким орехом','Baklava','Baklava',null,'cafe',true),('UNRELATED','Market item','Market item','Market item',12345,'market',false);
 insert into inventory select id,30000,7,2,now() from products where sku='UMMA-CAFE-BAKLAVA-ALMOND';`);
 const sql=readFileSync('supabase/catalog/cafe-menu-launch-20261020.sql','utf8');
 await db.exec(sql);
 const first=(await db.query("select id from products where sku like 'UMMA-CAFE-DESSERT-%' order by sku")).rows;
 await db.exec(sql);
 assert.deepEqual((await db.query("select id from products where sku like 'UMMA-CAFE-DESSERT-%' order by sku")).rows,first,'rerun preserves identities and does not duplicate desserts');
 const rows=(await db.query("select * from products where product_type='cafe' order by sort_order")).rows;
 const desserts=rows.filter(p=>p.sku.startsWith('UMMA-CAFE-DESSERT-'));
 assert.equal(desserts.length,5);
 for(const p of desserts){assert.equal(p.price_vnd,40000);assert.equal(p.catalog_preview,false);assert.ok(p.description_ru&&p.description_en&&p.description_vi);assert.match(p.image_url,/dessert-[1-5]-white.webp$/);}
 for(const p of rows.filter(p=>p.sku.includes('BAKLAVA'))){assert.equal(p.price_vnd,25000);assert.equal(p.catalog_preview,false);assert.match(p.description_ru,/1 штуку/);}
 assert.deepEqual((await db.query('select price_vnd,quantity,reserved_quantity from inventory')).rows,[{price_vnd:25000,quantity:'7',reserved_quantity:'2'}]);
 assert.equal((await db.query("select price_vnd from products where sku='UNRELATED'")).rows[0].price_vnd,12345);
 assert.equal(rows.find(p=>p.sku==='UMMA-CAFE-SHURPA').name_ru,'Шурпа с бараниной');assert.equal(rows.find(p=>p.sku==='UMMA-CAFE-BORSCHT').name_ru,'Борщ с говядиной');
 const html=readFileSync('index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
 dom=new JSDOM(html,{url:'https://umma.example/',runScripts:'outside-only'});const w=dom.window,d=w.document;
 w.Telegram={WebApp:{initData:'isolated',initDataUnsafe:{user:{id:1,first_name:'QA'}}}};
 w.fetch=async()=>({ok:true,json:async()=>({ok:true,products:rows,locations:[{id:'cafe',name:'Cafe'}],inventoryControlEnabled:false})});
 const orders=[];w.ummaCafeRequests={request:async(url,payload)=>{orders.push(payload);return {ok:true,json:async()=>({ok:true,order:{id:'qa',orderNumber:1,totalVnd:65000},staffNotified:1})};}};
 w.eval(readFileSync('js/cafe/cafe.js','utf8'));await w.ummaCafe.refreshMenu();d.getElementById('cafePage').hidden=false;
 assert.equal(d.querySelectorAll('[data-dessert-preview]').length,0,'real priced desserts replace previews without duplicate photographs');
 const cake=desserts[0],baklava=rows.find(p=>p.sku==='UMMA-CAFE-BAKLAVA-ALMOND');
 for(const p of [cake,baklava]){const card=d.querySelector('[data-product-card="'+p.id+'"]');assert.ok(card.querySelector('.cafe-product-description'));assert.equal(card.querySelector('.cafe-product-description').open,false);card.querySelector('[data-add-product]').click();}
 assert.match(d.getElementById('cafeStickyTotal').textContent,/65/);
 d.getElementById('cafeStickyGoToOrder').click();d.getElementById('cafeStickyGoToOrder').click();await new Promise(r=>setImmediate(r));
 assert.equal(orders.length,1);assert.deepEqual(Array.from(orders[0].items,x=>x.productId).sort(),[cake.id,baklava.id].sort());
 assert.equal(d.getElementById('cafeNearbyDetails').open,false,'cafe controls stay collapsed after selection');
 console.log('PASS catalog launch: idempotent five-dessert registration, confirmed VND prices, meat titles, bilingual descriptions, piece pricing, stock/history isolation, real-product menu deduplication and order payload');
}finally{dom?.window.close();await db.close();}
