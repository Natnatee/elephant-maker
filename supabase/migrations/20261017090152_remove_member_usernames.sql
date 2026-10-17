begin;

create or replace function public.create_user_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
declare display_name text; avatar_url text;
begin
  display_name := left(btrim(regexp_replace(coalesce(
    nullif(btrim(new.raw_user_meta_data->>'name'), ''),
    nullif(btrim(new.raw_user_meta_data->>'display_name'), ''),
    nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),
    'Maker'
  ), '[[:cntrl:]]', '', 'g')), 100);
  avatar_url := new.raw_user_meta_data->>'avatar_url';
  insert into public.profiles(id, name, avatar) values (
    new.id, coalesce(nullif(display_name, ''), 'Maker'),
    case when length(avatar_url) <= 2048 and avatar_url ~ '^https://[^[:space:]]+$' then avatar_url else '' end
  ) on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.create_user_profile() from public, anon, authenticated;

revoke update(username) on public.profiles from authenticated;
drop trigger profile_username_immutable on public.profiles;
drop function public.validate_profile_username();
-- PostgreSQL removes this column's constraints and indexes; no CASCADE or row updates.
alter table public.profiles drop column username;

commit;
