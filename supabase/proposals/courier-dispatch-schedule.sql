-- Separate production scheduling step, only after owner approval and worker deployment.
-- Configure COURIER_WORKER_SECRET (>=32 random chars) in Edge secrets and the identical
-- Vault secret named umma_courier_worker_secret via the dashboard. Never paste it into chat.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_cron') OR NOT EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_net') THEN RAISE EXCEPTION 'Enable approved pg_cron and pg_net before scheduling'; END IF;
 IF NOT EXISTS(SELECT 1 FROM vault.secrets WHERE name='umma_courier_worker_secret') THEN RAISE EXCEPTION 'Courier worker Vault secret missing'; END IF;
 IF EXISTS(SELECT 1 FROM cron.job WHERE jobname='umma-courier-dispatch') THEN RAISE EXCEPTION 'Courier schedule already exists; inspect instead of overwriting'; END IF;
END $$;
SELECT cron.schedule('umma-courier-dispatch','* * * * *',$job$
 SELECT net.http_post(
 url:='https://zwzojugspldexyyljwpr.supabase.co/functions/v1/courier-dispatch-worker',
 headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='umma_courier_worker_secret')),
 body:='{}'::jsonb, timeout_milliseconds:=20000
 );
$job$);
