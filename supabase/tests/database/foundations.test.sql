-- RLS and couple-joining rules from the Sprint 0 migration. Run with `npm run db:test`.
begin;
select plan(23);

-- Test users. The allowlist is seeded with one@ and two@; add a third for the "outsider" cases.
insert into public.signup_allowlist (email) values ('third@example.com') on conflict do nothing;

select throws_ok(
  $$ insert into auth.users (id, email) values ('99999999-9999-9999-9999-999999999999', 'stranger@example.com') $$,
  'P0001', 'signup_not_allowed',
  'emails outside the allowlist cannot sign up'
);

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'one@example.com', '{"full_name": "Alex"}'),
  ('22222222-2222-2222-2222-222222222222', 'TWO@example.com', '{}'),
  ('33333333-3333-3333-3333-333333333333', 'third@example.com', '{}');

select is(
  (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Alex',
  'a profile is created for each new user, named from their metadata'
);
select is(
  (select display_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  'TWO',
  'without a name, the profile falls back to the email prefix'
);

-- Act as user A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select matches(public.create_couple(), '^[A-Z2-9]{8}$', 'create_couple returns an 8-character invite code');
select throws_ok($$ select public.create_couple() $$, 'P0001', 'already_in_couple', 'a user cannot start a second couple');
select is((select count(*)::int from public.profiles), 1, 'before a partner joins, A sees only their own profile');
select is((select count(*)::int from public.couples), 1, 'A can see their couple');

-- Act as user B and join with a lower-case, hyphenated copy of the code.
reset role;
create temp table invite as select invite_code as code from public.couples;
grant select on invite to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select is((select count(*)::int from public.couples), 0, 'B cannot see a couple they have not joined');
select lives_ok(
  $$ select public.join_couple(lower(substr(code, 1, 4) || '-' || substr(code, 5))) from invite $$,
  'B can join with the invite code, ignoring case and separators'
);
select is((select count(*)::int from public.profiles), 2, 'after joining, B sees both profiles');
select lives_ok($$ select public.join_couple(code) from invite $$, 'joining the same couple again is harmless');

select lives_ok(
  $$ update public.profiles set display_name = 'Sam', country = 'GB', language = 'en', time_zone = 'Europe/London', services = '{8,337}'
     where id = '22222222-2222-2222-2222-222222222222' $$,
  'B can edit their own settings'
);
select throws_ok(
  $$ update public.profiles set time_zone = 'Mars/Olympus_Mons' where id = '22222222-2222-2222-2222-222222222222' $$,
  '23514', null,
  'invalid time zones are rejected'
);
select throws_ok(
  $$ update public.profiles set country = 'gbr' where id = '22222222-2222-2222-2222-222222222222' $$,
  '23514', null,
  'countries must be two-letter codes'
);
select throws_ok(
  $$ update public.profiles set couple_id = null where id = '22222222-2222-2222-2222-222222222222' $$,
  '42501', null,
  'B cannot change their couple_id directly'
);
update public.profiles set display_name = 'hacked' where id = '11111111-1111-1111-1111-111111111111';
select is(
  (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Alex',
  'B cannot edit A''s profile'
);

select throws_ok(
  $$ insert into public.services (country, provider_id, name) values ('GB', 1, 'Fake') $$,
  '42501', null,
  'users cannot write the service catalogue'
);
select throws_ok($$ select * from public.signup_allowlist $$, '42501', null, 'users cannot read the allowlist');
select throws_ok(
  $$ insert into public.couples (invite_code) values ('ABCDEFGH') $$,
  '42501', null,
  'users cannot insert couples directly'
);

-- Act as outsider C.
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);

select throws_ok($$ select public.join_couple(code) from invite $$, 'P0001', 'couple_full', 'a third person cannot join a full couple');
select throws_ok($$ select public.join_couple('ZZZZZZZZ') $$, 'P0001', 'invite_not_found', 'unknown invite codes are rejected');
select is((select count(*)::int from public.profiles), 1, 'C sees only their own profile');

-- Anonymous visitors.
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anonymous visitors cannot read profiles');

select * from finish();
rollback;
