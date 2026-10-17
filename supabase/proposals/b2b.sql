-- UMMA B2B: business supply enquiries, with no retail prices, stock reservations or payments.
BEGIN;
CREATE TABLE public.b2b_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 customer_telegram_id bigint NOT NULL REFERENCES public.telegram_users(telegram_id),
 warehouse_id uuid NOT NULL REFERENCES public.market_warehouses(id),
 company_name text NOT NULL CHECK(length(trim(company_name)) BETWEEN 2 AND 160),
 business_type text NOT NULL CHECK(business_type IN ('cafe','restaurant','hotel','shop','business')),
 contact_name text NOT NULL CHECK(length(trim(contact_name)) BETWEEN 1 AND 120),
 contact_phone text NOT NULL CHECK(length(trim(contact_phone)) BETWEEN 5 AND 80),
 city text NOT NULL CHECK(length(trim(city)) BETWEEN 2 AND 120),
 fulfillment text NOT NULL CHECK(fulfillment IN ('pickup','delivery')),
 address text NOT NULL DEFAULT '' CHECK(length(address)<=500 AND (fulfillment='pickup' OR length(trim(address))>=5)),
 frequency text NOT NULL CHECK(frequency IN ('once','weekly','regular')),
 items jsonb NOT NULL CHECK(jsonb_typeof(items)='array' AND jsonb_array_length(items)<=50),
 other_needs text NOT NULL DEFAULT '' CHECK(length(other_needs)<=2000),
 comment text NOT NULL DEFAULT '' CHECK(length(comment)<=2000),
 status text NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','in_review','quoted','closed','cancelled')),
 manager_reply text NOT NULL DEFAULT '' CHECK(length(manager_reply)<=4000),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 updated_by bigint REFERENCES public.telegram_users(telegram_id),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(jsonb_array_length(items)>0 OR length(trim(other_needs))>=3)
);
CREATE INDEX b2b_requests_customer ON public.b2b_requests(customer_telegram_id,created_at DESC,id DESC);
CREATE INDEX b2b_requests_warehouse ON public.b2b_requests(warehouse_id,created_at DESC,id DESC);
CREATE INDEX b2b_requests_updated_by ON public.b2b_requests(updated_by);
CREATE TABLE public.b2b_operations (
 actor_telegram_id bigint NOT NULL REFERENCES public.telegram_users(telegram_id),request_id uuid NOT NULL,
 action text NOT NULL,payload jsonb NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor_telegram_id,request_id)
);
ALTER TABLE public.b2b_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.b2b_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.b2b_requests,public.b2b_operations FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.b2b_requests,public.b2b_operations FROM service_role;
GRANT SELECT,INSERT,UPDATE ON public.b2b_requests TO service_role;
GRANT SELECT,INSERT ON public.b2b_operations TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.b2b_requests_request_number_seq TO service_role;

CREATE FUNCTION public.b2b_can_manage(p_actor bigint,p_warehouse uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.telegram_users u JOIN public.market_warehouses w ON w.id=p_warehouse
 WHERE u.telegram_id=p_actor AND u.is_active AND (u.role='super_admin' OR EXISTS(
 SELECT 1 FROM public.market_staff_roles r WHERE r.telegram_id=u.telegram_id AND r.location_id=w.location_id AND r.role='admin' AND r.is_active)));
$$;
CREATE FUNCTION public.b2b_catalog() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object('ok',true,
 'warehouses',coalesce((SELECT jsonb_agg(jsonb_build_object('id',w.id,'name',w.name,'city',l.city) ORDER BY w.name)
 FROM public.market_warehouses w JOIN public.locations l ON l.id=w.location_id WHERE w.is_active AND w.sales_enabled AND l.is_active),'[]'),
 'categories',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name_ru',c.name_ru,'name_en',c.name_en,'name_vi',c.name_vi) ORDER BY c.sort_order)
 FROM public.categories c WHERE c.category_type='market' AND c.is_active),'[]'),
 'products',coalesce((SELECT jsonb_agg(x ORDER BY x->>'name_ru') FROM (
 SELECT DISTINCT jsonb_build_object('id',p.id,'warehouse_id',w.id,'category_id',p.category_id,'name_ru',p.name_ru,'name_en',p.name_en,'name_vi',p.name_vi,
 'image_url',p.image_url,'weight_value',p.weight_value,'weight_unit',p.weight_unit) x
 FROM public.products p JOIN public.market_product_variants v ON v.product_id=p.id JOIN public.market_offers o ON o.variant_id=v.id
 JOIN public.market_warehouses w ON w.id=o.warehouse_id JOIN public.locations l ON l.id=w.location_id
 WHERE p.product_type='market' AND p.is_active AND v.is_active AND o.is_listed AND w.is_active AND w.sales_enabled AND l.is_active) q),'[]'));
$$;
CREATE FUNCTION public.b2b_request_list(p_actor bigint,p_staff boolean DEFAULT false,p_data jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE rows_ jsonb;stores_ jsonb;cursor_time timestamptz;cursor_id uuid;managed_ uuid[];
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.telegram_users WHERE telegram_id=p_actor AND is_active) THEN RAISE EXCEPTION 'B2B_ACCESS_DENIED'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',w.id,'name',w.name) ORDER BY w.name),'[]') INTO stores_
 FROM public.market_warehouses w WHERE public.b2b_can_manage(p_actor,w.id);
 managed_:=ARRAY(SELECT (s->>'id')::uuid FROM jsonb_array_elements(stores_) s);
 IF p_staff AND jsonb_array_length(stores_)=0 THEN RAISE EXCEPTION 'B2B_ACCESS_DENIED'; END IF;
 cursor_time:=(p_data->>'before_time')::timestamptz;cursor_id:=(p_data->>'before_id')::uuid;
 IF (cursor_time IS NULL)<>(cursor_id IS NULL) THEN RAISE EXCEPTION 'B2B_INVALID_REQUEST'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC,q.id DESC),'[]') INTO rows_ FROM (
 SELECT r.* FROM public.b2b_requests r
 WHERE ((p_staff AND r.warehouse_id=ANY(managed_)) OR (NOT p_staff AND r.customer_telegram_id=p_actor))
 AND (cursor_time IS NULL OR (r.created_at,r.id)<(cursor_time,cursor_id))
 ORDER BY r.created_at DESC,r.id DESC LIMIT 50) q;
 RETURN jsonb_build_object('ok',true,'requests',rows_,'manager_warehouses',stores_);
END $$;
CREATE FUNCTION public.b2b_operation(p_actor bigint,p_request uuid,p_action text,p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE prior public.b2b_operations;r public.b2b_requests;entry jsonb;lines jsonb:='[]';product_ public.products;
 wh uuid;quantity_ numeric;unit_ text;reply_ text;status_ text;result_ jsonb;
BEGIN
 IF p_action IS NULL OR p_request IS NULL OR p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR p_action NOT IN ('create','cancel','respond') THEN RAISE EXCEPTION 'B2B_INVALID_REQUEST'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.telegram_users WHERE telegram_id=p_actor AND is_active) THEN RAISE EXCEPTION 'B2B_ACCESS_DENIED'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text||':b2b',0));
 SELECT * INTO prior FROM public.b2b_operations WHERE actor_telegram_id=p_actor AND request_id=p_request;
 IF FOUND THEN
  IF prior.action<>p_action OR prior.payload<>p_data THEN RAISE EXCEPTION 'B2B_KEY_REUSED'; END IF;
  IF p_action='respond' AND NOT public.b2b_can_manage(p_actor,(prior.result->'request'->>'warehouse_id')::uuid) THEN RAISE EXCEPTION 'B2B_ACCESS_DENIED'; END IF;
  RETURN prior.result||jsonb_build_object('replayed',true);
 END IF;
 IF p_action='create' THEN
  IF (SELECT count(*) FROM public.b2b_requests WHERE customer_telegram_id=p_actor AND created_at>now()-interval '1 day')>=20 THEN RAISE EXCEPTION 'B2B_RATE_LIMIT'; END IF;
  wh:=(p_data->>'warehouse_id')::uuid;
  IF NOT EXISTS(SELECT 1 FROM public.market_warehouses w JOIN public.locations l ON l.id=w.location_id WHERE w.id=wh AND w.is_active AND w.sales_enabled AND l.is_active) THEN RAISE EXCEPTION 'B2B_STORE_UNAVAILABLE'; END IF;
  IF jsonb_typeof(p_data->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'items')>50 THEN RAISE EXCEPTION 'B2B_INVALID_ITEMS'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_data->'items') e GROUP BY e->>'product_id' HAVING count(*)>1) THEN RAISE EXCEPTION 'B2B_INVALID_ITEMS'; END IF;
  FOR entry IN SELECT * FROM jsonb_array_elements(p_data->'items') LOOP
   IF jsonb_typeof(entry->'quantity') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'B2B_INVALID_ITEMS'; END IF;
   quantity_:=(entry->>'quantity')::numeric;unit_:=entry->>'unit';
   IF quantity_<=0 OR quantity_>1000000 OR quantity_<>round(quantity_,3) OR unit_ IS NULL OR unit_ NOT IN ('kg','pcs','pack','box','l') THEN RAISE EXCEPTION 'B2B_INVALID_ITEMS'; END IF;
   SELECT p.* INTO product_ FROM public.products p WHERE p.id=(entry->>'product_id')::uuid AND p.product_type='market' AND p.is_active AND EXISTS(
    SELECT 1 FROM public.market_product_variants v JOIN public.market_offers o ON o.variant_id=v.id WHERE v.product_id=p.id AND v.is_active AND o.warehouse_id=wh AND o.is_listed);
   IF NOT FOUND THEN RAISE EXCEPTION 'B2B_PRODUCT_UNAVAILABLE'; END IF;
   lines:=lines||jsonb_build_array(jsonb_build_object('product_id',product_.id,'name_ru',product_.name_ru,'name_en',product_.name_en,'name_vi',product_.name_vi,'quantity',quantity_,'unit',unit_));
  END LOOP;
  INSERT INTO public.b2b_requests(customer_telegram_id,warehouse_id,company_name,business_type,contact_name,contact_phone,city,fulfillment,address,frequency,items,other_needs,comment)
  VALUES(p_actor,wh,trim(p_data->>'company_name'),p_data->>'business_type',trim(p_data->>'contact_name'),trim(p_data->>'contact_phone'),trim(p_data->>'city'),p_data->>'fulfillment',trim(coalesce(p_data->>'address','')),p_data->>'frequency',lines,trim(coalesce(p_data->>'other_needs','')),trim(coalesce(p_data->>'comment',''))) RETURNING * INTO r;
 ELSE
  SELECT * INTO r FROM public.b2b_requests WHERE id=(p_data->>'id')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'B2B_ACCESS_DENIED'; END IF;
  IF (p_action='cancel' AND r.customer_telegram_id<>p_actor) OR (p_action='respond' AND NOT public.b2b_can_manage(p_actor,r.warehouse_id)) THEN RAISE EXCEPTION 'B2B_ACCESS_DENIED'; END IF;
  IF r.version IS DISTINCT FROM (p_data->>'version')::integer THEN RAISE EXCEPTION 'B2B_STALE_REQUEST'; END IF;
  IF r.status IN ('closed','cancelled') THEN RAISE EXCEPTION 'B2B_REQUEST_CLOSED'; END IF;
  IF p_action='cancel' THEN status_:='cancelled';reply_:=r.manager_reply;
  ELSE
   status_:=p_data->>'status';reply_:=trim(coalesce(p_data->>'manager_reply',''));
   IF status_ IS NULL OR status_ NOT IN ('in_review','quoted','closed') OR length(reply_)>4000 OR (status_ IN ('quoted','closed') AND length(reply_)<3) THEN RAISE EXCEPTION 'B2B_INVALID_REPLY'; END IF;
   IF r.status='quoted' AND status_='in_review' THEN RAISE EXCEPTION 'B2B_INVALID_REPLY'; END IF;
  END IF;
  UPDATE public.b2b_requests SET status=status_,manager_reply=reply_,updated_by=p_actor,updated_at=now(),version=version+1 WHERE id=r.id RETURNING * INTO r;
 END IF;
 result_:=jsonb_build_object('ok',true,'request',to_jsonb(r));
 INSERT INTO public.b2b_operations(actor_telegram_id,request_id,action,payload,result) VALUES(p_actor,p_request,p_action,p_data,result_);
 RETURN result_;
END $$;
REVOKE ALL ON FUNCTION public.b2b_can_manage(bigint,uuid),public.b2b_catalog(),public.b2b_request_list(bigint,boolean,jsonb),public.b2b_operation(bigint,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.b2b_can_manage(bigint,uuid),public.b2b_catalog(),public.b2b_request_list(bigint,boolean,jsonb),public.b2b_operation(bigint,uuid,text,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
