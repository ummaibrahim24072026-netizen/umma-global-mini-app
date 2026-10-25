-- Initial UMMA B2B catalog. Inactive until price, stock mapping and own photos are supplied.
-- Do not use third-party images.
insert into public.b2b_catalog (sku,name_ru,category,unit,active)
values
('UMMA-B2B-AYRAN-05','Айран турецкий 0,5 л','drinks','pcs',false),
('UMMA-B2B-AYRAN-DILL-05','Айран турецкий с укропом 0,5 л','drinks','pcs',false),
('UMMA-B2B-BLACKBERRY-05','Компот ежевичный 0,5 л','drinks','pcs',false),
('UMMA-B2B-CHICKEN','Курица','meat','kg',false),
('UMMA-B2B-MUTTON','Баранина','meat','kg',false),
('UMMA-B2B-LAMB','Ягнятина','meat','kg',false),
('UMMA-B2B-BEEF','Говядина','meat','kg',false),
('UMMA-B2B-FLATBREAD','Лепёшка UMMA','bakery','pcs',false),
('UMMA-B2B-SAMSA-CHICKEN','Самса с курицей','bakery','pcs',false),
('UMMA-B2B-SAMSA-LAMB','Самса с бараниной','bakery','pcs',false),
('UMMA-B2B-BAKLAVA-WALNUT','Пахлава с грецким орехом','bakery','pcs',false),
('UMMA-B2B-BAKLAVA-ALMOND','Пахлава с миндалём','bakery','pcs',false)
on conflict (sku) do nothing;
