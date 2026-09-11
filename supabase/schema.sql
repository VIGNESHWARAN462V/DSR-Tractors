-- ========================================================
-- DSR TRACTORS — Supabase Database Schema
-- Run this script in your Supabase SQL Editor
-- ========================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

-- 2. CUSTOMERS
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  location text not null,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. SERVICES (Master Catalog)
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'machinery',
  unit text not null, -- 'hour', 'load', 'bundle'
  rate numeric(10,2) not null,
  worker_type text, -- 'ஆள் உண்டு', 'ஆள் இல்லை', or null
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. SERVICE TRANSACTIONS
create table if not exists public.service_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  service_date date not null default current_date,
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. SERVICE TRANSACTION ITEMS
create table if not exists public.service_transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.service_transactions(id) on delete cascade,
  service_id text,
  service_name text not null,
  worker_type text,
  quantity numeric(10,2) not null check (quantity > 0),
  unit text not null,
  rate numeric(10,2) not null check (rate >= 0),
  amount numeric(12,2) not null check (amount >= 0),
  created_at timestamptz not null default now()
);

-- 6. PAYMENTS
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  service_transaction_id uuid references public.service_transactions(id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('Cash', 'UPI', 'Bank Transfer', 'Other')),
  payment_date date not null default current_date,
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);

-- 7. TRACTORS
create table if not exists public.tractors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  current_fuel_litres numeric(10,2) not null default 0 check (current_fuel_litres >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 8. DIESEL TRANSACTIONS
create table if not exists public.diesel_transactions (
  id uuid primary key default gen_random_uuid(),
  tractor_id uuid not null references public.tractors(id) on delete cascade,
  input_mode text not null check (input_mode in ('amount', 'litres')),
  diesel_amount numeric(10,2),
  diesel_price numeric(10,2) not null,
  initial_fuel_litres numeric(10,2) not null check (initial_fuel_litres >= 0),
  total_working_hours numeric(10,2) not null check (total_working_hours >= 0),
  consumption_rate numeric(10,2) not null default 4.0,
  diesel_consumed numeric(10,2) not null check (diesel_consumed >= 0),
  remaining_fuel numeric(10,2) not null check (remaining_fuel >= 0),
  transaction_date date not null default current_date,
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);

-- 9. DIESEL TIMINGS
create table if not exists public.diesel_timings (
  id uuid primary key default gen_random_uuid(),
  diesel_transaction_id uuid not null references public.diesel_transactions(id) on delete cascade,
  timing_hours numeric(10,2) not null check (timing_hours > 0),
  created_at timestamptz not null default now()
);

-- 10. SETTINGS
create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value text not null,
  updated_at timestamptz not null default now()
);

-- ========================================================
-- INDEXES FOR PERFORMANCE
-- ========================================================
create index if not exists idx_customers_name on public.customers(name);
create index if not exists idx_customers_phone on public.customers(phone);
create index if not exists idx_service_tx_customer on public.service_transactions(customer_id);
create index if not exists idx_service_tx_date on public.service_transactions(service_date);
create index if not exists idx_items_tx on public.service_transaction_items(transaction_id);
create index if not exists idx_payments_customer on public.payments(customer_id);
create index if not exists idx_payments_date on public.payments(payment_date);
create index if not exists idx_diesel_tx_tractor on public.diesel_transactions(tractor_id);
create index if not exists idx_diesel_tx_date on public.diesel_transactions(transaction_date);

-- ========================================================
-- ROW LEVEL SECURITY (RLS)
-- ========================================================
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.services enable row level security;
alter table public.service_transactions enable row level security;
alter table public.service_transaction_items enable row level security;
alter table public.payments enable row level security;
alter table public.tractors enable row level security;
alter table public.diesel_transactions enable row level security;
alter table public.diesel_timings enable row level security;
alter table public.settings enable row level security;

-- Policies: Authenticated & Anon users can perform all operations
do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('drop policy if exists "Allow authenticated full access" on public.%I', t);
    execute format('create policy "Allow authenticated full access" on public.%I for all to authenticated using (true) with check (true)', t);
    
    execute format('drop policy if exists "Allow anon read-write access" on public.%I', t);
    execute format('create policy "Allow anon read-write access" on public.%I for all to anon using (true) with check (true)', t);
  end loop;
end;
$$;

-- Enable Realtime safely for key tables
do $$
declare
  tbl text;
begin
  for tbl in select unnest(array['customers', 'service_transactions', 'service_transaction_items', 'payments', 'tractors', 'diesel_transactions', 'settings'])
  loop
    if not exists (
      select 1 from pg_publication_rel pr
      join pg_publication p on p.oid = pr.prpubid
      join pg_class c on c.oid = pr.prrelid
      where p.pubname = 'supabase_realtime' and c.relname = tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    end if;
  end loop;
end;
$$;
