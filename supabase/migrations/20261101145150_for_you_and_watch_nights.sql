-- Sprint 5: "not interested" for recommendations, and the watch-night calendar.
--
-- Access model:
--   * dismissed_titles are titles a couple doesn't want suggested again. Both members read, add and clear
--     them. No foreign key to titles: suggestions come straight from TMDB and aren't cached.
--   * watch_nights belong to a couple. Both members read, plan, edit and cancel them; the couple and who
--     planned it are fixed. The title is optional ("decide later") and, when set, must be cached.
--   * Both tables are in the supabase_realtime publication, so a change on one screen shows on the other.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.dismissed_titles (
  couple_id uuid not null references public.couples (id) on delete cascade,
  media_type text not null check (media_type in ('movie', 'tv')),
  tmdb_id integer not null check (tmdb_id > 0),
  dismissed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (couple_id, media_type, tmdb_id)
);

create table public.watch_nights (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  -- What you'll watch, or both null to decide later.
  media_type text,
  tmdb_id integer,
  starts_at timestamptz not null,
  -- How you'll watch together, or null while undecided.
  method text check (method in ('teleparty', 'syncplay', 'other')),
  -- A Teleparty (or other) invite link.
  link text check (link like 'https://%' and char_length(link) <= 500),
  -- A Syncplay server ("host:port") and room name.
  syncplay_server text check (char_length(syncplay_server) <= 100),
  syncplay_room text check (char_length(syncplay_room) <= 100),
  notes text not null default '' check (char_length(notes) <= 500),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((media_type is null) = (tmdb_id is null)),
  foreign key (media_type, tmdb_id) references public.titles (media_type, tmdb_id)
);

create index watch_nights_couple_id_starts_at_idx on public.watch_nights (couple_id, starts_at);

create trigger watch_nights_set_updated_at
before update on public.watch_nights
for each row execute function public.set_updated_at();

alter publication supabase_realtime add table public.dismissed_titles, public.watch_nights;

-- ---------------------------------------------------------------------------
-- Privileges and row-level security
-- ---------------------------------------------------------------------------

alter table public.dismissed_titles enable row level security;
alter table public.watch_nights enable row level security;

revoke all on public.dismissed_titles, public.watch_nights from anon, authenticated;

grant select, delete on public.dismissed_titles, public.watch_nights to authenticated;
grant insert (couple_id, media_type, tmdb_id, dismissed_by) on public.dismissed_titles to authenticated;
grant insert (couple_id, media_type, tmdb_id, starts_at, method, link, syncplay_server, syncplay_room, notes, created_by)
on public.watch_nights to authenticated;
grant update (media_type, tmdb_id, starts_at, method, link, syncplay_server, syncplay_room, notes)
on public.watch_nights to authenticated;

create policy "members read their dismissed titles"
on public.dismissed_titles for select
to authenticated
using (couple_id = (select public.my_couple_id()));

create policy "members dismiss titles"
on public.dismissed_titles for insert
to authenticated
with check (couple_id = (select public.my_couple_id()) and dismissed_by = (select auth.uid()));

create policy "members undo dismissals"
on public.dismissed_titles for delete
to authenticated
using (couple_id = (select public.my_couple_id()));

create policy "members read their watch nights"
on public.watch_nights for select
to authenticated
using (couple_id = (select public.my_couple_id()));

create policy "members plan watch nights"
on public.watch_nights for insert
to authenticated
with check (couple_id = (select public.my_couple_id()) and created_by = (select auth.uid()));

create policy "members edit their watch nights"
on public.watch_nights for update
to authenticated
using (couple_id = (select public.my_couple_id()))
with check (couple_id = (select public.my_couple_id()));

create policy "members cancel their watch nights"
on public.watch_nights for delete
to authenticated
using (couple_id = (select public.my_couple_id()));
