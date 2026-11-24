BEGIN;

CREATE TABLE public.cafe_web_sections (
  location_id uuid NOT NULL REFERENCES public.locations(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  section text NOT NULL CHECK (section IN ('breakfast','lunch','dinner','dish-day','family','daily')),
  enabled boolean NOT NULL DEFAULT true,
  allow_preorder boolean NOT NULL DEFAULT false,
  service_date date,
  starts_at time,
  ends_at time,
  PRIMARY KEY (location_id, product_id, section),
  CHECK (section <> 'dish-day' OR service_date IS NOT NULL),
  CHECK ((starts_at IS NULL AND ends_at IS NULL) OR
         (starts_at IS NOT NULL AND ends_at IS NOT NULL AND starts_at <> ends_at))
);

ALTER TABLE public.cafe_web_sections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cafe_web_sections FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.cafe_web_sections TO service_role;

CREATE FUNCTION public.cafe_web_section_catalog(p_location uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  WITH local_clock AS (
    SELECT CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh' AS point
  )
  SELECT coalesce(jsonb_agg(
    jsonb_build_object('section', s.section, 'productId', s.product_id, 'allowPreorder', s.allow_preorder)
    ORDER BY s.section, s.product_id
  ), '[]'::jsonb)
  FROM public.cafe_web_sections s
  JOIN public.products p ON p.id = s.product_id
  CROSS JOIN local_clock
  WHERE s.location_id = p_location AND s.enabled
    AND p.product_type = 'cafe' AND p.is_active AND NOT p.catalog_preview
    AND (s.service_date IS NULL OR s.service_date = CASE
      WHEN s.starts_at > s.ends_at AND local_clock.point::time < s.ends_at
        THEN local_clock.point::date - 1
      ELSE local_clock.point::date
    END)
    AND (s.starts_at IS NULL OR
      CASE WHEN s.starts_at < s.ends_at
        THEN local_clock.point::time >= s.starts_at AND local_clock.point::time < s.ends_at
        ELSE local_clock.point::time >= s.starts_at OR local_clock.point::time < s.ends_at
      END)
$$;

REVOKE ALL ON FUNCTION public.cafe_web_section_catalog(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cafe_web_section_catalog(uuid) TO service_role;

-- Initial placements use existing meals. Prices and availability are resolved by the normal cafe catalog.
WITH initial(section, sku) AS (
 VALUES
  ('breakfast','UMMA-CAFE-CROISSANT'),
  ('breakfast','UMMA-CAFE-CHEESE-KHACHAPURI'),
  ('breakfast','UMMA-CAFE-SAMSA'),
  ('breakfast','UMMA-CAFE-SAMSA-CHICKEN'),
  ('breakfast','UMMA-CAFE-GREEN-TEA-900'),
  ('breakfast','UMMA-CAFE-BLACK-TEA-LEMON-900'),
  ('lunch','UMMA-CAFE-SHURPA'),
  ('lunch','UMMA-CAFE-BORSCHT'),
  ('lunch','UMMA-CAFE-PLOV'),
  ('lunch','UMMA-CAFE-SAMSA'),
  ('lunch','UMMA-CAFE-CHICKEN-LEG-SALAD'),
  ('dinner','UMMA-CAFE-MANTI'),
  ('dinner','UMMA-CAFE-PLOV'),
  ('dinner','UMMA-CAFE-GRILLED-CHICKEN-WINGS'),
  ('dinner','UMMA-CAFE-CHICKEN-LEG-SALAD'),
  ('dinner','UMMA-CAFE-SALAD')
)
INSERT INTO public.cafe_web_sections (location_id, product_id, section, allow_preorder)
SELECT l.id, p.id, initial.section, true
FROM initial JOIN public.products p ON p.sku=initial.sku
CROSS JOIN public.locations l
WHERE l.id='e22788bd-4734-4b3a-911e-ba103d52617a'::uuid
  AND l.is_active AND p.product_type='cafe' AND p.is_active AND NOT p.catalog_preview
ON CONFLICT DO NOTHING;

COMMIT;
