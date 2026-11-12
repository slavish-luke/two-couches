-- RLS and rules for Sprint 16 (swipes, moods). Run with `npm run db:test`.
begin;
select plan(27);

-- Start from an empty slate so local sign-ins can't collide with the fixtures. Everything here is rolled
-- back at the end.
delete from public.couples;
delete from auth.users;

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

select ok(
  exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'swipes'),
  'swipes are published to Realtime'
);
select ok(
  exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'moods'),
  'moods are published to Realtime'
);

-- Act as A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

-- Swipes ------------------------------------------------------------------------------------------------

select lives_ok(
  $$ insert into public.swipes (couple_id, profile_id, day, media_type, tmdb_id, liked)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
             (now() at time zone 'utc')::date, 'movie', 603, true) $$,
  'A can say yes to a title in today''s deck'
);
select throws_ok(
  $$ insert into public.swipes (couple_id, profile_id, day, media_type, tmdb_id, liked)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
             (now() at time zone 'utc')::date, 'movie', 603, false) $$,
  '23505', null,
  'each person swipes a title once a day'
);
select lives_ok(
  $$ update public.swipes set liked = false
     where profile_id = '11111111-1111-1111-1111-111111111111' and tmdb_id = 603 $$,
  'A can change their mind'
);
select throws_ok(
  $$ insert into public.swipes (couple_id, profile_id, day, media_type, tmdb_id, liked)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222',
             (now() at time zone 'utc')::date, 'movie', 603, true) $$,
  '42501', null,
  'A cannot swipe for B'
);
select throws_ok(
  $$ insert into public.swipes (couple_id, profile_id, day, media_type, tmdb_id, liked)
     values ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111',
             (now() at time zone 'utc')::date, 'movie', 680, true) $$,
  '42501', null,
  'A cannot swipe in another couple'
);
select throws_ok(
  $$ insert into public.swipes (couple_id, profile_id, day, media_type, tmdb_id, liked)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
             (now() at time zone 'utc')::date - 5, 'movie', 680, true) $$,
  '42501', null,
  'a swipe is for today''s deck, not an old one'
);
select throws_ok(
  $$ insert into public.swipes (couple_id, profile_id, day, media_type, tmdb_id, liked)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
             (now() at time zone 'utc')::date, 'book', 680, true) $$,
  '23514', null,
  'a swipe is on a film or a series'
);
select throws_ok(
  $$ update public.swipes set couple_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
     where profile_id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null,
  'a swipe cannot move to another couple'
);
select throws_ok(
  $$ update public.swipes set tmdb_id = 680
     where profile_id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null,
  'what a swipe was on is fixed'
);
update public.swipes set liked = true where profile_id = '11111111-1111-1111-1111-111111111111';

-- Act as B.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select is((select count(*)::int from public.swipes), 1, 'B sees A''s swipe');
select lives_ok(
  $$ insert into public.swipes (couple_id, profile_id, day, media_type, tmdb_id, liked)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222',
             (now() at time zone 'utc')::date, 'movie', 603, true) $$,
  'B can say yes too'
);
select is(
  (select count(*)::int from public.swipes where tmdb_id = 603 and liked),
  2,
  'a title both said yes to is a match'
);
update public.swipes set liked = false where profile_id = '11111111-1111-1111-1111-111111111111';
delete from public.swipes where profile_id = '11111111-1111-1111-1111-111111111111';
select is(
  (select liked from public.swipes where profile_id = '11111111-1111-1111-1111-111111111111'),
  true,
  'B can neither change nor clear A''s swipe'
);

-- Moods -------------------------------------------------------------------------------------------------

select lives_ok(
  $$ insert into public.moods (profile_id, couple_id, mood, on_day)
     values ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cosy', current_date) $$,
  'B can say how they feel today'
);
select throws_ok(
  $$ insert into public.moods (profile_id, couple_id, mood, on_day)
     values ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'funny', current_date) $$,
  '23505', null,
  'each person has one mood at a time'
);
select throws_ok(
  $$ update public.moods set mood = 'grumpy' where profile_id = '22222222-2222-2222-2222-222222222222' $$,
  '23514', null,
  'a mood is one of the five'
);
select lives_ok(
  $$ update public.moods set mood = 'funny' where profile_id = '22222222-2222-2222-2222-222222222222' $$,
  'B can change their mood'
);
select throws_ok(
  $$ insert into public.moods (profile_id, couple_id, mood, on_day)
     values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'tired', current_date) $$,
  '42501', null,
  'B cannot set A''s mood'
);
select throws_ok(
  $$ update public.moods set couple_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
     where profile_id = '22222222-2222-2222-2222-222222222222' $$,
  '42501', null,
  'a mood cannot move to another couple'
);

-- Back to A.
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select is((select mood from public.moods), 'funny', 'A sees B''s mood');
update public.moods set mood = 'tired';
delete from public.moods;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select mood from public.moods), 'funny', 'A can neither change nor clear B''s mood');
select lives_ok($$ delete from public.moods $$, 'B can clear their mood');
select is((select count(*)::int from public.moods), 0, 'and it is gone');

-- Act as C, in another couple.
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is((select count(*)::int from public.swipes), 0, 'C cannot see another couple''s swipes');

-- Anonymous visitors see nothing.
reset role;
set local role anon;
select throws_ok($$ select count(*) from public.swipes $$, '42501', null, 'anonymous visitors cannot read swipes');

select * from finish();
rollback;
