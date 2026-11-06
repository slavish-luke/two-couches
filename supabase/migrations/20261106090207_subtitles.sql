-- Subtitles from OpenSubtitles for the watch room (src/lib/opensubtitles.ts). Each subtitle file the
-- couple downloads is kept here as WebVTT, so picking it again (or on the other screen) doesn't spend
-- another of the account's daily downloads. A shared cache like availability_snapshots: server only
-- (admin client), no policies, nothing per couple in it.

create table public.subtitle_files (
  -- OpenSubtitles' file ID.
  file_id bigint primary key check (file_id > 0),
  language text not null check (language ~ '^[a-z]{2}(-[a-z]{2})?$'),
  release text not null default '' check (char_length(release) <= 300),
  vtt text not null check (char_length(vtt) between 1 and 2000000),
  created_at timestamptz not null default now()
);

alter table public.subtitle_files enable row level security;
revoke all on public.subtitle_files from anon, authenticated;
