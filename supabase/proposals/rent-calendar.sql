-- Public availability contains dates and booleans only; no customer or booking data.
BEGIN;
CREATE OR REPLACE FUNCTION public.rent_calendar(p_vehicle uuid,p_month date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE first_ date:=date_trunc('month',p_month)::date;today_ date:=(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
BEGIN
 IF p_month IS NULL OR first_<date_trunc('month',today_)::date OR first_>date_trunc('month',today_+180)::date THEN RAISE EXCEPTION 'RENT_DATES';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.rent_vehicles WHERE id=p_vehicle AND published AND condition='ready') THEN RAISE EXCEPTION 'RENT_UNAVAILABLE';END IF;
 RETURN jsonb_build_object('ok',true,'days',(SELECT jsonb_agg(jsonb_build_object('date',d::date,'available',public.rent_available(p_vehicle,d::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh',(d::date+1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')) ORDER BY d) FROM generate_series(first_::timestamp,(first_+interval '1 month - 1 day')::timestamp,interval '1 day') d));
END$$;
REVOKE ALL ON FUNCTION public.rent_calendar(uuid,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rent_calendar(uuid,date) TO service_role;
COMMIT;

-- A request changes no agreed term or payment until staff approves an extension.
BEGIN;
ALTER TABLE public.rent_bookings ADD COLUMN IF NOT EXISTS extension_requested_until timestamptz;
CREATE OR REPLACE FUNCTION public.rent_extension_request(p_actor bigint,p_request uuid,p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE b public.rent_bookings;prior public.rent_operations;until_ timestamptz;result_ jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.telegram_users WHERE telegram_id=p_actor AND is_active) THEN RAISE EXCEPTION 'RENT_ACCESS';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('rent:'||p_actor::text,0));
 SELECT * INTO prior FROM public.rent_operations WHERE actor_id=p_actor AND request_id=p_request;
 IF FOUND THEN IF prior.action<>'extension_request' OR prior.payload IS DISTINCT FROM p_data THEN RAISE EXCEPTION 'RENT_REPLAY';END IF;RETURN prior.result;END IF;
 SELECT * INTO b FROM public.rent_bookings WHERE id=(p_data->>'id')::uuid;
 IF b.id IS NULL OR b.customer_id<>p_actor THEN RAISE EXCEPTION 'RENT_ACCESS';END IF;
 PERFORM 1 FROM public.rent_vehicles WHERE id=b.vehicle_id FOR UPDATE;
 SELECT * INTO b FROM public.rent_bookings WHERE id=b.id FOR UPDATE;
 IF b.version IS DISTINCT FROM (p_data->>'version')::integer THEN RAISE EXCEPTION 'RENT_STALE';END IF;
 until_:=(p_data->>'ends_at')::timestamptz;
 IF b.status NOT IN ('confirmed','active') OR b.checkin IS NOT NULL OR until_ IS NULL OR until_<=b.ends_at OR until_-b.starts_at>interval '90 days' OR NOT public.rent_available(b.vehicle_id,b.ends_at,until_,b.id) THEN RAISE EXCEPTION 'RENT_UNAVAILABLE';END IF;
 UPDATE public.rent_bookings SET extension_requested_until=until_,version=version+1,updated_at=now() WHERE id=b.id RETURNING * INTO b;
 INSERT INTO public.rent_events(booking_id,actor_id,action,detail) VALUES(b.id,p_actor,'extension_request',jsonb_build_object('ends_at',until_));
 result_:=jsonb_build_object('ok',true,'booking',to_jsonb(b));
 INSERT INTO public.rent_operations(actor_id,request_id,action,payload,result) VALUES(p_actor,p_request,'extension_request',p_data,result_);
 RETURN result_;
END$$;
REVOKE ALL ON FUNCTION public.rent_extension_request(bigint,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rent_extension_request(bigint,uuid,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.rent_clear_extension_request() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.ends_at IS DISTINCT FROM OLD.ends_at AND NEW.extension_requested_until<=NEW.ends_at OR NEW.status IN ('cancelled','expired','closed') THEN NEW.extension_requested_until:=NULL;END IF;
 RETURN NEW;
END$$;
REVOKE ALL ON FUNCTION public.rent_clear_extension_request() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER rent_clear_extension_request BEFORE UPDATE ON public.rent_bookings FOR EACH ROW EXECUTE FUNCTION public.rent_clear_extension_request();
COMMIT;
