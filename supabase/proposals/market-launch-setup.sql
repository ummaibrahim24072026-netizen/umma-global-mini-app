-- Deployment setup. No inventory, prices or customer transactions are fabricated.
BEGIN;
INSERT INTO public.categories(name_ru,name_en,name_vi,category_type,sort_order)
SELECT c.ru,c.en,c.vi,'market',c.position FROM (VALUES
 ('Овощи','Vegetables','Rau củ',10),('Фрукты','Fruit','Trái cây',20),
 ('Мясо','Meat','Thịt',30),('Птица','Poultry','Gia cầm',40),
 ('Молочные продукты','Dairy','Sản phẩm sữa',50),('Бакалея','Groceries','Thực phẩm khô',60),
 ('Крупы','Grains','Ngũ cốc',70),('Специи','Spices','Gia vị',80),
 ('Хлеб и выпечка','Bread and bakery','Bánh mì và bánh nướng',90),
 ('Напитки','Drinks','Đồ uống',100),('Замороженные продукты','Frozen food','Thực phẩm đông lạnh',110),
 ('Сладости','Sweets','Bánh kẹo',120),('Бытовые товары','Household goods','Đồ gia dụng',130),
 ('Упаковка и расходные материалы','Packaging and supplies','Bao bì và vật tư',140)
) c(ru,en,vi,position) WHERE NOT EXISTS(SELECT 1 FROM public.categories e WHERE e.category_type='market' AND e.name_ru=c.ru);
-- Share the existing payment/delivery location, retaining separate warehouse stock.
INSERT INTO public.market_warehouses(location_id,name)
SELECT id,'UMMA Market — Nha Trang' FROM public.locations
WHERE name='HALAL UMMA' AND city='Nha Trang' AND is_active
ON CONFLICT(location_id,name) DO NOTHING;
-- Existing managers retain administrative scope. Additional roles are explicitly assigned in Market settings.
INSERT INTO public.market_staff_roles(telegram_id,location_id,role)
SELECT s.telegram_id,s.location_id,'admin' FROM public.cafe_staff s
JOIN public.telegram_users u ON u.telegram_id=s.telegram_id AND u.is_active
WHERE s.is_active AND s.staff_role='manager' AND EXISTS(SELECT 1 FROM public.market_warehouses w WHERE w.location_id=s.location_id)
ON CONFLICT DO NOTHING;
INSERT INTO public.market_staff_roles(telegram_id,location_id,role)
SELECT s.telegram_id,s.location_id,'cashier' FROM public.cafe_staff s
JOIN public.telegram_users u ON u.telegram_id=s.telegram_id AND u.is_active
WHERE s.is_active AND s.staff_role='cashier' AND s.can_accept_payments
AND EXISTS(SELECT 1 FROM public.market_warehouses w WHERE w.location_id=s.location_id)
ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('market-catalog','market-catalog',true,5242880,ARRAY['image/jpeg','image/png','image/webp']),
('market-evidence','market-evidence',false,5242880,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT(id) DO NOTHING;
-- Restrictive policy also holds if other modules add permissive storage policies later.
CREATE POLICY market_files_service_only ON storage.objects AS RESTRICTIVE FOR ALL TO anon,authenticated
USING(bucket_id NOT IN ('market-catalog','market-evidence'))
WITH CHECK(bucket_id NOT IN ('market-catalog','market-evidence'));
SELECT cron.schedule('umma-market-maintenance','* * * * *','select public.market_expire_reservations();');
NOTIFY pgrst,'reload schema';
COMMIT;
