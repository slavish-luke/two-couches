-- Phase 3: calendar subscription.
--
--   * calendar_feeds hold one private feed link per person: a calendar app subscribes to
--     /calendar/<token>.ics and gets the couple's watch nights. Only the SHA-256 of the token is stored
--     (hex), so a database leak doesn't leak working links; the link is shown once, when it's made.
--   * Each person reads, makes and removes only their own row. Making a new link deletes the old row
--     first, which revokes the old link. No updates.
--   * Not in profiles, because partners can read each other's profiles.
--   * The feed route has no session: it looks the hash up with the secret key.

create table public.calendar_feeds (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

alter table public.calendar_feeds enable row level security;

revoke all on public.calendar_feeds from anon, authenticated;

grant select, delete on public.calendar_feeds to authenticated;
grant insert (profile_id, token_hash) on public.calendar_feeds to authenticated;

create policy "read own calendar feed"
on public.calendar_feeds for select
to authenticated
using (profile_id = (select auth.uid()));

create policy "make own calendar feed"
on public.calendar_feeds for insert
to authenticated
with check (profile_id = (select auth.uid()));

create policy "remove own calendar feed"
on public.calendar_feeds for delete
to authenticated
using (profile_id = (select auth.uid()));
