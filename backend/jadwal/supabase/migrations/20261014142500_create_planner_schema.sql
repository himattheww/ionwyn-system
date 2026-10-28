create table routine_templates (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  title text not null check (length(trim(title)) > 0),
  module text not null default 'umum' check (module in ('umum', 'kesehatan', 'belajar', 'keuangan', 'kerja')),
  kind text not null check (kind in ('fixed', 'flexible')),
  start_time time,
  duration_min integer not null check (duration_min > 0),
  activity_type text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (kind <> 'fixed' or start_time is not null)
);

create table schedule_items (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  module text not null default 'umum' check (module in ('umum', 'kesehatan', 'belajar', 'keuangan', 'kerja')),
  kind text not null check (kind in ('fixed', 'flexible')),
  date date not null,
  start_time time,
  duration_min integer not null check (duration_min > 0),
  status text not null default 'terencana' check (status in ('terencana', 'selesai', 'dilewati', 'digeser')),
  reschedule_count integer not null default 0 check (reschedule_count >= 0),
  rescheduled_from_id uuid references schedule_items (id) on delete set null,
  routine_id uuid references routine_templates (id) on delete set null,
  activity_type text,
  reminded_at timestamptz,
  asked_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (kind <> 'fixed' or start_time is not null)
);

create table activity_logs (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  module text not null default 'umum' check (module in ('umum', 'kesehatan', 'belajar', 'keuangan', 'kerja')),
  type text not null,
  occurred_at timestamptz not null,
  ended_at timestamptz,
  value numeric,
  unit text,
  note text,
  meta jsonb not null default '{}'::jsonb,
  item_id uuid references schedule_items (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at > occurred_at)
);

create table planner_settings (
  owner uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  quiet_start time not null default '22:00',
  quiet_end time not null default '04:00',
  slot_buffer_min integer not null default 10 check (slot_buffer_min >= 0),
  min_lead_min integer not null default 30 check (min_lead_min >= 0),
  max_free_shifts integer not null default 2 check (max_free_shifts >= 0),
  remind_before_min integer not null default 10 check (remind_before_min >= 0),
  morning_summary time not null default '04:30',
  evening_summary time not null default '20:30'
);

create index schedule_items_owner_date_idx on schedule_items (owner, date);
create index schedule_items_rescheduled_from_idx on schedule_items (rescheduled_from_id);
create index schedule_items_routine_idx on schedule_items (routine_id);
create index routine_templates_owner_idx on routine_templates (owner);
create index activity_logs_owner_occurred_idx on activity_logs (owner, occurred_at);
create index activity_logs_item_idx on activity_logs (item_id);
create unique index activity_logs_one_per_item on activity_logs (item_id) where item_id is not null;
create unique index activity_logs_one_open_idle on activity_logs (owner) where type = 'idle' and ended_at is null;

alter table routine_templates enable row level security;
alter table schedule_items enable row level security;
alter table activity_logs enable row level security;
alter table planner_settings enable row level security;

create policy routine_templates_owner on routine_templates for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy schedule_items_owner on schedule_items for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy activity_logs_owner on activity_logs for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy planner_settings_owner on planner_settings for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
