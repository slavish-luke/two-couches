-- Sprint 19: alerts and discovery.
--
--   * alerts gain two kinds: 'free' (a title you're waiting for became free, or free with ads, in one of
--     your countries) and 'gone' (a list title one of you could stream on a service you pay for has left
--     it). `details` says, per profile ID, which country and which providers the alert is about
--     ({"<id>": {"country": "GB", "providers": [{"id": 8, "name": "Netflix"}], "ads": false}}), so the
--     "gone" badge can tell while a title stays gone. Still written only by the daily check.
--   * availability_snapshots also keep the free and free-with-ads providers (`free_ids`), so the daily
--     check can tell when a title turns free. Null means the row was recorded before this sprint: the
--     check then takes today's free providers as the baseline instead of alerting about all of them.
--   * cant_wait holds each person's "Can't wait" on a title (Coming soon). Both members read them; each
--     person adds and clears only their own. When both of you can't wait, the app sets the couple's
--     reminder (as the second person, through the existing reminders policies). In Realtime.
--   * warn_keywords are each person's "Warn me about" list: TMDB keywords (ID and English name). Both
--     members read them (the title page warns you about your partner's too); each person adds and removes
--     only their own, at most 30.

-- ---------------------------------------------------------------------------
-- Alerts and snapshots
-- ---------------------------------------------------------------------------

alter table public.alerts drop constraint alerts_kind_check;
alter table public.alerts add constraint alerts_kind_check check (kind in ('both', 'one', 'free', 'gone'));
alter table public.alerts
  add column details jsonb check (details is null or jsonb_typeof(details) = 'object');

create index alerts_gone_idx on public.alerts (couple_id, media_type, tmdb_id) where kind = 'gone';

alter table public.availability_snapshots add column free_ids integer[];

-- ---------------------------------------------------------------------------
-- Can't wait
-- ---------------------------------------------------------------------------

create table public.cant_wait (
  couple_id uuid not null references public.couples (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  media_type text not null check (media_type in ('movie', 'tv')),
  tmdb_id integer not null check (tmdb_id > 0),
  created_at timestamptz not null default now(),
  primary key (profile_id, media_type, tmdb_id)
);

create index cant_wait_couple_id_idx on public.cant_wait (couple_id);

alter publication supabase_realtime add table public.cant_wait;

-- ---------------------------------------------------------------------------
-- Warn me about
-- ---------------------------------------------------------------------------

create table public.warn_keywords (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  couple_id uuid not null references public.couples (id) on delete cascade,
  keyword_id integer not null check (keyword_id > 0),
  name text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now(),
  primary key (profile_id, keyword_id)
);

create index warn_keywords_couple_id_idx on public.warn_keywords (couple_id);

-- At most 30 per person. A lock per person, so two adds at once can't both slip past the count.
create function public.limit_warn_keywords()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('warn_keywords:' || new.profile_id::text));
  if (select count(*) from public.warn_keywords where profile_id = new.profile_id) >= 30 then
    raise exception 'at most 30 keywords to warn about' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger warn_keywords_limit
before insert on public.warn_keywords
for each row execute function public.limit_warn_keywords();

-- ---------------------------------------------------------------------------
-- Privileges and row-level security
-- ---------------------------------------------------------------------------

alter table public.cant_wait enable row level security;
alter table public.warn_keywords enable row level security;

revoke all on public.cant_wait from anon, authenticated;
revoke all on public.warn_keywords from anon, authenticated;

grant select, delete on public.cant_wait to authenticated;
grant insert (couple_id, profile_id, media_type, tmdb_id) on public.cant_wait to authenticated;

grant select, delete on public.warn_keywords to authenticated;
grant insert (profile_id, couple_id, keyword_id, name) on public.warn_keywords to authenticated;

create policy "members read their couple's can't waits"
on public.cant_wait for select
to authenticated
using (couple_id = (select public.my_couple_id()));

create policy "members add their own can't wait"
on public.cant_wait for insert
to authenticated
with check (profile_id = (select auth.uid()) and couple_id = (select public.my_couple_id()));

create policy "members clear their own can't wait"
on public.cant_wait for delete
to authenticated
using (profile_id = (select auth.uid()));

create policy "members read their couple's warnings"
on public.warn_keywords for select
to authenticated
using (couple_id = (select public.my_couple_id()));

create policy "members add their own warnings"
on public.warn_keywords for insert
to authenticated
with check (profile_id = (select auth.uid()) and couple_id = (select public.my_couple_id()));

create policy "members remove their own warnings"
on public.warn_keywords for delete
to authenticated
using (profile_id = (select auth.uid()));
