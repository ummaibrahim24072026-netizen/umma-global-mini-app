import pg from 'pg';import assert from 'node:assert/strict';
export async function readyNativeDb(){
 const config={host:process.env.PGHOST||'127.0.0.1',port:Number(process.env.PGPORT||5432),database:process.env.PGDATABASE||'umma_qa',user:process.env.PGUSER||'postgres',password:process.env.PGPASSWORD};assert.ok(['127.0.0.1','localhost'].includes(config.host));assert.equal(config.database,'umma_qa');
 const schema='umma_ready_native',priv='umma_ready_native_private';const connections=await Promise.all([0,1,2].map(async()=>{const c=new pg.Client(config);await c.connect();return c;}));const [main,a,b]=connections;
 await main.query(`create schema ${schema};create schema ${priv};`);
 const rewrite=sql=>sql.replace(/create role (anon|authenticated|service_role);/gi,'').replace(/create schema if not exists auth;/gi,'').replace(/create schema cron;/gi,'').replace(/create schema net;/gi,'').replace(/\bpublic\b/g,schema).replace(/\bumma_private\b/g,priv).replace(/\bauth\./g,schema+'.').replace(/\bcron\./g,schema+'.').replace(/\bnet\./g,schema+'.');
 for(const c of connections)await c.query(`set search_path=${schema},pg_catalog`);
 return{query:(s,args=[])=>main.query(rewrite(s),args),exec:s=>main.query(rewrite(s)),async concurrent(cafe,product){
  const sql=`select ${schema}.create_cafe_staff_order(11,$1,$2::jsonb,'pickup','QA concurrency',null,null,'cash') result`,items=JSON.stringify([{productId:product,quantity:1}]);
  await main.query(`select ${schema}.cafe_ready_adjust(12,$1,gen_random_uuid(),'set',$2::jsonb)`,[cafe,JSON.stringify([{productId:product,quantity:1}])]);
  await a.query('begin');await b.query('begin');const first=(await a.query(sql,[cafe,items])).rows[0].result.order;
  let settled=false;const second=b.query(sql,[cafe,items]).then(r=>({r}),e=>({e})).finally(()=>settled=true);
  // The second statement holds its connection while waiting; use the observer connection.
  await new Promise(r=>setTimeout(r,100));assert.equal(settled,false,'last portion must be locked until the first order commits');
  await a.query('commit');const outcome=await second;assert.ok(outcome.e,'only one buyer can receive the last portion');assert.match(outcome.e.message,/READY_STOCK_UNAVAILABLE/);await b.query('rollback');
  const row=(await main.query(`select quantity,reserved_quantity from ${schema}.inventory where product_id=$1 and location_id=$2`,[product,cafe])).rows[0];assert.equal(Number(row.reserved_quantity),1);assert.equal(Number(row.quantity),1);
  await main.query(`select ${schema}.update_cafe_order_status($1,12,'cancelled')`,[first.id]);
  console.log('PASS native PostgreSQL: independent sessions contend for the last portion; first commits, second is rejected, one reservation, cancellation releases it.');
 },async preorderConcurrent(cafe,product){
  const plan=(action,qty,revision=null)=>main.query(`select ${schema}.cafe_ready_plan(12,$1,gen_random_uuid(),$2,$3::jsonb)`,[cafe,action,JSON.stringify([{productId:product,quantity:qty,revision,...(action==='plan'?{readyAt:new Date(Date.now()+3600000).toISOString()}:{})}])]);
  await plan('plan',1);const revision=(await main.query(`select plan_revision from ${schema}.inventory where product_id=$1 and location_id=$2`,[product,cafe])).rows[0].plan_revision;
  const sql=`select ${schema}.submit_cafe_guest_order_v3(gen_random_uuid(),$1,$2,$3::jsonb,'QA concurrency',null,'qa',null,'qr') result`,items=JSON.stringify([{productId:product,quantity:1,planRevision:revision}]);
  await a.query('begin');await b.query('begin');const first=(await a.query(sql,['a'.repeat(64),cafe,items])).rows[0].result.order;let settled=false;const second=b.query(sql,['b'.repeat(64),cafe,items]).then(r=>({r}),e=>({e})).finally(()=>settled=true);
  await new Promise(r=>setTimeout(r,100));assert.equal(settled,false);await a.query('commit');const outcome=await second;assert.match(outcome.e?.message||'',/READY_STOCK_UNAVAILABLE/);await b.query('rollback');
  await a.query('begin');await b.query('begin');await a.query(`select ${schema}.cafe_ready_plan(12,$1,gen_random_uuid(),'finish',$2::jsonb)`,[cafe,JSON.stringify([{productId:product,quantity:1,revision}])]);
  settled=false;const cancel=b.query(`update ${schema}.cafe_orders set status='cancelled' where id=$1`,[first.id]).finally(()=>settled=true);await new Promise(r=>setTimeout(r,100));assert.equal(settled,false);await a.query('commit');await cancel;await b.query('commit');
  const row=(await main.query(`select planned_reserved_quantity,reserved_quantity from ${schema}.inventory where product_id=$1 and location_id=$2`,[product,cafe])).rows[0];assert.equal(Number(row.planned_reserved_quantity),0);assert.equal(Number(row.reserved_quantity),0);
  console.log('PASS native PostgreSQL preorder races: last future portion cannot oversell; simultaneous batch receipt/cancellation serializes and releases exactly once.');
 },async close(){await a.query('rollback');await b.query('rollback');await main.query(`drop schema ${schema} cascade;drop schema ${priv} cascade;`);await Promise.all(connections.map(c=>c.end()));}};
}
