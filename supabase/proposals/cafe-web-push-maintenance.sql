BEGIN;
CREATE OR REPLACE FUNCTION public.cafe_push_lease() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Access denied'; END IF;
 WITH candidates AS (SELECT j.id FROM umma_private.cafe_push_jobs j JOIN umma_private.cafe_push_subscriptions s ON s.id=j.subscription_id WHERE j.sent_at IS NULL AND j.attempts<6 AND j.next_attempt_at<=now() AND (j.leased_until IS NULL OR j.leased_until<now()) AND s.expires_at>now() ORDER BY j.created_at LIMIT 30 FOR UPDATE OF j SKIP LOCKED), leased AS (
 UPDATE umma_private.cafe_push_jobs j SET lease_id=gen_random_uuid(),leased_until=now()+interval '60 seconds',attempts=attempts+1 FROM candidates c WHERE j.id=c.id RETURNING j.*)
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',l.id,'lease',l.lease_id,'createdAt',l.created_at,'payload',l.payload,'subscription',s.subscription,'language',s.language)),'[]') INTO result FROM leased l JOIN umma_private.cafe_push_subscriptions s ON s.id=l.subscription_id;
 RETURN result;
END $$;
CREATE INDEX cafe_push_jobs_subscription ON umma_private.cafe_push_jobs(subscription_id);
CREATE FUNCTION public.cafe_push_cleanup() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 DELETE FROM umma_private.cafe_push_jobs WHERE created_at<now()-interval '30 days';
 DELETE FROM umma_private.cafe_push_subscriptions WHERE expires_at<now();
$$;
REVOKE ALL ON FUNCTION public.cafe_push_cleanup() FROM PUBLIC,anon,authenticated;
SELECT cron.schedule('umma-web-push-cleanup','15 3 * * *','SELECT public.cafe_push_cleanup()');
COMMIT;
