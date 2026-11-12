-- RLS and rules for Sprint 19 (alert kinds and details, snapshot free providers, cant_wait, warn_keywords).
-- Run with `npm run db:test`.
begin;
select plan(31);

-- Start from an empty slate so local sign-ins and cached titles can't collide with the fixtures.
-- Everything here is rolled back at the end.
delete from public.alerts;
delete from public.couples;
delete from auth.users;
delete from public.titles;
delete from public.availability_snapshots;

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

-- Alerts and snapshots (written only by the daily check) ----------------------------------------------

select lives_ok(
  $$ insert into public.alerts (couple_id, media_type, tmdb_id, kind, services, details) values
     ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'movie', 603, 'gone',
      '{"11111111-1111-1111-1111-111111111111": ["Netflix"]}',
      '{"11111111-1111-1111-1111-111111111111": {"country": "GB", "providers": [{"id": 8, "name": "Netflix"}]}}') $$,
  'a "gone" alert can be recorded, with its details'
);
select lives_ok(
  $$ insert into public.alerts (couple_id, media_type, tmdb_id, kind) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'movie', 603, 'free') $$,
  'a "free" alert can be recorded, details optional'
);
select throws_ok(
  $$ insert into public.alerts (couple_id, media_type, tmdb_id, kind) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'movie', 603, 'soon') $$,
  '23514', null,
  'alert kinds are both, one, free or gone'
);
select throws_ok(
  $$ insert into public.alerts (couple_id, media_type, tmdb_id, kind, details) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'movie', 603, 'gone', '[]') $$,
  '23514', null,
  'an alert''s details are an object'
);
select lives_ok(
  $$ insert into public.availability_snapshots (media_type, tmdb_id, country, provider_ids) values ('movie', 603, 'GB', '{8}') $$,
  'a snapshot without free providers (from before Sprint 19) is still fine'
);
select lives_ok(
  $$ insert into public.availability_snapshots (media_type, tmdb_id, country, provider_ids, free_ids) values ('movie', 603, 'NZ', '{}', '{73}') $$,
  'a snapshot can keep free providers'
);
select ok(
  exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'cant_wait'),
  'can''t waits are published to Realtime'
);

-- Act as A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select is((select count(*)::int from public.alerts where kind in ('free', 'gone')), 2, 'A reads the couple''s new kinds of alert');
select throws_ok(
  $$ update public.alerts set details = '{}' $$,
  '42501', null,
  'members cannot change alerts'
);

-- Can't wait ---------------------------------------------------------------------------------------------

select lives_ok(
  $$ insert into public.cant_wait (couple_id, profile_id, media_type, tmdb_id)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'movie', 693134) $$,
  'A can mark a title they can''t wait for (no cached title needed)'
);
select throws_ok(
  $$ insert into public.cant_wait (couple_id, profile_id, media_type, tmdb_id)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'movie', 693134) $$,
  '23505', null,
  'each person marks a title once'
);
select throws_ok(
  $$ insert into public.cant_wait (couple_id, profile_id, media_type, tmdb_id)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'movie', 693134) $$,
  '42501', null,
  'A cannot mark one for B'
);
select throws_ok(
  $$ insert into public.cant_wait (couple_id, profile_id, media_type, tmdb_id)
     values ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'movie', 1) $$,
  '42501', null,
  'A cannot mark one in another couple'
);
select throws_ok(
  $$ insert into public.cant_wait (couple_id, profile_id, media_type, tmdb_id)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'book', 1) $$,
  '23514', null,
  'a can''t wait is on a film or a series'
);
select throws_ok(
  $$ update public.cant_wait set tmdb_id = 1 $$,
  '42501', null,
  'a can''t wait cannot be changed, only cleared'
);

-- Warn me about -------------------------------------------------------------------------------------------

select lives_ok(
  $$ insert into public.warn_keywords (profile_id, couple_id, keyword_id, name)
     values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 3986, 'spider') $$,
  'A can add a topic to warn about'
);
select throws_ok(
  $$ insert into public.warn_keywords (profile_id, couple_id, keyword_id, name)
     values ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 3986, 'spider') $$,
  '42501', null,
  'A cannot add one to B''s list'
);
select throws_ok(
  $$ insert into public.warn_keywords (profile_id, couple_id, keyword_id, name)
     values ('11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 1, 'clowns') $$,
  '42501', null,
  'A cannot file one under another couple'
);
select throws_ok(
  $$ insert into public.warn_keywords (profile_id, couple_id, keyword_id, name)
     values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2, '') $$,
  '23514', null,
  'a topic has a name'
);
select throws_ok(
  $$ update public.warn_keywords set name = 'spiders' $$,
  '42501', null,
  'topics cannot be renamed'
);
select lives_ok(
  $$ insert into public.warn_keywords (profile_id, couple_id, keyword_id, name)
     select '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1000 + n, 'topic ' || n
     from generate_series(1, 29) n $$,
  'A can keep 30 topics'
);
select throws_ok(
  $$ insert into public.warn_keywords (profile_id, couple_id, keyword_id, name)
     values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 99, 'one too many') $$,
  '23514', null,
  'but not 31'
);

-- Act as B.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select is((select count(*)::int from public.cant_wait), 1, 'B sees A''s can''t wait');
select lives_ok(
  $$ insert into public.cant_wait (couple_id, profile_id, media_type, tmdb_id)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'movie', 693134) $$,
  'B can mark it too'
);
delete from public.cant_wait where profile_id = '11111111-1111-1111-1111-111111111111';
select is((select count(*)::int from public.cant_wait), 2, 'B cannot clear A''s can''t wait');
select is((select count(*)::int from public.warn_keywords), 30, 'B reads A''s topics (the title page warns about them)');
delete from public.warn_keywords where profile_id = '11111111-1111-1111-1111-111111111111';
select is((select count(*)::int from public.warn_keywords), 30, 'B cannot remove A''s topics');

-- Act as C.
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);

select is((select count(*)::int from public.cant_wait), 0, 'C sees no other couple''s can''t waits');
select is((select count(*)::int from public.warn_keywords), 0, 'C sees no other couple''s topics');

-- Back to A: clearing their own.
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
delete from public.warn_keywords where keyword_id = 3986;
select is((select count(*)::int from public.warn_keywords where keyword_id = 3986), 0, 'A can remove their own topic');

-- Signed out.
set local role anon;
select throws_ok($$ select * from public.cant_wait $$, '42501', null, 'signed-out visitors cannot read can''t waits');

select * from finish();
rollback;
