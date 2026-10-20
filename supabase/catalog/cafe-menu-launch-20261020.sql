-- Owner-confirmed VND prices, menu descriptions and five existing dessert photographs.
-- Catalog data only. No stock quantities, order history or runtime flags change.
BEGIN;
UPDATE public.products SET name_ru='Шурпа с бараниной',name_en='Lamb Shurpa Soup',name_vi='Súp Shurpa thịt cừu',
 description_ru='Наваристая шурпа с бараниной и овощами. Порция — приблизительно 650 г.',
 description_en='Hearty shurpa soup with lamb and vegetables. Approx. 650 g per serving.',
 description_vi='Súp shurpa đậm đà với thịt cừu và rau củ. Khẩu phần khoảng 650 g.',updated_at=now()
 WHERE product_type='cafe' AND sku='UMMA-CAFE-SHURPA';
UPDATE public.products SET name_ru='Борщ с говядиной',name_en='Borscht with Beef',name_vi='Súp Borscht thịt bò',updated_at=now()
 WHERE product_type='cafe' AND sku='UMMA-CAFE-BORSCHT';
UPDATE public.products SET name_ru='Плов с бараниной',name_en='Lamb Plov',name_vi='Cơm Plov thịt cừu',updated_at=now()
 WHERE product_type='cafe' AND sku='UMMA-CAFE-PLOV';
WITH copy(sku,ru,en,vi) AS (VALUES
('UMMA-CAFE-GREEN-TEA-900','Зелёный чай. Чайник 900 мл.','Green tea. A 900 ml pot.','Trà xanh. Ấm 900 ml.'),
('UMMA-CAFE-CHICKEN-LEG-SALAD','Куриный окорочок с порцией салата. Порция — приблизительно 300 г.','Chicken leg served with salad. Approx. 300 g per serving.','Đùi gà dùng kèm salad. Khẩu phần khoảng 300 g.'),
('UMMA-CAFE-CROISSANT','Круассан из слоёного теста к чаю или кофе. Вес — приблизительно 100 г.','A flaky croissant to enjoy with tea or coffee. Approx. 100 g.','Bánh sừng bò nhiều lớp dùng cùng trà hoặc cà phê. Khoảng 100 g.'),
('UMMA-CAFE-ADJIKA','Соус аджика к основным блюдам. Подаётся отдельно.','Adjika sauce to accompany your meal, served separately.','Sốt adjika ăn kèm món chính, phục vụ riêng.'),
('UMMA-CAFE-OLIVIER','Салат оливье. Порция — приблизительно 200 г.','Olivier salad. Approx. 200 g per serving.','Salad Olivier. Khẩu phần khoảng 200 g.'),
('UMMA-CAFE-VINAIGRETTE','Овощной салат винегрет. Порция — приблизительно 200 г.','Vinaigrette vegetable salad. Approx. 200 g per serving.','Salad rau củ Vinaigrette. Khẩu phần khoảng 200 g.'),
('UMMA-CAFE-BLACK-TEA-LEMON-900','Чёрный чай с лимоном. Чайник 900 мл.','Black tea with lemon. A 900 ml pot.','Trà đen với chanh. Ấm 900 ml.'),
('UMMA-CAFE-CHEESE-KHACHAPURI','Хачапури с сырной начинкой. Вес — приблизительно 220 г.','Khachapuri with a cheese filling. Approx. 220 g.','Bánh khachapuri nhân phô mai. Khoảng 220 g.'),
('UMMA-CAFE-BLACKBERRY-COMPOTE-500','Компот из ежевики. Объём — 500 мл.','Blackberry compote drink. 500 ml.','Nước quả mâm xôi đen. 500 ml.'),
('UMMA-CAFE-BLACKBERRY-COMPOTE-1000','Компот из ежевики. Объём — 1 л.','Blackberry compote drink. 1 litre.','Nước quả mâm xôi đen. 1 lít.'),
('UMMA-CAFE-TURKISH-AYRAN-1000','Освежающий кисломолочный напиток айран. Объём — 1 л.','Refreshing cultured yogurt drink. 1 litre.','Thức uống sữa chua lên men ayran mát lạnh. 1 lít.'),
('UMMA-CAFE-BAKLAVA-ALMOND','Пахлава с миндалем. Цена за 1 штуку.','Almond baklava. Price per piece.','Bánh baklava hạnh nhân. Giá cho 1 miếng.'),
('UMMA-CAFE-BAKLAVA-WALNUT','Пахлава с грецким орехом. Цена за 1 штуку.','Walnut baklava. Price per piece.','Bánh baklava óc chó. Giá cho 1 miếng.'))
UPDATE public.products p SET description_ru=coalesce(nullif(trim(p.description_ru),''),copy.ru),
 description_en=coalesce(nullif(trim(p.description_en),''),copy.en),description_vi=coalesce(nullif(trim(p.description_vi),''),copy.vi),updated_at=now()
FROM copy WHERE p.sku=copy.sku AND p.product_type='cafe';
UPDATE public.products SET price_vnd=25000,catalog_preview=false,updated_at=now()
 WHERE product_type='cafe' AND sku IN ('UMMA-CAFE-BAKLAVA-ALMOND','UMMA-CAFE-BAKLAVA-WALNUT');
DO $catalog$
DECLARE item record;category uuid;
BEGIN
 SELECT id INTO STRICT category FROM public.categories WHERE category_type='cafe' AND name_ru='Выпечка' AND is_active=true;
 FOR item IN SELECT * FROM (VALUES
('UMMA-CAFE-DESSERT-PLOMBIR','Пломбир','Plombir cake','Bánh kem Plombir','Порционный десерт «Пломбир» к чаю или кофе.','A portion of Plombir dessert to enjoy with tea or coffee.','Một phần bánh Plombir dùng cùng trà hoặc cà phê.','https://ummaibrahim24072026-netizen.github.io/umma-global-mini-app/assets/cafe/dessert-1-white.webp',91),
('UMMA-CAFE-DESSERT-HONEY','Медовик','Honey cake','Bánh mật ong','Медовый торт с прослойками крема. Одна порция.','Honey cake layered with cream. One portion.','Bánh mật ong nhiều lớp kem. Một phần.','https://ummaibrahim24072026-netizen.github.io/umma-global-mini-app/assets/cafe/dessert-2-white.webp',92),
('UMMA-CAFE-DESSERT-RED-VELVET','Красный бархат','Red velvet cake','Bánh nhung đỏ','Порция торта «Красный бархат» с кремом.','A portion of red velvet cake with cream.','Một phần bánh nhung đỏ với kem.','https://ummaibrahim24072026-netizen.github.io/umma-global-mini-app/assets/cafe/dessert-3-white.webp',93),
('UMMA-CAFE-DESSERT-CHOCOLATE','Шоколад','Chocolate cake','Bánh sô cô la','Порционный шоколадный десерт к чаю или кофе.','A portion of chocolate dessert to enjoy with tea or coffee.','Một phần bánh sô cô la dùng cùng trà hoặc cà phê.','https://ummaibrahim24072026-netizen.github.io/umma-global-mini-app/assets/cafe/dessert-4-white.webp',94),
('UMMA-CAFE-DESSERT-NAPOLEON','Наполеон','Napoleon cake','Bánh Napoleon','Слоёный торт «Наполеон» с кремом. Одна порция.','Napoleon cake with layers of pastry and cream. One portion.','Bánh Napoleon nhiều lớp với kem. Một phần.','https://ummaibrahim24072026-netizen.github.io/umma-global-mini-app/assets/cafe/dessert-5-white.webp',95)) AS d(sku,ru,en,vi,dru,den,dvi,image,sort_order) LOOP
 IF (SELECT count(*) FROM public.products WHERE sku=item.sku)>1 THEN RAISE EXCEPTION 'Duplicate dessert SKU'; END IF;
 IF EXISTS(SELECT 1 FROM public.products WHERE sku=item.sku AND product_type<>'cafe') THEN RAISE EXCEPTION 'SKU belongs to another product type'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.products WHERE sku=item.sku) THEN
  INSERT INTO public.products(category_id,sku,name_ru,name_en,name_vi,description_ru,description_en,description_vi,price_vnd,product_type,catalog_preview,image_url,sort_order,is_active)
  VALUES(category,item.sku,item.ru,item.en,item.vi,item.dru,item.den,item.dvi,40000,'cafe',false,item.image,item.sort_order,true);
 ELSE
  UPDATE public.products SET name_ru=item.ru,name_en=item.en,name_vi=item.vi,description_ru=item.dru,description_en=item.den,description_vi=item.dvi,price_vnd=40000,catalog_preview=false,image_url=item.image,is_active=true,updated_at=now() WHERE sku=item.sku AND product_type='cafe';
 END IF;
 END LOOP;
END $catalog$;
UPDATE public.inventory i SET price_vnd=p.price_vnd,updated_at=now() FROM public.products p
 WHERE i.product_id=p.id AND i.price_vnd IS NOT NULL AND p.product_type='cafe'
 AND (p.sku LIKE 'UMMA-CAFE-DESSERT-%' OR p.sku IN ('UMMA-CAFE-BAKLAVA-ALMOND','UMMA-CAFE-BAKLAVA-WALNUT'));
COMMIT;
