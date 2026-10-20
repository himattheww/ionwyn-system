create table public.leveling_events (
  id text primary key,
  source text not null,
  type text not null,
  date date not null,
  value double precision not null,
  meta jsonb not null default '{}'::jsonb
);
create index leveling_events_source on public.leveling_events (source);

create table public.leveling_exp_entries (
  id bigint generated always as identity primary key,
  date date not null,
  attribute text not null,
  source text not null,
  rule text not null,
  grp text not null,
  event_id text,
  note text not null,
  raw double precision not null,
  awarded double precision not null,
  capped double precision not null
);
create index leveling_exp_entries_date on public.leveling_exp_entries (date);

create table public.leveling_history (
  id bigint generated always as identity primary key,
  date date not null,
  kind text not null,
  text text not null
);

create table public.leveling_snapshot (
  id integer primary key check (id = 1),
  rules_hash text not null,
  state jsonb not null,
  created_at timestamptz not null
);

create table public.leveling_notifications (
  id bigint generated always as identity primary key,
  created_at timestamptz not null,
  lines jsonb not null
);

create table public.leveling_sources (
  name text primary key,
  position integer not null,
  label text not null,
  enabled boolean not null,
  last_read_at timestamptz,
  last_error text,
  event_count integer
);

do $$
declare
  t text;
begin
  foreach t in array array['leveling_events', 'leveling_exp_entries', 'leveling_history', 'leveling_snapshot', 'leveling_notifications', 'leveling_sources'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end;
$$;
