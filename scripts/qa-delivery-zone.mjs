import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {createHmac} from 'node:crypto';
const sql=readFileSync('supabase/proposals/cafe-delivery-zone.sql','utf8');
const zone=JSON.parse(sql.match(/SET delivery_zone='([^']+)'/)[1]);
const scope={window:{}};vm.runInNewContext(readFileSync('js/maps/delivery-zone.js','utf8'),scope);
const inside=scope.window.ummaDeliveryZone.contains;
const db=new PGlite();
try {
 await db.exec(readFileSync('tests/fixtures/supabase-public-schema.sql','utf8'));
 await db.exec('create role anon;create role authenticated;create role service_role;');
 await db.exec(sql);
 const cafe='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
 await db.query("insert into locations(id,name,location_type,delivery_zone) values($1,'City cafe','cafe',$3),($2,'Future branch','cafe',null)",[cafe,other,JSON.stringify(zone)]);
 const probes=[[[12.2814294,109.2020884],true],[[12.24,109.19],true],[[12.29,109.20],true],[[12.32,109.195],true],[[12.05,109.20],false],[[11.99,109.22],false],[[10.22,103.96],false],[[21.03,105.85],false],[[12.19,109.24],false],[[12.4,109.2],false],[[12.24,109.1],false]];
 for(const [p,expected] of probes){assert.equal(inside(zone,p),expected,JSON.stringify(p));assert.equal((await db.query('select cafe_delivery_zone_contains($1,$2,$3) v',[JSON.stringify(zone),...p])).rows[0].v,expected);}
 // Check JS/database parity over a deterministic grid, including edges and vertices.
 for(let lat=12.15;lat<=12.34;lat+=.01)for(let lng=109.13;lng<=109.24;lng+=.01){const p=[lat,lng];assert.equal((await db.query('select cafe_delivery_zone_contains($1,$2,$3) v',[JSON.stringify(zone),...p])).rows[0].v,inside(zone,p));}
 for(const z of [[],[[0,0],[1,1],[0,1],[1,0]],[[0,0],[1,1],[2,2]],[[0,0],[0,0],[1,1]],[[0,0],[91,0],[0,1]],'oops'])assert.equal((await db.query('select cafe_valid_delivery_zone($1) v',[JSON.stringify(z)])).rows[0].v,false);
 const order=(address,branch=cafe,type='delivery')=>db.query('insert into cafe_orders(location_id,order_type,delivery_address) values($1,$2,$3) returning id',[branch,type,address]);
 for(const address of ['Full address in Nha Trang','Точка доставки: NaN,109.2','Точка доставки: 12.24,109.19\nOther text','Точка доставки: 12.24,109.19\nТочка доставки: 12.24,109.19'])await assert.rejects(order(address),/DELIVERY_POINT_REQUIRED/);
 await assert.rejects(order('Точка доставки: 11.99,109.22'),/DELIVERY_OUTSIDE_ZONE/);
 await assert.rejects(order('Точка доставки: 12.24,109.19',other),/DELIVERY_UNAVAILABLE/);
 const accepted=(await order('Apartment 7\nТочка доставки: 12.24,109.19')).rows[0];
 await assert.rejects(db.query("update cafe_orders set delivery_address='Точка доставки: 21.03,105.85' where id=$1",[accepted.id]),/DELIVERY_OUTSIDE_ZONE/);
 await db.query("update cafe_orders set payment_status='paid' where id=$1",[accepted.id]);
 await order('Elsewhere',other,'pickup');await order(null,other,'dine_in');
 await db.query("insert into telegram_users(telegram_id,role) values(10,'super_admin'),(11,'user')");
 await assert.rejects(db.query('select admin_set_cafe_delivery_zone(11,$1,$2)',[other,JSON.stringify(zone)]),/access denied/);
 await db.query('select admin_set_cafe_delivery_zone(10,$1,$2)',[other,JSON.stringify(zone)]);await order('Точка доставки: 12.24,109.19',other);
 await db.query('select admin_set_cafe_delivery_zone(10,$1,null)',[other]);await assert.rejects(order('Точка доставки: 12.24,109.19',other),/DELIVERY_UNAVAILABLE/);
 for(const role of ['anon','authenticated'])assert.equal((await db.query("select has_function_privilege($1,'admin_set_cafe_delivery_zone(bigint,uuid,jsonb)','execute') v",[role])).rows[0].v,false);
 assert.equal(Number((await db.query('select count(*) n from cafe_orders')).rows[0].n),4,'all rejected inserts rolled back');
 // Real Edge handler returns readable client errors for both order sources.
 const token='isolated-delivery-zone-test',params=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:10})});
 const check=[...params].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');
 params.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(token).digest()).update(check).digest('hex'));
 let serve,code;
 vm.runInNewContext(stripTypeScriptTypes(readFileSync('supabase/functions/create-cafe-order/index.ts','utf8')).replace(/^import .*;\n/gm,''),{
  Deno:{serve:fn=>serve=fn,env:{get:k=>({TELEGRAM_BOT_TOKEN:token,SUPABASE_URL:'https://isolated.invalid',SUPABASE_SERVICE_ROLE_KEY:'fake'})[k]}},
  createClient:()=>({}),submitCafeOperation:async()=>({data:null,error:{message:code}}),dispatchCourierQueue:()=>assert.fail('rejected delivery must not dispatch'),crypto,Response,Request,URLSearchParams,TextEncoder,console
 });
 for(code of ['DELIVERY_UNAVAILABLE','DELIVERY_POINT_REQUIRED','DELIVERY_OUTSIDE_ZONE'])for(const staffOrder of [false,true]){
  const result=await serve(new Request('https://isolated.invalid',{method:'POST',body:JSON.stringify({initData:params.toString(),requestKey:other,locationId:cafe,items:[{productId:other,quantity:1}],orderType:'delivery',staffOrder})}));
  assert.equal(result.status,400);const body=await result.json();assert.equal(body.ok,false);assert.equal(body.code,code);assert.ok(body.error.length>20);
 }
 console.log('PASS delivery zones: JS/SQL polygon parity, urban Nha Trang, other cities/islands, boundaries, invalid geometry, missing/forged coordinates, direct SQL inserts/updates, unaffected pickup/payment, future branch configuration and role permissions');
}finally{await db.close();}
