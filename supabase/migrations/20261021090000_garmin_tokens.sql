create table public.fit_garmin_tokens (
  id smallint primary key default 1 check (id = 1),
  di_token text not null,
  di_refresh_token text not null,
  di_client_id text not null,
  updated_at timestamptz not null default now()
);

alter table public.fit_garmin_tokens enable row level security;
revoke all on public.fit_garmin_tokens from anon, authenticated;
