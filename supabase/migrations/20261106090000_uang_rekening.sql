create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  kind text not null default 'biasa' check (kind in ('biasa', 'tabungan')),
  opening_balance numeric(15,2) not null default 0,
  opening_date date not null default current_date,
  sort int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  kind text not null default 'cicilan' check (kind in ('cicilan', 'utang')),
  total numeric(15,2) not null check (total > 0),
  paid_before numeric(15,2) not null default 0 check (paid_before >= 0),
  monthly numeric(15,2) check (monthly > 0),
  note text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.budget_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  amount numeric(15,2) not null default 0 check (amount >= 0),
  kind text not null check (kind in ('tetap', 'harian', 'cadangan', 'tabungan')),
  account_id uuid references public.accounts(id) on delete set null,
  debt_id uuid references public.debts(id) on delete set null,
  sort int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.transactions
  add column if not exists account_id uuid references public.accounts(id) on delete restrict,
  add column if not exists to_account_id uuid references public.accounts(id) on delete restrict,
  add column if not exists budget_item_id uuid references public.budget_items(id) on delete set null,
  add column if not exists debt_id uuid references public.debts(id) on delete set null,
  add column if not exists unplanned boolean not null default false;

alter table public.recurring_transactions
  add column if not exists account_id uuid references public.accounts(id) on delete set null,
  add column if not exists budget_item_id uuid references public.budget_items(id) on delete set null,
  add column if not exists debt_id uuid references public.debts(id) on delete set null;

alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions add constraint transactions_type_check check (type in ('income', 'expense', 'transfer'));
alter table public.transactions drop constraint if exists transactions_transfer_check;
alter table public.transactions add constraint transactions_transfer_check check ((type = 'transfer') = (to_account_id is not null));

create index if not exists idx_transactions_account on public.transactions(account_id);
create index if not exists idx_transactions_to_account on public.transactions(to_account_id);
create index if not exists idx_accounts_user on public.accounts(user_id);
create index if not exists idx_budget_items_user on public.budget_items(user_id);
create index if not exists idx_debts_user on public.debts(user_id);

alter table public.accounts enable row level security;
alter table public.budget_items enable row level security;
alter table public.debts enable row level security;

drop policy if exists "Users can CRUD own accounts" on public.accounts;
create policy "Users can CRUD own accounts" on public.accounts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can CRUD own budget items" on public.budget_items;
create policy "Users can CRUD own budget items" on public.budget_items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can CRUD own debts" on public.debts;
create policy "Users can CRUD own debts" on public.debts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into public.accounts (user_id, name, kind, sort)
select p.id, a.name, a.kind, a.sort
from public.profiles p
cross join (values ('Utama', 'biasa', 0), ('AI', 'biasa', 1), ('Tabungan', 'tabungan', 2)) as a(name, kind, sort)
where not exists (select 1 from public.accounts x where x.user_id = p.id);

insert into public.budget_items (user_id, name, amount, kind, account_id, sort)
select p.id, b.name, b.amount, b.kind, acc.id, b.sort
from public.profiles p
cross join (values
  ('Kos', 2800000, 'tetap', 'Utama', 0),
  ('AI subscription', 430000, 'tetap', 'AI', 1),
  ('Cicilan Garmin', 1000833, 'tetap', 'Utama', 2),
  ('Makan', 2000000, 'harian', 'Utama', 3),
  ('Transportasi', 360000, 'harian', 'Utama', 4),
  ('Kebutuhan pribadi', 500000, 'cadangan', 'Utama', 5),
  ('Buffer dadakan', 500000, 'cadangan', 'Utama', 6),
  ('Tabungan', 1409167, 'tabungan', 'Tabungan', 7)
) as b(name, amount, kind, account, sort)
join public.accounts acc on acc.user_id = p.id and acc.name = b.account
where not exists (select 1 from public.budget_items x where x.user_id = p.id);

update public.transactions t
set account_id = a.id
from public.accounts a
where t.account_id is null and a.user_id = t.user_id and a.name = 'Utama';

update public.transactions t
set type = 'transfer', to_account_id = a.id, category = 'transfer'
from public.accounts a
where t.type = 'expense' and t.category in ('setor_tabungan', 'setor_dana_darurat')
  and a.user_id = t.user_id and a.name = 'Tabungan';

update public.transactions t
set account_id = a.id
from public.accounts a
where t.type = 'expense' and t.category in ('tabungan', 'dana_darurat')
  and a.user_id = t.user_id and a.name = 'Tabungan';
