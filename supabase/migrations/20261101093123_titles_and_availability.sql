-- Sprint 1: cached TMDB titles and per-country streaming availability.
--
-- Access model:
--   * These are shared caches, like services: nothing here belongs to a couple. Any signed-in user can
--     read them; only the server (secret key) writes them, refreshing rows older than about a day.
--   * Availability has no foreign key to titles, so search results can show providers for titles
--     that haven't been opened (and cached) yet.

-- Language-neutral details of a film or series. Sprint 2's list_items will reference this table.
create table public.titles (
  media_type text not null check (media_type in ('movie', 'tv')),
  tmdb_id integer not null check (tmdb_id > 0),
  original_title text not null,
  original_language text,
  -- First air date for series.
  release_date date,
  poster_path text,
  backdrop_path text,
  genre_ids integer[] not null default '{}',
  -- Minutes. For series, a typical episode when TMDB knows it.
  runtime integer,
  seasons integer,
  vote_average numeric(3, 1),
  refreshed_at timestamptz not null default now(),
  primary key (media_type, tmdb_id)
);

-- Text for a title in one TMDB locale, e.g. 'en-GB'. Each viewer gets their own language.
create table public.title_texts (
  media_type text not null,
  tmdb_id integer not null,
  locale text not null check (locale ~ '^[a-z]{2}-[A-Z]{2}$'),
  title text not null,
  overview text not null default '',
  tagline text not null default '',
  genres text[] not null default '{}',
  -- YouTube video key of the trailer, if any.
  trailer_key text,
  refreshed_at timestamptz not null default now(),
  primary key (media_type, tmdb_id, locale),
  foreign key (media_type, tmdb_id) references public.titles (media_type, tmdb_id) on delete cascade
);

-- Services carrying a title in a country, as of the latest check (TMDB /watch/providers, JustWatch data).
create table public.availability (
  media_type text not null check (media_type in ('movie', 'tv')),
  tmdb_id integer not null,
  country text not null check (country ~ '^[A-Z]{2}$'),
  provider_id integer not null,
  kind text not null check (kind in ('flatrate', 'free', 'ads', 'rent', 'buy')),
  provider_name text not null,
  logo_path text,
  display_priority integer not null default 999,
  primary key (media_type, tmdb_id, country, provider_id, kind)
);

-- When each title was last checked in each country. Needed because "checked, nothing there" leaves no
-- availability rows.
create table public.availability_checks (
  media_type text not null check (media_type in ('movie', 'tv')),
  tmdb_id integer not null,
  country text not null check (country ~ '^[A-Z]{2}$'),
  -- TMDB's where-to-watch page for this title and country (JustWatch attribution).
  link text,
  checked_at timestamptz not null default now(),
  primary key (media_type, tmdb_id, country)
);

-- ---------------------------------------------------------------------------
-- Privileges and row-level security
-- ---------------------------------------------------------------------------

alter table public.titles enable row level security;
alter table public.title_texts enable row level security;
alter table public.availability enable row level security;
alter table public.availability_checks enable row level security;

revoke all on public.titles, public.title_texts, public.availability, public.availability_checks from anon, authenticated;

grant select on public.titles, public.title_texts, public.availability, public.availability_checks to authenticated;
-- Explicit, so the cache keeps working if the project stops granting new tables to API roles by default.
grant select, insert, update, delete
on public.titles, public.title_texts, public.availability, public.availability_checks
to service_role;

create policy "signed-in users read titles"
on public.titles for select
to authenticated
using (true);

create policy "signed-in users read title texts"
on public.title_texts for select
to authenticated
using (true);

create policy "signed-in users read availability"
on public.availability for select
to authenticated
using (true);

create policy "signed-in users read availability checks"
on public.availability_checks for select
to authenticated
using (true);
