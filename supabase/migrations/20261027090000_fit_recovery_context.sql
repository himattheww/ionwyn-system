alter table public.fit_recovery_daily
  add column hrv_last_night integer,
  add column hrv_weekly integer,
  add column hrv_high_5min integer,
  add column hrv_baseline_low integer,
  add column hrv_baseline_high integer,
  add column hrv_low_upper integer,
  add column hrv_status text,
  add column deep_min double precision,
  add column light_min double precision,
  add column rem_min double precision,
  add column awake_min double precision,
  add column sleep_respiration double precision,
  add column sleep_stress double precision,
  add column readiness_score integer,
  add column readiness_level text,
  add column acute_load double precision;

alter table public.fit_condition_daily
  add column injured smallint not null default 0 check (injured in (0, 1));

alter table public.fit_activities
  add column start_lat double precision,
  add column start_lon double precision;

create table public.fit_activity_context (
  garmin_id bigint primary key references public.fit_activities (garmin_id) on delete cascade,
  fetched_at timestamptz not null,
  temp_c double precision,
  feels_like_c double precision,
  humidity_pct double precision,
  dew_point_c double precision,
  wind_kph double precision,
  weather text,
  hr_zones jsonb not null default '[]'::jsonb,
  rpe integer,
  feel integer,
  training_load double precision,
  anaerobic_te double precision,
  te_label text,
  shoes text,
  aqi integer,
  aqi_source text check (aqi_source in ('station', 'model')),
  aqi_station integer,
  pm25_station double precision,
  station_name text,
  aqi_model integer,
  pm25_model double precision
);

create table public.fit_activity_fueling (
  garmin_id bigint primary key references public.fit_activities (garmin_id) on delete cascade,
  gels integer not null default 0 check (gels >= 0),
  gel_km text,
  drink_ml integer check (drink_ml >= 0),
  electrolytes text,
  note text,
  updated_at timestamptz not null default now()
);

do $$
declare
  t text;
begin
  foreach t in array array['fit_activity_context', 'fit_activity_fueling'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end;
$$;
