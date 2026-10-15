-- Confirmed by the cafe owner: beef borscht and lamb manti.
UPDATE public.products
SET description_ru = CASE sku
      WHEN 'UMMA-CAFE-BORSCHT' THEN 'Борщ с говядиной.'
      WHEN 'UMMA-CAFE-MANTI' THEN 'Сочные манты с бараниной, приготовленные на пару. 4 штуки — приблизительно 400 г.' END,
    description_en = CASE sku
      WHEN 'UMMA-CAFE-BORSCHT' THEN 'Borscht with beef.'
      WHEN 'UMMA-CAFE-MANTI' THEN 'Juicy Central Asian dumplings with lamb filling, steamed until tender. Four pieces, approx. 400 g.' END,
    description_vi = CASE sku
      WHEN 'UMMA-CAFE-BORSCHT' THEN 'Súp củ dền với thịt bò.'
      WHEN 'UMMA-CAFE-MANTI' THEN 'Manti nhân thịt cừu mọng nước, hấp chín mềm. 4 cái, khoảng 400 g.' END
WHERE product_type = 'cafe' AND sku IN ('UMMA-CAFE-BORSCHT', 'UMMA-CAFE-MANTI')
RETURNING sku, description_ru, description_en, description_vi;
