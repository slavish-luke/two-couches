-- RLS and rules for Sprint 18 (rewatches, rewatch_ratings, season_ratings). Run with `npm run db:test`.
begin;
select plan(31);

-- Start from an empty slate so local sign-ins and cached titles can't collide with the fixtures.
-- Everything here is rolled back at the end.
delete from public.list_items;
delete from public.couples;
delete from auth.users;
delete from public.titles;

insert into public.signup_allowlist (email) values ('third@example.com') on conflict do nothing;
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'one@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'two@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'third@example.com');
insert into public.titles (media_type, tmdb_id, original_title) values
  ('movie', 603, 'The Matrix'), ('tv', 1396, 'Breaking Bad');

-- A and B are a couple; C has a couple of their own.
insert into public.couples (id, invite_code) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'AAAAAAAA'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'CCCCCCCC');
update public.profiles set couple_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
update public.profiles set couple_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
where id = '33333333-3333-3333-3333-333333333333';

-- A and B have a watched film and a series; C has the film too, with a rewatch of their own.
insert into public.list_items (id, couple_id, media_type, tmdb_id, added_by, status, watched_on) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'movie', 603,
   '11111111-1111-1111-1111-111111111111', 'watched', '2025-01-04'),
  ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'tv', 1396,
   '22222222-2222-2222-2222-222222222222', 'watching', null),
  ('c0000000-0000-0000-0000-000000000001', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'movie', 603,
   '33333333-3333-3333-3333-333333333333', 'watched', '2025-02-01');
insert into public.rewatches (id, list_item_id, couple_id, watched_on, added_by) values
  ('c1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'cccccccc-cccc-cccc-cccc-cccccccccccc', '2026-01-01', '33333333-3333-3333-3333-333333333333');

select ok(
  (select count(*) = 3 from pg_publication_tables
   where pubname = 'supabase_realtime' and tablename in ('rewatches', 'rewatch_ratings', 'season_ratings')),
  'rewatches and both kinds of rating are published to Realtime'
);

-- Act as A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select lives_ok(
  $$ insert into public.rewatches (list_item_id, couple_id, watched_on, added_by)
     values ('a0000000-0000-0000-0000-000000000001',
             'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-03-12', '11111111-1111-1111-1111-111111111111') $$,
  'A can log a rewatch'
);
-- Ids are the database's to choose: remember this one for the rest of the test.
select set_config('test.rewatch', (select id::text from public.rewatches where watched_on = '2026-03-12'), true);
select throws_ok(
  $$ insert into public.rewatches (list_item_id, couple_id, watched_on, added_by)
     values ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-03-13',
             '22222222-2222-2222-2222-222222222222') $$,
  '42501', null,
  'A cannot log a rewatch as B'
);
select throws_ok(
  $$ insert into public.rewatches (list_item_id, couple_id, watched_on, added_by)
     values ('c0000000-0000-0000-0000-000000000001', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2026-03-13',
             '11111111-1111-1111-1111-111111111111') $$,
  '42501', null,
  'A cannot log a rewatch of another couple''s title'
);
select throws_ok(
  $$ insert into public.rewatches (list_item_id, couple_id, watched_on, added_by)
     values ('c0000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-03-13',
             '11111111-1111-1111-1111-111111111111') $$,
  '23503', null,
  'a rewatch cannot point at another couple''s title under A''s couple'
);
select is((select count(*)::int from public.rewatches), 1, 'A sees only their own couple''s rewatches');

select lives_ok(
  $$ insert into public.rewatch_ratings (rewatch_id, couple_id, profile_id, rating)
     values (current_setting('test.rewatch')::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '11111111-1111-1111-1111-111111111111', 4) $$,
  'A can rate the rewatch'
);
select throws_ok(
  $$ insert into public.rewatch_ratings (rewatch_id, couple_id, profile_id, rating)
     values (current_setting('test.rewatch')::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '22222222-2222-2222-2222-222222222222', 2) $$,
  '42501', null,
  'A cannot rate the rewatch as B'
);
select throws_ok(
  $$ insert into public.rewatch_ratings (rewatch_id, couple_id, profile_id, rating)
     values (current_setting('test.rewatch')::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '11111111-1111-1111-1111-111111111111', 6) $$,
  '23514', null,
  'ratings are 1 to 5'
);

select lives_ok(
  $$ insert into public.season_ratings (list_item_id, couple_id, profile_id, season, rating)
     values ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '11111111-1111-1111-1111-111111111111', 1, 5) $$,
  'A can rate a season of the series'
);
select throws_ok(
  $$ insert into public.season_ratings (list_item_id, couple_id, profile_id, season, rating)
     values ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '11111111-1111-1111-1111-111111111111', 1, 3) $$,
  '23505', null,
  'one rating per person per season'
);
select throws_ok(
  $$ insert into public.season_ratings (list_item_id, couple_id, profile_id, season, rating)
     values ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '11111111-1111-1111-1111-111111111111', 1, 5) $$,
  '23514', null,
  'a film has no seasons to rate'
);
select throws_ok(
  $$ insert into public.season_ratings (list_item_id, couple_id, profile_id, season, rating)
     values ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '22222222-2222-2222-2222-222222222222', 2, 5) $$,
  '42501', null,
  'A cannot rate a season as B'
);
select throws_ok(
  $$ insert into public.season_ratings (list_item_id, couple_id, profile_id, season, rating)
     values ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '11111111-1111-1111-1111-111111111111', 0, 5) $$,
  '23514', null,
  'seasons start at 1'
);

-- Act as B.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select is((select count(*)::int from public.rewatches), 1, 'B reads the rewatch A logged');
select is((select count(*)::int from public.rewatch_ratings), 1, 'B reads A''s rating of it');
select is((select count(*)::int from public.season_ratings), 1, 'B reads A''s season rating');
select lives_ok(
  $$ insert into public.rewatch_ratings (rewatch_id, couple_id, profile_id, rating)
     values (current_setting('test.rewatch')::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '22222222-2222-2222-2222-222222222222', 3) $$,
  'B rates the same rewatch'
);
update public.rewatch_ratings set rating = 1 where profile_id = '11111111-1111-1111-1111-111111111111';
update public.season_ratings set rating = 1 where profile_id = '11111111-1111-1111-1111-111111111111';
delete from public.season_ratings where profile_id = '11111111-1111-1111-1111-111111111111';
select is(
  (select rating from public.rewatch_ratings where profile_id = '11111111-1111-1111-1111-111111111111'),
  4::smallint,
  'B cannot change A''s rewatch rating'
);
select is(
  (select rating from public.season_ratings where profile_id = '11111111-1111-1111-1111-111111111111'),
  5::smallint,
  'B can neither change nor clear A''s season rating'
);
select lives_ok(
  $$ update public.rewatches set watched_on = '2026-03-14' where id = current_setting('test.rewatch')::uuid $$,
  'B can re-date the rewatch'
);
select throws_ok(
  $$ update public.rewatches set added_by = '22222222-2222-2222-2222-222222222222' $$,
  '42501', null,
  'who logged a rewatch is fixed'
);
select throws_ok(
  $$ update public.rewatches set list_item_id = 'a0000000-0000-0000-0000-000000000002' $$,
  '42501', null,
  'a rewatch stays with its title'
);
select throws_ok(
  $$ update public.season_ratings set season = 2 $$,
  '42501', null,
  'a season rating stays with its season'
);

-- Act as C.
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is((select count(*)::int from public.rewatches), 1, 'C sees only their own rewatch');
select is((select count(*)::int from public.rewatch_ratings) + (select count(*)::int from public.season_ratings), 0,
  'C reads none of A and B''s ratings');
delete from public.rewatches where list_item_id = 'a0000000-0000-0000-0000-000000000001';
update public.rewatches set watched_on = '2000-01-01' where list_item_id = 'a0000000-0000-0000-0000-000000000001';

-- Back as A: removing a rewatch takes its ratings; removing the title takes everything.
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select is(
  (select watched_on from public.rewatches where id = current_setting('test.rewatch')::uuid),
  '2026-03-14'::date,
  'C could neither remove nor re-date A and B''s rewatch'
);
delete from public.rewatches where id = current_setting('test.rewatch')::uuid;
select is((select count(*)::int from public.rewatch_ratings), 0, 'ratings go with their rewatch');
insert into public.season_ratings (list_item_id, couple_id, profile_id, season, rating)
values ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '11111111-1111-1111-1111-111111111111', 2, 4);
delete from public.list_items where id = 'a0000000-0000-0000-0000-000000000002';
select is((select count(*)::int from public.season_ratings), 0, 'season ratings go with their list item');

reset role;
select is(
  (select count(*)::int from public.rewatches where couple_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  1,
  'C''s own rewatch is untouched'
);
select is(
  (select count(*)::int from public.rewatches where couple_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0,
  'A and B have no rewatches left'
);

select * from finish();
rollback;
