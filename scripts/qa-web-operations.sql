-- Transactional checks against the deployed authorization and accounting model. No sales retained.
BEGIN;
SELECT set_config('request.jwt.claim.role','service_role',true);
DO $$
DECLARE owner_id bigint; cashier_id bigint; courier_id bigint; loc uuid; product uuid; key uuid:=gen_random_uuid(); args jsonb; r jsonb; oid uuid; price int; denied boolean;
BEGIN
 SELECT telegram_id INTO owner_id FROM telegram_users WHERE role='super_admin' AND is_active LIMIT 1;
 SELECT id INTO loc FROM locations WHERE id='e22788bd-4734-4b3a-911e-ba103d52617a' AND is_active;
 cashier_id:=cafe_web_invite_staff(owner_id,loc,'cashier','QA web cashier',repeat('7',64));
 courier_id:=cafe_web_invite_staff(owner_id,loc,'courier','QA web courier',repeat('8',64));
 IF cafe_web_activate(repeat('7',64),'qa_web_cashier',repeat('a',64),repeat('b',64))<>cashier_id THEN RAISE EXCEPTION 'Activation mismatch'; END IF;
 denied:=false;BEGIN PERFORM cafe_web_activate(repeat('7',64),'qa_second',repeat('a',64),repeat('b',64));EXCEPTION WHEN OTHERS THEN denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'Invitation reused'; END IF;
 IF NOT EXISTS(SELECT 1 FROM cafe_staff WHERE telegram_id=courier_id AND staff_role='courier' AND courier_available AND can_accept_payments) THEN RAISE EXCEPTION 'Courier permissions invalid'; END IF;
 SELECT id,price_vnd INTO product,price FROM products WHERE sku='UMMA-CAFE-FLATBREAD' AND is_active;
 args:=jsonb_build_object('p_location_id',loc,'p_items',jsonb_build_array(jsonb_build_object('productId',product,'quantity',1)),'p_order_type','pickup','p_customer_name','Гость','p_payment_method','qr','p_payment_timing','now','p_dispatch_mode','nearest');
 r:=execute_cafe_order_operation(cashier_id,key,'staffOrder',args);oid:=(r->'order'->>'id')::uuid;
 IF NOT EXISTS(SELECT 1 FROM cafe_orders WHERE id=oid AND total_vnd=price AND payment_status='pending' AND requires_prepayment AND status='pending') THEN RAISE EXCEPTION 'QR sale prematurely paid'; END IF;
 r:=execute_cafe_order_operation(cashier_id,key,'staffOrder',args);
 IF (r->'order'->>'id')::uuid<>oid OR (r->>'replayed')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'Duplicate sale'; END IF;
 denied:=false;BEGIN PERFORM execute_cafe_order_operation(courier_id,gen_random_uuid(),'staffOrder',args);EXCEPTION WHEN OTHERS THEN denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'Courier created sale'; END IF;
 PERFORM update_cafe_order_payment_cash(oid,cashier_id,'paid',NULL,NULL,NULL);
 IF NOT EXISTS(SELECT 1 FROM cafe_orders WHERE id=oid AND payment_status='paid' AND status='preparing') THEN RAISE EXCEPTION 'Paid sale not released'; END IF;
 IF (SELECT count(*) FROM cafe_payment_receipts WHERE order_id=oid)<>1 THEN RAISE EXCEPTION 'Receipt count'; END IF;
 FOREACH key IN ARRAY ARRAY[gen_random_uuid()] LOOP
 args:=jsonb_set(args,'{p_payment_method}','"cash"');
 r:=execute_cafe_order_operation(cashier_id,key,'staffOrder',args);oid:=(r->'order'->>'id')::uuid;
 PERFORM update_cafe_order_payment_cash(oid,cashier_id,'paid',NULL,50000,50000-price);
 IF NOT EXISTS(SELECT 1 FROM cafe_payment_receipts WHERE order_id=oid AND amount_vnd=price) THEN RAISE EXCEPTION 'Cash sale not recorded'; END IF;
 END LOOP;
 IF has_table_privilege('anon','cafe_web_sessions','SELECT') OR has_table_privilege('authenticated','cafe_web_accounts','SELECT') OR has_function_privilege('anon','public.cafe_web_activate(text,text,text,text)','EXECUTE') THEN RAISE EXCEPTION 'Web auth publicly exposed'; END IF;
END $$;
ROLLBACK;
