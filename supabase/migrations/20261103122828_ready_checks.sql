-- Phase 2: ready checks for watch nights.
--
--   * ready_checks hold one row per person per watch night: whether they're ready (the stream or their own
--     copy is set up) and, for Syncplay, which version of the file they have and how long it is, so the
--     two of you can tell your copies match. Both members read them; each person writes only their own.
--   * Only a description of the file is stored, never a link to it or the file itself.
--   * Changing what a night is for (the title) clears both rows; changing how you'll watch clears the
--     ready ticks but keeps the file details.
--   * In the supabase_realtime publication, so ticking ready on one screen shows on the other.

-- Target for ready_checks' foreign key, so a check's couple always matches its night's.
alter table public.watch_nights add constraint watch_nights_id_couple_id_key unique (id, couple_id);

create table public.ready_checks (
  watch_night_id uuid not null,
  -- Copied from the night so Realtime can filter by couple.
  couple_id uuid not null,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  -- When this person said they were ready, or null while they aren't.
  ready_at timestamptz,
  -- e.g. "1080p, extended cut". A description, not a link.
  file_label text not null default '' check (
    char_length(file_label) <= 100 and file_label !~* '(://|magnet:|www\.)'
  ),
  -- The file's length as the player shows it.
  file_seconds integer check (file_seconds between 1 and 86400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (watch_night_id, profile_id),
  foreign key (watch_night_id, couple_id) references public.watch_nights (id, couple_id) on delete cascade
);

create index ready_checks_couple_id_idx on public.ready_checks (couple_id);

create trigger ready_checks_set_updated_at
before update on public.ready_checks
for each row execute function public.set_updated_at();

alter publication supabase_realtime add table public.ready_checks;

-- Runs as the owner: whoever changes the night resets both people's rows, not just their own.
create function public.reset_ready_checks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (old.media_type, old.tmdb_id) is distinct from (new.media_type, new.tmdb_id) then
    delete from public.ready_checks where watch_night_id = new.id;
  elsif old.method is distinct from new.method then
    update public.ready_checks set ready_at = null where watch_night_id = new.id and ready_at is not null;
  end if;
  return new;
end;
$$;

revoke execute on function public.reset_ready_checks() from public, anon, authenticated;

create trigger watch_nights_reset_ready_checks
after update of media_type, tmdb_id, method on public.watch_nights
for each row execute function public.reset_ready_checks();

-- ---------------------------------------------------------------------------
-- Privileges and row-level security
-- ---------------------------------------------------------------------------

alter table public.ready_checks enable row level security;

revoke all on public.ready_checks from anon, authenticated;

grant select, delete on public.ready_checks to authenticated;
grant insert (watch_night_id, couple_id, profile_id, ready_at, file_label, file_seconds)
on public.ready_checks to authenticated;
grant update (ready_at, file_label, file_seconds) on public.ready_checks to authenticated;

create policy "members read their ready checks"
on public.ready_checks for select
to authenticated
using (couple_id = (select public.my_couple_id()));

create policy "members add their own ready check"
on public.ready_checks for insert
to authenticated
with check (profile_id = (select auth.uid()) and couple_id = (select public.my_couple_id()));

create policy "members change their own ready check"
on public.ready_checks for update
to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

create policy "members clear their own ready check"
on public.ready_checks for delete
to authenticated
using (profile_id = (select auth.uid()));
