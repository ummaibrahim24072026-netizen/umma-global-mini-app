import assert from 'node:assert/strict';
export const schema='umma_qa_20261013';
export const cases=['same_request','same_table','same_addon','same_payment','add_then_pay','pay_then_add','same_accept'];
export const plan=cases.map(name=>({
 name,
 a:`SELECT ${schema}.qa_worker('${name}','A',3);`,
 probe:`SELECT ${schema}.qa_worker_a_running('${name}') AS running;`,
 b:`SELECT ${schema}.qa_worker('${name}','B',0);`,
}));
export const snapshotQuery=`SELECT jsonb_build_object(
 'runs',(SELECT jsonb_agg(r ORDER BY id) FROM ${schema}.qa_runs r),
 'orders',(SELECT jsonb_agg(jsonb_build_object('id',id,'customer_name',customer_name,'status',status,'payment_status',payment_status,'total_vnd',total_vnd,'paid_by_telegram_id',paid_by_telegram_id)) FROM ${schema}.cafe_orders),
 'receipts',(SELECT jsonb_agg(jsonb_build_object('order_id',order_id,'collector',collected_by_telegram_id,'amount',amount_vnd,'status',receipt_status)) FROM ${schema}.cafe_payment_receipts)
) AS snapshot;`;
export function verify(snapshot){
 for(const name of cases){
  const a=snapshot.runs.find(r=>r.case_name===name&&r.worker==='A');
  const b=snapshot.runs.find(r=>r.case_name===name&&r.worker==='B');
  assert.ok(a&&b,name+': missing workers');
  assert.notEqual(a.backend_pid,b.backend_pid,name+': workers must use different PostgreSQL sessions');
  assert.ok(new Date(b.started_at)<new Date(a.finished_at),name+': must overlap in time');
  assert.equal(a.ok,true,name+': first worker');
  assert.equal(b.ok,['same_request','same_addon','same_payment'].includes(name),name+': second worker');
 }
 const byName=name=>snapshot.orders.filter(o=>o.customer_name===name);
 assert.equal(byName('QA replay').length,1);
 const replay=snapshot.runs.filter(r=>r.case_name==='same_request');
 assert.equal(replay[0].result.order.id,replay[1].result.order.id);
 assert.equal(byName('Стол №1').length,1);
 assert.equal(byName('QA same_addon')[0].total_vnd,240000);
 for(const name of ['same_payment','pay_then_add']){
  const order=byName('QA '+name)[0];assert.equal(order.payment_status,'paid');
  const receipts=snapshot.receipts.filter(r=>r.order_id===order.id);
  assert.equal(receipts.length,1);assert.equal(Number(receipts[0].collector),13);
 }
 const addFirst=byName('QA add_then_pay')[0];assert.equal(addFirst.total_vnd,240000);assert.equal(addFirst.payment_status,'pending');
 assert.equal(byName('QA pay_then_add')[0].total_vnd,120000);
 assert.equal(byName('QA same_accept')[0].status,'confirmed');
 return {passed:cases.length,independentSessions:true,overlapVerified:true};
}
if(process.argv.includes('--plan'))console.log(JSON.stringify({plan,snapshotQuery}));
