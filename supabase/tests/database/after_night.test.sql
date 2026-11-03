-- RLS and rules for Phase 3 block 1 (list_reviews, night_wrapups). Run with `npm run db:test`.
begin;
select plan(27);

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

-- A list item and a watch night for each couple.
insert into public.list_items (id, couple_id, media_type, tmdb_id, added_by) values
  ('a0a0a0a0-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'movie', 603,
   '11111111-1111-1111-1111-111111111111'),
  ('c0c0c0c0-0000-0000-0000-000000000000', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'movie', 603,
   '33333333-3333-3333-3333-333333333333');
insert into public.watch_nights (id, couple_id, media_type, tmdb_id, starts_at, created_by) values
  ('a1a1a1a1-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'movie', 603,
   '2026-01-05 09:00+00', '11111111-1111-1111-1111-111111111111'),
  ('c1c1c1c1-0000-0000-0000-000000000000', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'movie', 603,
   '2026-01-05 09:00+00', '33333333-3333-3333-3333-333333333333');

select ok(
  (select count(*) = 2 from pg_publication_tables
   where pubname = 'supabase_realtime' and tablename in ('list_reviews', 'night_wrapups')),
  'reviews and wrap-ups are published to Realtime'
);

-- ---------------------------------------------------------------------------
-- Hidden reviews
-- ---------------------------------------------------------------------------

-- Act as A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select lives_ok(
  $$ insert into public.list_reviews (list_item_id, couple_id, profile_id, body)
     values ('a0a0a0a0-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '11111111-1111-1111-1111-111111111111', 'Still holds up.') $$,
  'A can review a list item'
);
select throws_ok(
  $$ insert into public.list_reviews (list_item_id, couple_id, profile_id, body)
     values ('a0a0a0a0-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '22222222-2222-2222-2222-222222222222', 'Written by A') $$,
  '42501', null,
  'A cannot write B''s review'
);
select throws_ok(
  $$ insert into public.list_reviews (list_item_id, couple_id, profile_id, body)
     values ('c0c0c0c0-0000-0000-0000-000000000000', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
             '11111111-1111-1111-1111-111111111111', 'Not mine') $$,
  '42501', null,
  'A cannot review another couple''s item'
);
select throws_ok(
  $$ insert into public.list_reviews (list_item_id, couple_id, profile_id, body)
     values ('c0c0c0c0-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '11111111-1111-1111-1111-111111111111', 'Wrong couple') $$,
  '23503', null,
  'a review''s couple must be its item''s couple'
);
select throws_ok(
  $$ update public.list_reviews set body = '' where profile_id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null,
  'a review is not empty'
);
select throws_ok(
  $$ update public.list_reviews set body = repeat('a', 1001) where profile_id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null,
  'a review is at most 1,000 characters'
);
select throws_ok(
  $$ update public.list_reviews set profile_id = '22222222-2222-2222-2222-222222222222'
     where profile_id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null,
  'whose review it is is fixed'
);

-- Act as B, who hasn't written one yet.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select is((select count(*)::int from public.list_reviews), 0, 'B cannot read A''s review before writing their own');
select is(
  (select array_agg(profile_id) from public.review_authors(array['a0a0a0a0-0000-0000-0000-000000000000'::uuid])),
  array['11111111-1111-1111-1111-111111111111'::uuid],
  'but B can tell that A has written one'
);
select is(public.has_reviewed('a0a0a0a0-0000-0000-0000-000000000000'), false, 'B has not reviewed it');

update public.list_reviews set body = 'changed by B' where profile_id = '11111111-1111-1111-1111-111111111111';
delete from public.list_reviews where profile_id = '11111111-1111-1111-1111-111111111111';

select lives_ok(
  $$ insert into public.list_reviews (list_item_id, couple_id, profile_id, body)
     values ('a0a0a0a0-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '22222222-2222-2222-2222-222222222222', 'Too long, loved it.') $$,
  'B can write their own'
);
select is(
  (select body from public.list_reviews where profile_id = '11111111-1111-1111-1111-111111111111'),
  'Still holds up.',
  'once B has written theirs, A''s review shows, unchanged by B'
);
select is((select count(*)::int from public.list_reviews), 2, 'B sees both reviews');

-- Taking yours back hides your partner's again.
delete from public.list_reviews where profile_id = '22222222-2222-2222-2222-222222222222';
select is((select count(*)::int from public.list_reviews), 0, 'deleting your review hides your partner''s again');
insert into public.list_reviews (list_item_id, couple_id, profile_id, body)
values ('a0a0a0a0-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '22222222-2222-2222-2222-222222222222', 'Too long, loved it.');

-- Act as C, in another couple, who has reviewed their own copy of the same title.
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
insert into public.list_reviews (list_item_id, couple_id, profile_id, body)
values ('c0c0c0c0-0000-0000-0000-000000000000', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        '33333333-3333-3333-3333-333333333333', 'Fine.');

select is((select count(*)::int from public.list_reviews), 1, 'C sees only their own couple''s reviews');
select is(
  (select count(*)::int from public.review_authors(array['a0a0a0a0-0000-0000-0000-000000000000'::uuid])),
  0,
  'C cannot tell who reviewed another couple''s item'
);

-- ---------------------------------------------------------------------------
-- Wrap-ups
-- ---------------------------------------------------------------------------

-- Act as A.
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select lives_ok(
  $$ insert into public.night_wrapups (watch_night_id, couple_id, profile_id, outcome)
     values ('a1a1a1a1-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '11111111-1111-1111-1111-111111111111', 'saved') $$,
  'A can wrap up a night'
);
select throws_ok(
  $$ insert into public.night_wrapups (watch_night_id, couple_id, profile_id, outcome)
     values ('a1a1a1a1-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '22222222-2222-2222-2222-222222222222', 'skipped') $$,
  '42501', null,
  'A cannot wrap up for B'
);
select throws_ok(
  $$ insert into public.night_wrapups (watch_night_id, couple_id, profile_id, outcome)
     values ('c1c1c1c1-0000-0000-0000-000000000000', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
             '11111111-1111-1111-1111-111111111111', 'saved') $$,
  '42501', null,
  'A cannot wrap up another couple''s night'
);
select throws_ok(
  $$ insert into public.night_wrapups (watch_night_id, couple_id, profile_id, outcome)
     values ('c1c1c1c1-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '11111111-1111-1111-1111-111111111111', 'saved') $$,
  '23503', null,
  'a wrap-up''s couple must be its night''s couple'
);
select throws_ok(
  $$ insert into public.night_wrapups (watch_night_id, couple_id, profile_id, outcome)
     values ('a1a1a1a1-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '11111111-1111-1111-1111-111111111111', 'saved') $$,
  '23505', null,
  'each person wraps up a night once'
);

-- Act as B.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select outcome from public.night_wrapups), 'saved', 'B sees that A has wrapped up the night');
delete from public.night_wrapups where profile_id = '11111111-1111-1111-1111-111111111111';
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select is((select count(*)::int from public.night_wrapups), 1, 'B cannot undo A''s wrap-up');

-- Act as C.
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is((select count(*)::int from public.night_wrapups), 0, 'C cannot see another couple''s wrap-ups');

-- Removing the item or cancelling the night takes its reviews and wrap-ups with it.
reset role;
delete from public.list_items where id = 'a0a0a0a0-0000-0000-0000-000000000000';
select is(
  (select count(*)::int from public.list_reviews where list_item_id = 'a0a0a0a0-0000-0000-0000-000000000000'),
  0,
  'removing a list item removes its reviews'
);
delete from public.watch_nights where id = 'a1a1a1a1-0000-0000-0000-000000000000';
select is((select count(*)::int from public.night_wrapups), 0, 'cancelling a night removes its wrap-ups');

select * from finish();
rollback;
