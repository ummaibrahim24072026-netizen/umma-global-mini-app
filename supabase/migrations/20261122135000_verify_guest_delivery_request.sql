-- Permit the service-role delivery endpoint to recover access for a guest's original
-- checkout request without exposing the private request table to the public API.
create or replace function public.umma_verify_guest_delivery_request(p_order uuid,p_request_key uuid)
returns boolean
language sql security definer set search_path = ''
as $$
  select exists (
    select 1 from umma_private.public_guest_requests r
    where r.order_id=p_order and r.request_key=p_request_key
  )
$$;
revoke all on function public.umma_verify_guest_delivery_request(uuid,uuid) from public,anon,authenticated;
grant execute on function public.umma_verify_guest_delivery_request(uuid,uuid) to service_role;
