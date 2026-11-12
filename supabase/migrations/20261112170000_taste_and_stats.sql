-- Sprint 17: taste and stats. "Guess their rating" on a watched title's page.
--
-- Access model:
--   * rating_guesses hold one guess per person per list item: what you thought your partner gave it, or
--     null when you tapped "Just show me". Both members read them (Stats scores both of you); each person
--     adds only their own, once. Nobody changes or removes a guess (it goes with its list item).
--   * `actual` is your partner's rating at the moment you guessed, filled in by a trigger, so a guess is
--     scored against what you were shown even if they change their stars later. Without a rating from the
--     partner there is nothing to guess, so the insert fails.
--   * The guess only veils the stars in the UI: list_ratings stay readable to both members as before.

create table public.rating_guesses (
  list_item_id uuid not null,
  -- Copied from the item so Realtime can filter by couple.
  couple_id uuid not null,
  -- Who guessed.
  profile_id uuid not null references public.profiles (id) on delete cascade,
  -- 1-5 stars, or null for "Just show me".
  guess smallint check (guess between 1 and 5),
  -- The partner's rating when the guess was made (set by the trigger below).
  actual smallint not null check (actual between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (list_item_id, profile_id),
  foreign key (list_item_id, couple_id) references public.list_items (id, couple_id) on delete cascade
);

create index rating_guesses_couple_id_idx on public.rating_guesses (couple_id);

-- Fills in `actual` from the other member's rating of the item. Runs as the user, so RLS on list_ratings
-- applies: another couple's ratings are invisible, and their items fail here too.
create function public.fill_rating_guess()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select r.rating into new.actual
  from public.list_ratings r
  where r.list_item_id = new.list_item_id and r.profile_id <> new.profile_id
  limit 1;
  if new.actual is null then
    raise exception 'Your partner has not rated this yet' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger rating_guesses_fill
before insert on public.rating_guesses
for each row execute function public.fill_rating_guess();

alter publication supabase_realtime add table public.rating_guesses;

alter table public.rating_guesses enable row level security;

revoke all on public.rating_guesses from anon, authenticated;
grant select on public.rating_guesses to authenticated;
grant insert (list_item_id, couple_id, profile_id, guess) on public.rating_guesses to authenticated;

create policy "members read their guesses"
on public.rating_guesses for select
to authenticated
using (couple_id = (select public.my_couple_id()));

create policy "guess as yourself"
on public.rating_guesses for insert
to authenticated
with check (profile_id = (select auth.uid()) and couple_id = (select public.my_couple_id()));
