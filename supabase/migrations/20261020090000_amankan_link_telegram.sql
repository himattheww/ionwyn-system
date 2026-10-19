begin;

drop policy if exists "Authenticated users can read tokens" on public.telegram_link_tokens;
drop policy if exists "Authenticated users can delete tokens" on public.telegram_link_tokens;
alter table public.telegram_link_tokens enable row level security;
revoke all on public.telegram_link_tokens from anon, authenticated;

revoke update on public.profiles from anon, authenticated;
grant update (full_name, avatar_url, currency, monthly_income, onboarding_done, updated_at) on public.profiles to authenticated;

create or replace function public.telegram_link_info(p_token text)
returns table (telegram_username text, expired boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select t.telegram_username, t.expires_at < now()
  from public.telegram_link_tokens t
  where t.token = p_token
    and auth.uid() is not null
$$;

create or replace function public.link_telegram(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_chat bigint;
begin
  if auth.uid() is null then
    raise exception 'Harus login dulu.' using errcode = '28000';
  end if;

  delete from public.telegram_link_tokens
  where token = p_token
    and expires_at >= now()
  returning chat_id into linked_chat;

  if linked_chat is null then
    raise exception 'Link sudah kedaluwarsa atau tidak valid.' using errcode = 'P0002';
  end if;

  update public.profiles
  set telegram_chat_id = null
  where telegram_chat_id = linked_chat
    and id <> auth.uid();

  update public.profiles
  set telegram_chat_id = linked_chat, updated_at = now()
  where id = auth.uid();
end;
$$;

revoke execute on function public.telegram_link_info(text) from public, anon;
revoke execute on function public.link_telegram(text) from public, anon;
grant execute on function public.telegram_link_info(text) to authenticated;
grant execute on function public.link_telegram(text) to authenticated;

delete from public.telegram_link_tokens where expires_at < now();

commit;
