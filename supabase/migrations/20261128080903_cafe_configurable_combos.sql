BEGIN;

ALTER TABLE public.cafe_combos ADD COLUMN configuration jsonb;
ALTER TABLE public.cafe_order_items ADD COLUMN combo_selection jsonb, ADD COLUMN combo_pricing jsonb;

-- Prices and availability come from the same location and products used for ordinary orders.
CREATE FUNCTION umma_private.cafe_combo_option(p_location uuid, p_option jsonb)
RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT p_option || jsonb_build_object(
   'weightG',CASE WHEN p_option->>'unit'='g' THEN (p_option->>'amount')::numeric END,
   'name_ru',coalesce(nullif(p_option->'labels'->>'ru',''),p.name_ru),
   'name_en',coalesce(nullif(p_option->'labels'->>'en',''),p.name_en),
   'name_vi',coalesce(nullif(p_option->'labels'->>'vi',''),p.name_vi),
   'priceVnd',coalesce((p_option->>'referenceVnd')::integer, round(p.price_vnd*(p_option->>'portions')::numeric)),
   'availablePortions',CASE WHEN p.is_active AND NOT p.catalog_preview AND p.price_vnd>0
      AND i.ready_stock_confirmed AND i.is_available AND i.ready_stock_state='ready'
      THEN greatest(0,i.quantity-i.reserved_quantity) ELSE 0 END)
 FROM products p LEFT JOIN inventory i ON i.product_id=p.id AND i.location_id=p_location
 WHERE p.id=(p_option->>'productId')::uuid
$$;

CREATE FUNCTION umma_private.cafe_combo_configuration(p_combo uuid,p_location uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT c.configuration || jsonb_build_object('basePriceVnd',p.price_vnd,
    'fixed',coalesce((SELECT jsonb_agg(umma_private.cafe_combo_option(p_location,o))
       FROM jsonb_array_elements(c.configuration->'fixed') o),'[]'::jsonb),
    'groups',coalesce((SELECT jsonb_agg(g || jsonb_build_object('options',
       (SELECT jsonb_agg(umma_private.cafe_combo_option(p_location,o))
        FROM jsonb_array_elements(g->'options') o)))
       FROM jsonb_array_elements(c.configuration->'groups') g),'[]'::jsonb),
    'extras',coalesce((SELECT jsonb_agg(umma_private.cafe_combo_option(p_location,o))
       FROM jsonb_array_elements(c.configuration->'extras') o),'[]'::jsonb))
 FROM cafe_combos c JOIN products p ON p.id=c.product_id JOIN locations l ON l.id=c.location_id
 WHERE c.product_id=p_combo AND c.location_id=p_location AND p.is_active AND l.is_active
   AND l.ready_stock_enabled AND c.configuration IS NOT NULL AND c.configuration->'archived' IS DISTINCT FROM 'true'::jsonb
   AND CASE WHEN c.configuration->>'startsAt' IS NULL THEN true ELSE
     CASE WHEN (c.configuration->>'startsAt')::time < (c.configuration->>'endsAt')::time
     THEN (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::time >= (c.configuration->>'startsAt')::time
      AND (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::time < (c.configuration->>'endsAt')::time
     ELSE (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::time >= (c.configuration->>'startsAt')::time
      OR (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::time < (c.configuration->>'endsAt')::time END END
$$;

CREATE FUNCTION umma_private.cafe_combo_quote(p_config jsonb,p_selection jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
DECLARE
 g jsonb; o jsonb; x record; n integer; exclusive_groups text[]:=ARRAY[]::text[];
 components jsonb := p_config->'fixed';
 selected jsonb := '[]'::jsonb;
 reference integer; surcharge integer; extras integer:=0; subtotal integer; available integer; saving integer;
BEGIN
 IF p_config IS NULL OR jsonb_typeof(p_selection) IS DISTINCT FROM 'object'
    OR p_selection-'choices'-'extras'<>'{}'::jsonb
    OR jsonb_typeof(p_selection->'choices') IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_selection->'extras') IS DISTINCT FROM 'object' THEN RETURN NULL; END IF;
 FOR g IN SELECT value FROM jsonb_array_elements(p_config->'groups') LOOP
   SELECT value INTO o FROM jsonb_array_elements(g->'options') WHERE value->>'id'=p_selection->'choices'->>(g->>'id');
   IF o IS NULL THEN RETURN NULL; END IF;
   components:=components||jsonb_build_array(o||jsonb_build_object('kind',g->>'kind'));
 END LOOP;
 IF (SELECT count(*) FROM jsonb_object_keys(p_selection->'choices'))<>jsonb_array_length(p_config->'groups') THEN
   RETURN NULL;
 END IF;
 SELECT coalesce(sum((c->>'priceVnd')::integer),0),coalesce(sum((c->>'surchargeVnd')::integer),0)
 INTO reference,surcharge FROM jsonb_array_elements(components) c;
 subtotal:=CASE WHEN p_config->>'mode'='percent' THEN round((reference-surcharge)*(100-(p_config->>'discount')::numeric)/100)+surcharge
    ELSE (p_config->>'basePriceVnd')::integer+surcharge END;
 IF subtotal<1 OR subtotal>100000000 THEN RETURN NULL; END IF;
 FOR x IN SELECT key,value FROM jsonb_each_text(p_selection->'extras') ORDER BY key LOOP
   SELECT value INTO o FROM jsonb_array_elements(p_config->'extras') WHERE value->>'id'=x.key;
   IF o IS NULL OR coalesce(x.value,'') !~ '^[1-9][0-9]?$' THEN RETURN NULL; END IF;
   n:=x.value::integer;
   IF n>coalesce((o->>'maxQuantity')::integer,1) THEN RETURN NULL; END IF;
   IF nullif(o->>'exclusiveGroup','') IS NOT NULL THEN
     IF n<>1 OR (o->>'exclusiveGroup')=ANY(exclusive_groups) THEN RETURN NULL; END IF;
     exclusive_groups:=array_append(exclusive_groups,o->>'exclusiveGroup');
   END IF;
   extras:=extras+(o->>'surchargeVnd')::integer*n;
   selected:=selected||jsonb_build_array(o||jsonb_build_object('extra',true,'quantity',n,
     'portions',(o->>'portions')::numeric*n,'amount',(o->>'amount')::numeric*n,'pieceCount',(o->>'pieceCount')::integer*n,'weightG',(o->>'weightG')::numeric*n));
 END LOOP;
 IF subtotal+extras>100000000 THEN RETURN NULL; END IF;
 components:=components||selected;
 SELECT least(99,coalesce(min(floor(d.in_stock/d.portions)),0))::integer INTO available FROM (
   SELECT sum((c->>'portions')::numeric) portions,min((c->>'availablePortions')::numeric) in_stock
   FROM jsonb_array_elements(components) c GROUP BY c->>'productId'
 ) d;
 saving:=greatest(0,reference-subtotal);
 RETURN jsonb_build_object('comboComponents',components,'available',available,'price_vnd',subtotal+extras,
  'separatePriceVnd',reference,'savingVnd',saving,'savingPercent',CASE WHEN reference>0 THEN round(saving*100.0/reference,1) ELSE 0 END,
  'comboBaseVnd',subtotal,'extrasVnd',extras);
END $$;

CREATE FUNCTION umma_private.cafe_combo_checkout_price(p_location uuid,p_product uuid,p_regular integer,p_item jsonb)
RETURNS integer LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE config jsonb; quote jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM cafe_combos WHERE product_id=p_product AND configuration IS NOT NULL) THEN
   IF p_item ? 'comboSelection' THEN RAISE EXCEPTION 'INVALID_COMBO_SELECTION'; END IF;
   RETURN p_regular;
 END IF;
 config:=umma_private.cafe_combo_configuration(p_product,p_location);
 quote:=umma_private.cafe_combo_quote(config,p_item->'comboSelection');
 IF quote IS NULL OR p_item->>'planRevision' IS NOT NULL THEN RAISE EXCEPTION 'INVALID_COMBO_SELECTION'; END IF;
 IF (quote->>'available')::integer<(p_item->>'quantity')::integer THEN RAISE EXCEPTION 'READY_STOCK_UNAVAILABLE: combo'; END IF;
 IF p_item->'expectedUnitPriceVnd' IS DISTINCT FROM quote->'price_vnd' THEN RAISE EXCEPTION 'COMBO_PRICE_CHANGED'; END IF;
 RETURN (quote->>'price_vnd')::integer;
END $$;

REVOKE ALL ON FUNCTION umma_private.cafe_combo_option(uuid,jsonb),
 umma_private.cafe_combo_configuration(uuid,uuid), umma_private.cafe_combo_quote(jsonb,jsonb),
 umma_private.cafe_combo_checkout_price(uuid,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION umma_private.cafe_combo_checked_configuration(p_config jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE g jsonb; o jsonb;
BEGIN
 IF jsonb_typeof(p_config) IS DISTINCT FROM 'object'
   OR coalesce(p_config->>'mode','') NOT IN ('fixed','percent')
   OR (p_config->>'mode'='percent' AND (coalesce(p_config->>'discount','') !~ '^[0-9]{1,2}([.][0-9]{1,2})?$'
     OR (p_config->>'discount')::numeric>=100))
   OR jsonb_typeof(p_config->'fixed') IS DISTINCT FROM 'array'
   OR jsonb_typeof(p_config->'groups') IS DISTINCT FROM 'array'
   OR jsonb_typeof(p_config->'extras') IS DISTINCT FROM 'array'
   OR jsonb_array_length(p_config->'groups') NOT BETWEEN 1 AND 12
   OR jsonb_array_length(p_config->'fixed')>30 OR jsonb_array_length(p_config->'extras')>30
   OR (p_config->>'startsAt' IS NULL)<>(p_config->>'endsAt' IS NULL)
   OR (p_config->>'startsAt' IS NOT NULL AND (
     p_config->>'startsAt' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     OR p_config->>'endsAt' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     OR p_config->>'startsAt'=p_config->>'endsAt')) THEN RAISE EXCEPTION 'INVALID_COMBO_CONFIGURATION'; END IF;
 IF (SELECT count(DISTINCT grp.value->>'id') FROM jsonb_array_elements(p_config->'groups') grp)<>jsonb_array_length(p_config->'groups')
   OR (SELECT count(DISTINCT opt.value->>'id') FROM jsonb_array_elements(p_config->'extras') opt)<>jsonb_array_length(p_config->'extras') THEN
   RAISE EXCEPTION 'INVALID_COMBO_CONFIGURATION';
 END IF;
 FOR g IN SELECT value FROM jsonb_array_elements(p_config->'groups') LOOP
   IF coalesce(g->>'id','') !~ '^[a-zA-Z0-9_-]{1,48}$' OR jsonb_typeof(g->'options') IS DISTINCT FROM 'array'
      OR jsonb_array_length(g->'options') NOT BETWEEN 1 AND 24 OR coalesce(g->>'kind','') NOT IN ('drink','sauce','filling','other')
      OR jsonb_array_length(g->'options')<>(SELECT count(DISTINCT opt.value->>'id') FROM jsonb_array_elements(g->'options') opt)
      OR (g ? 'defaultId' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(g->'options') opt WHERE opt.value->>'id'=g->>'defaultId')) THEN
      RAISE EXCEPTION 'INVALID_COMBO_CONFIGURATION';
   END IF;
 END LOOP;
 FOR o IN SELECT value FROM jsonb_array_elements(p_config->'fixed'||p_config->'extras')
   UNION ALL SELECT opt.value FROM jsonb_array_elements(p_config->'groups') grp CROSS JOIN LATERAL jsonb_array_elements(grp->'options') opt
 LOOP
   IF coalesce(o->>'id','') !~ '^[a-zA-Z0-9_-]{1,48}$'
      OR coalesce(o->>'productId','') !~ '^[0-9a-fA-F-]{36}$'
      OR coalesce(o->>'portions','') !~ '^[0-9]{1,2}([.][0-9]{1,3})?$'
      OR (o->>'portions')::numeric NOT BETWEEN .001 AND 20
      OR coalesce(o->>'unit','') NOT IN ('g','ml','pcs')
      OR coalesce(o->>'amount','') !~ '^[0-9]{1,5}([.][0-9]{1,2})?$' OR (o->>'amount')::numeric<=0
      OR (o ? 'referenceVnd' AND coalesce(o->>'referenceVnd','') !~ '^[1-9][0-9]{0,6}$')
      OR coalesce(o->>'surchargeVnd','0') !~ '^[0-9]{1,7}$'
      OR coalesce(o->>'maxQuantity','1') !~ '^[1-9]$'
      OR (o ? 'pieceCount' AND coalesce(o->>'pieceCount','') !~ '^[1-9][0-9]{0,2}$')
      OR coalesce(o->>'exclusiveGroup','') !~ '^[a-zA-Z0-9_-]{0,48}$'
      OR (o ? 'labels' AND (jsonb_typeof(o->'labels')<>'object' OR length((o->'labels')::text)>1800))
      OR NOT EXISTS(SELECT 1 FROM products p WHERE p.id=(o->>'productId')::uuid AND p.product_type='cafe'
        AND p.price_vnd>0 AND NOT p.catalog_preview AND coalesce(p.sku,'') NOT LIKE 'UMMA-COMBO-%') THEN
     RAISE EXCEPTION 'INVALID_COMBO_CONFIGURATION';
   END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_config->'extras') opt WHERE coalesce((opt.value->>'surchargeVnd')::integer,0)<=0) THEN
   RAISE EXCEPTION 'INVALID_COMBO_CONFIGURATION';
 END IF;
 RETURN p_config;
END $$;
REVOKE ALL ON FUNCTION umma_private.cafe_combo_checked_configuration(jsonb) FROM PUBLIC,anon,authenticated;

DO $admin$
DECLARE src text; anchor text;
BEGIN
 SELECT pg_get_functiondef('public.cafe_combo_save(uuid,uuid,jsonb)'::regprocedure) INTO src;
 anchor:='lines jsonb := p_data->''components'';';
 IF strpos(src,anchor)=0 THEN RAISE EXCEPTION 'Unsupported combo administration'; END IF;
 src:=replace(src,anchor,anchor||' config jsonb := p_data->''configuration'';');
 src:=replace(src,'IF jsonb_array_length(lines) NOT BETWEEN 2 AND 20 OR EXISTS (',
    'IF config IS NOT NULL THEN config:=umma_private.cafe_combo_checked_configuration(config); lines:=''[]''::jsonb;
       IF config->''archived''=''true''::jsonb THEN p_data:=p_data||jsonb_build_object(''published'',false); END IF;
     END IF;
     IF (config IS NULL AND jsonb_array_length(lines) NOT BETWEEN 2 AND 20) OR EXISTS (');
 src:=replace(src,'  RETURN combo_id;', '  UPDATE cafe_combos SET configuration=config WHERE product_id=combo_id;
  RETURN combo_id;');
 EXECUTE src;
END $admin$;

-- Existing orders and fixed-composition combos keep the original reservation and settlement paths.
DO $patch$
DECLARE src text; signature text; location_expr text; anchor text;
BEGIN
 SELECT pg_get_functiondef('public.reserve_cafe_inventory_for_order_item()'::regprocedure) INTO src;
 anchor:='v_combo:=umma_private.cafe_combo_offer(NEW.product_id,v_location_id);';
 IF strpos(src,anchor)=0 THEN RAISE EXCEPTION 'Unsupported Cafe combo reservation'; END IF;
 EXECUTE replace(src,anchor,$reservation$
    IF EXISTS(SELECT 1 FROM cafe_combos WHERE product_id=NEW.product_id AND configuration IS NOT NULL) THEN
      v_combo:=umma_private.cafe_combo_quote(umma_private.cafe_combo_configuration(NEW.product_id,v_location_id),NEW.combo_selection);
      NEW.combo_pricing:=v_combo-'comboComponents'-'available';
    ELSE
      v_combo:=umma_private.cafe_combo_offer(NEW.product_id,v_location_id);
    END IF;
$reservation$);

 SELECT pg_get_functiondef('umma_private.cafe_combo_offer(uuid,uuid)'::regprocedure) INTO src;
 anchor:='AND p.price_vnd>0 AND recipe.components IS NOT NULL';
 IF strpos(src,anchor)=0 THEN RAISE EXCEPTION 'Unsupported Cafe combo catalog'; END IF;
 src:=replace(src,anchor,$where$AND p.price_vnd>0 AND
   (CASE WHEN c.configuration IS NULL THEN recipe.components IS NOT NULL
      ELSE umma_private.cafe_combo_configuration(p.id,p_location) IS NOT NULL END)$where$);
 EXECUTE replace(src,$field$'comboComponents', recipe.components,$field$,
   $field$'comboComponents', recipe.components,
    'comboConfiguration',umma_private.cafe_combo_configuration(p.id,p_location),$field$);

 FOR signature,location_expr IN SELECT * FROM (VALUES
   ('public.create_cafe_order(bigint,jsonb,text,uuid,text,text,text,text,text)','v_order.location_id'),
   ('public.create_cafe_staff_order(bigint,uuid,jsonb,text,text,text,text,text,text)','v_order.location_id'),
   ('public.add_cafe_staff_order_items(bigint,uuid,jsonb)','v_order.location_id'),
   ('public.submit_cafe_guest_order_v3(uuid,text,uuid,jsonb,text,text,text,text,text)','p_location_id'),
   ('public.submit_cafe_guest_delivery_v4(uuid,text,uuid,jsonb,text,text,text,text,text,text,double precision,double precision,text)','p_location_id')
 ) f LOOP
   IF to_regprocedure(signature) IS NULL THEN CONTINUE; END IF;
   SELECT pg_get_functiondef(to_regprocedure(signature)) INTO src;
   anchor:='insert into public.cafe_order_items';
   IF strpos(src,anchor)=0 OR strpos(src,'v_product.price_vnd')=0 THEN RAISE EXCEPTION 'Unsupported Cafe checkout: %',signature; END IF;
   src:=replace(src,anchor,'v_product.price_vnd:=umma_private.cafe_combo_checkout_price('||location_expr||
     ',v_product.id,v_product.price_vnd,v_item);'||E'\n   '||anchor);
   src:=regexp_replace(src,'quantity,\s*unit_price_vnd','quantity, combo_selection, unit_price_vnd','g');
   src:=regexp_replace(src,'(v_quantity|v_qty),\s*v_product\.price_vnd','\1,v_item->''comboSelection'',v_product.price_vnd','g');
   src:=replace(src,$old$count(distinct value->>'productId')$old$,
      $new$count(distinct (value->>'productId',value->'comboSelection'))$new$);
   EXECUTE src;
 END LOOP;

 SELECT pg_get_functiondef('umma_private.cafe_combo_snapshot_guard()'::regprocedure) INTO src;
 anchor:='NEW.combo_components IS DISTINCT FROM OLD.combo_components';
 IF strpos(src,anchor)=0 THEN RAISE EXCEPTION 'Unsupported Cafe snapshot guard'; END IF;
 EXECUTE replace(src,anchor,anchor||' OR NEW.combo_selection IS DISTINCT FROM OLD.combo_selection OR NEW.combo_pricing IS DISTINCT FROM OLD.combo_pricing');
END $patch$;

DROP TRIGGER cafe_combo_snapshot_guard ON public.cafe_order_items;
CREATE TRIGGER cafe_combo_snapshot_guard BEFORE UPDATE OF combo_components,combo_selection,combo_pricing ON public.cafe_order_items
FOR EACH ROW EXECUTE FUNCTION umma_private.cafe_combo_snapshot_guard();

CREATE FUNCTION umma_private.cafe_combo_paid_cost(p_order uuid,p_product uuid,p_portions numeric)
RETURNS numeric LANGUAGE plpgsql STABLE SET search_path=pg_catalog,pg_temp AS $$
DECLARE result numeric;
BEGIN
 IF to_regclass('umma_private.owner_ready_cost') IS NULL THEN RETURN NULL; END IF;
 SELECT CASE WHEN sum(quantity)=p_portions THEN sum(quantity*unit_cost)/p_portions END INTO result
 FROM umma_private.owner_ready_cost WHERE order_id=p_order AND product_id=p_product
   AND event_type='sale' AND unit_cost IS NOT NULL;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION umma_private.cafe_combo_paid_cost(uuid,uuid,numeric) FROM PUBLIC,anon,authenticated;

-- Limit access to the server. The storefront checks the manager's role and location.
CREATE FUNCTION public.cafe_combo_analytics(p_location uuid,p_days integer)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 WITH eligible AS (
   SELECT o.id,o.total_vnd FROM cafe_orders o
   WHERE o.location_id=p_location AND o.payment_status='paid' AND o.status='completed'
     AND o.created_at>=now()-make_interval(days=>greatest(1,least(90,p_days)))
 ), sold AS (
   SELECT oi.* FROM eligible e JOIN cafe_order_items oi ON oi.order_id=e.id
   WHERE oi.combo_components IS NOT NULL
 ), order_demand AS (
   SELECT oi.order_id,d.product_id,sum(d.portions*oi.quantity) portions
   FROM (SELECT DISTINCT order_id FROM sold) combo_orders
   JOIN cafe_order_items oi ON oi.order_id=combo_orders.order_id
   CROSS JOIN LATERAL (
     SELECT oi.product_id,1::numeric AS portions WHERE oi.combo_components IS NULL
     UNION ALL
     SELECT c."productId",c.portions FROM jsonb_to_recordset(oi.combo_components) c("productId" uuid,portions numeric)
   ) d GROUP BY oi.order_id,d.product_id
 ), valued AS (
   SELECT d.order_id,d.product_id,umma_private.cafe_combo_paid_cost(d.order_id,d.product_id,d.portions) AS unit_cost
   FROM order_demand d
 ), selection AS (
   SELECT s.id,s.product_id,s.quantity*coalesce(part.quantity,1) AS units,part.*
   FROM sold s CROSS JOIN LATERAL jsonb_to_recordset(s.combo_components)
     part("productId" uuid, name_ru text, unit text, amount numeric, kind text, extra boolean, quantity integer)
   WHERE part.kind IS NOT NULL OR part.extra
 ), line_cost AS (
   SELECT s.id,CASE WHEN bool_and(v.unit_cost IS NOT NULL) THEN sum(v.unit_cost*c.portions*s.quantity) END AS cost
   FROM sold s CROSS JOIN LATERAL jsonb_to_recordset(s.combo_components) c("productId" uuid,portions numeric)
   LEFT JOIN valued v ON v.order_id=s.order_id AND v.product_id=c."productId" GROUP BY s.id
 ), by_combo AS (
   SELECT s.product_id,max(s.product_name_ru) AS name,sum(s.quantity) AS units,sum(s.line_total_vnd) AS revenue,
     CASE WHEN count(s.combo_pricing)=count(*) THEN sum((s.combo_pricing->>'savingVnd')::numeric*s.quantity) END AS savings,
     CASE WHEN count(cost.cost)=count(*) THEN round(sum(cost.cost)) END AS cost
   FROM sold s LEFT JOIN line_cost cost ON cost.id=s.id GROUP BY s.product_id
 ), by_option AS (
   SELECT product_id,"productId" AS dish,max(name_ru) AS name,kind,unit,amount,coalesce(extra,false) AS extra,sum(units) AS sets
   FROM selection GROUP BY product_id,"productId",kind,unit,amount,coalesce(extra,false)
 ), checks AS (
   SELECT round(avg(total_vnd) FILTER (WHERE includes_combo)) AS with_combo,
      round(avg(total_vnd) FILTER (WHERE NOT includes_combo)) AS without_combo
   FROM (SELECT e.total_vnd,EXISTS(SELECT 1 FROM sold s WHERE s.order_id=e.id) AS includes_combo FROM eligible e) checks
 )
 SELECT jsonb_build_object('withCombo',checks.with_combo,'withoutCombo',checks.without_combo,
   'combos',coalesce((SELECT jsonb_agg(to_jsonb(c)||jsonb_build_object('profit',c.revenue-c.cost) ORDER BY c.units DESC,c.name)
      FROM by_combo c),'[]'::jsonb),
   'options',coalesce((SELECT jsonb_agg(to_jsonb(o) ORDER BY o.sets DESC,o.name) FROM by_option o),'[]'::jsonb))
 FROM checks
$$;

REVOKE ALL ON FUNCTION public.cafe_combo_analytics(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cafe_combo_analytics(uuid,integer) TO service_role;

DO $storage$
BEGIN
 IF to_regclass('storage.buckets') IS NOT NULL THEN
   INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
   VALUES('cafe-combo-photos','cafe-combo-photos',true,2097152,ARRAY['image/jpeg','image/png','image/webp'])
   ON CONFLICT(id) DO NOTHING;
 END IF;
END $storage$;

-- Drafts use the actual catalogue SKUs. Pending items can be linked by a manager once
-- they exist in the menu. This never creates stand-alone items or publishes prices.
DO $drafts$
DECLARE
 loc constant uuid:='e22788bd-4734-4b3a-911e-ba103d52617a';
 draft record;
 components jsonb;
 options jsonb;
 drinks jsonb;
 sauces jsonb;
 fillings jsonb;
 extras jsonb;
 suggestions jsonb;
 metadata jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.locations WHERE id=loc AND is_active AND ready_stock_enabled) THEN RETURN; END IF;
 CREATE TEMP TABLE combo_draft_options ON COMMIT DROP AS
 SELECT v.id,jsonb_strip_nulls(jsonb_build_object(
   'id',v.id,'productId',p.id,'portions',v.portions,'unit',v.unit,'amount',v.amount,
   'referenceVnd',v.reference,'surchargeVnd',v.surcharge)) AS option
 FROM (VALUES
   ('plov','UMMA-CAFE-PLOV',.333,'g',150,60000,0),
   ('manti','UMMA-CAFE-MANTI',.500,'g',200,75000,0),
   ('bread','UMMA-CAFE-FLATBREAD',.455,'g',100,15000,0),
   ('shurpa','UMMA-CAFE-SHURPA',1,'g',650,90000,0),
   ('wings','UMMA-CAFE-GRILLED-CHICKEN-WINGS',.500,'pcs',4,60000,0),
   ('ayran-300','UMMA-CAFE-AYRAN',1,'ml',300,NULL,0),
   ('ayran-500','UMMA-CAFE-AYRAN-500',1,'ml',500,NULL,10000),
   ('compote-500','UMMA-CAFE-BLACKBERRY-COMPOTE-500',1,'ml',500,NULL,10000),
   ('adjika','UMMA-CAFE-ADJIKA',1,'pcs',1,NULL,0),
   ('chicken','UMMA-CAFE-SAMSA-CHICKEN',1,'pcs',1,NULL,0),
   ('lamb','UMMA-CAFE-SAMSA',1,'pcs',1,NULL,10000),
   ('extra-manti','UMMA-CAFE-MANTI',.250,'g',100,NULL,37500),
   ('extra-bread-100','UMMA-CAFE-FLATBREAD',.455,'g',100,NULL,15000),
   ('extra-bread-220','UMMA-CAFE-FLATBREAD',1,'g',220,NULL,25000),
   ('extra-salad','UMMA-CAFE-SALAD',1,'g',200,NULL,50000),
   ('extra-adjika','UMMA-CAFE-ADJIKA',1,'pcs',1,NULL,10000),
   ('extra-ayran-300','UMMA-CAFE-AYRAN',1,'ml',300,NULL,30000),
   ('extra-ayran-500','UMMA-CAFE-AYRAN-500',1,'ml',500,NULL,40000),
   ('extra-compote-500','UMMA-CAFE-BLACKBERRY-COMPOTE-500',1,'ml',500,NULL,40000)
 ) v(id,sku,portions,unit,amount,reference,surcharge)
 JOIN public.products p ON p.sku=v.sku AND p.is_active AND p.product_type='cafe' AND NOT p.catalog_preview AND p.price_vnd>0;

 UPDATE combo_draft_options SET option=option||jsonb_build_object('labels',jsonb_build_object(
    'ru','Плов с квашеным салатом','en','Plov with fermented salad','vi','Cơm plov với rau củ muối chua')) WHERE id='plov';
 UPDATE combo_draft_options SET option=option||jsonb_build_object('pieceCount',CASE WHEN id='manti' THEN 2 ELSE 1 END,
    'labels',jsonb_build_object('ru','Манты','en','Manti','vi','Bánh hấp manti')) WHERE id IN ('manti','extra-manti');
 UPDATE combo_draft_options SET option=option||jsonb_build_object('exclusiveGroup','extra-sauce') WHERE id='extra-adjika';

 SELECT jsonb_agg(option ORDER BY id) INTO drinks FROM combo_draft_options WHERE id IN ('ayran-300','ayran-500','compote-500');
 SELECT jsonb_agg(option) INTO sauces FROM combo_draft_options WHERE id='adjika';
 SELECT jsonb_agg(option ORDER BY id) INTO fillings FROM combo_draft_options WHERE id IN ('chicken','lamb');
 IF drinks IS NULL OR sauces IS NULL OR fillings IS NULL THEN RETURN; END IF;
 FOR draft IN SELECT * FROM (VALUES
  (1,'Классическое','Classic','Truyền thống',170000,ARRAY['plov','manti','bread'],ARRAY['plov','manti'],true,false,
   ARRAY['클래식','经典','Klassisch','Classique','คลาสสิก','Klasik','Klasik','كلاسيكي','Clássico']),
  (2,'Полноценный обед','Full lunch','Bữa trưa đầy đủ',180000,ARRAY['shurpa','plov','bread'],ARRAY['shurpa','plov'],false,false,
   ARRAY['든든한 점심','丰盛午餐','Komplettes Mittagessen','Déjeuner complet','มื้อกลางวันครบชุด','Makan tengah hari lengkap','Makan siang lengkap','غداء متكامل','Almoço completo']),
  (3,'Быстрый перекус','Quick bite','Bữa ăn nhẹ',99000,ARRAY[]::text[],ARRAY['chicken','lamb'],false,true,
   ARRAY['간단한 간식','快捷小食','Schneller Imbiss','En-cas rapide','ของว่างจานด่วน','Snek ringkas','Camilan cepat','وجبة خفيفة سريعة','Lanche rápido']),
  (4,'Крылышки на мангале','Charcoal-grilled wings','Cánh gà nướng than',175000,ARRAY['wings','plov','bread'],ARRAY['wings'],true,false,
   ARRAY['숯불 닭날개','炭烤鸡翅','Holzkohle-Hähnchenflügel','Ailes grillées au charbon','ปีกไก่ย่างถ่าน','Kepak panggang arang','Sayap bakar arang','أجنحة دجاج على الفحم','Asas grelhadas no carvão'])
 ) v(number,ru,en,vi,price,fixed,related,with_sauce,with_filling,translations)
 LOOP
  IF EXISTS(SELECT 1 FROM public.cafe_combos c
    WHERE c.location_id=loc AND c.configuration->>'draftNumber'=draft.number::text) THEN CONTINUE; END IF;
  SELECT coalesce(jsonb_agg(option ORDER BY array_position(draft.fixed,id)),'[]'::jsonb) INTO components
    FROM combo_draft_options WHERE id=ANY(draft.fixed);
  IF jsonb_array_length(components)<>cardinality(draft.fixed) THEN CONTINUE; END IF;
  options:=jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('id','drink','kind','drink',
    'options',drinks,'defaultId',(SELECT id FROM combo_draft_options WHERE id='ayran-300'))));
  IF draft.with_sauce THEN options:=options||jsonb_build_array(jsonb_build_object('id','sauce','kind','sauce','options',sauces,'defaultId','adjika')); END IF;
  IF draft.with_filling THEN options:=jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('id','filling','kind','filling',
    'options',fillings,'defaultId',(SELECT id FROM combo_draft_options WHERE id='chicken'))))||options; END IF;
  SELECT coalesce(jsonb_agg(option ORDER BY id),'[]'::jsonb) INTO extras FROM combo_draft_options
    WHERE id LIKE 'extra-%' AND (id<>'extra-adjika' OR draft.with_sauce);
  SELECT coalesce(jsonb_agg(option->'productId'),'[]'::jsonb) INTO suggestions FROM combo_draft_options WHERE id=ANY(draft.related);
  SELECT jsonb_object_agg('name_'||v.lang,'COMBO №'||draft.number||' — '||v.title)
    INTO metadata FROM unnest(ARRAY['ko','zh','de','fr','th','ms','id','ar','pt'],draft.translations) v(lang,title);
  PERFORM public.cafe_combo_save(loc,NULL,jsonb_build_object(
    'nameRu','COMBO №'||draft.number||' — '||draft.ru,
    'nameEn','COMBO №'||draft.number||' — '||draft.en,
    'nameVi','COMBO №'||draft.number||' — '||draft.vi,
    'price',draft.price,'persons',1,'imageUrl',NULL,'published',false,'components','[]'::jsonb,
    'configuration',jsonb_build_object('draftNumber',draft.number,'mode','fixed','discount',10,'position',draft.number,
     'fixed',components,'groups',options,'extras',extras,'recommendations',suggestions)||metadata));
 END LOOP;
END $drafts$;

COMMIT;
