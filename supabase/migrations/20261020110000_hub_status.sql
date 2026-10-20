create table public.hub_integration_status (
  id text primary key,
  label text not null,
  last_run_at timestamptz,
  last_ok_at timestamptz,
  last_error text,
  last_result text
);

alter table public.hub_integration_status enable row level security;
revoke all on public.hub_integration_status from anon, authenticated;
