BEGIN;
DO $qa$
DECLARE
  loc uuid := 'e22788bd-4734-4b3a-911e-ba103d52617a';
  manager bigint := -900200001;
  cook bigint := -900200002;
  another bigint := -900200003;
  order_id uuid;
  green_id uuid;
  step text;
  addr text;
BEGIN
  SELECT 'QA' || chr(10) || 'Точка доставки: ' || latitude || ',' || longitude INTO STRICT addr
    FROM public.locations WHERE id=loc;
  INSERT INTO public.telegram_users(telegram_id,role,is_active) VALUES
    (manager,'super_admin',true),(cook,'employee',true),(another,'employee',true);
  INSERT INTO public.cafe_staff(telegram_id,location_id,staff_role,is_active,can_accept_payments)
    VALUES(cook,loc,'kitchen',true,false),(another,loc,'cashier',true,true);
  INSERT INTO public.cafe_orders(location_id,created_via,order_type,payment_method,payment_status)
    VALUES(loc,'staff','pickup','cash','paid') RETURNING id INTO order_id;
  PERFORM public.update_cafe_order_status(order_id,cook,'preparing',NULL);
  IF (SELECT preparation_station FROM public.cafe_orders WHERE id=order_id) IS DISTINCT FROM 'kitchen'
     OR NOT EXISTS (SELECT FROM jsonb_array_elements(public.cafe_web_fulfillment(order_id,cook,'staff','{}')->'staff') e
                    WHERE e->>'id'=another::text) THEN
    RAISE EXCEPTION 'Incorrect preparation station or staff list';
  END IF;
  PERFORM public.cafe_web_fulfillment(order_id,cook,'transfer',
    jsonb_build_object('expectedOwner',cook::text,'targetId',another::text));
  BEGIN
    PERFORM public.update_cafe_order_status(order_id,cook,'ready',NULL);
    RAISE EXCEPTION 'Old owner can mark ready';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Order already accepted by another employee' THEN RAISE; END IF;
  END;
  IF NOT EXISTS (SELECT FROM public.cafe_orders WHERE id=order_id AND accepted_by_telegram_id=another AND preparation_station='counter') THEN
    RAISE EXCEPTION 'New assignee or station missing';
  END IF;
  PERFORM public.update_cafe_order_status(order_id,another,'completed',NULL);

  INSERT INTO public.cafe_orders(location_id,created_via,order_type,payment_method,payment_status,dispatch_mode,delivery_address)
    VALUES(loc,'customer','delivery','qr','paid','manual',addr) RETURNING id INTO green_id;
  PERFORM public.update_cafe_order_status(green_id,cook,'preparing',NULL);
  PERFORM public.update_cafe_order_status(green_id,cook,'ready',NULL);
  BEGIN
    PERFORM public.update_cafe_order_status(green_id,manager,'completed',NULL);
    RAISE EXCEPTION 'Early Green completion was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Сначала подтвердите этапы доставки Green SM' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.cafe_web_fulfillment(green_id,cook,'greenStage','{"stage":"booked"}');
    RAISE EXCEPTION 'Kitchen can dispatch';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Нет доступа к доставке' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.cafe_web_fulfillment(green_id,manager,'greenDetails','{"trackingUrl":"https://greensm.com.example.invalid/booking"}');
    RAISE EXCEPTION 'Unsafe URL accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Вставьте действительную HTTPS-ссылку Green SM' THEN RAISE; END IF;
  END;
  -- This is a format fixture only. The test never opens or shares the link.
  PERFORM public.cafe_web_fulfillment(green_id,manager,'greenDetails',jsonb_build_object(
    'trackingUrl','https://booking.xanhsm.com/qa-rollback','bookingId','QA'));
  BEGIN
    PERFORM public.cafe_web_fulfillment(green_id,manager,'greenStage','{"stage":"picked_up"}');
    RAISE EXCEPTION 'Skipped stage accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Этап уже изменился или выбран не по порядку' THEN RAISE; END IF;
  END;
  FOREACH step IN ARRAY ARRAY['booked','assigned','arrived','picked_up'] LOOP
    PERFORM public.cafe_web_fulfillment(green_id,manager,'greenStage',jsonb_build_object('stage',step));
  END LOOP;
  IF NOT EXISTS (SELECT FROM public.cafe_orders WHERE id=green_id AND status='ready' AND green_sm_stage='picked_up'
    AND green_sm_tracking_url='https://booking.xanhsm.com/qa-rollback' AND green_sm_booking_id='QA') THEN
    RAISE EXCEPTION 'Handover closed the order or lost booking details';
  END IF;
  PERFORM public.cafe_web_fulfillment(green_id,manager,'greenStage','{"stage":"delivered"}');
  IF NOT EXISTS (SELECT FROM public.cafe_orders WHERE id=green_id AND status='completed' AND delivery_status='delivered'
    AND green_sm_stage='delivered') THEN RAISE EXCEPTION 'Confirmed delivery did not close the order'; END IF;
  IF has_function_privilege('anon','public.cafe_web_fulfillment(uuid,bigint,text,jsonb)','execute')
     OR has_function_privilege('authenticated','public.cafe_web_fulfillment(uuid,bigint,text,jsonb)','execute') THEN
    RAISE EXCEPTION 'Public mutation access';
  END IF;
END;
$qa$;
ROLLBACK;
