-- RLS and rules for Sprint 21 (the Someday status, title_sends, season_reviews, season_review_signals).
-- Run with `npm run db:test`.
begin;
select plan(40);

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
  ('movie', 603, 'The Matrix'), ('tv', 1396, 'Breaking Bad'), ('movie', 550, 'Fight Club');

-- A and B are a couple; C has a couple of their own.
insert into public.couples (id, invite_code) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'AAAAAAAA'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'CCCCCCCC');
update public.profiles set couple_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
update public.profiles set couple_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
where id = '33333333-3333-3333-3333-333333333333';

-- A and B have a film and a series; C has the series too.
insert into public.list_items (id, couple_id, media_type, tmdb_id, added_by, status) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'movie', 603,
   '11111111-1111-1111-1111-111111111111', 'want'),
  ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'tv', 1396,
   '22222222-2222-2222-2222-222222222222', 'watching'),
  ('c0000000-0000-0000-0000-000000000002', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'tv', 1396,
   '33333333-3333-3333-3333-333333333333', 'watching');

select ok(
  (select count(*) = 3 from pg_publication_tables
   where pubname = 'supabase_realtime' and tablename in ('title_sends', 'season_reviews', 'season_review_signals')),
  'sends, season reviews and their signals are published to Realtime'
);

-- Act as A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

-- ---------------------------------------------------------------------------
-- Someday
-- ---------------------------------------------------------------------------

select lives_ok(
  $$ update public.list_items set status = 'someday' where id = 'a0000000-0000-0000-0000-000000000001' $$,
  'A can put a title on the Someday shelf'
);
select is(
  (select status from public.list_items where id = 'a0000000-0000-0000-0000-000000000001'), 'someday',
  'the title is on the shelf'
);
select throws_ok(
  $$ update public.list_items set status = 'one day' where id = 'a0000000-0000-0000-0000-000000000001' $$,
  '23514', null,
  'other statuses are still refused'
);

-- ---------------------------------------------------------------------------
-- Sending a title
-- ---------------------------------------------------------------------------

select lives_ok(
  $$ insert into public.title_sends (couple_id, from_profile, to_profile, media_type, tmdb_id, note)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
             '22222222-2222-2222-2222-222222222222', 'movie', 550, 'You''d love this one') $$,
  'A can send B a title'
);
select set_config('test.send', (select id::text from public.title_sends where tmdb_id = 550), true);
select throws_ok(
  $$ insert into public.title_sends (couple_id, from_profile, to_profile, media_type, tmdb_id)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
             '22222222-2222-2222-2222-222222222222', 'movie', 550) $$,
  '23505', null,
  'one open send per title per person'
);
select throws_ok(
  $$ insert into public.title_sends (couple_id, from_profile, to_profile, media_type, tmdb_id)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222',
             '11111111-1111-1111-1111-111111111111', 'movie', 603) $$,
  '42501', null,
  'A cannot send as B'
);
select throws_ok(
  $$ insert into public.title_sends (couple_id, from_profile, to_profile, media_type, tmdb_id)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
             '33333333-3333-3333-3333-333333333333', 'movie', 603) $$,
  '42501', null,
  'A cannot send to someone outside the couple'
);
select throws_ok(
  $$ insert into public.title_sends (couple_id, from_profile, to_profile, media_type, tmdb_id)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
             '11111111-1111-1111-1111-111111111111', 'movie', 603) $$,
  '23514', null,
  'A cannot send to themselves'
);
select throws_ok(
  $$ insert into public.title_sends (couple_id, from_profile, to_profile, media_type, tmdb_id, note)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
             '22222222-2222-2222-2222-222222222222', 'movie', 603, repeat('x', 201)) $$,
  '23514', null,
  'a note is at most 200 characters'
);
select throws_ok(
  $$ insert into public.title_sends (couple_id, from_profile, to_profile, media_type, tmdb_id, answer)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
             '22222222-2222-2222-2222-222222222222', 'movie', 603, 'added') $$,
  '42501', null,
  'a send cannot arrive already answered'
);

-- The sender can't answer their own send.
update public.title_sends set answer = 'added' where id = current_setting('test.send')::uuid;
select is(
  (select answer from public.title_sends where id = current_setting('test.send')::uuid), null,
  'A cannot answer a send to B'
);

-- C sees nothing of it and can't answer or take it back.
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is((select count(*)::int from public.title_sends), 0, 'C cannot see A and B''s sends');
update public.title_sends set answer = 'waved' where id = current_setting('test.send')::uuid;
delete from public.title_sends where id = current_setting('test.send')::uuid;

-- B reads and answers it, once.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is(
  (select note from public.title_sends where id = current_setting('test.send')::uuid), 'You''d love this one',
  'B reads the send and its note'
);
select is(
  (select answer from public.title_sends where id = current_setting('test.send')::uuid), null,
  'C could neither answer nor remove it'
);
delete from public.title_sends where id = current_setting('test.send')::uuid;
select is(
  (select count(*)::int from public.title_sends where id = current_setting('test.send')::uuid), 1,
  'only the sender can take a send back'
);
select lives_ok(
  $$ update public.title_sends set answer = 'shelved' where id = current_setting('test.send')::uuid $$,
  'B can answer it'
);
select ok(
  (select answered_at is not null from public.title_sends where id = current_setting('test.send')::uuid),
  'the answer is dated'
);
select throws_ok(
  $$ update public.title_sends set answer = 'added' where id = current_setting('test.send')::uuid $$,
  '23514', null,
  'a send is answered once'
);
select throws_ok(
  $$ update public.title_sends set note = 'changed' where id = current_setting('test.send')::uuid $$,
  '42501', null,
  'nobody changes the note'
);

-- Once answered, the same title can be sent again; an answered send can't be taken back.
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select lives_ok(
  $$ insert into public.title_sends (couple_id, from_profile, to_profile, media_type, tmdb_id)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
             '22222222-2222-2222-2222-222222222222', 'movie', 550) $$,
  'A can send it again once B has answered'
);
delete from public.title_sends where id = current_setting('test.send')::uuid;
select is(
  (select count(*)::int from public.title_sends where id = current_setting('test.send')::uuid), 1,
  'an answered send stays'
);
delete from public.title_sends where tmdb_id = 550 and answer is null;
select is(
  (select count(*)::int from public.title_sends), 1,
  'A can take back a send that is still waiting'
);

-- ---------------------------------------------------------------------------
-- Hidden season reviews
-- ---------------------------------------------------------------------------

select lives_ok(
  $$ insert into public.season_reviews (list_item_id, couple_id, profile_id, season, body)
     values ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '11111111-1111-1111-1111-111111111111', 1, 'A slow start, then wow') $$,
  'A can review season 1'
);
select throws_ok(
  $$ insert into public.season_reviews (list_item_id, couple_id, profile_id, season, body)
     values ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '22222222-2222-2222-2222-222222222222', 1, 'Not mine to write') $$,
  '42501', null,
  'A cannot review as B'
);
select throws_ok(
  $$ insert into public.season_reviews (list_item_id, couple_id, profile_id, season, body)
     values ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '11111111-1111-1111-1111-111111111111', 1, 'Films have no seasons') $$,
  '23514', null,
  'films have no seasons to review'
);
select throws_ok(
  $$ insert into public.season_reviews (list_item_id, couple_id, profile_id, season, body)
     values ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '11111111-1111-1111-1111-111111111111', 2, repeat('x', 501)) $$,
  '23514', null,
  'a season review is at most 500 characters'
);
select throws_ok(
  $$ insert into public.season_reviews (list_item_id, couple_id, profile_id, season, body)
     values ('c0000000-0000-0000-0000-000000000002', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
             '11111111-1111-1111-1111-111111111111', 1, 'Not our list') $$,
  '23514', null,
  'A cannot review another couple''s series (the series check cannot see it, so it refuses first)'
);
select throws_ok(
  $$ insert into public.season_review_signals (list_item_id, couple_id, profile_id, season)
     values ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '11111111-1111-1111-1111-111111111111', 2) $$,
  '42501', null,
  'nobody writes the signals directly'
);

-- B sees that A wrote one, but not what it says, until B writes their own for the same season.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.season_reviews), 0, 'B cannot read A''s review before writing one');
select is(
  (select count(*)::int from public.season_review_signals where season = 1), 1,
  'B can see that A has written one'
);
insert into public.season_reviews (list_item_id, couple_id, profile_id, season, body)
values ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '22222222-2222-2222-2222-222222222222', 2, 'Season two is the best');
select is((select count(*)::int from public.season_reviews), 1, 'a review of another season reveals nothing');
insert into public.season_reviews (list_item_id, couple_id, profile_id, season, body)
values ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '22222222-2222-2222-2222-222222222222', 1, 'Loved it');
select is(
  (select body from public.season_reviews where season = 1 and profile_id = '11111111-1111-1111-1111-111111111111'),
  'A slow start, then wow',
  'B reads A''s review once B has written theirs'
);
update public.season_reviews set body = 'Hijacked'
where profile_id = '11111111-1111-1111-1111-111111111111';
delete from public.season_reviews where profile_id = '11111111-1111-1111-1111-111111111111';

-- C sees none of it.
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is((select count(*)::int from public.season_reviews), 0, 'C cannot read A and B''s season reviews');
select is((select count(*)::int from public.season_review_signals), 0, 'C cannot see their signals');

-- Back as A.
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select is(
  (select body from public.season_reviews where season = 1 and profile_id = '11111111-1111-1111-1111-111111111111'),
  'A slow start, then wow',
  'B could neither change nor delete A''s review'
);
select is(
  (select count(*)::int from public.season_reviews where profile_id = '22222222-2222-2222-2222-222222222222'), 1,
  'A reads only B''s review of the season A has reviewed'
);
delete from public.season_reviews where season = 1 and profile_id = '11111111-1111-1111-1111-111111111111';
select is(
  (select count(*)::int from public.season_review_signals where profile_id = '11111111-1111-1111-1111-111111111111'), 0,
  'deleting a review removes its signal'
);
select is(
  (select count(*)::int from public.season_reviews where profile_id = '22222222-2222-2222-2222-222222222222'), 0,
  'and hides B''s again'
);

delete from public.list_items where id = 'a0000000-0000-0000-0000-000000000002';
reset role;
select is(
  (select count(*)::int from public.season_reviews where couple_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
  + (select count(*)::int from public.season_review_signals where couple_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0,
  'season reviews and signals go with their list item'
);

select * from finish();
rollback;
