BEGIN;
ALTER TABLE public.inventory ADD COLUMN planned_quantity integer NOT NULL DEFAULT 0 CHECK(planned_quantity BETWEEN 0 AND 99999);
ALTER TABLE public.inventory ADD COLUMN planned_ready_at timestamptz;
ALTER TABLE public.inventory ADD COLUMN plan_revision uuid;
ALTER TABLE public.inventory ADD CONSTRAINT cafe_plan_fields CHECK((planned_quantity=0 AND planned_ready_at IS NULL AND plan_revision IS NULL) OR (planned_quantity>0 AND planned_ready_at IS NOT NULL AND plan_revision IS NOT NULL));
DO $patch$ DECLARE src text;anchor text:='''confirmed'',coalesce(i.ready_stock_confirmed,false)';BEGIN
 SELECT pg_get_functiondef('public.cafe_ready_list(bigint,uuid)'::regprocedure) INTO src;
 IF position(anchor IN src)=0 THEN RAISE EXCEPTION 'Stock list compatibility changed';END IF;
 EXECUTE replace(src,anchor,'''plannedQuantity'',coalesce(i.planned_quantity,0),''plannedReadyAt'',i.planned_ready_at,''planRevision'',i.plan_revision,'||anchor);
END $patch$;
CREATE FUNCTION public.cafe_ready_plan(p_actor bigint,p_location uuid,p_key uuid,p_action text,p_items jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE previous umma_private.cafe_ready_operations%rowtype; payload jsonb:=jsonb_build_object('location',p_location,'planAction',p_action,'items',p_items); item jsonb; row public.inventory%rowtype; qty int; target timestamptz; result jsonb; expected uuid;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR NOT EXISTS(SELECT 1 FROM telegram_users u WHERE u.telegram_id=p_actor AND u.is_active AND (u.role='super_admin' OR (u.role IN ('admin','employee') AND EXISTS(SELECT 1 FROM cafe_staff s WHERE s.telegram_id=p_actor AND s.location_id=p_location AND s.is_active AND s.staff_role IN ('kitchen','manager'))))) THEN RAISE EXCEPTION 'Stock edit access denied';END IF;
 IF p_key IS NULL OR p_action IS NULL OR p_items IS NULL OR p_action NOT IN ('plan','finish','cancel') OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 150 THEN RAISE EXCEPTION 'Invalid plan request';END IF;
 IF NOT EXISTS(SELECT 1 FROM locations WHERE id=p_location AND is_active AND location_type IN ('cafe','restaurant')) THEN RAISE EXCEPTION 'Cafe unavailable';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('ready-stock:'||p_actor||':'||p_key,0));
 SELECT * INTO previous FROM umma_private.cafe_ready_operations WHERE actor_id=p_actor AND request_key=p_key;
 IF FOUND THEN IF previous.payload<>payload THEN RAISE EXCEPTION 'Stock request key mismatch';END IF;RETURN previous.result;END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(p_items))<>(SELECT count(DISTINCT value->>'productId') FROM jsonb_array_elements(p_items)) THEN RAISE EXCEPTION 'Duplicate product';END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_items) ORDER BY value->>'productId' LOOP
  IF NOT (item?'revision') THEN RAISE EXCEPTION 'Plan revision required';END IF;expected:=(item->>'revision')::uuid;
  IF NOT EXISTS(SELECT 1 FROM products WHERE id=(item->>'productId')::uuid AND product_type='cafe' AND is_active AND NOT catalog_preview AND price_vnd>0) THEN RAISE EXCEPTION 'Product unavailable';END IF;
  INSERT INTO inventory(product_id,location_id,quantity,reserved_quantity) VALUES((item->>'productId')::uuid,p_location,0,0) ON CONFLICT(product_id,location_id) DO NOTHING;
  SELECT * INTO row FROM inventory WHERE product_id=(item->>'productId')::uuid AND location_id=p_location FOR UPDATE;
  IF row.plan_revision IS DISTINCT FROM expected THEN RAISE EXCEPTION 'План уже изменён. Обновите список и повторите.';END IF;
  IF p_action IN ('plan','finish') THEN
   IF coalesce(item->>'quantity','')!~ '^[0-9]{1,5}$' OR (item->>'quantity')::int<1 THEN RAISE EXCEPTION 'Укажите количество партии от 1 до 99999';END IF;qty:=(item->>'quantity')::int;
  END IF;
  IF p_action='plan' THEN
   IF coalesce(item->>'readyAt','')!~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$' THEN RAISE EXCEPTION 'Укажите дату и время готовности';END IF;
   target:=(item->>'readyAt')::timestamptz;
   IF target<=clock_timestamp() OR target>clock_timestamp()+interval '14 days' THEN RAISE EXCEPTION 'Время готовности должно быть в будущем, в пределах 14 дней';END IF;
   UPDATE inventory SET planned_quantity=qty,planned_ready_at=target,plan_revision=gen_random_uuid(),updated_at=now() WHERE id=row.id;
  ELSE
   IF row.planned_quantity=0 OR expected IS NULL THEN RAISE EXCEPTION 'Партия уже завершена или отменена';END IF;
   IF p_action='finish' THEN
    UPDATE inventory SET quantity=(CASE WHEN ready_stock_confirmed THEN quantity ELSE reserved_quantity END)+qty,ready_stock_confirmed=true,ready_stock_state='ready',is_available=true,planned_quantity=0,planned_ready_at=NULL,plan_revision=NULL,updated_at=now() WHERE id=row.id;
    INSERT INTO cafe_inventory_movements(location_id,product_id,actor_telegram_id,movement_type,quantity,note) VALUES(p_location,row.product_id,p_actor,'stock_set',qty,'Партия готова: добавлено порций');
   ELSE UPDATE inventory SET planned_quantity=0,planned_ready_at=NULL,plan_revision=NULL,updated_at=now() WHERE id=row.id;
   END IF;
  END IF;
 END LOOP;
 result:=public.cafe_ready_list(p_actor,p_location);
 INSERT INTO umma_private.cafe_ready_operations VALUES(p_actor,p_key,payload,result,now());RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.cafe_ready_plan(bigint,uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cafe_ready_plan(bigint,uuid,uuid,text,jsonb) TO service_role;
COMMIT;
