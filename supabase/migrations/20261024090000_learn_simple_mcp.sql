alter table tracks add column kind text not null default 'coding' check (kind in ('coding', 'praktik'));

alter table topics
  add column summary text,
  add column exercise jsonb,
  add column completed_at timestamptz;

update topics t
set summary = l.summary,
    exercise = (l.exercise - 'rubric') || jsonb_build_object('type', 'code', 'checklist', coalesce(l.exercise -> 'rubric', '[]'::jsonb))
from topic_lessons l
where l.topic_id = t.id;

drop table topic_lessons;

create table mcp_clients (
  client_id text primary key,
  info jsonb not null,
  created_at timestamptz not null default now()
);

create table mcp_codes (
  code_hash text primary key,
  client_id text not null references mcp_clients (client_id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  resource text,
  expires_at timestamptz not null
);

create table mcp_tokens (
  token_hash text primary key,
  kind text not null check (kind in ('access', 'refresh')),
  client_id text not null references mcp_clients (client_id) on delete cascade,
  resource text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table mcp_clients enable row level security;
alter table mcp_codes enable row level security;
alter table mcp_tokens enable row level security;
revoke all on mcp_clients, mcp_codes, mcp_tokens from anon, authenticated;
