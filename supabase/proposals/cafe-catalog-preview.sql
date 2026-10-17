-- Explicit Cafe previews can be published before a price is supplied.
BEGIN;
ALTER TABLE public.products ADD COLUMN catalog_preview boolean NOT NULL DEFAULT false;
ALTER TABLE public.products DROP CONSTRAINT non_market_product_price_required;
ALTER TABLE public.products ADD CONSTRAINT non_market_product_price_required
 CHECK(price_vnd IS NOT NULL OR product_type='market' OR (product_type='cafe' AND catalog_preview));
CREATE FUNCTION public.clear_priced_catalog_preview() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.price_vnd IS NOT NULL THEN NEW.catalog_preview:=false; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER clear_priced_catalog_preview BEFORE INSERT OR UPDATE ON public.products
 FOR EACH ROW EXECUTE FUNCTION public.clear_priced_catalog_preview();
DO $patch$
DECLARE src text;anchor text:='if not found then raise exception ''Product not found or unavailable''; end if;';
BEGIN
 SELECT pg_get_functiondef('public.reserve_cafe_inventory_for_order_item()'::regprocedure) INTO src;
 IF position(anchor IN src)=0 THEN RAISE EXCEPTION 'Cafe reservation compatibility changed'; END IF;
 src:=replace(src,anchor,anchor||E'\n  IF v_product.catalog_preview OR v_product.price_vnd IS NULL THEN RAISE EXCEPTION ''Cafe price not set''; END IF;');
 EXECUTE src;
END $patch$;
NOTIFY pgrst,'reload schema';
COMMIT;
