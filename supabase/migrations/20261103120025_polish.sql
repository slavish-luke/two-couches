-- Sprint 6: per-language posters and episode counts (for hours watched on the stats page).

-- TMDB picks a poster for the requested language, so it belongs with the rest of a locale's text.
-- Null on rows cached before this column existed; readers fall back to titles.poster_path.
alter table public.title_texts add column poster_path text;

-- Total episodes of a series, from TMDB. Null for films and when TMDB doesn't say.
alter table public.titles add column episodes integer check (episodes > 0);
