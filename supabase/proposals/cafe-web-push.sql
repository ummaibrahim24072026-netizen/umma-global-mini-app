BEGIN;
-- Private capability-bound browser subscriptions. No anonymous table/RPC access.
CREATE TABLE umma_private.cafe_push_config(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), value jsonb NOT NULL);
CREATE TABLE umma_private.cafe_push_subscriptions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES public.cafe_orders(id) ON DELETE CASCADE,
 endpoint text NOT NULL CHECK(length(endpoint)<4096), subscription jsonb NOT NULL, language text NOT NULL DEFAULT 'ru',
 expires_at timestamptz NOT NULL DEFAULT now()+interval '14 days', UNIQUE(order_id,endpoint));
CREATE TABLE umma_private.cafe_push_jobs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subscription_id uuid NOT NULL REFERENCES umma_private.cafe_push_subscriptions(id) ON DELETE CASCADE,
 payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), next_attempt_at timestamptz NOT NULL DEFAULT now(),
 attempts integer NOT NULL DEFAULT 0, lease_id uuid, leased_until timestamptz, sent_at timestamptz, last_error text);
CREATE INDEX cafe_push_jobs_pending ON umma_private.cafe_push_jobs(next_attempt_at) WHERE sent_at IS NULL AND attempts<6;
ALTER TABLE umma_private.cafe_push_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE umma_private.cafe_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE umma_private.cafe_push_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON umma_private.cafe_push_config,umma_private.cafe_push_subscriptions,umma_private.cafe_push_jobs FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.cafe_push_config(p_candidate jsonb DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Access denied'; END IF;
 IF p_candidate IS NOT NULL THEN
  INSERT INTO umma_private.cafe_push_config(value) VALUES(p_candidate) ON CONFLICT DO NOTHING;
 END IF;
 SELECT value INTO result FROM umma_private.cafe_push_config; RETURN result;
END $$;
CREATE FUNCTION public.cafe_push_subscribe(p_order uuid,p_key uuid,p_subscription jsonb,p_language text DEFAULT 'ru',p_remove boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Access denied'; END IF;
 IF NOT EXISTS(SELECT 1 FROM umma_private.public_guest_requests WHERE order_id=p_order AND request_key=p_key) THEN RAISE EXCEPTION 'Order unavailable'; END IF;
 IF p_remove THEN DELETE FROM umma_private.cafe_push_subscriptions WHERE order_id=p_order AND endpoint=p_subscription->>'endpoint';RETURN; END IF;
 IF length(p_subscription::text)>6000 OR length(coalesce(p_subscription->>'endpoint',''))<20 OR p_subscription->'keys'->>'p256dh' IS NULL OR p_subscription->'keys'->>'auth' IS NULL THEN RAISE EXCEPTION 'Invalid subscription'; END IF;
 IF (SELECT count(*) FROM umma_private.cafe_push_subscriptions WHERE order_id=p_order AND expires_at>now())>=5 AND NOT EXISTS(SELECT 1 FROM umma_private.cafe_push_subscriptions WHERE order_id=p_order AND endpoint=p_subscription->>'endpoint') THEN RAISE EXCEPTION 'Too many devices'; END IF;
 INSERT INTO umma_private.cafe_push_subscriptions(order_id,endpoint,subscription,language) VALUES(p_order,p_subscription->>'endpoint',p_subscription,CASE WHEN p_language IN ('ru','vi','en') THEN p_language ELSE 'en' END)
 ON CONFLICT(order_id,endpoint) DO UPDATE SET subscription=excluded.subscription,language=excluded.language,expires_at=now()+interval '14 days';
END $$;
CREATE FUNCTION public.cafe_push_wake() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE secret text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM umma_private.cafe_push_jobs WHERE sent_at IS NULL AND attempts<6 AND next_attempt_at<=now() AND (leased_until IS NULL OR leased_until<now())) THEN RETURN; END IF;
 SELECT value->>'dispatchKey' INTO secret FROM umma_private.cafe_push_config;
 IF secret IS NULL THEN RETURN; END IF;
 PERFORM net.http_post(url:='https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-push',headers:=jsonb_build_object('Content-Type','application/json','x-umma-push-key',secret),body:='{"action":"dispatch"}'::jsonb,timeout_milliseconds:=10000);
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Web push wake deferred to retry';
END $$;
CREATE FUNCTION public.enqueue_cafe_web_push() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.payment_status IS NOT DISTINCT FROM OLD.payment_status AND NEW.delivery_status IS NOT DISTINCT FROM OLD.delivery_status THEN RETURN NEW; END IF;
 INSERT INTO umma_private.cafe_push_jobs(subscription_id,payload)
 SELECT s.id,jsonb_build_object('id',NEW.id,'orderNumber',NEW.order_number,'status',NEW.status,'paymentStatus',NEW.payment_status,'deliveryStatus',NEW.delivery_status,
 'changes',jsonb_build_object('status',CASE WHEN NEW.status IS DISTINCT FROM OLD.status THEN NEW.status END,'payment',CASE WHEN NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN NEW.payment_status END,'delivery',CASE WHEN NEW.delivery_status IS DISTINCT FROM OLD.delivery_status THEN NEW.delivery_status END))
 FROM umma_private.cafe_push_subscriptions s WHERE s.order_id=NEW.id AND s.expires_at>now();
 IF FOUND THEN PERFORM public.cafe_push_wake(); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cafe_web_push AFTER UPDATE OF status,payment_status,delivery_status ON public.cafe_orders FOR EACH ROW EXECUTE FUNCTION public.enqueue_cafe_web_push();
CREATE FUNCTION public.cafe_push_lease() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Access denied'; END IF;
 WITH candidates AS (SELECT j.id FROM umma_private.cafe_push_jobs j JOIN umma_private.cafe_push_subscriptions s ON s.id=j.subscription_id WHERE j.sent_at IS NULL AND j.attempts<6 AND j.next_attempt_at<=now() AND (j.leased_until IS NULL OR j.leased_until<now()) AND s.expires_at>now() ORDER BY j.created_at LIMIT 30 FOR UPDATE OF j SKIP LOCKED), leased AS (
 UPDATE umma_private.cafe_push_jobs j SET lease_id=gen_random_uuid(),leased_until=now()+interval '60 seconds',attempts=attempts+1 FROM candidates c WHERE j.id=c.id RETURNING j.*)
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',l.id,'lease',l.lease_id,'createdAt',l.created_at,'payload',l.payload,'subscription',s.subscription,'language',s.language)),'[]') INTO result FROM leased l JOIN umma_private.cafe_push_subscriptions s ON s.id=l.subscription_id;
 RETURN result;
END $$;
CREATE FUNCTION public.cafe_push_finish(p_id uuid,p_lease uuid,p_success boolean,p_gone boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE sub uuid;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Access denied'; END IF;
 UPDATE umma_private.cafe_push_jobs SET sent_at=CASE WHEN p_success OR p_gone THEN now() END,lease_id=NULL,leased_until=NULL,next_attempt_at=now()+interval '30 seconds',last_error=CASE WHEN p_success THEN NULL ELSE 'Push delivery failed' END WHERE id=p_id AND lease_id=p_lease AND sent_at IS NULL RETURNING subscription_id INTO sub;
 IF p_gone AND sub IS NOT NULL THEN DELETE FROM umma_private.cafe_push_subscriptions WHERE id=sub; END IF;
END $$;
REVOKE ALL ON FUNCTION public.cafe_push_config(jsonb),public.cafe_push_subscribe(uuid,uuid,jsonb,text,boolean),public.cafe_push_wake(),public.enqueue_cafe_web_push(),public.cafe_push_lease(),public.cafe_push_finish(uuid,uuid,boolean,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cafe_push_config(jsonb),public.cafe_push_subscribe(uuid,uuid,jsonb,text,boolean),public.cafe_push_lease(),public.cafe_push_finish(uuid,uuid,boolean,boolean) TO service_role;
-- Fast path is a committed database trigger; cron recovers network/provider failures.
SELECT cron.schedule('umma-web-push-retry','30 seconds','SELECT public.cafe_push_wake()');
COMMIT;
