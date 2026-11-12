-- Sprint 15: planning nights.
--
--   * night_reminders record which reminder pushes (a day and an hour before) went out for each watch
--     night, so each kind is sent once. Moving a night clears its rows (a trigger), which re-arms them.
--     Server only, like availability_snapshots: no grants, no policies; the cron route uses the admin client.
--   * request_night_reminders() asks the app to send any that are due, every 15 minutes (pg_cron → pg_net →
--     POST /api/cron/night-reminders with the same Vault secrets as the daily check).
--   * night_proposals are two or three times one person suggests; the other picks one (which becomes the
--     watch night, planned by the proposer) or "none of these". Both members read them; the proposer adds
--     and withdraws them; answering goes only through answer_night_proposal(), so it happens once and the
--     night is made in the same step.
--   * night_prep_items are a shared checklist per watch night (snacks, subtitles sorted…). Both members read,
--     add, tick and remove them.
--   * Proposals and prep items are in the supabase_realtime publication, so both screens follow along.

-- ---------------------------------------------------------------------------
-- Reminders before a night
-- ---------------------------------------------------------------------------

create table public.night_reminders (
  watch_night_id uuid not null references public.watch_nights (id) on delete cascade,
  kind text not null check (kind in ('day', 'hour')),
  -- The start the reminder announced.
  starts_at timestamptz not null,
  sent_at timestamptz not null default now(),
  primary key (watch_night_id, kind)
);

alter table public.night_reminders enable row level security;
revoke all on public.night_reminders from anon, authenticated;

-- Runs as the owner: whoever moves the night re-arms both people's reminders, and API roles can't touch
-- night_reminders themselves.
create function public.rearm_night_reminders()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.starts_at is distinct from new.starts_at then
    delete from public.night_reminders where watch_night_id = new.id;
  end if;
  return new;
end;
$$;

revoke execute on function public.rearm_night_reminders() from public, anon, authenticated;

create trigger watch_nights_rearm_reminders
after update of starts_at on public.watch_nights
for each row execute function public.rearm_night_reminders();

-- Asks the app to send the reminders that are due. Returns pg_net's request ID, or null when Vault isn't
-- set up (see request_daily_check()).
create function public.request_night_reminders()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  app_url text;
  secret text;
begin
  select decrypted_secret into app_url from vault.decrypted_secrets where name = 'app_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'cron_secret';
  if app_url is null or secret is null then
    return null;
  end if;

  return net.http_post(
    url := rtrim(app_url, '/') || '/api/cron/night-reminders',
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret),
    timeout_milliseconds := 60000
  );
end;
$$;

revoke execute on function public.request_night_reminders() from public, anon, authenticated;

select cron.schedule('night-reminders', '*/15 * * * *', 'select public.request_night_reminders()');

-- ---------------------------------------------------------------------------
-- Proposals: two or three times to pick from
-- ---------------------------------------------------------------------------

-- No time twice in one proposal. A function, since a check can't use a subquery.
create function public.distinct_times(times timestamptz[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select count(distinct t) = cardinality(times) from unnest(times) as t;
$$;

create table public.night_proposals (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  proposed_by uuid not null references public.profiles (id) on delete cascade,
  -- What you'd watch, or both null to decide later.
  media_type text,
  tmdb_id integer,
  -- The times to pick from (UTC).
  times timestamptz[] not null check (
    cardinality(times) between 2 and 3 and array_position(times, null) is null and public.distinct_times(times)
  ),
  -- How you'd watch, as on watch_nights; the picked night gets all of it.
  method text check (method in ('here', 'teleparty', 'syncplay', 'other')),
  link text check (link like 'https://%' and char_length(link) <= 500),
  syncplay_server text check (char_length(syncplay_server) <= 100),
  syncplay_room text check (char_length(syncplay_room) <= 100),
  notes text not null default '' check (char_length(notes) <= 500),
  -- open: waiting for the partner; picked: one became a watch night; declined: none of these.
  status text not null default 'open' check (status in ('open', 'picked', 'declined')),
  -- Which of the times was picked (1-based).
  picked integer check (picked between 1 and 3),
  answered_by uuid references public.profiles (id) on delete set null,
  answered_at timestamptz,
  watch_night_id uuid references public.watch_nights (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((media_type is null) = (tmdb_id is null)),
  check ((status = 'open') = (answered_at is null)),
  check ((status = 'picked') = (picked is not null)),
  foreign key (media_type, tmdb_id) references public.titles (media_type, tmdb_id)
);

create index night_proposals_couple_id_idx on public.night_proposals (couple_id, created_at);

alter publication supabase_realtime add table public.night_proposals;

alter table public.night_proposals enable row level security;
revoke all on public.night_proposals from anon, authenticated;

grant select, delete on public.night_proposals to authenticated;
grant insert (couple_id, proposed_by, media_type, tmdb_id, times, method, link, syncplay_server, syncplay_room, notes)
on public.night_proposals to authenticated;

create policy "members read their proposals"
on public.night_proposals for select
to authenticated
using (couple_id = (select public.my_couple_id()));

create policy "members propose times"
on public.night_proposals for insert
to authenticated
with check (couple_id = (select public.my_couple_id()) and proposed_by = (select auth.uid()));

-- Withdrawing an open proposal, or putting away one that was answered.
create policy "the proposer removes their proposal"
on public.night_proposals for delete
to authenticated
using (proposed_by = (select auth.uid()));

-- The partner's answer: `choice` is which time (1-based), or null for none of these. Picking makes the
-- watch night, planned by the proposer. Outcomes: picked (with the night), declined, answered (someone
-- already did), passed (that time is over), own (you proposed it), gone (no such proposal for you).
create function public.answer_night_proposal(proposal_id uuid, choice integer, out outcome text, out watch_night_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  proposal public.night_proposals;
  start timestamptz;
begin
  select * into proposal from public.night_proposals where id = proposal_id for update;
  if proposal.id is null or proposal.couple_id is distinct from public.my_couple_id() then
    outcome := 'gone';
    return;
  end if;
  if proposal.proposed_by = (select auth.uid()) then
    outcome := 'own';
    return;
  end if;
  if proposal.status <> 'open' then
    outcome := 'answered';
    return;
  end if;

  if choice is null then
    update public.night_proposals
    set status = 'declined', answered_by = (select auth.uid()), answered_at = now()
    where id = proposal.id;
    outcome := 'declined';
    return;
  end if;

  if choice < 1 or choice > cardinality(proposal.times) then
    outcome := 'gone';
    return;
  end if;
  start := proposal.times[choice];
  -- A little leeway, as when planning a night that starts in a few minutes.
  if start < now() - interval '15 minutes' then
    outcome := 'passed';
    return;
  end if;

  insert into public.watch_nights (
    couple_id, media_type, tmdb_id, starts_at, method, link, syncplay_server, syncplay_room, notes, created_by
  ) values (
    proposal.couple_id, proposal.media_type, proposal.tmdb_id, start, proposal.method, proposal.link,
    proposal.syncplay_server, proposal.syncplay_room, proposal.notes, proposal.proposed_by
  )
  returning id into watch_night_id;

  update public.night_proposals
  set status = 'picked', picked = choice, answered_by = (select auth.uid()), answered_at = now(),
      watch_night_id = answer_night_proposal.watch_night_id
  where id = proposal.id;
  outcome := 'picked';
end;
$$;

revoke execute on function public.answer_night_proposal(uuid, integer) from public, anon;
grant execute on function public.answer_night_proposal(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Prep checklist per night
-- ---------------------------------------------------------------------------

create table public.night_prep_items (
  id uuid primary key default gen_random_uuid(),
  watch_night_id uuid not null,
  -- Copied from the night so Realtime can filter by couple.
  couple_id uuid not null,
  label text not null check (char_length(label) between 1 and 80 and label = btrim(label)),
  -- When it was ticked, and by whom; both null while it isn't.
  done_at timestamptz,
  done_by uuid references public.profiles (id) on delete set null,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (watch_night_id, couple_id) references public.watch_nights (id, couple_id) on delete cascade
);

-- Each thing once per night, whatever its capitals.
create unique index night_prep_items_label_idx on public.night_prep_items (watch_night_id, lower(label));
create index night_prep_items_couple_id_idx on public.night_prep_items (couple_id);

alter publication supabase_realtime add table public.night_prep_items;

alter table public.night_prep_items enable row level security;
revoke all on public.night_prep_items from anon, authenticated;

grant select, delete on public.night_prep_items to authenticated;
grant insert (watch_night_id, couple_id, label, added_by) on public.night_prep_items to authenticated;
grant update (done_at, done_by) on public.night_prep_items to authenticated;

create policy "members read their prep lists"
on public.night_prep_items for select
to authenticated
using (couple_id = (select public.my_couple_id()));

create policy "members add to their prep lists"
on public.night_prep_items for insert
to authenticated
with check (couple_id = (select public.my_couple_id()) and added_by = (select auth.uid()));

-- Either of you ticks or unticks anything; a tick is always in your own name.
create policy "members tick their prep lists"
on public.night_prep_items for update
to authenticated
using (couple_id = (select public.my_couple_id()))
with check (
  couple_id = (select public.my_couple_id())
  and ((done_at is null and done_by is null) or (done_at is not null and done_by = (select auth.uid())))
);

create policy "members remove from their prep lists"
on public.night_prep_items for delete
to authenticated
using (couple_id = (select public.my_couple_id()));
