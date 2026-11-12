-- Sprint 20: little things for two.
--
--   * nudges: a thinking-of-you tap (a heart, "starting soon", "ready when you are") from one of you to the
--     other. Both members read them; you send only as yourself, to your partner, at most once a minute
--     (check_nudge()); only the person it was sent to marks it seen. Kept 30 days.
--   * question_answers: each person's one-sentence answer to the day's question (the question is picked by
--     the app from the UTC date; its number is stored so history survives a reworded list). You read your
--     own, and your partner's only once you've answered that day's question too (has_answered()), like the
--     hidden reviews. question_signals say that an answer exists, without its text, so "{name} has
--     answered" arrives live (kept by the sync_question_signal() trigger; nobody writes them).
--   * comments: a short thread on a list item or a watch night (exactly one of the two). Both members read
--     and write; only the author deletes; no edits. comment_reactions: one sticker per person per comment.
--   * episode_reactions: each person's hidden sticker and optional one-line note per episode of a series on
--     the list, only for episodes the list's progress says you've watched. Your partner's shows only once
--     you've reacted to the same episode (has_reacted_episode()); episode_signals carry the reveal live.
--   * night_photos: a small photo album per watch night. The files live in the private storage bucket
--     `night-photos` at `<couple id>/<night id>/<photo id>.webp` (and `-thumb.webp`), resized in the browser
--     before upload. Storage policies keep each couple to its own folder; the uploader deletes their own;
--     a night's leftover files can be cleared by either of you once the night is gone. At most 30 photos a
--     night and 800 MB a couple (the free plan has 1 GB).
--   * Every table is in the supabase_realtime publication.

-- ---------------------------------------------------------------------------
-- Nudges
-- ---------------------------------------------------------------------------

create table public.nudges (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  from_profile uuid not null references public.profiles (id) on delete cascade,
  to_profile uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('heart', 'soon', 'ready')),
  sent_at timestamptz not null default now(),
  seen_at timestamptz,
  check (from_profile <> to_profile)
);

create index nudges_couple_id_idx on public.nudges (couple_id);
create index nudges_to_profile_idx on public.nudges (to_profile, sent_at desc);
create index nudges_from_profile_idx on public.nudges (from_profile, sent_at desc);

-- Stamps the time, keeps senders to one a minute and forgets nudges older than 30 days. Security definer,
-- so the clean-up can delete rows that members can't.
create function public.check_nudge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.sent_at := now();
  new.seen_at := null;
  if exists (
    select 1 from public.nudges
    where from_profile = new.from_profile and sent_at > now() - interval '1 minute'
  ) then
    raise exception 'nudge_too_soon' using errcode = '23514', hint = 'One nudge a minute.';
  end if;
  delete from public.nudges where couple_id = new.couple_id and sent_at < now() - interval '30 days';
  return new;
end;
$$;

revoke execute on function public.check_nudge() from public, anon, authenticated;

create trigger nudges_check
before insert on public.nudges
for each row execute function public.check_nudge();

alter table public.nudges enable row level security;
revoke all on public.nudges from anon, authenticated;
grant select on public.nudges to authenticated;
grant insert (couple_id, from_profile, to_profile, kind) on public.nudges to authenticated;
grant update (seen_at) on public.nudges to authenticated;

create policy "members read their nudges"
on public.nudges for select
to authenticated
using (couple_id = (select public.my_couple_id()));

create policy "nudge your partner as yourself"
on public.nudges for insert
to authenticated
with check (
  from_profile = (select auth.uid())
  and couple_id = (select public.my_couple_id())
  and exists (
    select 1 from public.profiles p
    where p.id = nudges.to_profile and p.couple_id = (select public.my_couple_id())
  )
);

create policy "mark nudges to you as seen"
on public.nudges for update
to authenticated
using (to_profile = (select auth.uid()))
with check (to_profile = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Tonight's question
-- ---------------------------------------------------------------------------

create table public.question_answers (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  couple_id uuid not null references public.couples (id) on delete cascade,
  -- The question's day (UTC) and its number in the app's list on that day.
  day date not null check (day >= '2026-01-01'),
  question smallint not null check (question between 0 and 999),
  body text not null check (char_length(body) between 1 and 300 and body = btrim(body)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, day)
);

create index question_answers_couple_day_idx on public.question_answers (couple_id, day);

create trigger question_answers_set_updated_at
before update on public.question_answers
for each row execute function public.set_updated_at();

-- Whether the signed-in person has answered this day's question. Security definer, so the select policy
-- can look at the caller's own row without recursing.
create function public.has_answered(p_day date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.question_answers where day = p_day and profile_id = (select auth.uid())
  );
$$;

revoke execute on function public.has_answered(date) from public, anon;
grant execute on function public.has_answered(date) to authenticated;

alter table public.question_answers enable row level security;
revoke all on public.question_answers from anon, authenticated;
grant select on public.question_answers to authenticated;
grant insert (profile_id, couple_id, day, question, body) on public.question_answers to authenticated;
grant update (body) on public.question_answers to authenticated;

create policy "read your answer, and your partner's once you've answered"
on public.question_answers for select
to authenticated
using (
  couple_id = (select public.my_couple_id())
  and (profile_id = (select auth.uid()) or public.has_answered(day))
);

-- Today's question or an earlier one, never a day still to come.
create policy "answer as yourself"
on public.question_answers for insert
to authenticated
with check (
  profile_id = (select auth.uid())
  and couple_id = (select public.my_couple_id())
  and day <= (now() at time zone 'utc')::date
);

create policy "change your own answer"
on public.question_answers for update
to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

create table public.question_signals (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  couple_id uuid not null references public.couples (id) on delete cascade,
  day date not null,
  changed_at timestamptz not null default now(),
  primary key (profile_id, day)
);

create index question_signals_couple_id_idx on public.question_signals (couple_id);

create function public.sync_question_signal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.question_signals where profile_id = old.profile_id and day = old.day;
    return old;
  end if;
  insert into public.question_signals (profile_id, couple_id, day, changed_at)
  values (new.profile_id, new.couple_id, new.day, now())
  on conflict (profile_id, day) do update set changed_at = excluded.changed_at, couple_id = excluded.couple_id;
  return new;
end;
$$;

revoke execute on function public.sync_question_signal() from public, anon, authenticated;

create trigger question_answers_sync_signal
after insert or update or delete on public.question_answers
for each row execute function public.sync_question_signal();

alter table public.question_signals enable row level security;
revoke all on public.question_signals from anon, authenticated;
grant select on public.question_signals to authenticated;

create policy "members read their question signals"
on public.question_signals for select
to authenticated
using (couple_id = (select public.my_couple_id()));

-- ---------------------------------------------------------------------------
-- Comments and their reactions
-- ---------------------------------------------------------------------------

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null,
  -- What it's about: one list item or one watch night.
  list_item_id uuid,
  watch_night_id uuid,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500 and body = btrim(body)),
  created_at timestamptz not null default now(),
  check (num_nonnulls(list_item_id, watch_night_id) = 1),
  unique (id, couple_id),
  foreign key (list_item_id, couple_id) references public.list_items (id, couple_id) on delete cascade,
  foreign key (watch_night_id, couple_id) references public.watch_nights (id, couple_id) on delete cascade
);

create index comments_couple_id_idx on public.comments (couple_id);
create index comments_list_item_idx on public.comments (list_item_id, created_at) where list_item_id is not null;
create index comments_watch_night_idx on public.comments (watch_night_id, created_at) where watch_night_id is not null;

create table public.comment_reactions (
  comment_id uuid not null,
  couple_id uuid not null,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('heart', 'laugh', 'gasp', 'cry', 'fire', 'popcorn')),
  created_at timestamptz not null default now(),
  primary key (comment_id, profile_id),
  foreign key (comment_id, couple_id) references public.comments (id, couple_id) on delete cascade
);

create index comment_reactions_couple_id_idx on public.comment_reactions (couple_id);

alter table public.comments enable row level security;
alter table public.comment_reactions enable row level security;
revoke all on public.comments, public.comment_reactions from anon, authenticated;

grant select, delete on public.comments to authenticated;
grant insert (id, couple_id, list_item_id, watch_night_id, profile_id, body) on public.comments to authenticated;

grant select, delete on public.comment_reactions to authenticated;
grant insert (comment_id, couple_id, profile_id, kind) on public.comment_reactions to authenticated;
grant update (kind) on public.comment_reactions to authenticated;

create policy "members read their comments"
on public.comments for select
to authenticated
using (couple_id = (select public.my_couple_id()));

create policy "comment as yourself"
on public.comments for insert
to authenticated
with check (profile_id = (select auth.uid()) and couple_id = (select public.my_couple_id()));

create policy "delete your own comments"
on public.comments for delete
to authenticated
using (profile_id = (select auth.uid()));

create policy "members read their comment reactions"
on public.comment_reactions for select
to authenticated
using (couple_id = (select public.my_couple_id()));

create policy "react as yourself"
on public.comment_reactions for insert
to authenticated
with check (profile_id = (select auth.uid()) and couple_id = (select public.my_couple_id()));

create policy "change your own reaction"
on public.comment_reactions for update
to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

create policy "take back your own reaction"
on public.comment_reactions for delete
to authenticated
using (profile_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Hidden episode reactions
-- ---------------------------------------------------------------------------

create table public.episode_reactions (
  list_item_id uuid not null,
  couple_id uuid not null,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  season smallint not null check (season between 1 and 999),
  episode smallint not null check (episode between 1 and 9999),
  kind text not null check (kind in ('heart', 'laugh', 'gasp', 'cry', 'fire', 'popcorn')),
  note text not null default '' check (char_length(note) <= 120 and note = btrim(note)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (list_item_id, profile_id, season, episode),
  foreign key (list_item_id, couple_id) references public.list_items (id, couple_id) on delete cascade
);

create index episode_reactions_couple_id_idx on public.episode_reactions (couple_id);

create trigger episode_reactions_set_updated_at
before update on public.episode_reactions
for each row execute function public.set_updated_at();

-- Whether the signed-in person has reacted to this episode. Security definer, like has_reviewed().
create function public.has_reacted_episode(p_list_item_id uuid, p_season smallint, p_episode smallint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.episode_reactions
    where list_item_id = p_list_item_id and season = p_season and episode = p_episode
      and profile_id = (select auth.uid())
  );
$$;

-- Whether the list's progress says this episode of a series has been watched: the series is marked
-- watched, or the episode is at or before the last one watched. Runs as the caller, so it sees only their
-- couple's list.
create function public.episode_watched(p_list_item_id uuid, p_season smallint, p_episode smallint)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.list_items i
    where i.id = p_list_item_id
      and i.media_type = 'tv'
      and (
        i.status = 'watched'
        or (i.season is not null and i.episode is not null
            and (p_season < i.season or (p_season = i.season and p_episode <= i.episode)))
      )
  );
$$;

revoke execute on function public.has_reacted_episode(uuid, smallint, smallint), public.episode_watched(uuid, smallint, smallint)
  from public, anon;
grant execute on function public.has_reacted_episode(uuid, smallint, smallint), public.episode_watched(uuid, smallint, smallint)
  to authenticated;

alter table public.episode_reactions enable row level security;
revoke all on public.episode_reactions from anon, authenticated;
grant select, delete on public.episode_reactions to authenticated;
grant insert (list_item_id, couple_id, profile_id, season, episode, kind, note) on public.episode_reactions to authenticated;
grant update (kind, note) on public.episode_reactions to authenticated;

create policy "read your episode reactions, and your partner's once you've reacted"
on public.episode_reactions for select
to authenticated
using (
  couple_id = (select public.my_couple_id())
  and (profile_id = (select auth.uid()) or public.has_reacted_episode(list_item_id, season, episode))
);

create policy "react to watched episodes as yourself"
on public.episode_reactions for insert
to authenticated
with check (
  profile_id = (select auth.uid())
  and couple_id = (select public.my_couple_id())
  and public.episode_watched(list_item_id, season, episode)
);

create policy "change your own episode reactions"
on public.episode_reactions for update
to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

create policy "take back your own episode reactions"
on public.episode_reactions for delete
to authenticated
using (profile_id = (select auth.uid()));

create table public.episode_signals (
  list_item_id uuid not null,
  couple_id uuid not null,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  season smallint not null,
  episode smallint not null,
  changed_at timestamptz not null default now(),
  primary key (list_item_id, profile_id, season, episode),
  foreign key (list_item_id, couple_id) references public.list_items (id, couple_id) on delete cascade
);

create index episode_signals_couple_id_idx on public.episode_signals (couple_id);

create function public.sync_episode_signal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.episode_signals
    where list_item_id = old.list_item_id and profile_id = old.profile_id
      and season = old.season and episode = old.episode;
    return old;
  end if;
  insert into public.episode_signals (list_item_id, couple_id, profile_id, season, episode, changed_at)
  values (new.list_item_id, new.couple_id, new.profile_id, new.season, new.episode, now())
  on conflict (list_item_id, profile_id, season, episode) do update set changed_at = excluded.changed_at;
  return new;
end;
$$;

revoke execute on function public.sync_episode_signal() from public, anon, authenticated;

create trigger episode_reactions_sync_signal
after insert or update or delete on public.episode_reactions
for each row execute function public.sync_episode_signal();

alter table public.episode_signals enable row level security;
revoke all on public.episode_signals from anon, authenticated;
grant select on public.episode_signals to authenticated;

create policy "members read their episode signals"
on public.episode_signals for select
to authenticated
using (couple_id = (select public.my_couple_id()));

-- ---------------------------------------------------------------------------
-- Photo albums
-- ---------------------------------------------------------------------------

create table public.night_photos (
  id uuid primary key,
  watch_night_id uuid not null,
  couple_id uuid not null,
  uploaded_by uuid not null references public.profiles (id) on delete cascade,
  -- Storage paths in the night-photos bucket.
  path text not null unique,
  thumb_path text not null unique,
  -- Both files together.
  bytes integer not null check (bytes between 1 and 4194304),
  width integer not null check (width between 1 and 4096),
  height integer not null check (height between 1 and 4096),
  created_at timestamptz not null default now(),
  foreign key (watch_night_id, couple_id) references public.watch_nights (id, couple_id) on delete cascade,
  check (path = couple_id::text || '/' || watch_night_id::text || '/' || id::text || '.webp'
         or path = couple_id::text || '/' || watch_night_id::text || '/' || id::text || '.jpg'),
  check (thumb_path = couple_id::text || '/' || watch_night_id::text || '/' || id::text || '-thumb.webp'
         or thumb_path = couple_id::text || '/' || watch_night_id::text || '/' || id::text || '-thumb.jpg')
);

create index night_photos_night_idx on public.night_photos (watch_night_id, created_at);
create index night_photos_couple_id_idx on public.night_photos (couple_id);

-- At most 30 photos a night and 800 MB a couple. Security definer, so it counts both people's photos.
create function public.check_night_photo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.created_at := now();
  if (select count(*) from public.night_photos where watch_night_id = new.watch_night_id) >= 30 then
    raise exception 'night_album_full' using errcode = '23514';
  end if;
  if (select coalesce(sum(bytes), 0) from public.night_photos where couple_id = new.couple_id) + new.bytes > 838860800 then
    raise exception 'photo_space_full' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_night_photo() from public, anon, authenticated;

create trigger night_photos_check
before insert on public.night_photos
for each row execute function public.check_night_photo();

alter table public.night_photos enable row level security;
revoke all on public.night_photos from anon, authenticated;
grant select, delete on public.night_photos to authenticated;
grant insert (id, watch_night_id, couple_id, uploaded_by, path, thumb_path, bytes, width, height)
  on public.night_photos to authenticated;

create policy "members read their photos"
on public.night_photos for select
to authenticated
using (couple_id = (select public.my_couple_id()));

-- Only for files you've uploaded to your own couple's folder.
create policy "add your own photos"
on public.night_photos for insert
to authenticated
with check (
  uploaded_by = (select auth.uid())
  and couple_id = (select public.my_couple_id())
  and exists (
    select 1 from storage.objects o
    where o.bucket_id = 'night-photos' and o.name = night_photos.path and o.owner_id = (select auth.uid())::text
  )
  and exists (
    select 1 from storage.objects o
    where o.bucket_id = 'night-photos' and o.name = night_photos.thumb_path and o.owner_id = (select auth.uid())::text
  )
);

create policy "delete your own photos"
on public.night_photos for delete
to authenticated
using (uploaded_by = (select auth.uid()));

-- The bucket: private, images only, 3 MB a file at most (a resized photo is far smaller).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('night-photos', 'night-photos', false, 3145728, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

-- Whether the signed-in person may upload this object: it goes in `<their couple>/<one of their couple's
-- nights>/`, and that folder has room (two files a photo). Security definer, so it counts every file.
create function public.can_add_night_photo(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (storage.foldername(p_name))[1] = (select public.my_couple_id())::text
    and array_length(storage.foldername(p_name), 1) = 2
    and exists (
      select 1 from public.watch_nights n
      where n.id::text = (storage.foldername(p_name))[2] and n.couple_id = (select public.my_couple_id())
    )
    and (
      select count(*) from storage.objects o
      where o.bucket_id = 'night-photos' and o.name like (storage.foldername(p_name))[1] || '/' || (storage.foldername(p_name))[2] || '/%'
    ) < 60;
$$;

-- Whether this object's night has gone (cancelled): then either of you may clear its leftover files.
create function public.night_photo_orphaned(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (storage.foldername(p_name))[1] = (select public.my_couple_id())::text
    and not exists (
      select 1 from public.watch_nights n where n.id::text = (storage.foldername(p_name))[2]
    );
$$;

revoke execute on function public.can_add_night_photo(text), public.night_photo_orphaned(text) from public, anon;
grant execute on function public.can_add_night_photo(text), public.night_photo_orphaned(text) to authenticated;

create policy "night photos: members read their couple's"
on storage.objects for select
to authenticated
using (
  bucket_id = 'night-photos'
  and (storage.foldername(name))[1] = (select public.my_couple_id())::text
);

create policy "night photos: upload to your couple's nights"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'night-photos'
  and owner_id = (select auth.uid())::text
  and public.can_add_night_photo(name)
);

create policy "night photos: delete your own, or a cancelled night's"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'night-photos'
  and (storage.foldername(name))[1] = (select public.my_couple_id())::text
  and (owner_id = (select auth.uid())::text or public.night_photo_orphaned(name))
);

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table
  public.nudges,
  public.question_answers,
  public.question_signals,
  public.comments,
  public.comment_reactions,
  public.episode_reactions,
  public.episode_signals,
  public.night_photos;
