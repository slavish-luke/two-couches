-- Sprint 10: loose ends.
--
--   * review_signals: one body-less row per written review, kept in step with list_reviews by a trigger.
--     list_reviews hides your partner's row until you've written yours, and Realtime applies the same
--     policy, so the title page never heard that they had written one. Both members read these rows, so
--     the "{name} has written theirs" notice arrives live. Nobody writes them directly.
--   * titles.season_episodes: how many episodes each season of a series has, so "Watched up to" can roll
--     over into the next season.

-- ---------------------------------------------------------------------------
-- Review signals
-- ---------------------------------------------------------------------------

create table public.review_signals (
  list_item_id uuid not null,
  -- Copied from the review so Realtime can filter by couple.
  couple_id uuid not null,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  -- When the review was written or last changed. Never the text.
  changed_at timestamptz not null default now(),
  primary key (list_item_id, profile_id),
  foreign key (list_item_id, couple_id) references public.list_items (id, couple_id) on delete cascade
);

create index review_signals_couple_id_idx on public.review_signals (couple_id);

-- Mirrors list_reviews: a row while a review exists, touched whenever it changes. Security definer, since
-- users can't write review_signals themselves.
create function public.sync_review_signal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    -- Also runs when a list item or profile is deleted (cascading to the review), when the signal has
    -- gone the same way already; deleting nothing is fine.
    delete from public.review_signals where list_item_id = old.list_item_id and profile_id = old.profile_id;
    return old;
  end if;
  insert into public.review_signals (list_item_id, couple_id, profile_id, changed_at)
  values (new.list_item_id, new.couple_id, new.profile_id, now())
  on conflict (list_item_id, profile_id) do update set changed_at = excluded.changed_at;
  return new;
end;
$$;

revoke execute on function public.sync_review_signal() from public, anon, authenticated;

create trigger list_reviews_sync_signal
after insert or update or delete on public.list_reviews
for each row execute function public.sync_review_signal();

-- Reviews written before this migration.
insert into public.review_signals (list_item_id, couple_id, profile_id, changed_at)
select list_item_id, couple_id, profile_id, updated_at from public.list_reviews;

alter table public.review_signals enable row level security;
revoke all on public.review_signals from anon, authenticated;
grant select on public.review_signals to authenticated;

create policy "members read their review signals"
on public.review_signals for select
to authenticated
using (couple_id = (select public.my_couple_id()));

alter publication supabase_realtime add table public.review_signals;

-- ---------------------------------------------------------------------------
-- Episodes per season
-- ---------------------------------------------------------------------------

-- Episodes in each season of a series from TMDB, season 1 first (specials left out). Null for films and
-- for rows cached before this column existed; filled on the title's next refresh.
alter table public.titles add column season_episodes integer[]
  check (season_episodes is null or (cardinality(season_episodes) > 0 and 0 <= all (season_episodes)));
