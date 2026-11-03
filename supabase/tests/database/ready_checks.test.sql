-- RLS and rules for Phase 2 (ready_checks). Run with `npm run db:test`.
begin;
select plan(22);

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
insert into public.titles (media_type, tmdb_id, original_title) values ('movie', 603, 'The Matrix'), ('tv', 1396, 'Breaking Bad');

-- A and B are a couple; C has a couple of their own.
insert into public.couples (id, invite_code) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'AAAAAAAA'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'CCCCCCCC');
update public.profiles set couple_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
update public.profiles set couple_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
where id = '33333333-3333-3333-3333-333333333333';

-- A night for each couple.
insert into public.watch_nights (id, couple_id, media_type, tmdb_id, starts_at, method, created_by) values
  ('a1a1a1a1-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'movie', 603,
   '2030-01-05 09:00+00', 'syncplay', '11111111-1111-1111-1111-111111111111'),
  ('c1c1c1c1-0000-0000-0000-000000000000', 'cccccccc-cccc-cccc-cccc-cccccccccccc', null, null,
   '2030-01-05 09:00+00', null, '33333333-3333-3333-3333-333333333333');

select ok(
  exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'ready_checks'),
  'ready checks are published to Realtime'
);

-- Act as A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select lives_ok(
  $$ insert into public.ready_checks (watch_night_id, couple_id, profile_id, ready_at, file_label, file_seconds)
     values ('a1a1a1a1-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '11111111-1111-1111-1111-111111111111', now(), '1080p, extended cut', 8170) $$,
  'A can say they are ready, with their file'
);
select throws_ok(
  $$ insert into public.ready_checks (watch_night_id, couple_id, profile_id, ready_at)
     values ('a1a1a1a1-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '11111111-1111-1111-1111-111111111111', now()) $$,
  '23505', null,
  'each person has one ready check per night'
);
select throws_ok(
  $$ insert into public.ready_checks (watch_night_id, couple_id, profile_id, ready_at)
     values ('a1a1a1a1-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '22222222-2222-2222-2222-222222222222', now()) $$,
  '42501', null,
  'A cannot say B is ready'
);
select throws_ok(
  $$ insert into public.ready_checks (watch_night_id, couple_id, profile_id, ready_at)
     values ('c1c1c1c1-0000-0000-0000-000000000000', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
             '11111111-1111-1111-1111-111111111111', now()) $$,
  '42501', null,
  'A cannot add a ready check to another couple''s night'
);
select throws_ok(
  $$ insert into public.ready_checks (watch_night_id, couple_id, profile_id, ready_at)
     values ('c1c1c1c1-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '11111111-1111-1111-1111-111111111111', now()) $$,
  '23503', null,
  'a ready check''s couple must be its night''s couple'
);
select throws_ok(
  $$ update public.ready_checks set file_label = 'https://files.example.com/film.mkv'
     where profile_id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null,
  'a file label cannot be a link'
);
select throws_ok(
  $$ update public.ready_checks set file_label = 'magnet:?xt=urn:btih:abc'
     where profile_id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null,
  'a file label cannot be a magnet link'
);
select throws_ok(
  $$ update public.ready_checks set file_seconds = 0
     where profile_id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null,
  'a file length is at least a second'
);
select throws_ok(
  $$ update public.ready_checks set couple_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
     where profile_id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null,
  'a ready check cannot move to another couple'
);
select throws_ok(
  $$ update public.ready_checks set profile_id = '22222222-2222-2222-2222-222222222222'
     where profile_id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null,
  'whose ready check it is is fixed'
);

-- Act as B.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select is((select count(*)::int from public.ready_checks), 1, 'B sees that A is ready');
select lives_ok(
  $$ insert into public.ready_checks (watch_night_id, couple_id, profile_id, file_label, file_seconds)
     values ('a1a1a1a1-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '22222222-2222-2222-2222-222222222222', '1080p', 8169) $$,
  'B can add their file before they are ready'
);
update public.ready_checks set ready_at = null, file_label = 'changed by B'
where profile_id = '11111111-1111-1111-1111-111111111111';
delete from public.ready_checks where profile_id = '11111111-1111-1111-1111-111111111111';
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select is(
  (select file_label from public.ready_checks where profile_id = '11111111-1111-1111-1111-111111111111'),
  '1080p, extended cut',
  'B can neither change nor clear A''s ready check'
);
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

-- Changing how you'll watch clears both ready ticks, but not the files.
update public.ready_checks set ready_at = now() where profile_id = '22222222-2222-2222-2222-222222222222';
select is((select count(*)::int from public.ready_checks where ready_at is not null), 2, 'both are ready');
update public.watch_nights set method = 'teleparty' where id = 'a1a1a1a1-0000-0000-0000-000000000000';
select is((select count(*)::int from public.ready_checks where ready_at is not null), 0, 'a new method clears both ready ticks');
select is((select count(*)::int from public.ready_checks where file_seconds is not null), 2, 'but keeps the files');

-- Moving the night or editing the note keeps everything.
update public.ready_checks set ready_at = now() where profile_id = '22222222-2222-2222-2222-222222222222';
update public.watch_nights set starts_at = '2030-01-06 09:00+00', notes = 'snacks'
where id = 'a1a1a1a1-0000-0000-0000-000000000000';
select is((select count(*)::int from public.ready_checks where ready_at is not null), 1, 'moving the night keeps who is ready');

-- A different title is a different file: both checks go.
update public.watch_nights set media_type = 'tv', tmdb_id = 1396 where id = 'a1a1a1a1-0000-0000-0000-000000000000';
select is((select count(*)::int from public.ready_checks), 0, 'a new title clears both ready checks');

-- Act as C, in another couple.
insert into public.ready_checks (watch_night_id, couple_id, profile_id, ready_at)
values ('a1a1a1a1-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '22222222-2222-2222-2222-222222222222', now());
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);

select is((select count(*)::int from public.ready_checks), 0, 'C cannot see another couple''s ready checks');

-- Cancelling the night takes its ready checks with it.
reset role;
delete from public.watch_nights where id = 'a1a1a1a1-0000-0000-0000-000000000000';
select is((select count(*)::int from public.ready_checks), 0, 'cancelling a night removes its ready checks');
select is(
  (select count(*)::int from information_schema.role_routine_grants
   where routine_name = 'reset_ready_checks' and grantee in ('anon', 'authenticated')),
  0,
  'API roles cannot call the reset function'
);

select * from finish();
rollback;
