alter table public.fit_recovery_daily
  add column calories_total double precision,
  add column calories_active double precision,
  add column calories_bmr double precision;

create table public.fit_intake_daily (
  date date primary key,
  kcal integer not null check (kcal between 0 and 10000),
  note text,
  updated_at timestamptz not null default now()
);

alter table public.fit_intake_daily enable row level security;
revoke all on public.fit_intake_daily from anon, authenticated;
