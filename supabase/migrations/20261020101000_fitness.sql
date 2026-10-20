create table public.fit_activities (
  garmin_id bigint primary key,
  type text not null,
  name text,
  start_time timestamptz not null,
  date date not null,
  duration_sec double precision,
  distance_m double precision,
  avg_hr double precision,
  avg_pace_sec_per_km double precision,
  calories double precision
);
create index fit_activities_date on public.fit_activities (date);

create table public.fit_strength_sets (
  activity_garmin_id bigint not null references public.fit_activities (garmin_id) on delete cascade,
  set_order integer not null,
  exercise_name text not null,
  reps integer,
  weight_kg double precision,
  duration_sec double precision,
  primary key (activity_garmin_id, set_order)
);
create index fit_strength_sets_exercise on public.fit_strength_sets (exercise_name);

create table public.fit_recovery_daily (
  date date primary key,
  sleep_min double precision,
  sleep_score integer,
  rhr integer,
  source text not null check (source in ('garmin', 'manual'))
);

create table public.fit_condition_daily (
  date date primary key,
  alcohol smallint not null default 0 check (alcohol in (0, 1)),
  sick smallint not null default 0 check (sick in (0, 1)),
  note text
);

create table public.fit_weights (
  date date primary key,
  kg double precision not null
);

create table public.fit_meals (
  date date primary key,
  protein_met smallint not null check (protein_met in (0, 1)),
  rice_portions double precision not null
);

create table public.fit_garmin_raw (
  id bigint generated always as identity primary key,
  kind text not null,
  ref text not null,
  fetched_at timestamptz not null,
  payload text not null
);
create index fit_garmin_raw_kind_ref on public.fit_garmin_raw (kind, ref);

create table public.fit_sync_status (
  id integer primary key check (id = 1),
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error text
);
insert into public.fit_sync_status (id) values (1);

create table public.fit_settings (
  key text primary key,
  value text not null
);
insert into public.fit_settings (key, value) values ('run_pattern', '{"1":"easy","3":"tempo","5":"easy","7":"long run"}');

do $$
declare
  t text;
begin
  foreach t in array array['fit_activities', 'fit_strength_sets', 'fit_recovery_daily', 'fit_condition_daily', 'fit_weights', 'fit_meals', 'fit_garmin_raw', 'fit_sync_status', 'fit_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end;
$$;
