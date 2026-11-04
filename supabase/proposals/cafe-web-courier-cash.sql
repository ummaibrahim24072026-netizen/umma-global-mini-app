BEGIN;
-- Couriers collect cash only on their assigned, picked-up delivery (existing payment guard).
CREATE OR REPLACE FUNCTION public.cafe_web_invite_staff(p_actor bigint,p_location uuid,p_role text,p_name text,p_token text) RETURNS bigint LANGUAGE plpgsql SET search_path=public AS $$
DECLARE a bigint; BEGIN
 IF NOT EXISTS(SELECT 1 FROM telegram_users WHERE telegram_id=p_actor AND is_active AND role='super_admin') THEN RAISE EXCEPTION 'Owner access required'; END IF;
 IF p_role NOT IN ('cashier','kitchen','courier','manager') OR NOT EXISTS(SELECT 1 FROM locations WHERE id=p_location AND is_active AND location_type='cafe') THEN RAISE EXCEPTION 'Invalid staff assignment'; END IF;
 a:=nextval('public.cafe_web_actor_seq');
 INSERT INTO telegram_users(telegram_id,first_name,role,is_active) VALUES(a,left(p_name,100),'employee',true);
 INSERT INTO cafe_staff(telegram_id,location_id,staff_role,can_accept_payments,courier_available,created_by_telegram_id)
 VALUES(a,p_location,p_role,p_role IN ('cashier','manager','courier'),p_role='courier',p_actor);
 INSERT INTO cafe_web_invites(token_hash,actor_id) VALUES(p_token,a);
 RETURN a;
END $$;
UPDATE public.cafe_staff s SET can_accept_payments=true FROM public.cafe_web_accounts a WHERE a.actor_id=s.telegram_id AND a.active AND s.is_active AND s.staff_role='courier' AND NOT s.can_accept_payments;
COMMIT;
