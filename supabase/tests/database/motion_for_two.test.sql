-- Sprint 27 (Motion for two): list_items.updated_by and watch_nights.updated_by, set by triggers from the
-- signed-in user so the other screen knows who made a live change. Run with `npm run db:test`.
begin;
select plan(16);

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

-- Act as A: add a title and plan a night.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select lives_ok(
  $$ insert into public.list_items (couple_id, media_type, tmdb_id, added_by)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'movie', 603, '11111111-1111-1111-1111-111111111111') $$,
  'A adds a title'
);
select is(
  (select updated_by from public.list_items),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'a new list item names its adder as the last to change it'
);
select throws_ok(
  $$ insert into public.list_items (couple_id, media_type, tmdb_id, added_by, updated_by)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'movie', 603, '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222') $$,
  '42501', null,
  'nobody can write updated_by on insert'
);
select throws_ok(
  $$ update public.list_items set updated_by = '22222222-2222-2222-2222-222222222222' $$,
  '42501', null,
  'nobody can write updated_by on update'
);

select lives_ok(
  $$ insert into public.watch_nights (couple_id, starts_at, created_by)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', now() + interval '1 day', '11111111-1111-1111-1111-111111111111') $$,
  'A plans a night'
);
select is(
  (select updated_by from public.watch_nights),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'a new night names its planner'
);
select throws_ok(
  $$ update public.watch_nights set updated_by = '22222222-2222-2222-2222-222222222222' $$,
  '42501', null,
  'nobody can write a night''s updated_by'
);

-- Act as B: change both. The trigger names B, whatever B sends.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select lives_ok($$ update public.list_items set status = 'watched' $$, 'B marks the title watched');
select is(
  (select updated_by from public.list_items),
  '22222222-2222-2222-2222-222222222222'::uuid,
  'B''s update names B'
);
select lives_ok($$ update public.watch_nights set notes = 'Popcorn' $$, 'B changes the night');
select is(
  (select updated_by from public.watch_nights),
  '22222222-2222-2222-2222-222222222222'::uuid,
  'B''s change to the night names B'
);
select is(
  (select added_by from public.list_items),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'who added the title is unchanged'
);

-- C sees neither row: RLS is unchanged.
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is((select count(*)::int from public.list_items), 0, 'another couple can''t read the list item');
select is((select count(*)::int from public.watch_nights), 0, 'another couple can''t read the night');

-- Without a user (the admin client, cron) the actor is unknown, so no screen claims the change.
reset role;
select set_config('request.jwt.claims', '', true);
update public.list_items set notes = 'From the server';
select is((select updated_by from public.list_items), null, 'a change without a user leaves updated_by empty');
update public.watch_nights set notes = 'From the server';
select is((select updated_by from public.watch_nights), null, 'so does a server change to a night');

select * from finish();
rollback;
