-- Short-lived one-use authentication: pg_net queue never contains the Vault secret.
BEGIN;
CREATE TABLE umma_courier_internal.worker_nonces(nonce uuid PRIMARY KEY,expires_at timestamptz NOT NULL);
ALTER TABLE umma_courier_internal.worker_nonces ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON umma_courier_internal.worker_nonces FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.issue_cafe_courier_worker_token() RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE message text;secret text;
BEGIN
 message:=(floor(extract(epoch from clock_timestamp()))::bigint+90)::text||'.'||gen_random_uuid()::text;
 SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name='umma_courier_worker_secret';
 IF secret IS NULL THEN RAISE EXCEPTION 'Worker secret missing';END IF;
 RETURN message||'.'||encode(extensions.hmac(message,secret,'sha256'),'hex');
END $$;
REVOKE ALL ON FUNCTION public.issue_cafe_courier_worker_token() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.authorize_cafe_courier_worker_token(p_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE parts text[];secret text;expected text;expiry bigint;inserted integer;
BEGIN
 IF p_token IS NULL OR p_token !~ '^[0-9]{10,12}[.][a-f0-9-]{36}[.][a-f0-9]{64}$' THEN RETURN jsonb_build_object('authorized',false);END IF;
 parts:=string_to_array(p_token,'.');expiry:=parts[1]::bigint;
 IF expiry<extract(epoch from clock_timestamp()) OR expiry>extract(epoch from clock_timestamp())+91 THEN RETURN jsonb_build_object('authorized',false);END IF;
 SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name='umma_courier_worker_secret';
 expected:=encode(extensions.hmac(parts[1]||'.'||parts[2],secret,'sha256'),'hex');
 IF expected IS NULL OR expected<>parts[3] THEN RETURN jsonb_build_object('authorized',false);END IF;
 DELETE FROM umma_courier_internal.worker_nonces WHERE expires_at<clock_timestamp();
 INSERT INTO umma_courier_internal.worker_nonces(nonce,expires_at) VALUES(parts[2]::uuid,to_timestamp(expiry)) ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS inserted=ROW_COUNT;
 IF inserted<>1 THEN RETURN jsonb_build_object('authorized',false);END IF;
 RETURN jsonb_build_object('authorized',true,'enabled',(SELECT dispatch_enabled FROM umma_courier_internal.worker_control WHERE id));
EXCEPTION WHEN invalid_text_representation THEN RETURN jsonb_build_object('authorized',false);
END $$;
REVOKE ALL ON FUNCTION public.authorize_cafe_courier_worker_token(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_cafe_courier_worker_token(text) TO service_role;
REVOKE ALL ON FUNCTION public.authorize_cafe_courier_worker(text) FROM service_role;
DO $$ DECLARE sid uuid;BEGIN SELECT id INTO sid FROM vault.secrets WHERE name='umma_courier_worker_secret';PERFORM vault.update_secret(sid,encode(extensions.gen_random_bytes(48),'hex'));END $$;
COMMIT;
