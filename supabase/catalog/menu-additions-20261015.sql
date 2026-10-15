-- Menu additions explicitly requested by the owner on 2026-10-15.
-- Existing inventory seeding triggers remain in force; stock counts are not fabricated.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('umma-cafe-menu-additions-20261015'));
WITH requested(sku,name_ru,name_vi,name_en,price_vnd,weight_value,weight_unit,image_url,sort_order) AS (
 VALUES
  ('UMMA-CAFE-GREEN-TEA-900', 'Чай зелёный', 'Trà xanh', 'Green Tea', 50000, 900, 'ml', 'https://ummaibrahim24072026-netizen.github.io/umma-global-mini-app/logo/assets/menu/tea-900.png', 10),
  ('UMMA-CAFE-CHICKEN-LEG-SALAD', 'Куриный окорочок с салатом', 'Đùi gà kèm salad', 'Chicken Leg with Salad', 80000, 300, 'g', 'https://ummaibrahim24072026-netizen.github.io/umma-global-mini-app/logo/assets/menu/chicken-leg-salad.png', 11),
  ('UMMA-CAFE-CROISSANT', 'Круассан', 'Bánh sừng bò', 'Croissant', 40000, 100, 'g', 'https://ummaibrahim24072026-netizen.github.io/umma-global-mini-app/logo/assets/menu/croissant.png', 12),
  ('UMMA-CAFE-BORSCHT', 'Борщ', 'Súp Borscht', 'Borscht', 90000, 650, 'g', 'https://ummaibrahim24072026-netizen.github.io/umma-global-mini-app/logo/assets/menu/borscht.png', 13),
  ('UMMA-CAFE-ADJIKA', 'Аджика', 'Sốt Adjika', 'Adjika', 10000, NULL, NULL, 'https://ummaibrahim24072026-netizen.github.io/umma-global-mini-app/logo/assets/menu/adjika.png', 14),
  ('UMMA-CAFE-OLIVIER', 'Салат Оливье', 'Salad Olivier', 'Olivier Salad', 50000, 200, 'g', 'https://ummaibrahim24072026-netizen.github.io/umma-global-mini-app/logo/assets/menu/olivier.png', 15),
  ('UMMA-CAFE-VINAIGRETTE', 'Салат Винегрет', 'Salad Vinaigrette', 'Vinaigrette Salad', 50000, 200, 'g', 'https://ummaibrahim24072026-netizen.github.io/umma-global-mini-app/logo/assets/menu/vinaigrette.png', 16)
)
INSERT INTO public.products (category_id,sku,name_ru,name_vi,name_en,product_type,price_vnd,weight_value,weight_unit,image_url,sort_order,is_active)
SELECT 'd22ef2e3-ead7-44e5-901c-e58acabe7d3e'::uuid,r.sku,r.name_ru,r.name_vi,r.name_en,'cafe',r.price_vnd,r.weight_value,r.weight_unit,r.image_url,r.sort_order,true
FROM requested r
WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.sku=r.sku)
RETURNING sku,name_ru,price_vnd,weight_value,weight_unit,image_url;
COMMIT;
