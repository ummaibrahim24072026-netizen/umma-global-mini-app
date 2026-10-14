-- Separate application-release approval required. Run only after device QA and rollout.
BEGIN;
DO $$ BEGIN
 IF to_regprocedure('public.advance_cafe_courier_queue()') IS NULL OR to_regprocedure('public.get_cafe_delivery_tracking(uuid,bigint)') IS NULL THEN RAISE EXCEPTION 'Courier application schema not released'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='cafe-delivery-evidence' AND NOT public) THEN RAISE EXCEPTION 'Private evidence bucket missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM cron.job WHERE jobname='umma-courier-dispatch' AND active) THEN RAISE EXCEPTION 'Worker schedule missing'; END IF;
 IF EXISTS(SELECT 1 FROM public.cafe_orders o WHERE o.order_type='delivery' AND o.delivery_status='picked_up' AND o.status NOT IN ('completed','cancelled') AND NOT EXISTS(SELECT 1 FROM public.cafe_delivery_proofs p WHERE p.order_id=o.id AND p.kind='pickup' AND p.verified_at IS NOT NULL)) THEN RAISE EXCEPTION 'Finish legacy in-transit deliveries without pickup photos before activation'; END IF;
END $$;
UPDATE umma_courier_internal.worker_control SET dispatch_enabled=true WHERE id;
COMMIT;
