-- Executes with the proposed migration in one transaction; caller always rolls back.
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
DO $qa$
DECLARE o jsonb; oid uuid; result jsonb; rejected boolean; due integer; before_receipts integer; shift_id uuid;
BEGIN
 INSERT INTO public.telegram_users(telegram_id,first_name,role) VALUES(880033000101,'QA self-service cashier','employee'),(880033000102,'QA no payment permission','employee');
 INSERT INTO public.cafe_staff(telegram_id,location_id,staff_role,can_accept_payments,is_active) VALUES
 (880033000101,'e22788bd-4734-4b3a-911e-ba103d52617a','cashier',true,true),
 (880033000102,'e22788bd-4734-4b3a-911e-ba103d52617a','kitchen',false,true);
 PERFORM public.open_cafe_staff_shift('e22788bd-4734-4b3a-911e-ba103d52617a',880033000101,880033000101,0);
 o:=public.submit_cafe_guest_order_v3(gen_random_uuid(),repeat('e',64),'e22788bd-4734-4b3a-911e-ba103d52617a','[{"productId":"def936dc-6c57-4b06-ac32-cdf6a736c238","quantity":1}]','','','qa-self-service',null,'cash');
 oid:=(o->'order'->>'id')::uuid;due:=(o->'order'->>'totalVnd')::integer;
 IF NOT EXISTS(SELECT 1 FROM public.cafe_orders WHERE id=oid AND requires_prepayment AND status='pending' AND payment_status='pending' AND payment_timing='now') THEN RAISE EXCEPTION 'Unpaid guest order not queued at cashier'; END IF;
 rejected:=false;
 BEGIN PERFORM public.update_cafe_order_status(oid,880033000102,'preparing'); EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '%SELF_SERVICE_PAYMENT_REQUIRED%' THEN rejected:=true; ELSE RAISE; END IF; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Unpaid cooking allowed'; END IF;
 rejected:=false;
 BEGIN UPDATE public.cafe_orders SET status='ready',requires_prepayment=false WHERE id=oid; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '%SELF_SERVICE_PAYMENT_REQUIRED%' THEN rejected:=true; ELSE RAISE; END IF; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Direct status bypass allowed'; END IF;
 rejected:=false;
 BEGIN PERFORM public.update_cafe_order_payment_cash(oid,880033000102,'paid',null,due,0); EXCEPTION WHEN OTHERS THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Payment permission bypass allowed'; END IF;
 rejected:=false;
 BEGIN PERFORM public.update_cafe_order_payment_cash(oid,880033000101,'paid',null,due-1,0); EXCEPTION WHEN OTHERS THEN rejected:=true; END;
 IF NOT rejected OR EXISTS(SELECT 1 FROM public.cafe_payment_receipts WHERE order_id=oid) THEN RAISE EXCEPTION 'Underpayment accepted'; END IF;
 result:=public.update_cafe_order_payment_cash(oid,880033000101,'paid',null,due+10000,10000);
 IF result->'order'->>'status'<>'preparing' OR NOT EXISTS(SELECT 1 FROM public.cafe_orders WHERE id=oid AND status='preparing' AND payment_status='paid' AND accepted_by_telegram_id=880033000101) THEN RAISE EXCEPTION 'Cash payment did not start preparation'; END IF;
 PERFORM public.update_cafe_order_payment_cash(oid,880033000101,'paid',null,due+10000,10000);
 IF (SELECT count(*) FROM public.cafe_payment_receipts WHERE order_id=oid)<>1 OR (SELECT count(*) FROM public.cafe_order_events WHERE order_id=oid AND from_status='pending' AND to_status='preparing')<>1 THEN RAISE EXCEPTION 'Replay duplicated payment/start'; END IF;
 PERFORM public.update_cafe_order_status(oid,880033000102,'ready');
 PERFORM public.update_cafe_order_status(oid,880033000101,'completed');
 IF NOT EXISTS(SELECT 1 FROM public.cafe_orders WHERE id=oid AND status='completed' AND payment_status='paid') THEN RAISE EXCEPTION 'Paid ready order cannot be issued'; END IF;
 -- The existing delivery cash-on-delivery workflow stays available.
 o:=public.submit_cafe_guest_delivery_v4(gen_random_uuid(),repeat('d',64),'e22788bd-4734-4b3a-911e-ba103d52617a','[{"productId":"def936dc-6c57-4b06-ac32-cdf6a736c238","quantity":1}]','','','qa-self-service',null,'cash','QA Nha Trang delivery',12.28,109.20,encode(sha256(gen_random_uuid()::text::bytea),'hex'));
 oid:=(o->'order'->>'id')::uuid;
 IF EXISTS(SELECT 1 FROM public.cafe_orders WHERE id=oid AND requires_prepayment) THEN RAISE EXCEPTION 'Delivery incorrectly forced to prepay'; END IF;
 PERFORM public.update_cafe_order_status(oid,880033000102,'preparing');
END $qa$;
SELECT 'PASS self-service cash: unpaid cashier queue, preparation/ready bypass blocked, staff payment permission, exact cash/change, atomic paid-to-preparing, replay, ready/issued and delivery compatibility' AS result;
