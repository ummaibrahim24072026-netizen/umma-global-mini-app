-- Owner-confirmed menu additions on 2026-10-15 (afternoon).
-- Original inventory-seeding behavior is preserved; no stock counts are invented.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('umma-cafe-menu-additions-20261015-afternoon'));
WITH requested(sku,name_ru,name_vi,name_en,price_vnd,weight_value,weight_unit,image_url,sort_order,description_ru,description_vi,description_en) AS (
 VALUES
  ('UMMA-CAFE-BLACK-TEA-LEMON-900', 'Чай чёрный с лимоном', 'Trà đen với chanh', 'Black Tea with Lemon', 50000, 900, 'ml', 'https://ummaibrahim24072026-netizen.github.io/umma-global-mini-app/logo/assets/menu/black-tea-lemon-white.webp', 17, NULL, NULL, NULL),
  ('UMMA-CAFE-CHEESE-KHACHAPURI', 'Хачапури с сыром', 'Khachapuri phô mai', 'Cheese Khachapuri', 150000, 220, 'g', 'https://ummaibrahim24072026-netizen.github.io/umma-global-mini-app/logo/assets/menu/cheese-khachapuri-white.webp', 18, NULL, NULL, NULL),
  ('UMMA-CAFE-CRUNCHY-SALAD', 'Салат «Хрустящий»', 'Salad giòn', 'Crunchy Salad', 50000, 250, 'g', 'https://ummaibrahim24072026-netizen.github.io/umma-global-mini-app/logo/assets/menu/pickled-salad-white.webp', 19, 'Маринованная капуста с огурцом и болгарским перцем.', 'Bắp cải ngâm chua với dưa leo và ớt chuông.', 'Marinated cabbage with cucumber and bell pepper.')
)
INSERT INTO public.products (category_id,sku,name_ru,name_vi,name_en,product_type,price_vnd,weight_value,weight_unit,image_url,sort_order,description_ru,description_vi,description_en,is_active)
SELECT 'd22ef2e3-ead7-44e5-901c-e58acabe7d3e'::uuid,r.sku,r.name_ru,r.name_vi,r.name_en,'cafe',r.price_vnd,r.weight_value,r.weight_unit,r.image_url,r.sort_order,r.description_ru,r.description_vi,r.description_en,true
FROM requested r WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.sku=r.sku)
RETURNING sku,name_ru,price_vnd,weight_value,weight_unit,image_url;
COMMIT;
