-- Per-branch delivery service polygons; [latitude, longitude], no closing duplicate.
BEGIN;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS delivery_zone jsonb;

CREATE OR REPLACE FUNCTION public.cafe_valid_delivery_zone(z jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public AS $$
DECLARE n integer; i integer; j integer; a point; b point; c point; d point; area double precision:=0;
BEGIN
 IF z IS NULL THEN RETURN true; END IF;
 IF jsonb_typeof(z)<>'array' THEN RETURN false; END IF;
 n:=jsonb_array_length(z); IF n<3 OR n>100 THEN RETURN false; END IF;
 FOR i IN 0..n-1 LOOP
  IF jsonb_typeof(z->i)<>'array' OR jsonb_array_length(z->i)<>2 THEN RETURN false; END IF;
  IF jsonb_typeof(z->i->0)<>'number' OR jsonb_typeof(z->i->1)<>'number' THEN RETURN false; END IF;
  IF abs((z->i->>0)::double precision)>90 OR abs((z->i->>1)::double precision)>180 THEN RETURN false; END IF;
 END LOOP;
 FOR i IN 0..n-1 LOOP
  a:=point((z->i->>1)::double precision,(z->i->>0)::double precision);
  b:=point((z->((i+1)%n)->>1)::double precision,(z->((i+1)%n)->>0)::double precision);
  IF a~=b THEN RETURN false; END IF;
  area:=area+a[0]*b[1]-b[0]*a[1];
  FOR j IN i+1..n-1 LOOP
   IF j=(i+1)%n OR (j+1)%n=i THEN CONTINUE; END IF;
   c:=point((z->j->>1)::double precision,(z->j->>0)::double precision);
   d:=point((z->((j+1)%n)->>1)::double precision,(z->((j+1)%n)->>0)::double precision);
   IF lseg(a,b) ?# lseg(c,d) THEN RETURN false; END IF;
  END LOOP;
 END LOOP;
 RETURN abs(area)>1e-10;
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
ALTER TABLE public.locations ADD CONSTRAINT locations_delivery_zone_valid CHECK (public.cafe_valid_delivery_zone(delivery_zone));

CREATE OR REPLACE FUNCTION public.cafe_delivery_zone_contains(z jsonb, lat double precision, lng double precision)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public AS $$
DECLARE i integer; j integer; n integer; ay double precision; ax double precision; by_ double precision; bx double precision; cross_ double precision; inside_ boolean:=false;
BEGIN
 IF z IS NULL OR lat IS NULL OR lng IS NULL OR NOT (lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180) THEN RETURN false; END IF;
 n:=jsonb_array_length(z); IF n<3 THEN RETURN false; END IF; j:=n-1;
 FOR i IN 0..n-1 LOOP
  ay:=(z->j->>0)::double precision; ax:=(z->j->>1)::double precision;
  by_:=(z->i->>0)::double precision; bx:=(z->i->>1)::double precision;
  cross_:=(lng-ax)*(by_-ay)-(lat-ay)*(bx-ax);
  IF abs(cross_)<=1e-10 AND lng BETWEEN least(ax,bx)-1e-10 AND greatest(ax,bx)+1e-10 AND lat BETWEEN least(ay,by_)-1e-10 AND greatest(ay,by_)+1e-10 THEN RETURN true; END IF;
  IF (ay>lat)<>(by_>lat) THEN
   IF lng<(bx-ax)*(lat-ay)/(by_-ay)+ax THEN inside_:=NOT inside_; END IF;
  END IF;
  j:=i;
 END LOOP;
 RETURN inside_;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_cafe_delivery_zone()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE zone_ jsonb; coordinates_ text[];
BEGIN
 IF NEW.order_type<>'delivery' THEN RETURN NEW; END IF;
 SELECT delivery_zone INTO zone_ FROM public.locations WHERE id=NEW.location_id AND is_active=true FOR SHARE;
 IF zone_ IS NULL THEN RAISE EXCEPTION 'DELIVERY_UNAVAILABLE'; END IF;
 -- Only one canonical trailing coordinate line is accepted, including cached clients.
 coordinates_:=regexp_match(coalesce(NEW.delivery_address,''), E'(?:^|\n)Точка доставки: (-?[0-9]+(?:\\.[0-9]+)?),[ ]*(-?[0-9]+(?:\\.[0-9]+)?)$');
 IF coordinates_ IS NULL OR cardinality(string_to_array(NEW.delivery_address,'Точка доставки:'))<>2 THEN RAISE EXCEPTION 'DELIVERY_POINT_REQUIRED'; END IF;
 IF NOT public.cafe_delivery_zone_contains(zone_,coordinates_[1]::double precision,coordinates_[2]::double precision) THEN RAISE EXCEPTION 'DELIVERY_OUTSIDE_ZONE'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER cafe_orders_delivery_zone BEFORE INSERT OR UPDATE OF delivery_address,location_id,order_type ON public.cafe_orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_cafe_delivery_zone();

CREATE OR REPLACE FUNCTION public.admin_set_cafe_delivery_zone(p_actor bigint,p_location uuid,p_zone jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.telegram_users WHERE telegram_id=p_actor AND is_active=true AND role='super_admin') THEN RAISE EXCEPTION 'Delivery zone access denied'; END IF;
 IF NOT public.cafe_valid_delivery_zone(p_zone) THEN RAISE EXCEPTION 'Invalid delivery zone'; END IF;
 UPDATE public.locations SET delivery_zone=p_zone,updated_at=now() WHERE id=p_location AND location_type IN ('cafe','restaurant');
 IF NOT FOUND THEN RAISE EXCEPTION 'Cafe location not found'; END IF;
 RETURN p_zone;
END;
$$;
REVOKE ALL ON FUNCTION public.cafe_valid_delivery_zone(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.cafe_delivery_zone_contains(jsonb,double precision,double precision) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cafe_valid_delivery_zone(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.cafe_delivery_zone_contains(jsonb,double precision,double precision) TO service_role;
REVOKE ALL ON FUNCTION public.enforce_cafe_delivery_zone() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.admin_set_cafe_delivery_zone(bigint,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_cafe_delivery_zone(bigint,uuid,jsonb) TO service_role;
-- Service footprint chosen by the owner: urban mainland Nha Trang, no islands or surrounding resorts.
-- This is an operational service zone, not an administrative boundary.
UPDATE public.locations SET delivery_zone='[[12.32,109.185],[12.32,109.207],[12.305,109.214],[12.287,109.210],[12.276,109.207],[12.268,109.206],[12.259,109.2005],[12.242,109.198],[12.227,109.204],[12.211,109.214],[12.201,109.218],[12.187,109.216],[12.18,109.205],[12.18,109.185],[12.20,109.17],[12.23,109.15],[12.27,109.15],[12.30,109.17]]'::jsonb
WHERE location_type='cafe' AND lower(trim(city))='nha trang' AND latitude BETWEEN 12.18 AND 12.32 AND longitude BETWEEN 109.15 AND 109.218;
COMMIT;
