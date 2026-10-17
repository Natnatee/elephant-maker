begin;

-- No backfill: existing members and OAuth profiles can claim a username later.
alter table public.profiles add column username text;
alter table public.profiles
  add constraint profiles_username_format check (
    username is null or (
      username ~ '^[a-z0-9_]{3,24}$'
      and username not in ('admin','administrator','root','support','system','elephantmaker')
    )
  ),
  add constraint profiles_username_key unique (username);

grant update(username) on public.profiles to authenticated;

-- Invoker security deliberately enforces immutability for every database role.
create function public.validate_profile_username() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.username is not null and new.username is distinct from old.username then
    raise exception 'Username cannot be changed once set' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.validate_profile_username() from public, anon, authenticated;
create trigger profile_username_immutable before update of username on public.profiles
for each row execute function public.validate_profile_username();

create or replace function public.create_user_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
declare display_name text; avatar_url text; member_username text;
begin
  if new.raw_app_meta_data->>'provider' = 'email' then
    member_username := lower(btrim(new.raw_user_meta_data->>'username'));
  end if;
  display_name := left(btrim(regexp_replace(coalesce(nullif(new.raw_user_meta_data->>'display_name',''), nullif(new.raw_user_meta_data->>'full_name',''), nullif(new.raw_user_meta_data->>'name',''), member_username, 'Maker'), '[[:cntrl:]]', '', 'g')),100);
  avatar_url := new.raw_user_meta_data->>'avatar_url';
  insert into public.profiles(id,name,avatar,username) values (
    new.id, coalesce(nullif(display_name,''),member_username,'Maker'),
    case when length(avatar_url) <= 2048 and avatar_url ~ '^https://[^[:space:]]+$' then avatar_url else '' end,
    member_username
  ) on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.create_user_profile() from public, anon, authenticated;

commit;
