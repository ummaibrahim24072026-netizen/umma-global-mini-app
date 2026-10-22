-- UMMA Rent. All writes go through Telegram-authenticated rent-service.
BEGIN;
CREATE TABLE public.rent_staff (
 telegram_id bigint PRIMARY KEY REFERENCES public.telegram_users(telegram_id),
 is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.rent_vehicles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 120),
 plate text UNIQUE CHECK(length(trim(plate)) BETWEEN 2 AND 40),
 description text NOT NULL DEFAULT '' CHECK(length(description)<=3000),
 specs text NOT NULL DEFAULT '' CHECK(length(specs)<=500),
 pickup text NOT NULL CHECK(length(trim(pickup)) BETWEEN 3 AND 500),
 accessories text NOT NULL DEFAULT '' CHECK(length(accessories)<=500),
 condition text NOT NULL DEFAULT 'ready' CHECK(condition IN ('ready','maintenance','retired')),
 published boolean NOT NULL DEFAULT false CHECK(NOT published OR plate IS NOT NULL), version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.rent_bookings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 vehicle_id uuid NOT NULL REFERENCES public.rent_vehicles(id), customer_id bigint NOT NULL REFERENCES public.telegram_users(telegram_id),
 customer_name text NOT NULL CHECK(length(trim(customer_name)) BETWEEN 1 AND 120), phone text NOT NULL CHECK(length(trim(phone)) BETWEEN 5 AND 60),
 starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, CHECK(ends_at>starts_at),
 days integer NOT NULL CHECK(days BETWEEN 1 AND 90), daily_vnd integer NOT NULL DEFAULT 400000 CHECK(daily_vnd=400000),
 total_vnd integer NOT NULL CHECK(total_vnd=days*daily_vnd), paid_vnd integer NOT NULL DEFAULT 0 CHECK(paid_vnd>=0),
 currency text NOT NULL CHECK(currency IN ('VND','USD')),
 deposit_amount numeric(14,2) NOT NULL CHECK((currency='VND' AND deposit_amount=5000000) OR (currency='USD' AND deposit_amount=200)),
 deposit_received boolean NOT NULL DEFAULT false, deposit_returned boolean NOT NULL DEFAULT false,
 status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','confirmed','active','returned','closed','cancelled','expired')),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '30 minutes',
 vehicle_snapshot jsonb NOT NULL, terms_version text NOT NULL DEFAULT 'rent-v1',
 checkout jsonb, checkin jsonb, checkout_accepted boolean NOT NULL DEFAULT false, checkin_accepted boolean NOT NULL DEFAULT false,
 settlement jsonb, settlement_accepted boolean NOT NULL DEFAULT false,
 issued_at timestamptz,returned_at timestamptz, closed_at timestamptz,
 version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rent_bookings_vehicle_time ON public.rent_bookings(vehicle_id,starts_at,ends_at);
CREATE INDEX rent_bookings_customer ON public.rent_bookings(customer_id,created_at DESC);
CREATE INDEX rent_bookings_status ON public.rent_bookings(status,ends_at);
CREATE TABLE public.rent_media (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), vehicle_id uuid REFERENCES public.rent_vehicles(id), booking_id uuid REFERENCES public.rent_bookings(id),
 stage text NOT NULL CHECK(stage IN ('catalog','checkout','checkin','fuel')),
 kind text NOT NULL CHECK(kind IN ('photo','video')), bucket text NOT NULL CHECK(bucket IN ('rent-catalog','rent-evidence')),
 path text NOT NULL UNIQUE, mime text NOT NULL, size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 1 AND 52428800),
 uploaded boolean NOT NULL DEFAULT false, position integer NOT NULL DEFAULT 0, actor_id bigint NOT NULL REFERENCES public.telegram_users(telegram_id),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((stage='catalog' AND vehicle_id IS NOT NULL AND booking_id IS NULL AND kind='photo' AND bucket='rent-catalog') OR (stage<>'catalog' AND booking_id IS NOT NULL AND vehicle_id IS NULL AND bucket='rent-evidence'))
);
CREATE INDEX rent_media_vehicle ON public.rent_media(vehicle_id,position);
CREATE INDEX rent_media_booking ON public.rent_media(booking_id,stage);
CREATE INDEX rent_media_actor ON public.rent_media(actor_id);
CREATE TABLE public.rent_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,booking_id uuid NOT NULL REFERENCES public.rent_bookings(id),
 actor_id bigint NOT NULL REFERENCES public.telegram_users(telegram_id), action text NOT NULL, detail jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rent_events_booking ON public.rent_events(booking_id,id);
CREATE INDEX rent_events_actor ON public.rent_events(actor_id);
CREATE TABLE public.rent_operations (
 actor_id bigint NOT NULL REFERENCES public.telegram_users(telegram_id),request_id uuid NOT NULL,action text NOT NULL,payload jsonb NOT NULL,result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(actor_id,request_id)
);
DO $$DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['rent_staff','rent_vehicles','rent_bookings','rent_media','rent_events','rent_operations'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
 EXECUTE format('GRANT SELECT,INSERT,UPDATE ON public.%I TO service_role',t);
 END LOOP;END$$;
REVOKE UPDATE ON public.rent_events,public.rent_operations FROM service_role;
GRANT USAGE,SELECT ON SEQUENCE public.rent_bookings_number_seq,public.rent_events_id_seq TO service_role;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES
 ('rent-catalog','rent-catalog',true,10485760,ARRAY['image/jpeg','image/png','image/webp']),
 ('rent-evidence','rent-evidence',false,52428800,ARRAY['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime']);

CREATE FUNCTION public.rent_manager(p_actor bigint) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.telegram_users u WHERE telegram_id=p_actor AND is_active AND (role='super_admin' OR EXISTS(SELECT 1 FROM public.rent_staff s WHERE s.telegram_id=p_actor AND s.is_active)));
$$;
CREATE FUNCTION public.rent_available(p_vehicle uuid,p_start timestamptz,p_end timestamptz,p_skip uuid DEFAULT NULL) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT NOT EXISTS(SELECT 1 FROM public.rent_bookings b WHERE b.vehicle_id=p_vehicle AND b.id IS DISTINCT FROM p_skip AND (
 b.status IN ('active','returned') AND (b.status='returned' OR b.ends_at<now()) OR
 (b.status IN ('confirmed','active') OR b.status='reserved' AND b.expires_at>now()) AND
 b.starts_at<p_end+interval '1 hour' AND b.ends_at+interval '1 hour'>p_start));
$$;
CREATE FUNCTION public.rent_catalog(p_start timestamptz DEFAULT NULL,p_end timestamptz DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF (p_start IS NULL)<>(p_end IS NULL) OR p_start IS NOT NULL AND (p_end<=p_start OR p_end-p_start>interval '90 days') THEN RAISE EXCEPTION 'RENT_DATES'; END IF;
 RETURN jsonb_build_object('ok',true,'daily_vnd',400000,'vehicles',coalesce((SELECT jsonb_agg(x ORDER BY x->>'name') FROM (
 SELECT jsonb_build_object('id',v.id,'name',v.name,'description',v.description,'specs',v.specs,'pickup',v.pickup,'accessories',v.accessories,'available',CASE WHEN p_start IS NULL THEN NULL ELSE public.rent_available(v.id,p_start,p_end) END,
 'photos',coalesce((SELECT jsonb_agg(jsonb_build_object('id',m.id,'path',m.path) ORDER BY m.position,m.created_at) FROM public.rent_media m WHERE m.vehicle_id=v.id AND m.uploaded),'[]')) x
 FROM public.rent_vehicles v WHERE v.published AND v.condition='ready')q),'[]'));
END$$;
CREATE FUNCTION public.rent_state(p_actor bigint,p_staff boolean DEFAULT false,p_before bigint DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE manager_ boolean; rows_ jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.telegram_users WHERE telegram_id=p_actor AND is_active) THEN RAISE EXCEPTION 'RENT_ACCESS';END IF;
 manager_:=public.rent_manager(p_actor);
 IF p_staff AND NOT manager_ THEN RAISE EXCEPTION 'RENT_ACCESS';END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.number DESC),'[]') INTO rows_ FROM (
 SELECT b.* FROM public.rent_bookings b WHERE (p_staff OR b.customer_id=p_actor) AND (p_before IS NULL OR b.number<p_before) ORDER BY b.number DESC LIMIT 100)q;
 RETURN jsonb_build_object('ok',true,'manager',manager_,'super_admin',EXISTS(SELECT 1 FROM public.telegram_users WHERE telegram_id=p_actor AND role='super_admin' AND is_active),
 'bookings',rows_, 'vehicles',CASE WHEN p_staff THEN coalesce((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.name) FROM public.rent_vehicles v),'[]') ELSE '[]'::jsonb END,
 'staff',CASE WHEN p_staff AND EXISTS(SELECT 1 FROM public.telegram_users WHERE telegram_id=p_actor AND role='super_admin') THEN coalesce((SELECT jsonb_agg(to_jsonb(s)) FROM public.rent_staff s),'[]') ELSE '[]'::jsonb END);
END$$;
CREATE FUNCTION public.rent_detail(p_actor bigint,p_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE b public.rent_bookings;
BEGIN
 SELECT * INTO b FROM public.rent_bookings WHERE id=p_id;
 IF b.id IS NULL OR NOT EXISTS(SELECT 1 FROM public.telegram_users WHERE telegram_id=p_actor AND is_active) OR (b.customer_id<>p_actor AND NOT public.rent_manager(p_actor)) THEN RAISE EXCEPTION 'RENT_ACCESS';END IF;
 RETURN jsonb_build_object('ok',true,'booking',to_jsonb(b),'media',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.created_at) FROM public.rent_media m WHERE booking_id=p_id AND uploaded),'[]'),
 'events',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id) FROM public.rent_events e WHERE booking_id=p_id),'[]'));
END$$;
CREATE FUNCTION public.rent_operation(p_actor bigint,p_request uuid,p_action text,p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,storage AS $$
DECLARE mgr boolean;super_ boolean;prior public.rent_operations;b public.rent_bookings;v public.rent_vehicles;m public.rent_media;
 result_ jsonb;doc jsonb;stage_ text;st timestamptz;en timestamptz;days_ integer;fuel numeric;rate_ numeric;deduction numeric;amount_ numeric;media_id uuid;ref_ text;
BEGIN
 IF p_request IS NULL OR p_action IS NULL OR p_data IS NULL OR jsonb_typeof(p_data)<>'object' THEN RAISE EXCEPTION 'RENT_INVALID';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.telegram_users WHERE telegram_id=p_actor AND is_active) THEN RAISE EXCEPTION 'RENT_ACCESS';END IF;
 mgr:=public.rent_manager(p_actor);SELECT role='super_admin' INTO super_ FROM public.telegram_users WHERE telegram_id=p_actor;
 IF p_action NOT IN ('book','cancel','accept_checkout','accept_checkin','accept_settlement') AND NOT mgr THEN RAISE EXCEPTION 'RENT_ACCESS';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('rent:'||p_actor::text,0));
 SELECT * INTO prior FROM public.rent_operations WHERE actor_id=p_actor AND request_id=p_request;
 IF FOUND THEN
  IF prior.action<>p_action OR prior.payload<>p_data THEN RAISE EXCEPTION 'RENT_KEY_REUSED';END IF;
  RETURN prior.result||jsonb_build_object('replayed',true);
 END IF;
 IF p_action='staff' THEN
  IF NOT super_ THEN RAISE EXCEPTION 'RENT_ACCESS';END IF;
  IF NOT EXISTS(SELECT 1 FROM public.telegram_users WHERE telegram_id=(p_data->>'telegram_id')::bigint AND is_active) THEN RAISE EXCEPTION 'RENT_USER';END IF;
  INSERT INTO public.rent_staff(telegram_id,is_active)VALUES((p_data->>'telegram_id')::bigint,(p_data->>'is_active')::boolean) ON CONFLICT(telegram_id)DO UPDATE SET is_active=excluded.is_active;
  result_:=jsonb_build_object('ok',true);
 ELSIF p_action='vehicle_save' THEN
  IF p_data->>'id' IS NOT NULL THEN
   SELECT * INTO v FROM public.rent_vehicles WHERE id=(p_data->>'id')::uuid FOR UPDATE;
   IF v.id IS NULL OR v.version IS DISTINCT FROM (p_data->>'version')::integer THEN RAISE EXCEPTION 'RENT_STALE';END IF;
   IF (p_data->>'published')::boolean AND NOT EXISTS(SELECT 1 FROM public.rent_media WHERE vehicle_id=v.id AND uploaded) THEN RAISE EXCEPTION 'RENT_PHOTOS';END IF;
   UPDATE public.rent_vehicles SET name=trim(p_data->>'name'),plate=upper(nullif(trim(p_data->>'plate'),'')),description=coalesce(p_data->>'description',''),specs=coalesce(p_data->>'specs',''),pickup=trim(p_data->>'pickup'),accessories=coalesce(p_data->>'accessories',''),condition=p_data->>'condition',published=(p_data->>'published')::boolean,version=version+1,updated_at=now() WHERE id=v.id RETURNING * INTO v;
  ELSE
   INSERT INTO public.rent_vehicles(name,plate,description,specs,pickup,accessories)VALUES(trim(p_data->>'name'),upper(nullif(trim(p_data->>'plate'),'')),coalesce(p_data->>'description',''),coalesce(p_data->>'specs',''),trim(p_data->>'pickup'),coalesce(p_data->>'accessories',''))RETURNING * INTO v;
  END IF;
  result_:=jsonb_build_object('ok',true,'vehicle',to_jsonb(v));
 ELSIF p_action IN ('media_start','media_finish','media_order') THEN
  IF p_action='media_start' THEN
   stage_:=p_data->>'stage';
   IF stage_='catalog' THEN
    SELECT * INTO v FROM public.rent_vehicles WHERE id=(p_data->>'vehicle_id')::uuid FOR UPDATE;
    IF v.id IS NULL OR (SELECT count(*) FROM public.rent_media WHERE vehicle_id=v.id AND uploaded)>=15 THEN RAISE EXCEPTION 'RENT_MEDIA';END IF;
   ELSE
    SELECT * INTO b FROM public.rent_bookings WHERE id=(p_data->>'booking_id')::uuid FOR UPDATE;
    IF b.id IS NULL OR NOT ((stage_='checkout' AND b.status='confirmed' AND b.checkout IS NULL) OR (stage_='checkin' AND b.status='active' AND b.checkin IS NULL) OR (stage_='fuel' AND b.status='returned' AND b.settlement IS NULL)) THEN RAISE EXCEPTION 'RENT_STATE';END IF;
    IF (SELECT count(*) FROM public.rent_media WHERE booking_id=b.id AND stage=stage_ AND uploaded)>=20 THEN RAISE EXCEPTION 'RENT_MEDIA';END IF;
   END IF;
   IF NOT ((p_data->>'kind'='photo' AND p_data->>'mime' IN ('image/jpeg','image/png','image/webp') AND (p_data->>'size_bytes')::bigint<=10485760) OR (p_data->>'kind'='video' AND stage_ IN ('checkout','checkin') AND p_data->>'mime' IN ('video/mp4','video/webm','video/quicktime'))) THEN RAISE EXCEPTION 'RENT_MEDIA';END IF;
   media_id:=gen_random_uuid();
   INSERT INTO public.rent_media(id,vehicle_id,booking_id,stage,kind,bucket,path,mime,size_bytes,position,actor_id)
   VALUES(media_id,v.id,b.id,stage_,p_data->>'kind',CASE WHEN stage_='catalog' THEN 'rent-catalog' ELSE 'rent-evidence' END,
    coalesce(v.id,b.id)::text||'/'||stage_||'/'||media_id::text||CASE p_data->>'mime' WHEN 'image/jpeg' THEN '.jpg' WHEN 'image/png' THEN '.png' WHEN 'image/webp' THEN '.webp' WHEN 'video/mp4' THEN '.mp4' WHEN 'video/quicktime' THEN '.mov' ELSE '.webm' END,
    p_data->>'mime',(p_data->>'size_bytes')::bigint,coalesce((p_data->>'position')::integer,0),p_actor) RETURNING * INTO m;
  ELSE
   SELECT * INTO m FROM public.rent_media WHERE id=(p_data->>'media_id')::uuid FOR UPDATE;
   IF m.id IS NULL THEN RAISE EXCEPTION 'RENT_MEDIA';END IF;
   IF p_action='media_order' THEN
    IF m.stage<>'catalog' OR NOT m.uploaded THEN RAISE EXCEPTION 'RENT_MEDIA';END IF;
    UPDATE public.rent_media SET position=(p_data->>'position')::integer WHERE id=m.id RETURNING * INTO m;
   ELSE
    IF NOT m.uploaded AND m.booking_id IS NOT NULL THEN
     SELECT * INTO b FROM public.rent_bookings WHERE id=m.booking_id FOR UPDATE;
     IF NOT ((m.stage='checkout' AND b.status='confirmed' AND b.checkout IS NULL) OR (m.stage='checkin' AND b.status='active' AND b.checkin IS NULL) OR (m.stage='fuel' AND b.status='returned' AND b.settlement IS NULL)) THEN RAISE EXCEPTION 'RENT_STATE';END IF;
    END IF;
    IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id=m.bucket AND name=m.path AND (metadata->>'size')::bigint=m.size_bytes AND metadata->>'mimetype'=m.mime) THEN RAISE EXCEPTION 'RENT_UPLOAD';END IF;
    UPDATE public.rent_media SET uploaded=true WHERE id=m.id RETURNING * INTO m;
   END IF;
  END IF;
  result_:=jsonb_build_object('ok',true,'media',to_jsonb(m));
 ELSIF p_action='book' THEN
  st:=(p_data->>'starts_at')::timestamptz;en:=(p_data->>'ends_at')::timestamptz;
  IF st IS NULL OR en IS NULL OR st<now()-interval '5 minutes' OR st>now()+interval '180 days' OR en<=st OR en-st>interval '90 days' OR p_data->>'terms_version' IS DISTINCT FROM 'rent-v1' OR p_data->>'currency' NOT IN ('VND','USD') THEN RAISE EXCEPTION 'RENT_DATES';END IF;
  IF (SELECT count(*) FROM public.rent_bookings WHERE customer_id=p_actor AND created_at>now()-interval '1 day')>=10 THEN RAISE EXCEPTION 'RENT_LIMIT';END IF;
  SELECT * INTO v FROM public.rent_vehicles WHERE id=(p_data->>'vehicle_id')::uuid FOR UPDATE;
  IF v.id IS NULL OR NOT v.published OR v.condition<>'ready' THEN RAISE EXCEPTION 'RENT_UNAVAILABLE';END IF;
  UPDATE public.rent_bookings SET status='expired',version=version+1 WHERE vehicle_id=v.id AND status='reserved' AND expires_at<=now();
  IF NOT public.rent_available(v.id,st,en) THEN RAISE EXCEPTION 'RENT_UNAVAILABLE';END IF;
  days_:=ceil(extract(epoch FROM en-st)/86400.0);
  INSERT INTO public.rent_bookings(vehicle_id,customer_id,customer_name,phone,starts_at,ends_at,days,total_vnd,currency,deposit_amount,vehicle_snapshot)
  VALUES(v.id,p_actor,trim(p_data->>'customer_name'),trim(p_data->>'phone'),st,en,days_,days_*400000,p_data->>'currency',CASE p_data->>'currency' WHEN 'USD' THEN 200 ELSE 5000000 END,to_jsonb(v)-'published'-'version')RETURNING * INTO b;
 ELSIF p_action IN ('confirm','cancel','payment','inspection','accept_checkout','accept_checkin','issue','return','settle','accept_settlement','refund','extend','cancel_paid','reset_inspection') THEN
  -- Always lock vehicle before booking. All availability-changing operations share this order.
  SELECT * INTO b FROM public.rent_bookings WHERE id=(p_data->>'id')::uuid;
  IF b.id IS NULL OR (NOT mgr AND b.customer_id<>p_actor) THEN RAISE EXCEPTION 'RENT_ACCESS';END IF;
  SELECT * INTO v FROM public.rent_vehicles WHERE id=b.vehicle_id FOR UPDATE;
  SELECT * INTO b FROM public.rent_bookings WHERE id=b.id FOR UPDATE;
  IF b.version IS DISTINCT FROM (p_data->>'version')::integer THEN RAISE EXCEPTION 'RENT_STALE';END IF;
  IF p_action='confirm' THEN
   IF b.status<>'reserved' OR b.expires_at<=now() OR NOT v.published OR v.condition<>'ready' OR NOT public.rent_available(v.id,b.starts_at,b.ends_at,b.id) THEN RAISE EXCEPTION 'RENT_UNAVAILABLE';END IF;
   b.status:='confirmed';
  ELSIF p_action='cancel' THEN
   IF b.status NOT IN ('reserved','confirmed') OR b.paid_vnd>0 OR b.deposit_received THEN RAISE EXCEPTION 'RENT_STATE';END IF;
   b.status:='cancelled';
  ELSIF p_action='cancel_paid' THEN
   IF b.status<>'confirmed' OR (b.paid_vnd=0 AND NOT b.deposit_received) OR length(trim(coalesce(p_data->>'reference','')))<3 OR length(p_data->>'reference')>300 OR p_data->>'fully_refunded' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'RENT_REFUND';END IF;
   b.status:='cancelled';b.deposit_returned:=b.deposit_received;b.closed_at:=now();
  ELSIF p_action='reset_inspection' THEN
   stage_:=p_data->>'stage';
   IF stage_='checkout' AND b.status='confirmed' AND b.checkout IS NOT NULL AND NOT b.checkout_accepted THEN b.checkout:=NULL;
   ELSIF stage_='checkin' AND b.status='active' AND b.checkin IS NOT NULL AND NOT b.checkin_accepted THEN b.checkin:=NULL;
   ELSE RAISE EXCEPTION 'RENT_STATE';END IF;
  ELSIF p_action='payment' THEN
   IF b.status NOT IN ('confirmed','active','returned') THEN RAISE EXCEPTION 'RENT_STATE';END IF;
   amount_:=(p_data->>'amount')::numeric;ref_:=trim(p_data->>'reference');
   IF ref_ IS NULL OR length(ref_) NOT BETWEEN 3 AND 300 THEN RAISE EXCEPTION 'RENT_PAYMENT';END IF;
   IF p_data->>'kind'='rental' THEN
    IF amount_ IS NULL OR amount_<=0 OR amount_<>trunc(amount_) OR b.paid_vnd+amount_>b.total_vnd THEN RAISE EXCEPTION 'RENT_PAYMENT';END IF;
    b.paid_vnd:=b.paid_vnd+amount_;
   ELSIF p_data->>'kind'='deposit' THEN
    IF b.deposit_received OR amount_ IS DISTINCT FROM b.deposit_amount THEN RAISE EXCEPTION 'RENT_PAYMENT';END IF;
    b.deposit_received:=true;
   ELSE RAISE EXCEPTION 'RENT_PAYMENT';END IF;
  ELSIF p_action='inspection' THEN
   stage_:=p_data->>'stage';doc:=p_data->'document';
   IF NOT ((stage_='checkout' AND b.status='confirmed' AND b.checkout IS NULL) OR (stage_='checkin' AND b.status='active' AND b.checkin IS NULL)) THEN RAISE EXCEPTION 'RENT_STATE';END IF;
   IF jsonb_typeof(doc) IS DISTINCT FROM 'object' OR jsonb_typeof(doc->'odometer') IS DISTINCT FROM 'number' OR (doc->>'odometer')::numeric<0 OR (doc->>'odometer')::numeric<>trunc((doc->>'odometer')::numeric) OR (doc->>'odometer')::numeric>10000000 OR jsonb_typeof(doc->'full_tank') IS DISTINCT FROM 'boolean' OR length(coalesce(doc->>'notes',''))>3000 OR length(coalesce(doc->>'accessories',''))>500 THEN RAISE EXCEPTION 'RENT_INSPECTION';END IF;
   IF (SELECT count(*) FROM public.rent_media WHERE booking_id=b.id AND stage=stage_ AND uploaded AND kind='photo')<4 OR NOT EXISTS(SELECT 1 FROM public.rent_media WHERE booking_id=b.id AND stage=stage_ AND uploaded AND kind='video') THEN RAISE EXCEPTION 'RENT_EVIDENCE';END IF;
   doc:=jsonb_build_object('odometer',(doc->>'odometer')::integer,'full_tank',(doc->>'full_tank')::boolean,'notes',coalesce(doc->>'notes',''),'accessories',coalesce(doc->>'accessories',''),'staff_id',p_actor,'saved_at',now(),'documents_checked',coalesce((doc->>'documents_checked')::boolean,false));
   IF stage_='checkout' THEN
    IF doc->>'full_tank'<>'true' OR doc->>'documents_checked'<>'true' THEN RAISE EXCEPTION 'RENT_INSPECTION';END IF;
    b.checkout:=doc;
   ELSE
    IF (doc->>'odometer')::integer<(b.checkout->>'odometer')::integer THEN RAISE EXCEPTION 'RENT_INSPECTION';END IF;
    b.checkin:=doc;
   END IF;
  ELSIF p_action IN ('accept_checkout','accept_checkin','accept_settlement') THEN
   IF b.customer_id<>p_actor THEN RAISE EXCEPTION 'RENT_CUSTOMER_CONFIRM';END IF;
   IF p_action='accept_checkout' AND b.status='confirmed' AND b.checkout IS NOT NULL THEN b.checkout_accepted:=true;
   ELSIF p_action='accept_checkin' AND b.status IN ('active','returned') AND b.checkin IS NOT NULL THEN b.checkin_accepted:=true;
   ELSIF p_action='accept_settlement' AND b.status='returned' AND b.settlement IS NOT NULL THEN b.settlement_accepted:=true;
   ELSE RAISE EXCEPTION 'RENT_STATE';END IF;
  ELSIF p_action='issue' THEN
   IF b.status<>'confirmed' OR b.checkout IS NULL OR NOT b.checkout_accepted OR NOT b.deposit_received OR b.paid_vnd<>b.total_vnd OR v.condition<>'ready' OR now()<b.starts_at-interval '15 minutes' OR now()>b.ends_at OR NOT public.rent_available(v.id,now(),now()+make_interval(days=>b.days),b.id) THEN RAISE EXCEPTION 'RENT_ISSUE';END IF;
   b.starts_at:=now();b.ends_at:=now()+make_interval(days=>b.days);b.issued_at:=now();b.status:='active';
  ELSIF p_action='return' THEN
   IF b.status<>'active' OR b.checkin IS NULL THEN RAISE EXCEPTION 'RENT_STATE';END IF;
   b.status:='returned';b.returned_at:=now();
  ELSIF p_action='extend' THEN
   en:=(p_data->>'ends_at')::timestamptz;
   IF b.status NOT IN ('confirmed','active') OR b.checkout IS NOT NULL AND b.status='confirmed' OR b.checkin IS NOT NULL OR en IS NULL OR en<=b.ends_at OR en-b.starts_at>interval '90 days' OR NOT public.rent_available(v.id,b.ends_at,en,b.id) THEN RAISE EXCEPTION 'RENT_UNAVAILABLE';END IF;
   b.ends_at:=en;b.days:=ceil(extract(epoch FROM en-b.starts_at)/86400.0);b.total_vnd:=b.days*b.daily_vnd;
  ELSIF p_action='settle' THEN
   IF b.status<>'returned' OR NOT b.checkin_accepted OR b.settlement IS NOT NULL OR b.paid_vnd<>b.total_vnd THEN RAISE EXCEPTION 'RENT_STATE';END IF;
   fuel:=(p_data->>'fuel_vnd')::numeric;rate_:=CASE WHEN b.currency='USD' THEN (p_data->>'vnd_per_usd')::numeric ELSE 1 END;
   IF fuel IS NULL OR fuel<0 OR fuel<>trunc(fuel) OR fuel>2000000 OR (b.checkin->>'full_tank')::boolean AND fuel<>0 OR rate_ IS NULL OR rate_<=0 OR rate_>100000 THEN RAISE EXCEPTION 'RENT_FUEL';END IF;
   IF fuel>0 AND NOT EXISTS(SELECT 1 FROM public.rent_media WHERE booking_id=b.id AND stage='fuel' AND uploaded AND kind='photo') THEN RAISE EXCEPTION 'RENT_RECEIPT';END IF;
   deduction:=round(fuel/rate_,CASE WHEN b.currency='USD' THEN 2 ELSE 0 END);
   IF deduction>b.deposit_amount THEN RAISE EXCEPTION 'RENT_FUEL';END IF;
   b.settlement:=jsonb_build_object('fuel_vnd',fuel,'vnd_per_usd',rate_,'deduction',deduction,'refund',b.deposit_amount-deduction,'currency',b.currency,'saved_at',now());
  ELSIF p_action='refund' THEN
   IF b.status<>'returned' OR b.settlement IS NULL OR NOT b.settlement_accepted OR b.deposit_returned OR length(trim(coalesce(p_data->>'reference','')))<3 OR length(p_data->>'reference')>300 THEN RAISE EXCEPTION 'RENT_REFUND';END IF;
   b.deposit_returned:=true;b.status:='closed';b.closed_at:=now();
  END IF;
  UPDATE public.rent_bookings SET starts_at=b.starts_at,ends_at=b.ends_at,days=b.days,total_vnd=b.total_vnd,paid_vnd=b.paid_vnd,deposit_received=b.deposit_received,deposit_returned=b.deposit_returned,status=b.status,checkout=b.checkout,checkin=b.checkin,checkout_accepted=b.checkout_accepted,checkin_accepted=b.checkin_accepted,settlement=b.settlement,settlement_accepted=b.settlement_accepted,issued_at=b.issued_at,returned_at=b.returned_at,closed_at=b.closed_at,version=version+1,updated_at=now() WHERE id=b.id RETURNING * INTO b;
 ELSE RAISE EXCEPTION 'RENT_INVALID';END IF;
 IF b.id IS NOT NULL AND p_action NOT IN ('media_start','media_finish','media_order') THEN
  INSERT INTO public.rent_events(booking_id,actor_id,action,detail)VALUES(b.id,p_actor,p_action,p_data);
  result_:=jsonb_build_object('ok',true,'booking',to_jsonb(b));
 END IF;
 INSERT INTO public.rent_operations(actor_id,request_id,action,payload,result)VALUES(p_actor,p_request,p_action,p_data,result_);
 RETURN result_;
END$$;
REVOKE ALL ON FUNCTION public.rent_manager(bigint),public.rent_available(uuid,timestamptz,timestamptz,uuid),public.rent_catalog(timestamptz,timestamptz),public.rent_state(bigint,boolean,bigint),public.rent_detail(bigint,uuid),public.rent_operation(bigint,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rent_manager(bigint),public.rent_available(uuid,timestamptz,timestamptz,uuid),public.rent_catalog(timestamptz,timestamptz),public.rent_state(bigint,boolean,bigint),public.rent_detail(bigint,uuid),public.rent_operation(bigint,uuid,text,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
