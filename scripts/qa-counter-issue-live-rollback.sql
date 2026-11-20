-- Run on an isolated database or in a rollback-only transaction after applying the migration.
BEGIN;
DO $qa$
DECLARE
 l uuid; solo uuid; split uuid; unpaid uuid; shared uuid; payment jsonb;
 cashier bigint:= -900100001; cook bigint:= -900100002; other_cook bigint:= -900100003;
 first_staff bigint:= -900100004; second_staff bigint:= -900100005;
BEGIN
 SELECT id INTO STRICT l FROM public.locations WHERE id='e22788bd-4734-4b3a-911e-ba103d52617a' AND self_service_enabled;
 INSERT INTO public.telegram_users(telegram_id,role,is_active) VALUES(cashier,'employee',true),(cook,'employee',true),(other_cook,'employee',true);
 INSERT INTO public.cafe_staff(telegram_id,location_id,staff_role,is_active,can_accept_payments) VALUES(cashier,l,'cashier',true,true),(cook,l,'kitchen',true,false),(other_cook,l,'kitchen',true,false);
 INSERT INTO public.cafe_orders(location_id,created_via,order_type,payment_method,payment_status) VALUES(l,'staff','pickup','cash','paid') RETURNING id INTO solo;
 PERFORM public.update_cafe_order_status(solo,cashier,'completed',NULL);
 IF (SELECT array_agg(to_status ORDER BY CASE to_status WHEN 'preparing' THEN 1 WHEN 'ready' THEN 2 ELSE 3 END) FROM public.cafe_order_events WHERE order_id=solo) IS DISTINCT FROM ARRAY['preparing','ready','completed'] THEN RAISE EXCEPTION 'missing history'; END IF;
 BEGIN
  PERFORM public.update_cafe_order_status(solo,cashier,'completed',NULL);
  RAISE EXCEPTION 'duplicate issue passed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Order already has this status' THEN RAISE; END IF;
 END;
 INSERT INTO public.cafe_orders(location_id,created_via,order_type,payment_method,payment_status) VALUES(l,'staff','dine_in','cash','paid') RETURNING id INTO split;
 PERFORM public.update_cafe_order_status(split,cook,'preparing',NULL);
 BEGIN
  PERFORM public.update_cafe_order_status(split,other_cook,'ready',NULL);
  RAISE EXCEPTION 'other cook bypassed ownership';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Order already accepted by another employee' THEN RAISE; END IF;
 END;
 PERFORM public.update_cafe_order_status(split,cook,'ready',NULL);
 BEGIN
  PERFORM public.update_cafe_order_status(split,cook,'completed',NULL);
  RAISE EXCEPTION 'kitchen issued an order';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Staff role cannot perform this order status transition' THEN RAISE; END IF;
 END;
 PERFORM public.update_cafe_order_status(split,cashier,'completed',NULL);
 INSERT INTO public.cafe_orders(location_id,created_via,order_type,payment_method) VALUES(l,'customer','pickup','qr') RETURNING id INTO unpaid;
 BEGIN
  PERFORM public.update_cafe_order_status(unpaid,cook,'preparing',NULL);
  RAISE EXCEPTION 'unpaid preparation passed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'SELF_SERVICE_PAYMENT_REQUIRED' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.update_cafe_order_status(unpaid,cashier,'completed',NULL);
  RAISE EXCEPTION 'unpaid issue passed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Order cannot be completed before payment is confirmed' THEN RAISE; END IF;
 END;
 UPDATE public.cafe_orders SET payment_status='paid', paid_by_telegram_id=cashier WHERE id=unpaid;
 IF NOT EXISTS (SELECT FROM public.cafe_orders WHERE id=unpaid AND status='confirmed' AND accepted_by_telegram_id IS NULL) THEN
  RAISE EXCEPTION 'payment did not queue an unassigned order';
 END IF;
 PERFORM public.update_cafe_order_status(unpaid,cook,'preparing',NULL);
 IF NOT EXISTS (SELECT FROM public.cafe_orders WHERE id=unpaid AND accepted_by_telegram_id=cook) THEN
  RAISE EXCEPTION 'preparation did not claim the paid order';
 END IF;
 INSERT INTO public.telegram_users(telegram_id,role,is_active)
 VALUES(first_staff,'employee',true),(second_staff,'employee',true);
 INSERT INTO public.cafe_staff(telegram_id,location_id,staff_role,is_active,can_accept_payments)
 VALUES(first_staff,l,'kitchen',true,true),(second_staff,l,'kitchen',true,true);
 INSERT INTO public.cafe_orders(location_id,created_via,order_type,payment_method,total_vnd)
 VALUES(l,'customer','pickup','cash',50000) RETURNING id INTO shared;
 PERFORM public.update_cafe_order_payment_cash(shared,first_staff,'paid',NULL,60000,10000);
 payment:=public.update_cafe_order_payment_cash(shared,second_staff,'paid',NULL,90000,40000);
 IF (payment->'order'->>'paidByTelegramId')::bigint IS DISTINCT FROM first_staff OR
    (SELECT count(*) FROM public.cafe_payment_receipts WHERE order_id=shared)<>1 OR
    NOT EXISTS (SELECT FROM public.cafe_payment_receipts WHERE order_id=shared
      AND collected_by_telegram_id=first_staff AND tendered_amount_vnd=60000 AND change_given_vnd=10000)
 THEN RAISE EXCEPTION 'second counter changed the payment or receipt'; END IF;
 PERFORM public.update_cafe_order_status(shared,second_staff,'preparing',NULL);
 BEGIN
  PERFORM public.update_cafe_order_status(shared,first_staff,'completed','counter_pickup_call');
  RAISE EXCEPTION 'counter bypassed the active kitchen assignment';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Order already accepted by another employee' THEN RAISE; END IF;
 END;
 PERFORM public.update_cafe_order_status(shared,second_staff,'ready',NULL);
 PERFORM public.update_cafe_order_status(shared,first_staff,'completed','counter_pickup_call');
 BEGIN
  PERFORM public.update_cafe_order_status(shared,second_staff,'completed','counter_pickup_call');
  RAISE EXCEPTION 'second counter issued the same order again';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Order already has this status' THEN RAISE; END IF;
 END;
 IF (SELECT count(*) FROM public.cafe_order_events WHERE order_id=shared AND to_status='completed')<>1
 THEN RAISE EXCEPTION 'expected exactly one pickup event'; END IF;
 IF has_function_privilege('anon','public.update_cafe_order_status(uuid,bigint,text,text)','execute')
   OR has_function_privilege('authenticated','public.update_cafe_order_status(uuid,bigint,text,text)','execute') THEN
  RAISE EXCEPTION 'public execution granted';
 END IF;
END;
$qa$;
ROLLBACK;
SELECT 'PASS cafe counter and kitchen lifecycle, one payment receipt and one pickup event' AS result;
