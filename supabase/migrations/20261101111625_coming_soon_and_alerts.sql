-- Sprint 4: reminders, alerts, push subscriptions and the daily availability check.
--
-- Access model:
--   * reminders ("tell us when it's streaming") belong to a couple. Both members read, set and clear them.
--     Only the daily check (server, secret key) retires them.
--   * alerts are written only by the daily check. Both members read their couple's alerts; each person's
--     profiles.alerts_seen_at marks what they've seen.
--   * push_subscriptions are one row per person per device. Each person reads, adds and removes only their
--     own; the daily check reads them with the secret key to send notifications.
--   * availability_snapshots hold what the daily check last saw for each watched title, so it can tell
--     when something arrives. Server only: no policies.
--   * pg_cron calls the app's /api/cron/daily once a day through pg_net. The app URL and shared secret
--     live in Vault (names 'app_url' and 'cron_secret'), added by hand on each project; without them the
--     job does nothing.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  media_type text not null,
  tmdb_id integer not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (couple_id, media_type, tmdb_id),
  foreign key (media_type, tmdb_id) references public.titles (media_type, tmdb_id)
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  media_type text not null,
  tmdb_id integer not null,
  -- 'both': each of you can now stream it. 'one': one of you can.
  kind text not null check (kind in ('both', 'one')),
  -- The services each person can stream it on, by profile ID, e.g. {"<id>": ["Netflix"]}.
  services jsonb not null default '{}' check (jsonb_typeof(services) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (media_type, tmdb_id) references public.titles (media_type, tmdb_id)
);

create index alerts_couple_id_created_at_idx on public.alerts (couple_id, created_at desc);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null check (endpoint like 'https://%' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now(),
  unique (profile_id, endpoint)
);

create table public.availability_snapshots (
  media_type text not null,
  tmdb_id integer not null,
  country text not null,
  -- Subscription (flatrate) providers only: the only kind that counts towards "who can watch it".
  provider_ids integer[] not null default '{}',
  recorded_at timestamptz not null default now(),
  primary key (media_type, tmdb_id, country)
);

alter table public.profiles add column alerts_seen_at timestamptz not null default now();

alter publication supabase_realtime add table public.reminders;

-- ---------------------------------------------------------------------------
-- Privileges and row-level security
-- ---------------------------------------------------------------------------

alter table public.reminders enable row level security;
alter table public.alerts enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.availability_snapshots enable row level security;

revoke all on public.reminders, public.alerts, public.push_subscriptions, public.availability_snapshots
from anon, authenticated;

grant select, delete on public.reminders to authenticated;
grant insert (couple_id, media_type, tmdb_id, created_by) on public.reminders to authenticated;
grant select on public.alerts to authenticated;
grant select, delete on public.push_subscriptions to authenticated;
grant insert (profile_id, endpoint, p256dh, auth) on public.push_subscriptions to authenticated;
grant update (alerts_seen_at) on public.profiles to authenticated;

create policy "members read their reminders"
on public.reminders for select
to authenticated
using (couple_id = (select public.my_couple_id()));

create policy "members set reminders"
on public.reminders for insert
to authenticated
with check (couple_id = (select public.my_couple_id()) and created_by = (select auth.uid()));

create policy "members clear reminders"
on public.reminders for delete
to authenticated
using (couple_id = (select public.my_couple_id()));

create policy "members read their alerts"
on public.alerts for select
to authenticated
using (couple_id = (select public.my_couple_id()));

create policy "read own push subscriptions"
on public.push_subscriptions for select
to authenticated
using (profile_id = (select auth.uid()));

create policy "add own push subscriptions"
on public.push_subscriptions for insert
to authenticated
with check (profile_id = (select auth.uid()));

create policy "remove own push subscriptions"
on public.push_subscriptions for delete
to authenticated
using (profile_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- The daily check
-- ---------------------------------------------------------------------------

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

-- Asks the app to run its daily check. Returns pg_net's request ID, or null when Vault isn't set up.
create function public.request_daily_check()
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
    raise notice 'Daily check skipped: add app_url and cron_secret to Vault';
    return null;
  end if;

  return net.http_post(
    url := rtrim(app_url, '/') || '/api/cron/daily',
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret),
    -- pg_net waits in the background, so a long timeout blocks nothing.
    timeout_milliseconds := 300000
  );
end;
$$;

revoke execute on function public.request_daily_check() from public, anon, authenticated;

-- 09:00 UTC.
select cron.schedule('daily-check', '0 9 * * *', 'select public.request_daily_check()');
