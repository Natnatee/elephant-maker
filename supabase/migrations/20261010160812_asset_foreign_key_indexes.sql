create index step_files_step_project_idx on public.step_files(step_id, project_id);
create index step_files_file_project_idx on public.step_files(file_id, project_id);
create index firmware_parts_release_project_idx on public.firmware_parts(release_id, project_id);
create index firmware_parts_file_project_idx on public.firmware_parts(file_id, project_id);
create index project_tags_tag_id_idx on public.project_tags(tag_id);
