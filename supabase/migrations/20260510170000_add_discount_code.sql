-- Adds optional coupon-code support to discounts.
-- When `code` is set, the discount is redeem-only (customer types it on /pay).
-- When NULL, the discount is auto-applied to matching slots.

alter table public.discounts
  add column if not exists code text;

-- Codes are case-insensitive, so we enforce uniqueness on the upper-cased form.
create unique index if not exists ux_discounts_code
  on public.discounts (upper(code))
  where code is not null;

create index if not exists ix_discounts_code_lookup
  on public.discounts (code)
  where code is not null;
