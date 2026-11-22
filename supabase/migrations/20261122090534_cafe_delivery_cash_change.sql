alter table public.cafe_orders
 add column requested_cash_vnd integer,
 add constraint cafe_orders_requested_cash_delivery_check check (
  requested_cash_vnd is null or (
   requested_cash_vnd > 0 and order_type = 'delivery'
   and payment_method = 'cash' and payment_timing is not distinct from 'on_delivery'
  )
 );

create function public.submit_cafe_guest_delivery_cash(
 p_request_key uuid, p_ip_hash text, p_location_id uuid, p_items jsonb,
 p_customer_name text, p_customer_phone text, p_source text, p_table_number text,
 p_address text, p_lat double precision, p_lng double precision, p_token_hash text,
 p_requested_cash_vnd integer
) returns jsonb
language plpgsql security invoker
set search_path = ''
as $$
declare result jsonb;
begin
 if p_requested_cash_vnd is null or p_requested_cash_vnd <= 0 then
  raise exception 'Invalid requested cash';
 end if;

 result := public.submit_cafe_guest_delivery_v4(
  p_request_key, p_ip_hash, p_location_id, p_items, p_customer_name, p_customer_phone,
  p_source, p_table_number, 'cash', p_address, p_lat, p_lng, p_token_hash
 );

 if (result->>'replayed')::boolean is false then
  if p_requested_cash_vnd < (result#>>'{order,totalVnd}')::integer then
   raise exception 'CASH_AMOUNT_TOO_LOW';
  end if;
  update public.cafe_orders
  set requested_cash_vnd = p_requested_cash_vnd
  where id = (result#>>'{order,id}')::uuid;
 end if;

 return result;
end;
$$;

revoke execute on function public.submit_cafe_guest_delivery_cash(uuid,text,uuid,jsonb,text,text,text,text,text,double precision,double precision,text,integer) from public, anon, authenticated;
grant execute on function public.submit_cafe_guest_delivery_cash(uuid,text,uuid,jsonb,text,text,text,text,text,double precision,double precision,text,integer) to service_role;
