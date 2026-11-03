-- RLS and rules for Phase 3's calendar subscription (calendar_feeds). Run with `npm run db:test`.
begin;
select plan(13);

-- Start from an empty slate so local sign-ins can't collide with the fixtures.
-- Everything here is rolled back at the end.
delete from public.calendar_feeds;
delete from public.couples;
delete from auth.users;

insert into public.signup_allowlist (email) values ('third@example.com') on conflict do nothing;
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'one@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'two@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'third@example.com');

-- A and B are a couple; C is on their own.
insert into public.couples (id, invite_code) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'AAAAAAAA');
update public.profiles set couple_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

-- C already has a feed.
insert into public.calendar_feeds (profile_id, token_hash)
values ('33333333-3333-3333-3333-333333333333', repeat('c', 64));

-- Act as A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select lives_ok(
  $$ insert into public.calendar_feeds (profile_id, token_hash) values ('11111111-1111-1111-1111-111111111111', repeat('a', 64)) $$,
  'A can make their own feed'
);
select throws_ok(
  $$ insert into public.calendar_feeds (profile_id, token_hash) values ('11111111-1111-1111-1111-111111111111', repeat('d', 64)) $$,
  '23505', null,
  'each person has at most one feed'
);
select throws_ok(
  $$ insert into public.calendar_feeds (profile_id, token_hash) values ('22222222-2222-2222-2222-222222222222', repeat('b', 64)) $$,
  '42501', null,
  'A cannot make a feed for B'
);
select throws_ok(
  $$ insert into public.calendar_feeds (profile_id, token_hash, created_at) values ('11111111-1111-1111-1111-111111111111', repeat('e', 64), now()) $$,
  '42501', null,
  'created_at is set by the database'
);
select is((select count(*) from public.calendar_feeds), 1::bigint, 'A sees only their own feed');
select throws_ok(
  $$ update public.calendar_feeds set token_hash = repeat('f', 64) $$,
  '42501', null,
  'feeds cannot be changed, only replaced'
);

-- Act as B, A's partner.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select is((select count(*) from public.calendar_feeds), 0::bigint, 'B cannot see A''s feed, even as a partner');
select throws_ok(
  $$ insert into public.calendar_feeds (profile_id, token_hash) values ('22222222-2222-2222-2222-222222222222', 'not-a-hash') $$,
  '23514', null,
  'only a SHA-256 hex hash is stored'
);
select throws_ok(
  $$ insert into public.calendar_feeds (profile_id, token_hash) values ('22222222-2222-2222-2222-222222222222', repeat('a', 64)) $$,
  '23505', null,
  'hashes are unique'
);
delete from public.calendar_feeds where profile_id = '11111111-1111-1111-1111-111111111111';

-- Act as A again.
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select is((select count(*) from public.calendar_feeds), 1::bigint, 'B could not remove A''s feed');
delete from public.calendar_feeds;
select is((select count(*) from public.calendar_feeds), 0::bigint, 'A can remove their own feed');

-- Signed out.
reset role;
set local role anon;
select throws_ok($$ select * from public.calendar_feeds $$, '42501', null, 'signed-out visitors cannot read feeds');

reset role;
select is(
  (select count(*) from public.calendar_feeds where profile_id = '33333333-3333-3333-3333-333333333333'),
  1::bigint,
  'other people''s feeds are untouched'
);

select * from finish();
rollback;
