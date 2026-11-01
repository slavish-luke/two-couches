-- RLS for the Sprint 1 caches (titles, title_texts, availability, availability_checks). Run with `npm run db:test`.
begin;
select plan(12);

-- Start from an empty slate so local sign-ins and cached titles can't collide with the fixtures.
-- Everything here is rolled back at the end.
delete from public.list_items;
delete from public.couples;
delete from auth.users;
delete from public.titles;
delete from public.availability;
delete from public.availability_checks;

insert into public.titles (media_type, tmdb_id, original_title) values ('movie', 603, 'The Matrix');
insert into public.title_texts (media_type, tmdb_id, locale, title) values ('movie', 603, 'en-GB', 'The Matrix');
insert into public.availability (media_type, tmdb_id, country, provider_id, kind, provider_name)
values ('movie', 603, 'GB', 8, 'flatrate', 'Netflix');
insert into public.availability_checks (media_type, tmdb_id, country) values ('movie', 603, 'GB');

select throws_ok(
  $$ insert into public.title_texts (media_type, tmdb_id, locale, title) values ('movie', 603, 'english', 'x') $$,
  '23514', null,
  'locales must look like en-GB'
);
select throws_ok(
  $$ insert into public.availability (media_type, tmdb_id, country, provider_id, kind, provider_name)
     values ('movie', 603, 'GB', 9, 'stolen', 'x') $$,
  '23514', null,
  'availability kinds are limited to flatrate, free, ads, rent and buy'
);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'one@example.com');

-- Any signed-in user, even one without a couple.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select is((select count(*)::int from public.titles), 1, 'signed-in users read titles');
select is((select count(*)::int from public.title_texts), 1, 'signed-in users read title texts');
select is((select count(*)::int from public.availability), 1, 'signed-in users read availability');
select is((select count(*)::int from public.availability_checks), 1, 'signed-in users read availability checks');

select throws_ok(
  $$ insert into public.titles (media_type, tmdb_id, original_title) values ('tv', 1, 'Fake') $$,
  '42501', null,
  'users cannot write titles'
);
select throws_ok(
  $$ update public.title_texts set title = 'hacked' $$,
  '42501', null,
  'users cannot edit title texts'
);
select throws_ok(
  $$ delete from public.availability $$,
  '42501', null,
  'users cannot delete availability'
);
select throws_ok(
  $$ insert into public.availability_checks (media_type, tmdb_id, country) values ('tv', 1, 'GB') $$,
  '42501', null,
  'users cannot write availability checks'
);

-- Anonymous visitors.
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;
select throws_ok($$ select * from public.titles $$, '42501', null, 'anonymous visitors cannot read titles');
select throws_ok($$ select * from public.availability $$, '42501', null, 'anonymous visitors cannot read availability');

select * from finish();
rollback;
