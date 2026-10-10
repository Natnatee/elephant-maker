begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Maker' check (length(btrim(name)) between 1 and 100),
  bio text not null default '' check (length(bio) <= 2000),
  avatar text not null default '' check (avatar = '' or (length(avatar) <= 2048 and avatar ~ '^https://[^[:space:]]+$')),
  contacts jsonb not null default '{}'::jsonb check (
    jsonb_typeof(contacts) = 'object' and octet_length(contacts::text) <= 4096
    and contacts - array['line','facebook','github'] = '{}'::jsonb
    and (not contacts ? 'line' or jsonb_typeof(contacts->'line') = 'string')
    and (not contacts ? 'facebook' or jsonb_typeof(contacts->'facebook') = 'string')
    and (not contacts ? 'github' or jsonb_typeof(contacts->'github') = 'string')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (length(slug) between 1 and 120 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (length(title) <= 200),
  summary text not null default '' check (length(summary) <= 5000),
  category text not null check (category in ('ยานยนต์','บ้านและสวน','งานพิมพ์ 3D','อิเล็กทรอนิกส์')),
  cover text not null default '' check (length(cover) <= 2048),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','published')),
  readiness text not null default 'showcase' check (readiness in ('showcase','ready')),
  budget numeric not null default 0 check (budget >= 0 and budget <> 'NaN'::numeric),
  duration_minutes integer not null default 0 check (duration_minutes >= 0),
  difficulty text not null default 'beginner' check (difficulty in ('beginner','intermediate','advanced')),
  skills text[] not null default '{}',
  safety_notes text[] not null default '{}',
  compatibility_notes text not null default '' check (length(compatibility_notes) <= 5000),
  contacts jsonb not null default '{}'::jsonb check (
    jsonb_typeof(contacts) = 'object' and octet_length(contacts::text) <= 4096
    and contacts - array['line','facebook','github'] = '{}'::jsonb
    and (not contacts ? 'line' or jsonb_typeof(contacts->'line') = 'string')
    and (not contacts ? 'facebook' or jsonb_typeof(contacts->'facebook') = 'string')
    and (not contacts ? 'github' or jsonb_typeof(contacts->'github') = 'string')
  ),
  published_at timestamptz,
  featured boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index projects_owner_id_idx on public.projects(owner_id);
create index projects_published_idx on public.projects(published_at) where status = 'published';
create table public.steps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  "order" integer not null check ("order" > 0),
  title text not null default '' check (length(title) <= 200),
  description text not null default '' check (length(description) <= 20000),
  safety_note text check (length(safety_note) <= 5000),
  unique(project_id, "order"), unique(id, project_id)
);
create table public.materials (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 200),
  quantity numeric not null default 1 check (quantity >= 0 and quantity <> 'NaN'::numeric),
  unit text not null default '' check (length(unit) <= 100),
  estimated_cost numeric not null default 0 check (estimated_cost >= 0 and estimated_cost <> 'NaN'::numeric),
  note text check (length(note) <= 5000)
);
create table public.files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 255),
  kind text not null check (kind in ('image','video','text','document','model','source','firmware')),
  storage_path text unique check (length(storage_path) <= 1024),
  mime_type text not null default 'application/octet-stream' check (length(mime_type) <= 255),
  size_bytes bigint check (size_bytes between 0 and case when kind = 'firmware' then 16777216 else 52428800 end),
  license text not null default '' check (length(license) <= 200),
  sha256 text check (sha256 ~ '^[0-9a-fA-F]{64}$'),
  is_demo boolean not null default false,
  unique(id, project_id)
);
-- A step may contain text, any number of files, or a mix. Files cannot cross projects.
create table public.step_files (
  project_id uuid not null references public.projects(id) on delete cascade,
  step_id uuid not null,
  file_id uuid not null,
  position integer not null default 1 check (position > 0),
  caption text not null default '' check (length(caption) <= 2000),
  primary key(step_id, file_id), unique(step_id, position),
  foreign key (step_id, project_id) references public.steps(id, project_id) on delete cascade,
  foreign key (file_id, project_id) references public.files(id, project_id) on delete cascade
);
create index step_files_file_id_idx on public.step_files(file_id);
create table public.firmware_releases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  version text not null check (length(btrim(version)) between 1 and 100),
  chip text not null check (length(btrim(chip)) between 1 and 100),
  board text not null check (length(btrim(board)) between 1 and 200),
  license text not null default '' check (length(license) <= 200),
  notes text not null default '' check (length(notes) <= 20000),
  is_demo boolean not null default false,
  unique(id, project_id), unique(project_id, version)
);
create table public.firmware_parts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  release_id uuid not null,
  file_id uuid not null,
  "offset" text not null check ("offset" ~ '^0x[0-9a-fA-F]{1,8}$'),
  foreign key (release_id, project_id) references public.firmware_releases(id, project_id) on delete cascade,
  foreign key (file_id, project_id) references public.files(id, project_id) on delete cascade,
  unique(release_id, "offset")
);
-- Hex strings with leading zeroes/case differences must not represent duplicate offsets.
create unique index firmware_parts_offset_numeric_idx on public.firmware_parts
  (release_id, ((('x' || lpad(substring("offset" from 3), 8, '0'))::bit(32))::bigint));
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) between 1 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
create table public.project_tags (
  project_id uuid not null references public.projects(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key(project_id, tag_id)
);
insert into public.tags(name, slug) values
 ('ยานยนต์','automotive'), ('บ้านและสวน','home-garden'), ('งานพิมพ์ 3D','3d-printing'), ('อิเล็กทรอนิกส์','electronics'),
 ('ESP32','esp32'), ('ESP8266','esp8266'), ('Arduino','arduino'), ('K-Line','k-line'), ('IoT','iot'), ('อ่านข้อมูล','read-only'), ('STL','stl');

-- The sole SECURITY DEFINER function only provisions a safe profile, never authorizes access.
create or replace function public.create_user_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
declare display_name text; avatar_url text;
begin
  display_name := left(btrim(regexp_replace(coalesce(nullif(new.raw_user_meta_data->>'display_name',''), nullif(new.raw_user_meta_data->>'full_name',''), nullif(new.raw_user_meta_data->>'name',''), 'Maker'), '[[:cntrl:]]', '', 'g')),100);
  avatar_url := new.raw_user_meta_data->>'avatar_url';
  insert into public.profiles(id,name,avatar) values (
    new.id, coalesce(nullif(display_name,''),'Maker'),
    case when length(avatar_url) <= 2048 and avatar_url ~ '^https://[^[:space:]]+$' then avatar_url else '' end
  ) on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.create_user_profile() from public, anon, authenticated;
create trigger auth_user_profile after insert on auth.users for each row execute function public.create_user_profile();
insert into public.profiles(id,name,avatar)
select id,
 coalesce(nullif(left(btrim(regexp_replace(coalesce(nullif(raw_user_meta_data->>'display_name',''),nullif(raw_user_meta_data->>'full_name',''),nullif(raw_user_meta_data->>'name',''),'Maker'),'[[:cntrl:]]','','g')),100),''),'Maker'),
 case when length(raw_user_meta_data->>'avatar_url') <= 2048 and raw_user_meta_data->>'avatar_url' ~ '^https://[^[:space:]]+$' then raw_user_meta_data->>'avatar_url' else '' end
from auth.users on conflict(id) do nothing;

create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
create trigger profiles_updated before update on public.profiles for each row execute function public.touch_updated_at();
create trigger projects_updated before update on public.projects for each row execute function public.touch_updated_at();

-- Invoker execution: validation cannot bypass the caller's RLS.
create function public.validate_project() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'published' then
    if length(btrim(new.title)) = 0 or length(btrim(new.summary)) = 0 or length(btrim(new.cover)) = 0 then
      raise exception 'Publication requires title, summary and cover' using errcode = '23514';
    end if;
    if exists(select 1 from public.files where project_id = new.id and length(btrim(license)) = 0) then
      raise exception 'Publication requires a license for every file' using errcode = '23514';
    end if;
    if new.readiness = 'ready' and (
      not exists(select 1 from public.steps where project_id = new.id)
      or exists(select 1 from public.steps s where s.project_id = new.id
        and length(btrim(s.description)) = 0
        and not exists(select 1 from public.step_files sf where sf.step_id = s.id and sf.project_id = new.id))
    ) then raise exception 'Ready publication requires steps with text or attachments' using errcode = '23514'; end if;
    new.published_at := coalesce(new.published_at, now());
  else new.published_at := null;
  end if;
  return new;
end;
$$;
create trigger projects_validate before insert or update on public.projects for each row execute function public.validate_project();
create function public.validate_file_path() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.storage_path is not null and not exists (
    select 1 from public.projects p where p.id = new.project_id
    and split_part(new.storage_path,'/',1) = p.owner_id::text
    and split_part(new.storage_path,'/',2) = p.id::text
    and new.storage_path ~ '^[^/]+/[^/]+/[^/]+(/[^/]+)*$'
    and new.storage_path !~ '(^|/)\.{1,2}(/|$)'
  ) then raise exception 'Invalid project asset path' using errcode = '23514'; end if;
  if exists(select 1 from public.projects where id = new.project_id and status = 'published') and length(btrim(new.license)) = 0 then
    raise exception 'Published files require a license' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger files_validate before insert or update on public.files for each row execute function public.validate_file_path();

alter table public.profiles enable row level security;
create policy profiles_read on public.profiles for select to anon, authenticated using (true);
create policy profiles_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
alter table public.projects enable row level security;
create policy projects_read on public.projects for select to anon, authenticated using (status = 'published' or owner_id = (select auth.uid()));
create policy projects_insert on public.projects for insert to authenticated with check (owner_id = (select auth.uid()));
create policy projects_update on public.projects for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy projects_delete on public.projects for delete to authenticated using (owner_id = (select auth.uid()));
alter table public.tags enable row level security;
create policy tags_read on public.tags for select to anon, authenticated using (true);

-- USING protects the old parent; WITH CHECK independently protects the new parent.
do $$
declare t text;
begin
  foreach t in array array['steps','materials','files','step_files','firmware_releases','firmware_parts','project_tags'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create index %I on public.%I(project_id)',t || '_project_id_idx',t);
    execute format('create policy child_read on public.%I for select to anon, authenticated using (exists (select 1 from public.projects p where p.id = project_id and (p.status = ''published'' or p.owner_id = (select auth.uid()))))',t);
    execute format('create policy child_insert on public.%I for insert to authenticated with check (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())))',t);
    execute format('create policy child_update on public.%I for update to authenticated using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))) with check (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())))',t);
    execute format('create policy child_delete on public.%I for delete to authenticated using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())))',t);
  end loop;
end;
$$;

revoke all on public.profiles, public.projects, public.steps, public.materials, public.files, public.step_files, public.firmware_releases, public.firmware_parts, public.tags, public.project_tags from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.projects, public.steps, public.materials, public.files, public.step_files, public.firmware_releases, public.firmware_parts, public.tags, public.project_tags to anon, authenticated;
grant update(name,bio,avatar,contacts) on public.profiles to authenticated;
grant insert(id,slug,title,summary,category,cover,owner_id,status,readiness,budget,duration_minutes,difficulty,skills,safety_notes,compatibility_notes,contacts,published_at),
 update(slug,title,summary,category,cover,owner_id,status,readiness,budget,duration_minutes,difficulty,skills,safety_notes,compatibility_notes,contacts,published_at), delete on public.projects to authenticated;
grant insert, update, delete on public.steps, public.materials, public.files, public.step_files, public.firmware_releases, public.firmware_parts, public.project_tags to authenticated;
revoke all on function public.touch_updated_at(), public.validate_project(), public.validate_file_path() from public, anon, authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values (
 'project-assets','project-assets',false,52428800,
 array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime','application/octet-stream','model/stl','application/sla','application/zip','application/x-zip-compressed','application/pdf','text/plain','text/markdown','application/json']
);
-- Text comparisons avoid unsafe UUID casts on arbitrary object names.
create policy project_assets_read on storage.objects for select to anon, authenticated using (
 bucket_id = 'project-assets' and name ~ '^[^/]+/[^/]+/[^/]+(/[^/]+)*$' and name !~ '(^|/)\.{1,2}(/|$)'
 and exists(select 1 from public.projects p where p.id::text = split_part(name,'/',2)
   and p.owner_id::text = split_part(name,'/',1) and (p.status = 'published' or p.owner_id = (select auth.uid())))
);
create policy project_assets_insert on storage.objects for insert to authenticated with check (
 bucket_id = 'project-assets' and name ~ '^[^/]+/[^/]+/[^/]+(/[^/]+)*$' and name !~ '(^|/)\.{1,2}(/|$)'
 and exists(select 1 from public.projects p where p.id::text = split_part(name,'/',2)
   and p.owner_id::text = split_part(name,'/',1) and p.owner_id = (select auth.uid()))
);
create policy project_assets_update on storage.objects for update to authenticated using (
 bucket_id = 'project-assets' and exists(select 1 from public.projects p where p.id::text = split_part(name,'/',2) and p.owner_id::text = split_part(name,'/',1) and p.owner_id = (select auth.uid()))
) with check (
 bucket_id = 'project-assets' and name ~ '^[^/]+/[^/]+/[^/]+(/[^/]+)*$' and name !~ '(^|/)\.{1,2}(/|$)'
 and exists(select 1 from public.projects p where p.id::text = split_part(name,'/',2) and p.owner_id::text = split_part(name,'/',1) and p.owner_id = (select auth.uid()))
);
create policy project_assets_delete on storage.objects for delete to authenticated using (
 bucket_id = 'project-assets' and exists(select 1 from public.projects p where p.id::text = split_part(name,'/',2) and p.owner_id::text = split_part(name,'/',1) and p.owner_id = (select auth.uid()))
);
commit;
