-- RLS and rules for the Sprint 2 shared list (list_items, list_ratings). Run with `npm run db:test`.
begin;
select plan(27);

-- Start from an empty slate so local sign-ins and cached titles can't collide with the fixtures.
-- Everything here is rolled back at the end.
delete from public.list_items;
delete from public.couples;
delete from auth.users;
delete from public.titles;
delete from public.availability;
delete from public.availability_checks;

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

select ok(
  exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'list_items')
  and exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'list_ratings'),
  'list changes are published to Realtime'
);

-- Act as A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select lives_ok(
  $$ insert into public.list_items (couple_id, media_type, tmdb_id, added_by, notes)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'movie', 603, '11111111-1111-1111-1111-111111111111', 'Rewatch?') $$,
  'A can add a title to their list'
);

-- Keep the new item's id where every role can read it.
reset role;
create temp table item as select id from public.list_items;
grant select on item to authenticated;
set local role authenticated;

select throws_ok(
  $$ insert into public.list_items (couple_id, media_type, tmdb_id, added_by)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'movie', 603, '11111111-1111-1111-1111-111111111111') $$,
  '23505', null,
  'a title is on a couple''s list at most once'
);
select throws_ok(
  $$ insert into public.list_items (couple_id, media_type, tmdb_id, added_by)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'tv', 1396, '22222222-2222-2222-2222-222222222222') $$,
  '42501', null,
  'A cannot add a title in B''s name'
);
select throws_ok(
  $$ insert into public.list_items (couple_id, media_type, tmdb_id, added_by)
     values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'tv', 1396, '11111111-1111-1111-1111-111111111111') $$,
  '42501', null,
  'A cannot add to another couple''s list'
);
select throws_ok(
  $$ insert into public.list_items (couple_id, media_type, tmdb_id, added_by)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'tv', 999999, '11111111-1111-1111-1111-111111111111') $$,
  '23503', null,
  'only cached titles can be added'
);
select throws_ok(
  $$ update public.list_items set categories = '{"Horror nights", "Horror nights"}' $$,
  '23514', null,
  'categories cannot repeat'
);
select throws_ok(
  $$ update public.list_items set categories = '{" padded"}' $$,
  '23514', null,
  'categories are trimmed'
);
select throws_ok(
  $$ update public.list_items set categories = array['This category name is far too long to keep'] $$,
  '23514', null,
  'categories are at most 30 characters'
);
select throws_ok(
  $$ update public.list_items set season = 2 $$,
  '23514', null,
  'season and episode are set together'
);
select lives_ok(
  $$ insert into public.list_ratings (list_item_id, couple_id, profile_id, rating)
     select id, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 4 from item $$,
  'A can rate an item'
);
select throws_ok(
  $$ update public.list_ratings set rating = 6 $$,
  '23514', null,
  'ratings are 1 to 5'
);

-- Act as B.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select is((select notes from public.list_items), 'Rewatch?', 'B sees what A added');
select is((select rating::int from public.list_ratings), 4, 'B sees A''s rating');
select lives_ok(
  $$ update public.list_items set status = 'watched', watched_on = '2026-11-01', categories = '{"Sci-fi"}' $$,
  'B can edit their couple''s items'
);
select throws_ok(
  $$ update public.list_items set added_by = '22222222-2222-2222-2222-222222222222' $$,
  '42501', null,
  'who added an item is fixed'
);
select throws_ok(
  $$ update public.list_items set couple_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' $$,
  '42501', null,
  'an item cannot move to another couple'
);
update public.list_ratings set rating = 1;
select throws_ok(
  $$ insert into public.list_ratings (list_item_id, couple_id, profile_id, rating)
     select id, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 1 from item $$,
  '42501', null,
  'B cannot rate in A''s name'
);
select lives_ok(
  $$ insert into public.list_ratings (list_item_id, couple_id, profile_id, rating)
     select id, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 5 from item $$,
  'B can add their own rating'
);
delete from public.list_ratings where profile_id = '11111111-1111-1111-1111-111111111111';

-- Act as C, in another couple.
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);

select is((select count(*)::int from public.list_items), 0, 'C cannot see another couple''s list');
select is((select count(*)::int from public.list_ratings), 0, 'C cannot see another couple''s ratings');
update public.list_items set notes = 'hacked';
delete from public.list_items;
select throws_ok(
  $$ insert into public.list_ratings (list_item_id, couple_id, profile_id, rating)
     select id, 'cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', 1 from item $$,
  '23503', null,
  'C cannot rate another couple''s item'
);

reset role;
select is(
  (select notes from public.list_items where id = (select id from item)),
  'Rewatch?',
  'C''s edits and deletes do not reach another couple''s list'
);
select is(
  (select array_agg(rating::int order by profile_id) from public.list_ratings),
  array[4, 5],
  'B could not change or clear A''s rating'
);

-- Back as B: removing an item removes its ratings.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
delete from public.list_items where id = (select id from item);
reset role;
select is((select count(*)::int from public.list_items), 0, 'B can remove an item');
select is((select count(*)::int from public.list_ratings), 0, 'removing an item removes its ratings');

-- Anonymous visitors.
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;
select throws_ok($$ select * from public.list_items $$, '42501', null, 'anonymous visitors cannot read the list');

select * from finish();
rollback;
