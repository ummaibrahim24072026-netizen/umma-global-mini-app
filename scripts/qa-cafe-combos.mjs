import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';

export async function verifyCafeCombos(db,cafe,main) {
 const side='bfdd3f13-06f7-42b3-93e9-4ca44a8ff4cb';
 const run=(sql,args=[])=>db.query(sql,args);
 const one=async(sql,args=[])=>(await run(sql,args)).rows[0];
 await db.exec(readFileSync('supabase/migrations/20261127033208_cafe_menu_combos.sql','utf8'));
 await run("insert into products(id,name_ru,name_vi,name_en,product_type,price_vnd) values($1,'Салат','Rau','Salad','cafe',10000)",[side]);
 await run(`insert into inventory(location_id,product_id,quantity,reserved_quantity,ready_stock_confirmed,ready_stock_state,is_available)
  values($1,$2,2,0,true,'ready',true),($1,$3,2,0,true,'ready',true)
  on conflict(location_id,product_id) do update set quantity=2,reserved_quantity=0,
  ready_stock_confirmed=true,ready_stock_state='ready',is_available=true`,[cafe,main,side]);
 const payload={nameRu:'Тестовое комбо',nameEn:'Test combo',nameVi:'Combo thử',price:18000,persons:2,published:true,
  imageUrl:'https://example.com/combo.webp',components:[{productId:main,portions:0.5,weightG:150},{productId:side,portions:1,weightG:90}]};
 const save=async(id,data)=>(await one('select cafe_combo_save($1,$2,$3::jsonb) id',[cafe,id,JSON.stringify(data)])).id;
 const combo=await save(null,{...payload,published:false});
 const products=async()=>(await one('select cafe_ready_catalog($1) catalog',[cafe])).catalog.products;
 const offer=async()=>(await products()).find(p=>p.id===combo);
 assert.equal(await offer(),undefined);
 await save(combo,payload);
 assert.equal((await offer()).available,2);
 assert.equal((await offer()).weight_value,240);
 assert.equal((await offer()).persons,2);
 assert.equal((await offer()).separatePriceVnd,22500);
 assert.equal((await offer()).savingVnd,4500);
 const create=async lines=>(await one("select create_cafe_staff_order(11,$1,$2::jsonb,'pickup','QA',null,null,'cash') result",
  [cafe,JSON.stringify(lines.map(([productId,quantity])=>({productId,quantity})))] )).result.order;
 const status=(id,state)=>run('select update_cafe_order_status($1,12,$2)',[id,state]);
 const stock=async id=>{
  const row=await one('select quantity,reserved_quantity from inventory where location_id=$1 and product_id=$2',[cafe,id]);
  return [Number(row.quantity),Number(row.reserved_quantity)];
 };
 const order=await create([[combo,1],[main,1]]);
 assert.deepEqual(await stock(main),[2,1.5]);
 assert.deepEqual(await stock(side),[2,1]);
 assert.equal((await products()).find(p=>p.id===main).available,0);
 assert.equal((await offer()).available,1);
 assert.equal(Number((await one('select total_vnd from cafe_orders where id=$1',[order.id])).total_vnd),43000);
 await assert.rejects(create([[combo,2]]),/READY_STOCK_UNAVAILABLE/);
 assert.deepEqual(await stock(main),[2,1.5]);
 await assert.rejects(save(combo,{...payload,components:[{productId:combo,portions:1,weightG:20},payload.components[1]]}),/INVALID_COMBO_COMPONENTS/);
 await save(combo,{...payload,published:false,components:[{...payload.components[0],portions:1.5},payload.components[1]]});
 const item=await one('select combo_components from cafe_order_items where order_id=$1 and product_id=$2',[order.id,combo]);
 assert.equal(item.combo_components.find(line=>line.productId===main).portions,0.5);
 await assert.rejects(run('update cafe_order_items set combo_components=null where order_id=$1 and product_id=$2',[order.id,combo]),/cannot be edited/);
 await status(order.id,'cancelled');
 assert.deepEqual(await stock(main),[2,0]);
 assert.deepEqual(await stock(side),[2,0]);
 await save(combo,payload);
 const guestKey=randomUUID();
 const guest=()=>one("select submit_cafe_guest_order_v3($1,$2,$3,$4::jsonb,'QA web',null,'qa',null,'cash') result",
  [guestKey,'c'.repeat(64),cafe,JSON.stringify([{productId:combo,quantity:1}])]);
 const firstGuest=(await guest()).result.order;
 assert.equal((await guest()).result.order.id,firstGuest.id);
 assert.deepEqual(await stock(main),[2,0.5]);
 await run("update cafe_orders set stock_reserved_until=now()-interval '1 minute' where id=$1",[firstGuest.id]);
 await run('select cafe_ready_expire()');
 assert.deepEqual(await stock(main),[2,0]);
 assert.equal((await one('select status from cafe_orders where id=$1',[firstGuest.id])).status,'cancelled');
 const completed=await create([[combo,1]]);
 await run("select update_cafe_order_payment_cash($1,11,'paid',null,18000,0)",[completed.id]);
 await status(completed.id,'ready');
 await run("select update_cafe_order_status($1,11,'completed')",[completed.id]);
 await run("update cafe_orders set status='completed' where id=$1",[completed.id]);
 assert.deepEqual(await stock(main),[1.5,0]);
 assert.deepEqual(await stock(side),[1,0]);
 assert.equal(Number((await one("select count(*) n from cafe_inventory_movements where order_id=$1 and movement_type='sold'",[completed.id])).n),2);
 const adjust=(mode,quantity)=>run('select cafe_ready_adjust(12,$1,gen_random_uuid(),$2,$3::jsonb)',
  [cafe,mode,JSON.stringify([{productId:main,quantity}])]);
 await adjust('add',1);
 assert.deepEqual(await stock(main),[2.5,0]);
 await adjust('set',1.25);
 assert.deepEqual(await stock(main),[1.25,0]);
 if(db.concurrent)await db.concurrent(cafe,side,combo);
 await run('update inventory set is_available=false where location_id=$1 and product_id=$2',[cafe,side]);
 assert.equal((await offer()).available,0);
 await assert.rejects(create([[combo,1]]),/READY_STOCK_UNAVAILABLE/);
 const permissions=await one(`select has_function_privilege('anon','cafe_combo_save(uuid,uuid,jsonb)','execute') save,
  has_table_privilege('anon','cafe_combo_components','select') components`);
 assert.deepEqual(permissions,{save:false,components:false});
 console.log('PASS Cafe combos: draft/publish, live prices and fractional stock, mixed dish+combo, rollback, immutable kitchen snapshot, cancel, one-time sale and scope.');
 await db.exec(readFileSync('supabase/migrations/20261128080903_cafe_configurable_combos.sql','utf8'));
 await run('update inventory set is_available=true where location_id=$1 and product_id=$2',[cafe,side]);
 const option=(id,productId,portions,unit,amount,referenceVnd,surchargeVnd=0)=>({id,productId,portions,unit,amount,referenceVnd,surchargeVnd});
 const config={mode:'fixed',fixed:[option('main',main,0.25,'g',75,7000)],groups:[{id:'drink',kind:'drink',defaultId:'regular',
  options:[option('regular',side,0.25,'ml',300,10000),option('large',side,0.5,'ml',500,15000,4000)]}],
  extras:[option('extra',main,0.25,'pcs',1,7000,5000)]};
 const configured=await save(null,{...payload,price:14500,components:[],configuration:config});
 const configuration=(await products()).find(p=>p.id===configured).comboConfiguration;
 assert.equal(configuration.groups[0].options[1].amount,500);
 const choice={choices:{drink:'large'},extras:{extra:1}};
 const itemRequest={productId:configured,quantity:1,comboSelection:choice,expectedUnitPriceVnd:23500};
 const configuredCreate=async item=>(await one("select create_cafe_staff_order(11,$1,$2::jsonb,'pickup','QA',null,null,'cash') result",
  [cafe,JSON.stringify([item])])).result.order;
 await assert.rejects(configuredCreate({...itemRequest,expectedUnitPriceVnd:1}),/COMBO_PRICE_CHANGED/);
 await assert.rejects(configuredCreate({...itemRequest,comboSelection:{...choice,extras:{invented:1}}}),/INVALID_COMBO_SELECTION/);
 const configuredOrder=await configuredCreate(itemRequest);
 assert.equal(configuredOrder.totalVnd,23500);
 const snapshot=await one('select combo_components,combo_pricing from cafe_order_items where order_id=$1',[configuredOrder.id]);
 assert.equal(snapshot.combo_components[1].amount,500);
 assert.equal(snapshot.combo_pricing.savingVnd,3500);
 assert.deepEqual(await stock(main),[1.25,0.5]);
 assert.deepEqual(await stock(side),[1,0.5]);
 await status(configuredOrder.id,'cancelled');
 assert.deepEqual(await stock(main),[1.25,0]);
 assert.deepEqual(await stock(side),[1,0]);

 const snapshotBefore=await one('select combo_components,combo_pricing from cafe_order_items where order_id=$1',[configuredOrder.id]);
 await save(configured,{...payload,price:14000,components:[],configuration:{...config,mode:'percent',discount:10}});
 const alternative={choices:{drink:'regular'},extras:{}};
 const percentItem={...itemRequest,comboSelection:alternative,expectedUnitPriceVnd:15300};
 const larger={...itemRequest,comboSelection:{choices:{drink:'large'},extras:{}},expectedUnitPriceVnd:20200};
 const checkoutKey=randomUUID();
 const guestConfiguration=async()=> (await one("select submit_cafe_guest_order_v3($1,$2,$3,$4::jsonb,'QA web',null,'qa',null,'cash') result",
  [checkoutKey,'a'.repeat(64),cafe,JSON.stringify([percentItem,larger])])).result.order;
 const guestWithVariants=await guestConfiguration();
 assert.equal(guestWithVariants.totalVnd,35500);
 assert.equal((await guestConfiguration()).id,guestWithVariants.id);
 assert.deepEqual(await stock(main),[1.25,0.5]);
 assert.deepEqual(await stock(side),[1,0.75]);
 await run("select update_cafe_order_payment_cash($1,11,'paid',null,35500,0)",[guestWithVariants.id]);
 await status(guestWithVariants.id,'ready');
 await run("select update_cafe_order_status($1,11,'completed')",[guestWithVariants.id]);
 assert.deepEqual(await stock(main),[0.75,0]);
 assert.deepEqual(await stock(side),[0.25,0]);
 const report=(await one('select cafe_combo_analytics($1,30) report',[cafe])).report;
 const configuredSales=report.combos.find(row=>row.product_id===configured);
 assert.equal(configuredSales.units,2);
 assert.equal(configuredSales.revenue,35500);
 assert.equal(configuredSales.savings,3500);
 assert.equal(configuredSales.cost,null);
 assert.deepEqual(await one('select combo_components,combo_pricing from cafe_order_items where order_id=$1',[configuredOrder.id]),snapshotBefore);
 assert.equal((await one("select has_function_privilege('anon','cafe_combo_analytics(uuid,integer)','execute') allowed")).allowed,false);

 const deliveryKey=randomUUID();
 const delivery=await one(`select submit_cafe_guest_delivery_v4($1,$2,$3,$4::jsonb,'QA',null,'combo-qa',null,'qr',
  'QA delivery address',12.28,109.2,repeat('d',64)) result`,
  [deliveryKey,'d'.repeat(64),cafe,JSON.stringify([percentItem])]);
 assert.equal(delivery.result.order.orderType,'delivery');
 assert.equal(delivery.result.order.totalVnd,45300);
 assert.equal(Number((await one('select subtotal_vnd from cafe_orders where id=$1',[delivery.result.order.id])).subtotal_vnd),15300);
 assert.deepEqual(await stock(main),[0.75,0.25]);
 assert.deepEqual(await stock(side),[0.25,0.25]);
 await status(delivery.result.order.id,'cancelled');
 assert.deepEqual(await stock(main),[0.75,0]);
 assert.deepEqual(await stock(side),[0.25,0]);
 if(db.concurrent)await db.concurrent(cafe,side,{...larger,quantity:2});
 console.log('PASS configurable combos: alternative volumes, extras, authoritative price, immutable line data and shared fractional stock.');

}
