-- Preview Market catalogue items without inventing sale prices or stock.
BEGIN;
ALTER TABLE public.products ALTER COLUMN price_vnd DROP NOT NULL;
ALTER TABLE public.products ADD CONSTRAINT non_market_product_price_required CHECK(product_type='market' OR price_vnd IS NOT NULL);
ALTER TABLE public.market_offers ALTER COLUMN price_vnd DROP NOT NULL;
DO $patch$
DECLARE src text;
BEGIN
 SELECT pg_get_functiondef('public.market_quote(uuid,jsonb)'::regprocedure) INTO src;
 IF position('Price not set' IN src)=0 THEN
  IF position('count_:=' IN src)=0 THEN RAISE EXCEPTION 'Market quote compatibility changed'; END IF;
  src:=replace(src,'count_:=',E'IF o.price_vnd IS NULL THEN RAISE EXCEPTION ''Price not set''; END IF;\n  count_:=');
  EXECUTE src;
 END IF;
END $patch$;
NOTIFY pgrst,'reload schema';
COMMIT;
