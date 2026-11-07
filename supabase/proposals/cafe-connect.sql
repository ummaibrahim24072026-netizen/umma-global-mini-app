BEGIN;
CREATE TABLE umma_private.cafe_connect_clients (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), token_hash text UNIQUE NOT NULL, name text NOT NULL DEFAULT '',
 language text NOT NULL DEFAULT 'ru', promotions boolean NOT NULL DEFAULT false, subscription jsonb,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE umma_private.cafe_connect_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_id uuid NOT NULL REFERENCES umma_private.cafe_connect_clients(id) ON DELETE CASCADE,
 request_key uuid NOT NULL, direction text NOT NULL CHECK(direction IN ('customer','staff','campaign')),
 title text NOT NULL DEFAULT '', body text NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),
 created_at timestamptz NOT NULL DEFAULT now(), read_at timestamptz, UNIQUE(client_id,request_key));
CREATE INDEX cafe_connect_thread ON umma_private.cafe_connect_messages(client_id,created_at DESC);
CREATE TABLE umma_private.cafe_connect_campaigns (
 request_key uuid PRIMARY KEY, title text NOT NULL, body text NOT NULL, language text NOT NULL, recipients integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE umma_private.cafe_connect_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), message_id uuid UNIQUE NOT NULL REFERENCES umma_private.cafe_connect_messages(id) ON DELETE CASCADE,
 next_attempt_at timestamptz NOT NULL DEFAULT now(), attempts int NOT NULL DEFAULT 0, lease_id uuid, leased_until timestamptz,
 sent_at timestamptz, failed boolean NOT NULL DEFAULT false);
CREATE INDEX cafe_connect_pending ON umma_private.cafe_connect_jobs(next_attempt_at) WHERE sent_at IS NULL AND attempts<6 AND NOT failed;
ALTER TABLE umma_private.cafe_connect_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE umma_private.cafe_connect_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE umma_private.cafe_connect_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE umma_private.cafe_connect_campaigns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON umma_private.cafe_connect_clients,umma_private.cafe_connect_messages,umma_private.cafe_connect_jobs,umma_private.cafe_connect_campaigns FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.cafe_connect_wake() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE secret text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM umma_private.cafe_connect_jobs WHERE sent_at IS NULL AND NOT failed AND attempts<6 AND next_attempt_at<=now() AND (leased_until IS NULL OR leased_until<now())) THEN RETURN; END IF;
 SELECT value->>'dispatchKey' INTO secret FROM umma_private.cafe_push_config;
 IF secret IS NULL THEN RETURN; END IF;
 PERFORM net.http_post(url:='https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-connect',headers:=jsonb_build_object('Content-Type','application/json','x-umma-push-key',secret),body:='{"action":"dispatch"}'::jsonb,timeout_milliseconds:=10000);
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Connect delivery deferred';
END $$;
-- Only the server can execute this RPC. Device credentials are hashed by the edge;
-- operator identity is verified against an active staff session before calling it.
CREATE FUNCTION public.cafe_connect(p_action text,p_hash text DEFAULT '',p_actor bigint DEFAULT NULL,p_data jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE c umma_private.cafe_connect_clients; target uuid; k uuid; result jsonb; n integer; old umma_private.cafe_connect_campaigns;
BEGIN
 IF current_setting('request.jwt.claims',true)::jsonb->>'role' IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Access denied'; END IF;
 IF p_action IN ('lease','finish') THEN
  IF p_action='lease' THEN
   WITH candidates AS (SELECT j.id FROM umma_private.cafe_connect_jobs j JOIN umma_private.cafe_connect_messages m ON m.id=j.message_id JOIN umma_private.cafe_connect_clients cl ON cl.id=m.client_id WHERE j.sent_at IS NULL AND NOT j.failed AND j.attempts<6 AND j.next_attempt_at<=now() AND (j.leased_until IS NULL OR j.leased_until<now()) AND cl.subscription IS NOT NULL AND (m.direction<>'campaign' OR cl.promotions) ORDER BY j.next_attempt_at LIMIT 25 FOR UPDATE OF j SKIP LOCKED), leased AS (UPDATE umma_private.cafe_connect_jobs j SET lease_id=gen_random_uuid(),leased_until=now()+interval '60 seconds',attempts=attempts+1 FROM candidates ca WHERE j.id=ca.id RETURNING j.*)
   SELECT coalesce(jsonb_agg(jsonb_build_object('id',l.id,'lease',l.lease_id,'subscription',cl.subscription,'title',m.title,'body',m.body,'messageId',m.id)),'[]') INTO result FROM leased l JOIN umma_private.cafe_connect_messages m ON m.id=l.message_id JOIN umma_private.cafe_connect_clients cl ON cl.id=m.client_id;
   RETURN result;
  END IF;
  UPDATE umma_private.cafe_connect_jobs SET sent_at=CASE WHEN (p_data->>'success')::boolean THEN now() END, failed=coalesce((p_data->>'gone')::boolean,false),lease_id=NULL,leased_until=NULL,next_attempt_at=now()+interval '2 minutes' WHERE id=(p_data->>'id')::uuid AND lease_id=(p_data->>'lease')::uuid RETURNING message_id INTO target;
  IF target IS NOT NULL AND coalesce((p_data->>'gone')::boolean,false) THEN UPDATE umma_private.cafe_connect_clients SET subscription=NULL WHERE id=(SELECT client_id FROM umma_private.cafe_connect_messages WHERE id=target) AND subscription=p_data->'subscription'; END IF;
  RETURN '{"ok":true}';
 END IF;
 IF p_action LIKE 'staff%' THEN
  IF NOT EXISTS(SELECT 1 FROM public.telegram_users WHERE telegram_id=p_actor AND is_active AND role='super_admin') THEN RAISE EXCEPTION 'Access denied'; END IF;
  IF p_action='staffList' THEN
   SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO result FROM (SELECT cl.id,cl.name,cl.language,cl.promotions,cl.subscription IS NOT NULL AS push_enabled,cl.created_at,(SELECT count(*) FROM umma_private.cafe_connect_messages m WHERE m.client_id=cl.id AND direction='customer' AND read_at IS NULL) AS unread,(SELECT body FROM umma_private.cafe_connect_messages m WHERE m.client_id=cl.id ORDER BY created_at DESC LIMIT 1) AS last_message FROM umma_private.cafe_connect_clients cl ORDER BY cl.updated_at DESC LIMIT 200) x;
   RETURN jsonb_build_object('ok',true,'clients',result,'total',(SELECT count(*) FROM umma_private.cafe_connect_clients),'subscribers',(SELECT count(*) FROM umma_private.cafe_connect_clients WHERE promotions),'pushDevices',(SELECT count(*) FROM umma_private.cafe_connect_clients WHERE promotions AND subscription IS NOT NULL));
  END IF;
  IF p_action='staffCampaign' THEN
   k:=(p_data->>'requestKey')::uuid;
   PERFORM pg_advisory_xact_lock(hashtextextended(k::text,0));
   SELECT * INTO old FROM umma_private.cafe_connect_campaigns WHERE request_key=k;
   IF FOUND THEN RETURN jsonb_build_object('ok',true,'recipients',old.recipients); END IF;
   IF EXISTS(SELECT 1 FROM umma_private.cafe_connect_campaigns WHERE created_at>now()-interval '30 seconds') THEN RAISE EXCEPTION 'Please wait before sending again'; END IF;
   INSERT INTO umma_private.cafe_connect_campaigns(request_key,title,body,language) VALUES(k,p_data->>'title',p_data->>'body',coalesce(p_data->>'language','all'));
   INSERT INTO umma_private.cafe_connect_messages(client_id,request_key,direction,title,body) SELECT id,k,'campaign',p_data->>'title',p_data->>'body' FROM umma_private.cafe_connect_clients WHERE promotions AND (p_data->>'language'='all' OR language=p_data->>'language');
   GET DIAGNOSTICS n=ROW_COUNT;
   UPDATE umma_private.cafe_connect_campaigns SET recipients=n WHERE request_key=k;
   INSERT INTO umma_private.cafe_connect_jobs(message_id) SELECT m.id FROM umma_private.cafe_connect_messages m JOIN umma_private.cafe_connect_clients cl ON cl.id=m.client_id WHERE m.request_key=k AND m.direction='campaign' AND cl.subscription IS NOT NULL;
   PERFORM public.cafe_connect_wake();
   RETURN jsonb_build_object('ok',true,'recipients',n);
  END IF;
  target:=(p_data->>'clientId')::uuid;
  SELECT * INTO c FROM umma_private.cafe_connect_clients WHERE id=target FOR UPDATE;
 ELSE
  IF p_hash!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid credential'; END IF;
  IF p_action='join' THEN INSERT INTO umma_private.cafe_connect_clients(token_hash) VALUES(p_hash) ON CONFLICT(token_hash) DO NOTHING; END IF;
  SELECT * INTO c FROM umma_private.cafe_connect_clients WHERE token_hash=p_hash FOR UPDATE;
 END IF;
 IF c.id IS NULL THEN RAISE EXCEPTION 'Channel unavailable'; END IF;
 IF p_action='preferences' THEN
  UPDATE umma_private.cafe_connect_clients SET name=left(coalesce(p_data->>'name',name),80),language=left(coalesce(p_data->>'language',language),12),promotions=coalesce((p_data->>'promotions')::boolean,promotions),subscription=CASE WHEN p_data ? 'subscription' THEN nullif(p_data->'subscription','null') ELSE subscription END,updated_at=now() WHERE id=c.id;
 ELSIF p_action IN ('send','staffReply') THEN
  k:=(p_data->>'requestKey')::uuid;
  IF NOT EXISTS(SELECT 1 FROM umma_private.cafe_connect_messages WHERE client_id=c.id AND request_key=k) THEN
   IF p_action='send' AND (SELECT count(*) FROM umma_private.cafe_connect_messages WHERE client_id=c.id AND direction='customer' AND created_at>now()-interval '1 minute')>=5 THEN RAISE EXCEPTION 'Please wait before sending again'; END IF;
   INSERT INTO umma_private.cafe_connect_messages(client_id,request_key,direction,title,body) VALUES(c.id,k,CASE WHEN p_action='send' THEN 'customer' ELSE 'staff' END,CASE WHEN p_action='send' THEN '' ELSE 'UMMA' END,p_data->>'body') RETURNING id INTO target;
   UPDATE umma_private.cafe_connect_clients SET updated_at=now() WHERE id=c.id;
   IF p_action='staffReply' AND c.subscription IS NOT NULL THEN INSERT INTO umma_private.cafe_connect_jobs(message_id) VALUES(target);PERFORM public.cafe_connect_wake(); END IF;
  END IF;
 ELSIF p_action IN ('read','staffRead') THEN
  UPDATE umma_private.cafe_connect_messages SET read_at=now() WHERE client_id=c.id AND read_at IS NULL AND (CASE WHEN p_action='read' THEN direction IN ('staff','campaign') ELSE direction='customer' END) AND created_at<=coalesce((p_data->>'before')::timestamptz,now());
 END IF;
 SELECT * INTO c FROM umma_private.cafe_connect_clients WHERE id=c.id;
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at),'[]') INTO result FROM (SELECT id,direction,title,body,created_at,read_at FROM umma_private.cafe_connect_messages WHERE client_id=c.id ORDER BY created_at DESC LIMIT 100) x;
 RETURN jsonb_build_object('ok',true,'client',jsonb_build_object('id',c.id,'name',c.name,'language',c.language,'promotions',c.promotions,'pushEnabled',c.subscription IS NOT NULL),'messages',result);
END $$;
REVOKE ALL ON FUNCTION public.cafe_connect(text,text,bigint,jsonb),public.cafe_connect_wake() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cafe_connect(text,text,bigint,jsonb) TO service_role;
SELECT cron.schedule('umma-connect-retry','* * * * *','SELECT public.cafe_connect_wake()');
COMMIT;
