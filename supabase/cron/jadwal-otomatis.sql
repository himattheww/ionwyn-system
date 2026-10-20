create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('__INTERNAL_SECRET__', 'ionwyn_internal_secret');
select vault.create_secret('https://__DOMAIN__', 'ionwyn_base_url');

create or replace function public.ionwyn_call(path text)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'ionwyn_base_url') || path,
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-ionwyn-internal', (select decrypted_secret from vault.decrypted_secrets where name = 'ionwyn_internal_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
$$;

revoke execute on function public.ionwyn_call(text) from public, anon, authenticated;

select cron.schedule('ionwyn-integrasi', '*/10 * * * *', $$ select public.ionwyn_call('/hub/api/integrations/run') $$);
select cron.schedule('ionwyn-leveling', '*/30 * * * *', $$ select public.ionwyn_call('/leveling/api/recalculate') $$);
