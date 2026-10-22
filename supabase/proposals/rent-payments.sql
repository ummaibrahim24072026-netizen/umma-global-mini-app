-- Rental bank invoices and private customer receipts. No screenshot can credit rent.
BEGIN;
ALTER TABLE public.rent_bookings ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cash' CHECK(payment_method IN ('cash','qr','bank_transfer'));
ALTER TABLE public.rent_bookings ADD COLUMN IF NOT EXISTS terms_snapshot jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.rent_bookings ADD COLUMN IF NOT EXISTS driver_declared boolean NOT NULL DEFAULT false;
CREATE TABLE public.rent_payment_intents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), booking_id uuid NOT NULL REFERENCES public.rent_bookings(id),
 amount_vnd integer NOT NULL CHECK(amount_vnd>0), method text NOT NULL CHECK(method IN ('qr','bank_transfer')),
 reference text NOT NULL UNIQUE, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','review','paid','void')),
 created_at timestamptz NOT NULL DEFAULT now(), paid_at timestamptz
);
CREATE INDEX rent_intents_booking ON public.rent_payment_intents(booking_id,created_at);
CREATE UNIQUE INDEX rent_intent_one_pending ON public.rent_payment_intents(booking_id) WHERE status IN ('pending','review');
CREATE TABLE public.rent_payment_proofs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),intent_id uuid NOT NULL REFERENCES public.rent_payment_intents(id),
 path text NOT NULL UNIQUE,mime text NOT NULL CHECK(mime IN ('image/jpeg','image/png','image/webp')),
 size_bytes integer NOT NULL CHECK(size_bytes BETWEEN 1 AND 5242880),uploaded boolean NOT NULL DEFAULT false,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','rejected')),reason text NOT NULL DEFAULT '' CHECK(length(reason)<=500),
 created_at timestamptz NOT NULL DEFAULT now(),reviewed_at timestamptz
);
CREATE INDEX rent_proofs_intent ON public.rent_payment_proofs(intent_id,created_at);
ALTER TABLE public.rent_payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rent_payment_proofs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rent_payment_intents,public.rent_payment_proofs FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.rent_payment_intents,public.rent_payment_proofs TO service_role;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)VALUES('rent-payments','rent-payments',false,5242880,ARRAY['image/jpeg','image/png','image/webp']);
CREATE FUNCTION public.rent_payment_state(p_actor bigint,p_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE b public.rent_bookings;
BEGIN
 SELECT * INTO b FROM public.rent_bookings WHERE id=p_id;
 IF b.id IS NULL OR NOT EXISTS(SELECT 1 FROM public.telegram_users WHERE telegram_id=p_actor AND is_active) OR b.customer_id<>p_actor AND NOT public.rent_manager(p_actor) THEN RAISE EXCEPTION 'RENT_ACCESS';END IF;
 RETURN jsonb_build_object('ok',true,'intents',coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY created_at DESC) FROM public.rent_payment_intents i WHERE booking_id=b.id),'[]'),
 'proofs',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.created_at DESC) FROM public.rent_payment_proofs p JOIN public.rent_payment_intents i ON i.id=p.intent_id WHERE i.booking_id=b.id AND p.uploaded),'[]'));
END$$;
CREATE FUNCTION public.rent_payment_operation(p_actor bigint,p_request uuid,p_action text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,storage AS $$
DECLARE b public.rent_bookings;i public.rent_payment_intents;p public.rent_payment_proofs;old public.rent_operations;mgr boolean;res jsonb;v_id uuid;mime_ text;size_ integer;
BEGIN
 IF p_request IS NULL OR p_action NOT IN ('pay_prepare','pay_proof_start','pay_proof_finish','pay_review','pay_void') OR p_data IS NULL THEN RAISE EXCEPTION 'RENT_INVALID';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.telegram_users WHERE telegram_id=p_actor AND is_active) THEN RAISE EXCEPTION 'RENT_ACCESS';END IF;
 mgr:=public.rent_manager(p_actor);
 IF p_action IN ('pay_review','pay_void') AND NOT mgr THEN RAISE EXCEPTION 'RENT_ACCESS';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('rent:'||p_actor::text,0));
 SELECT * INTO old FROM public.rent_operations WHERE actor_id=p_actor AND request_id=p_request;
 IF FOUND THEN
  IF old.action<>p_action OR old.payload<>p_data THEN RAISE EXCEPTION 'RENT_KEY_REUSED';END IF;
  RETURN old.result||jsonb_build_object('replayed',true);
 END IF;
 IF p_action='pay_prepare' THEN SELECT * INTO b FROM public.rent_bookings WHERE id=(p_data->>'id')::uuid;
 ELSE
  IF p_action IN ('pay_proof_finish','pay_review') THEN SELECT * INTO p FROM public.rent_payment_proofs WHERE id=(p_data->>'proof_id')::uuid; SELECT * INTO i FROM public.rent_payment_intents WHERE id=p.intent_id;
  ELSE SELECT * INTO i FROM public.rent_payment_intents WHERE id=(p_data->>'intent_id')::uuid;END IF;
  SELECT * INTO b FROM public.rent_bookings WHERE id=i.booking_id;
 END IF;
 IF b.id IS NULL OR (b.customer_id<>p_actor AND NOT mgr) OR (p_action IN ('pay_prepare','pay_proof_start','pay_proof_finish') AND b.customer_id<>p_actor) THEN RAISE EXCEPTION 'RENT_ACCESS';END IF;
 PERFORM 1 FROM public.rent_vehicles WHERE id=b.vehicle_id FOR UPDATE;
 SELECT * INTO b FROM public.rent_bookings WHERE id=b.id FOR UPDATE;
 IF b.status NOT IN ('confirmed','active','returned') THEN RAISE EXCEPTION 'RENT_STATE';END IF;
 IF i.id IS NOT NULL THEN SELECT * INTO i FROM public.rent_payment_intents WHERE id=i.id FOR UPDATE;END IF;
 IF p.id IS NOT NULL THEN SELECT * INTO p FROM public.rent_payment_proofs WHERE id=p.id FOR UPDATE;END IF;
 IF p_action='pay_prepare' THEN
  IF b.paid_vnd>=b.total_vnd THEN RAISE EXCEPTION 'RENT_ALREADY_PAID';END IF;
  IF p_data->>'method' IS NULL OR p_data->>'method' NOT IN ('qr','bank_transfer') THEN RAISE EXCEPTION 'RENT_PAYMENT';END IF;
  SELECT * INTO i FROM public.rent_payment_intents WHERE booking_id=b.id AND status IN ('pending','review') FOR UPDATE;
  IF i.id IS NULL THEN
   v_id:=gen_random_uuid();
   INSERT INTO public.rent_payment_intents(id,booking_id,amount_vnd,method,reference)VALUES(v_id,b.id,b.total_vnd-b.paid_vnd,p_data->>'method','UMMAR'||b.number::text||upper(substr(replace(v_id::text,'-',''),1,8)))RETURNING * INTO i;
  END IF;
  res:=jsonb_build_object('ok',true,'intent',to_jsonb(i));
 ELSIF p_action='pay_proof_start' THEN
  IF i.status NOT IN ('pending','review') THEN RAISE EXCEPTION 'RENT_STATE';END IF;
  IF (SELECT count(*) FROM public.rent_payment_proofs WHERE intent_id=i.id)>=10 THEN RAISE EXCEPTION 'RENT_LIMIT';END IF;
  mime_:=p_data->>'mime';size_:=(p_data->>'size_bytes')::integer;v_id:=gen_random_uuid();
  INSERT INTO public.rent_payment_proofs(id,intent_id,path,mime,size_bytes)VALUES(v_id,i.id,b.id::text||'/'||v_id::text||CASE mime_ WHEN 'image/jpeg' THEN '.jpg' WHEN 'image/png' THEN '.png' ELSE '.webp' END,mime_,size_)RETURNING * INTO p;
  res:=jsonb_build_object('ok',true,'proof',to_jsonb(p));
 ELSIF p_action='pay_proof_finish' THEN
  IF i.status NOT IN ('pending','review') OR p.status<>'pending' THEN RAISE EXCEPTION 'RENT_STATE';END IF;
  IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='rent-payments' AND name=p.path AND (metadata->>'size')::bigint=p.size_bytes AND metadata->>'mimetype'=p.mime) THEN RAISE EXCEPTION 'RENT_UPLOAD';END IF;
  IF NOT p.uploaded THEN
   UPDATE public.rent_payment_proofs SET uploaded=true WHERE id=p.id RETURNING * INTO p;
   UPDATE public.rent_payment_intents SET status='review' WHERE id=i.id RETURNING * INTO i;
   INSERT INTO public.rent_events(booking_id,actor_id,action,detail)VALUES(b.id,p_actor,'payment_proof',jsonb_build_object('intent_id',i.id,'proof_id',p.id,'amount',i.amount_vnd,'method',i.method));
   UPDATE public.rent_bookings SET version=version+1,updated_at=now() WHERE id=b.id;
  END IF;
  res:=jsonb_build_object('ok',true,'proof',to_jsonb(p),'intent',to_jsonb(i));
 ELSIF p_action='pay_void' THEN
  IF i.status NOT IN ('pending','review') OR length(trim(coalesce(p_data->>'reason','')))<3 OR length(p_data->>'reason')>500 THEN RAISE EXCEPTION 'RENT_PAYMENT';END IF;
  UPDATE public.rent_payment_intents SET status='void' WHERE id=i.id RETURNING * INTO i;
  UPDATE public.rent_payment_proofs SET status='rejected',reason=p_data->>'reason',reviewed_at=now() WHERE intent_id=i.id AND status='pending';
  INSERT INTO public.rent_events(booking_id,actor_id,action,detail)VALUES(b.id,p_actor,'payment_void',p_data);
  UPDATE public.rent_bookings SET version=version+1,updated_at=now() WHERE id=b.id;
  res:=jsonb_build_object('ok',true,'intent',to_jsonb(i));
 ELSIF p_action='pay_review' THEN
  IF b.version IS DISTINCT FROM (p_data->>'version')::integer THEN RAISE EXCEPTION 'RENT_STALE';END IF;
  IF i.status NOT IN ('pending','review') OR NOT p.uploaded OR p.status<>'pending' THEN RAISE EXCEPTION 'RENT_STATE';END IF;
  IF p_data->>'accepted'='true' THEN
   IF p_data->>'funds_received' IS DISTINCT FROM 'true' OR length(trim(coalesce(p_data->>'reference','')))<3 OR length(p_data->>'reference')>300 OR i.amount_vnd>b.total_vnd-b.paid_vnd THEN RAISE EXCEPTION 'RENT_PAYMENT';END IF;
   UPDATE public.rent_bookings SET paid_vnd=paid_vnd+i.amount_vnd,version=version+1,updated_at=now() WHERE id=b.id RETURNING * INTO b;
   UPDATE public.rent_payment_intents SET status='paid',paid_at=now() WHERE id=i.id RETURNING * INTO i;
   UPDATE public.rent_payment_proofs SET status='confirmed',reviewed_at=now() WHERE id=p.id RETURNING * INTO p;
   UPDATE public.rent_payment_proofs SET status='rejected',reason='Payment confirmed using another receipt',reviewed_at=now() WHERE intent_id=i.id AND id<>p.id AND status='pending';
   INSERT INTO public.rent_events(booking_id,actor_id,action,detail)VALUES(b.id,p_actor,'payment',jsonb_build_object('kind','rental','amount',i.amount_vnd,'method',i.method,'intent_id',i.id,'proof_id',p.id,'reference',p_data->>'reference'));
  ELSIF p_data->>'accepted'='false' AND length(trim(coalesce(p_data->>'reason','')))>2 AND length(p_data->>'reason')<=500 THEN
   UPDATE public.rent_payment_proofs SET status='rejected',reason=p_data->>'reason',reviewed_at=now() WHERE id=p.id RETURNING * INTO p;
   UPDATE public.rent_payment_intents SET status=CASE WHEN EXISTS(SELECT 1 FROM public.rent_payment_proofs WHERE intent_id=i.id AND uploaded AND status='pending') THEN 'review' ELSE 'pending' END WHERE id=i.id RETURNING * INTO i;
   UPDATE public.rent_bookings SET version=version+1,updated_at=now() WHERE id=b.id RETURNING * INTO b;
   INSERT INTO public.rent_events(booking_id,actor_id,action,detail)VALUES(b.id,p_actor,'payment_rejected',jsonb_build_object('proof_id',p.id,'reason',p.reason));
  ELSE RAISE EXCEPTION 'RENT_PAYMENT';END IF;
  res:=jsonb_build_object('ok',true,'intent',to_jsonb(i),'proof',to_jsonb(p),'booking',to_jsonb(b));
 END IF;
 INSERT INTO public.rent_operations(actor_id,request_id,action,payload,result)VALUES(p_actor,p_request,p_action,p_data,res);
 RETURN res;
END$$;
REVOKE ALL ON FUNCTION public.rent_payment_state(bigint,uuid),public.rent_payment_operation(bigint,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rent_payment_state(bigint,uuid),public.rent_payment_operation(bigint,uuid,text,jsonb) TO service_role;
CREATE FUNCTION public.rent_terms() RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog AS $$ SELECT '{"ru": "Суточный тариф указан в карточке байка и фиксируется в бронировании. Начатые сутки при выбранном сроке округляются вверх. При выдаче оплаченные сутки отсчитываются от фактической передачи.\nДепозит указан отдельно в карточке байка и бронировании.\nВыдаём с полным баком. Верните с полным баком либо оплатите фактическую дозаправку по чеку из депозита. Для USD курс и сумма возврата показываются в расчёте и подтверждаются вами.\nФото и круговое видео фиксируют состояние при выдаче и возврате. Осмотрите материалы и подтвердите акт в своей аренде.\nПродление — только при доступности байка. При опоздании свяжитесь с сотрудником; автоматических штрафов нет.\nВозврат депозита фиксируется после осмотра и согласования расчёта. При споре расчёт приостанавливается до согласования.\nПолучение и возврат — в согласованное время в UMMA Cafe, Scenia Bay, Нячанг. До выдачи сотрудник проверяет личность, действующие права подходящей категории, регистрацию и страховые документы байка. Номер карточки не заменяет регистрационные документы.\nК управлению допускается согласованный водитель от 18 лет. Шлем обязателен; запрещены вождение в опьянении и передача байка другому человеку без согласования. При поломке или ДТП остановитесь в безопасном месте и свяжитесь с UMMA; не согласовывайте ремонт самостоятельно.\nНеоплаченную бронь можно отменить до выдачи; оплаченную — через сотрудника с оформлением полного возврата до выдачи. Аренда оплачивается в VND. Валюта фактического внесения депозита согласуется до оплаты с учётом правил Вьетнама. Скриншот перевода не является подтверждением поступления денег.", "en": "The daily rate is shown on the bike card and fixed in your booking. The selected duration is rounded up to full days. Paid days start at actual handover.\nThe deposit is shown separately on the bike card and in your booking.\nFull tank at pickup and return. Otherwise actual refuelling cost, supported by a receipt, is deducted. For USD deposits you review and accept the exchange rate and refund.\nPhotos and walk-around video record condition at pickup and return. Review and accept each report in My rental.\nExtensions require availability. Contact staff if late; no automatic penalties.\nThe deposit is refunded after inspection and agreement on settlement. Disputes pause settlement.\nPickup and return: agreed time at UMMA Cafe, Scenia Bay, Nha Trang. Before handover staff checks identity, appropriate valid driving licence, bike registration and insurance documents. A fleet number does not replace registration documents.\nOnly the agreed rider, aged 18+, may ride. Helmets are required; no intoxicated riding or transfer to another rider without agreement. For breakdowns or accidents, stop safely and contact UMMA before arranging repairs.\nUnpaid bookings may be cancelled before pickup. Paid bookings require staff to record a full refund before handover. Rent is paid in VND. Agree the actual deposit payment currency before payment under Vietnamese rules. A screenshot does not prove receipt of funds.", "vi": "Giá mỗi ngày hiển thị trên thẻ xe và được cố định trong đơn thuê. Thời gian chọn được làm tròn lên theo ngày. Ngày thuê đã thanh toán bắt đầu lúc bàn giao thực tế.\nTiền cọc hiển thị riêng trên thẻ xe và trong đơn thuê.\nNhận và trả xe đầy bình. Nếu thiếu, trừ chi phí đổ đầy thực tế theo hóa đơn. Với cọc USD, bạn xem và xác nhận tỷ giá và tiền hoàn.\nẢnh và video quay quanh xe ghi nhận hiện trạng khi giao và trả. Xem và xác nhận biên bản trong mục thuê xe.\nGia hạn khi xe còn trống. Liên hệ nhân viên nếu trả muộn; không tự động phạt.\nHoàn cọc sau kiểm tra và thống nhất quyết toán. Khi có tranh chấp, tạm dừng quyết toán.\nNhận/trả vào giờ đã thỏa thuận tại UMMA Cafe, Scenia Bay, Nha Trang. Nhân viên kiểm tra danh tính, giấy phép phù hợp còn hiệu lực, đăng ký và bảo hiểm xe trước khi giao. Mã quản lý không thay thế đăng ký xe.\nChỉ người lái đã thỏa thuận từ 18 tuổi được sử dụng. Phải đội mũ; không lái khi say hoặc giao xe cho người khác khi chưa đồng ý. Khi hỏng xe hoặc tai nạn, dừng an toàn và liên hệ UMMA trước khi sửa.\nCó thể hủy đặt xe chưa thanh toán trước khi nhận; đơn đã thanh toán cần nhân viên hoàn toàn bộ trước khi giao xe. Tiền thuê thanh toán bằng VND. Thống nhất tiền tệ thực nộp cọc trước thanh toán theo quy định Việt Nam. Ảnh chuyển khoản không chứng minh đã nhận tiền."}'::jsonb $$;
REVOKE ALL ON FUNCTION public.rent_terms() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rent_terms() TO service_role;
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
   UPDATE public.rent_vehicles SET name=trim(p_data->>'name'),plate=upper(nullif(trim(p_data->>'plate'),'')),description=coalesce(p_data->>'description',''),specs=coalesce(p_data->>'specs',''),pickup=trim(p_data->>'pickup'),accessories=coalesce(p_data->>'accessories',''),condition=p_data->>'condition',published=(p_data->>'published')::boolean,daily_vnd=coalesce((p_data->>'daily_vnd')::integer,v.daily_vnd),deposit_usd=coalesce((p_data->>'deposit_usd')::numeric,v.deposit_usd),deposit_vnd=CASE WHEN p_data?'deposit_vnd' THEN nullif(p_data->>'deposit_vnd','')::integer ELSE v.deposit_vnd END,version=version+1,updated_at=now() WHERE id=v.id RETURNING * INTO v;
  ELSE
   INSERT INTO public.rent_vehicles(name,plate,description,specs,pickup,accessories,daily_vnd,deposit_usd,deposit_vnd)VALUES(trim(p_data->>'name'),upper(nullif(trim(p_data->>'plate'),'')),coalesce(p_data->>'description',''),coalesce(p_data->>'specs',''),trim(p_data->>'pickup'),coalesce(p_data->>'accessories',''),coalesce((p_data->>'daily_vnd')::integer,400000),coalesce((p_data->>'deposit_usd')::numeric,200),CASE WHEN p_data?'deposit_vnd' THEN nullif(p_data->>'deposit_vnd','')::integer ELSE 5000000 END)RETURNING * INTO v;
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
  IF st IS NULL OR en IS NULL OR st<now()-interval '5 minutes' OR st>now()+interval '180 days' OR en<=st OR en-st>interval '90 days' OR p_data->>'terms_version' IS DISTINCT FROM 'rent-v3' OR p_data->>'currency' NOT IN ('VND','USD') THEN RAISE EXCEPTION 'RENT_DATES';END IF;
  IF p_data->>'driver_declared' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'RENT_DRIVER';END IF;
  IF (SELECT count(*) FROM public.rent_bookings WHERE customer_id=p_actor AND created_at>now()-interval '1 day')>=10 THEN RAISE EXCEPTION 'RENT_LIMIT';END IF;
  SELECT * INTO v FROM public.rent_vehicles WHERE id=(p_data->>'vehicle_id')::uuid FOR UPDATE;
  IF v.id IS NULL OR NOT v.published OR v.condition<>'ready' THEN RAISE EXCEPTION 'RENT_UNAVAILABLE';END IF;
  UPDATE public.rent_bookings SET status='expired',version=version+1 WHERE vehicle_id=v.id AND status='reserved' AND expires_at<=now();
  IF NOT public.rent_available(v.id,st,en) THEN RAISE EXCEPTION 'RENT_UNAVAILABLE';END IF;
  amount_:=CASE p_data->>'currency' WHEN 'USD' THEN v.deposit_usd ELSE v.deposit_vnd END;
  IF amount_ IS NULL OR (p_data->>'expected_daily_vnd')::integer IS DISTINCT FROM v.daily_vnd OR (p_data->>'expected_deposit')::numeric IS DISTINCT FROM amount_ THEN RAISE EXCEPTION 'RENT_PRICE';END IF;
  days_:=ceil(extract(epoch FROM en-st)/86400.0);
  INSERT INTO public.rent_bookings(vehicle_id,customer_id,customer_name,phone,starts_at,ends_at,days,daily_vnd,total_vnd,currency,deposit_amount,vehicle_snapshot,payment_method,driver_declared,terms_snapshot)
  VALUES(v.id,p_actor,trim(p_data->>'customer_name'),trim(p_data->>'phone'),st,en,days_,v.daily_vnd,days_*v.daily_vnd,p_data->>'currency',amount_,to_jsonb(v)-'published'-'version',coalesce(p_data->>'payment_method','cash'),true,public.rent_terms())RETURNING * INTO b;
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
   IF EXISTS(SELECT 1 FROM public.rent_payment_intents WHERE booking_id=b.id AND status='review') THEN RAISE EXCEPTION 'RENT_PAYMENT_PENDING';END IF;
   UPDATE public.rent_payment_intents SET status='void' WHERE booking_id=b.id AND status='pending';
   IF b.status NOT IN ('reserved','confirmed') OR b.paid_vnd>0 OR b.deposit_received THEN RAISE EXCEPTION 'RENT_STATE';END IF;
   b.status:='cancelled';
  ELSIF p_action='cancel_paid' THEN
   IF EXISTS(SELECT 1 FROM public.rent_payment_intents WHERE booking_id=b.id AND status IN ('pending','review')) THEN RAISE EXCEPTION 'RENT_PAYMENT_PENDING';END IF;
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
    IF EXISTS(SELECT 1 FROM public.rent_payment_intents WHERE booking_id=b.id AND status IN ('pending','review')) THEN RAISE EXCEPTION 'RENT_PAYMENT_PENDING';END IF;
    IF coalesce(p_data->>'method','cash')<>'cash' THEN RAISE EXCEPTION 'RENT_PAYMENT';END IF;
    IF p_data?'cash_received_vnd' AND ((p_data->>'cash_received_vnd')::numeric<(p_data->>'amount')::numeric OR (p_data->>'cash_received_vnd')::numeric<>trunc((p_data->>'cash_received_vnd')::numeric)) THEN RAISE EXCEPTION 'RENT_PAYMENT';END IF;
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
  INSERT INTO public.rent_events(booking_id,actor_id,action,detail)VALUES(b.id,p_actor,p_action,p_data||CASE WHEN p_action='payment' AND p_data->>'kind'='rental' THEN jsonb_build_object('method','cash','change_vnd',coalesce((p_data->>'cash_received_vnd')::numeric,(p_data->>'amount')::numeric)-(p_data->>'amount')::numeric) ELSE '{}'::jsonb END);
  result_:=jsonb_build_object('ok',true,'booking',to_jsonb(b));
 END IF;
 INSERT INTO public.rent_operations(actor_id,request_id,action,payload,result)VALUES(p_actor,p_request,p_action,p_data,result_);
 RETURN result_;
END$$;

ALTER TABLE public.rent_bookings ALTER COLUMN terms_version SET DEFAULT 'rent-v3';
NOTIFY pgrst,'reload schema';
COMMIT;
