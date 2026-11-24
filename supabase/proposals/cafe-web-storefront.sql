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

COMMIT;
