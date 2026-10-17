-- User-provided vegetable catalogue, 2026-10-17. No prices, stock or quality claims are invented.
BEGIN;
DO $seed$
DECLARE c uuid;w uuid;p uuid;item uuid;v uuid;r record;sku_ text;url_ text;
BEGIN
 SELECT id INTO STRICT c FROM public.categories WHERE category_type='market' AND name_ru='Овощи' AND is_active;
 SELECT x.id INTO STRICT w FROM public.market_warehouses x JOIN public.locations l ON l.id=x.location_id WHERE l.name='HALAL UMMA' AND l.city='Nha Trang' AND x.is_active AND x.name='UMMA Market — Nha Trang';
 FOR r IN SELECT * FROM (VALUES
('red-bell-pepper','Болгарский перец красный','Red bell pepper','Ớt chuông đỏ'),
('cucumber','Огурец','Cucumber','Dưa leo'),
('tomato','Помидор','Tomato','Cà chua'),
('carrot','Морковь','Carrot','Cà rốt'),
('onion','Лук репчатый','Onion','Hành tây'),
('beetroot','Свёкла','Beetroot','Củ dền'),
('white-cabbage','Капуста белокочанная','White cabbage','Bắp cải trắng'),
('garlic','Чеснок','Garlic','Tỏi'),
('potato','Картофель','Potato','Khoai tây')
 ) t(slug,ru,en,vi) LOOP
  sku_:='UMMA-MARKET-VEG-'||upper(r.slug);
  url_:='https://ummaibrahim24072026-netizen.github.io/umma-global-mini-app/assets/market/vegetables/'||r.slug||'.jpg';
  SELECT id INTO p FROM public.products WHERE sku=sku_;
  IF p IS NULL THEN
   INSERT INTO public.products(category_id,name_ru,name_en,name_vi,product_type,price_vnd,image_url,sku,is_active)
   VALUES(c,r.ru,r.en,r.vi,'market',NULL,url_,sku_,true) RETURNING id INTO p;
  ELSE
   UPDATE public.products SET category_id=c,name_ru=r.ru,name_en=r.en,name_vi=r.vi,image_url=url_,is_active=true,updated_at=now() WHERE id=p AND product_type='market';
  END IF;
  SELECT id,stock_item_id INTO v,item FROM public.market_product_variants WHERE product_id=p AND sale_mode='individual_weight';
  IF v IS NULL THEN
   SELECT id INTO item FROM public.stock_items WHERE sku=sku_;
   IF item IS NULL THEN
    INSERT INTO public.stock_items(sku,name_ru,name_en,name_vi,item_type,base_unit)
    VALUES(sku_,r.ru,r.en,r.vi,'finished_good','g') RETURNING id INTO item;
   END IF;
   INSERT INTO public.market_product_variants(product_id,stock_item_id,sale_mode,measure,is_active)
   VALUES(p,item,'individual_weight','g',true) RETURNING id INTO v;
   INSERT INTO public.market_product_barcodes(code,variant_id,format) VALUES('UMMA-PRODUCT-'||v,v,'internal');
  END IF;
  INSERT INTO public.market_offers(warehouse_id,variant_id,price_vnd,is_listed) VALUES(w,v,NULL,true)
  ON CONFLICT(warehouse_id,variant_id) DO UPDATE SET is_listed=true;
 END LOOP;
END $seed$;
COMMIT;
