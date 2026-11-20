-- Prevent any customer-origin order from entering preparation before payment is confirmed.
-- Enforced in PostgreSQL, including direct table updates and status RPC calls.
create or replace function public.enforce_customer_order_payment_before_preparation()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.created_via = 'customer'
     and new.payment_status is distinct from 'paid'
     and new.status in ('confirmed','preparing','ready')
     and (tg_op = 'INSERT' or new.status is distinct from old.status or new.payment_status is distinct from old.payment_status)
  then
    raise exception 'SELF_SERVICE_PAYMENT_REQUIRED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists cafe_customer_payment_before_preparation on public.cafe_orders;
create trigger cafe_customer_payment_before_preparation
before insert or update of status,payment_status on public.cafe_orders
for each row execute function public.enforce_customer_order_payment_before_preparation();
