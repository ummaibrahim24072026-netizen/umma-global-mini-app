import pg from 'pg';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {verifyCafeCouriers} from '../qa-cafe-couriers.mjs';
import {verifyCafeDelivery} from '../qa-cafe-delivery.mjs';
import {verifyCafeEdges} from '../qa-cafe-edge.mjs';
import {verifyCafeRefunds} from '../qa-cafe-refunds.mjs';
import {plan,snapshotQuery,verify} from './multi-session-cases.mjs';
const config={host:process.env.PGHOST||'127.0.0.1',port:Number(process.env.PGPORT||5432),database:process.env.PGDATABASE||'umma_qa',user:process.env.PGUSER||'postgres',password:process.env.PGPASSWORD};
assert.ok(['127.0.0.1','localhost'].includes(config.host),'Only isolated local PostgreSQL is allowed');
assert.equal(config.database,'umma_qa','Never run against application database');
const clients=await Promise.all([0,1,2].map(async()=>{const c=new pg.Client(config);await c.connect();return c;}));
const [a,b,observer]=clients;
try {
 await observer.query('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
 await observer.query(readFileSync('supabase/proposals/qa-isolated-setup.sql','utf8'));
 for(const test of plan){
  const first=a.query(test.a);
  let locked=false;
  for(let n=0;n<40;n++){if((await observer.query(test.probe)).rows[0].running){locked=true;break;}await new Promise(resolve=>setTimeout(resolve,50));}
  assert.ok(locked,test.name+': first transaction must be running before second');
  const second=b.query(test.b);
  await Promise.all([first,second]);
 }
 const snapshot=(await observer.query(snapshotQuery)).rows[0].snapshot;
 const result=verify(snapshot);
 mkdirSync('artifacts',{recursive:true});
 writeFileSync('artifacts/postgres-concurrency.json',JSON.stringify({result,snapshot},null,2));
 console.log('PASS native PostgreSQL concurrency',JSON.stringify(result));
 await observer.query('SET search_path=umma_qa_20261013,pg_catalog');
 await verifyCafeDelivery({query:(...args)=>observer.query(...args),exec:s=>observer.query(s)},'11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333');
 await verifyCafeRefunds({query:(...args)=>observer.query(...args)},'11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333');
 await verifyCafeCouriers({query:(...args)=>observer.query(...args)},'11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333');
 await verifyCafeEdges({query:(...args)=>observer.query(...args)},'11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333');
 // Two independent sessions attempt the same refund while the first holds its row lock.
 const location='11111111-1111-4111-8111-111111111111';
 const order=(await observer.query("select umma_qa_20261013.create_cafe_staff_order(11,$1,'[{\"productId\":\"33333333-3333-4333-8333-333333333333\",\"quantity\":1}]','pickup','QA concurrent refund') result",[location])).rows[0].result.order;
 await observer.query("select umma_qa_20261013.update_cafe_order_payment_cash($1,13,'paid',null,150000,30000)",[order.id]);
 await observer.query('select umma_qa_20261013.open_cafe_staff_shift($1,16,16,120000)',[location]);
 await a.query('BEGIN');await a.query("select umma_qa_20261013.refund_cafe_order($1,16,'88888888-8888-4888-8888-888888888888','QA concurrent refund',true)",[order.id]);
 const secondRefund=b.query("select umma_qa_20261013.refund_cafe_order($1,16,'88888888-8888-4888-8888-888888888888','QA concurrent refund',true) result",[order.id]);
 const pause=a.query('select pg_sleep(1)');
 let waiting=false;
 for(let n=0;n<15;n++){if(Number((await observer.query("select count(*) n from pg_stat_activity where datname='umma_qa' and wait_event_type='Lock' and query like '%refund_cafe_order%'")).rows[0].n)>0){waiting=true;break;}await new Promise(resolve=>setTimeout(resolve,50));}
 assert.ok(waiting,'Second refund must wait on the first transaction lock');
 await pause;await a.query('COMMIT');assert.equal((await secondRefund).rows[0].result.replayed,true);
 assert.equal(Number((await observer.query('select count(*) n from umma_qa_20261013.cafe_order_refunds where order_id=$1',[order.id])).rows[0].n),1);
 console.log('PASS native concurrent refund: lock wait verified, one payout record');
 const courierOrder=(await observer.query("select umma_qa_20261013.create_cafe_staff_order(11,$1,'[{\"productId\":\"33333333-3333-4333-8333-333333333333\",\"quantity\":1}]','delivery','QA concurrent claim',null,'QA address') result",[location])).rows[0].result.order;
 await observer.query('select umma_qa_20261013.ensure_cafe_courier_offers($1)',[courierOrder.id]);
 await a.query('BEGIN');await a.query('select umma_qa_20261013.respond_cafe_courier_offer($1,20,true)',[courierOrder.id]);
 const competitor=b.query('select umma_qa_20261013.respond_cafe_courier_offer($1,21,true)',[courierOrder.id]);
 let competingWait=false;const hold=a.query('select pg_sleep(1)');
 for(let n=0;n<15;n++){if(Number((await observer.query("select count(*) n from pg_stat_activity where datname='umma_qa' and wait_event_type='Lock' and query like '%respond_cafe_courier_offer%'")).rows[0].n)>0){competingWait=true;break;}await new Promise(resolve=>setTimeout(resolve,50));}
 assert.ok(competingWait,'Second claimant must wait for the first order lock');await hold;await a.query('COMMIT');await assert.rejects(competitor,/no longer available/);
 assert.equal(Number((await observer.query("select count(*) n from umma_qa_20261013.cafe_courier_offers where order_id=$1 and status='accepted'",[courierOrder.id])).rows[0].n),1);
 console.log('PASS native concurrent courier acceptance: observed lock wait and exactly one winner');


}finally {await Promise.all(clients.map(c=>c.end()));}
