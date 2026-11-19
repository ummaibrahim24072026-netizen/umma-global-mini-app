BEGIN;

ALTER TABLE umma_private.cafe_connect_messages
 DROP CONSTRAINT cafe_connect_messages_content_check,
 ADD CONSTRAINT cafe_connect_messages_content_check CHECK (
  length(body)<=2000 AND (
   (media_kind IS NULL AND object_path IS NULL AND length(body)>=1)
   OR (media_kind IS NOT NULL AND object_path IS NOT NULL
       AND direction IN ('customer','staff') AND media_kind IN ('photo','video','voice','album'))
  )
 );

ALTER TABLE umma_private.cafe_connect_clients
 ADD COLUMN inbox_assignee bigint REFERENCES public.telegram_users(telegram_id),
 ADD COLUMN inbox_stage text NOT NULL DEFAULT 'new'
   CHECK (inbox_stage IN ('new','active','waiting','closed')),
 ADD COLUMN inbox_revision integer NOT NULL DEFAULT 0;

-- A general conversation belongs to one cafe only when its verified orders
-- identify a single branch, or there is just one active cafe and no order.
CREATE FUNCTION umma_private.connect_cafe(p_client uuid) RETURNS uuid
LANGUAGE sql STABLE SET search_path=pg_catalog,pg_temp AS $$
 WITH known AS (
  SELECT DISTINCT o.location_id AS id
  FROM umma_private.cafe_connect_clients c
  JOIN umma_private.cafe_menu_visitors v ON v.token_hash=c.token_hash
  JOIN umma_private.cafe_menu_visits s ON s.visitor_id=v.id
  JOIN umma_private.cafe_menu_visit_orders vo ON vo.visit_id=s.id
  JOIN public.cafe_orders o ON o.id=vo.order_id
  WHERE c.id=p_client
 ), candidates AS (
  SELECT id FROM known
  UNION ALL
  SELECT id FROM public.locations WHERE location_type='cafe' AND is_active
    AND NOT EXISTS (SELECT FROM known)
 )
 SELECT CASE WHEN count(*)=1 THEN (array_agg(id))[1] END FROM candidates;
$$;

CREATE FUNCTION umma_private.connect_owner(p_actor bigint) RETURNS boolean
LANGUAGE sql STABLE SET search_path=pg_catalog,pg_temp AS $$
 SELECT EXISTS (SELECT FROM public.telegram_users
   WHERE telegram_id=p_actor AND is_active AND role='super_admin');
$$;

CREATE FUNCTION umma_private.connect_role(p_actor bigint,p_cafe uuid,p_roles text[]) RETURNS boolean
LANGUAGE sql STABLE SET search_path=pg_catalog,pg_temp AS $$
 SELECT EXISTS (
  SELECT FROM public.cafe_staff s
  JOIN public.telegram_users u ON u.telegram_id=s.telegram_id AND u.is_active
  JOIN public.locations l ON l.id=s.location_id AND l.is_active AND l.location_type='cafe'
  WHERE s.telegram_id=p_actor AND s.location_id=p_cafe AND s.is_active AND s.staff_role=ANY(p_roles)
 );
$$;

CREATE FUNCTION umma_private.connect_can_read(p_actor bigint,p_client uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path=pg_catalog,pg_temp AS $$
 SELECT umma_private.connect_owner(p_actor) OR EXISTS (
  SELECT FROM umma_private.cafe_connect_clients c
  CROSS JOIN LATERAL (SELECT umma_private.connect_cafe(c.id) AS id) cafe
  WHERE c.id=p_client AND (
   umma_private.connect_role(p_actor,cafe.id,ARRAY['manager']) OR
   (c.inbox_assignee=p_actor AND umma_private.connect_role(p_actor,cafe.id,ARRAY['cashier','waiter']))
  )
 );
$$;

CREATE FUNCTION public.cafe_staff_inbox(p_actor bigint,p_action text,p_data jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE
 target uuid := (p_data->>'clientId')::uuid;
 owner_access boolean := umma_private.connect_owner(p_actor);
 c umma_private.cafe_connect_clients;
 cafe uuid;
 assignee bigint;
 stage text;
 result jsonb;
 manage boolean;
BEGIN
 IF current_setting('request.jwt.claims',true)::jsonb->>'role' IS DISTINCT FROM 'service_role'
   OR NOT (owner_access OR EXISTS (
   SELECT FROM public.cafe_staff s JOIN public.locations l ON l.id=s.location_id
   JOIN public.telegram_users u ON u.telegram_id=s.telegram_id AND u.is_active
   WHERE s.telegram_id=p_actor AND s.is_active AND l.is_active AND l.location_type='cafe'
    AND s.staff_role IN ('manager','cashier','waiter')
 )) THEN RAISE EXCEPTION 'Access denied'; END IF;

 IF p_action='staffInbox' THEN
  WITH allowed AS (
   SELECT conv.* FROM umma_private.cafe_connect_clients conv
   WHERE umma_private.connect_can_read(p_actor,conv.id)
    AND EXISTS (SELECT FROM umma_private.cafe_connect_messages m
                WHERE m.client_id=conv.id AND m.direction IN ('customer','staff'))
   ORDER BY conv.updated_at DESC,conv.id
   LIMIT 200
  ), items AS (
   SELECT conv.id,conv.name,conv.inbox_stage AS stage,conv.inbox_revision AS revision,
    NULLIF(concat_ws(' ',u.first_name,u.last_name),'') AS assignee_name,
    conv.inbox_assignee IS NOT NULL AS assigned,conv.inbox_assignee=p_actor AS mine,
    last.created_at AS last_at,last.body AS last_message,last.media_kind AS last_media,
    latest.order_number,last.id AS last_id,conv.updated_at,
    (SELECT count(*) FROM umma_private.cafe_connect_messages m
     WHERE m.client_id=conv.id AND m.direction='customer' AND m.read_at IS NULL) AS unread
   FROM allowed conv
   LEFT JOIN public.telegram_users u ON u.telegram_id=conv.inbox_assignee
   LEFT JOIN LATERAL (
    SELECT m.id,m.created_at,m.body,m.media_kind FROM umma_private.cafe_connect_messages m
    WHERE m.client_id=conv.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1
   ) last ON true
   LEFT JOIN LATERAL (
    SELECT o.order_number FROM umma_private.cafe_menu_visitors v
    JOIN umma_private.cafe_menu_visits s ON s.visitor_id=v.id
    JOIN umma_private.cafe_menu_visit_orders vo ON vo.visit_id=s.id
    JOIN public.cafe_orders o ON o.id=vo.order_id
    WHERE v.token_hash=conv.token_hash ORDER BY o.created_at DESC,o.id DESC LIMIT 1
   ) latest ON true
  )
  SELECT coalesce(jsonb_agg(to_jsonb(items)-'updated_at' ORDER BY updated_at DESC,id),'[]') INTO result FROM items;
  RETURN jsonb_build_object('ok',true,'clients',result);
 END IF;

 IF p_action NOT IN ('staffInboxDetails','staffInboxUpdate','staffInboxHistory') THEN RAISE EXCEPTION 'Access denied'; END IF;
 SELECT * INTO c FROM umma_private.cafe_connect_clients WHERE id=target FOR UPDATE;
 IF NOT FOUND OR NOT umma_private.connect_can_read(p_actor,target) THEN RAISE EXCEPTION 'Access denied'; END IF;
 IF p_action='staffInboxHistory' THEN
  SELECT coalesce(jsonb_agg(to_jsonb(page) ORDER BY page.created_at,page.id),'[]') INTO result FROM (
   SELECT m.id,m.direction,m.title,m.body,m.created_at,m.read_at,m.media_kind,m.video_note
   FROM umma_private.cafe_connect_messages m
   JOIN umma_private.cafe_connect_messages cursor ON cursor.id=(p_data->>'beforeId')::uuid
     AND cursor.client_id=c.id
   WHERE m.client_id=c.id AND (m.created_at,m.id)<(cursor.created_at,cursor.id)
   ORDER BY m.created_at DESC,m.id DESC LIMIT 50
  ) page;
  RETURN jsonb_build_object('ok',true,'messages',result);
 END IF;
 cafe := umma_private.connect_cafe(target);
 manage := owner_access OR umma_private.connect_role(p_actor,cafe,ARRAY['manager']);

 IF p_action='staffInboxUpdate' THEN
  IF (p_data->>'revision')::integer IS DISTINCT FROM c.inbox_revision THEN
   RETURN jsonb_build_object('ok',false,'error','Обращение уже обновлено. Откройте его снова.');
  END IF;
  stage := coalesce(p_data->>'stage',c.inbox_stage);
  assignee := c.inbox_assignee;
  IF p_data ? 'assignee' THEN
   IF NOT manage THEN RAISE EXCEPTION 'Access denied'; END IF;
   assignee := (p_data->>'assignee')::bigint;
   IF assignee IS NOT NULL AND NOT (umma_private.connect_owner(assignee) OR
      umma_private.connect_role(assignee,cafe,ARRAY['manager','cashier','waiter'])) THEN
    RAISE EXCEPTION 'Access denied';
   END IF;
   stage := CASE WHEN assignee IS NULL THEN 'new' WHEN stage='new' THEN 'active' ELSE stage END;
  END IF;
  IF stage NOT IN ('new','active','waiting','closed') OR (stage='new')<>(assignee IS NULL) THEN
   RETURN jsonb_build_object('ok',false,'error','Сначала назначьте ответственного.');
  END IF;
  UPDATE umma_private.cafe_connect_clients SET inbox_stage=stage,inbox_assignee=assignee,
    inbox_revision=inbox_revision+1 WHERE id=target;
  RETURN '{"ok":true}';
 END IF;

 RETURN jsonb_build_object('ok',true,'stage',c.inbox_stage,'revision',c.inbox_revision,
  'assignee',c.inbox_assignee::text,'canAssign',manage,
  'assignees',CASE WHEN manage THEN (
   SELECT coalesce(jsonb_agg(jsonb_build_object('id',u.telegram_id::text,'name',
    coalesce(NULLIF(concat_ws(' ',u.first_name,u.last_name),''),'Сотрудник')) ORDER BY u.first_name,u.telegram_id),'[]')
   FROM public.telegram_users u WHERE u.is_active AND (
    u.telegram_id=p_actor OR umma_private.connect_role(u.telegram_id,cafe,ARRAY['manager','cashier','waiter'])
   )
  ) ELSE '[]'::jsonb END,
  'orders',(
   SELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY o.created_at,o.id),'[]') FROM (
    SELECT o.id,o.order_number,o.created_at,o.location_id,o.status,o.payment_status,o.delivery_status,o.paid_at,
     (SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.created_at,e.id),'[]') FROM (
      SELECT id,to_status,created_at FROM public.cafe_order_events
      WHERE order_id=o.id AND to_status IN ('confirmed','preparing','ready','completed','cancelled',
       'courier_assigned','picked_up','in_transit','delivered')
      ORDER BY created_at DESC,id DESC LIMIT 30
     ) e) AS events
    FROM umma_private.cafe_menu_visitors v
    JOIN umma_private.cafe_menu_visits s ON s.visitor_id=v.id
    JOIN umma_private.cafe_menu_visit_orders vo ON vo.visit_id=s.id
    JOIN public.cafe_orders o ON o.id=vo.order_id
    WHERE v.token_hash=c.token_hash AND (owner_access OR o.location_id=cafe)
    ORDER BY o.created_at DESC,o.id DESC LIMIT 10
   ) o
  ));
END;
$$;

CREATE FUNCTION umma_private.connect_reopen_inbox() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 UPDATE umma_private.cafe_connect_clients SET inbox_stage='active',inbox_revision=inbox_revision+1
 WHERE id=NEW.client_id AND inbox_stage IN ('waiting','closed');
 RETURN NEW;
END;
$$;
CREATE TRIGGER connect_reopen_inbox AFTER INSERT ON umma_private.cafe_connect_messages
 FOR EACH ROW WHEN (NEW.direction='customer') EXECUTE FUNCTION umma_private.connect_reopen_inbox();

REVOKE ALL ON FUNCTION public.cafe_staff_inbox(bigint,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cafe_staff_inbox(bigint,text,jsonb) TO service_role;
REVOKE ALL ON FUNCTION umma_private.connect_owner(bigint),umma_private.connect_cafe(uuid),
 umma_private.connect_role(bigint,uuid,text[]),umma_private.connect_can_read(bigint,uuid),
 umma_private.connect_reopen_inbox() FROM PUBLIC,anon,authenticated;

-- Preserve the deployed customer, campaign, notification and media logic.
-- Abort the entire migration if an upstream release changed either guard.
DO $$
DECLARE
 definition text;
 guard text := 'IF NOT EXISTS(SELECT 1 FROM public.telegram_users WHERE telegram_id=p_actor AND is_active AND role=''super_admin'') THEN RAISE EXCEPTION ''Access denied''; END IF;';
 translation_guard text := 'if not exists(select 1 from public.telegram_users where telegram_id=p_actor and is_active and role=''super_admin'') then raise exception ''Access denied'';end if;';
BEGIN
 definition := pg_get_functiondef('public.cafe_connect(text,text,bigint,jsonb)'::regprocedure);
 IF strpos(definition,guard)=0 THEN RAISE EXCEPTION 'Unexpected cafe_connect guard'; END IF;
 definition := replace(definition,guard,
  'IF NOT umma_private.connect_owner(p_actor) AND NOT (
    p_action IN (''staffThread'',''staffRead'',''staffReply'',''staffMediaGet'',''staffMediaPrepare'',''staffMediaSend'',''staffVoiceClaim'',''staffVoiceComplete'')
    AND umma_private.connect_can_read(p_actor,(p_data->>''clientId'')::uuid)
  ) THEN RAISE EXCEPTION ''Access denied''; END IF;');
 IF strpos(definition,'IF c.id IS NULL THEN RAISE EXCEPTION ''Channel unavailable''; END IF;')=0
 THEN RAISE EXCEPTION 'Unexpected cafe_connect row guard'; END IF;
 definition := replace(definition,
  'IF c.id IS NULL THEN RAISE EXCEPTION ''Channel unavailable''; END IF;',
  'IF c.id IS NULL THEN RAISE EXCEPTION ''Channel unavailable''; END IF;
   IF p_action LIKE ''staff%'' AND NOT umma_private.connect_can_read(p_actor,c.id)
   THEN RAISE EXCEPTION ''Access denied''; END IF;');
 EXECUTE definition;
 definition := pg_get_functiondef('public.cafe_connect_translate_access(text,bigint,uuid,uuid,text,text)'::regprocedure);
 IF strpos(definition,translation_guard)=0 THEN RAISE EXCEPTION 'Unexpected cafe_connect_translate_access guard'; END IF;
 EXECUTE replace(definition,translation_guard,
  'if not umma_private.connect_can_read(p_actor,p_client_id) then raise exception ''Access denied''; end if;');
END $$;

COMMIT;
