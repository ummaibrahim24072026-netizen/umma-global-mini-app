BEGIN;

DO $$
DECLARE
  v_location constant uuid := 'e22788bd-4734-4b3a-911e-ba103d52617a';
  v_product uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('UMMA-CAFE-FRIED-EGGS'));
  IF EXISTS (SELECT 1 FROM public.products WHERE sku = 'UMMA-CAFE-FRIED-EGGS') THEN
    RAISE EXCEPTION 'Fried eggs already exist. Opening stock was not changed.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.locations
    WHERE id = v_location AND is_active AND ready_stock_enabled
  ) THEN
    RAISE EXCEPTION 'Ready portions are unavailable for this cafe.';
  END IF;

  INSERT INTO public.products (
    category_id, sku, product_type, name_ru, name_vi, name_en,
    description_ru, description_vi, description_en, price_vnd, image_url, sort_order, is_active
  ) VALUES (
    'd22ef2e3-ead7-44e5-901c-e58acabe7d3e', 'UMMA-CAFE-FRIED-EGGS', 'cafe',
    'Яичница из трёх яиц', 'Trứng ốp la (3 quả)', 'Sunny-side-up eggs (3 eggs)',
    'Три яйца, жаренные глазуньей.', 'Ba quả trứng chiên ốp la.', 'Three eggs fried sunny-side up.',
    40000, 'https://ummaibrahim24072026-netizen.github.io/umma-global-mini-app/logo/assets/menu/fried-eggs-white.webp',
    35, true
  ) RETURNING id INTO v_product;

  INSERT INTO public.cafe_web_sections (location_id, product_id, section)
  VALUES (v_location, v_product, 'daily');

  -- The catalog's product trigger creates a zero-quantity inventory row for the cafe.
  UPDATE public.inventory
  SET quantity = 3, ready_stock_confirmed = true, ready_stock_state = 'ready',
      is_available = true, updated_at = now()
  WHERE product_id = v_product AND location_id = v_location
    AND quantity = 0 AND reserved_quantity = 0;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The new product did not receive its empty inventory row.';
  END IF;

  INSERT INTO public.cafe_inventory_movements (location_id, product_id, movement_type, quantity, note)
  VALUES (v_location, v_product, 'stock_set', 3, 'Стартовый остаток по указанию владельца');
END $$;

COMMIT;
