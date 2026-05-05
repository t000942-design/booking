-- Booking app initial schema. Mirrors lib/domain/types.ts.
-- Server-only access via service role; RLS enabled with no policies (deny by default).

create table if not exists public.bookings (
  ref              text primary key,
  id               text not null,
  customer_name    text not null,
  customer_phone   text not null,
  team_name        text,
  notes            text,
  date             date not null,
  hour             int  not null check (hour between 0 and 23),
  pitch            text not null,
  slot_start       timestamptz not null,
  slot_end         timestamptz not null,
  price_fils       int  not null check (price_fils >= 0),
  currency         text not null default 'KWD',
  discount_fils    int  not null default 0 check (discount_fils >= 0),
  discount_name    text,
  status           text not null default 'PENDING'
                     check (status in ('PENDING','CONFIRMED','DONE','CANCELLED')),
  payment_status   text not null default 'UNPAID'
                     check (payment_status in ('UNPAID','PAID','FAILED')),
  paid_at          timestamptz,
  payment_ref      text,
  refund_fils      int  not null default 0 check (refund_fils >= 0),
  refunded_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- A slot can only be held by one active booking at a time.
create unique index if not exists ux_bookings_active_slot
  on public.bookings (date, hour, pitch)
  where status in ('PENDING','CONFIRMED','DONE');

create index if not exists ix_bookings_date    on public.bookings (date);
create index if not exists ix_bookings_phone   on public.bookings (customer_phone);
create index if not exists ix_bookings_status  on public.bookings (status);

create table if not exists public.blocked_slots (
  id          text primary key,
  date        date not null,
  hour        int  not null check (hour between 0 and 23),
  pitch       text not null,
  reason      text,
  created_at  timestamptz not null default now(),
  unique (date, hour, pitch)
);

create index if not exists ix_blocked_slots_date on public.blocked_slots (date);

create table if not exists public.discounts (
  id            text primary key,
  name          text not null,
  description   text,
  percent_off   int  not null check (percent_off between 1 and 100),
  valid_from    date not null,
  valid_to      date not null,
  days_of_week  int[] not null default '{}',
  pitches       text[] not null default '{}',
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists ix_discounts_active on public.discounts (active);

-- updated_at maintenance for bookings.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_bookings_updated_at on public.bookings;
create trigger trg_bookings_updated_at
  before update on public.bookings
  for each row execute function public.touch_updated_at();

-- RLS on. Service role bypasses; no other client should reach these tables yet.
alter table public.bookings      enable row level security;
alter table public.blocked_slots enable row level security;
alter table public.discounts     enable row level security;
