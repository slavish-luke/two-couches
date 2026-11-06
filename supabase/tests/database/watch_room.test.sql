-- Watch room (method "here" and the private Realtime channel per night). Run with `npm run db:test`.
begin;
select plan(10);

-- Start from an empty slate so local sign-ins can't collide with the fixtures. Rolled back at the end.
delete from public.watch_nights;
delete from public.list_items;
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

select lives_ok(
  $$ insert into public.watch_nights (id, couple_id, starts_at, method, created_by) values
     ('a1a1a1a1-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2030-01-05 09:00+00', 'here',
      '11111111-1111-1111-1111-111111111111'),
     ('c1c1c1c1-0000-0000-0000-000000000000', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2030-01-05 09:00+00', null,
      '33333333-3333-3333-3333-333333333333') $$,
  'a night can be watched here, in the app'
);
select throws_ok(
  $$ update public.watch_nights set method = 'zoom' where id = 'a1a1a1a1-0000-0000-0000-000000000000' $$,
  '23514', null,
  'unknown ways of watching are refused'
);

select ok(
  (select count(*) from pg_policies where schemaname = 'realtime' and tablename = 'messages'
     and policyname in ('members join their night''s watch room', 'members send in their night''s watch room')) = 2,
  'Realtime messages have a join and a send policy for watch rooms'
);

-- Act as A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select ok(public.is_my_night_room('night-room:a1a1a1a1-0000-0000-0000-000000000000'), 'A may use their night''s room');
select ok(not public.is_my_night_room('night-room:c1c1c1c1-0000-0000-0000-000000000000'), 'A may not use another couple''s room');
select ok(not public.is_my_night_room('a1a1a1a1-0000-0000-0000-000000000000'), 'only the night-room: topic counts');
select ok(not public.is_my_night_room('night-room:not-a-uuid'), 'a malformed topic is refused, not an error');

-- Act as B, A's partner.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select ok(public.is_my_night_room('night-room:a1a1a1a1-0000-0000-0000-000000000000'), 'B may use the couple''s room too');

-- Act as C.
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select ok(not public.is_my_night_room('night-room:a1a1a1a1-0000-0000-0000-000000000000'), 'C may not use A and B''s room');

-- Signed out.
reset role;
set local role anon;
select throws_ok(
  $$ select public.is_my_night_room('night-room:a1a1a1a1-0000-0000-0000-000000000000') $$,
  '42501', null,
  'signed-out visitors cannot check rooms'
);

select * from finish();
rollback;
