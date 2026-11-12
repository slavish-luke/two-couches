-- RLS and rules for Sprint 15 (night_reminders, night_proposals, night_prep_items). Run with `npm run db:test`.
begin;
select plan(49);

-- Start from an empty slate so local sign-ins and cached titles can't collide with the fixtures.
-- Everything here is rolled back at the end.
delete from public.watch_nights;
delete from public.list_items;
delete from public.couples;
delete from auth.users;
delete from public.titles;

insert into public.signup_allowlist (email) values ('third@example.com') on conflict do nothing;
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'one@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'two@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'third@example.com');
insert into public.titles (media_type, tmdb_id, original_title) values ('movie', 603, 'The Matrix');

-- A and B are a couple; C has a couple of their own.
insert into public.couples (id, invite_code) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'AAAAAAAA'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'CCCCCCCC');
update public.profiles set couple_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
update public.profiles set couple_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
where id = '33333333-3333-3333-3333-333333333333';

insert into public.watch_nights (id, couple_id, media_type, tmdb_id, starts_at, created_by) values
  ('a1a1a1a1-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'movie', 603,
   now() + interval '2 days', '11111111-1111-1111-1111-111111111111'),
  ('c1c1c1c1-0000-0000-0000-000000000000', 'cccccccc-cccc-cccc-cccc-cccccccccccc', null, null,
   now() + interval '2 days', '33333333-3333-3333-3333-333333333333');

-- ---------------------------------------------------------------------------
-- Reminders
-- ---------------------------------------------------------------------------

select ok(
  exists (select 1 from cron.job where jobname = 'night-reminders' and schedule = '*/15 * * * *'),
  'the reminder job runs every 15 minutes'
);
select is(public.request_night_reminders(), null::bigint, 'without Vault secrets the reminder job does nothing');

insert into public.night_reminders (watch_night_id, kind, starts_at)
select id, 'day', starts_at from public.watch_nights where id = 'a1a1a1a1-0000-0000-0000-000000000000';
select throws_ok(
  $$ insert into public.night_reminders (watch_night_id, kind, starts_at)
     select id, 'day', starts_at from public.watch_nights where id = 'a1a1a1a1-0000-0000-0000-000000000000' $$,
  '23505', null,
  'each kind of reminder is recorded once per night'
);
select throws_ok(
  $$ insert into public.night_reminders (watch_night_id, kind, starts_at)
     values ('a1a1a1a1-0000-0000-0000-000000000000', 'week', now()) $$,
  '23514', null,
  'reminders are a day or an hour before'
);
update public.watch_nights set notes = 'popcorn' where id = 'a1a1a1a1-0000-0000-0000-000000000000';
select is((select count(*)::int from public.night_reminders), 1, 'editing the note keeps the reminders sent');

-- Act as A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select throws_ok(
  $$ select * from public.night_reminders $$,
  '42501', null,
  'members cannot read the reminder log'
);
select throws_ok(
  $$ insert into public.night_reminders (watch_night_id, kind, starts_at)
     values ('a1a1a1a1-0000-0000-0000-000000000000', 'hour', now()) $$,
  '42501', null,
  'members cannot write the reminder log'
);
select throws_ok($$ select public.request_night_reminders() $$, '42501', null, 'members cannot call the reminder job');

-- Moving the night re-arms its reminders, even though A can't touch the log.
update public.watch_nights set starts_at = starts_at + interval '1 hour' where id = 'a1a1a1a1-0000-0000-0000-000000000000';
reset role;
select is((select count(*)::int from public.night_reminders), 0, 'moving the night clears its reminders');

-- Cancelling a night takes its reminders with it.
insert into public.night_reminders (watch_night_id, kind, starts_at)
values ('c1c1c1c1-0000-0000-0000-000000000000', 'hour', now());
delete from public.watch_nights where id = 'c1c1c1c1-0000-0000-0000-000000000000';
select is((select count(*)::int from public.night_reminders), 0, 'cancelling a night removes its reminders');
insert into public.watch_nights (id, couple_id, starts_at, created_by) values
  ('c1c1c1c1-0000-0000-0000-000000000000', 'cccccccc-cccc-cccc-cccc-cccccccccccc', now() + interval '2 days',
   '33333333-3333-3333-3333-333333333333');

-- ---------------------------------------------------------------------------
-- Proposals
-- ---------------------------------------------------------------------------

select ok(
  exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'night_proposals'),
  'proposals are published to Realtime'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select lives_ok(
  $$ insert into public.night_proposals (couple_id, proposed_by, media_type, tmdb_id, times, method, notes)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'movie', 603,
             array[now() + interval '1 day', now() + interval '2 days', now() + interval '3 days'], 'syncplay', 'snacks') $$,
  'A can propose three times'
);
select lives_ok(
  $$ insert into public.night_proposals (couple_id, proposed_by, times, notes)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
             array[now() + interval '1 day', now() + interval '1 day 1 hour'], 'later') $$,
  'A can propose two times with the title left for later'
);
-- Fixed IDs for the rest of the test (the API can't choose one).
reset role;
update public.night_proposals set id = 'b0b0b0b0-0000-0000-0000-000000000001' where notes = 'snacks';
update public.night_proposals set id = 'b0b0b0b0-0000-0000-0000-000000000002' where notes = 'later';
set local role authenticated;
select throws_ok(
  $$ insert into public.night_proposals (couple_id, proposed_by, times)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', array[now() + interval '1 day']) $$,
  '23514', null,
  'a proposal has at least two times'
);
select throws_ok(
  $$ insert into public.night_proposals (couple_id, proposed_by, times)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
             array[now() + interval '1 day', now() + interval '2 days', now() + interval '3 days', now() + interval '4 days']) $$,
  '23514', null,
  'a proposal has at most three times'
);
select throws_ok(
  $$ insert into public.night_proposals (couple_id, proposed_by, times)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
             array['2030-01-01 20:00+00'::timestamptz, '2030-01-01 20:00+00']) $$,
  '23514', null,
  'a proposal has no time twice'
);
select throws_ok(
  $$ insert into public.night_proposals (couple_id, proposed_by, times)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222',
             array[now() + interval '1 day', now() + interval '2 days']) $$,
  '42501', null,
  'A cannot propose in B''s name'
);
select throws_ok(
  $$ insert into public.night_proposals (couple_id, proposed_by, times)
     values ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111',
             array[now() + interval '1 day', now() + interval '2 days']) $$,
  '42501', null,
  'A cannot propose to another couple'
);
select throws_ok(
  $$ insert into public.night_proposals (couple_id, proposed_by, times, status)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
             array[now() + interval '1 day', now() + interval '2 days'], 'picked') $$,
  '42501', null,
  'a proposal starts open'
);
select throws_ok(
  $$ update public.night_proposals set status = 'declined' $$,
  '42501', null,
  'proposals are answered only through answer_night_proposal()'
);
select is(
  (select outcome from public.answer_night_proposal('b0b0b0b0-0000-0000-0000-000000000001', 1)),
  'own',
  'A cannot answer their own proposal'
);

-- Act as C, in another couple.
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is((select count(*)::int from public.night_proposals), 0, 'C cannot see another couple''s proposals');
select is(
  (select outcome from public.answer_night_proposal('b0b0b0b0-0000-0000-0000-000000000001', 1)),
  'gone',
  'C cannot answer another couple''s proposal'
);
delete from public.night_proposals;

-- Act as B.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.night_proposals), 2, 'B sees A''s proposals, and C removed nothing');
delete from public.night_proposals;
select is((select count(*)::int from public.night_proposals), 2, 'B cannot withdraw A''s proposals');
select is(
  (select outcome from public.answer_night_proposal('b0b0b0b0-0000-0000-0000-000000000001', 4)),
  'gone',
  'B must pick one of the times'
);

create temporary table answer on commit drop as
select * from public.answer_night_proposal('b0b0b0b0-0000-0000-0000-000000000001', 2);
select is((select outcome from answer), 'picked', 'B picks the second time');
select is(
  (select row(starts_at > now() + interval '1 day 23 hours', created_by, method, notes, media_type, tmdb_id)::text
   from public.watch_nights where id = (select watch_night_id from answer)),
  row(true, '11111111-1111-1111-1111-111111111111'::uuid, 'syncplay', 'snacks', 'movie', 603)::text,
  'the picked time becomes a night planned by A, with the proposal''s details'
);
select is(
  (select row(status, picked, answered_by, watch_night_id)::text from public.night_proposals
   where id = 'b0b0b0b0-0000-0000-0000-000000000001'),
  (select row('picked', 2, '22222222-2222-2222-2222-222222222222'::uuid, watch_night_id)::text from answer),
  'the proposal records the answer and the night'
);
select is(
  (select outcome from public.answer_night_proposal('b0b0b0b0-0000-0000-0000-000000000001', 1)),
  'answered',
  'a proposal is answered once'
);
select is(
  (select outcome from public.answer_night_proposal('b0b0b0b0-0000-0000-0000-000000000002', null)),
  'declined',
  'B can say none of these'
);
select is(
  (select count(*)::int from public.watch_nights where couple_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  2,
  'saying none of these makes no night'
);

-- A time that has passed can't be picked.
reset role;
insert into public.night_proposals (id, couple_id, proposed_by, times) values
  ('b0b0b0b0-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
   array[now() - interval '1 hour', now() + interval '1 day']);
set local role authenticated;
select is(
  (select outcome from public.answer_night_proposal('b0b0b0b0-0000-0000-0000-000000000003', 1)),
  'passed',
  'a time that has passed cannot be picked'
);

-- Act as A: put away the answered proposals.
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
delete from public.night_proposals where status <> 'open';
select is((select count(*)::int from public.night_proposals), 1, 'A can put away their answered proposals');

-- ---------------------------------------------------------------------------
-- Prep checklist
-- ---------------------------------------------------------------------------

select ok(
  exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'night_prep_items'),
  'prep items are published to Realtime'
);
select lives_ok(
  $$ insert into public.night_prep_items (watch_night_id, couple_id, label, added_by)
     values ('a1a1a1a1-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Snacks', '11111111-1111-1111-1111-111111111111') $$,
  'A can add to a night''s prep list'
);
select throws_ok(
  $$ insert into public.night_prep_items (watch_night_id, couple_id, label, added_by)
     values ('a1a1a1a1-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'snacks',
             '11111111-1111-1111-1111-111111111111') $$,
  '23505', null,
  'each thing is on a night''s list once'
);
select throws_ok(
  $$ insert into public.night_prep_items (watch_night_id, couple_id, label, added_by)
     values ('a1a1a1a1-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '',
             '11111111-1111-1111-1111-111111111111') $$,
  '23514', null,
  'a prep item has a label'
);
select throws_ok(
  $$ insert into public.night_prep_items (watch_night_id, couple_id, label, added_by)
     values ('a1a1a1a1-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Tea',
             '22222222-2222-2222-2222-222222222222') $$,
  '42501', null,
  'A cannot add in B''s name'
);
select throws_ok(
  $$ insert into public.night_prep_items (watch_night_id, couple_id, label, added_by)
     values ('c1c1c1c1-0000-0000-0000-000000000000', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Tea',
             '11111111-1111-1111-1111-111111111111') $$,
  '42501', null,
  'A cannot add to another couple''s night'
);
select throws_ok(
  $$ insert into public.night_prep_items (watch_night_id, couple_id, label, added_by)
     values ('c1c1c1c1-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Tea',
             '11111111-1111-1111-1111-111111111111') $$,
  '23503', null,
  'a prep item''s couple must be its night''s couple'
);

-- Act as B.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select throws_ok(
  $$ update public.night_prep_items set done_at = now(), done_by = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null,
  'B cannot tick in A''s name'
);
select lives_ok(
  $$ update public.night_prep_items set done_at = now(), done_by = '22222222-2222-2222-2222-222222222222' $$,
  'B can tick A''s item'
);
select throws_ok(
  $$ update public.night_prep_items set label = 'Popcorn' $$,
  '42501', null,
  'a prep item''s label is fixed'
);
select lives_ok(
  $$ update public.night_prep_items set done_at = null, done_by = null $$,
  'B can untick it'
);

-- Act as C.
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is((select count(*)::int from public.night_prep_items), 0, 'C cannot see another couple''s prep lists');
delete from public.night_prep_items;

-- Act as B.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.night_prep_items), 1, 'C cannot remove another couple''s prep items');
delete from public.night_prep_items;
select is((select count(*)::int from public.night_prep_items), 0, 'B can remove an item A added');

-- Cancelling a night takes its prep list with it.
reset role;
insert into public.night_prep_items (watch_night_id, couple_id, label, added_by)
values ('a1a1a1a1-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Tea', '11111111-1111-1111-1111-111111111111');
delete from public.watch_nights where id = 'a1a1a1a1-0000-0000-0000-000000000000';
select is((select count(*)::int from public.night_prep_items), 0, 'cancelling a night removes its prep list');

select * from finish();
rollback;
