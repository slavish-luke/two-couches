-- RLS and rules for the watch room's sync log (room_logs). Run with `npm run db:test`.
begin;
select plan(11);

-- Start from an empty slate so local sign-ins can't collide with the fixtures. Rolled back at the end.
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

-- A and B are a couple; C has a couple of their own.
insert into public.couples (id, invite_code) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'AAAAAAAA'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'CCCCCCCC');
update public.profiles set couple_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
update public.profiles set couple_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
where id = '33333333-3333-3333-3333-333333333333';

insert into public.watch_nights (id, couple_id, starts_at, method, created_by) values
  ('a1a1a1a1-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2030-01-05 09:00+00', 'here',
   '11111111-1111-1111-1111-111111111111'),
  ('c1c1c1c1-0000-0000-0000-000000000000', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2030-01-05 09:00+00', 'here',
   '33333333-3333-3333-3333-333333333333');

-- Act as A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select lives_ok(
  $$ insert into public.room_logs (watch_night_id, couple_id, session, part, entries)
     values ('a1a1a1a1-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 's1', 0,
             '[{"t": 1, "k": "open"}]') $$,
  'A can add a part of their log (profile defaults to A)'
);
select is(
  (select profile_id from public.room_logs where session = 's1'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'the row is in A''s name'
);
select throws_ok(
  $$ insert into public.room_logs (watch_night_id, couple_id, session, part, entries)
     values ('a1a1a1a1-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 's1', 0, '[]') $$,
  '23505', null,
  'each part of a session is sent once'
);
select throws_ok(
  $$ insert into public.room_logs (watch_night_id, couple_id, profile_id, session, part, entries)
     values ('a1a1a1a1-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '22222222-2222-2222-2222-222222222222', 's2', 0, '[]') $$,
  '42501', null,
  'A cannot add a log in B''s name'
);
select throws_ok(
  $$ insert into public.room_logs (watch_night_id, couple_id, session, part, entries)
     values ('c1c1c1c1-0000-0000-0000-000000000000', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 's3', 0, '[]') $$,
  '42501', null,
  'A cannot log against another couple''s night'
);
select throws_ok(
  $$ insert into public.room_logs (watch_night_id, couple_id, session, part, entries)
     values ('c1c1c1c1-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 's4', 0, '[]') $$,
  '23503', null,
  'a log''s couple must be its night''s couple'
);
select throws_ok(
  $$ insert into public.room_logs (watch_night_id, couple_id, session, part, entries)
     values ('a1a1a1a1-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 's5', 0, '{"t": 1}') $$,
  '23514', null,
  'entries must be a list'
);
select throws_ok(
  $$ update public.room_logs set part = 9 where session = 's1' $$,
  '42501', null,
  'nobody edits a log'
);

-- B reads A's log but cannot remove it.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.room_logs), 1, 'B reads the couple''s logs');
delete from public.room_logs where session = 's1';
select is((select count(*)::int from public.room_logs), 1, 'B cannot remove A''s log');

-- C sees nothing of A and B's.
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is((select count(*)::int from public.room_logs), 0, 'C cannot read another couple''s logs');

select * from finish();
rollback;
