-- RLS and rules for Sprint 22 (free_evenings, titles.origin_countries). Run with `npm run db:test`.
begin;
select plan(19);

-- Start from an empty slate so local sign-ins can't collide with the fixtures. Everything here is rolled
-- back at the end.
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

select ok(
  exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'free_evenings'),
  'free evenings are published to Realtime'
);

-- Origin countries: written by the server only, like the rest of the titles cache.
select lives_ok(
  $$ insert into public.titles (media_type, tmdb_id, original_title, origin_countries)
     values ('movie', 999999001, 'A Film', '{US}') $$,
  'a title can say where it was made'
);
select throws_ok(
  $$ insert into public.titles (media_type, tmdb_id, original_title, origin_countries)
     values ('movie', 999999002, 'Nameless', '{""}') $$,
  '23514', null,
  'an origin country is never blank'
);

-- Act as A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select is((select origin_countries from public.titles where tmdb_id = 999999001), '{US}'::text[], 'signed-in users read origin countries');
select throws_ok(
  $$ update public.titles set origin_countries = '{GB}' where tmdb_id = 999999001 $$,
  '42501', null,
  'only the server writes origin countries'
);

select lives_ok(
  $$ insert into public.free_evenings (profile_id, couple_id, on_day)
     values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (now() at time zone 'utc')::date) $$,
  'A can say they''re free tonight'
);
select is((select free from public.free_evenings), true, 'saying so marks them free');
select throws_ok(
  $$ insert into public.free_evenings (profile_id, couple_id, on_day)
     values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (now() at time zone 'utc')::date) $$,
  '23505', null,
  'one row per person per evening'
);
select lives_ok(
  $$ update public.free_evenings set free = false where profile_id = '11111111-1111-1111-1111-111111111111' $$,
  'A can take it back'
);
select throws_ok(
  $$ insert into public.free_evenings (profile_id, couple_id, on_day)
     values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (now() at time zone 'utc')::date - 3) $$,
  '42501', null,
  'only for this evening, not one gone by'
);
select throws_ok(
  $$ insert into public.free_evenings (profile_id, couple_id, on_day)
     values ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (now() at time zone 'utc')::date) $$,
  '42501', null,
  'A cannot say B is free'
);
select throws_ok(
  $$ insert into public.free_evenings (profile_id, couple_id, on_day)
     values ('11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', (now() at time zone 'utc')::date + 1) $$,
  '42501', null,
  'A cannot say so in another couple'
);
select throws_ok(
  $$ update public.free_evenings set on_day = on_day + 1 where profile_id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null,
  'an evening''s date is fixed'
);
select throws_ok(
  $$ delete from public.free_evenings $$,
  '42501', null,
  'rows are never deleted (undo changes `free`, so a second tap doesn''t push again)'
);

-- Act as B.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select is((select count(*)::int from public.free_evenings), 1, 'B sees A''s evening');
select lives_ok(
  $$ insert into public.free_evenings (profile_id, couple_id, on_day)
     values ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (now() at time zone 'utc')::date + 1) $$,
  'B can say they''re free on their own tonight (a day ahead of UTC)'
);
update public.free_evenings set free = true where profile_id = '11111111-1111-1111-1111-111111111111';
select is(
  (select free from public.free_evenings where profile_id = '11111111-1111-1111-1111-111111111111'),
  false,
  'B cannot change A''s evening'
);

-- Act as C, in another couple.
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is((select count(*)::int from public.free_evenings), 0, 'C cannot see another couple''s evenings');

-- Anonymous visitors see nothing.
reset role;
set local role anon;
select throws_ok($$ select count(*) from public.free_evenings $$, '42501', null, 'anonymous visitors cannot read free evenings');

select * from finish();
rollback;
