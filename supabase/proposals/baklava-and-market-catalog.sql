-- User supplied photos and package sizes, 2026-10-17. No sale prices or stock invented.
BEGIN;
DO $seed$
DECLARE c uuid;w uuid;p uuid;item uuid;v uuid;r record;sku_ text;url_ text;
BEGIN
 SELECT id INTO STRICT c FROM public.categories WHERE category_type='cafe' AND name_ru='Выпечка' AND is_active;
 FOR r IN SELECT * FROM (VALUES
 ('ALMOND','Пахлава с миндалем','Almond baklava','Bánh baklava hạnh nhân','baklava-almond'),
 ('WALNUT','Пахлава с грецким орехом','Walnut baklava','Bánh baklava óc chó','baklava-walnut')
 ) t(code,ru,en,vi,slug) LOOP
  sku_:='UMMA-CAFE-BAKLAVA-'||r.code;
  url_:='https://ummaibrahim24072026-netizen.github.io/umma-global-mini-app/assets/cafe/'||r.slug||'.webp';
  IF NOT EXISTS(SELECT 1 FROM public.products WHERE sku=sku_) THEN
   INSERT INTO public.products(category_id,name_ru,name_en,name_vi,product_type,price_vnd,catalog_preview,image_url,sku,is_active,sort_order)
   VALUES(c,r.ru,r.en,r.vi,'cafe',NULL,true,url_,sku_,true,90);
  ELSE
   UPDATE public.products SET image_url=url_,updated_at=now() WHERE sku=sku_ AND product_type='cafe';
  END IF;
 END LOOP;
 SELECT x.id INTO STRICT w FROM public.market_warehouses x JOIN public.locations l ON l.id=x.location_id
 WHERE l.name='HALAL UMMA' AND l.city='Nha Trang' AND x.is_active AND x.name='UMMA Market — Nha Trang';
 FOR r IN SELECT * FROM (VALUES
 ('MOZZARELLA-ALBA','Моцарелла ALBA, 2,5 кг','ALBA Mozzarella, 2.5 kg','Phô mai Mozzarella ALBA, 2,5 kg','Молочные продукты','mozzarella-alba',2500),
 ('CHICKEN-FILLET-CP','Филе куриное охлаждённое CP, 500 г','CP chilled chicken breast fillet, 500 g','Ức gà phi lê CP tươi, 500 g','Птица','chicken-fillet',500)
 ) t(code,ru,en,vi,category,slug,grams) LOOP
  SELECT id INTO STRICT c FROM public.categories WHERE category_type='market' AND name_ru=r.category AND is_active;
  sku_:='UMMA-MARKET-'||r.code;
  url_:='https://ummaibrahim24072026-netizen.github.io/umma-global-mini-app/assets/market/'||r.slug||'.webp';
  SELECT id INTO p FROM public.products WHERE sku=sku_;
  IF p IS NULL THEN
   INSERT INTO public.products(category_id,name_ru,name_en,name_vi,product_type,price_vnd,image_url,sku,is_active,weight_value,weight_unit)
   VALUES(c,r.ru,r.en,r.vi,'market',NULL,url_,sku_,true,r.grams,'g') RETURNING id INTO p;
  ELSE
   UPDATE public.products SET image_url=url_,updated_at=now() WHERE id=p AND product_type='market';
  END IF;
  SELECT id INTO v FROM public.market_product_variants WHERE product_id=p AND sale_mode='piece';
  IF v IS NULL THEN
   SELECT id INTO item FROM public.stock_items WHERE sku=sku_;
   IF item IS NULL THEN
    INSERT INTO public.stock_items(sku,name_ru,name_en,name_vi,item_type,base_unit)
    VALUES(sku_,r.ru,r.en,r.vi,'finished_good','pcs') RETURNING id INTO item;
   END IF;
   INSERT INTO public.market_product_variants(product_id,stock_item_id,sale_mode,measure,is_active)
   VALUES(p,item,'piece','pcs',true) RETURNING id INTO v;
   INSERT INTO public.market_product_barcodes(code,variant_id,format) VALUES('UMMA-PRODUCT-'||v,v,'internal');
  END IF;
  INSERT INTO public.market_offers(warehouse_id,variant_id,price_vnd,is_listed) VALUES(w,v,NULL,true)
  ON CONFLICT(warehouse_id,variant_id) DO UPDATE SET is_listed=true;
 END LOOP;
END $seed$;
COMMIT;
