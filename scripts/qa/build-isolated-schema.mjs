import {readFileSync,writeFileSync} from 'node:fs';
const schema='umma_qa_20261013',privateSchema=schema+'_private';
const source=readFileSync('tests/fixtures/supabase-public-schema.sql','utf8');
const proposals=['cafe-lifecycle-hardening.sql','cafe-courier-workflow.sql','cafe-order-idempotency.sql','cafe-cash-summary.sql','cafe-delivery-hardening.sql','cafe-refunds.sql'];
const isolate=s=>s.replace(/public\./g,schema+'.').replace(/\bumma_private\b/g,privateSchema).replace(/'public'/g,"'"+schema+"'").replace(/^BEGIN;\s*$/gm,'').replace(/^COMMIT;\s*$/gm,'');
let sql=`-- Isolated QA objects only. Requires explicit owner approval before execution.
-- No production records, credentials or application objects are changed.
BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname IN ('${schema}','${privateSchema}')) THEN
  RAISE EXCEPTION 'QA schema already exists; inspect it instead of overwriting';
 END IF;
END $$;
CREATE SCHEMA ${schema};
SET LOCAL search_path=${schema},pg_catalog;
`+isolate(source)+'\n'+proposals.map(p=>isolate(readFileSync('supabase/proposals/'+p,'utf8'))).join('\n');
sql+=`
INSERT INTO ${schema}.telegram_users(telegram_id,role) VALUES
 (10,'super_admin'),(11,'employee'),(12,'employee'),(13,'employee'),(14,'employee'),(15,'user'),(16,'employee'),(17,'employee'),(18,'employee');
INSERT INTO ${schema}.locations(id,name,location_type) VALUES
 ('11111111-1111-4111-8111-111111111111','Synthetic QA cafe','cafe'),
 ('22222222-2222-4222-8222-222222222222','Other synthetic QA cafe','cafe');
INSERT INTO ${schema}.products(id,name_ru,name_vi,name_en,product_type,price_vnd) VALUES
 ('33333333-3333-4333-8333-333333333333','QA dish','QA dish','QA dish','cafe',120000);
INSERT INTO ${schema}.cafe_staff(telegram_id,location_id,staff_role,can_accept_payments)
 VALUES (11,'11111111-1111-4111-8111-111111111111','waiter',false),
 (12,'11111111-1111-4111-8111-111111111111','kitchen',false),
 (13,'11111111-1111-4111-8111-111111111111','cashier',true),
 (14,'11111111-1111-4111-8111-111111111111','cashier',true),
 (16,'11111111-1111-4111-8111-111111111111','manager',true),
 (18,'11111111-1111-4111-8111-111111111111','waiter',false),
 (17,'22222222-2222-4222-8222-222222222222','waiter',false);
INSERT INTO ${schema}.umma_runtime_settings(id,inventory_control_enabled) VALUES(true,false);
CREATE TABLE ${schema}.qa_runs(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 case_name text NOT NULL,worker text NOT NULL,backend_pid integer NOT NULL,
 started_at timestamptz NOT NULL,finished_at timestamptz NOT NULL,
 ok boolean NOT NULL,result jsonb,error_message text,error_code text
);
CREATE OR REPLACE FUNCTION ${schema}.qa_worker(p_case text,p_worker text,p_hold_seconds integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=${schema},pg_catalog AS $$
DECLARE
 v_started timestamptz:=clock_timestamp();v_pid integer:=pg_backend_pid();
 v_result jsonb;v_error text;v_code text;v_ok boolean:=true;
 v_cafe uuid:='11111111-1111-4111-8111-111111111111';
 v_product uuid:='33333333-3333-4333-8333-333333333333';
 v_items jsonb:=jsonb_build_array(jsonb_build_object('productId',v_product,'quantity',1));
 v_actor bigint:=CASE WHEN p_worker='A' THEN 11 ELSE 18 END;
 v_order uuid;
BEGIN
 IF p_worker='A' THEN PERFORM pg_advisory_xact_lock(hashtextextended('umma_qa:'||p_case||':A',0)); END IF;
 IF p_worker NOT IN ('A','B') OR p_hold_seconds NOT BETWEEN 0 AND 3 THEN RAISE EXCEPTION 'Invalid QA worker'; END IF;
 IF p_worker='B' THEN PERFORM pg_sleep(1); END IF;
 BEGIN
  IF p_case='same_request' THEN
   v_result:=${schema}.execute_cafe_order_operation(11,'44444444-4444-4444-8444-444444444445','staffOrder',
    jsonb_build_object('p_location_id',v_cafe,'p_items',v_items,'p_order_type','pickup','p_customer_name','QA replay','p_payment_method','cash'));
  ELSIF p_case='same_table' THEN
   v_result:=${schema}.execute_cafe_order_operation(v_actor,
    CASE WHEN p_worker='A' THEN '55555555-5555-4555-8555-555555555556'::uuid ELSE '66666666-6666-4666-8666-666666666667'::uuid END,
    'staffOrder',jsonb_build_object('p_location_id',v_cafe,'p_items',v_items,'p_order_type','dine_in','p_customer_name','Стол №1','p_payment_method','cash'));
  ELSE
   SELECT id INTO STRICT v_order FROM ${schema}.cafe_orders WHERE customer_name='QA '||p_case;
   IF p_case='same_addon' THEN
    v_result:=${schema}.execute_cafe_order_operation(11,'77777777-7777-4777-8777-777777777777','addItems',jsonb_build_object('p_order_id',v_order,'p_items',v_items));
   ELSIF p_case='same_payment' THEN
    v_result:=${schema}.update_cafe_order_payment_cash(v_order,CASE WHEN p_worker='A' THEN 13 ELSE 14 END,'paid',NULL,150000,30000);
   ELSIF p_case='add_then_pay' THEN
    IF p_worker='A' THEN v_result:=${schema}.add_cafe_staff_order_items(11,v_order,v_items);
    ELSE v_result:=${schema}.update_cafe_order_payment_cash(v_order,13,'paid',NULL,150000,30000);END IF;
   ELSIF p_case='pay_then_add' THEN
    IF p_worker='A' THEN v_result:=${schema}.update_cafe_order_payment_cash(v_order,13,'paid',NULL,150000,30000);
    ELSE v_result:=${schema}.add_cafe_staff_order_items(11,v_order,v_items);END IF;
   ELSIF p_case='same_accept' THEN
    v_result:=${schema}.update_cafe_order_status(v_order,v_actor,'confirmed');
   ELSE RAISE EXCEPTION 'Unknown QA case';END IF;
  END IF;
  PERFORM pg_sleep(p_hold_seconds);
 EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_error=MESSAGE_TEXT,v_code=RETURNED_SQLSTATE;v_ok:=false;
 END;
 INSERT INTO ${schema}.qa_runs(case_name,worker,backend_pid,started_at,finished_at,ok,result,error_message,error_code)
 VALUES(p_case,p_worker,v_pid,v_started,clock_timestamp(),v_ok,v_result,v_error,v_code);
 RETURN jsonb_build_object('ok',v_ok,'result',v_result,'error',v_error,'code',v_code,'pid',v_pid);
END $$;
DO $$ DECLARE v_case text;BEGIN
 FOREACH v_case IN ARRAY ARRAY['same_addon','same_payment','add_then_pay','pay_then_add','same_accept'] LOOP
  PERFORM ${schema}.create_cafe_staff_order(11,'11111111-1111-4111-8111-111111111111',
   '[{"productId":"33333333-3333-4333-8333-333333333333","quantity":1}]','dine_in','QA '||v_case);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION ${schema}.qa_worker_a_running(p_case text)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=${schema},pg_catalog AS $$
 SELECT NOT pg_try_advisory_xact_lock(hashtextextended('umma_qa:'||p_case||':A',0));
$$;
-- New schemas are not exposed through the application API. Deny all app roles explicitly.
REVOKE ALL ON SCHEMA ${schema},${privateSchema} FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA ${schema},${privateSchema} FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA ${schema},${privateSchema} FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ${schema},${privateSchema} FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('${schema}','${privateSchema}') LOOP
  EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',t.schemaname,t.tablename);
 END LOOP;
END $$;
COMMIT;
`;
if(/\bpublic\./.test(sql))throw new Error('Unisolated public reference');
writeFileSync('supabase/proposals/qa-isolated-setup.sql',sql);
console.log('Prepared isolated QA schemas:',schema,privateSchema,'(NOT executed remotely)');
