-- Sprint 23: a ready check keeps the chosen file's name and size. Run with `npm run db:test`.
begin;
select plan(12);

-- Start from an empty slate so local sign-ins can't collide with the fixtures. Everything is rolled back.
delete from public.watch_nights;
delete from public.list_items;
delete from public.couples;
delete from auth.users;
delete from public.titles;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'one@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'two@example.com');
insert into public.titles (media_type, tmdb_id, original_title) values ('movie', 603, 'The Matrix');
insert into public.couples (id, invite_code) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'AAAAAAAA');
update public.profiles set couple_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
insert into public.watch_nights (id, couple_id, media_type, tmdb_id, starts_at, method, created_by) values
  ('a1a1a1a1-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'movie', 603,
   '2030-01-05 09:00+00', 'here', '11111111-1111-1111-1111-111111111111');

select ok(
  has_column_privilege('authenticated', 'public.ready_checks', 'file_name', 'INSERT')
    and has_column_privilege('authenticated', 'public.ready_checks', 'file_name', 'UPDATE')
    and has_column_privilege('authenticated', 'public.ready_checks', 'file_size', 'INSERT')
    and has_column_privilege('authenticated', 'public.ready_checks', 'file_size', 'UPDATE'),
  'members may write the file name and size'
);
select ok(
  not has_column_privilege('anon', 'public.ready_checks', 'file_name', 'SELECT'),
  'signed-out visitors cannot read file names'
);

-- Act as A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select lives_ok(
  $$ insert into public.ready_checks (watch_night_id, couple_id, profile_id, file_label, file_seconds, file_name, file_size)
     values ('a1a1a1a1-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '11111111-1111-1111-1111-111111111111', 'Film 2020 1080p', 8170, 'Film.2020.1080p.mkv', 1524000000) $$,
  'A can save their chosen file''s name and size'
);
select lives_ok(
  $$ update public.ready_checks set file_label = 'Film.2020.1080p.BluRay.x264-GRP.mkv'
     where profile_id = '11111111-1111-1111-1111-111111111111' $$,
  'an ordinary file name is a fine version label'
);
select throws_ok(
  $$ update public.ready_checks set file_name = 'https://files.example.com/film.mkv'
     where profile_id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null,
  'a file name cannot be a link'
);
select throws_ok(
  $$ update public.ready_checks set file_name = 'www.example.com Film.mkv'
     where profile_id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null,
  'a file name cannot carry a web address'
);
select throws_ok(
  $$ update public.ready_checks set file_name = repeat('x', 101)
     where profile_id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null,
  'a file name is at most 100 characters'
);
select throws_ok(
  $$ update public.ready_checks set file_name = ''
     where profile_id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null,
  'a file name is not empty (null means none)'
);
select throws_ok(
  $$ update public.ready_checks set file_size = 0
     where profile_id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null,
  'a file size is at least a byte'
);
select lives_ok(
  $$ update public.ready_checks set file_name = null, file_size = null
     where profile_id = '11111111-1111-1111-1111-111111111111' $$,
  'A can forget their file''s name and size'
);

-- Act as B: they see A's file, but can't change it.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
update public.ready_checks set file_name = 'changed by B' where profile_id = '11111111-1111-1111-1111-111111111111';
select is(
  (select count(*)::int from public.ready_checks where file_name = 'changed by B'),
  0,
  'B cannot change A''s file name'
);

-- A new title clears both checks, file names too.
reset role;
update public.ready_checks set file_name = 'Film.2020.1080p.mkv' where profile_id = '11111111-1111-1111-1111-111111111111';
insert into public.titles (media_type, tmdb_id, original_title) values ('movie', 604, 'The Matrix Reloaded');
update public.watch_nights set tmdb_id = 604 where id = 'a1a1a1a1-0000-0000-0000-000000000000';
select is((select count(*)::int from public.ready_checks), 0, 'a new title clears the ready checks with their files');

select * from finish();
rollback;
