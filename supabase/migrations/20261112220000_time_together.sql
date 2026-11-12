-- Sprint 22: time together.
--   * free_evenings: "I'm free tonight", per person per evening on their own clock (`on_day`, their local
--     date). One row per person per evening; undoing it sets `free` to false rather than deleting it, so a
--     second tap the same evening doesn't push your partner again (the push goes with the first insert).
--     Both members read them; each person adds and changes only their own. In Realtime, so Home shows your
--     partner's tap straight away.
--   * titles.origin_countries: TMDB's origin countries (ISO 3166-1), for "Made in one of our countries" in
--     Pick. Filled when getTitle() refreshes a title; null until then.

create table public.free_evenings (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  couple_id uuid not null references public.couples (id) on delete cascade,
  -- The evening's date on the person's own clock.
  on_day date not null,
  free boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, on_day)
);

create index free_evenings_couple_day_idx on public.free_evenings (couple_id, on_day);

create trigger free_evenings_set_updated_at
before update on public.free_evenings
for each row execute function public.set_updated_at();

alter publication supabase_realtime add table public.free_evenings;

alter table public.free_evenings enable row level security;

revoke all on public.free_evenings from anon, authenticated;

grant select on public.free_evenings to authenticated;
grant insert (profile_id, couple_id, on_day, free) on public.free_evenings to authenticated;
grant update (free) on public.free_evenings to authenticated;

create policy "members read their free evenings"
on public.free_evenings for select
to authenticated
using (couple_id = (select public.my_couple_id()));

-- Only for this evening: a local date is within a day of the UTC date.
create policy "members say they're free"
on public.free_evenings for insert
to authenticated
with check (
  profile_id = (select auth.uid())
  and couple_id = (select public.my_couple_id())
  and on_day between (now() at time zone 'utc')::date - 1 and (now() at time zone 'utc')::date + 1
);

create policy "members change their own evening"
on public.free_evenings for update
to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

-- Origin countries ------------------------------------------------------------------------------------------

alter table public.titles
  add column origin_countries text[]
  check (origin_countries is null or '' <> all (origin_countries));
