-- Permit incomplete registration only on unpublished inventory.
BEGIN;
ALTER TABLE public.rent_vehicles ALTER COLUMN plate DROP NOT NULL;
ALTER TABLE public.rent_vehicles ADD CONSTRAINT rent_vehicle_published_registration CHECK(NOT published OR plate IS NOT NULL);
CREATE OR REPLACE FUNCTION public.rent_operation(p_actor bigint,p_request uuid,p_action text,p_data jsonb) RETURNS jsonb
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

NOTIFY pgrst,'reload schema';
COMMIT;
