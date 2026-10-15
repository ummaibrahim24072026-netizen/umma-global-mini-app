-- Bottled drink prices explicitly confirmed in VND by the owner on 2026-10-15.
-- Preserve current inventory-seeding behavior and existing products.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('umma-cafe-bottled-drinks-20261015'));
WITH requested(sku,name_ru,name_vi,name_en,price_vnd,weight_value,image_url,sort_order) AS (
 VALUES
  ('UMMA-CAFE-BLACKBERRY-COMPOTE-500', 'Компот ежевичный', 'Nước quả mâm xôi đen', 'Blackberry Compote Drink', 40000, 500, 'https://ummaibrahim24072026-netizen.github.io/umma-global-mini-app/logo/assets/menu/blackberry-compote-500-white.webp', 20),
  ('UMMA-CAFE-BLACKBERRY-COMPOTE-1000', 'Компот ежевичный', 'Nước quả mâm xôi đen', 'Blackberry Compote Drink', 80000, 1000, 'https://ummaibrahim24072026-netizen.github.io/umma-global-mini-app/logo/assets/menu/blackberry-compote-1000-white.webp', 21),
  ('UMMA-CAFE-TURKISH-AYRAN-1000', 'Айран турецкий', 'Ayran Thổ Nhĩ Kỳ', 'Turkish Ayran', 80000, 1000, 'https://ummaibrahim24072026-netizen.github.io/umma-global-mini-app/logo/assets/menu/turkish-ayran-1000-white.webp', 22)
)
INSERT INTO public.products(category_id,sku,name_ru,name_vi,name_en,product_type,price_vnd,weight_value,weight_unit,image_url,sort_order,is_active)
SELECT 'd22ef2e3-ead7-44e5-901c-e58acabe7d3e'::uuid,r.sku,r.name_ru,r.name_vi,r.name_en,'cafe',r.price_vnd,r.weight_value,'ml',r.image_url,r.sort_order,true
FROM requested r WHERE NOT EXISTS(SELECT 1 FROM public.products p WHERE p.sku=r.sku)
RETURNING sku,name_ru,price_vnd,weight_value,weight_unit,image_url;
COMMIT;
