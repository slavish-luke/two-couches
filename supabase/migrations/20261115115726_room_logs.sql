-- The watch room's sync log (2026-11-15, after a night where the picture kept skipping and the server logs
-- couldn't say why: Realtime doesn't log broadcast messages).
--
--   * Each screen in the room keeps a log of what its sync did and why: ticks followed or skipped, speed
--     changes, jumps, waits, stalls, dropped frames, reconnections, the measured delay. Every 30 seconds it
--     sends the new entries as one row here, so both sides of a night can be read afterwards.
--   * Only what the players did is logged: positions, timings, the file's name and size. Never chat text.
--   * Both members read their couple's logs; each adds and removes only their own. Nobody edits a row.
--   * The browser inserts directly (RLS applies), so a Server Action queue never delays the room.

create table public.room_logs (
  id uuid primary key default gen_random_uuid(),
  watch_night_id uuid not null,
  couple_id uuid not null,
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- One per page load, so a reload starts a new run of parts.
  session text not null check (char_length(session) between 1 and 40),
  part integer not null check (part >= 0),
  entries jsonb not null check (jsonb_typeof(entries) = 'array' and octet_length(entries::text) <= 262144),
  created_at timestamptz not null default now(),
  unique (profile_id, session, part),
  foreign key (watch_night_id, couple_id) references public.watch_nights (id, couple_id) on delete cascade
);

create index room_logs_night_idx on public.room_logs (watch_night_id, created_at);
create index room_logs_couple_id_idx on public.room_logs (couple_id);

alter table public.room_logs enable row level security;
revoke all on public.room_logs from anon, authenticated;

grant select, delete on public.room_logs to authenticated;
grant insert (watch_night_id, couple_id, profile_id, session, part, entries) on public.room_logs to authenticated;

create policy "members read their room logs"
on public.room_logs for select
to authenticated
using (couple_id = (select public.my_couple_id()));

create policy "members add their own room logs"
on public.room_logs for insert
to authenticated
with check (couple_id = (select public.my_couple_id()) and profile_id = (select auth.uid()));

create policy "members remove their own room logs"
on public.room_logs for delete
to authenticated
using (couple_id = (select public.my_couple_id()) and profile_id = (select auth.uid()));
