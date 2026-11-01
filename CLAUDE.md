# Two Couches

A private shared watchlist and movie-night calendar for two people who live in different countries. For any film or series it shows which streaming services carry it in each person's country, and highlights titles both people can watch.

This repo is public. Never commit personal details: real names, emails, which countries or cities the two users live in, or anything from `CLAUDE.local.md` or `two-couches-plan.html` (both local-only and git-ignored). Use neutral examples in code, tests and docs (`one@example.com`, `GB`, `NZ`). If `two-couches-plan.html` exists locally, read it before starting a new sprint.

## Status

- Sprint 0 (Foundations): finished 2026-11-01. Live on Vercel with a hosted Supabase project (Singapore); both users signed in and paired. Auth emails go through custom SMTP, so the templates in `supabase/templates` are pasted into the hosted project by hand.
- Sprint 1 (Search and where to watch): in progress. Search page, title page, both countries' providers, "available in both" badge, Supabase caching.
- Update this section as sprints finish.

## Stack (decided)

- **Language:** TypeScript everywhere.
- **App:** Next.js (App Router) + Tailwind CSS, built as an installable PWA.
- **Hosting:** Vercel Hobby plan (free), deployed from GitHub.
- **Backend:** Supabase Free plan: Postgres, Auth, Realtime, scheduled jobs (pg_cron).
- **Movie/TV data:** TMDB API. Per-country availability comes from TMDB's `watch/providers` endpoint (JustWatch data).
- **Optional later:** Streaming Availability API or Watchmode (deep links, leaving soon); an LLM for "mood" search.

Don't add other frameworks or services without discussing it first. Everything must stay within free tiers for v1.

## Rules

### Security
- Never store passwords. Auth is Supabase Auth with Google sign-in or magic links.
- Every table has row-level security (RLS). A user may only read or write rows belonging to their own couple.
- Sign-ups are closed (or limited to an allowlist of two emails) once both users have joined.
- The TMDB key and any other secrets live in `.env.local` and Vercel environment variables. They are used only in server code (route handlers, server actions, cron jobs), never in client components or `NEXT_PUBLIC_*` variables.
- `.env*` is in `.gitignore` from the first commit.
- Never store streaming-service credentials. Profiles store only which services each person subscribes to.

### Data and APIs
- The browser never calls TMDB directly. All TMDB requests go through server routes that add the key and cache results in Supabase for about 24 hours.
- Countries are never hard-coded. Each profile stores an ISO 3166-1 code (`profiles.country`), which is also the TMDB `watch_region`. Fetch providers for both partners' countries.
- "Available in both" means: a subscription (`flatrate`) provider in my country that I pay for, and one in my partner's country that they pay for. Treat rent/buy/free separately.
- Store all times in UTC. Display in each profile's own IANA time zone (e.g. `Europe/London`); zones differ in daylight saving, so never assume a fixed offset between the two people.
- Bilingual UI: the supported languages are `LANGUAGES` in `src/lib/places.ts`. Request TMDB data with the viewer's language and country, e.g. `en-GB`.
- Show TMDB and JustWatch attribution, as their terms require.

### Scope
- The app is a list, a scheduler and a coordinator. It must never host, link to or distribute media files. Synced watching (Phase 2) only stores things like a Syncplay room name, a Teleparty link and "ready" flags.

## Data model

| Table | Purpose | Key fields |
|---|---|---|
| `profiles` | Each user | display name, country (ISO code), language, time zone, subscribed services |
| `couples` | The pair | invite code (8 chars). Members are the `profiles` rows whose `couple_id` points here (max 2). |
| `titles` | Cached TMDB data | tmdb_id, media type (movie/tv), title, poster, genres, runtime, refreshed_at |
| `list_items` | Shared list | title, added_by, status (want/watching/watched/dropped), categories, notes, rating per person, watched_on, TV progress |
| `title_texts` | Cached TMDB text per locale | title, locale (`en-GB`), title text, overview, tagline, genre names, trailer key, refreshed_at |
| `availability` | Latest provider list per title and country | media type, tmdb_id, country, provider, kind (flatrate/free/ads/rent/buy). No FK to `titles`, so search results can be checked before they're opened. |
| `availability_checks` | When each title was last checked in each country | media type, tmdb_id, country, TMDB watch link, checked_at. Records "checked, nothing there" too. |
| `watch_nights` | Scheduled sessions | title, starts_at (UTC), method (teleparty/syncplay), ready flag per person, room/link |
| `services` | Cached TMDB provider list per country | country, provider_id (TMDB), name, logo, display_priority, refreshed_at |
| `signup_allowlist` | Emails allowed to sign up | email. No RLS policies: managed only from the SQL editor. |

Built so far: `profiles`, `couples`, `services`, `signup_allowlist` (migration `20261101000000_foundations.sql`); `titles`, `title_texts`, `availability`, `availability_checks` (`20261101093123_titles_and_availability.sql`). The four Sprint 1 tables are shared caches like `services`: signed-in users read, only the server writes. `profiles.services` holds TMDB provider IDs. Users can update only their own settings columns; `couple_id` changes only through the `create_couple()` / `join_couple(code)` functions.

Manage schema changes as Supabase migrations in the repo, not by editing tables in the dashboard.

## Sprint roadmap

Two-week sprints, each ending with something both users can use.

0. **Foundations:** scaffold Next.js, deploy to Vercel, Supabase Auth, `profiles` + `couples`, invite code, RLS, profile settings.
1. **Search and where to watch:** TMDB proxy routes, title page, both countries' providers side by side, "available in both" badge, caching, attribution.
2. **Shared list:** add/remove, statuses, categories, notes, ratings, Watched view, Realtime sync, TV progress.
3. **Browse:** TMDB `discover` with `watch_region` + `with_watch_providers`, filters, "we can both watch this" toggle, bilingual UI.
4. **Coming soon and alerts:** upcoming releases, daily provider re-check job, alerts when a saved title becomes available in both countries.
5. **For you and watch nights:** recommendation scoring from TMDB `/recommendations` weighted by both ratings, "not interested", watch-night calendar with both local times.
6. **Polish:** PWA install, dark mode, empty/loading states, stats.
- **Phase 2:** synced-watching coordination (ready checks, Syncplay room details, matching file versions).

## Commands

- `npm run dev`: dev server at http://localhost:3000 (needs `npm run db:start` and Docker running)
- `npm run lint`, `npm run typecheck`, `npm run build`
- `npm run db:reset`: rebuild the local DB from `supabase/migrations` + `supabase/seed.sql`
- `npm run db:test`: pgTAP tests in `supabase/tests` (RLS and couple rules). Add a test for every new table's policies.
- `npm run db:types`: regenerate `src/lib/supabase/database.types.ts` after changing the schema
- New migration: `npx supabase migration new <name>`
- Local sign-in emails: Mailpit at http://127.0.0.1:54324. Local allowlisted users: `one@example.com`, `two@example.com`.

## Code conventions

- Next.js 16 with `cacheComponents`: anything that reads cookies, the session or `searchParams` renders inside a `<Suspense>` boundary. Don't put per-user data in `use cache`.
- Auth middleware lives in `src/proxy.ts` (Next 16 renamed `middleware` to `proxy`).
- Server-side Supabase: `createClient()` from `src/lib/supabase/server.ts` (acts as the user, RLS applies). `createAdminClient()` bypasses RLS and is only for shared caches like `services`.
- Get the current user with `getCurrentProfile()` / `requireProfile()` from `src/lib/session.ts`.
- TMDB calls go through `tmdbGet()` in `src/lib/tmdb.ts` (server only). Titles and availability are cached in Supabase by `getTitle()` / `getAvailability()` in `src/lib/titles.ts`; search results are throwaway, so `searchTitles()` uses Next's fetch cache (`revalidate`) instead.
- "Who can watch it" rules live in `whoCanWatch()` in `src/lib/watch.ts` (pure, client-safe). Use it rather than re-deriving "available in both".
- TMDB images (posters, logos) use `next/image` with `unoptimized` and TMDB's own sizes (`tmdbImage()`), to stay clear of Vercel's image-optimisation quota.
- Colours: ochre `me`, teal `partner`, green `both` only where the two overlap (see `globals.css`).

@AGENTS.md
@CLAUDE.local.md
