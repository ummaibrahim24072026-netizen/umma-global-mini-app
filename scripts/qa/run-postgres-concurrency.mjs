import pg from 'pg';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
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
}finally {await Promise.all(clients.map(c=>c.end()));}
