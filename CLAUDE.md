# Two Couches

A private shared watchlist and movie-night calendar for two people who live in different countries. For any film or series it shows which streaming services carry it in each person's country, and highlights titles both people can watch.

This repo is public. Never commit personal details: real names, emails, which countries or cities the two users live in, or anything from `CLAUDE.local.md` or `two-couches-plan.html` (both local-only and git-ignored). Use neutral examples in code, tests and docs (`one@example.com`, `GB`, `NZ`). If `two-couches-plan.html` exists locally, read it before starting a new sprint.

## Status

- Sprint 0 (Foundations): finished 2026-11-01. Live on Vercel with a hosted Supabase project (Singapore); both users signed in and paired. Auth emails go through custom SMTP, so the templates in `supabase/templates` are pasted into the hosted project by hand.
- Sprint 1 (Search and where to watch): finished 2026-11-01 and live. `/search` (badge per result), `/title/[type]/[id]` (both countries side by side, "available in both" banner), Supabase caches for titles and availability, custom not-found page.
- Sprint 2 (Shared list): finished 2026-11-01. Home page is the list (tabs Up next / Watched / Dropped; filters for type, category and "we can both watch"; badge per item). Title page has an "On our list" panel (status, TV progress, watched date, both ratings, categories, shared note, remove). Search results have "+ Add". Changes sync live between the two screens via Supabase Realtime.
- Sprint 3 (Browse): finished 2026-11-01. `/browse`: Films/Series tabs; rows for worldwide trending (TMDB's trending isn't per country) and "popular on streaming" in each partner's country; filters for service (chips for services either of you pays for), genre, decade, rating and sort; "We can both watch" toggle, on by default. The whole UI is in English and Turkish, following each profile's language (signed-out pages follow the browser).
- Sprint 4 (Coming soon and alerts): finished 2026-11-01. `/coming-soon` (nav "Coming soon", with a dot for unseen alerts): "Now streaming" alerts; Films tab with "In cinemas" and "Coming to digital" rows across both countries (each card shows the date in each country) and a "Remind us" button; Series tab with next episodes of list series and new episodes this fortnight on each person's services. Title page has "Remind us when it's streaming" unless you can both watch it. A daily job (pg_cron at 09:00 UTC → pg_net → `POST /api/cron/daily` with `CRON_SECRET`) re-checks list titles (want/watching) and reminders, writes alerts and sends web push. Settings has a Notifications section (turn on/off per device, send a test). Minimal `manifest.ts` so iPhones can add the app to the Home Screen (needed for push there).
- Done by hand for Sprint 4 (hosted): Vercel env vars `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`; Vault secrets `app_url` and `cron_secret` in the hosted Supabase (README "The daily check"). Without the Vault secrets the job runs but does nothing.
- Sprint 5 (For you and watch nights): finished 2026-11-02. Browse opens with a "For you" row (per Films/Series tab, page 1 unfiltered): suggestions from TMDB `/recommendations` for the couple's list titles, scored by both ratings, each card saying which liked title led to it, with "Not interested" (also on title pages not on the list, where it can be undone). `/watch-nights` (nav "Watch nights"): upcoming nights grouped by your day plus the last 5, each with both local times, how you'll watch (Teleparty link, Syncplay server and room, or something else), note, Edit and "Add to calendar" (.ics). `/watch-nights/new` (also "Plan a watch night" on title pages, which picks that title) and `/watch-nights/[id]` (edit, cancel): pick a title from Up next or decide later, a day, and an hour from a grid rated for both zones. Planning, moving, retitling or cancelling a night pushes a notification to the partner. Home shows the next watch night.
- Next: Sprint 6 (Polish).
- Known issues: Sprint 5 wasn't tried in a real phone browser; Server Actions, the .ics file and pages were checked with curl and headless Edge, but the partner push (no local push subscriptions) was not delivered to a device. Posters are one per title (`titles.poster_path`), so whichever partner's locale was cached last decides the poster both see (e.g. a Turkish poster in English). Watch nights have no ready flags yet (Phase 2). `next dev` logs a `Date.now()` prerender warning from `AccountNav` in `layout.tsx` (pre-dates Sprint 1; build and production are fine). Page `<title>`s and the auth emails in `supabase/templates` are still English only. With "We can both watch" on, each Browse page checks 60 titles (3 TMDB pages) and shows the ones that pass, so a page can hold fewer than 60; the first, uncached load takes a few seconds. List titles show in the viewer's language when it's cached (both partners' locales are cached on add); otherwise the partner's or the original title until the title page is opened. TV progress is a plain season/episode counter (no per-season episode counts from TMDB yet). Not tried in a real browser at hand-off (the job, alerts, reminders and push encryption were tested locally with curl): push delivery to a phone (use Settings → "Send a test"), and the nav's alert dot clearing once Coming soon is opened (`markAlertsSeen()` then `refresh()`). The app has no icons yet, so notifications and the Home Screen use defaults until Sprint 6. TMDB's digital release dates are sparse in some countries, so "Coming to digital" can be patchy.
- Local test data: `npm run db:reset` wipes local users. Recreate them by signing in as `one@example.com` / `two@example.com` (Mailpit) and pairing with an invite code.

### End of every sprint (each sprint runs in a fresh session)
1. `npm run typecheck`, `npm run lint`, `npm run build`, `npm run db:test` all pass.
2. With the user's go-ahead: `npx supabase db push` first, then commit and push to `main` (Vercel deploys from it).
3. Update this Status section: mark the sprint finished with the date, set "Next", record known issues and anything done by hand outside the repo. Update the data model table and conventions if they changed.
4. Tell the user the sprint is ready to hand off, so they can start the next one in a new session.

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
| `list_items` | Shared list | couple, title (FK to `titles`, once per couple), added_by, status (want/watching/watched/dropped), categories (free text, max 10 × 30 chars), one shared note, season/episode (last watched), watched_on (local date) |
| `list_ratings` | Each person's rating of a list item | list item, couple (copied for Realtime filters), profile, rating 1–5 |
| `title_texts` | Cached TMDB text per locale | title, locale (`en-GB`), title text, overview, tagline, genre names, trailer key, refreshed_at |
| `availability` | Latest provider list per title and country | media type, tmdb_id, country, provider, kind (flatrate/free/ads/rent/buy). No FK to `titles`, so search results can be checked before they're opened. |
| `availability_checks` | When each title was last checked in each country | media type, tmdb_id, country, TMDB watch link, checked_at. Records "checked, nothing there" too. |
| `reminders` | "Tell us when it's streaming" | couple, title (FK to `titles`, once per couple), created_by. Retired by the daily job once both can stream it. |
| `alerts` | What the daily job found | couple, title, kind (both/one), services (provider names by profile ID), created_at. `profiles.alerts_seen_at` marks what each person has seen. |
| `push_subscriptions` | Web push per person per device | profile, endpoint (https), p256dh, auth |
| `availability_snapshots` | What the daily job last saw | media type, tmdb_id, country, subscription provider IDs, recorded_at. Server only (no policies). |
| `watch_nights` | Scheduled sessions | couple, title (FK to `titles`, optional: null = decide later), starts_at (UTC), method (teleparty/syncplay/other, or null), link (https), syncplay server and room, note, created_by. Ready flags come in Phase 2. |
| `dismissed_titles` | "Not interested" | couple, media type, tmdb_id, dismissed_by. No FK to `titles` (suggestions aren't cached). |
| `services` | Cached TMDB provider list per country | country, provider_id (TMDB), name, logo, display_priority, refreshed_at |
| `signup_allowlist` | Emails allowed to sign up | email. No RLS policies: managed only from the SQL editor. |

Built so far: `profiles`, `couples`, `services`, `signup_allowlist` (migration `20261101000000_foundations.sql`); `titles`, `title_texts`, `availability`, `availability_checks` (`20261101093123_titles_and_availability.sql`); `list_items`, `list_ratings` (`20261101100346_shared_list.sql`). The four Sprint 1 tables are shared caches like `services`: signed-in users read, only the server writes. `profiles.services` holds TMDB provider IDs. Users can update only their own settings columns; `couple_id` changes only through the `create_couple()` / `join_couple(code)` functions. Both members read and edit their couple's `list_items` (couple, title and added_by are fixed); each person writes only their own `list_ratings` row. Both list tables are in the `supabase_realtime` publication. Sprint 4 (`20261101111625_coming_soon_and_alerts.sql`) added `reminders` (members read/set/clear; in Realtime), `alerts` (members read; only the job writes), `push_subscriptions` (each person their own), `availability_snapshots` (server only), `profiles.alerts_seen_at` (user-updatable), the `pg_net`/`pg_cron` extensions, `request_daily_check()` (reads `app_url`/`cron_secret` from Vault; not callable by API roles) and the `daily-check` cron job. Sprint 5 (`20261101145150_for_you_and_watch_nights.sql`) added `dismissed_titles` and `watch_nights`: both members read, add, change (nights) and delete their couple's rows; couple and who created a row are fixed; both tables are in Realtime.

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
- List rules (statuses, category limits, progress, local dates) live in `src/lib/list-rules.ts` (pure, client-safe); list queries in `src/lib/list.ts`; list mutations are the Server Actions in `src/app/list/actions.ts`, which run as the user and call `refresh()`.
- Live updates: render `<ListSync coupleId>` on any page that shows list data (it also covers reminders, dismissals and watch nights). It subscribes to Realtime as the signed-in user (must `realtime.setAuth()` first, or RLS hides every insert/update) and calls `router.refresh()`. Realtime can't filter deletes, so those are subscribed unfiltered.
- pgTAP tests start by clearing users and caches inside their transaction (rolled back), so they pass with local sign-ins present.
- UI text: no hard-coded strings. Each area has a namespace in `src/lib/i18n/` exporting `{ en, tr }` (`tr` typed as `typeof en`); text that varies is a function. Server components call `getI18n()` from `src/lib/i18n/server.ts` (inside `<Suspense>`); client and shared components take a `language` prop and call `getMessages(language)`. In Turkish, never attach a suffix to an interpolated name or country (write "Ekleyen: {name}", not "{name}'ın"). Page-level `<Suspense>` fallbacks use the wordless `<PageLoading />`.
- Browse: discover, trending and genres are in `src/lib/browse.ts` and use Next's fetch cache (6 h; genres 24 h), like search. `getAvailability()` de-duplicates its input and checks at most 20 titles at once against TMDB.
- Alerts: the rules are pure in `src/lib/alert-rules.ts` (`alertFor()`, `reminderDone()`, `describeAlert()` for wording on the page and in pushes). List titles alert only when they become watchable for both; reminders also when one of you first can. "Before" and "now" are both judged by today's services, so changing settings never alerts. When a title is added to the list or gets a reminder, call `recordBaseline()` (`src/lib/alerts.ts`) so the next check compares with today.
- The daily job is `runDailyCheck()` in `src/lib/daily-check.ts`, run by `src/app/api/cron/daily/route.ts`. It uses the admin client (no user), passing it to `getAvailability(…, { client, maxAgeMs })`. Push goes through `sendPush()` in `src/lib/push.ts` (`web-push`; ended subscriptions are deleted); the service worker is `public/sw.js`. To test locally: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/daily`, or put `app_url` = `http://host.docker.internal:3000` and `cron_secret` in local Vault and `select public.request_daily_check()`.
- Coming soon data (`src/lib/upcoming.ts`) uses Next's fetch cache like browse (6 h; release dates 24 h). Use `<TitleCard>` (`src/components/title-card.tsx`) for poster cards; pass `availability: null` to skip badges.
- Actions that need a couple use `requireCoupleProfile()`; saving a title for the couple goes through `cacheForCouple()` (caches both partners' locales first) in `src/lib/list.ts`.
- `src/proxy.ts` lets `/api/cron`, `/sw.js` and `/manifest.webmanifest` through without a session.
- For you: seed weights and scoring are pure in `src/lib/recommend-rules.ts` (`seedWeight()`: each rating counts from 3★, so split opinions cancel and shared 4★+ get a bonus; unrated list titles count a little, dropped ones against; `scoreSuggestions()`, `rankForCouple()` boosts by `whoCanWatch()`). `getForYou()` in `src/lib/recommend.ts` fetches recommendations with Next's fetch cache (24 h), excluding list and dismissed titles. The row is `src/app/browse/for-you.tsx`; `dismissTitle()` is in `src/app/browse/actions.ts`.
- Watch nights: time-zone maths and rules are pure in `src/lib/night-rules.ts` (`zonedToUtc()`, `hoursOfDay()`, `rateSlot()`: evenings and weekend afternoons are free time, midnight to 8 am asleep; `toIcs()`). The form sends a local date and time; the server converts them with the planner's own profile time zone. Queries and `notifyPartner()` (admin client, partner's language and zone, run in `after()`) are in `src/lib/nights.ts`; actions in `src/app/watch-nights/actions.ts` redirect to `/watch-nights` on success.
- Colours: ochre `me`, teal `partner`, green `both` only where the two overlap (see `globals.css`).

@AGENTS.md
@CLAUDE.local.md
