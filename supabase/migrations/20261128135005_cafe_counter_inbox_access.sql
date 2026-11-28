ALTER TABLE public.cafe_staff
 ADD COLUMN can_handle_customer_inbox boolean NOT NULL DEFAULT false;

CREATE FUNCTION umma_private.connect_counter_inbox(p_actor bigint,p_cafe uuid DEFAULT NULL) RETURNS boolean
LANGUAGE sql STABLE SET search_path=pg_catalog,pg_temp AS $$
 SELECT EXISTS (
  SELECT FROM public.cafe_staff s
  JOIN public.telegram_users u ON u.telegram_id=s.telegram_id AND u.is_active
  JOIN public.locations l ON l.id=s.location_id AND l.is_active AND l.location_type='cafe'
  WHERE s.telegram_id=p_actor AND s.is_active AND s.staff_role='kitchen'
   AND s.can_accept_payments AND s.can_handle_customer_inbox
   AND (p_cafe IS NULL OR s.location_id=p_cafe)
 );
$$;

REVOKE ALL ON FUNCTION umma_private.connect_counter_inbox(bigint,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION umma_private.connect_counter_inbox(bigint,uuid) TO service_role;

CREATE OR REPLACE FUNCTION umma_private.connect_can_read(p_actor bigint,p_client uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path=pg_catalog,pg_temp AS $$
 SELECT umma_private.connect_owner(p_actor) OR EXISTS (
  SELECT FROM umma_private.cafe_connect_clients c
  CROSS JOIN LATERAL (SELECT umma_private.connect_cafe(c.id) AS id) cafe
  WHERE c.id=p_client AND (
   umma_private.connect_role(p_actor,cafe.id,ARRAY['manager']) OR
   (c.inbox_assignee=p_actor AND umma_private.connect_role(p_actor,cafe.id,ARRAY['cashier','waiter'])) OR
   (cafe.id IS NOT NULL AND umma_private.connect_counter_inbox(p_actor,cafe.id))
  )
 );
$$;

CREATE OR REPLACE FUNCTION umma_private.connect_call_staff(p_actor bigint) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $$
 SELECT umma_private.connect_owner(p_actor) OR umma_private.connect_counter_inbox(p_actor) OR EXISTS (
  SELECT FROM public.cafe_staff s
  WHERE s.telegram_id=p_actor AND s.is_active
   AND s.staff_role IN ('manager','cashier','waiter')
   AND umma_private.connect_role(p_actor,s.location_id,ARRAY['manager','cashier','waiter'])
 );
$$;

DO $$
DECLARE
 definition text := pg_get_functiondef('public.cafe_staff_inbox(bigint,text,jsonb)'::regprocedure);
 gate text := 'OR NOT (owner_access OR EXISTS (';
 inbox_fields text := 'latest.order_number,last.id AS last_id,conv.updated_at,';
BEGIN
 IF strpos(definition,gate)=0 OR strpos(definition,inbox_fields)=0 THEN
  RAISE EXCEPTION 'Unexpected cafe_staff_inbox definition';
 END IF;
 definition := replace(definition,gate,
  'OR NOT (owner_access OR umma_private.connect_counter_inbox(p_actor) OR EXISTS (');
 definition := replace(definition,inbox_fields,inbox_fields || '
    (SELECT m.id FROM umma_private.cafe_connect_messages m
     WHERE m.client_id=conv.id AND m.direction=''customer'' AND m.read_at IS NULL
     ORDER BY m.created_at DESC,m.id DESC LIMIT 1) AS last_unread_id,');
 EXECUTE definition;
END $$;
