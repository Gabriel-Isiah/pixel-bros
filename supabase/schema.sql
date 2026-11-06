-- Run this once in the Supabase SQL editor.
-- Then, in Authentication, allow email sign-ins. Turn off "Confirm email"
-- if you want a new account to open the ledger immediately.

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
  primary key (user_id, id)
);

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

create policy "own rows" on public.items
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own rows" on public.movements
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own rows" on public.expenses
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own rows" on public.upcoming
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own rows" on public.investors
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.items to authenticated;
grant select, insert, update, delete on public.movements to authenticated;
grant select, insert, update, delete on public.expenses to authenticated;
grant select, insert, update, delete on public.upcoming to authenticated;
grant select, insert, update, delete on public.investors to authenticated;
