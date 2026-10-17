-- Certificate collection is deferred. Imports never assert certification.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE public.market_supplier_products (
 supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
 supplier_sku text NOT NULL CHECK(length(supplier_sku) BETWEEN 1 AND 160),
 variant_id uuid NOT NULL REFERENCES public.market_product_variants(id),
 purchase_price_vnd bigint CHECK(purchase_price_vnd>=0),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(supplier_id,supplier_sku)
);
CREATE INDEX market_supplier_products_variant_idx ON public.market_supplier_products(variant_id);
CREATE TABLE public.market_import_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),warehouse_id uuid NOT NULL REFERENCES public.market_warehouses(id),
 actor_telegram_id bigint NOT NULL,source_name text NOT NULL,
 state text NOT NULL CHECK(state IN ('staged','committed')),
 rows jsonb NOT NULL,preview jsonb NOT NULL,result jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),committed_at timestamptz
);
CREATE INDEX market_import_jobs_warehouse_idx ON public.market_import_jobs(warehouse_id,created_at DESC);
ALTER TABLE public.market_supplier_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_import_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.market_supplier_products,public.market_import_jobs FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.market_supplier_products,public.market_import_jobs TO service_role;

CREATE FUNCTION public.market_import_gtin_valid(code text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE total integer:=0;i integer;n integer:=length(code);
BEGIN
 IF code IS NULL OR code !~ '^(\d{8}|\d{12}|\d{13}|\d{14})$' THEN RETURN false;END IF;
 FOR i IN 1..n-1 LOOP total:=total+substr(code,i,1)::integer*CASE WHEN (n-i)%2=1 THEN 3 ELSE 1 END;END LOOP;
 RETURN (10-total%10)%10=right(code,1)::integer;
END $$;

CREATE FUNCTION public.market_import_preview(p_rows jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE r jsonb;errors text[];preview jsonb:='[]';seen_sku text[]:='{}';seen_gtin text[]:='{}';sku text;gtin text;matches uuid[];n integer:=0;
BEGIN
 IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Import requires 1..100 rows';END IF;
 FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
  n:=n+1;errors:='{}';sku:=coalesce(r->>'supplier_id','')||':'||trim(coalesce(r->>'supplier_sku',''));gtin:=trim(coalesce(r->>'gtin',''));
  IF length(trim(coalesce(r->>'name_ru',''))) NOT BETWEEN 1 AND 160 OR length(coalesce(r->>'name_en',''))>160 OR length(coalesce(r->>'name_vi',''))>160 THEN errors:=array_append(errors,'Название RU обязательно; не более 160 символов');END IF;
  IF NOT EXISTS(SELECT 1 FROM public.suppliers WHERE id=nullif(r->>'supplier_id','')::uuid AND is_active) OR length(trim(coalesce(r->>'supplier_sku',''))) NOT BETWEEN 1 AND 160 THEN errors:=array_append(errors,'Требуется действующий поставщик и его SKU');END IF;
  IF gtin<>'' AND (jsonb_typeof(r->'gtin')<>'string' OR NOT public.market_import_gtin_valid(gtin)) THEN errors:=array_append(errors,'Некорректный GTIN');END IF;
  IF sku=ANY(seen_sku) OR (gtin<>'' AND gtin=ANY(seen_gtin)) THEN errors:=array_append(errors,'Дубль строки импорта');END IF;
  seen_sku:=array_append(seen_sku,sku);seen_gtin:=array_append(seen_gtin,gtin);
  IF nullif(r->>'category_id','') IS NULL OR NOT EXISTS(SELECT 1 FROM public.categories WHERE id=(r->>'category_id')::uuid AND category_type='market' AND is_active) THEN errors:=array_append(errors,'Требуется категория Market');END IF;
  IF coalesce(r->>'sale_mode','') NOT IN ('piece','set','fixed_weight','individual_weight') OR coalesce(r->>'measure','') NOT IN ('g','pcs') OR (r->>'sale_mode' IN ('fixed_weight','individual_weight') AND r->>'measure'<>'g') THEN errors:=array_append(errors,'Некорректная единица или модель продажи');END IF;
  IF r->>'sale_mode' IN ('set','fixed_weight') AND coalesce(r->>'fixed_quantity','') !~ '^[1-9][0-9]{0,8}$' THEN errors:=array_append(errors,'Требуется размер упаковки');END IF;
  IF nullif(r->>'purchase_price_vnd','') IS NOT NULL AND ((r->>'purchase_price_vnd') !~ '^[0-9]{1,12}$') THEN errors:=array_append(errors,'Некорректная закупочная цена VND');END IF;
  SELECT array_agg(DISTINCT v.id) INTO matches FROM public.market_product_variants v JOIN public.products p ON p.id=v.product_id WHERE p.product_type='market' AND (EXISTS(SELECT 1 FROM public.market_supplier_products s WHERE s.supplier_id=(r->>'supplier_id')::uuid AND s.supplier_sku=trim(r->>'supplier_sku') AND s.variant_id=v.id) OR (gtin<>'' AND EXISTS(SELECT 1 FROM public.market_product_barcodes b WHERE b.code=gtin AND b.variant_id=v.id)));
  IF cardinality(matches)>1 THEN errors:=array_append(errors,'Неоднозначное совпадение GTIN и SKU');END IF;
  IF cardinality(matches)=1 THEN
   IF gtin<>'' AND NOT EXISTS(SELECT 1 FROM public.market_product_barcodes WHERE variant_id=matches[1] AND code=gtin) THEN errors:=array_append(errors,'SKU совпал, но GTIN изменился: требуется ручная проверка');END IF;
   IF EXISTS(SELECT 1 FROM public.market_product_variants WHERE id=matches[1] AND (sale_mode IS DISTINCT FROM r->>'sale_mode' OR measure IS DISTINCT FROM r->>'measure' OR (sale_mode IN ('set','fixed_weight') AND fixed_quantity::text IS DISTINCT FROM nullif(r->>'fixed_quantity','')))) THEN errors:=array_append(errors,'Упаковка совпавшего товара отличается: требуется ручная проверка');END IF;
  END IF;
  IF gtin<>'' AND EXISTS(SELECT 1 FROM public.market_product_barcodes b JOIN public.market_product_variants v ON v.id=b.variant_id JOIN public.products p ON p.id=v.product_id WHERE b.code=gtin AND p.product_type<>'market') THEN errors:=array_append(errors,'Код занят товаром другого модуля');END IF;
  preview:=preview||jsonb_build_array(jsonb_build_object('row_number',n,'name',r->>'name_ru','action',CASE WHEN cardinality(errors)>0 THEN 'blocked' WHEN cardinality(matches)=1 THEN 'update_supplier' ELSE 'create_draft' END,'variant_id',matches[1],'errors',to_jsonb(errors)));
 END LOOP;
 RETURN preview;
END $$;

CREATE FUNCTION public.market_import_operation(p_actor bigint,p_request uuid,p_action text,p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE wh public.market_warehouses;old public.market_operations;job public.market_import_jobs;rows_ jsonb;preview_ jsonb;r jsonb;plan jsonb;made jsonb;variant_ uuid;out_ jsonb;idx integer:=0;count_ integer:=0;
BEGIN
 SELECT * INTO STRICT wh FROM public.market_warehouses WHERE id=(p_data->>'warehouse_id')::uuid AND is_active;
 IF NOT public.market_can(p_actor,wh.location_id,ARRAY['admin']) THEN RAISE EXCEPTION 'Market access denied';END IF;
 IF p_action='import_list' THEN RETURN jsonb_build_object('ok',true,'jobs',coalesce((SELECT jsonb_agg(to_jsonb(j)) FROM (SELECT id,source_name,state,preview,result,created_at,committed_at FROM public.market_import_jobs WHERE warehouse_id=wh.id ORDER BY created_at DESC LIMIT 30) j),'[]'));END IF;
 IF p_request IS NULL THEN RAISE EXCEPTION 'Operation request ID required';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('market-request:'||p_actor||':'||p_request,0));
 SELECT * INTO old FROM public.market_operations WHERE actor_telegram_id=p_actor AND request_id=p_request;
 IF FOUND THEN IF old.action<>p_action OR old.payload<>p_data THEN RAISE EXCEPTION 'Idempotency key reused with different data';END IF;RETURN old.result||'{"replayed":true}'::jsonb;END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('market-catalog-import',0));
 IF p_action='import_stage' THEN
  rows_:=p_data->'rows';preview_:=public.market_import_preview(rows_);
  INSERT INTO public.market_import_jobs(warehouse_id,actor_telegram_id,source_name,state,rows,preview) VALUES(wh.id,p_actor,left(coalesce(nullif(trim(p_data->>'source_name'),''),'CSV'),160),'staged',rows_,preview_) RETURNING * INTO job;
  out_:=jsonb_build_object('ok',true,'job_id',job.id,'preview',preview_);
 ELSIF p_action='import_commit' THEN
  SELECT * INTO STRICT job FROM public.market_import_jobs WHERE id=(p_data->>'job_id')::uuid AND warehouse_id=wh.id FOR UPDATE;
  IF job.state='committed' THEN out_:=job.result||'{"replayed":true}'::jsonb;
  ELSE
   preview_:=public.market_import_preview(job.rows);
   IF preview_<>job.preview THEN RAISE EXCEPTION 'Каталог изменился. Создайте новый предпросмотр';END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(preview_) x WHERE x->>'action'='blocked') THEN RAISE EXCEPTION 'Исправьте ошибки импорта перед подтверждением';END IF;
   FOR r IN SELECT * FROM jsonb_array_elements(job.rows) LOOP
    plan:=preview_->idx;idx:=idx+1;variant_:=nullif(plan->>'variant_id','')::uuid;
    IF variant_ IS NULL THEN
     made:=public.market_operation(p_actor,gen_random_uuid(),'product_create',jsonb_build_object('warehouse_id',wh.id,'name_ru',trim(r->>'name_ru'),'name_en',coalesce(r->>'name_en',''),'name_vi',coalesce(r->>'name_vi',''),'category_id',r->>'category_id','sale_mode',r->>'sale_mode','measure',r->>'measure','fixed_quantity',nullif(r->>'fixed_quantity',''),'barcode',nullif(trim(r->>'gtin'),''),'price_vnd',NULL,'halal_evidence',NULL));
     variant_:=(made->'variant'->>'id')::uuid;
     UPDATE public.products SET is_active=false WHERE id=(made->'variant'->>'product_id')::uuid;
     INSERT INTO public.market_offers(warehouse_id,variant_id,price_vnd,is_listed) VALUES(wh.id,variant_,NULL,false);
    END IF;
    INSERT INTO public.market_supplier_products(supplier_id,supplier_sku,variant_id,purchase_price_vnd) VALUES((r->>'supplier_id')::uuid,trim(r->>'supplier_sku'),variant_,nullif(r->>'purchase_price_vnd','')::bigint) ON CONFLICT(supplier_id,supplier_sku) DO UPDATE SET purchase_price_vnd=excluded.purchase_price_vnd,updated_at=now();
    count_:=count_+1;
   END LOOP;
   out_:=jsonb_build_object('ok',true,'job_id',job.id,'processed',count_);
   UPDATE public.market_import_jobs SET state='committed',result=out_,committed_at=now() WHERE id=job.id;
  END IF;
 ELSE RAISE EXCEPTION 'Unknown import action';END IF;
 INSERT INTO public.market_operations(actor_telegram_id,request_id,action,payload,result) VALUES(p_actor,p_request,p_action,p_data,out_);
 RETURN out_;
END $$;
REVOKE ALL ON FUNCTION public.market_import_gtin_valid(text),public.market_import_preview(jsonb),public.market_import_operation(bigint,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.market_import_gtin_valid(text),public.market_import_preview(jsonb),public.market_import_operation(bigint,uuid,text,jsonb) TO service_role;
DO $patch$
DECLARE src text;
BEGIN
 SELECT pg_get_functiondef('public.market_operation(bigint,uuid,text,jsonb)'::regprocedure) INTO src;
 IF position('market_import_operation' IN src)=0 THEN
  IF position(E'BEGIN\n' IN src)=0 THEN RAISE EXCEPTION 'Market operation compatibility changed';END IF;
  src:=replace(src,E'BEGIN\n',E'BEGIN\n IF p_action IN (''import_stage'',''import_commit'',''import_list'') THEN RETURN public.market_import_operation(p_actor,p_request,p_action,p_data);END IF;\n');
  EXECUTE src;
 END IF;
END $patch$;
NOTIFY pgrst,'reload schema';
COMMIT;
