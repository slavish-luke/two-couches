-- Sprint 21: list and notes.
--
--   * list_items.status gains 'someday': the Someday shelf, for titles you'd like one day but not soon. They
--     stay on the list (so For you and search know them) but out of Up next, Pick, the swipe deck, the
--     daily check's alerts and the Next episodes row until moved back.
--   * title_sends: one of you sends the other a title with a short note. Both members read them; you send
--     only as yourself, to your partner; only the person it was sent to answers it ('added' to Up next,
--     'shelved' on Someday, or 'waved' off), once. The sender can take back a send that hasn't been answered.
--     One open send per title per person.
--   * season_reviews: each person's short hidden review of a season of a series on the list, beside the
--     season stars. Like list_reviews: you read your own, and your partner's only once you've written yours
--     for the same season (has_reviewed_season()). season_review_signals say that one exists, without its
--     text, so "{name} has written theirs" arrives live (kept by sync_season_review_signal(); nobody writes
--     them).
--   * All three tables are in the supabase_realtime publication.

-- ---------------------------------------------------------------------------
-- The Someday shelf
-- ---------------------------------------------------------------------------

alter table public.list_items drop constraint list_items_status_check;
alter table public.list_items add constraint list_items_status_check
  check (status in ('want', 'watching', 'watched', 'dropped', 'someday'));

-- ---------------------------------------------------------------------------
-- Sending a title to your partner
-- ---------------------------------------------------------------------------

create table public.title_sends (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  from_profile uuid not null references public.profiles (id) on delete cascade,
  to_profile uuid not null references public.profiles (id) on delete cascade,
  media_type text not null,
  tmdb_id integer not null,
  note text not null default '' check (char_length(note) <= 200 and note = btrim(note)),
  -- null while waiting for an answer.
  answer text check (answer in ('added', 'shelved', 'waved')),
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  check (from_profile <> to_profile),
  check ((answer is null) = (answered_at is null)),
  -- Cached for both of you before it's sent, so the card can name it in either language.
  foreign key (media_type, tmdb_id) references public.titles (media_type, tmdb_id)
);

create index title_sends_couple_id_idx on public.title_sends (couple_id);
create index title_sends_to_profile_idx on public.title_sends (to_profile, created_at desc);
create unique index title_sends_one_open_idx on public.title_sends (to_profile, media_type, tmdb_id)
  where answer is null;

-- Stamps the times: a new send waits for an answer; an answer is given once and dated now.
create function public.check_title_send()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.answer := null;
    new.answered_at := null;
    return new;
  end if;
  if old.answer is not null then
    raise exception 'title_send_answered' using errcode = '23514', hint = 'A send is answered once.';
  end if;
  if new.answer is null then
    raise exception 'title_send_needs_answer' using errcode = '23514';
  end if;
  new.answered_at := now();
  return new;
end;
$$;

revoke execute on function public.check_title_send() from public, anon, authenticated;

create trigger title_sends_check
before insert or update on public.title_sends
for each row execute function public.check_title_send();

alter table public.title_sends enable row level security;
revoke all on public.title_sends from anon, authenticated;
grant select, delete on public.title_sends to authenticated;
grant insert (couple_id, from_profile, to_profile, media_type, tmdb_id, note) on public.title_sends to authenticated;
grant update (answer) on public.title_sends to authenticated;

create policy "members read their sends"
on public.title_sends for select
to authenticated
using (couple_id = (select public.my_couple_id()));

create policy "send your partner a title as yourself"
on public.title_sends for insert
to authenticated
with check (
  from_profile = (select auth.uid())
  and couple_id = (select public.my_couple_id())
  and exists (
    select 1 from public.profiles p
    where p.id = title_sends.to_profile and p.couple_id = (select public.my_couple_id())
  )
);

create policy "answer what was sent to you"
on public.title_sends for update
to authenticated
using (to_profile = (select auth.uid()))
with check (to_profile = (select auth.uid()));

create policy "take back a send that hasn't been answered"
on public.title_sends for delete
to authenticated
using (from_profile = (select auth.uid()) and answer is null);

-- ---------------------------------------------------------------------------
-- Hidden season reviews
-- ---------------------------------------------------------------------------

create table public.season_reviews (
  list_item_id uuid not null,
  -- Copied from the item so Realtime can filter by couple.
  couple_id uuid not null,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  season smallint not null check (season between 1 and 999),
  body text not null check (char_length(body) between 1 and 500 and body = btrim(body)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (list_item_id, profile_id, season),
  foreign key (list_item_id, couple_id) references public.list_items (id, couple_id) on delete cascade
);

create index season_reviews_couple_id_idx on public.season_reviews (couple_id);

create trigger season_reviews_set_updated_at
before update on public.season_reviews
for each row execute function public.set_updated_at();

-- Seasons only for series (Sprint 18's check, which reads new.list_item_id).
create trigger season_reviews_check_series
before insert on public.season_reviews
for each row execute function public.check_season_rating();

-- Whether the signed-in person has reviewed this season. Security definer, so the select policy can look
-- at the caller's own row without recursing.
create function public.has_reviewed_season(p_list_item_id uuid, p_season smallint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.season_reviews
    where list_item_id = p_list_item_id and season = p_season and profile_id = (select auth.uid())
  );
$$;

revoke execute on function public.has_reviewed_season(uuid, smallint) from public, anon;
grant execute on function public.has_reviewed_season(uuid, smallint) to authenticated;

alter table public.season_reviews enable row level security;
revoke all on public.season_reviews from anon, authenticated;
grant select, delete on public.season_reviews to authenticated;
grant insert (list_item_id, couple_id, profile_id, season, body) on public.season_reviews to authenticated;
grant update (body) on public.season_reviews to authenticated;

create policy "read your season review, and your partner's after yours"
on public.season_reviews for select
to authenticated
using (
  couple_id = (select public.my_couple_id())
  and (profile_id = (select auth.uid()) or public.has_reviewed_season(list_item_id, season))
);

create policy "review a season as yourself"
on public.season_reviews for insert
to authenticated
with check (profile_id = (select auth.uid()) and couple_id = (select public.my_couple_id()));

create policy "change your own season review"
on public.season_reviews for update
to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

create policy "delete your own season review"
on public.season_reviews for delete
to authenticated
using (profile_id = (select auth.uid()));

create table public.season_review_signals (
  list_item_id uuid not null,
  couple_id uuid not null,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  season smallint not null,
  -- When the review was written or last changed. Never the text.
  changed_at timestamptz not null default now(),
  primary key (list_item_id, profile_id, season),
  foreign key (list_item_id, couple_id) references public.list_items (id, couple_id) on delete cascade
);

create index season_review_signals_couple_id_idx on public.season_review_signals (couple_id);

-- Mirrors season_reviews. Security definer, since users can't write the signals themselves.
create function public.sync_season_review_signal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.season_review_signals
    where list_item_id = old.list_item_id and profile_id = old.profile_id and season = old.season;
    return old;
  end if;
  insert into public.season_review_signals (list_item_id, couple_id, profile_id, season, changed_at)
  values (new.list_item_id, new.couple_id, new.profile_id, new.season, now())
  on conflict (list_item_id, profile_id, season) do update set changed_at = excluded.changed_at;
  return new;
end;
$$;

revoke execute on function public.sync_season_review_signal() from public, anon, authenticated;

create trigger season_reviews_sync_signal
after insert or update or delete on public.season_reviews
for each row execute function public.sync_season_review_signal();

alter table public.season_review_signals enable row level security;
revoke all on public.season_review_signals from anon, authenticated;
grant select on public.season_review_signals to authenticated;

create policy "members read their season review signals"
on public.season_review_signals for select
to authenticated
using (couple_id = (select public.my_couple_id()));

alter publication supabase_realtime add table public.title_sends, public.season_reviews, public.season_review_signals;
