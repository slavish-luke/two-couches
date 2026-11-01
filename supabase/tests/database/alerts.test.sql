-- RLS and rules for Sprint 4 (reminders, alerts, push_subscriptions, availability_snapshots, the daily
-- check). Run with `npm run db:test`.
begin;
select plan(26);

-- Start from an empty slate so local sign-ins and cached titles can't collide with the fixtures.
-- Everything here is rolled back at the end.
delete from public.alerts;
delete from public.reminders;
delete from public.list_items;
delete from public.couples;
delete from auth.users;
delete from public.titles;
delete from public.availability_snapshots;

insert into public.signup_allowlist (email) values ('third@example.com') on conflict do nothing;
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'one@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'two@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'third@example.com');
insert into public.titles (media_type, tmdb_id, original_title) values ('movie', 603, 'The Matrix'), ('tv', 1396, 'Breaking Bad');

-- A and B are a couple; C has a couple of their own.
insert into public.couples (id, invite_code) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'AAAAAAAA'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'CCCCCCCC');
update public.profiles set couple_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
update public.profiles set couple_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
where id = '33333333-3333-3333-3333-333333333333';

-- What only the daily check writes.
insert into public.alerts (couple_id, media_type, tmdb_id, kind, services) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'movie', 603, 'both', '{"11111111-1111-1111-1111-111111111111": ["Netflix"]}');
insert into public.availability_snapshots (media_type, tmdb_id, country, provider_ids) values ('movie', 603, 'GB', '{8}');

select ok(
  exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'reminders'),
  'reminder changes are published to Realtime'
);
select is(
  (select schedule from cron.job where jobname = 'daily-check'),
  '0 9 * * *',
  'the daily check is scheduled once a day'
);
select is(public.request_daily_check(), null, 'the daily check does nothing until Vault has its URL and secret');
select throws_ok(
  $$ insert into public.alerts (couple_id, media_type, tmdb_id, kind) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'movie', 603, 'soon') $$,
  '23514', null,
  'alert kinds are both or one'
);

-- Act as A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select lives_ok(
  $$ insert into public.reminders (couple_id, media_type, tmdb_id, created_by)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'movie', 603, '11111111-1111-1111-1111-111111111111') $$,
  'A can set a reminder for their couple'
);
select throws_ok(
  $$ insert into public.reminders (couple_id, media_type, tmdb_id, created_by)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'movie', 603, '11111111-1111-1111-1111-111111111111') $$,
  '23505', null,
  'a couple has at most one reminder per title'
);
select throws_ok(
  $$ insert into public.reminders (couple_id, media_type, tmdb_id, created_by)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'tv', 1396, '22222222-2222-2222-2222-222222222222') $$,
  '42501', null,
  'A cannot set a reminder in B''s name'
);
select throws_ok(
  $$ insert into public.reminders (couple_id, media_type, tmdb_id, created_by)
     values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'tv', 1396, '11111111-1111-1111-1111-111111111111') $$,
  '42501', null,
  'A cannot set a reminder for another couple'
);
select throws_ok(
  $$ insert into public.reminders (couple_id, media_type, tmdb_id, created_by)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'tv', 999999, '11111111-1111-1111-1111-111111111111') $$,
  '23503', null,
  'only cached titles can have reminders'
);
select throws_ok(
  $$ insert into public.alerts (couple_id, media_type, tmdb_id, kind) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'tv', 1396, 'both') $$,
  '42501', null,
  'members cannot write alerts'
);
select throws_ok(
  $$ select * from public.availability_snapshots $$,
  '42501', null,
  'members cannot read the daily check''s snapshots'
);
select throws_ok(
  $$ select public.request_daily_check() $$,
  '42501', null,
  'members cannot trigger the daily check'
);
select lives_ok(
  $$ insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth)
     values ('11111111-1111-1111-1111-111111111111', 'https://push.example.com/a', 'key', 'secret') $$,
  'A can save a push subscription for themselves'
);
select throws_ok(
  $$ insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth)
     values ('22222222-2222-2222-2222-222222222222', 'https://push.example.com/b', 'key', 'secret') $$,
  '42501', null,
  'A cannot save a push subscription for B'
);
select throws_ok(
  $$ insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth)
     values ('11111111-1111-1111-1111-111111111111', 'http://push.example.com/a', 'key', 'secret') $$,
  '23514', null,
  'push endpoints must be https'
);
select lives_ok(
  $$ update public.profiles set alerts_seen_at = now() where id = '11111111-1111-1111-1111-111111111111' $$,
  'A can mark their alerts seen'
);
select throws_ok(
  $$ update public.profiles set alerts_seen_at = now(), couple_id = null where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null,
  'marking alerts seen does not open up other columns'
);

-- Act as B.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select is((select count(*)::int from public.reminders), 1, 'B sees the reminder A set');
select is((select kind from public.alerts), 'both', 'B sees their couple''s alerts');
select is((select count(*)::int from public.push_subscriptions), 0, 'B cannot see A''s push subscriptions');
delete from public.push_subscriptions;

-- Act as C, in another couple.
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);

select is((select count(*)::int from public.reminders), 0, 'C cannot see another couple''s reminders');
select is((select count(*)::int from public.alerts), 0, 'C cannot see another couple''s alerts');
delete from public.reminders;

reset role;
select is((select count(*)::int from public.reminders), 1, 'C''s deletes do not reach another couple''s reminders');
select is((select count(*)::int from public.push_subscriptions), 1, 'B could not remove A''s push subscription');

-- Back as B: either member can clear a reminder.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
delete from public.reminders;
reset role;
select is((select count(*)::int from public.reminders), 0, 'B can clear a reminder A set');

-- Anonymous visitors.
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;
select throws_ok($$ select * from public.alerts $$, '42501', null, 'anonymous visitors cannot read alerts');

select * from finish();
rollback;
