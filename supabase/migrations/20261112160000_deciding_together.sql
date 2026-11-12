-- Sprint 16: deciding together.
--
--   * swipes hold each person's yes or no on a title in the day's swipe deck (/pick/swipe). `day` is the
--     deck's day (the UTC date its order is seeded from, daySeed()), so a new deck starts each day and
--     "Start again" clears just yours for that day. A title you've both said yes to on the same day is a
--     match. Both members read them; each person writes only their own.
--   * moods hold each person's mood for their own local day (`on_day`, the date on their clock when they
--     set it): one row per person, replaced when they pick another. Pick and the swipe deck lean towards
--     genres that suit both moods. Both members read them; each person writes only their own.
--   * Both tables are in the supabase_realtime publication, so a yes (a match) and a new mood show on the
--     other screen straight away.

create table public.swipes (
  couple_id uuid not null references public.couples (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  tmdb_id integer not null check (tmdb_id > 0),
  liked boolean not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, day, media_type, tmdb_id)
);

create index swipes_couple_day_idx on public.swipes (couple_id, day);

alter publication supabase_realtime add table public.swipes;

create table public.moods (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  couple_id uuid not null references public.couples (id) on delete cascade,
  mood text not null check (mood in ('cosy', 'gripping', 'funny', 'light', 'tired')),
  -- The day on the person's own clock when they set it; the mood counts only on that day.
  on_day date not null,
  updated_at timestamptz not null default now()
);

create index moods_couple_id_idx on public.moods (couple_id);

create trigger moods_set_updated_at
before update on public.moods
for each row execute function public.set_updated_at();

alter publication supabase_realtime add table public.moods;

-- ---------------------------------------------------------------------------
-- Privileges and row-level security
-- ---------------------------------------------------------------------------

alter table public.swipes enable row level security;
alter table public.moods enable row level security;

revoke all on public.swipes from anon, authenticated;
revoke all on public.moods from anon, authenticated;

grant select, delete on public.swipes to authenticated;
grant insert (couple_id, profile_id, day, media_type, tmdb_id, liked) on public.swipes to authenticated;
grant update (liked) on public.swipes to authenticated;

grant select, delete on public.moods to authenticated;
grant insert (profile_id, couple_id, mood, on_day) on public.moods to authenticated;
grant update (mood, on_day) on public.moods to authenticated;

create policy "members read their swipes"
on public.swipes for select
to authenticated
using (couple_id = (select public.my_couple_id()));

-- Only for today's deck, give or take a day for the time it takes to cross midnight UTC.
create policy "members add their own swipe"
on public.swipes for insert
to authenticated
with check (
  profile_id = (select auth.uid())
  and couple_id = (select public.my_couple_id())
  and day between (now() at time zone 'utc')::date - 1 and (now() at time zone 'utc')::date + 1
);

create policy "members change their own swipe"
on public.swipes for update
to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

create policy "members clear their own swipes"
on public.swipes for delete
to authenticated
using (profile_id = (select auth.uid()));

create policy "members read their moods"
on public.moods for select
to authenticated
using (couple_id = (select public.my_couple_id()));

create policy "members set their own mood"
on public.moods for insert
to authenticated
with check (profile_id = (select auth.uid()) and couple_id = (select public.my_couple_id()));

create policy "members change their own mood"
on public.moods for update
to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

create policy "members clear their own mood"
on public.moods for delete
to authenticated
using (profile_id = (select auth.uid()));
