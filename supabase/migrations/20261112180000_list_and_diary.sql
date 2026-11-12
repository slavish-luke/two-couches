-- Sprint 18: list and diary. Watching a title again, and ratings per season.
--
-- Access model:
--   * rewatches: one row per extra watch of a title on the list (the first watch is list_items.watched_on),
--     each with its own date. Both members read, log, re-date and remove their couple's rewatches. The couple,
--     the list item and who logged it are fixed.
--   * rewatch_ratings: each person's 1-5 rating of one rewatch. Both members read them; each person writes
--     only their own.
--   * season_ratings: each person's 1-5 rating of a season of a series on the list. Both members read them;
--     each person writes only their own. Films have no seasons (a trigger checks the item).
--   * All three copy couple_id for Realtime filters and are in the supabase_realtime publication.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.rewatches (
  id uuid primary key default gen_random_uuid(),
  list_item_id uuid not null,
  -- Copied from the item so Realtime can filter by couple; the foreign key keeps it matching.
  couple_id uuid not null,
  -- A calendar date in the time zone of whoever logged it.
  watched_on date not null check (watched_on >= date '1900-01-01'),
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Target for rewatch_ratings' foreign key, so a rating's couple always matches its rewatch's.
  unique (id, couple_id),
  foreign key (list_item_id, couple_id) references public.list_items (id, couple_id) on delete cascade
);

create index rewatches_list_item_id_idx on public.rewatches (list_item_id);
create index rewatches_couple_id_idx on public.rewatches (couple_id);

create table public.rewatch_ratings (
  rewatch_id uuid not null,
  couple_id uuid not null,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (rewatch_id, profile_id),
  foreign key (rewatch_id, couple_id) references public.rewatches (id, couple_id) on delete cascade
);

create index rewatch_ratings_couple_id_idx on public.rewatch_ratings (couple_id);

create table public.season_ratings (
  list_item_id uuid not null,
  couple_id uuid not null,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  season smallint not null check (season between 1 and 999),
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (list_item_id, profile_id, season),
  foreign key (list_item_id, couple_id) references public.list_items (id, couple_id) on delete cascade
);

create index season_ratings_couple_id_idx on public.season_ratings (couple_id);

create trigger rewatch_ratings_set_updated_at
before update on public.rewatch_ratings
for each row execute function public.set_updated_at();

create trigger season_ratings_set_updated_at
before update on public.season_ratings
for each row execute function public.set_updated_at();

-- Seasons only for series. Runs as the user, so RLS on list_items applies: another couple's item fails too.
create function public.check_season_rating()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.list_items i where i.id = new.list_item_id and i.media_type = 'tv') then
    raise exception 'Only series have seasons to rate' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger season_ratings_check_series
before insert on public.season_ratings
for each row execute function public.check_season_rating();

alter publication supabase_realtime add table public.rewatches, public.rewatch_ratings, public.season_ratings;

-- ---------------------------------------------------------------------------
-- Privileges and row-level security
-- ---------------------------------------------------------------------------

alter table public.rewatches enable row level security;
alter table public.rewatch_ratings enable row level security;
alter table public.season_ratings enable row level security;

revoke all on public.rewatches, public.rewatch_ratings, public.season_ratings from anon, authenticated;

grant select, delete on public.rewatches, public.rewatch_ratings, public.season_ratings to authenticated;
grant insert (list_item_id, couple_id, watched_on, added_by) on public.rewatches to authenticated;
grant update (watched_on) on public.rewatches to authenticated;
grant insert (rewatch_id, couple_id, profile_id, rating) on public.rewatch_ratings to authenticated;
grant update (rating) on public.rewatch_ratings to authenticated;
grant insert (list_item_id, couple_id, profile_id, season, rating) on public.season_ratings to authenticated;
grant update (rating) on public.season_ratings to authenticated;

create policy "members read their rewatches"
on public.rewatches for select
to authenticated
using (couple_id = (select public.my_couple_id()));

create policy "members log a rewatch"
on public.rewatches for insert
to authenticated
with check (couple_id = (select public.my_couple_id()) and added_by = (select auth.uid()));

create policy "members re-date a rewatch"
on public.rewatches for update
to authenticated
using (couple_id = (select public.my_couple_id()))
with check (couple_id = (select public.my_couple_id()));

create policy "members remove a rewatch"
on public.rewatches for delete
to authenticated
using (couple_id = (select public.my_couple_id()));

create policy "members read their rewatch ratings"
on public.rewatch_ratings for select
to authenticated
using (couple_id = (select public.my_couple_id()));

create policy "rate a rewatch as yourself"
on public.rewatch_ratings for insert
to authenticated
with check (profile_id = (select auth.uid()) and couple_id = (select public.my_couple_id()));

create policy "change your own rewatch rating"
on public.rewatch_ratings for update
to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

create policy "clear your own rewatch rating"
on public.rewatch_ratings for delete
to authenticated
using (profile_id = (select auth.uid()));

create policy "members read their season ratings"
on public.season_ratings for select
to authenticated
using (couple_id = (select public.my_couple_id()));

create policy "rate a season as yourself"
on public.season_ratings for insert
to authenticated
with check (profile_id = (select auth.uid()) and couple_id = (select public.my_couple_id()));

create policy "change your own season rating"
on public.season_ratings for update
to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

create policy "clear your own season rating"
on public.season_ratings for delete
to authenticated
using (profile_id = (select auth.uid()));
