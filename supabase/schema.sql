-- Run this in the Supabase SQL editor. Running it again is safe.
-- Then, in Authentication, allow email sign-ins. Turn off "Confirm email"
-- if you want a new account to open the ledger immediately.
-- The account that already has the ledger must sign in first. It becomes
-- the shop owner. Add the other account from Admins in the app.

create table if not exists public.items (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  name text not null,
  category text not null default 'General',
  quantity integer not null default 0 check (quantity >= 0),
  cost integer not null default 0 check (cost >= 0),
  price integer not null default 0 check (price >= 0),
  reorder_at integer not null default 0 check (reorder_at >= 0),
  condition text not null default '',
  notes text not null default '',
  primary key (user_id, id)
);

alter table public.items add column if not exists condition text not null default '';

create table if not exists public.movements (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  type text not null check (type in ('buy', 'sell', 'recount')),
  item_id text not null default '',
  item_name text not null,
  quantity integer not null default 0 check (quantity >= 0),
  unit_cost integer,
  unit_price integer,
  profit integer,
  terms text check (terms is null or terms in ('cop', 'cod')),
  at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.expenses (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  name text not null,
  category text not null default 'General',
  amount integer not null default 0 check (amount >= 0),
  date date,
  notes text not null default '',
  primary key (user_id, id)
);

create table if not exists public.upcoming (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  name text not null,
  category text not null default 'General',
  amount integer not null default 0 check (amount >= 0),
  date date,
  notes text not null default '',
  plan text not null default 'straight',
  term integer,
  month integer,
  primary key (user_id, id)
);

alter table public.upcoming add column if not exists plan text not null default 'straight';
alter table public.upcoming add column if not exists term integer;
alter table public.upcoming add column if not exists month integer;

alter table public.upcoming drop constraint if exists upcoming_plan_check;
alter table public.upcoming add constraint upcoming_plan_check
  check (plan in ('straight', 'installment'));

alter table public.upcoming drop constraint if exists upcoming_term_check;
alter table public.upcoming add constraint upcoming_term_check
  check (term is null or term in (1, 3, 6, 12));

alter table public.upcoming drop constraint if exists upcoming_month_check;
alter table public.upcoming add constraint upcoming_month_check
  check (month is null or (month >= 1 and month <= 12));

create table if not exists public.investors (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  name text not null,
  amount integer not null default 0 check (amount >= 0),
  share numeric(5, 1),
  date date,
  notes text not null default '',
  primary key (user_id, id)
);

alter table public.items enable row level security;
alter table public.movements enable row level security;
alter table public.expenses enable row level security;
alter table public.upcoming enable row level security;
alter table public.investors enable row level security;

drop policy if exists "own rows" on public.items;
drop policy if exists "own rows" on public.movements;
drop policy if exists "own rows" on public.expenses;
drop policy if exists "own rows" on public.upcoming;
drop policy if exists "own rows" on public.investors;
drop policy if exists "admins share the shop" on public.items;
drop policy if exists "admins share the shop" on public.movements;
drop policy if exists "admins share the shop" on public.expenses;
drop policy if exists "admins share the shop" on public.upcoming;
drop policy if exists "admins share the shop" on public.investors;

-- Policies are created after private.is_admin() and private.shop_owner().

grant select, insert, update, delete on public.items to authenticated;
grant select, insert, update, delete on public.movements to authenticated;
grant select, insert, update, delete on public.expenses to authenticated;
grant select, insert, update, delete on public.upcoming to authenticated;
grant select, insert, update, delete on public.investors to authenticated;

create table if not exists public.settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  funds_adjustment integer not null default 0
);

alter table public.settings enable row level security;

drop policy if exists "own rows" on public.settings;
drop policy if exists "admins share the shop" on public.settings;

grant select, insert, update, delete on public.settings to authenticated;

-- Admins share one shop. The private schema is not exposed by the API.
-- The account that already holds the ledger must sign in first. It becomes
-- the shop owner. Then add the other account from Admins in the app.

create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists private.shop (
  id integer primary key check (id = 1),
  owner_id uuid not null references auth.users (id)
);

create table if not exists private.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

revoke all on private.shop from public, anon, authenticated;
revoke all on private.admins from public, anon, authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.admins where user_id = auth.uid()
  );
$$;

create or replace function private.shop_owner()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select owner_id from private.shop where id = 1;
$$;

revoke all on function private.is_admin() from public, anon;
revoke all on function private.shop_owner() from public, anon;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.shop_owner() to authenticated;

create or replace function public.shop_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  owner uuid;
begin
  if not private.is_admin() then
    return jsonb_build_object('is_admin', false);
  end if;

  owner := private.shop_owner();
  return jsonb_build_object(
    'is_admin', true,
    'owner_id', owner,
    'admins', coalesce((
      select jsonb_agg(jsonb_build_object('email', users.email) order by users.email)
      from private.admins admins
      join auth.users users on users.id = admins.user_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.claim_shop()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_owner uuid;
begin
  if private.shop_owner() is not null then
    if private.is_admin() then
      return private.shop_owner();
    end if;
    raise exception 'An admin needs to add this email before this account can open the ledger.';
  end if;

  select rows.user_id into existing_owner
  from (
    select user_id from public.items
    union all select user_id from public.movements
    union all select user_id from public.expenses
    union all select user_id from public.upcoming
    union all select user_id from public.investors
    union all select user_id from public.settings
  ) rows
  group by rows.user_id
  order by count(*) desc
  limit 1;

  if existing_owner is not null and existing_owner <> auth.uid() then
    raise exception 'Sign in with the account that already has the ledger, then add this email as an admin.';
  end if;

  insert into private.shop (id, owner_id)
  values (1, coalesce(existing_owner, auth.uid()));
  insert into private.admins (user_id) values (auth.uid())
  on conflict (user_id) do nothing;
  return private.shop_owner();
end;
$$;

create or replace function public.add_admin(admin_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  if not private.is_admin() then
    raise exception 'Only an admin can add another admin.';
  end if;

  select id into target
  from auth.users
  where lower(email) = lower(trim(admin_email));

  if target is null then
    raise exception 'Create an account with that email first, then add it here.';
  end if;

  insert into private.admins (user_id) values (target)
  on conflict (user_id) do nothing;
end;
$$;

revoke all on function public.shop_context() from public, anon;
revoke all on function public.claim_shop() from public, anon;
revoke all on function public.add_admin(text) from public, anon;
grant execute on function public.shop_context() to authenticated;
grant execute on function public.claim_shop() to authenticated;
grant execute on function public.add_admin(text) to authenticated;

create policy "admins share the shop" on public.items
  for all to authenticated
  using (private.is_admin() and user_id = private.shop_owner())
  with check (private.is_admin() and user_id = private.shop_owner());

create policy "admins share the shop" on public.movements
  for all to authenticated
  using (private.is_admin() and user_id = private.shop_owner())
  with check (private.is_admin() and user_id = private.shop_owner());

create policy "admins share the shop" on public.expenses
  for all to authenticated
  using (private.is_admin() and user_id = private.shop_owner())
  with check (private.is_admin() and user_id = private.shop_owner());

create policy "admins share the shop" on public.upcoming
  for all to authenticated
  using (private.is_admin() and user_id = private.shop_owner())
  with check (private.is_admin() and user_id = private.shop_owner());

create policy "admins share the shop" on public.investors
  for all to authenticated
  using (private.is_admin() and user_id = private.shop_owner())
  with check (private.is_admin() and user_id = private.shop_owner());

create policy "admins share the shop" on public.settings
  for all to authenticated
  using (private.is_admin() and user_id = private.shop_owner())
  with check (private.is_admin() and user_id = private.shop_owner());
