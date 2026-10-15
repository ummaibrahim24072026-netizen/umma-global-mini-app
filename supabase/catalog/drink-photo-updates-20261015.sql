-- Owner-requested drink naming and photography updates, 2026-10-15.
-- Apply after the new image files are published. Existing prices and quantities stay intact.
BEGIN;
UPDATE public.products
SET name_ru='Айран турецкий',name_vi='Ayran Thổ Nhĩ Kỳ',name_en='Turkish Ayran',
    image_url='https://ummaibrahim24072026-netizen.github.io/umma-global-mini-app/logo/assets/menu/turkish-ayran-500-white.webp'
WHERE product_type='cafe' AND sku='UMMA-CAFE-AYRAN-500';
UPDATE public.products
SET image_url='https://ummaibrahim24072026-netizen.github.io/umma-global-mini-app/logo/assets/menu/black-tea-lemon-piala-v2.webp'
WHERE product_type='cafe' AND sku='UMMA-CAFE-BLACK-TEA-LEMON-900';
COMMIT;
