-- RLS and rules for Sprint 5 (dismissed_titles, watch_nights). Run with `npm run db:test`.
begin;
select plan(28);

-- Start from an empty slate so local sign-ins and cached titles can't collide with the fixtures.
-- Everything here is rolled back at the end.
delete from public.watch_nights;
delete from public.dismissed_titles;
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

select ok(
  exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'watch_nights'),
  'watch-night changes are published to Realtime'
);
select ok(
  exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'dismissed_titles'),
  'dismissals are published to Realtime'
);

-- Act as A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

-- Not interested.
select lives_ok(
  $$ insert into public.dismissed_titles (couple_id, media_type, tmdb_id, dismissed_by)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'movie', 27205, '11111111-1111-1111-1111-111111111111') $$,
  'A can dismiss a title that is not cached'
);
select throws_ok(
  $$ insert into public.dismissed_titles (couple_id, media_type, tmdb_id, dismissed_by)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'movie', 27205, '11111111-1111-1111-1111-111111111111') $$,
  '23505', null,
  'a couple dismisses a title once'
);
select throws_ok(
  $$ insert into public.dismissed_titles (couple_id, media_type, tmdb_id, dismissed_by)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'person', 1, '11111111-1111-1111-1111-111111111111') $$,
  '23514', null,
  'only films and series can be dismissed'
);
select throws_ok(
  $$ insert into public.dismissed_titles (couple_id, media_type, tmdb_id, dismissed_by)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'tv', 1396, '22222222-2222-2222-2222-222222222222') $$,
  '42501', null,
  'A cannot dismiss in B''s name'
);
select throws_ok(
  $$ insert into public.dismissed_titles (couple_id, media_type, tmdb_id, dismissed_by)
     values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'tv', 1396, '11111111-1111-1111-1111-111111111111') $$,
  '42501', null,
  'A cannot dismiss for another couple'
);

-- Watch nights.
select lives_ok(
  $$ insert into public.watch_nights (couple_id, media_type, tmdb_id, starts_at, method, link, created_by)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'movie', 603,
             '2030-01-05 09:00+00', 'teleparty', 'https://teleparty.example.com/join/abc', '11111111-1111-1111-1111-111111111111') $$,
  'A can plan a watch night for their couple'
);
select lives_ok(
  $$ insert into public.watch_nights (couple_id, starts_at, created_by)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2030-01-12 09:00+00', '11111111-1111-1111-1111-111111111111') $$,
  'a watch night can leave the title and method for later'
);
select throws_ok(
  $$ insert into public.watch_nights (couple_id, media_type, starts_at, created_by)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'movie', '2030-01-12 09:00+00', '11111111-1111-1111-1111-111111111111') $$,
  '23514', null,
  'a title needs both its type and its ID'
);
select throws_ok(
  $$ insert into public.watch_nights (couple_id, media_type, tmdb_id, starts_at, created_by)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'tv', 999999, '2030-01-12 09:00+00', '11111111-1111-1111-1111-111111111111') $$,
  '23503', null,
  'only cached titles can be planned'
);
select throws_ok(
  $$ insert into public.watch_nights (couple_id, starts_at, method, created_by)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2030-01-12 09:00+00', 'jellyfin', '11111111-1111-1111-1111-111111111111') $$,
  '23514', null,
  'methods are teleparty, syncplay or other'
);
select throws_ok(
  $$ insert into public.watch_nights (couple_id, starts_at, link, created_by)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2030-01-12 09:00+00', 'javascript:alert(1)', '11111111-1111-1111-1111-111111111111') $$,
  '23514', null,
  'links must be https'
);
select throws_ok(
  $$ insert into public.watch_nights (couple_id, starts_at, created_by)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2030-01-12 09:00+00', '22222222-2222-2222-2222-222222222222') $$,
  '42501', null,
  'A cannot plan a watch night in B''s name'
);
select throws_ok(
  $$ insert into public.watch_nights (couple_id, starts_at, created_by)
     values ('cccccccc-cccc-cccc-cccc-cccccccccccc', '2030-01-12 09:00+00', '11111111-1111-1111-1111-111111111111') $$,
  '42501', null,
  'A cannot plan a watch night for another couple'
);

-- Act as B.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select is((select count(*)::int from public.dismissed_titles), 1, 'B sees what A dismissed');
select is((select count(*)::int from public.watch_nights), 2, 'B sees the watch nights A planned');
select lives_ok(
  $$ update public.watch_nights set starts_at = '2030-01-05 10:00+00', method = 'syncplay', link = null,
       syncplay_server = 'syncplay.example.com:8999', syncplay_room = 'our-room'
     where tmdb_id = 603 $$,
  'B can change a watch night A planned'
);
select throws_ok(
  $$ update public.watch_nights set created_by = '22222222-2222-2222-2222-222222222222'
     where tmdb_id = 603 $$,
  '42501', null,
  'who planned a watch night is fixed'
);
select throws_ok(
  $$ update public.watch_nights set couple_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
     where tmdb_id = 603 $$,
  '42501', null,
  'a watch night cannot move to another couple'
);

-- Act as C, in another couple.
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);

select is((select count(*)::int from public.dismissed_titles), 0, 'C cannot see another couple''s dismissals');
select is((select count(*)::int from public.watch_nights), 0, 'C cannot see another couple''s watch nights');
update public.watch_nights set notes = 'hello';
delete from public.watch_nights;
delete from public.dismissed_titles;

reset role;
select is((select count(*)::int from public.watch_nights), 2, 'C''s deletes do not reach another couple''s watch nights');
select is((select count(*)::int from public.watch_nights where notes = 'hello'), 0, 'C''s updates do not reach another couple''s watch nights');
select is((select count(*)::int from public.dismissed_titles), 1, 'C''s deletes do not reach another couple''s dismissals');

-- Back as B: either member can undo a dismissal or cancel a watch night.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
delete from public.dismissed_titles;
delete from public.watch_nights where tmdb_id = 603;
reset role;
select is((select count(*)::int from public.dismissed_titles), 0, 'B can undo a dismissal A made');
select is((select count(*)::int from public.watch_nights), 1, 'B can cancel a watch night A planned');

-- Anonymous visitors.
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;
select throws_ok($$ select * from public.watch_nights $$, '42501', null, 'anonymous visitors cannot read watch nights');

select * from finish();
rollback;
