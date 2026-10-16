BEGIN;
CREATE SCHEMA IF NOT EXISTS umma_private;
REVOKE ALL ON SCHEMA umma_private FROM PUBLIC,anon,authenticated;
CREATE TABLE umma_private.delivery_chat_profiles(actor bigint PRIMARY KEY REFERENCES public.telegram_users(telegram_id),language text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE umma_private.delivery_chat_messages(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),seq bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 order_id uuid NOT NULL REFERENCES public.cafe_orders(id),sender bigint NOT NULL REFERENCES public.telegram_users(telegram_id),recipient bigint NOT NULL REFERENCES public.telegram_users(telegram_id),
 request_key uuid NOT NULL,kind text NOT NULL CHECK(kind IN ('text','photo','video','voice')),body text NOT NULL DEFAULT '' CHECK(length(body)<=2000),source_language text NOT NULL,
 mime text,size_bytes integer NOT NULL DEFAULT 0 CHECK(size_bytes BETWEEN 0 AND 20971520),object_path text,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),sent_at timestamptz,read_at timestamptz,
 UNIQUE(sender,request_key),CHECK(sender<>recipient)
);
CREATE INDEX delivery_chat_thread ON umma_private.delivery_chat_messages(order_id,seq DESC);
CREATE INDEX delivery_chat_sender_rate ON umma_private.delivery_chat_messages(sender,created_at DESC);
CREATE TABLE umma_private.delivery_chat_translations(
 message_id uuid NOT NULL REFERENCES umma_private.delivery_chat_messages(id),language text NOT NULL,
 state text NOT NULL DEFAULT 'processing' CHECK(state IN ('processing','ready','failed')),body text,transcript text,audio_path text,
 last_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),lease uuid NOT NULL DEFAULT gen_random_uuid(),leased_until timestamptz NOT NULL DEFAULT clock_timestamp()+interval '120 seconds',attempts integer NOT NULL DEFAULT 1,
 PRIMARY KEY(message_id,language)
);
ALTER TABLE umma_private.delivery_chat_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE umma_private.delivery_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE umma_private.delivery_chat_translations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON umma_private.delivery_chat_profiles,umma_private.delivery_chat_messages,umma_private.delivery_chat_translations FROM PUBLIC,anon,authenticated;

CREATE FUNCTION umma_private.chat_context(p_order uuid,p_actor bigint,p_write boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE o public.cafe_orders%rowtype; peer_ bigint; own_language text; peer_language text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.telegram_users WHERE telegram_id=p_actor AND is_active=true) THEN RAISE EXCEPTION 'CHAT_ACCESS'; END IF;
 SELECT * INTO o FROM public.cafe_orders WHERE id=p_order FOR SHARE;
 IF NOT FOUND OR o.order_type<>'delivery' OR o.created_at<clock_timestamp()-interval '30 days' OR (p_actor IS DISTINCT FROM o.customer_telegram_id AND p_actor IS DISTINCT FROM o.courier_telegram_id) THEN RAISE EXCEPTION 'CHAT_ACCESS'; END IF;
 peer_:=CASE WHEN p_actor=o.customer_telegram_id THEN o.courier_telegram_id ELSE o.customer_telegram_id END;
 IF peer_=p_actor THEN RAISE EXCEPTION 'CHAT_ACCESS'; END IF;
 IF p_write AND (peer_ IS NULL OR o.status IN ('completed','cancelled') OR o.delivery_status='delivered') THEN RAISE EXCEPTION 'CHAT_CLOSED'; END IF;
 IF p_write AND NOT EXISTS(SELECT 1 FROM public.telegram_users WHERE telegram_id=peer_ AND is_active) THEN RAISE EXCEPTION 'CHAT_CLOSED'; END IF;
 SELECT coalesce(p.language,CASE WHEN split_part(replace(u.language_code,'_','-'),'-',1) IN ('ru','en','vi','ar','id','th','zh','ko','fr','de','pt','tr','tk','tg','uz','ja','ug') THEN split_part(replace(u.language_code,'_','-'),'-',1) ELSE 'en' END) INTO own_language FROM public.telegram_users u LEFT JOIN umma_private.delivery_chat_profiles p ON p.actor=u.telegram_id WHERE u.telegram_id=p_actor;
 SELECT coalesce(p.language,CASE WHEN split_part(replace(u.language_code,'_','-'),'-',1) IN ('ru','en','vi','ar','id','th','zh','ko','fr','de','pt','tr','tk','tg','uz','ja','ug') THEN split_part(replace(u.language_code,'_','-'),'-',1) ELSE 'en' END) INTO peer_language FROM public.telegram_users u LEFT JOIN umma_private.delivery_chat_profiles p ON p.actor=u.telegram_id WHERE u.telegram_id=peer_;
 RETURN jsonb_build_object('orderNumber',o.order_number,'peer',peer_,'language',own_language,'peerLanguage',peer_language,'role',CASE WHEN p_actor=o.customer_telegram_id THEN 'customer' ELSE 'courier' END,'canSend',peer_ IS NOT NULL AND o.status NOT IN ('completed','cancelled') AND o.delivery_status<>'delivered');
END;$$;

CREATE FUNCTION umma_private.chat_notify(m umma_private.delivery_chat_messages)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 INSERT INTO umma_private.cafe_notifications(order_id,recipient,workspace,kind,title,send_to_bot)
 SELECT m.order_id,m.recipient,CASE WHEN m.recipient=o.customer_telegram_id THEN 'customer' ELSE 'courier' END,'chat',
 CASE WHEN coalesce(p.language,u.language_code) LIKE 'ru%' THEN 'UMMA · Новое сообщение по заказу №' WHEN coalesce(p.language,u.language_code) LIKE 'vi%' THEN 'UMMA · Tin nhắn mới cho đơn #' ELSE 'UMMA · New message for order #' END||o.order_number,true
 FROM public.cafe_orders o JOIN public.telegram_users u ON u.telegram_id=m.recipient LEFT JOIN umma_private.delivery_chat_profiles p ON p.actor=m.recipient WHERE o.id=m.order_id;
$$;

CREATE FUNCTION public.delivery_chat_action(p_actor bigint,p_action text,p_order uuid,p_body jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE ctx jsonb; m umma_private.delivery_chat_messages%rowtype; t umma_private.delivery_chat_translations%rowtype; rows_ jsonb; lang text; ext text; obj record; is_new boolean:=false;
BEGIN
 ctx:=umma_private.chat_context(p_order,p_actor,false);
 lang:=p_body->>'language';
 IF lang IS NOT NULL THEN
  IF lang NOT IN ('ru','en','vi','ar','id','th','zh','ko','fr','de','pt','tr','tk','tg','uz','ja','ug') THEN RAISE EXCEPTION 'CHAT_INPUT'; END IF;
  INSERT INTO umma_private.delivery_chat_profiles(actor,language) VALUES(p_actor,lang) ON CONFLICT(actor) DO UPDATE SET language=excluded.language,updated_at=clock_timestamp();
  ctx:=umma_private.chat_context(p_order,p_actor,false);
 END IF;
 IF p_action='list' THEN
  WITH page AS (SELECT page_m.* FROM umma_private.delivery_chat_messages page_m WHERE page_m.order_id=p_order AND page_m.sent_at IS NOT NULL AND ((page_m.sender=p_actor AND page_m.recipient=(ctx->>'peer')::bigint) OR (page_m.recipient=p_actor AND page_m.sender=(ctx->>'peer')::bigint)) AND ((p_body->>'before') IS NULL OR page_m.seq<(p_body->>'before')::bigint) ORDER BY page_m.seq DESC LIMIT 50)
  SELECT coalesce(jsonb_agg(to_jsonb(page)||jsonb_build_object('own',page.sender=p_actor,'translation',CASE WHEN page.recipient=p_actor THEN (SELECT to_jsonb(tr)-'lease'-'leased_until' FROM umma_private.delivery_chat_translations tr WHERE tr.message_id=page.id AND tr.language=ctx->>'language') ELSE null END) ORDER BY page.seq),'[]') INTO rows_ FROM page;
  UPDATE umma_private.delivery_chat_messages SET read_at=coalesce(read_at,clock_timestamp()) WHERE recipient=p_actor AND id IN (SELECT (x->>'id')::uuid FROM jsonb_array_elements(rows_) x);
  RETURN jsonb_build_object('ok',true,'context',ctx,'messages',rows_);
 END IF;
 IF p_action IN ('send','prepare') THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('chat:'||p_actor,0));
  SELECT * INTO m FROM umma_private.delivery_chat_messages WHERE sender=p_actor AND request_key=(p_body->>'requestKey')::uuid FOR UPDATE;
  IF FOUND THEN
   IF m.order_id<>p_order OR m.recipient IS DISTINCT FROM (ctx->>'peer')::bigint OR m.kind<>p_body->>'kind' OR m.body<>coalesce(p_body->>'text','') OR m.size_bytes<>coalesce((p_body->>'size')::integer,0) OR m.mime IS DISTINCT FROM p_body->>'mime' THEN RAISE EXCEPTION 'CHAT_KEY_REUSED'; END IF;
   RETURN jsonb_build_object('ok',true,'message',to_jsonb(m),'replayed',true);
  END IF;
  ctx:=umma_private.chat_context(p_order,p_actor,true);
  IF (SELECT count(*) FROM umma_private.delivery_chat_messages WHERE sender=p_actor AND created_at>clock_timestamp()-interval '1 minute')>=20 OR (SELECT count(*) FROM umma_private.delivery_chat_messages WHERE sender=p_actor AND created_at>clock_timestamp()-interval '1 day')>=150 OR (SELECT coalesce(sum(size_bytes),0) FROM umma_private.delivery_chat_messages WHERE sender=p_actor AND created_at>clock_timestamp()-interval '1 day')+coalesce((p_body->>'size')::integer,0)>104857600 THEN RAISE EXCEPTION 'CHAT_RATE'; END IF;
  IF p_action='send' AND (p_body->>'kind'<>'text' OR length(trim(coalesce(p_body->>'text','')))=0) THEN RAISE EXCEPTION 'CHAT_INPUT'; END IF;
  IF p_action='prepare' THEN
   ext:=CASE p_body->>'mime' WHEN 'image/jpeg' THEN 'jpg' WHEN 'image/png' THEN 'png' WHEN 'image/webp' THEN 'webp' WHEN 'video/mp4' THEN 'mp4' WHEN 'video/quicktime' THEN 'mov' WHEN 'video/webm' THEN 'webm' WHEN 'audio/webm' THEN 'webm' WHEN 'audio/mp4' THEN 'm4a' WHEN 'audio/mpeg' THEN 'mp3' WHEN 'audio/ogg' THEN 'ogg' WHEN 'audio/wav' THEN 'wav' END;
   IF ext IS NULL OR NOT ((p_body->>'kind'='photo' AND p_body->>'mime' LIKE 'image/%') OR (p_body->>'kind'='video' AND p_body->>'mime' LIKE 'video/%') OR (p_body->>'kind'='voice' AND p_body->>'mime' LIKE 'audio/%')) OR coalesce((p_body->>'size')::integer,0)<1 OR (p_body->>'size')::integer>(CASE p_body->>'kind' WHEN 'photo' THEN 8388608 WHEN 'voice' THEN 5242880 ELSE 20971520 END) THEN RAISE EXCEPTION 'CHAT_INPUT'; END IF;
  END IF;
  INSERT INTO umma_private.delivery_chat_messages(order_id,sender,recipient,request_key,kind,body,source_language,mime,size_bytes,sent_at)
  VALUES(p_order,p_actor,(ctx->>'peer')::bigint,(p_body->>'requestKey')::uuid,p_body->>'kind',coalesce(p_body->>'text',''),ctx->>'language',p_body->>'mime',coalesce((p_body->>'size')::integer,0),CASE WHEN p_action='send' THEN clock_timestamp() END) RETURNING * INTO m;
  IF p_action='prepare' THEN UPDATE umma_private.delivery_chat_messages SET object_path=p_order||'/'||p_actor||'/'||m.id||'.'||ext WHERE id=m.id RETURNING * INTO m;
  ELSE PERFORM umma_private.chat_notify(m); END IF;
  RETURN jsonb_build_object('ok',true,'message',to_jsonb(m),'replayed',false);
 END IF;
 SELECT * INTO m FROM umma_private.delivery_chat_messages WHERE id=(p_body->>'messageId')::uuid AND order_id=p_order AND ((sender=p_actor AND recipient=(ctx->>'peer')::bigint) OR (recipient=p_actor AND sender=(ctx->>'peer')::bigint)) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CHAT_ACCESS'; END IF;
 IF p_action='finish' THEN
  IF m.sender<>p_actor OR m.kind='text' THEN RAISE EXCEPTION 'CHAT_ACCESS'; END IF;
  IF m.sent_at IS NOT NULL THEN RETURN jsonb_build_object('ok',true,'message',to_jsonb(m),'replayed',true); END IF;
  PERFORM umma_private.chat_context(p_order,p_actor,true);
  SELECT metadata INTO obj FROM storage.objects WHERE bucket_id='delivery-chat' AND name=m.object_path;
  IF NOT FOUND OR (obj.metadata->>'size')::bigint IS DISTINCT FROM m.size_bytes::bigint OR split_part(obj.metadata->>'mimetype',';',1) IS DISTINCT FROM m.mime THEN RAISE EXCEPTION 'CHAT_UPLOAD'; END IF;
  UPDATE umma_private.delivery_chat_messages SET sent_at=clock_timestamp() WHERE id=m.id RETURNING * INTO m;PERFORM umma_private.chat_notify(m);
  RETURN jsonb_build_object('ok',true,'message',to_jsonb(m));
 END IF;
 IF p_action='media' THEN
  IF m.sent_at IS NULL AND m.sender<>p_actor THEN RAISE EXCEPTION 'CHAT_ACCESS'; END IF;
  RETURN jsonb_build_object('ok',true,'message',to_jsonb(m));
 END IF;
 IF m.recipient<>p_actor OR m.sent_at IS NULL OR (m.kind<>'voice' AND m.body='') THEN RAISE EXCEPTION 'CHAT_ACCESS'; END IF;
 lang:=ctx->>'language';
 SELECT * INTO t FROM umma_private.delivery_chat_translations WHERE message_id=m.id AND language=lang FOR UPDATE;
 IF p_action='claim' THEN
  IF FOUND AND (t.state='ready' OR t.leased_until>clock_timestamp() OR (t.attempts>=3 AND NOT coalesce((p_body->>'forceRetry')::boolean,false))) THEN RETURN jsonb_build_object('ok',true,'claimed',false,'state',t.state); END IF;
  IF (SELECT coalesce(sum(tr.attempts),0) FROM umma_private.delivery_chat_translations tr JOIN umma_private.delivery_chat_messages msg ON msg.id=tr.message_id WHERE msg.recipient=p_actor AND tr.last_attempt_at>clock_timestamp()-interval '1 day')>=300 THEN RAISE EXCEPTION 'CHAT_RATE'; END IF;
  INSERT INTO umma_private.delivery_chat_translations(message_id,language) VALUES(m.id,lang) ON CONFLICT(message_id,language) DO UPDATE SET state='processing',last_attempt_at=clock_timestamp(),lease=gen_random_uuid(),leased_until=clock_timestamp()+interval '120 seconds',attempts=umma_private.delivery_chat_translations.attempts+1 RETURNING * INTO t;
  RETURN jsonb_build_object('ok',true,'claimed',true,'message',to_jsonb(m),'translation',to_jsonb(t));
 END IF;
 IF p_action IN ('complete','fail') THEN
  IF t.lease IS DISTINCT FROM (p_body->>'lease')::uuid OR t.state<>'processing' THEN RAISE EXCEPTION 'CHAT_LEASE'; END IF;
  IF p_action='complete' AND (length(coalesce(p_body->>'translatedText','')) NOT BETWEEN 1 AND 4000 OR (p_body->>'audioPath' IS NOT NULL AND p_body->>'audioPath'<>p_order||'/translations/'||m.id||'/'||lang||'/'||t.lease||'.mp3')) THEN RAISE EXCEPTION 'CHAT_INPUT'; END IF;
  UPDATE umma_private.delivery_chat_translations SET state=CASE WHEN p_action='complete' THEN 'ready' ELSE 'failed' END,body=p_body->>'translatedText',transcript=p_body->>'transcript',audio_path=p_body->>'audioPath',leased_until=clock_timestamp()+interval '30 seconds' WHERE message_id=m.id AND language=lang;
  RETURN jsonb_build_object('ok',true);
 END IF;
 RAISE EXCEPTION 'CHAT_INPUT';
END;$$;
REVOKE ALL ON FUNCTION umma_private.chat_context(uuid,bigint,boolean),umma_private.chat_notify(umma_private.delivery_chat_messages),public.delivery_chat_action(bigint,text,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.delivery_chat_action(bigint,text,uuid,jsonb) TO service_role;
COMMIT;
