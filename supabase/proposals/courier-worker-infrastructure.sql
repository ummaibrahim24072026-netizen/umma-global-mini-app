-- Authorized infrastructure only: no sales changes, no dispatch until release activation.
BEGIN;
CREATE SCHEMA IF NOT EXISTS umma_courier_internal;
REVOKE ALL ON SCHEMA umma_courier_internal FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE umma_courier_internal.worker_control(id boolean PRIMARY KEY DEFAULT true CHECK(id),dispatch_enabled boolean NOT NULL DEFAULT false);
ALTER TABLE umma_courier_internal.worker_control ENABLE ROW LEVEL SECURITY;
INSERT INTO umma_courier_internal.worker_control(id) VALUES(true);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM vault.secrets WHERE name='umma_courier_worker_secret') THEN
 PERFORM vault.create_secret(encode(extensions.gen_random_bytes(48),'hex'),'umma_courier_worker_secret','UMMA courier worker internal authorization');
 END IF;
END $$;
CREATE FUNCTION public.authorize_cafe_courier_worker(p_digest text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE accepted boolean;
BEGIN
 SELECT p_digest=encode(extensions.digest(decrypted_secret,'sha256'),'hex') INTO accepted FROM vault.decrypted_secrets WHERE name='umma_courier_worker_secret';
 IF coalesce(accepted,false)=false THEN RETURN jsonb_build_object('authorized',false); END IF;
 RETURN jsonb_build_object('authorized',true,'enabled',(SELECT dispatch_enabled FROM umma_courier_internal.worker_control WHERE id));
END $$;
REVOKE ALL ON FUNCTION public.authorize_cafe_courier_worker(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_cafe_courier_worker(text) TO service_role;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
-- pg_net queue belongs to supabase_admin. Use one-use signed auth; do not assume grants can be revoked by postgres.
COMMIT;
