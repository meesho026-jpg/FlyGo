-- FlywaysGo database schema. Run in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  discount_type text not null check (discount_type in ('percent','flat')),
  discount_value numeric(10,2) not null check (discount_value > 0),
  max_discount_inr numeric(10,2),
  min_order_inr numeric(10,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null,
  flight_id text not null,
  route_label text not null,
  travel_date date not null,
  trip_type text not null default 'one-way',
  flight_snapshot jsonb not null,
  passengers jsonb not null,
  seat_preference text,
  coupon_code text,
  reference_fare_inr numeric(12,2) not null,
  amount_inr numeric(12,2) not null,
  contact_email text not null,
  status text not null default 'UNDER_REVIEW' check (status in ('UNDER_REVIEW','PAYMENT_PENDING','PAID','PAYMENT_FAILED','TICKET_ISSUED','CANCELLED','REFUND_PENDING','REFUNDED')),
  pnr text,
  ticket_number text,
  ticket_path text,
  issued_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  provider text not null,
  provider_order_id text unique,
  provider_payment_id text,
  amount_inr numeric(12,2) not null,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id),
  action text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
alter table public.coupons enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.audit_logs enable row level security;

-- All customer writes/reads and admin operations go through the API using service role.
-- No anon/authenticated policies are intentionally granted on sensitive tables.
create policy "admins can read own admin record" on public.admin_users
for select to authenticated using (auth.uid() = user_id);

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('tickets','tickets',false,8388608,array['application/pdf'])
on conflict (id) do nothing;

-- Private ticket bucket. API creates short-lived signed URLs after booking reference/email verification.
create policy "No direct public ticket access" on storage.objects
for select to authenticated using (bucket_id = 'tickets' and exists (
  select 1 from public.admin_users where user_id = auth.uid()
));
create policy "Admins can upload tickets" on storage.objects
for insert to authenticated with check (bucket_id = 'tickets' and exists (
  select 1 from public.admin_users where user_id = auth.uid()
));
