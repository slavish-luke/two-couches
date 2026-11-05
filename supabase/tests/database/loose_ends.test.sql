-- RLS and rules for Sprint 10 (review_signals, titles.season_episodes). Run with `npm run db:test`.
begin;
select plan(17);

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

insert into public.list_items (id, couple_id, media_type, tmdb_id, added_by) values
  ('a0a0a0a0-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'movie', 603,
   '11111111-1111-1111-1111-111111111111'),
  ('c0c0c0c0-0000-0000-0000-000000000000', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'movie', 603,
   '33333333-3333-3333-3333-333333333333');

select ok(
  (select count(*) = 1 from pg_publication_tables
   where pubname = 'supabase_realtime' and tablename = 'review_signals'),
  'review signals are published to Realtime'
);

-- ---------------------------------------------------------------------------
-- Review signals
-- ---------------------------------------------------------------------------

-- Act as A, and write a review.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.list_reviews (list_item_id, couple_id, profile_id, body)
values ('a0a0a0a0-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '11111111-1111-1111-1111-111111111111', 'Still holds up.');

select is(
  (select count(*)::int from public.review_signals where profile_id = '11111111-1111-1111-1111-111111111111'),
  1,
  'writing a review raises its signal'
);
select throws_ok(
  $$ insert into public.review_signals (list_item_id, couple_id, profile_id)
     values ('a0a0a0a0-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '22222222-2222-2222-2222-222222222222') $$,
  '42501', null,
  'members cannot write signals themselves'
);
select throws_ok(
  $$ update public.review_signals set changed_at = now() - interval '1 day' $$,
  '42501', null,
  'members cannot change signals'
);
select throws_ok(
  $$ delete from public.review_signals $$,
  '42501', null,
  'members cannot delete signals'
);
select throws_ok(
  $$ select public.sync_review_signal() $$,
  '42501', null,
  'the trigger function is not callable'
);

-- Act as B, who hasn't written one yet.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select is((select count(*)::int from public.list_reviews), 0, 'B still cannot read A''s review');
select is(
  (select array_agg(profile_id) from public.review_signals),
  array['11111111-1111-1111-1111-111111111111'::uuid],
  'but B reads A''s signal'
);
select is(
  (select array_agg(column_name::text order by column_name::text) from information_schema.columns
   where table_schema = 'public' and table_name = 'review_signals'),
  array['changed_at', 'couple_id', 'list_item_id', 'profile_id'],
  'a signal carries no text'
);

-- A changes theirs: the signal is touched.
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
reset role;
update public.review_signals set changed_at = '2026-01-01 00:00+00';
set local role authenticated;
update public.list_reviews set body = 'Even better the second time.' where profile_id = '11111111-1111-1111-1111-111111111111';
select ok(
  (select changed_at > '2026-01-01 00:00+00' from public.review_signals
   where profile_id = '11111111-1111-1111-1111-111111111111'),
  'changing a review touches its signal'
);

-- Act as C, in another couple.
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
insert into public.list_reviews (list_item_id, couple_id, profile_id, body)
values ('c0c0c0c0-0000-0000-0000-000000000000', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        '33333333-3333-3333-3333-333333333333', 'Fine.');
select is(
  (select array_agg(profile_id) from public.review_signals),
  array['33333333-3333-3333-3333-333333333333'::uuid],
  'C reads only their own couple''s signals'
);

-- A takes theirs back: the signal goes.
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
delete from public.list_reviews where profile_id = '11111111-1111-1111-1111-111111111111';
select is(
  (select count(*)::int from public.review_signals where profile_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'deleting a review lowers its signal'
);

-- Removing the item takes its reviews and signals with it (the trigger copes with the cascade).
reset role;
insert into public.list_reviews (list_item_id, couple_id, profile_id, body) values
  ('a0a0a0a0-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111', 'Again.'),
  ('a0a0a0a0-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '22222222-2222-2222-2222-222222222222', 'Me too.');
select lives_ok(
  $$ delete from public.list_items where id = 'a0a0a0a0-0000-0000-0000-000000000000' $$,
  'a reviewed list item can be removed'
);
select is(
  (select count(*)::int from public.review_signals where list_item_id = 'a0a0a0a0-0000-0000-0000-000000000000'),
  0,
  'removing a list item removes its signals'
);
select lives_ok(
  $$ delete from auth.users where id = '33333333-3333-3333-3333-333333333333' $$,
  'a person who has reviewed can be deleted'
);
select is((select count(*)::int from public.review_signals), 0, 'and their signals go with them');

-- ---------------------------------------------------------------------------
-- Episodes per season
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ insert into public.titles (media_type, tmdb_id, original_title, season_episodes)
     values ('tv', 1396, 'Breaking Bad', array[7, -1]) $$,
  '23514', null,
  'episode counts are not negative'
);

select * from finish();
rollback;
