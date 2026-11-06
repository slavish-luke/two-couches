-- Subtitle cache (server only). Run with `npm run db:test`.
begin;
select plan(5);

delete from public.subtitle_files;
insert into public.subtitle_files (file_id, language, release, vtt) values (101, 'en', 'Film.2020.1080p', 'WEBVTT');

select throws_ok(
  $$ insert into public.subtitle_files (file_id, language, vtt) values (102, 'english', 'WEBVTT') $$,
  '23514', null,
  'languages are short codes'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select throws_ok($$ select * from public.subtitle_files $$, '42501', null, 'signed-in users cannot read the cache directly');
select throws_ok(
  $$ insert into public.subtitle_files (file_id, language, vtt) values (103, 'en', 'WEBVTT') $$,
  '42501', null,
  'signed-in users cannot write the cache'
);

reset role;
set local role anon;
select throws_ok($$ select * from public.subtitle_files $$, '42501', null, 'signed-out visitors cannot read the cache');

reset role;
select is((select count(*) from public.subtitle_files)::int, 1, 'the server (service role) keeps the cache');

select * from finish();
rollback;
