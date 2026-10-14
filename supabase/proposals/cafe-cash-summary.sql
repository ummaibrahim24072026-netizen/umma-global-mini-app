-- Server-side totals are independent of the last-100-receipts UI list.
BEGIN;
CREATE OR REPLACE FUNCTION public.get_cafe_cash_summary(p_location_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $function$
  SELECT jsonb_build_object(
    'total24hVnd',coalesce(sum(amount_vnd),0),
    'cash24hVnd',coalesce(sum(amount_vnd) FILTER (WHERE payment_method='cash'),0),
    'pendingHandovers',(SELECT count(*) FROM public.cafe_cash_handovers WHERE location_id=p_location_id AND handover_status='pending')
  ) FROM public.cafe_payment_receipts
    WHERE location_id=p_location_id AND receipt_status='confirmed' AND collected_at>=now()-interval '24 hours' AND collected_at<=now();
$function$;
REVOKE ALL ON FUNCTION public.get_cafe_cash_summary(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_cafe_cash_summary(uuid) TO service_role;
COMMIT;
