-- Same couch mode (profiles.visiting_country / visiting_until), Phase 3 block 3. Run with `npm run db:test`.
begin;
select plan(8);

-- Start from an empty slate so local sign-ins can't collide with the fixtures. Rolled back at the end.
delete from public.list_items;
delete from public.couples;
delete from auth.users;

insert into public.signup_allowlist (email) values ('third@example.com') on conflict do nothing;
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'one@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'two@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'third@example.com');
insert into public.couples (id, invite_code) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'AAAAAAAA');
update public.profiles set couple_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', country = 'GB'
where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
update public.profiles set country = 'NZ' where id = '33333333-3333-3333-3333-333333333333';

-- Act as A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select lives_ok(
  $$ update public.profiles set visiting_country = 'NZ', visiting_until = '2026-12-20'
     where id = '11111111-1111-1111-1111-111111111111' $$,
  'A can set a visit'
);
select throws_ok(
  $$ update public.profiles set visiting_country = 'nzl' where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null,
  'visited countries must be two-letter codes'
);
select throws_ok(
  $$ update public.profiles set visiting_until = null where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null,
  'a visit needs both a country and a date'
);
update public.profiles set visiting_country = 'GB', visiting_until = '2026-12-20'
where id = '22222222-2222-2222-2222-222222222222';
select is(
  (select visiting_country from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  null,
  'A cannot set a visit for their partner'
);
update public.profiles set visiting_country = 'GB', visiting_until = '2026-12-20'
where id = '33333333-3333-3333-3333-333333333333';

-- Act as B.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is(
  (select visiting_country || ' ' || visiting_until from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'NZ 2026-12-20',
  'B can see A''s visit'
);

-- Act as outsider C.
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is(
  (select visiting_country from public.profiles where id = '33333333-3333-3333-3333-333333333333'),
  null,
  'A could not set a visit for someone outside the couple'
);
select is(
  (select count(*)::int from public.profiles where visiting_country is not null),
  0,
  'C cannot see A''s visit'
);

-- Back as A: ending the visit clears both columns.
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select lives_ok(
  $$ update public.profiles set visiting_country = null, visiting_until = null
     where id = '11111111-1111-1111-1111-111111111111' $$,
  'A can end their visit'
);

select * from finish();
rollback;
