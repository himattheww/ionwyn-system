create table public.leveling_wishes (
  id bigint generated always as identity primary key,
  title text not null check (length(title) between 1 and 200),
  why text check (length(why) <= 2000),
  size text not null check (size in ('kecil', 'sedang', 'besar')),
  attribute text not null check (attribute in ('stamina', 'intelek', 'kebijaksanaan', 'disiplin', 'kekayaan')),
  target_date date,
  achieved_on date,
  created_at timestamptz not null default now()
);

alter table public.leveling_wishes enable row level security;
revoke all on public.leveling_wishes from anon, authenticated;
