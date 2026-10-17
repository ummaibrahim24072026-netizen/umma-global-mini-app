-- Apply the meat quality gate to both existing and new catalogue category names.
BEGIN;
CREATE FUNCTION public.market_require_meat_evidence() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.products p JOIN public.categories c ON c.id=p.category_id
 WHERE p.id=NEW.product_id AND c.category_type='market'
 AND (c.name_en ~* '(meat|poultry|chicken)' OR c.name_ru ~* '(мяс|птиц|куриц)')) THEN
  NEW.requires_quality_evidence:=true;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER market_require_meat_evidence BEFORE INSERT OR UPDATE ON public.market_product_variants
FOR EACH ROW EXECUTE FUNCTION public.market_require_meat_evidence();
REVOKE ALL ON FUNCTION public.market_require_meat_evidence() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.market_require_meat_evidence() TO service_role;
COMMIT;
