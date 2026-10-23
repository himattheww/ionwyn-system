create table topic_lessons (
  topic_id bigint primary key references topics (id) on delete cascade,
  overview text not null,
  sections jsonb not null default '[]',
  examples jsonb not null default '[]',
  key_points text[] not null default '{}',
  quiz jsonb not null default '[]',
  exercise jsonb not null,
  created_at timestamptz not null default now()
);

create table topic_attempts (
  id bigint generated always as identity primary key,
  topic_id bigint not null references topics (id) on delete cascade,
  kind text not null check (kind in ('quiz', 'code')),
  score int not null check (score >= 0),
  total int not null check (total > 0),
  passed boolean not null,
  code text,
  feedback text,
  created_at timestamptz not null default now()
);

create index on topic_attempts (topic_id, kind, created_at desc);

alter table topic_lessons enable row level security;
alter table topic_attempts enable row level security;
