create table public.catatan_entries (
  id bigint generated always as identity primary key,
  entry_date date not null unique,
  happened text not null,
  good_things text not null,
  lessons text not null,
  free_text text,
  is_backfilled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.catatan_entries enable row level security;
revoke all on public.catatan_entries from anon, authenticated;
