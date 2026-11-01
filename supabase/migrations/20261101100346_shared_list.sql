-- Sprint 2: the shared list, with a rating from each person.
--
-- Access model:
--   * list_items belong to a couple. Both members read, add, edit and remove their couple's items.
--     The couple, the title and who added it are fixed once added.
--   * list_ratings hold one rating per person per item. Both members read them; each person writes only
--     their own.
--   * Both tables are in the supabase_realtime publication, so an add on one screen appears on the other.

-- Up to 10 distinct, trimmed category names of 1-30 characters, e.g. 'Horror nights'.
create function public.valid_categories(categories text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select cardinality(categories) <= 10
    and not exists (
      select 1 from unnest(categories) c
      where c is null or c <> btrim(c) or char_length(c) not between 1 and 30
    )
    and cardinality(categories) = (select count(distinct c) from unnest(categories) c);
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  media_type text not null,
  tmdb_id integer not null,
  added_by uuid references public.profiles (id) on delete set null,
  status text not null default 'want' check (status in ('want', 'watching', 'watched', 'dropped')),
  categories text[] not null default '{}' check (public.valid_categories(categories)),
  -- One note shared by both people.
  notes text not null default '' check (char_length(notes) <= 1000),
  -- Series only: the last episode watched.
  season integer check (season > 0),
  episode integer check (episode > 0),
  -- A calendar date in the time zone of whoever marked it watched.
  watched_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (couple_id, media_type, tmdb_id),
  -- Target for list_ratings' foreign key, so a rating's couple always matches its item's.
  unique (id, couple_id),
  check ((season is null) = (episode is null)),
  foreign key (media_type, tmdb_id) references public.titles (media_type, tmdb_id)
);

create table public.list_ratings (
  list_item_id uuid not null,
  -- Copied from the item so Realtime can filter by couple.
  couple_id uuid not null,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (list_item_id, profile_id),
  foreign key (list_item_id, couple_id) references public.list_items (id, couple_id) on delete cascade
);

create index list_ratings_couple_id_idx on public.list_ratings (couple_id);

create trigger list_items_set_updated_at
before update on public.list_items
for each row execute function public.set_updated_at();

create trigger list_ratings_set_updated_at
before update on public.list_ratings
for each row execute function public.set_updated_at();

alter publication supabase_realtime add table public.list_items, public.list_ratings;

-- ---------------------------------------------------------------------------
-- Privileges and row-level security
-- ---------------------------------------------------------------------------

alter table public.list_items enable row level security;
alter table public.list_ratings enable row level security;

revoke all on public.list_items, public.list_ratings from anon, authenticated;

grant select, delete on public.list_items, public.list_ratings to authenticated;
grant insert (couple_id, media_type, tmdb_id, added_by, status, categories, notes, season, episode, watched_on)
on public.list_items to authenticated;
grant update (status, categories, notes, season, episode, watched_on) on public.list_items to authenticated;
grant insert (list_item_id, couple_id, profile_id, rating) on public.list_ratings to authenticated;
grant update (rating) on public.list_ratings to authenticated;
grant execute on function public.valid_categories(text[]) to authenticated;

create policy "members read their list"
on public.list_items for select
to authenticated
using (couple_id = (select public.my_couple_id()));

create policy "members add to their list"
on public.list_items for insert
to authenticated
with check (couple_id = (select public.my_couple_id()) and added_by = (select auth.uid()));

create policy "members edit their list"
on public.list_items for update
to authenticated
using (couple_id = (select public.my_couple_id()))
with check (couple_id = (select public.my_couple_id()));

create policy "members remove from their list"
on public.list_items for delete
to authenticated
using (couple_id = (select public.my_couple_id()));

create policy "members read their ratings"
on public.list_ratings for select
to authenticated
using (couple_id = (select public.my_couple_id()));

create policy "rate as yourself"
on public.list_ratings for insert
to authenticated
with check (profile_id = (select auth.uid()) and couple_id = (select public.my_couple_id()));

create policy "change your own rating"
on public.list_ratings for update
to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

create policy "clear your own rating"
on public.list_ratings for delete
to authenticated
using (profile_id = (select auth.uid()));
