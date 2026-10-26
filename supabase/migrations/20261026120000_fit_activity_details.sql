alter table public.fit_activities
  add column max_hr double precision,
  add column cadence_spm double precision,
  add column elevation_gain_m double precision,
  add column elevation_loss_m double precision,
  add column training_effect double precision;

create table public.fit_activity_laps (
  garmin_id bigint primary key references public.fit_activities (garmin_id) on delete cascade,
  fetched_at timestamptz not null,
  laps jsonb not null
);

alter table public.fit_activity_laps enable row level security;
revoke all on public.fit_activity_laps from anon, authenticated;
