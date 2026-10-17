-- Run against a disposable LOCAL Supabase database as postgres; never production.
\set ON_ERROR_STOP on
begin;
create function pg_temp.assert_true(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %', message; end if; end;
$$;
create function pg_temp.expect_error(statement text, expected_state text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if sqlstate = expected_state then return; end if;
    raise exception 'Unexpected SQLSTATE %, wanted %: %', sqlstate, expected_state, sqlerrm;
  end;
  raise exception 'Expected SQLSTATE % for: %', expected_state, statement;
end;
$$;
insert into auth.users(id, raw_user_meta_data) values
 ('11111111-1111-4111-8111-111111111111','{"display_name":"Owner","avatar_url":"javascript:bad","role":"admin"}'),
 ('22222222-2222-4222-8222-222222222222','{"full_name":"Other"}');
select pg_temp.assert_true((select name = 'Owner' and avatar = '' and contacts = '{}'::jsonb from public.profiles where id = '11111111-1111-4111-8111-111111111111'), 'safe auth profile trigger');
-- Trusted provider metadata, not user-controlled metadata, selects email signup.
insert into auth.users(id, email, raw_app_meta_data, raw_user_meta_data) values
 ('33333333-3333-4333-8333-333333333333','private@example.test','{"provider":"email"}','{"username":"  Maker_123  "}'),
 ('44444444-4444-4444-8444-444444444444','oauth@example.test','{"provider":"google"}','{"username":"admin","provider":"email","full_name":"OAuth Maker","avatar_url":"https://example.test/avatar.png"}');
select pg_temp.assert_true((select username = 'maker_123' and name = 'maker_123' from public.profiles where id = '33333333-3333-4333-8333-333333333333'), 'email username normalized and default name');
select pg_temp.assert_true((select username is null and name = 'OAuth Maker' and avatar = 'https://example.test/avatar.png' from public.profiles where id = '44444444-4444-4444-8444-444444444444'), 'OAuth ignores username and retains safe metadata');
select pg_temp.assert_true((select bool_and(username is null) from public.profiles where id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222')), 'missing provider leaves username null');
select pg_temp.expect_error($sql$insert into auth.users(id,raw_app_meta_data,raw_user_meta_data) values (gen_random_uuid(),'{"provider":"email"}','{"username":" MAKER_123 "}')$sql$, '23505');
do $$ declare candidate text; begin
 foreach candidate in array array['ab',repeat('a',25),'bad-name','bad name','ééé','','admin','administrator','root','support','system','elephantmaker'] loop
  perform pg_temp.expect_error(format('insert into auth.users(id,raw_app_meta_data,raw_user_meta_data) values (gen_random_uuid(),%L::jsonb,%L::jsonb)', '{"provider":"email"}', jsonb_build_object('username',candidate)::text), '23514');
 end loop;
end $$;
insert into public.projects(id,slug,title,summary,category,cover,owner_id,status) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','rls-public','Public','Summary','อิเล็กทรอนิกส์','cover.jpg','11111111-1111-4111-8111-111111111111','published'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','rls-draft','Draft','','งานพิมพ์ 3D','','22222222-2222-4222-8222-222222222222','draft');
insert into public.steps(project_id,"order",title) select id,1,'Step' from public.projects where slug in ('rls-public','rls-draft');
insert into public.materials(project_id,name) select id,'Material' from public.projects where slug in ('rls-public','rls-draft');
insert into public.files(id,project_id,name,kind,license,storage_path) values
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','firmware.bin','firmware','MIT','11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/firmware.bin'),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','draft.bin','firmware','MIT','22222222-2222-4222-8222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/draft.bin');
insert into public.step_files(project_id,step_id,file_id)
 select s.project_id,s.id,f.id from public.steps s join public.files f on f.project_id = s.project_id
 where s.project_id in ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.firmware_releases(id,project_id,version,chip,board) values
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1','esp32','devkit'),
 ('ffffffff-ffff-4fff-8fff-ffffffffffff','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','1','esp32','devkit');
insert into public.firmware_parts(project_id,release_id,file_id,"offset") values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','cccccccc-cccc-4ccc-8ccc-cccccccccccc','0x1000'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','ffffffff-ffff-4fff-8fff-ffffffffffff','dddddddd-dddd-4ddd-8ddd-dddddddddddd','0x1000');
insert into public.project_tags select p.id,t.id from public.projects p cross join public.tags t where p.slug in ('rls-public','rls-draft') and t.slug = 'electronics';
-- Metadata rows only: no Storage API / real uploads in this SQL test.
insert into storage.objects(bucket_id,name) values
 ('project-assets','11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/firmware.bin'),
 ('project-assets','22222222-2222-4222-8222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/draft.bin');

set local role anon;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{"role":"anon"}',true);
select pg_temp.assert_true((select count(*) = 1 from public.projects where slug in ('rls-public','rls-draft')), 'anon published only');
do $$ declare t text; n integer; begin
 foreach t in array array['steps','step_files','materials','files','firmware_releases','firmware_parts','project_tags'] loop
  execute format('select count(*) from public.%I where project_id in (''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'',''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'')',t) into n;
  perform pg_temp.assert_true(n = 1,'anon child visibility: ' || t);
 end loop;
end $$;
select pg_temp.assert_true((select count(*) = 1 from storage.objects where bucket_id = 'project-assets' and name like '%/firmware.bin'), 'anon published asset');
select pg_temp.assert_true((select count(*) = 0 from storage.objects where name like '%/draft.bin'), 'anon draft asset hidden');
select pg_temp.assert_true(not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'email'), 'profiles never expose auth email');
select pg_temp.expect_error('select email from auth.users','42501');
select pg_temp.expect_error('update public.profiles set username = ''anon_claim''','42501');
select pg_temp.expect_error('insert into public.tags(name,slug) values (''Bad'',''bad'')','42501');
select pg_temp.expect_error('update public.projects set title = ''Bad''','42501');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
select pg_temp.assert_true((select count(*) = 2 from public.projects where slug in ('rls-public','rls-draft')), 'owner reads own draft and public');
select pg_temp.assert_true((select count(*) = 1 from storage.objects where name like '%/draft.bin'), 'owner draft asset');
select pg_temp.expect_error('update public.profiles set username = ''maker_123'' where id = ''22222222-2222-4222-8222-222222222222''','23505');
select pg_temp.expect_error('update public.profiles set username = ''UPPER'' where id = ''22222222-2222-4222-8222-222222222222''','23514');
select pg_temp.expect_error('update public.profiles set username = ''admin'' where id = ''22222222-2222-4222-8222-222222222222''','23514');
update public.profiles set username = 'owner_claim' where id = '22222222-2222-4222-8222-222222222222';
update public.profiles set username = username where id = '22222222-2222-4222-8222-222222222222';
select pg_temp.assert_true((select username = 'owner_claim' from public.profiles where id = '22222222-2222-4222-8222-222222222222'), 'owner claims once');
select pg_temp.expect_error('update public.profiles set username = ''renamed'' where id = ''22222222-2222-4222-8222-222222222222''','23514');
select pg_temp.expect_error('update public.profiles set username = null where id = ''22222222-2222-4222-8222-222222222222''','23514');
select pg_temp.expect_error('select email from auth.users','42501');
update public.profiles set bio = 'Owner bio' where id = '22222222-2222-4222-8222-222222222222';
update public.projects set title = 'Edited draft' where slug = 'rls-draft';
select pg_temp.assert_true((select title = 'Edited draft' from public.projects where slug = 'rls-draft'), 'owner update');
select pg_temp.expect_error('update public.projects set featured = true where slug = ''rls-draft''','42501');
select pg_temp.expect_error('insert into public.projects(slug,title,category,owner_id,featured) values (''bad-feature'',''Bad'',''ยานยนต์'',''22222222-2222-4222-8222-222222222222'',true)','42501');
select pg_temp.expect_error('insert into public.tags(name,slug) values (''Bad'',''bad'')','42501');
select pg_temp.expect_error('insert into public.steps(project_id,"order",title) values (''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'',2,''Bad'')','42501');
-- File paths are validated by a BEFORE trigger; clear the path to isolate the RLS check.
select pg_temp.expect_error('update public.files set project_id = ''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'', storage_path = null where project_id = ''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb''','42501');
do $$ declare t text; begin
 foreach t in array array['steps','step_files','materials','firmware_releases','firmware_parts','project_tags'] loop
  perform pg_temp.expect_error(format('update public.%I set project_id = ''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'' where project_id = ''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb''',t),'42501');
 end loop;
end $$;
select pg_temp.expect_error('insert into public.step_files(project_id,step_id,file_id,position) select project_id,id,''cccccccc-cccc-4ccc-8ccc-cccccccccccc'',2 from public.steps where project_id = ''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb''','23503');
select pg_temp.expect_error('insert into public.step_files(project_id,step_id,file_id,position) select project_id,id,''cccccccc-cccc-4ccc-8ccc-cccccccccccc'',2 from public.steps where project_id = ''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa''','42501');
select pg_temp.expect_error('update public.projects set owner_id = ''11111111-1111-4111-8111-111111111111'' where slug = ''rls-draft''','42501');
select pg_temp.expect_error('update public.projects set status = ''published'' where slug = ''rls-draft''','23514');
select pg_temp.expect_error('insert into public.firmware_parts(project_id,release_id,file_id,"offset") values (''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'',''ffffffff-ffff-4fff-8fff-ffffffffffff'',''cccccccc-cccc-4ccc-8ccc-cccccccccccc'',''0x2000'')','23503');
select pg_temp.expect_error('insert into public.firmware_parts(project_id,release_id,file_id,"offset") values (''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'',''ffffffff-ffff-4fff-8fff-ffffffffffff'',''dddddddd-dddd-4ddd-8ddd-dddddddddddd'',''bad'')','23514');
select pg_temp.expect_error('insert into public.firmware_parts(project_id,release_id,file_id,"offset") values (''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'',''ffffffff-ffff-4fff-8fff-ffffffffffff'',''dddddddd-dddd-4ddd-8ddd-dddddddddddd'',''0x01000'')','23505');
select pg_temp.expect_error('update public.files set storage_path = ''11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/wrong.bin'' where id = ''dddddddd-dddd-4ddd-8ddd-dddddddddddd''','23514');
select pg_temp.expect_error('insert into storage.objects(bucket_id,name) values (''project-assets'',''11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/bad.bin'')','42501');
select pg_temp.expect_error('insert into storage.objects(bucket_id,name) values (''project-assets'',''22222222-2222-4222-8222-222222222222/not-a-uuid/bad.bin'')','42501');
insert into storage.objects(bucket_id,name) values ('project-assets','22222222-2222-4222-8222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/owner.bin');
delete from storage.objects where name like '%/owner.bin';
insert into public.steps(project_id,"order",title) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',2,'Owner step');
delete from public.steps where project_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and "order" = 2;
-- Ready projects need meaningful steps, not materials or compatibility/device data.
insert into public.projects(slug,title,summary,category,cover,owner_id,readiness) values
 ('rls-text-only','Text only','Summary','อิเล็กทรอนิกส์','cover.jpg','22222222-2222-4222-8222-222222222222','ready'),
 ('rls-file-only','File only','Summary','อิเล็กทรอนิกส์','cover.jpg','22222222-2222-4222-8222-222222222222','ready');
select pg_temp.expect_error('update public.projects set status = ''published'' where slug = ''rls-text-only''','23514');
insert into public.steps(project_id,"order") select id,1 from public.projects where slug in ('rls-text-only','rls-file-only');
select pg_temp.assert_true((select bool_and(title = '' and description = '') from public.steps where project_id in (select id from public.projects where slug in ('rls-text-only','rls-file-only'))), 'optional step title and description defaults');
update public.steps set description = '   ' where project_id = (select id from public.projects where slug = 'rls-text-only');
select pg_temp.expect_error('update public.projects set status = ''published'' where slug = ''rls-text-only''','23514');
update public.steps set description = 'Follow these instructions.' where project_id = (select id from public.projects where slug = 'rls-text-only');
update public.projects set status = 'published' where slug = 'rls-text-only';
-- Every step must contain text or an attachment, even if another step is complete.
insert into public.steps(project_id,"order") select id,2 from public.projects where slug = 'rls-file-only';
insert into public.files(project_id,name,kind) select id,'guide.md','text' from public.projects where slug = 'rls-file-only';
insert into public.step_files(project_id,step_id,file_id)
 select s.project_id,s.id,f.id from public.steps s join public.files f on f.project_id = s.project_id
 where s.project_id = (select id from public.projects where slug = 'rls-file-only') and s."order" = 1;
select pg_temp.expect_error('update public.projects set status = ''published'' where slug = ''rls-file-only''','23514');
update public.files set license = 'MIT' where project_id = (select id from public.projects where slug = 'rls-file-only');
select pg_temp.expect_error('update public.projects set status = ''published'' where slug = ''rls-file-only''','23514');
insert into public.step_files(project_id,step_id,file_id)
 select s.project_id,s.id,f.id from public.steps s join public.files f on f.project_id = s.project_id
 where s.project_id = (select id from public.projects where slug = 'rls-file-only') and s."order" = 2;
update public.files set license = '' where project_id = (select id from public.projects where slug = 'rls-file-only');
select pg_temp.expect_error('update public.projects set status = ''published'' where slug = ''rls-file-only''','23514');
update public.files set license = 'MIT' where project_id = (select id from public.projects where slug = 'rls-file-only');
update public.projects set status = 'published' where slug = 'rls-file-only';
select pg_temp.assert_true((select count(*) = 2 and bool_and(status = 'published' and compatibility_notes = '' and contacts = '{}'::jsonb) from public.projects where slug in ('rls-text-only','rls-file-only')), 'text-only and licensed file-only readiness without compatibility');
select pg_temp.assert_true((select count(*) = 0 from public.materials where project_id in (select id from public.projects where slug in ('rls-text-only','rls-file-only'))), 'ready publication does not require materials');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
select pg_temp.assert_true((select count(*) = 0 from public.projects where slug = 'rls-draft'), 'nonowner draft hidden');
do $$ declare t text; n integer; begin
 foreach t in array array['steps','step_files','materials','files','firmware_releases','firmware_parts','project_tags'] loop
  execute format('select count(*) from public.%I where project_id = ''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb''',t) into n;
  perform pg_temp.assert_true(n = 0,'nonowner child hidden: ' || t);
  execute format('update public.%I set project_id = project_id where project_id = ''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb''',t);
  get diagnostics n = row_count;
  perform pg_temp.assert_true(n = 0,'nonowner update filtered: ' || t);
  execute format('delete from public.%I where project_id = ''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb''',t);
  get diagnostics n = row_count;
  perform pg_temp.assert_true(n = 0,'nonowner delete filtered: ' || t);
 end loop;
 update public.projects set title = 'Hijacked' where slug = 'rls-draft';
 get diagnostics n = row_count;
 perform pg_temp.assert_true(n = 0,'nonowner project update filtered');
 update public.profiles set bio = 'Hijacked' where id = '22222222-2222-4222-8222-222222222222';
 get diagnostics n = row_count;
 perform pg_temp.assert_true(n = 0,'nonowner profile update filtered');
  update public.profiles set username = 'stolen_claim' where id = '44444444-4444-4444-8444-444444444444';
  get diagnostics n = row_count;
  perform pg_temp.assert_true(n = 0,'nonowner username claim filtered');
  update public.profiles set username = 'stolen_name' where id = '22222222-2222-4222-8222-222222222222';
  get diagnostics n = row_count;
  perform pg_temp.assert_true(n = 0,'nonowner username change filtered');
end $$;
select pg_temp.assert_true((select count(*) = 0 from storage.objects where name like '%/draft.bin'), 'nonowner draft storage hidden');
reset role;
select pg_temp.assert_true((select bio = 'Owner bio' from public.profiles where id = '22222222-2222-4222-8222-222222222222'), 'profile unchanged');
select pg_temp.assert_true((select not public from storage.buckets where id = 'project-assets'), 'bucket private');
rollback;
\echo 'RLS tests passed; all fixtures rolled back.'
