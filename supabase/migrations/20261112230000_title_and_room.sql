-- Sprint 23: the ready check can read your file.
--
--   * Choosing your file in a night's ready check reads its length, name and size in the browser (the file
--     itself is never uploaded). The name and size are kept beside the length, so the ready check can say
--     whether you two have the same file, as the watch room's presence does.
--   * Like file_label, the name is a description only: up to 100 characters and nothing that looks like a
--     link. The app shortens long names and takes link-like parts out before saving.
--   * Each person writes only their own row (the existing policies); the new columns are added to the
--     column grants. The reset trigger is unchanged: a new title deletes both rows, a new method keeps the
--     files.

alter table public.ready_checks
  add column file_name text check (
    file_name is null or (char_length(file_name) between 1 and 100 and file_name !~* '(://|magnet:|www\.)')
  ),
  -- Bytes. Up to 1 TiB.
  add column file_size bigint check (file_size is null or file_size between 1 and 1099511627776);

grant insert (file_name, file_size) on public.ready_checks to authenticated;
grant update (file_name, file_size) on public.ready_checks to authenticated;
