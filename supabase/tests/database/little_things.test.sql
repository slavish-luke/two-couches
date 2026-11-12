-- RLS and rules for Sprint 20 (nudges, the day's question, comments, episode reactions, night photos and
-- their storage bucket). Run with `npm run db:test`.
begin;
select plan(69);

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
insert into public.titles (media_type, tmdb_id, original_title) values
  ('movie', 603, 'The Matrix'),
  ('tv', 1399, 'A Long Series');

-- A and B are a couple; C has a couple of their own.
insert into public.couples (id, invite_code) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'AAAAAAAA'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'CCCCCCCC');
update public.profiles set couple_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
update public.profiles set couple_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
where id = '33333333-3333-3333-3333-333333333333';

-- A film on A and B's list, a series they've watched up to S1E3, and one on C's.
insert into public.list_items (id, couple_id, media_type, tmdb_id, added_by, status, season, episode) values
  ('a0a0a0a0-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'movie', 603,
   '11111111-1111-1111-1111-111111111111', 'want', null, null),
  ('a0a0a0a0-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'tv', 1399,
   '11111111-1111-1111-1111-111111111111', 'watching', 1, 3),
  ('c0c0c0c0-0000-0000-0000-000000000000', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'movie', 603,
   '33333333-3333-3333-3333-333333333333', 'want', null, null);

insert into public.watch_nights (id, couple_id, starts_at, created_by) values
  ('a1a1a1a1-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', now() - interval '1 day',
   '11111111-1111-1111-1111-111111111111'),
  ('a1a1a1a1-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', now() - interval '2 days',
   '11111111-1111-1111-1111-111111111111'),
  ('c1c1c1c1-0000-0000-0000-000000000000', 'cccccccc-cccc-cccc-cccc-cccccccccccc', now() - interval '1 day',
   '33333333-3333-3333-3333-333333333333');

-- Runs a statement as the current role and says how many rows it touched (RLS filters silently).
create function pg_temp.affected(statement text) returns int language plpgsql as $f$
declare n int;
begin
  execute statement;
  get diagnostics n = row_count;
  return n;
end;
$f$;

select is(
  (select array_agg(tablename::text order by tablename::text) from pg_publication_tables
   where pubname = 'supabase_realtime' and tablename in ('nudges', 'question_answers', 'question_signals', 'comments',
     'comment_reactions', 'episode_reactions', 'episode_signals', 'night_photos')),
  array['comment_reactions', 'comments', 'episode_reactions', 'episode_signals', 'night_photos', 'nudges',
        'question_answers', 'question_signals'],
  'every new table is published to Realtime'
);
select ok(
  (select not public from storage.buckets where id = 'night-photos'),
  'the photo bucket is private'
);

-- ---------------------------------------------------------------------------
-- Nudges
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select throws_ok(
  $$ insert into public.nudges (couple_id, from_profile, to_profile, kind)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
             '33333333-3333-3333-3333-333333333333', 'heart') $$,
  '42501', null,
  'A cannot nudge someone outside the couple'
);
select lives_ok(
  $$ insert into public.nudges (couple_id, from_profile, to_profile, kind)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
             '22222222-2222-2222-2222-222222222222', 'heart') $$,
  'A nudges B'
);
select throws_ok(
  $$ insert into public.nudges (couple_id, from_profile, to_profile, kind)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
             '22222222-2222-2222-2222-222222222222', 'soon') $$,
  '23514', 'nudge_too_soon',
  'but only once a minute'
);
select throws_ok(
  $$ insert into public.nudges (couple_id, from_profile, to_profile, kind)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222',
             '11111111-1111-1111-1111-111111111111', 'heart') $$,
  '42501', null,
  'A cannot nudge in B''s name'
);
select is(
  pg_temp.affected($$ update public.nudges set seen_at = now() $$),
  0,
  'A cannot mark their own nudge seen'
);
select throws_ok(
  $$ delete from public.nudges $$,
  '42501', null,
  'nobody deletes nudges'
);

select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.nudges where seen_at is null), 1, 'B reads the nudge');
select is(
  pg_temp.affected($$ update public.nudges set seen_at = now() $$),
  1,
  'B marks it seen'
);
select throws_ok(
  $$ update public.nudges set kind = 'ready' $$,
  '42501', null,
  'B cannot change what it said'
);
select lives_ok(
  $$ insert into public.nudges (couple_id, from_profile, to_profile, kind)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222',
             '11111111-1111-1111-1111-111111111111', 'ready') $$,
  'B nudges back (the minute is per sender)'
);

select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is((select count(*)::int from public.nudges), 0, 'C reads no other couple''s nudges');

-- ---------------------------------------------------------------------------
-- Tonight's question
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select lives_ok(
  $$ insert into public.question_answers (profile_id, couple_id, day, question, body)
     values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             (now() at time zone 'utc')::date, 7, 'The one with the heist.') $$,
  'A answers today''s question'
);
select throws_ok(
  $$ insert into public.question_answers (profile_id, couple_id, day, question, body)
     values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             (now() at time zone 'utc')::date + 1, 8, 'Too early.') $$,
  '42501', null,
  'nobody answers a day still to come'
);
select throws_ok(
  $$ insert into public.question_answers (profile_id, couple_id, day, question, body)
     values ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             (now() at time zone 'utc')::date, 7, 'Not mine to say.') $$,
  '42501', null,
  'A cannot answer for B'
);
select throws_ok(
  $$ insert into public.question_signals (profile_id, couple_id, day)
     values ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', current_date) $$,
  '42501', null,
  'members cannot write question signals'
);
select throws_ok(
  $$ update public.question_answers set question = 9 $$,
  '42501', null,
  'an answer''s question is fixed'
);

select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.question_answers), 0, 'B cannot read A''s answer before answering');
select is(
  (select array_agg(profile_id) from public.question_signals),
  array['11111111-1111-1111-1111-111111111111'::uuid],
  'but B can tell that A has answered'
);
select is(
  (select array_agg(column_name::text order by column_name::text) from information_schema.columns
   where table_schema = 'public' and table_name = 'question_signals'),
  array['changed_at', 'couple_id', 'day', 'profile_id'],
  'a question signal carries no text'
);
insert into public.question_answers (profile_id, couple_id, day, question, body)
values ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        (now() at time zone 'utc')::date, 7, 'Anything with a dog in it.');
select is((select count(*)::int from public.question_answers), 2, 'once B has answered, B reads both');
select is(
  (select count(*)::int from public.question_answers where day = (now() at time zone 'utc')::date - 1),
  0,
  'answering one day reveals nothing of another'
);

select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
insert into public.question_answers (profile_id, couple_id, day, question, body)
values ('33333333-3333-3333-3333-333333333333', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        (now() at time zone 'utc')::date, 7, 'Mine.');
select is(
  (select array_agg(profile_id) from public.question_answers),
  array['33333333-3333-3333-3333-333333333333'::uuid],
  'C, having answered the same day, still reads only their own couple''s answers'
);
select is((select count(*)::int from public.question_signals where couple_id <> 'cccccccc-cccc-cccc-cccc-cccccccccccc'), 0,
  'C reads no other couple''s signals');

-- ---------------------------------------------------------------------------
-- Comments and reactions
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.comments (id, couple_id, list_item_id, profile_id, body) values
  ('e0e0e0e0-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'a0a0a0a0-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'Saturday?');
insert into public.comments (id, couple_id, watch_night_id, profile_id, body) values
  ('e0e0e0e0-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'a1a1a1a1-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'That ending!');
select pass('A comments on a list item and on a night');
select throws_ok(
  $$ insert into public.comments (couple_id, list_item_id, watch_night_id, profile_id, body)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a0a0a0a0-0000-0000-0000-000000000000',
             'a1a1a1a1-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'Both?') $$,
  '23514', null,
  'a comment is about one thing'
);
select throws_ok(
  $$ insert into public.comments (couple_id, list_item_id, profile_id, body)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a0a0a0a0-0000-0000-0000-000000000000',
             '11111111-1111-1111-1111-111111111111', repeat('x', 501)) $$,
  '23514', null,
  'a comment is at most 500 characters'
);
select throws_ok(
  $$ insert into public.comments (couple_id, list_item_id, profile_id, body)
     values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'c0c0c0c0-0000-0000-0000-000000000000',
             '11111111-1111-1111-1111-111111111111', 'Hello?') $$,
  '42501', null,
  'A cannot comment in another couple'
);
select throws_ok(
  $$ update public.comments set body = 'Sunday?' $$,
  '42501', null,
  'comments are not edited'
);

select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.comments), 2, 'B reads both comments');
select is(
  pg_temp.affected($$ delete from public.comments where profile_id = '11111111-1111-1111-1111-111111111111' $$),
  0,
  'B cannot delete A''s comment'
);
select lives_ok(
  $$ insert into public.comment_reactions (comment_id, couple_id, profile_id, kind)
     values ('e0e0e0e0-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '22222222-2222-2222-2222-222222222222', 'heart') $$,
  'B reacts to A''s comment'
);
select throws_ok(
  $$ insert into public.comment_reactions (comment_id, couple_id, profile_id, kind)
     values ('e0e0e0e0-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '22222222-2222-2222-2222-222222222222', 'fire') $$,
  '23505', null,
  'one reaction each per comment'
);
select is(
  pg_temp.affected($$ update public.comment_reactions set kind = 'fire' $$),
  1,
  'B changes theirs'
);
select throws_ok(
  $$ insert into public.comment_reactions (comment_id, couple_id, profile_id, kind)
     values ('e0e0e0e0-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '22222222-2222-2222-2222-222222222222', 'thumbs') $$,
  '23514', null,
  'only the drawn stickers'
);

select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select is(
  pg_temp.affected($$ update public.comment_reactions set kind = 'cry' $$),
  0,
  'A cannot change B''s reaction'
);
select is(
  pg_temp.affected($$ delete from public.comments where id = 'e0e0e0e0-0000-0000-0000-000000000000' $$),
  1,
  'A deletes their own comment'
);
select is((select count(*)::int from public.comment_reactions), 0, 'and its reactions go with it');

select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is((select count(*)::int from public.comments), 0, 'C reads no other couple''s comments');

-- ---------------------------------------------------------------------------
-- Hidden episode reactions
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select lives_ok(
  $$ insert into public.episode_reactions (list_item_id, couple_id, profile_id, season, episode, kind, note)
     values ('a0a0a0a0-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '11111111-1111-1111-1111-111111111111', 1, 2, 'gasp', 'Did not see that coming.') $$,
  'A reacts to an episode they''ve watched'
);
select throws_ok(
  $$ insert into public.episode_reactions (list_item_id, couple_id, profile_id, season, episode, kind)
     values ('a0a0a0a0-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '11111111-1111-1111-1111-111111111111', 1, 4, 'gasp') $$,
  '42501', null,
  'but not to one still to watch'
);
select throws_ok(
  $$ insert into public.episode_reactions (list_item_id, couple_id, profile_id, season, episode, kind)
     values ('a0a0a0a0-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '11111111-1111-1111-1111-111111111111', 1, 1, 'gasp') $$,
  '42501', null,
  'and not to a film'
);
select throws_ok(
  $$ update public.episode_reactions set season = 2 $$,
  '42501', null,
  'a reaction stays on its episode'
);

select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.episode_reactions), 0, 'B cannot see A''s reaction before reacting');
select is(
  (select count(*)::int from public.episode_signals where season = 1 and episode = 2),
  1,
  'but can tell that A has reacted to that episode'
);
insert into public.episode_reactions (list_item_id, couple_id, profile_id, season, episode, kind)
values ('a0a0a0a0-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '22222222-2222-2222-2222-222222222222', 1, 3, 'laugh');
select is((select count(*)::int from public.episode_reactions), 1, 'reacting to another episode reveals nothing');
insert into public.episode_reactions (list_item_id, couple_id, profile_id, season, episode, kind)
values ('a0a0a0a0-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '22222222-2222-2222-2222-222222222222', 1, 2, 'cry');
select is(
  (select note from public.episode_reactions where profile_id = '11111111-1111-1111-1111-111111111111'),
  'Did not see that coming.',
  'once B reacts to the same episode, A''s shows'
);
select is(
  pg_temp.affected($$ delete from public.episode_reactions where profile_id = '11111111-1111-1111-1111-111111111111' $$),
  0,
  'B cannot take back A''s reaction'
);
select throws_ok(
  $$ insert into public.episode_signals (list_item_id, couple_id, profile_id, season, episode)
     values ('a0a0a0a0-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '22222222-2222-2222-2222-222222222222', 1, 1) $$,
  '42501', null,
  'members cannot write episode signals'
);

select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is((select count(*)::int from public.episode_signals), 0, 'C reads no other couple''s episode signals');

-- ---------------------------------------------------------------------------
-- Night photos and their storage
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner, owner_id) values
       ('night-photos', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/a1a1a1a1-0000-0000-0000-000000000000/f0f0f0f0-0000-0000-0000-000000000000.webp',
        '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111'),
       ('night-photos', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/a1a1a1a1-0000-0000-0000-000000000000/f0f0f0f0-0000-0000-0000-000000000000-thumb.webp',
        '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111') $$,
  'A uploads a photo to their couple''s folder for one of their nights'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner, owner_id) values
       ('night-photos', 'cccccccc-cccc-cccc-cccc-cccccccccccc/c1c1c1c1-0000-0000-0000-000000000000/x.webp',
        '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111') $$,
  '42501', null,
  'A cannot upload to another couple''s folder'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner, owner_id) values
       ('night-photos', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/c1c1c1c1-0000-0000-0000-000000000000/x.webp',
        '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111') $$,
  '42501', null,
  'nor under another couple''s night'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner, owner_id) values
       ('night-photos', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/a1a1a1a1-0000-0000-0000-000000000000/y.webp',
        '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222') $$,
  '42501', null,
  'nor in B''s name'
);
select lives_ok(
  $$ insert into public.night_photos (id, watch_night_id, couple_id, uploaded_by, path, thumb_path, bytes, width, height)
     values ('f0f0f0f0-0000-0000-0000-000000000000', 'a1a1a1a1-0000-0000-0000-000000000000',
             'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
             'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/a1a1a1a1-0000-0000-0000-000000000000/f0f0f0f0-0000-0000-0000-000000000000.webp',
             'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/a1a1a1a1-0000-0000-0000-000000000000/f0f0f0f0-0000-0000-0000-000000000000-thumb.webp',
             250000, 1600, 900) $$,
  'A records the photo'
);
select throws_ok(
  $$ insert into public.night_photos (id, watch_night_id, couple_id, uploaded_by, path, thumb_path, bytes, width, height)
     values ('f0f0f0f0-0000-0000-0000-000000000001', 'a1a1a1a1-0000-0000-0000-000000000000',
             'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
             'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/a1a1a1a1-0000-0000-0000-000000000000/f0f0f0f0-0000-0000-0000-000000000001.webp',
             'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/a1a1a1a1-0000-0000-0000-000000000000/f0f0f0f0-0000-0000-0000-000000000001-thumb.webp',
             250000, 1600, 900) $$,
  '42501', null,
  'a photo row needs its uploaded files'
);

select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'night-photos'), 2, 'B reads the couple''s photo files');
select is((select count(*)::int from public.night_photos), 1, 'and the photo');
select throws_ok(
  $$ insert into public.night_photos (id, watch_night_id, couple_id, uploaded_by, path, thumb_path, bytes, width, height)
     values ('f0f0f0f0-0000-0000-0000-000000000000', 'a1a1a1a1-0000-0000-0000-000000000001',
             'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222',
             'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/a1a1a1a1-0000-0000-0000-000000000000/f0f0f0f0-0000-0000-0000-000000000000.webp',
             'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/a1a1a1a1-0000-0000-0000-000000000000/f0f0f0f0-0000-0000-0000-000000000000-thumb.webp',
             1, 1, 1) $$,
  '42501', null,
  'B cannot claim A''s files under another night'
);
select set_config('storage.allow_delete_query', 'true', true);
select is(
  pg_temp.affected($$ delete from storage.objects where bucket_id = 'night-photos' $$),
  0,
  'B cannot delete A''s photo files'
);
select is(
  pg_temp.affected($$ delete from public.night_photos $$),
  0,
  'nor A''s photo'
);

select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'night-photos'), 0, 'C reads no other couple''s photo files');
select is((select count(*)::int from public.night_photos), 0, 'nor their photos');
select is(
  pg_temp.affected($$ delete from storage.objects where bucket_id = 'night-photos' $$),
  0,
  'nor deletes them'
);

-- The album is full at 30 photos.
reset role;
insert into public.night_photos (id, watch_night_id, couple_id, uploaded_by, path, thumb_path, bytes, width, height)
select id, 'a1a1a1a1-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       '22222222-2222-2222-2222-222222222222',
       'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/a1a1a1a1-0000-0000-0000-000000000000/' || id || '.webp',
       'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/a1a1a1a1-0000-0000-0000-000000000000/' || id || '-thumb.webp',
       1000, 10, 10
from (select gen_random_uuid() as id from generate_series(1, 29)) as photos;
select throws_ok(
  $$ insert into public.night_photos (id, watch_night_id, couple_id, uploaded_by, path, thumb_path, bytes, width, height)
     values ('f0f0f0f0-0000-0000-0000-0000000000ff', 'a1a1a1a1-0000-0000-0000-000000000000',
             'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222',
             'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/a1a1a1a1-0000-0000-0000-000000000000/f0f0f0f0-0000-0000-0000-0000000000ff.webp',
             'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/a1a1a1a1-0000-0000-0000-000000000000/f0f0f0f0-0000-0000-0000-0000000000ff-thumb.webp',
             1000, 10, 10) $$,
  '23514', 'night_album_full',
  'a night holds 30 photos'
);
delete from public.night_photos where uploaded_by = '22222222-2222-2222-2222-222222222222';

-- A cancels the night: the photo row goes with it, and either of them may clear the files left behind.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
delete from public.watch_nights where id = 'a1a1a1a1-0000-0000-0000-000000000000';
select is((select count(*)::int from public.night_photos), 0, 'cancelling a night removes its photos');
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is(
  pg_temp.affected($$ delete from storage.objects where bucket_id = 'night-photos' $$),
  2,
  'B may clear a cancelled night''s files'
);

-- Functions are callable only where they should be.
reset role;
select ok(
  not has_function_privilege('anon', 'public.has_answered(date)', 'execute')
  and not has_function_privilege('anon', 'public.can_add_night_photo(text)', 'execute')
  and not has_function_privilege('authenticated', 'public.check_nudge()', 'execute')
  and not has_function_privilege('authenticated', 'public.sync_question_signal()', 'execute')
  and not has_function_privilege('authenticated', 'public.sync_episode_signal()', 'execute')
  and not has_function_privilege('authenticated', 'public.check_night_photo()', 'execute'),
  'trigger functions are not callable, and the helpers are not open to anonymous visitors'
);

select * from finish();
rollback;
