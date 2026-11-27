BEGIN;

CREATE TABLE public.cafe_web_section_visibility (
  location_id uuid NOT NULL REFERENCES public.locations(id),
  section text NOT NULL CHECK (section IN ('breakfast','lunch','dinner','daily','family','dish-day','cooking')),
  enabled boolean NOT NULL,
  PRIMARY KEY (location_id, section)
);

CREATE TABLE public.cafe_combos (
  product_id uuid PRIMARY KEY REFERENCES public.products(id),
  location_id uuid NOT NULL REFERENCES public.locations(id),
  persons integer CHECK (persons BETWEEN 1 AND 99)
);

CREATE TABLE public.cafe_combo_components (
  combo_id uuid NOT NULL REFERENCES public.cafe_combos(product_id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  portions numeric(7,3) NOT NULL CHECK (portions BETWEEN 0.001 AND 20),
  weight_g numeric(8,2) NOT NULL CHECK (weight_g > 0),
  PRIMARY KEY (combo_id, product_id),
  CHECK (combo_id <> product_id)
);

ALTER TABLE public.cafe_web_section_visibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cafe_combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cafe_combo_components ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cafe_web_section_visibility, public.cafe_combos, public.cafe_combo_components FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.cafe_web_section_visibility TO service_role;
GRANT SELECT ON public.cafe_combos, public.cafe_combo_components TO service_role;

ALTER TABLE public.cafe_order_items ADD COLUMN combo_components jsonb;

-- The authenticated storefront endpoint checks the manager's location before calling this RPC.
CREATE FUNCTION public.cafe_combo_save(p_location uuid, p_combo uuid, p_data jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  combo_id uuid := coalesce(p_combo, gen_random_uuid());
  lines jsonb := p_data->'components';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM locations WHERE id=p_location AND is_active AND ready_stock_enabled)
     OR jsonb_typeof(lines) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'INVALID_COMBO';
  END IF;
  IF jsonb_array_length(lines) NOT BETWEEN 2 AND 20 OR EXISTS (
    SELECT 1 FROM jsonb_to_recordset(lines) AS c("productId" uuid, portions numeric, "weightG" numeric)
    LEFT JOIN products p ON p.id=c."productId"
    WHERE p.id IS NULL OR p.product_type<>'cafe' OR p.catalog_preview OR p.price_vnd<=0
      OR p.sku LIKE 'UMMA-COMBO-%'
      OR c.portions IS NULL OR c.portions NOT BETWEEN 0.001 AND 20 OR c.portions<>round(c.portions,3)
      OR c."weightG" IS NULL OR c."weightG" NOT BETWEEN 0.01 AND 99999 OR c."weightG"<>round(c."weightG",2)
  ) OR jsonb_array_length(lines)<>(
    SELECT count(DISTINCT value->>'productId') FROM jsonb_array_elements(lines)
  ) THEN
    RAISE EXCEPTION 'INVALID_COMBO_COMPONENTS';
  END IF;

  IF p_combo IS NOT NULL THEN
    UPDATE products p SET name_ru=p_data->>'nameRu', name_en=p_data->>'nameEn', name_vi=p_data->>'nameVi',
      image_url=p_data->>'imageUrl', price_vnd=(p_data->>'price')::integer,
      is_active=(p_data->>'published')::boolean, updated_at=now()
    WHERE p.id=p_combo AND EXISTS (SELECT 1 FROM cafe_combos c WHERE c.product_id=p.id AND c.location_id=p_location);
    IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_COMBO'; END IF;
    UPDATE cafe_combos c SET persons=(p_data->>'persons')::integer WHERE c.product_id=p_combo;
    DELETE FROM cafe_combo_components c WHERE c.combo_id=p_combo;
  ELSE
    INSERT INTO products(id, sku, product_type, name_ru, name_en, name_vi, image_url, price_vnd, is_active)
    VALUES(combo_id, 'UMMA-COMBO-'||combo_id, 'cafe', p_data->>'nameRu', p_data->>'nameEn', p_data->>'nameVi',
      p_data->>'imageUrl', (p_data->>'price')::integer, (p_data->>'published')::boolean);
    INSERT INTO cafe_combos(product_id,location_id,persons)
    VALUES(combo_id,p_location,(p_data->>'persons')::integer);
  END IF;
  INSERT INTO cafe_combo_components(combo_id,product_id,portions,weight_g)
  SELECT combo_id,c."productId",c.portions,c."weightG"
  FROM jsonb_to_recordset(lines) AS c("productId" uuid, portions numeric, "weightG" numeric);
  RETURN combo_id;
END $$;
REVOKE ALL ON FUNCTION public.cafe_combo_save(uuid,uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cafe_combo_save(uuid,uuid,jsonb) TO service_role;

CREATE FUNCTION umma_private.cafe_combo_offer(p_combo uuid, p_location uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT jsonb_build_object(
    'id', p.id, 'sku', p.sku, 'name_ru', p.name_ru, 'name_en', p.name_en, 'name_vi', p.name_vi,
    'price_vnd', p.price_vnd, 'image_url', p.image_url, 'persons', c.persons,
    'weight_value', recipe.weight_g, 'weight_unit', 'g', 'stockManaged', true,
    'available', CASE WHEN l.ready_stock_enabled THEN least(99,recipe.available) ELSE 0 END,
    'comboComponents', recipe.components, 'separatePriceVnd', recipe.separate_price,
    'savingVnd', greatest(0, recipe.separate_price-p.price_vnd)
  )
  FROM cafe_combos c
  JOIN products p ON p.id=c.product_id
  JOIN locations l ON l.id=c.location_id
  CROSS JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object('productId',d.id,'name_ru',d.name_ru,'name_en',d.name_en,'name_vi',d.name_vi,
        'portions',line.portions,'weightG',line.weight_g,'priceVnd',round(d.price_vnd*line.portions),
        'availablePortions',stock.available) ORDER BY d.sort_order,d.name_ru,d.id) AS components,
      sum(line.weight_g) AS weight_g, sum(round(d.price_vnd*line.portions)) AS separate_price,
      min(floor(stock.available/line.portions)) AS available
    FROM cafe_combo_components line
    JOIN products d ON d.id=line.product_id
    LEFT JOIN inventory i ON i.location_id=c.location_id AND i.product_id=d.id
    CROSS JOIN LATERAL (
      SELECT CASE WHEN d.is_active AND NOT d.catalog_preview AND d.price_vnd>0
        AND i.ready_stock_confirmed AND i.is_available AND i.ready_stock_state='ready'
        THEN greatest(0,i.quantity-i.reserved_quantity) ELSE 0 END AS available
    ) stock
    WHERE line.combo_id=c.product_id
  ) recipe
  WHERE c.product_id=p_combo AND c.location_id=p_location AND p.is_active AND NOT p.catalog_preview
    AND p.price_vnd>0 AND recipe.components IS NOT NULL
$$;
REVOKE ALL ON FUNCTION umma_private.cafe_combo_offer(uuid,uuid) FROM PUBLIC, anon, authenticated;

-- Patch the existing entry points while retaining payment, future-batch and legacy inventory behavior.
DO $patch$
DECLARE
  src text;
  anchor text := '  IF (SELECT ready_stock_enabled FROM public.locations WHERE id=v_location_id) THEN';
BEGIN
  SELECT pg_get_functiondef('public.reserve_cafe_inventory_for_order_item()'::regprocedure) INTO src;
  IF strpos(src,anchor)=0 THEN RAISE EXCEPTION 'Unsupported Cafe reservation function'; END IF;
  src:=replace(src,'  v_location_id uuid;', '  v_location_id uuid; v_combo jsonb; v_component record; v_portions numeric;');
  EXECUTE replace(src,anchor,$combo$
  IF v_product.sku LIKE 'UMMA-COMBO-%' THEN
    PERFORM 1 FROM cafe_orders WHERE id=NEW.order_id AND status NOT IN ('completed','cancelled') FOR UPDATE;
    IF NOT FOUND OR NEW.quantity<=0 OR NEW.preorder_batch_revision IS NOT NULL THEN
      RAISE EXCEPTION 'READY_STOCK_UNAVAILABLE: combo';
    END IF;
    PERFORM 1 FROM products WHERE id=NEW.product_id FOR SHARE;
    v_combo:=umma_private.cafe_combo_offer(NEW.product_id,v_location_id);
    IF v_combo IS NULL OR (v_combo->>'available')::numeric<NEW.quantity
       OR (v_combo->>'price_vnd')::integer IS DISTINCT FROM NEW.unit_price_vnd THEN
      RAISE EXCEPTION 'READY_STOCK_UNAVAILABLE: %',v_product.name_ru;
    END IF;
    FOR v_component IN SELECT * FROM jsonb_to_recordset(v_combo->'comboComponents')
      AS c("productId" uuid, portions numeric, name_ru text) ORDER BY c."productId"
    LOOP
      v_portions:=v_component.portions*NEW.quantity;
      UPDATE inventory SET reserved_quantity=reserved_quantity+v_portions, updated_at=now()
      WHERE location_id=v_location_id AND product_id=v_component."productId" AND ready_stock_confirmed
        AND ready_stock_state='ready' AND is_available AND quantity-reserved_quantity>=v_portions;
      IF NOT FOUND THEN RAISE EXCEPTION 'READY_STOCK_UNAVAILABLE: %',v_component.name_ru; END IF;
      INSERT INTO cafe_inventory_movements(location_id,product_id,order_id,movement_type,quantity,note)
      VALUES(v_location_id,v_component."productId",NEW.order_id,'reserved',v_portions,'Комбо');
    END LOOP;
    NEW.combo_components:=v_combo->'comboComponents';
    NEW.ready_stock_state:='reserved';
    NEW.accounting_stock_item_id:=NULL;
    UPDATE cafe_orders SET stock_reserved_until=coalesce(stock_reserved_until,now()+interval '15 minutes')
    WHERE id=NEW.order_id AND status='pending' AND payment_status='pending' AND accepted_by_telegram_id IS NULL;
    RETURN NEW;
  END IF;
$combo$||anchor);

  SELECT pg_get_functiondef('public.cafe_ready_catalog(uuid)'::regprocedure) INTO src;
  anchor:=' RETURN jsonb_build_object(''ok'',true';
  IF strpos(src,anchor)=0 OR strpos(src,'greatest(0,i.quantity-i.reserved_quantity)::int')=0 THEN
    RAISE EXCEPTION 'Unsupported Cafe catalog function';
  END IF;
  src:=replace(src,'greatest(0,i.quantity-i.reserved_quantity)::int','floor(greatest(0,i.quantity-i.reserved_quantity))::int');
  EXECUTE replace(src,anchor,$catalog$
  SELECT coalesce(jsonb_agg(row ORDER BY position NULLS LAST, row->>'name_ru', row->>'id'),'[]'::jsonb)
  INTO result FROM (
    SELECT value AS row, position FROM jsonb_array_elements(result) WITH ORDINALITY AS existing(value,position)
    WHERE NOT EXISTS (SELECT 1 FROM cafe_combos c WHERE c.product_id=(value->>'id')::uuid)
    UNION ALL
    SELECT offer.row, NULL FROM cafe_combos c
    CROSS JOIN LATERAL (SELECT umma_private.cafe_combo_offer(c.product_id,p_location) AS row) offer
    WHERE c.location_id=p_location AND offer.row IS NOT NULL
  ) catalog;
$catalog$||anchor);

  SELECT pg_get_functiondef('public.cafe_ready_list(bigint,uuid)'::regprocedure) INTO src;
  anchor:='p.product_type=''cafe'' AND p.is_active';
  IF strpos(src,anchor)=0 THEN RAISE EXCEPTION 'Unsupported Cafe stock list function'; END IF;
  EXECUTE replace(src,anchor,anchor||' AND NOT EXISTS (SELECT 1 FROM cafe_combos c WHERE c.product_id=p.id)');

  SELECT pg_get_functiondef('public.cafe_ready_adjust(bigint,uuid,uuid,text,jsonb)'::regprocedure) INTO src;
  anchor:='qty int; result jsonb;';
  IF strpos(src,anchor)=0 OR strpos(src,'qty:=(item->>''quantity'')::int;')=0 THEN
    RAISE EXCEPTION 'Unsupported Cafe stock adjustment function';
  END IF;
  src:=replace(src,anchor,'qty numeric; result jsonb;');
  anchor:=$old$IF coalesce(item->>'quantity','')!~ '^[0-9]{1,5}$' THEN RAISE EXCEPTION 'Укажите целое количество от 0 до 99999'; END IF;qty:=(item->>'quantity')::int;$old$;
  IF strpos(src,anchor)=0 THEN RAISE EXCEPTION 'Unsupported Cafe stock quantity validation'; END IF;
  EXECUTE replace(src,anchor,$new$
   IF (p_mode='add' AND coalesce(item->>'quantity','')!~ '^[0-9]{1,5}$')
      OR (p_mode='set' AND coalesce(item->>'quantity','')!~ '^[0-9]{1,5}([.][0-9]{1,3})?$') THEN
     RAISE EXCEPTION 'Проверьте количество порций';
   END IF;
   qty:=(item->>'quantity')::numeric;
$new$);

END $patch$;

CREATE OR REPLACE FUNCTION public.cafe_ready_settle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE item record; consume boolean;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status NOT IN ('completed','cancelled') THEN RETURN NEW; END IF;
  consume:=NEW.status='completed' OR OLD.delivery_status IN ('picked_up','delivered');
  FOR item IN
    SELECT demand.product_id, demand.portions AS quantity
    FROM cafe_order_items line
    CROSS JOIN LATERAL (
      SELECT line.product_id, line.quantity::numeric AS portions WHERE line.combo_components IS NULL
      UNION ALL
      SELECT c."productId", c.portions * line.quantity
      FROM jsonb_to_recordset(line.combo_components) AS c("productId" uuid, portions numeric)
    ) demand
    WHERE line.order_id=NEW.id AND line.ready_stock_state='reserved'
    ORDER BY demand.product_id, line.id
  LOOP
    UPDATE inventory SET reserved_quantity=reserved_quantity-item.quantity,
      quantity=quantity-CASE WHEN consume THEN item.quantity ELSE 0 END, updated_at=now()
    WHERE product_id=item.product_id AND location_id=NEW.location_id
      AND reserved_quantity>=item.quantity AND quantity>=item.quantity;
    IF NOT FOUND THEN RAISE EXCEPTION 'Ready stock reservation mismatch'; END IF;
    INSERT INTO cafe_inventory_movements(location_id,product_id,order_id,movement_type,quantity,note)
    VALUES(NEW.location_id,item.product_id,NEW.id,CASE WHEN consume THEN 'sold' ELSE 'released' END,
      item.quantity,'Готовые порции: завершение заказа');
  END LOOP;
  UPDATE cafe_order_items SET ready_stock_state=CASE WHEN consume THEN 'sold' ELSE 'released' END
  WHERE order_id=NEW.id AND ready_stock_state='reserved';
  RETURN NEW;
END $$;

CREATE FUNCTION umma_private.cafe_combo_snapshot_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  IF NEW.combo_components IS DISTINCT FROM OLD.combo_components THEN
    RAISE EXCEPTION 'Order combo composition cannot be edited';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION umma_private.cafe_combo_snapshot_guard() FROM PUBLIC, anon, authenticated;
DO $owner$
DECLARE src text; anchor text;
BEGIN
  IF to_regprocedure('umma_private.owner_change(uuid,public.stock_items,text,numeric,numeric,numeric,text,uuid,bigint,text)') IS NULL
    THEN RETURN;
  END IF;
  SELECT pg_get_functiondef('umma_private.owner_quantity(text,text,text,boolean)'::regprocedure) INTO src;
  anchor:='p_base in (''pcs'',''portion'')';
  IF strpos(src,anchor)=0 THEN RAISE EXCEPTION 'Unsupported owner quantity function'; END IF;
  EXECUTE replace(src,anchor,'p_base=''pcs''');

  SELECT pg_get_functiondef('umma_private.owner_change(uuid,public.stock_items,text,numeric,numeric,numeric,text,uuid,bigint,text)'::regprocedure) INTO src;
  anchor:='if qty<>trunc(qty) then raise exception ''Для меню укажите целые порции''; end if;';
  IF strpos(src,anchor)=0 THEN RAISE EXCEPTION 'Unsupported owner stock function'; END IF;
  EXECUTE replace(src,anchor,'if qty<>round(qty,3) then raise exception ''Проверьте точность количества порций''; end if;');

  SELECT pg_get_functiondef('public.cafe_owner_dashboard(bigint,uuid,integer)'::regprocedure) INTO src;
  anchor:=$old$    ), priced as (
      select l.*,v.qty valued_qty,v.cost from lines l left join lateral ($old$;
  IF strpos(src,anchor)=0 THEN RAISE EXCEPTION 'Unsupported owner sale cost function'; END IF;
  src:=replace(src,anchor,$new$    ), component_demand as (
      select oi.order_id,oi.product_id,d.product_id component_id,sum(d.quantity) quantity
      from eligible e join public.cafe_order_items oi on oi.order_id=e.id
      cross join lateral (
        select oi.product_id,oi.quantity::numeric quantity where oi.combo_components is null
        union all
        select c."productId",c.portions*oi.quantity
        from jsonb_to_recordset(oi.combo_components) c("productId" uuid,portions numeric)
      ) d
      where exists(select 1 from public.cafe_order_items c where c.order_id=oi.order_id and c.combo_components is not null)
      group by oi.order_id,oi.product_id,d.product_id
    ), component_totals as (
      select order_id,component_id,sum(quantity) quantity
      from component_demand group by order_id,component_id
    ), combo_order_cost as (
      select d.order_id,d.product_id,bool_and(coalesce(c.quantity=t.quantity,false)) fully_valued,
        sum(d.quantity*c.cost/nullif(t.quantity,0)) cost
      from component_demand d join component_totals t using(order_id,component_id)
      left join lateral (
        select sum(quantity) quantity,sum(quantity*unit_cost) cost from umma_private.owner_ready_cost c
        where c.order_id=d.order_id and c.product_id=d.component_id and c.event_type='sale' and c.unit_cost is not null
      ) c on true
      group by d.order_id,d.product_id
    ), priced as (
      select l.*,case when k.order_id is null then v.qty when k.fully_valued then l.qty end valued_qty,
        case when k.order_id is null then v.cost else k.cost end cost
      from lines l left join combo_order_cost k using(order_id,product_id) left join lateral ($new$);
  EXECUTE src;

END $owner$;

CREATE TRIGGER cafe_combo_snapshot_guard BEFORE UPDATE OF combo_components ON public.cafe_order_items
FOR EACH ROW EXECUTE FUNCTION umma_private.cafe_combo_snapshot_guard();

COMMIT;
