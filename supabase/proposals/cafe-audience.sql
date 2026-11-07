BEGIN;

CREATE TABLE umma_private.cafe_menu_visitors (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 token_hash text NOT NULL UNIQUE,
 installed_at timestamptz
);

CREATE TABLE umma_private.cafe_menu_visits (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 visitor_id uuid NOT NULL REFERENCES umma_private.cafe_menu_visitors(id) ON DELETE CASCADE,
 point text NOT NULL,
 started_at timestamptz NOT NULL DEFAULT now(),
 last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cafe_menu_visits_visitor_recent ON umma_private.cafe_menu_visits(visitor_id, last_seen_at DESC);
CREATE INDEX cafe_menu_visits_recent ON umma_private.cafe_menu_visits(last_seen_at DESC);

CREATE TABLE umma_private.cafe_menu_visit_orders (
 order_id uuid PRIMARY KEY REFERENCES public.cafe_orders(id) ON DELETE CASCADE,
 visit_id uuid NOT NULL REFERENCES umma_private.cafe_menu_visits(id) ON DELETE CASCADE
);
CREATE INDEX cafe_menu_visit_orders_visit ON umma_private.cafe_menu_visit_orders(visit_id);

ALTER TABLE umma_private.cafe_menu_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE umma_private.cafe_menu_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE umma_private.cafe_menu_visit_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON umma_private.cafe_menu_visitors, umma_private.cafe_menu_visits, umma_private.cafe_menu_visit_orders
 FROM PUBLIC, anon, authenticated;

-- Called only by the edge after hashing a random browser token.
CREATE FUNCTION public.cafe_menu_visit(p_hash text, p_point text, p_installed boolean,
 p_order_id uuid DEFAULT NULL, p_request_key uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE
 visitor uuid;
 visit umma_private.cafe_menu_visits;
 source_point text := coalesce(p_point,'');
BEGIN
 IF current_setting('request.jwt.claims',true)::jsonb->>'role' IS DISTINCT FROM 'service_role'
    OR p_hash IS NULL OR p_hash !~ '^[a-f0-9]{64}$' OR source_point !~ '^[a-zA-Z0-9_-]{0,80}$' THEN
  RAISE EXCEPTION 'Access denied';
 END IF;

 IF p_order_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM umma_private.public_guest_requests r
  JOIN public.cafe_orders o ON o.id=r.order_id
  WHERE r.order_id=p_order_id AND r.request_key=p_request_key
 ) THEN
  RAISE EXCEPTION 'Order unavailable';
 END IF;

 INSERT INTO umma_private.cafe_menu_visitors(token_hash) VALUES(p_hash)
 ON CONFLICT(token_hash) DO NOTHING;
 SELECT id INTO visitor FROM umma_private.cafe_menu_visitors WHERE token_hash=p_hash FOR UPDATE;
 IF p_installed THEN
  UPDATE umma_private.cafe_menu_visitors SET installed_at=now()
  WHERE id=visitor AND installed_at IS NULL;
 END IF;

 SELECT * INTO visit FROM umma_private.cafe_menu_visits
 WHERE visitor_id=visitor AND (source_point='' OR cafe_menu_visits.point=source_point)
 ORDER BY last_seen_at DESC,id DESC LIMIT 1;
 IF visit.id IS NULL OR visit.last_seen_at <= now()-interval '30 minutes' THEN
  INSERT INTO umma_private.cafe_menu_visits(visitor_id,point) VALUES(visitor,source_point) RETURNING * INTO visit;
 ELSE
  UPDATE umma_private.cafe_menu_visits SET last_seen_at=greatest(last_seen_at,now()) WHERE id=visit.id;
 END IF;

 IF p_order_id IS NOT NULL THEN
  INSERT INTO umma_private.cafe_menu_visit_orders(order_id,visit_id) VALUES(p_order_id,visit.id)
  ON CONFLICT(order_id) DO NOTHING;
 END IF;
 RETURN '{"ok":true}';
END $$;

CREATE FUNCTION public.cafe_menu_audience(p_actor bigint, p_segment text DEFAULT 'all', p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE result jsonb;
BEGIN
 IF current_setting('request.jwt.claims',true)::jsonb->>'role' IS DISTINCT FROM 'service_role'
    OR NOT EXISTS(SELECT 1 FROM public.telegram_users WHERE telegram_id=p_actor AND is_active AND role='super_admin')
    OR p_segment NOT IN ('all','new','returning','regular','viewed','push') THEN
  RAISE EXCEPTION 'Access denied';
 END IF;

 WITH recent AS MATERIALIZED (
  SELECT v.*, EXISTS(SELECT 1 FROM umma_private.cafe_menu_visit_orders o WHERE o.visit_id=v.id) AS ordered
  FROM umma_private.cafe_menu_visits v WHERE v.last_seen_at >= now()-interval '30 days'
 ), devices AS MATERIALIZED (
  SELECT visitor_id, count(*) AS visits_recent, max(last_seen_at) AS last_seen_at,
         (array_agg(point ORDER BY last_seen_at DESC,id DESC))[1] AS point
  FROM recent GROUP BY visitor_id
 ), audience AS MATERIALIZED (
  SELECT d.*, g.id, g.installed_at IS NOT NULL AS installed, c.id AS client_id, c.name,
         coalesce(c.promotions,false) AS promotions, c.subscription IS NOT NULL AS push_enabled,
         history.visits, history.orders, history.first_seen_at
  FROM devices d JOIN umma_private.cafe_menu_visitors g ON g.id=d.visitor_id
  LEFT JOIN umma_private.cafe_connect_clients c ON c.token_hash=g.token_hash
  CROSS JOIN LATERAL (
   SELECT count(*) AS visits, min(v.started_at) AS first_seen_at,
          coalesce(sum((SELECT count(*) FROM umma_private.cafe_menu_visit_orders o WHERE o.visit_id=v.id)),0) AS orders
   FROM umma_private.cafe_menu_visits v WHERE v.visitor_id=g.id
  ) history
 ), selected AS MATERIALIZED (
  SELECT * FROM audience WHERE CASE p_segment
   WHEN 'new' THEN visits=1
   WHEN 'returning' THEN visits>1
   WHEN 'regular' THEN orders>=2
   WHEN 'viewed' THEN orders=0 AND last_seen_at<=now()-interval '30 minutes'
   WHEN 'push' THEN installed AND push_enabled
   ELSE true END
 )
 SELECT jsonb_build_object(
  'ok',true,
  'devices',(SELECT count(*) FROM audience),
  'firstTimers',(SELECT count(*) FROM audience WHERE visits=1),
  'returning',(SELECT count(*) FROM audience WHERE visits>1),
  'regular',(SELECT count(*) FROM audience WHERE orders>=2),
  'installed',(SELECT count(*) FROM audience WHERE installed),
  'pushInstalled',(SELECT count(*) FROM audience WHERE installed AND push_enabled),
  'visits',(SELECT count(*) FROM recent),
  'withoutOrder',(SELECT count(*) FROM recent WHERE NOT ordered AND last_seen_at<=now()-interval '30 minutes'),
  'points',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.visits DESC,p.point),'[]')
   FROM (SELECT point,count(*) AS visits,count(DISTINCT visitor_id) AS devices FROM recent GROUP BY point) p),
  'matched',(SELECT count(*) FROM selected),
  'guests',(SELECT coalesce(jsonb_agg(to_jsonb(g) ORDER BY g.last_seen_at DESC,g.id),'[]')
   FROM (SELECT id,client_id,name,visits,visits_recent,orders,first_seen_at,last_seen_at,point,installed,push_enabled
    FROM selected ORDER BY last_seen_at DESC,id LIMIT 50 OFFSET greatest(p_offset,0)) g)
 ) INTO result;
 RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.cafe_menu_visit(text,text,boolean,uuid,uuid),
 public.cafe_menu_audience(bigint,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cafe_menu_visit(text,text,boolean,uuid,uuid),
 public.cafe_menu_audience(bigint,text,integer) TO service_role;

-- Reuse the current campaign, outbox and opt-out behavior for installed app reminders.
DO $migration$
DECLARE definition text := pg_get_functiondef('public.cafe_connect(text,text,bigint,jsonb)'::regprocedure);
        existing text := 'WHERE promotions AND (p_data->>''language''=''all'' OR language=p_data->>''language'');';
BEGIN
 IF strpos(definition,existing)=0 THEN RAISE EXCEPTION 'Unexpected cafe_connect campaign definition'; END IF;
 EXECUTE replace(definition,existing,
  'WHERE promotions AND (p_data->>''language''=''all'' OR language=p_data->>''language'')
   AND (NOT coalesce((p_data->>''installedOnly'')::boolean,false) OR
        (subscription IS NOT NULL AND EXISTS(SELECT 1 FROM umma_private.cafe_menu_visitors v
          WHERE v.token_hash=cafe_connect_clients.token_hash AND v.installed_at IS NOT NULL)));');
END $migration$;

COMMIT;
