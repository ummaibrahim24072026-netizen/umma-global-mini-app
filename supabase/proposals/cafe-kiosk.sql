-- Kiosk credentials have no Data API access. All operations pass through cafe-kiosk.
create table if not exists public.cafe_kiosk_devices (
 id uuid primary key default gen_random_uuid(),
 location_id uuid not null references public.locations(id),
 actor_telegram_id bigint not null,
 token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
 label text not null default 'Уличный экран',
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 last_order_at timestamptz
);
create index if not exists cafe_kiosk_devices_location_idx on public.cafe_kiosk_devices(location_id);
create table if not exists public.cafe_kiosk_orders (
 device_id uuid not null references public.cafe_kiosk_devices(id),
 request_key uuid not null,
 order_id uuid not null unique references public.cafe_orders(id),
 primary key(device_id,request_key)
);
alter table public.cafe_kiosk_devices enable row level security;
alter table public.cafe_kiosk_orders enable row level security;
revoke all on public.cafe_kiosk_devices,public.cafe_kiosk_orders from public,anon,authenticated;
grant all on public.cafe_kiosk_devices,public.cafe_kiosk_orders to service_role;

-- Service-only transaction: device lock makes rate limiting, deduplication and
-- order/device mapping atomic, including when the first HTTP response is lost.
create or replace function public.submit_cafe_kiosk_order(p_device_id uuid,p_request_key uuid,p_items jsonb,p_order_type text,p_payment_method text,p_table text default null)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare d public.cafe_kiosk_devices%rowtype; args jsonb; result jsonb; existing uuid;
begin
 select * into d from public.cafe_kiosk_devices where id=p_device_id and is_active for update;
 if not found then raise exception 'Kiosk disabled'; end if;
 if not exists(select 1 from public.telegram_users u where u.telegram_id=d.actor_telegram_id and u.is_active and
  (u.role='super_admin' or (u.role in ('admin','employee') and exists(select 1 from public.cafe_staff s where s.telegram_id=u.telegram_id and s.location_id=d.location_id and s.is_active and s.staff_role='manager')))) then raise exception 'Kiosk manager access revoked'; end if;
 if p_order_type is null or p_order_type not in ('pickup','dine_in') or p_payment_method is null or p_payment_method not in ('cash','qr') then raise exception 'Invalid kiosk order'; end if;
 if p_order_type='dine_in' and (p_table is null or p_table !~ '^[1-6]$') then raise exception 'Choose table 1-6'; end if;
 if p_payment_method='qr' and d.location_id<>'e22788bd-4734-4b3a-911e-ba103d52617a'::uuid then raise exception 'QR unavailable'; end if;
 select order_id into existing from public.cafe_kiosk_orders where device_id=d.id and request_key=p_request_key;
 if existing is null and d.last_order_at>clock_timestamp()-interval '10 seconds' then raise exception 'Wait 10 seconds before next order'; end if;
 args:=jsonb_build_object('p_location_id',d.location_id,'p_items',p_items,'p_order_type',p_order_type,'p_payment_method',p_payment_method,
  'p_payment_timing','now','p_customer_name','Гость · Уличный экран','p_customer_note',concat_ws(E'\n','[UMMA-KIOSK:'||d.id||']',case when p_order_type='dine_in' then 'Стол №'||p_table end));
 result:=public.execute_cafe_order_operation(d.actor_telegram_id,p_request_key,'staffOrder',args);
 insert into public.cafe_kiosk_orders(device_id,request_key,order_id) values(d.id,p_request_key,(result->'order'->>'id')::uuid) on conflict do nothing;
 if existing is null then update public.cafe_kiosk_devices set last_order_at=clock_timestamp() where id=d.id; end if;
 return result;
end $$;
revoke all on function public.submit_cafe_kiosk_order(uuid,uuid,jsonb,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_cafe_kiosk_order(uuid,uuid,jsonb,text,text,text) to service_role;
