-- RLS and rules for Sprint 17 (rating_guesses). Run with `npm run db:test`.
begin;
select plan(17);

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
  ('movie', 603, 'The Matrix'), ('movie', 604, 'The Matrix Reloaded'), ('tv', 1396, 'Breaking Bad');

-- A and B are a couple; C has a couple of their own.
insert into public.couples (id, invite_code) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'AAAAAAAA'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'CCCCCCCC');
update public.profiles set couple_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
update public.profiles set couple_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
where id = '33333333-3333-3333-3333-333333333333';

-- A and B have two watched films (B rated both, A the first) and a series nobody rated; C has the film too, rated.
insert into public.list_items (id, couple_id, media_type, tmdb_id, added_by, status) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'movie', 603,
   '11111111-1111-1111-1111-111111111111', 'watched'),
  ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'movie', 604,
   '11111111-1111-1111-1111-111111111111', 'watched'),
  ('a0000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'tv', 1396,
   '22222222-2222-2222-2222-222222222222', 'watched'),
  ('c0000000-0000-0000-0000-000000000001', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'movie', 603,
   '33333333-3333-3333-3333-333333333333', 'watched');
insert into public.list_ratings (list_item_id, couple_id, profile_id, rating) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 4),
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 5),
  ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 2),
  ('c0000000-0000-0000-0000-000000000001', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', 5);

select ok(
  exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'rating_guesses'),
  'guesses are published to Realtime'
);

-- Act as A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select lives_ok(
  $$ insert into public.rating_guesses (list_item_id, couple_id, profile_id, guess)
     values ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '11111111-1111-1111-1111-111111111111', 3) $$,
  'A can guess B''s rating'
);
select is(
  (select actual from public.rating_guesses where list_item_id = 'a0000000-0000-0000-0000-000000000001'),
  4::smallint,
  'the guess keeps B''s rating at the time'
);
select throws_ok(
  $$ insert into public.rating_guesses (list_item_id, couple_id, profile_id, guess)
     values ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '11111111-1111-1111-1111-111111111111', 4) $$,
  '23505', null,
  'one guess per person per title'
);
select lives_ok(
  $$ insert into public.rating_guesses (list_item_id, couple_id, profile_id, guess)
     values ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '11111111-1111-1111-1111-111111111111', null) $$,
  'A can skip the guess ("Just show me")'
);
select throws_ok(
  $$ insert into public.rating_guesses (list_item_id, couple_id, profile_id, guess)
     values ('a0000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '11111111-1111-1111-1111-111111111111', 3) $$,
  '23514', null,
  'there is nothing to guess before B has rated it'
);
select throws_ok(
  $$ insert into public.rating_guesses (list_item_id, couple_id, profile_id, guess, actual)
     values ('a0000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '11111111-1111-1111-1111-111111111111', 3, 3) $$,
  '42501', null,
  'A cannot set the real rating themselves'
);
select throws_ok(
  $$ insert into public.rating_guesses (list_item_id, couple_id, profile_id, guess)
     values ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '22222222-2222-2222-2222-222222222222', 3) $$,
  '42501', null,
  'A cannot guess as B'
);
select throws_ok(
  $$ insert into public.rating_guesses (list_item_id, couple_id, profile_id, guess)
     values ('c0000000-0000-0000-0000-000000000001', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
             '11111111-1111-1111-1111-111111111111', 5) $$,
  '23514', null,
  'A cannot guess on another couple''s title (their ratings are invisible)'
);
select throws_ok(
  $$ insert into public.rating_guesses (list_item_id, couple_id, profile_id, guess)
     values ('a0000000-0000-0000-0000-000000000002', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
             '11111111-1111-1111-1111-111111111111', 2) $$,
  '42501', null,
  'a guess cannot be filed under another couple'
);
select throws_ok(
  $$ update public.rating_guesses set guess = 4 where profile_id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null,
  'a guess cannot be changed'
);
select throws_ok(
  $$ delete from public.rating_guesses where profile_id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null,
  'a guess cannot be taken back'
);

-- Act as B: changing the rating afterwards leaves the guess's score alone.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
update public.list_ratings set rating = 1 where list_item_id = 'a0000000-0000-0000-0000-000000000001';

select is((select count(*)::int from public.rating_guesses), 2, 'B reads A''s guesses');
select is(
  (select actual from public.rating_guesses where list_item_id = 'a0000000-0000-0000-0000-000000000001'),
  4::smallint,
  'a guess is scored against the rating A was shown'
);

-- Act as C.
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is((select count(*)::int from public.rating_guesses), 0, 'C reads none of A and B''s guesses');

-- Back as A: removing the title from the list takes its guesses with it.
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
delete from public.list_items where id = 'a0000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.rating_guesses), 1, 'guesses go with their list item');

reset role;
select is(
  (select count(*)::int from public.rating_guesses where couple_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  0,
  'no guess ever landed with another couple'
);

select * from finish();
rollback;
