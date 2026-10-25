-- UMMA B2B: isolated wholesale foundation. Apply only after review.
begin;
create table if not exists public.b2b_organizations (
 id uuid primary key default gen_random_uuid(),
 legal_name text not null,
 business_type text not null check (business_type in ('shop','bar','restaurant','cafe','other')),
 tax_number text, address text, contact_name text, contact_phone text,
 status text not null default 'pending' check (status in ('pending','approved','blocked')),
 created_at timestamptz not null default now()
);
create table if not exists public.b2b_memberships (
 organization_id uuid not null references public.b2b_organizations(id),
 telegram_id bigint not null references public.telegram_users(telegram_id),
 role text not null default 'buyer' check (role in ('buyer','manager')),
 primary key(organization_id,telegram_id)
);
create table if not exists public.b2b_catalog (
 id uuid primary key default gen_random_uuid(),
 sku text not null unique, name_ru text not null,
 category text not null check(category in ('drinks','meat','bakery')),
 unit text not null check(unit in ('pcs','kg')),
 stock_item_id uuid references public.stock_items(id),
 location_id uuid,
 price_vnd numeric(14,2),
 minimum_quantity numeric(14,3) not null default 1,
 active boolean not null default false,
 photo_url text,
 created_at timestamptz not null default now(),
 check (price_vnd is null or price_vnd>=0)
);
create table if not exists public.b2b_supply_contracts (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.b2b_organizations(id),
 contract_number text unique, signed_at timestamptz,
 document_url text, status text not null default 'draft'
 check(status in ('draft','signed','expired','terminated')),
 created_at timestamptz not null default now()
);
create table if not exists public.b2b_orders (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.b2b_organizations(id),
 contract_id uuid references public.b2b_supply_contracts(id),
 created_by_telegram_id bigint references public.telegram_users(telegram_id),
 source text not null check(source in ('buyer','field_manager')),
 status text not null default 'draft'
 check(status in ('draft','reserved','picking','dispatched','delivered','cancelled')),
 payment_method text not null check(payment_method in ('online','cash_on_delivery','manager_cash')),
 payment_status text not null default 'unpaid'
 check(payment_status in ('unpaid','partial','paid','refunded')),
 delivery_address text, delivery_date date,
 created_at timestamptz not null default now()
);
create table if not exists public.b2b_order_lines (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.b2b_orders(id) on delete restrict,
 catalog_id uuid not null references public.b2b_catalog(id),
 quantity numeric(14,3) not null check(quantity>0),
 price_vnd numeric(14,2) not null check(price_vnd>=0),
 unique(order_id,catalog_id)
);
create table if not exists public.b2b_stock_reservations (
 id uuid primary key default gen_random_uuid(),
 order_line_id uuid not null unique references public.b2b_order_lines(id),
 stock_item_id uuid not null references public.stock_items(id),
 location_id uuid not null,
 quantity numeric(14,3) not null check(quantity>0),
 status text not null default 'active' check(status in ('active','released','fulfilled')),
 created_at timestamptz not null default now()
);
create table if not exists public.b2b_payments (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.b2b_orders(id),
 method text not null check(method in ('online','cash')),
 amount_vnd numeric(14,2) not null check(amount_vnd>0),
 status text not null default 'pending' check(status in ('pending','verified','void')),
 received_by_telegram_id bigint references public.telegram_users(telegram_id),
 external_reference text, received_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.b2b_order_events (
 id bigint generated always as identity primary key,
 order_id uuid not null references public.b2b_orders(id),
 actor_telegram_id bigint,
 event_type text not null, details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
-- These tables are server-only until the authenticated B2B API is deployed.
do $$
declare t text;
begin
 foreach t in array array['b2b_organizations','b2b_memberships','b2b_catalog','b2b_supply_contracts','b2b_orders','b2b_order_lines','b2b_stock_reservations','b2b_payments','b2b_order_events']
 loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on table public.%I from anon,authenticated',t);
  execute format('grant select,insert,update,delete on table public.%I to service_role',t);
 end loop;
end $$;
-- No public RLS policies: all operations must pass through authenticated server API.
commit;
