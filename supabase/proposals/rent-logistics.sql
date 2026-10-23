-- Delivery and collection are separate optional services, quoted by staff and accepted by the customer.
BEGIN;
CREATE OR REPLACE FUNCTION public.rent_valid_point(p jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
 SELECT CASE WHEN jsonb_typeof(p)='object' AND jsonb_typeof(p->'lat')='number' AND jsonb_typeof(p->'lng')='number'
 THEN (p->>'lat')::numeric BETWEEN -90 AND 90 AND (p->>'lng')::numeric BETWEEN -180 AND 180 AND length(coalesce(p->>'address',''))<=500 ELSE false END
$$;
REVOKE ALL ON FUNCTION public.rent_valid_point(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rent_valid_point(jsonb) TO service_role;
ALTER TABLE public.rent_bookings
 ADD COLUMN handover_mode text NOT NULL DEFAULT 'self' CHECK(handover_mode IN ('self','delivery')),
 ADD COLUMN handover_point jsonb,
 ADD COLUMN return_mode text NOT NULL DEFAULT 'self' CHECK(return_mode IN ('self','collection')),
 ADD COLUMN return_point jsonb,
 ADD COLUMN delivery_fee_vnd integer NOT NULL DEFAULT 0 CHECK(delivery_fee_vnd BETWEEN 0 AND 2000000),
 ADD COLUMN collection_fee_vnd integer NOT NULL DEFAULT 0 CHECK(collection_fee_vnd BETWEEN 0 AND 2000000),
 ADD COLUMN logistics_quoted boolean NOT NULL DEFAULT true,
 ADD COLUMN logistics_accepted boolean NOT NULL DEFAULT true,
 ADD CONSTRAINT rent_handover_point_check CHECK((handover_mode='self' AND handover_point IS NULL AND delivery_fee_vnd=0) OR (handover_mode='delivery' AND public.rent_valid_point(handover_point))),
 ADD CONSTRAINT rent_return_point_check CHECK((return_mode='self' AND return_point IS NULL AND collection_fee_vnd=0) OR (return_mode='collection' AND public.rent_valid_point(return_point))),
 ADD CONSTRAINT rent_logistics_accept_check CHECK(NOT logistics_accepted OR logistics_quoted);
ALTER TABLE public.rent_bookings DROP CONSTRAINT rent_bookings_check1;
ALTER TABLE public.rent_bookings ADD CONSTRAINT rent_total_with_services CHECK(total_vnd=days*daily_vnd+delivery_fee_vnd+collection_fee_vnd);
ALTER TABLE public.rent_bookings ALTER COLUMN terms_version SET DEFAULT 'rent-v5';
CREATE OR REPLACE FUNCTION public.rent_terms() RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog AS $terms$ SELECT $json${"ru": "1. Бронирование. Выберите байк и даты, укажите имя и телефон. Заявка удерживает байк на 30 минут. Бронь действует после подтверждения сотрудником. До подтверждения платить не нужно.\n\n2. Цена и срок. Все суммы — во вьетнамских донгах (VND). Тариф за сутки, число суток, стоимость аренды и возвратный залог указаны в бронировании отдельно. Одни сутки — 24 часа; неполные сутки выбранного срока округляются вверх. Например, 25 часов — 2 суток. При выдаче оплаченные сутки отсчитываются от фактической передачи байка; точное время возврата отображается в аренде.\n\n3. Оплата и залог. Аренду оплачивайте после подтверждения: по QR или наличными при получении. Залог вносится отдельно до выдачи, в VND. Залог не входит в стоимость аренды. Сотрудник подтверждает фактическое получение денег; скриншот перевода сам по себе не подтверждает оплату.\n\n4. Получение. Место получения и возврата указано в бронировании. Водителю должно быть не меньше 18 лет. До выдачи сотрудник проверяет личность, действующие права подходящей категории для Вьетнама, регистрацию и страховые документы байка. Вместе осмотрите байк, комплектацию, фотографии и круговое видео. Подтвердите акт выдачи только после проверки. Ранее отмеченные повреждения вам не начисляются.\n\n5. Использование. Носите шлем. Не управляйте в состоянии опьянения и не передавайте байк другому водителю без согласования с UMMA. При неисправности или ДТП остановитесь в безопасном месте и свяжитесь с UMMA. Ремонт сначала согласуйте с сотрудником.\n\n6. Возврат и бензин. Байк выдаётся с полным баком. Верните его с полным баком, ключами и переданной комплектацией. Сотрудник оформит акт возврата с фото и видео; проверьте его и подтвердите. При неполном баке из залога вычитается только фактическая дозаправка по чеку. Чек и точную сумму вы увидите до подтверждения расчёта.\n\n7. Возврат залога. Если удержаний нет, возвращается весь залог. При дозаправке: возврат = внесённый залог минус стоимость по чеку, всё в VND. После осмотра и вашего подтверждения расчёта сотрудник возвращает деньги и фиксирует возврат в приложении. Автоматических списаний за повреждения и опоздание нет. Спорные требования обсуждаются отдельно; не подтверждайте расчёт, с которым не согласны.\n\n8. Продление и отмена. Продление согласуйте заранее: оно возможно, если байк свободен. Доплата рассчитывается по суточному тарифу вашего бронирования. При опоздании сразу свяжитесь с UMMA. До выдачи неоплаченную бронь можно отменить в приложении; для оплаченной обратитесь к сотруднику — полученная аренда и залог возвращаются полностью.\n\n9. Доставка и выезд за байком. Самостоятельное получение и возврат в месте бронирования бесплатны. Доставка к вам и выезд за байком — две отдельные услуги. Укажите точки на карте и ориентиры. Менеджер проверит адреса и согласует время, затем укажет стоимость каждой услуги в VND; она может быть нулевой. До вашего подтверждения суммы оплата и выдача недоступны. Стоимость услуг указана отдельно от аренды и залога. При отмене до выдачи возвращается вся полученная оплата по правилу пункта 8. При выезде за байком аренда заканчивается после фактической передачи сотруднику и оформления возврата; отправка заявки сама по себе её не завершает. Если место или время передачи нужно изменить, заранее свяжитесь с UMMA.", "en": "1. Booking. Choose a bike and dates, then enter your name and phone. Your request holds the bike for 30 minutes. The booking is valid after staff confirmation. Do not pay before confirmation.\n\n2. Price and duration. All amounts are in Vietnamese dong (VND). Your booking separately shows the daily rate, days, rental total and refundable deposit. One day is 24 hours; a partial day in the selected period rounds up. For example, 25 hours means 2 days. Paid days begin at actual handover; the exact return time appears in your rental.\n\n3. Payment and deposit. After confirmation, pay rent by QR or cash at pickup. Pay the separate deposit in VND before handover. The deposit is not part of the rental price. Staff confirms actual receipt of funds; a transfer screenshot alone does not confirm payment.\n\n4. Pickup. Your booking shows the pickup and return location. The agreed rider must be 18 or older. Staff checks identity, a valid licence of the appropriate category for Vietnam, vehicle registration and insurance documents. Inspect the bike, accessories, photos and walk-around video together. Accept the pickup report only after checking. Previously recorded damage is not charged to you.\n\n5. Use. Wear a helmet. Do not ride intoxicated or give the bike to another rider without UMMA approval. In a breakdown or accident, stop safely and contact UMMA. Agree repairs with staff first.\n\n6. Return and fuel. The bike is handed over with a full tank. Return it full, with keys and all supplied accessories. Staff records the return with photos and video; review and accept the report. If fuel is missing, only actual refuelling cost supported by a receipt is deducted from the deposit. Review the receipt and exact amount before accepting settlement.\n\n7. Deposit refund. Without deductions, the full deposit is refunded. For refuelling: refund = deposit paid minus receipted fuel cost, all in VND. After inspection and your acceptance of settlement, staff refunds the money and records it in the app. No automatic damage or late charges apply. Discuss disputed claims separately; do not accept a settlement you disagree with.\n\n8. Extensions and cancellation. Arrange an extension in advance; it requires availability. Extra rent uses the daily rate in your booking. Contact UMMA immediately if late. Before handover, cancel an unpaid booking in the app. For a paid booking, contact staff for a full refund of received rent and deposit.\n\n9. Delivery and collection. Self pickup and return at the booking location are free. Delivery to you and collection from you are separate optional services. Select map points and provide landmarks. Staff checks addresses and agrees the time, then quotes each service in VND; the fee may be zero. Payment and handover are unavailable until you accept the amount. Service fees are shown separately from rent and deposit. Cancellation before handover refunds all received payment under clause 8. With collection, the rental ends after actual handover to staff and the return report, not when you send a request. Contact UMMA in advance to change the location or time.", "vi": "1. Đặt xe. Chọn xe và thời gian, nhập họ tên và số điện thoại. Yêu cầu giữ xe trong 30 phút. Đơn có hiệu lực sau khi nhân viên xác nhận. Chưa cần thanh toán trước khi xác nhận.\n\n2. Giá và thời hạn. Mọi khoản tiền đều bằng đồng Việt Nam (VND). Đơn hiển thị riêng giá mỗi ngày, số ngày, tổng tiền thuê và tiền cọc được hoàn. Một ngày là 24 giờ; thời gian lẻ trong khoảng đã chọn được làm tròn lên. Ví dụ: 25 giờ tính 2 ngày. Thời gian đã trả tiền bắt đầu từ lúc bàn giao thực tế; giờ trả chính xác hiển thị trong đơn thuê.\n\n3. Thanh toán và cọc. Sau khi xác nhận, trả tiền thuê bằng QR hoặc tiền mặt khi nhận xe. Nộp cọc riêng bằng VND trước khi giao xe. Cọc không nằm trong giá thuê. Nhân viên xác nhận tiền thực nhận; ảnh chuyển khoản không tự xác nhận thanh toán.\n\n4. Nhận xe. Địa điểm nhận và trả hiển thị trong đơn. Người lái đã thỏa thuận phải đủ 18 tuổi. Nhân viên kiểm tra danh tính, giấy phép đúng hạng có hiệu lực tại Việt Nam, đăng ký và bảo hiểm xe. Cùng kiểm tra xe, phụ kiện, ảnh và video quanh xe. Chỉ xác nhận biên bản giao sau khi kiểm tra. Không tính phí cho hư hỏng đã ghi nhận trước đó.\n\n5. Sử dụng. Đội mũ bảo hiểm. Không lái khi say hoặc giao xe cho người khác khi chưa được UMMA đồng ý. Khi xe hỏng hoặc tai nạn, dừng an toàn và liên hệ UMMA. Thống nhất với nhân viên trước khi sửa chữa.\n\n6. Trả xe và xăng. Nhận xe đầy bình. Trả xe đầy bình, đủ chìa khóa và phụ kiện đã nhận. Nhân viên lập biên bản trả với ảnh và video; hãy kiểm tra rồi xác nhận. Nếu thiếu xăng, chỉ trừ tiền đổ thêm thực tế theo hóa đơn. Bạn được xem hóa đơn và số tiền chính xác trước khi đồng ý quyết toán.\n\n7. Hoàn cọc. Không có khấu trừ thì hoàn đủ cọc. Khi đổ thêm xăng: tiền hoàn = cọc đã nộp trừ tiền xăng theo hóa đơn, đều bằng VND. Sau kiểm tra và khi bạn đồng ý quyết toán, nhân viên hoàn tiền và ghi nhận trong ứng dụng. Không tự động trừ tiền do hư hỏng hoặc trả muộn. Yêu cầu còn tranh chấp được trao đổi riêng; không xác nhận quyết toán nếu chưa đồng ý.\n\n8. Gia hạn và hủy. Liên hệ trước để gia hạn; chỉ gia hạn khi xe còn trống. Tiền thêm tính theo giá mỗi ngày trong đơn. Nếu trả muộn, liên hệ UMMA ngay. Trước khi giao xe, có thể hủy đơn chưa thanh toán trong ứng dụng. Đơn đã thanh toán cần liên hệ nhân viên để hoàn toàn bộ tiền thuê và cọc đã nhận.\n\n9. Giao và nhận lại xe. Tự nhận và trả tại địa điểm trong đơn là miễn phí. Giao xe đến bạn và đến nhận lại xe là hai dịch vụ riêng. Chọn điểm trên bản đồ và ghi địa chỉ, mốc nhận biết. Nhân viên kiểm tra địa chỉ, thống nhất giờ và báo giá từng dịch vụ bằng VND; có thể miễn phí. Chưa thanh toán và giao xe khi bạn chưa đồng ý số tiền. Phí dịch vụ hiển thị riêng tiền thuê và cọc. Hủy trước khi giao xe được hoàn toàn bộ tiền đã nhận theo mục 8. Khi đến nhận lại xe, đơn thuê chỉ kết thúc sau khi thực bàn giao cho nhân viên và lập biên bản trả, không phải lúc gửi yêu cầu. Liên hệ UMMA trước nếu cần đổi nơi hoặc giờ bàn giao."}$json$::jsonb $terms$;
CREATE OR REPLACE FUNCTION public.rent_operation(p_actor bigint,p_request uuid,p_action text,p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,storage AS $$
DECLARE mgr boolean;super_ boolean;prior public.rent_operations;b public.rent_bookings;v public.rent_vehicles;m public.rent_media;
 result_ jsonb;doc jsonb;stage_ text;st timestamptz;en timestamptz;days_ integer;fuel numeric;rate_ numeric;deduction numeric;amount_ numeric;media_id uuid;ref_ text;
BEGIN
 IF p_request IS NULL OR p_action IS NULL OR p_data IS NULL OR jsonb_typeof(p_data)<>'object' THEN RAISE EXCEPTION 'RENT_INVALID';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.telegram_users WHERE telegram_id=p_actor AND is_active) THEN RAISE EXCEPTION 'RENT_ACCESS';END IF;
 mgr:=public.rent_manager(p_actor);SELECT role='super_admin' INTO super_ FROM public.telegram_users WHERE telegram_id=p_actor;
 IF p_action NOT IN ('book','cancel','collection_cancel','collection_request','logistics_accept','accept_terms','accept_checkout','accept_checkin','accept_settlement') AND NOT mgr THEN RAISE EXCEPTION 'RENT_ACCESS';END IF;
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
   UPDATE public.rent_vehicles SET name=trim(p_data->>'name'),plate=upper(nullif(trim(p_data->>'plate'),'')),description=coalesce(p_data->>'description',''),specs=coalesce(p_data->>'specs',''),pickup=trim(p_data->>'pickup'),accessories=coalesce(p_data->>'accessories',''),condition=p_data->>'condition',published=(p_data->>'published')::boolean,daily_vnd=coalesce((p_data->>'daily_vnd')::integer,v.daily_vnd),deposit_vnd=CASE WHEN p_data?'deposit_vnd' THEN nullif(p_data->>'deposit_vnd','')::integer ELSE v.deposit_vnd END,version=version+1,updated_at=now() WHERE id=v.id RETURNING * INTO v;
  ELSE
   INSERT INTO public.rent_vehicles(name,plate,description,specs,pickup,accessories,daily_vnd,deposit_vnd)VALUES(trim(p_data->>'name'),upper(nullif(trim(p_data->>'plate'),'')),coalesce(p_data->>'description',''),coalesce(p_data->>'specs',''),trim(p_data->>'pickup'),coalesce(p_data->>'accessories',''),coalesce((p_data->>'daily_vnd')::integer,400000),CASE WHEN p_data?'deposit_vnd' THEN nullif(p_data->>'deposit_vnd','')::integer ELSE 5000000 END)RETURNING * INTO v;
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
  IF coalesce(p_data->>'handover_mode','self') NOT IN ('self','delivery') OR coalesce(p_data->>'return_mode','self') NOT IN ('self','collection') THEN RAISE EXCEPTION 'RENT_LOGISTICS';END IF;
  IF p_data->>'handover_mode'='delivery' AND NOT public.rent_valid_point(p_data->'handover_point') OR p_data->>'return_mode'='collection' AND NOT public.rent_valid_point(p_data->'return_point') THEN RAISE EXCEPTION 'RENT_LOCATION';END IF;
  st:=(p_data->>'starts_at')::timestamptz;en:=(p_data->>'ends_at')::timestamptz;
  IF st IS NULL OR en IS NULL OR st<now()-interval '5 minutes' OR st>now()+interval '180 days' OR en<=st OR en-st>interval '90 days' OR p_data->>'terms_version' IS DISTINCT FROM 'rent-v5' OR p_data->>'currency' IS DISTINCT FROM 'VND' THEN RAISE EXCEPTION 'RENT_DATES';END IF;
  IF p_data->>'driver_declared' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'RENT_DRIVER';END IF;
  IF (SELECT count(*) FROM public.rent_bookings WHERE customer_id=p_actor AND created_at>now()-interval '1 day')>=10 THEN RAISE EXCEPTION 'RENT_LIMIT';END IF;
  SELECT * INTO v FROM public.rent_vehicles WHERE id=(p_data->>'vehicle_id')::uuid FOR UPDATE;
  IF v.id IS NULL OR NOT v.published OR v.condition<>'ready' THEN RAISE EXCEPTION 'RENT_UNAVAILABLE';END IF;
  UPDATE public.rent_bookings SET status='expired',version=version+1 WHERE vehicle_id=v.id AND status='reserved' AND expires_at<=now();
  IF NOT public.rent_available(v.id,st,en) THEN RAISE EXCEPTION 'RENT_UNAVAILABLE';END IF;
  amount_:=v.deposit_vnd;
  IF amount_ IS NULL OR (p_data->>'expected_daily_vnd')::integer IS DISTINCT FROM v.daily_vnd OR (p_data->>'expected_deposit')::numeric IS DISTINCT FROM amount_ THEN RAISE EXCEPTION 'RENT_PRICE';END IF;
  days_:=ceil(extract(epoch FROM en-st)/86400.0);
  INSERT INTO public.rent_bookings(vehicle_id,customer_id,customer_name,phone,starts_at,ends_at,days,daily_vnd,total_vnd,currency,deposit_amount,vehicle_snapshot,payment_method,driver_declared,terms_snapshot,handover_mode,handover_point,return_mode,return_point,logistics_quoted,logistics_accepted)
  VALUES(v.id,p_actor,trim(p_data->>'customer_name'),trim(p_data->>'phone'),st,en,days_,v.daily_vnd,days_*v.daily_vnd,p_data->>'currency',amount_,to_jsonb(v)-'published'-'version',coalesce(p_data->>'payment_method','cash'),true,public.rent_terms(),coalesce(p_data->>'handover_mode','self'),CASE WHEN p_data->>'handover_mode'='delivery' THEN p_data->'handover_point' END,coalesce(p_data->>'return_mode','self'),CASE WHEN p_data->>'return_mode'='collection' THEN p_data->'return_point' END,coalesce(p_data->>'handover_mode','self')='self' AND coalesce(p_data->>'return_mode','self')='self',coalesce(p_data->>'handover_mode','self')='self' AND coalesce(p_data->>'return_mode','self')='self')RETURNING * INTO b;
 ELSIF p_action IN ('collection_cancel','logistics_quote','collection_request','logistics_accept','accept_terms','confirm','cancel','payment','inspection','accept_checkout','accept_checkin','issue','return','settle','accept_settlement','refund','extend','cancel_paid','reset_inspection') THEN
  -- Always lock vehicle before booking. All availability-changing operations share this order.
  SELECT * INTO b FROM public.rent_bookings WHERE id=(p_data->>'id')::uuid;
  IF b.id IS NULL OR (NOT mgr AND b.customer_id<>p_actor) THEN RAISE EXCEPTION 'RENT_ACCESS';END IF;
  SELECT * INTO v FROM public.rent_vehicles WHERE id=b.vehicle_id FOR UPDATE;
  SELECT * INTO b FROM public.rent_bookings WHERE id=b.id FOR UPDATE;
  IF b.version IS DISTINCT FROM (p_data->>'version')::integer THEN RAISE EXCEPTION 'RENT_STALE';END IF;
  IF p_action='collection_cancel' THEN
   IF b.customer_id<>p_actor OR b.status<>'active' OR b.return_mode<>'collection' OR b.logistics_accepted OR b.checkin IS NOT NULL OR b.paid_vnd>b.days*b.daily_vnd+b.delivery_fee_vnd THEN RAISE EXCEPTION 'RENT_STATE';END IF;
   IF EXISTS(SELECT 1 FROM public.rent_payment_intents WHERE booking_id=b.id AND status IN ('pending','review')) THEN RAISE EXCEPTION 'RENT_PAYMENT_PENDING';END IF;
   b.return_mode:='self';b.return_point:=NULL;b.collection_fee_vnd:=0;b.total_vnd:=b.days*b.daily_vnd+b.delivery_fee_vnd;b.logistics_quoted:=true;b.logistics_accepted:=true;
  ELSIF p_action='collection_request' THEN
   IF b.customer_id<>p_actor OR b.status<>'active' OR b.return_mode<>'self' OR b.checkin IS NOT NULL OR NOT b.logistics_quoted OR NOT b.logistics_accepted THEN RAISE EXCEPTION 'RENT_STATE';END IF;
   IF NOT public.rent_valid_point(p_data->'return_point') THEN RAISE EXCEPTION 'RENT_LOCATION';END IF;
   IF EXISTS(SELECT 1 FROM public.rent_payment_intents WHERE booking_id=b.id AND status IN ('pending','review')) THEN RAISE EXCEPTION 'RENT_PAYMENT_PENDING';END IF;
   b.return_mode:='collection';b.return_point:=p_data->'return_point';b.logistics_quoted:=false;b.logistics_accepted:=false;
  ELSIF p_action='logistics_quote' THEN
   IF b.status<>'active' OR b.return_mode<>'collection' OR b.logistics_quoted OR b.checkin IS NOT NULL THEN RAISE EXCEPTION 'RENT_STATE';END IF;
   IF jsonb_typeof(p_data->'collection_fee_vnd') IS DISTINCT FROM 'number' OR (p_data->>'collection_fee_vnd')::numeric<0 OR (p_data->>'collection_fee_vnd')::numeric>2000000 OR (p_data->>'collection_fee_vnd')::numeric<>trunc((p_data->>'collection_fee_vnd')::numeric) THEN RAISE EXCEPTION 'RENT_FEE';END IF;
   b.collection_fee_vnd:=(p_data->>'collection_fee_vnd')::integer;b.total_vnd:=b.days*b.daily_vnd+b.delivery_fee_vnd+b.collection_fee_vnd;b.logistics_quoted:=true;
  ELSIF p_action='logistics_accept' THEN
   IF b.customer_id<>p_actor THEN RAISE EXCEPTION 'RENT_CUSTOMER_CONFIRM';END IF;
   IF b.status NOT IN ('confirmed','active') OR NOT b.logistics_quoted OR b.logistics_accepted THEN RAISE EXCEPTION 'RENT_STATE';END IF;
   b.logistics_accepted:=true;
  ELSIF p_action='accept_terms' THEN
   IF b.customer_id<>p_actor OR b.terms_version<>'rent-v4-pending' THEN RAISE EXCEPTION 'RENT_CUSTOMER_CONFIRM';END IF;
   b.terms_version:='rent-v5';b.terms_snapshot:=public.rent_terms();
  ELSIF p_action='confirm' THEN
   IF b.status<>'reserved' OR b.expires_at<=now() OR NOT v.published OR v.condition<>'ready' OR NOT public.rent_available(v.id,b.starts_at,b.ends_at,b.id) THEN RAISE EXCEPTION 'RENT_UNAVAILABLE';END IF;
   IF b.handover_mode='delivery' OR b.return_mode='collection' THEN
    IF b.handover_mode='delivery' AND (jsonb_typeof(p_data->'delivery_fee_vnd') IS DISTINCT FROM 'number' OR (p_data->>'delivery_fee_vnd')::numeric<0 OR (p_data->>'delivery_fee_vnd')::numeric>2000000 OR (p_data->>'delivery_fee_vnd')::numeric<>trunc((p_data->>'delivery_fee_vnd')::numeric)) OR b.return_mode='collection' AND (jsonb_typeof(p_data->'collection_fee_vnd') IS DISTINCT FROM 'number' OR (p_data->>'collection_fee_vnd')::numeric<0 OR (p_data->>'collection_fee_vnd')::numeric>2000000 OR (p_data->>'collection_fee_vnd')::numeric<>trunc((p_data->>'collection_fee_vnd')::numeric)) THEN RAISE EXCEPTION 'RENT_FEE';END IF;
    b.delivery_fee_vnd:=CASE WHEN b.handover_mode='delivery' THEN (p_data->>'delivery_fee_vnd')::integer ELSE 0 END;
    b.collection_fee_vnd:=CASE WHEN b.return_mode='collection' THEN (p_data->>'collection_fee_vnd')::integer ELSE 0 END;
    b.total_vnd:=b.days*b.daily_vnd+b.delivery_fee_vnd+b.collection_fee_vnd;b.logistics_quoted:=true;b.logistics_accepted:=false;
   END IF;
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
   IF b.terms_version='rent-v4-pending' THEN RAISE EXCEPTION 'RENT_TERMS';END IF;
   IF NOT b.logistics_quoted OR NOT b.logistics_accepted THEN RAISE EXCEPTION 'RENT_LOGISTICS';END IF;
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
   IF NOT b.logistics_quoted OR NOT b.logistics_accepted OR b.terms_version='rent-v4-pending' OR b.status<>'confirmed' OR b.checkout IS NULL OR NOT b.checkout_accepted OR NOT b.deposit_received OR b.paid_vnd<>b.total_vnd OR v.condition<>'ready' OR now()<b.starts_at-interval '15 minutes' OR now()>b.ends_at OR NOT public.rent_available(v.id,now(),now()+make_interval(days=>b.days),b.id) THEN RAISE EXCEPTION 'RENT_ISSUE';END IF;
   b.starts_at:=now();b.ends_at:=now()+make_interval(days=>b.days);b.issued_at:=now();b.status:='active';
  ELSIF p_action='return' THEN
   IF NOT b.logistics_quoted OR NOT b.logistics_accepted THEN RAISE EXCEPTION 'RENT_LOGISTICS';END IF;
   IF b.status<>'active' OR b.checkin IS NULL THEN RAISE EXCEPTION 'RENT_STATE';END IF;
   b.status:='returned';b.returned_at:=now();
  ELSIF p_action='extend' THEN
   IF NOT b.logistics_quoted OR NOT b.logistics_accepted THEN RAISE EXCEPTION 'RENT_LOGISTICS';END IF;
   en:=(p_data->>'ends_at')::timestamptz;
   IF b.status NOT IN ('confirmed','active') OR b.checkout IS NOT NULL AND b.status='confirmed' OR b.checkin IS NOT NULL OR en IS NULL OR en<=b.ends_at OR en-b.starts_at>interval '90 days' OR NOT public.rent_available(v.id,b.ends_at,en,b.id) THEN RAISE EXCEPTION 'RENT_UNAVAILABLE';END IF;
   b.ends_at:=en;b.days:=ceil(extract(epoch FROM en-b.starts_at)/86400.0);b.total_vnd:=b.days*b.daily_vnd+b.delivery_fee_vnd+b.collection_fee_vnd;
  ELSIF p_action='settle' THEN
   IF NOT b.logistics_quoted OR NOT b.logistics_accepted OR b.status<>'returned' OR NOT b.checkin_accepted OR b.settlement IS NOT NULL OR b.paid_vnd<>b.total_vnd THEN RAISE EXCEPTION 'RENT_STATE';END IF;
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
  UPDATE public.rent_bookings SET handover_mode=b.handover_mode,handover_point=b.handover_point,return_mode=b.return_mode,return_point=b.return_point,delivery_fee_vnd=b.delivery_fee_vnd,collection_fee_vnd=b.collection_fee_vnd,logistics_quoted=b.logistics_quoted,logistics_accepted=b.logistics_accepted,terms_version=b.terms_version,terms_snapshot=b.terms_snapshot,starts_at=b.starts_at,ends_at=b.ends_at,days=b.days,total_vnd=b.total_vnd,paid_vnd=b.paid_vnd,deposit_received=b.deposit_received,deposit_returned=b.deposit_returned,status=b.status,checkout=b.checkout,checkin=b.checkin,checkout_accepted=b.checkout_accepted,checkin_accepted=b.checkin_accepted,settlement=b.settlement,settlement_accepted=b.settlement_accepted,issued_at=b.issued_at,returned_at=b.returned_at,closed_at=b.closed_at,version=version+1,updated_at=now() WHERE id=b.id RETURNING * INTO b;
 ELSE RAISE EXCEPTION 'RENT_INVALID';END IF;
 IF b.id IS NOT NULL AND p_action NOT IN ('media_start','media_finish','media_order') THEN
  INSERT INTO public.rent_events(booking_id,actor_id,action,detail)VALUES(b.id,p_actor,p_action,p_data||CASE WHEN p_action='payment' AND p_data->>'kind'='rental' THEN jsonb_build_object('method','cash','change_vnd',coalesce((p_data->>'cash_received_vnd')::numeric,(p_data->>'amount')::numeric)-(p_data->>'amount')::numeric) ELSE '{}'::jsonb END);
  result_:=jsonb_build_object('ok',true,'booking',to_jsonb(b));
 END IF;
 INSERT INTO public.rent_operations(actor_id,request_id,action,payload,result)VALUES(p_actor,p_request,p_action,p_data,result_);
 RETURN result_;
END$$;

-- No invoice may be created until the exact service quote is accepted.
CREATE OR REPLACE FUNCTION public.rent_vnd_invoice_guard() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.rent_bookings WHERE id=NEW.booking_id AND (terms_version='rent-v4-pending' OR NOT logistics_quoted OR NOT logistics_accepted)) THEN RAISE EXCEPTION 'RENT_LOGISTICS';END IF;
 RETURN NEW;
END$$;
REVOKE ALL ON FUNCTION public.rent_vnd_invoice_guard() FROM PUBLIC,anon,authenticated;
COMMIT;
