BEGIN;

-- Preserve the installed preorder, stock, payment and staff authorization logic.
DO $migration$
DECLARE
 patch record;
 definition text;
BEGIN
 FOR patch IN SELECT * FROM (VALUES
  ('public.submit_cafe_guest_delivery_v4(uuid,text,uuid,jsonb,text,text,text,text,text,text,double precision,double precision,text)',
   'delivery_address,payment_timing)',
   'delivery_address,payment_timing,dispatch_mode,delivery_fee_vnd)'),
  ('public.submit_cafe_guest_delivery_v4(uuid,text,uuid,jsonb,text,text,text,text,text,text,double precision,double precision,text)',
   'case when p_payment_method=''qr'' then ''now'' else ''on_delivery'' end)',
   '''now'',''manual'',0)'),
  ('public.submit_cafe_guest_delivery_v4(uuid,text,uuid,jsonb,text,text,text,text,text,text,double precision,double precision,text)',
   ' insert into umma_private.public_guest_requests(request_key,ip_hash)',
   E' if p_payment_method<>''qr'' then raise exception ''Web delivery requires prepayment by QR''; end if;\n insert into umma_private.public_guest_requests(request_key,ip_hash)'),
  ('public.submit_cafe_guest_delivery_v4(uuid,text,uuid,jsonb,text,text,text,text,text,text,double precision,double precision,text)',
   ' perform public.ensure_cafe_courier_offers(v_order.id);',
   ' -- Green SM is booked by the cafe outside UMMA.'),
  ('public.cafe_self_service_guard()',
   'NEW.requires_prepayment := NEW.source_module=',
   'NEW.requires_prepayment := (NEW.source_module=''cafe'' AND NEW.order_type=''delivery'' AND NEW.dispatch_mode=''manual'' AND NEW.created_via=''customer'' AND NEW.customer_telegram_id IS NULL) OR NEW.source_module='),
  ('public.offer_cafe_courier(uuid,bigint,bigint)',
   'OR o.order_type<>''delivery''',
   'OR (o.dispatch_mode=''manual'' AND o.requires_prepayment AND o.created_via=''customer'' AND o.customer_telegram_id IS NULL) OR o.order_type<>''delivery'''),
  ('public.update_cafe_order_status(uuid,bigint,text,text)',
   '  v_previous_status text;',
   E'  v_previous_status text;\n  v_green_delivery boolean;'),
  ('public.update_cafe_order_status(uuid,bigint,text,text)',
   '  v_previous_status:=v_order.status;',
   E'  v_previous_status:=v_order.status;\n  v_green_delivery:=v_order.source_module=''cafe'' AND v_order.order_type=''delivery'' AND v_order.dispatch_mode=''manual'' AND v_order.requires_prepayment AND v_order.created_via=''customer'' AND v_order.customer_telegram_id IS NULL AND v_order.courier_telegram_id IS NULL;'),
  ('public.update_cafe_order_status(uuid,bigint,text,text)',
   'AND coalesce(v_order.delivery_status,''waiting_courier'')<>''delivered'' THEN',
   'AND coalesce(v_order.delivery_status,''waiting_courier'')<>''delivered'' AND v_green_delivery IS NOT TRUE THEN'),
  ('public.update_cafe_order_status(uuid,bigint,text,text)',
   '    UPDATE public.cafe_orders SET status=p_new_status,updated_at=now(),',
   E'    UPDATE public.cafe_orders SET status=p_new_status,updated_at=now(),\n      delivery_status=CASE WHEN p_new_status=''completed'' AND v_green_delivery THEN ''delivered'' ELSE delivery_status END,')
 ) AS changes(signature, anchor, replacement)
 LOOP
  definition:=pg_get_functiondef(patch.signature::regprocedure);
  IF (length(definition)-length(replace(definition,patch.anchor,'')))/length(patch.anchor)<>1 THEN
   RAISE EXCEPTION 'Green SM migration expected a unique anchor in %: %',patch.signature,patch.anchor;
  END IF;
  EXECUTE replace(definition,patch.anchor,patch.replacement);
 END LOOP;
END
$migration$;

COMMIT;
