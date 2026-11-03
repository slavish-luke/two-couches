-- Phase 3, block 1: after the night (wrap-up and hidden reviews).
--
--   * list_reviews hold one short review per person per list item. Each person writes only their own. You
--     read your own, and your partner's only once you've written yours: until then you can tell that they
--     have written one (review_authors()), but not what it says.
--   * night_wrapups record that a person has dealt with the "How was it?" card for a watch night that's
--     over, either by saving it or with "Not now". Each person writes only their own; both members read
--     them, so the second person can see that the first has already moved a series on.
--   * Both are in the supabase_realtime publication. Realtime applies the same policies, so a partner's
--     review only arrives live once you've written your own.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.list_reviews (
  list_item_id uuid not null,
  -- Copied from the item so Realtime can filter by couple.
  couple_id uuid not null,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (list_item_id, profile_id),
  foreign key (list_item_id, couple_id) references public.list_items (id, couple_id) on delete cascade
);

create index list_reviews_couple_id_idx on public.list_reviews (couple_id);

create trigger list_reviews_set_updated_at
before update on public.list_reviews
for each row execute function public.set_updated_at();

create table public.night_wrapups (
  watch_night_id uuid not null,
  -- Copied from the night so Realtime can filter by couple.
  couple_id uuid not null,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  -- 'saved': marked watched, moved on, rated or reviewed from the card. 'skipped': "Not now".
  outcome text not null check (outcome in ('saved', 'skipped')),
  done_at timestamptz not null default now(),
  primary key (watch_night_id, profile_id),
  foreign key (watch_night_id, couple_id) references public.watch_nights (id, couple_id) on delete cascade
);

create index night_wrapups_couple_id_idx on public.night_wrapups (couple_id);

alter publication supabase_realtime add table public.list_reviews, public.night_wrapups;

-- ---------------------------------------------------------------------------
-- Helpers. Security definer, so the select policy can look at the caller's own row without recursing.
-- ---------------------------------------------------------------------------

-- Whether the signed-in person has written a review of this list item.
create function public.has_reviewed(p_list_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.list_reviews
    where list_item_id = p_list_item_id and profile_id = (select auth.uid())
  );
$$;

-- Who has written a review of each of these items (in the caller's couple), without the text.
create function public.review_authors(p_list_item_ids uuid[])
returns table (list_item_id uuid, profile_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select r.list_item_id, r.profile_id
  from public.list_reviews r
  where r.list_item_id = any (p_list_item_ids) and r.couple_id = (select public.my_couple_id());
$$;

revoke execute on function public.has_reviewed(uuid), public.review_authors(uuid[]) from public, anon;
grant execute on function public.has_reviewed(uuid), public.review_authors(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges and row-level security
-- ---------------------------------------------------------------------------

alter table public.list_reviews enable row level security;
alter table public.night_wrapups enable row level security;

revoke all on public.list_reviews, public.night_wrapups from anon, authenticated;

grant select, delete on public.list_reviews to authenticated;
grant insert (list_item_id, couple_id, profile_id, body) on public.list_reviews to authenticated;
grant update (body) on public.list_reviews to authenticated;

grant select, delete on public.night_wrapups to authenticated;
grant insert (watch_night_id, couple_id, profile_id, outcome) on public.night_wrapups to authenticated;

create policy "read your review, and your partner's once you've written yours"
on public.list_reviews for select
to authenticated
using (
  couple_id = (select public.my_couple_id())
  and (profile_id = (select auth.uid()) or public.has_reviewed(list_item_id))
);

create policy "review as yourself"
on public.list_reviews for insert
to authenticated
with check (profile_id = (select auth.uid()) and couple_id = (select public.my_couple_id()));

create policy "change your own review"
on public.list_reviews for update
to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

create policy "delete your own review"
on public.list_reviews for delete
to authenticated
using (profile_id = (select auth.uid()));

create policy "members read their wrap-ups"
on public.night_wrapups for select
to authenticated
using (couple_id = (select public.my_couple_id()));

create policy "wrap up as yourself"
on public.night_wrapups for insert
to authenticated
with check (profile_id = (select auth.uid()) and couple_id = (select public.my_couple_id()));

create policy "undo your own wrap-up"
on public.night_wrapups for delete
to authenticated
using (profile_id = (select auth.uid()));
