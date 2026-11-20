-- Extend existing payment and fulfillment routines while keeping their authorization,
-- inventory and idempotency checks. Each replacement must match the installed schema.
DO $migration$
DECLARE
  patch record;
  definition text;
BEGIN
  FOR patch IN SELECT * FROM (VALUES
    ('public.cafe_counter_foreign_payment(bigint,text,jsonb)',
     '  request_key uuid;',
     E'  request_key uuid;\n  order_type_ text:=coalesce(p_args->>''orderType'',''pickup'');'),
    ('public.cafe_counter_foreign_payment(bigint,text,jsonb)',
     'AND order_type IN (''pickup'',''dine_in'')',
     'AND (order_type IN (''pickup'',''dine_in'') OR (order_type=''delivery'' AND created_via=''staff'' AND dispatch_mode=''manual'' AND requires_prepayment))'),
    ('public.cafe_counter_foreign_payment(bigint,text,jsonb)',
     'sale.created_via IS DISTINCT FROM ''staff'' OR sale.order_type IS DISTINCT FROM ''pickup''',
     'sale.created_via IS DISTINCT FROM ''staff'' OR (sale.order_type=''dine_in'' AND sale.payment_timing<>''now'')'),
    ('public.cafe_counter_foreign_payment(bigint,text,jsonb)',
     '      -- The normal staff-order RPC',
     E'      IF order_type_ NOT IN (''pickup'',''dine_in'',''delivery'') OR (order_type_=''delivery'' AND\n         (nullif(btrim(p_args->>''deliveryAddress''),'''') IS NULL OR nullif(btrim(p_args->>''customerPhone''),'''') IS NULL))\n      THEN RAISE EXCEPTION ''COUNTER_INVALID''; END IF;\n      -- The normal staff-order RPC'),
    ('public.cafe_counter_foreign_payment(bigint,text,jsonb)',
     '''p_order_type'',''pickup''',
     '''p_order_type'',order_type_'),
    ('public.cafe_counter_foreign_payment(bigint,text,jsonb)',
     E'        ''p_counter_channel'',method\n      ));',
     E'        ''p_counter_channel'',method\n      ) || CASE WHEN order_type_=''delivery'' THEN jsonb_build_object(\n        ''p_delivery_address'',p_args->>''deliveryAddress'', ''p_customer_phone'',p_args->>''customerPhone'', ''p_dispatch_mode'',''manual''\n      ) ELSE ''{}''::jsonb END);'),
    ('public.cafe_counter_fx_cash_settle(bigint,uuid,text,numeric,numeric,timestamptz)',
     'sale.order_type<>''pickup''',
     '(sale.order_type=''dine_in'' AND sale.payment_timing<>''now'') OR (sale.order_type=''delivery'' AND (sale.dispatch_mode<>''manual'' OR NOT sale.requires_prepayment))'),
    ('public.execute_cafe_order_operation(bigint,uuid,text,jsonb)',
     'IF coalesce(p_arguments->>''p_dispatch_mode'',''broadcast'') NOT IN (''broadcast'',''nearest'') THEN',
     'IF coalesce(p_arguments->>''p_dispatch_mode'',''broadcast'') NOT IN (''broadcast'',''nearest'') AND NOT (p_action=''staffOrder'' AND v_payment_timing=''now'' AND p_arguments->>''p_dispatch_mode''=''manual'') THEN'),
    ('public.execute_cafe_order_operation(bigint,uuid,text,jsonb)',
     ' SET dispatch_mode=coalesce(p_arguments->>''p_dispatch_mode'',''broadcast'') WHERE',
     E' SET dispatch_mode=coalesce(p_arguments->>''p_dispatch_mode'',''broadcast''),\n        requires_prepayment=requires_prepayment OR coalesce(p_arguments->>''p_dispatch_mode''=''manual'',false) WHERE'),
    ('public.execute_cafe_order_operation(bigint,uuid,text,jsonb)',
     '      PERFORM public.ensure_cafe_courier_offers((v_result->''order''->>''id'')::uuid);',
     E'      IF (p_arguments->>''p_dispatch_mode'') IS DISTINCT FROM ''manual'' THEN\n        PERFORM public.ensure_cafe_courier_offers((v_result->''order''->>''id'')::uuid);\n      END IF;'),
    ('public.cafe_self_service_guard()',
     ' NEW.requires_prepayment:=OLD.requires_prepayment;',
     E' NEW.requires_prepayment:=OLD.requires_prepayment OR (NEW.requires_prepayment AND NEW.source_module=''cafe'' AND NEW.created_via=''staff''\n   AND NEW.customer_telegram_id IS NULL AND NEW.order_type=''delivery'' AND NEW.dispatch_mode=''manual''\n   AND OLD.dispatch_mode<>''manual'' AND OLD.status=''pending'' AND NEW.payment_timing=''now'');'),
    ('public.cafe_self_service_guard()',
     ' IF NOT OLD.requires_prepayment THEN RETURN NEW; END IF;',
     ' IF NOT NEW.requires_prepayment THEN RETURN NEW; END IF;'),
    ('public.cafe_web_fulfillment(uuid,bigint,text,jsonb)',
     'o.created_via=''customer''',
     'o.created_via IN (''customer'',''staff'')'),
    ('public.cafe_web_fulfillment_guard()',
     'NEW.created_via=''customer''',
     'NEW.created_via IN (''customer'',''staff'')'),
    ('public.update_cafe_order_status(uuid,bigint,text,text)',
     'v_order.created_via=''customer'' AND v_order.customer_telegram_id IS NULL AND v_order.courier_telegram_id IS NULL',
     'v_order.created_via IN (''customer'',''staff'') AND v_order.customer_telegram_id IS NULL AND v_order.courier_telegram_id IS NULL'),
    ('public.offer_cafe_courier(uuid,bigint,bigint)',
     'o.requires_prepayment AND o.created_via=''customer'' AND o.customer_telegram_id IS NULL',
     'o.requires_prepayment AND o.created_via IN (''customer'',''staff'') AND o.customer_telegram_id IS NULL')
  ) AS changes(signature, anchor, replacement)
  LOOP
    definition:=pg_get_functiondef(patch.signature::regprocedure);
    IF (length(definition)-length(replace(definition,patch.anchor,'')))/length(patch.anchor)<>1 THEN
      RAISE EXCEPTION 'Unexpected counter order function definition: % (%)',patch.signature,patch.anchor;
    END IF;
    EXECUTE replace(definition,patch.anchor,patch.replacement);
  END LOOP;
END
$migration$;
