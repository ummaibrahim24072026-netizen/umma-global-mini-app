BEGIN;
-- Combined role is kitchen + explicit payment capability; existing kitchen/cashier roles stay independent.
DO $$ DECLARE src text;BEGIN
 SELECT pg_get_functiondef('public.cafe_web_invite_staff(bigint,uuid,text,text,text)'::regprocedure) INTO src;
 IF position('''cashier'',''kitchen'',''courier'',''manager''' IN src)=0 THEN RAISE EXCEPTION 'Invite compatibility changed';END IF;
 src:=replace(src,'''cashier'',''kitchen'',''courier'',''manager''','''cashier'',''kitchen'',''kitchen_cashier'',''courier'',''manager''');
 src:=replace(src,'VALUES(a,p_location,p_role,p_role IN (''cashier'',''manager'',''courier'')','VALUES(a,p_location,CASE WHEN p_role=''kitchen_cashier'' THEN ''kitchen'' ELSE p_role END,p_role IN (''cashier'',''manager'',''courier'',''kitchen_cashier'')');
 IF position('CASE WHEN p_role=''kitchen_cashier''' IN src)=0 THEN RAISE EXCEPTION 'Invite assignment compatibility changed';END IF;EXECUTE src;
END $$;
CREATE FUNCTION public.cafe_web_change_staff_role(p_actor bigint,p_target bigint,p_location uuid,p_role text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR NOT EXISTS(SELECT 1 FROM telegram_users WHERE telegram_id=p_actor AND is_active AND role='super_admin') THEN RAISE EXCEPTION 'Owner access required';END IF;
 IF p_role IS NULL OR p_role NOT IN ('cashier','kitchen','kitchen_cashier','courier','manager') OR p_actor=p_target THEN RAISE EXCEPTION 'Укажите допустимую роль сотрудника';END IF;
 IF EXISTS(SELECT 1 FROM cafe_orders WHERE courier_telegram_id=p_target AND status NOT IN ('completed','cancelled') AND delivery_status<>'delivered') THEN RAISE EXCEPTION 'Сначала завершите доставки сотрудника';END IF;
 UPDATE cafe_staff SET staff_role=CASE WHEN p_role='kitchen_cashier' THEN 'kitchen' ELSE p_role END,can_accept_payments=p_role IN ('cashier','manager','courier','kitchen_cashier'),courier_available=p_role='courier' WHERE telegram_id=p_target AND location_id=p_location AND is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'Сотрудник не назначен в это кафе';END IF;
 RETURN jsonb_build_object('ok',true);
END $$;
-- Only unlinked raw ingredients can be received by kitchen staff through the existing purchasing ledger.
DO $$ DECLARE src text;anchor text:='  IF NOT v_actor_allowed THEN RAISE EXCEPTION ''Purchase management access denied''; END IF;';BEGIN
 SELECT pg_get_functiondef('public.post_purchase_document(uuid,bigint)'::regprocedure) INTO src;
 IF position(anchor IN src)=0 THEN RAISE EXCEPTION 'Purchase compatibility changed';END IF;
 EXECUTE replace(src,anchor,$branch$
  v_actor_allowed:=v_actor_allowed OR (EXISTS(SELECT 1 FROM cafe_staff WHERE telegram_id=p_actor_telegram_id AND location_id=v_doc.location_id AND staff_role='kitchen' AND is_active) AND NOT EXISTS(SELECT 1 FROM purchase_items pi JOIN stock_items s ON s.id=pi.stock_item_id WHERE pi.purchase_document_id=v_doc.id AND (s.item_type<>'raw_material' OR s.linked_product_id IS NOT NULL)));
$branch$||anchor);
END $$;
CREATE INDEX IF NOT EXISTS cafe_purchase_day ON public.purchase_documents(location_id,purchase_date,status);
CREATE FUNCTION public.cafe_ingredients_list(p_actor bigint,p_location uuid,p_day date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE items jsonb;docs jsonb;total bigint;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR NOT EXISTS(SELECT 1 FROM telegram_users u WHERE u.telegram_id=p_actor AND u.is_active AND (u.role='super_admin' OR (u.role IN ('employee','admin') AND EXISTS(SELECT 1 FROM cafe_staff s WHERE s.telegram_id=p_actor AND s.location_id=p_location AND s.is_active AND s.staff_role IN ('kitchen','manager'))))) THEN RAISE EXCEPTION 'Ingredient access denied';END IF;
 IF p_day IS NULL OR NOT EXISTS(SELECT 1 FROM locations WHERE id=p_location AND is_active AND location_type='cafe') THEN RAISE EXCEPTION 'Cafe/date unavailable';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name_ru,'unit',s.base_unit,'quantity',coalesce(b.quantity_on_hand,0),'averageCostVnd',coalesce(b.average_unit_cost_vnd,0)) ORDER BY s.name_ru),'[]') INTO items FROM stock_items s LEFT JOIN stock_balances b ON b.stock_item_id=s.id AND b.location_id=p_location WHERE s.item_type='raw_material' AND s.linked_product_id IS NULL AND s.is_active;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',d.id,'date',d.purchase_date,'totalVnd',d.subtotal_vnd,'note',d.notes,'items',(SELECT jsonb_agg(jsonb_build_object('name',s.name_ru,'unit',s.base_unit,'quantity',x.quantity,'unitCostVnd',x.unit_cost_vnd,'totalVnd',x.line_total_vnd) ORDER BY s.name_ru) FROM purchase_items x JOIN stock_items s ON s.id=x.stock_item_id WHERE x.purchase_document_id=d.id)) ORDER BY d.created_at DESC),'[]'),coalesce(sum(d.subtotal_vnd),0) INTO docs,total FROM purchase_documents d WHERE d.location_id=p_location AND d.purchase_date=p_day AND d.status='posted' AND EXISTS(SELECT 1 FROM purchase_items x WHERE x.purchase_document_id=d.id) AND NOT EXISTS(SELECT 1 FROM purchase_items x JOIN stock_items s ON s.id=x.stock_item_id WHERE x.purchase_document_id=d.id AND (s.item_type<>'raw_material' OR s.linked_product_id IS NOT NULL));
 RETURN jsonb_build_object('ok',true,'stock',items,'purchases',docs,'dayTotalVnd',total);
END $$;
CREATE FUNCTION public.cafe_ingredients_receive(p_actor bigint,p_location uuid,p_key uuid,p_day date,p_supplier text,p_items jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE payload jsonb:=jsonb_build_object('ingredientLocation',p_location,'date',p_day,'supplier',p_supplier,'items',p_items);old umma_private.cafe_ready_operations%rowtype;item jsonb;stock uuid;doc uuid;quantity numeric;cost numeric;result jsonb;nm text;un text;
BEGIN
 PERFORM cafe_ingredients_list(p_actor,p_location,p_day);
 IF p_key IS NULL OR p_day>(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date OR p_day<(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date-365 OR length(coalesce(p_supplier,''))>150 OR p_items IS NULL OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Проверьте дату, поставщика и список закупки';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('ready-stock:'||p_actor||':'||p_key,0));
 SELECT * INTO old FROM umma_private.cafe_ready_operations WHERE actor_id=p_actor AND request_key=p_key;
 IF FOUND THEN IF old.payload<>payload THEN RAISE EXCEPTION 'Request key mismatch';END IF;RETURN old.result;END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('ingredient-purchase:'||p_location,0));
 INSERT INTO purchase_documents(location_id,purchase_date,notes,created_by_telegram_id) VALUES(p_location,p_day,nullif(trim(coalesce(p_supplier,'')),''),p_actor) RETURNING id INTO doc;
 FOR item IN SELECT value FROM jsonb_array_elements(p_items) ORDER BY lower(trim(value->>'name')),value->>'unit' LOOP
  nm:=trim(item->>'name');un:=item->>'unit';
  IF nm IS NULL OR length(nm) NOT BETWEEN 1 AND 100 OR un IS NULL OR un NOT IN ('kg','l','pcs') OR coalesce(item->>'quantity','')!~ '^[0-9]{1,7}(\.[0-9]{1,3})?$' OR coalesce(item->>'unitCostVnd','')!~ '^[0-9]{1,10}$' THEN RAISE EXCEPTION 'Укажите ингредиент, единицу, количество и цену';END IF;
  quantity:=(item->>'quantity')::numeric;cost:=(item->>'unitCostVnd')::numeric;
  IF quantity<=0 OR quantity>1000000 OR cost>1000000000 OR quantity*cost>1000000000000 THEN RAISE EXCEPTION 'Проверьте количество и стоимость ингредиента';END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('ingredient-item:'||lower(nm)||':'||un,0));
  SELECT id INTO stock FROM stock_items WHERE lower(trim(name_ru))=lower(nm) AND base_unit=un AND item_type='raw_material' AND linked_product_id IS NULL AND is_active ORDER BY created_at,id LIMIT 1;
  IF NOT FOUND THEN INSERT INTO stock_items(name_ru,item_type,base_unit,created_by_telegram_id) VALUES(nm,'raw_material',un,p_actor) RETURNING id INTO stock;END IF;
  INSERT INTO purchase_items(purchase_document_id,stock_item_id,quantity,unit_cost_vnd,line_total_vnd) VALUES(doc,stock,quantity,cost,round(quantity*cost));
 END LOOP;
 result:=post_purchase_document(doc,p_actor);
 INSERT INTO umma_private.cafe_ready_operations VALUES(p_actor,p_key,payload,result,now());RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.cafe_web_change_staff_role(bigint,bigint,uuid,text),public.cafe_ingredients_list(bigint,uuid,date),public.cafe_ingredients_receive(bigint,uuid,uuid,date,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cafe_web_change_staff_role(bigint,bigint,uuid,text),public.cafe_ingredients_list(bigint,uuid,date),public.cafe_ingredients_receive(bigint,uuid,uuid,date,text,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.post_purchase_document(uuid,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.post_purchase_document(uuid,bigint) TO service_role;
DO $$ BEGIN IF to_regprocedure('public.cafe_preorder_line_guard()') IS NOT NULL THEN ALTER FUNCTION public.cafe_preorder_line_guard() SET search_path=public,pg_temp;END IF;END $$;
COMMIT;
