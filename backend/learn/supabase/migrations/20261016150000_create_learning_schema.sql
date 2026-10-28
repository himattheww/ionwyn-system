create table tracks (
  id bigint generated always as identity primary key,
  goal text not null check (char_length(goal) between 2 and 200),
  current_level text not null check (current_level in ('pemula', 'menengah', 'mahir')),
  hours_per_week int not null check (hours_per_week between 1 and 80),
  domain_hint text check (char_length(domain_hint) <= 200),
  status text not null default 'aktif' check (status in ('aktif', 'selesai', 'arsip')),
  created_at timestamptz not null default now()
);

create table topics (
  id bigint generated always as identity primary key,
  track_id bigint not null references tracks (id) on delete cascade,
  "order" int not null check ("order" > 0),
  title text not null,
  objective text not null,
  status text not null default 'belum' check (status in ('belum', 'sedang', 'selesai', 'sudah_bisa')),
  est_sessions int not null check (est_sessions > 0),
  prerequisites text[] not null default '{}',
  sources jsonb not null default '[]',
  unique (track_id, "order")
);

create table study_cases (
  id bigint generated always as identity primary key,
  topic_id bigint not null unique references topics (id) on delete cascade,
  title text not null,
  scenario text not null,
  requirements text[] not null,
  acceptance_criteria text[] not null,
  stretch_goals text[] not null default '{}',
  difficulty text not null check (difficulty in ('mudah', 'sedang', 'sulit')),
  est_sessions int not null check (est_sessions > 0),
  status text not null default 'belum' check (status in ('belum', 'dikerjakan', 'selesai')),
  result_link text,
  created_at timestamptz not null default now()
);

create table learning_sessions (
  id bigint generated always as identity primary key,
  track_id bigint not null references tracks (id) on delete cascade,
  topic_id bigint references topics (id) on delete set null,
  occurred_at date not null,
  duration_min int not null check (duration_min between 1 and 1440),
  summary text not null check (char_length(summary) between 1 and 200)
);

create index on learning_sessions (track_id, occurred_at);

alter table tracks enable row level security;
alter table topics enable row level security;
alter table study_cases enable row level security;
alter table learning_sessions enable row level security;

create function create_track(track jsonb, topic_list jsonb)
returns bigint
language plpgsql
set search_path = public
as $$
declare
  new_id bigint;
begin
  insert into tracks (goal, current_level, hours_per_week, domain_hint)
  values (track->>'goal', track->>'currentLevel', (track->>'hoursPerWeek')::int, nullif(track->>'domainHint', ''))
  returning id into new_id;

  insert into topics (track_id, "order", title, objective, status, est_sessions, prerequisites, sources)
  select new_id,
         t.ordinality,
         t.value->>'title',
         t.value->>'objective',
         case when (t.value->>'known')::boolean then 'sudah_bisa' else 'belum' end,
         (t.value->>'estSessions')::int,
         array(select jsonb_array_elements_text(t.value->'prerequisites')),
         t.value->'sources'
  from jsonb_array_elements(topic_list) with ordinality t;

  return new_id;
end;
$$;

revoke execute on function create_track(jsonb, jsonb) from public, anon, authenticated;
