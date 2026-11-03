-- Web identities reuse the staff authorization model, with no Telegram login dependency.
CREATE SEQUENCE IF NOT EXISTS public.cafe_web_actor_seq START WITH 1000000000000;
CREATE TABLE public.cafe_web_accounts (
 actor_id bigint PRIMARY KEY REFERENCES public.telegram_users(telegram_id),
 login text UNIQUE NOT NULL CHECK(login ~ '^[a-z0-9_.-]{3,60}$'),
 password_hash text NOT NULL, salt text NOT NULL, active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.cafe_web_invites (
 token_hash text PRIMARY KEY, actor_id bigint NOT NULL REFERENCES public.telegram_users(telegram_id),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '48 hours', used_at timestamptz
);
CREATE TABLE public.cafe_web_sessions (
 token_hash text PRIMARY KEY, actor_id bigint NOT NULL REFERENCES public.cafe_web_accounts(actor_id),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '30 days', revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.cafe_web_sessions(actor_id);
CREATE TABLE public.cafe_web_login_rate(identity_hash text PRIMARY KEY, starts_at timestamptz NOT NULL DEFAULT now(), attempts int NOT NULL DEFAULT 0);
CREATE TABLE public.cafe_payment_screens (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), token_hash text UNIQUE NOT NULL,
 actor_id bigint NOT NULL REFERENCES public.telegram_users(telegram_id),
 location_id uuid NOT NULL REFERENCES public.locations(id),
 order_id uuid REFERENCES public.cafe_orders(id), active boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.cafe_payment_screens(actor_id);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['cafe_web_accounts','cafe_web_invites','cafe_web_sessions','cafe_web_login_rate','cafe_payment_screens'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',t);
 EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
END $$;
REVOKE ALL ON SEQUENCE public.cafe_web_actor_seq FROM PUBLIC,anon,authenticated;
GRANT ALL ON SEQUENCE public.cafe_web_actor_seq TO service_role;
CREATE FUNCTION public.cafe_web_rate_allow(p_identity text) RETURNS boolean LANGUAGE plpgsql SET search_path=public AS $$
DECLARE n int; BEGIN
 INSERT INTO cafe_web_login_rate(identity_hash,attempts) VALUES(p_identity,1)
 ON CONFLICT(identity_hash) DO UPDATE SET attempts=CASE WHEN cafe_web_login_rate.starts_at<now()-interval '15 minutes' THEN 1 ELSE cafe_web_login_rate.attempts+1 END,
 starts_at=CASE WHEN cafe_web_login_rate.starts_at<now()-interval '15 minutes' THEN now() ELSE cafe_web_login_rate.starts_at END RETURNING attempts INTO n;
 RETURN n<=15;
END $$;
CREATE FUNCTION public.cafe_web_activate(p_token text,p_login text,p_hash text,p_salt text) RETURNS bigint LANGUAGE plpgsql SET search_path=public AS $$
DECLARE a bigint; BEGIN
 SELECT actor_id INTO a FROM cafe_web_invites WHERE token_hash=p_token AND used_at IS NULL AND expires_at>now() FOR UPDATE;
 IF a IS NULL THEN RAISE EXCEPTION 'Invalid invitation'; END IF;
 INSERT INTO cafe_web_accounts(actor_id,login,password_hash,salt) VALUES(a,p_login,p_hash,p_salt);
 UPDATE cafe_web_invites SET used_at=now() WHERE token_hash=p_token;
 RETURN a;
END $$;
CREATE FUNCTION public.cafe_web_invite_staff(p_actor bigint,p_location uuid,p_role text,p_name text,p_token text) RETURNS bigint LANGUAGE plpgsql SET search_path=public AS $$
DECLARE a bigint; BEGIN
 IF NOT EXISTS(SELECT 1 FROM telegram_users WHERE telegram_id=p_actor AND is_active AND role='super_admin') THEN RAISE EXCEPTION 'Owner access required'; END IF;
 IF p_role NOT IN ('cashier','kitchen','courier','manager') OR NOT EXISTS(SELECT 1 FROM locations WHERE id=p_location AND is_active AND location_type='cafe') THEN RAISE EXCEPTION 'Invalid staff assignment'; END IF;
 a:=nextval('public.cafe_web_actor_seq');
 INSERT INTO telegram_users(telegram_id,first_name,role,is_active) VALUES(a,left(p_name,100),'employee',true);
 INSERT INTO cafe_staff(telegram_id,location_id,staff_role,can_accept_payments,courier_available,created_by_telegram_id)
 VALUES(a,p_location,p_role,p_role IN ('cashier','manager'),p_role='courier',p_actor);
 INSERT INTO cafe_web_invites(token_hash,actor_id) VALUES(p_token,a);
 RETURN a;
END $$;
REVOKE ALL ON FUNCTION public.cafe_web_rate_allow(text),public.cafe_web_activate(text,text,text,text),public.cafe_web_invite_staff(bigint,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cafe_web_rate_allow(text),public.cafe_web_activate(text,text,text,text),public.cafe_web_invite_staff(bigint,uuid,text,text,text) TO service_role;
