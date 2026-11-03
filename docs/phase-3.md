# Phase 3: small extras, in parallel blocks

Five small features in four blocks. Each block runs in its own session on its own branch and git
worktree, at the same time as the others, then they're merged one by one. Read `CLAUDE.md` first: its
rules, stack and conventions apply to every block.

Left out on purpose: the 3-2-1 countdown (Teleparty syncs itself; the synced player will cover own
files) and "one year ago tonight" (no history yet; do it with a Letterboxd/Trakt import). Bigger ideas for
later sprints: the synced player, swipe to match, history import, AI mood search (costs money).

## How to run a block

1. From the main checkout: `git worktree add ../two-couches-<block> -b phase3/<block>` (block names below),
   then copy `.env.local` into the worktree (it's git-ignored) and run `npm install` there.
2. Open a session in that folder: "Build block <N> from docs/phase-3.md."
3. Work only in the files the block owns. Touch shared files only as described under "Shared files".
4. Finish with `npm run typecheck`, `npm run lint`, `npm run build`, `npm run db:test` passing, then commit
   on the branch. Don't push to `main` and don't run `supabase db push`: that happens once, at integration.
5. Write your handoff notes (what's done, known issues, conventions, data model rows) in the block's
   "Handoff notes" section at the bottom of this file, on your branch.

### Or: one session running the four blocks as agents

One session can launch the four blocks at once as agents, each with `isolation: "worktree"` (the
worktree is created for it, so skip step 1's `git worktree add`), then do the integration itself when all
four have reported back. Each agent's brief: "Build block N from docs/phase-3.md". Tell it its branch
name and port, and tell it to copy `.env.local` from the main checkout (give
it the path) and run `npm install` in its worktree first. Each agent commits on
its branch and reports the branch name, what it built, what it couldn't check, and anything it changed
outside the files its block owns.

### One local Supabase for everyone

All blocks share the one local Supabase stack (Docker), so:

- **Never run `npm run db:reset`** while blocks are in progress: it wipes the local users and every other
  block's tables.
- Create your migration with `npx supabase migration new <name>`, then apply it with
  `docker exec -i supabase_db_two-couches psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/<file>.sql`
  (not `supabase migration up`, which trips over other blocks' unknown migrations).
- `npm run db:types` reads the shared database, so it may include other blocks' tables. That's fine:
  commit it; it's regenerated at integration.
- pgTAP files clear tables inside their transaction and roll back, so tests can run alongside each other
  (one may wait for another's locks).
- Dev servers: block 1 uses port 3001, block 2 3002, block 3 3003, block 4 3004 (`npx next dev -p 300N`).
  Sign-ins are `one@example.com` / `two@example.com` (already paired).

### Shared files

These are touched by several blocks. Keep edits small and additive so merges stay trivial:

| File | Rule |
|---|---|
| `src/lib/i18n/index.ts` | Add your own namespace file (named per block) and register it: one import and one key per language. |
| `src/lib/i18n/common.ts` | Only add your page-title keys to `pageTitles`. |
| `src/app/page.tsx` (home) | Blocks 1, 2 and 3 each add one self-contained component, in its own `<Suspense>`, with a one-line insertion. Put the component in its own file. |
| `src/components/list-sync.tsx` | Only add your table name to the array. |
| `src/lib/supabase/database.types.ts` | Regenerate, never edit by hand. Conflicts are resolved by regenerating. |
| `CLAUDE.md` | Don't edit. Your notes go in your Handoff notes; integration copies them in. |

## Block 1: After the night (wrap-up and hidden reviews)

Branch `phase3/after-night`. Namespace `reviews`.

**What it does**
- When a watch night with a title has ended (start + runtime, or `DEFAULT_LENGTH_MIN` for series, has
  passed) in the last 7 days, the home page shows "How was {title}?" to each person until they've dealt
  with it. One card per night. For a film: mark watched (watched_on = the night's local date in the viewer's
  zone), your rating, an optional short review. For a series: move progress on by one episode (editable),
  rating optional. "Not now" hides it for that person.
- Hidden reviews: each person can write a short review of any list item (up to 1,000 characters). You see
  your partner's review only once you've written your own; until then it says "{name} has written theirs:
  write yours to see it". Shown on the title page's "On our list" panel and in the wrap-up card.

**Data**
- `list_reviews`: list item, couple (copied for Realtime), profile, body, created_at, updated_at. FK to
  `list_items (id, couple_id)` on delete cascade, like `list_ratings`. Each person writes only their own.
  Select: your own rows, and a partner's row only when you have a row for the same item (use a security
  definer helper such as `public.has_reviewed(list_item_id)` so the policy doesn't recurse). Test that the
  partner's text is invisible until you've written yours.
- Dismissing a wrap-up: a small `night_wrapups` table (watch night, couple, profile, done_at), own rows
  only, or reuse a column if you find a cleaner fit. Deleting the night deletes it.
- Add both tables to Realtime and `ListSync`.

**Owns:** new `src/app/after-night/*`, `src/lib/review-rules.ts`, `src/lib/reviews.ts`,
`src/lib/i18n/reviews.ts`, `src/app/title/[type]/[id]/list-panel.tsx`. Reuse the list actions in
`src/app/list/actions.ts` for status, rating and progress rather than duplicating them (adding a small
export there is fine).
**Home page:** one `<AfterNight />` insertion above "Next watch night".

## Block 2: Pick for tonight ("we have 2 hours")

Branch `phase3/pick`. Namespace `pick`. No migration.

**What it does**
- A `/pick` page (linked from the home page as "Pick something for tonight"): say how long you have,
  either in minutes or as "until it's too late for one of us". The second option uses both time zones and
  `fitFor()` from `night-rules.ts`: it must end before 23:00 for both. Then get one suggestion at a time,
  with "Another" and "Plan it" (to `/watch-nights/new` with that title) or "Watch now".
- Candidates: Up next (want/watching), plus the For you row's suggestions as a second tier. Default to
  titles you can both watch (`whoCanWatch()`), with a toggle to include the rest. Films must fit by
  runtime; a series fits by one episode (TMDB `episode_run_time`, or 45 min if unknown). Unknown film
  runtimes are allowed but ranked last. Prefer titles in progress (watching), then older adds.
- Random but stable for a session: seed from the date and the "Another" count, so both screens can land
  on the same pick if they press the same buttons.

**Owns:** `src/app/pick/*`, `src/lib/pick-rules.ts` (pure: filtering, fit, ranking, seeded shuffle),
`src/lib/i18n/pick.ts`. Read from `src/lib/list.ts`, `src/lib/recommend.ts`, `src/lib/titles.ts`
without changing their signatures (add a small helper if needed).
**Home page:** one link or card insertion near the search box. **Nav:** none (it's reached from home).

## Block 3: Places and services (subscription advisor and same couch mode)

Branch `phase3/places`. Namespace `places`.

**Subscription advisor**
- In Settings, under your services: "What would another service get you?" For each subscription
  (`flatrate`) service offered in your country that you don't pay for, count the Up next titles that would
  become watchable for both of you, and for you, if you added it. Show the top 5 with counts and a few
  posters, and the services you pay for that currently unlock nothing on your list ("Nothing on your list
  needs Stan right now").
- Pure rules in `src/lib/advisor-rules.ts` (run `whoCanWatch()` with a hypothetical services list). Use
  the cached availability (`getAvailability()`), not new TMDB calls beyond what it already does.

**Same couch mode**
- When one of you visits the other (or you travel together), set "I'm in {country} until {date}" in
  Settings. Until that date your availability, Browse region and Coming soon use the visited country.
  Your services stay the same: global services carry over by provider ID, local ones simply won't match.
  Language, locale, time zone and the daily alerts job keep using your home settings.
- Columns `profiles.visiting_country` (ISO code, checked like `country`) and `profiles.visiting_until`
  (date), user-updatable. Apply the override in one place: `getCurrentProfile()` / `getPartner()` in
  `src/lib/session.ts` return the effective `country` plus `home_country`, so the pages follow without
  changes. Check every caller that should keep the home country (locales via `tmdbLocale()`, settings form,
  daily job) and adjust those few. While a visit is on, show a chip on the home page's person cards
  ("In GB until 20 Dec"). "Until" is inclusive in the visitor's own zone.

**Owns:** `src/app/settings/*` (except the device section components), `src/lib/session.ts`,
`src/lib/places.ts`, `src/lib/advisor-rules.ts`, `src/lib/i18n/places.ts` (and the account namespace
only for the settings form labels you change).
**Home page:** the visiting chip on the person cards.

## Block 4: Calendar subscription

Branch `phase3/calendar`. No new namespace needed beyond adding keys to `nights` (only block 4 edits
`nights.ts`).

**What it does**
- On `/watch-nights`, a "Subscribe in your calendar" control: creates a private feed link
  (`webcal://…/calendar/<token>.ics` plus an https copy button and short instructions for Google and Apple
  Calendar). Every watch night appears in your calendar and updates as nights are planned, moved or
  cancelled. "Make a new link" revokes the old one.
- The feed: all of the couple's nights from 30 days ago to a year ahead, one VEVENT each (stable UID per
  night so updates replace events; cancelled nights simply disappear), in the feed owner's language, with
  both people's local times and how you'll watch in the description. Send a short `REFRESH-INTERVAL` and
  `X-PUBLISHED-TTL` (e.g. 1 hour), and `Cache-Control` to match.

**Data**
- `calendar_feeds`: profile (primary key), token_hash (sha-256 of a 32-byte random token), created_at.
  Own row only (select/insert/delete). Partners can read each other's `profiles`, so the token must not
  live there. Only the hash is stored; the link is shown once on creation, and again only by making a
  new one.
- The feed route has no session: it hashes the token from the URL and looks it up with the admin client,
  then reads that couple's nights. Add `/calendar` to `PUBLIC_PATHS` in `src/proxy.ts`. Unknown tokens
  get a 404.

**Owns:** `src/app/calendar/*`, the watch-nights page header, `src/lib/night-rules.ts` (generalise
`toIcs()` to several events, and keep the single-night `.ics` route working), `src/lib/i18n/nights.ts`,
`src/proxy.ts`.

## Integration (one session, after all four branches are committed)

1. Merge into `main` locally one at a time (4, 3, 2, 1). After each merge: `npm run typecheck`, `npm run
   lint`. Resolve `database.types.ts` conflicts by regenerating.
2. Then `npm run db:reset` (rebuilds from all migrations), `npm run db:types`, `npm run db:test`,
   `npm run build`, and a quick look at home, `/pick`, Settings and `/watch-nights` as both users.
3. Copy each block's Handoff notes into `CLAUDE.md` (Status, data model, conventions), then delete this
   file. Remove the worktrees (`git worktree remove`).
4. With the user's go-ahead: `npx supabase db push`, then push `main`.

## Handoff notes

### Block 1: After the night
(not started)

### Block 2: Pick for tonight
(not started)

### Block 3: Places and services
Done on `phase3/places`. Migration `20261103131342_places.sql`, pgTAP `supabase/tests/database/places.test.sql`.

**What's done**
- Settings → "What would another service get you?" (`src/app/settings/advisor.tsx`, in its own `<Suspense>`
  under the settings form, once paired): the top 5 subscription services in your home country that you
  don't pay for, ranked by Up next titles they'd make watchable for both of you, then for you, each with
  both counts and up to 4 posters (linking to the title pages, "+n" for the rest). Below: "Nothing on your
  list needs {service} right now" for each saved service that carries no Up next title in your country
  (only said when every Up next title could be checked there). Uses home countries and saved services
  (it's about what you subscribe to at home), and `getAvailability()` only.
- Settings → "Travelling" (`src/app/settings/visit-form.tsx`): "I'm in {country}" (home country left out)
  "until (the last day)", Save, and while a visit is on "You're in {country} until {date}" with "I'm back
  home". Actions `saveVisit()` / `endVisit()` in `src/app/settings/actions.ts`; the last day must be from
  today to 366 days ahead in your own zone.
- Same couch mode: `getCurrentProfile()` and `getPartner()` (`src/lib/session.ts`) apply the visit, so
  `country` is where the person watches from today and `home_country` their own setting, plus `visit`
  (`{ country, until }` or null). Availability, badges, "available in both", Browse region and service
  chips, Coming soon and search follow the visited country with no page changes. Services stay as saved
  (provider IDs, so global services match in the visited country).
- Home page person cards: a "In GB until 20 Dec" chip while that person is visiting (`<VisitChip>` in
  `src/app/settings/visit-chip.tsx`; the cards' own query selects the two visit columns).

**Callers changed to keep the home country** (one-line edits outside the block's files, as the plan asked)
- Every `tmdbLocale()` call that took a session profile now passes `home_country`: home page, browse,
  coming soon, search, stats, title page, watch nights (list, new, `[id]`, `[id]/ics`) and
  `cacheForCouple()` in `src/lib/list.ts`. Where a page narrows with `isCountry(profile.country)` it reads
  `profile.home_country ?? profile.country` (same value; it only satisfies the type).
- `coupleCountries()` (`src/lib/list.ts`, used only for `recordBaseline()`) returns home countries, since
  that's what the daily check compares.
- The settings form gets `{ ...profile, country: profile.home_country }` and the home country's services.
- Unchanged, already home: `runDailyCheck()` and `notifyPartner()` read `profiles` with the admin client.

**Conventions (for CLAUDE.md)**
- Visits: rules are pure in `src/lib/places.ts` (`activeVisit()`: on until the end of `visiting_until`
  in the visitor's own zone, only with a home country and only when it differs; `withVisit()`,
  `visitDateRange()`, `formatVisitDate()`). Session profiles' `country` is the effective country; use
  `home_country` for TMDB locales, settings and anything that should ignore a visit. `withVisit()` returns
  a union, so checking `country` also narrows `home_country`. Code that reads `profiles` directly (admin
  client, the home cards) gets the home `country` and must apply `activeVisit()` itself if it wants the visit.
- Advisor: pure in `src/lib/advisor-rules.ts` (`adviseServices()` runs `whoCanWatch()` with each candidate
  service added; `showcase()` picks the posters).
- UI text in namespace `places` (`src/lib/i18n/places.ts`).

**Data model rows (for CLAUDE.md)**
- `profiles`: add "visiting country (ISO code) and visiting until (date), set together". Built-so-far
  note: Phase 3 block 3 (`20261103131342_places.sql`) added `profiles.visiting_country` (checked like
  `country`) and `profiles.visiting_until`, both null or both set, user-updatable (column grant; the
  existing own-row policy covers it). Partners can read them (that's how the chip shows).

**Known issues / not checked**
- Checked on the dev server with both local users (curl, Server Actions and headless Edge screenshots of
  Settings at phone width and the home page in Turkish); the test visit was cleared afterwards. Not checked
  on a real phone.
- While both of you are in one country, the title page shows that country twice (one column each) and
  Browse's two "popular on streaming" rows show the same region. Correct, but could be merged later.
- A visit's expiry is lazy (read-time); the columns keep the old visit until someone saves a new one.
- `src/lib/i18n/index.ts` keeps each language on one line, so every block's registration touches the same
  two lines: merge by keeping all keys.
- `database.types.ts` was regenerated from the shared DB, so it also has other blocks' tables.

### Block 4: Calendar subscription
Done on `phase3/calendar` (migration `20261103131306_calendar_feeds.sql`, test `calendar_feeds.test.sql`).

**Status line for CLAUDE.md:** `/watch-nights` has "Subscribe in your calendar" (a fold-out card under the
header): "Make a calendar link" gives a private feed (`webcal://…/calendar/<token>.ics` button, the https
link with Copy, and steps for Google and Apple Calendar). The link is shown once; afterwards the card says
when it was made, with "Make a new link" (revokes the old one) and "Turn the link off". The feed has all
the couple's nights from 30 days ago to a year ahead, in the owner's language, each with both people's
local times, how you'll watch and the note; cancelled nights drop out. `REFRESH-INTERVAL` and
`X-PUBLISHED-TTL` are 1 hour, `Cache-Control: private, max-age=3600`. "Add to calendar" (.ics per night)
now uses the same event text, so it also lists both local times.

**Data model row:** `calendar_feeds` | Private calendar feed link per person | profile (primary key),
token_hash (hex SHA-256 of a 32-byte random token; unique), created_at. Each person reads, makes and
removes only their own row (no updates: a new link is delete + insert). Not in `profiles`, which partners
can read. The token itself is never stored.

**Conventions:**
- Feed route `src/app/calendar/[feed]/route.ts` has no session: `/calendar` is in `PUBLIC_PATHS` in
  `src/proxy.ts`, so anything added under `/calendar` later is public too. It hashes the token
  (`src/app/calendar/token.ts`, `node:crypto`) and `feedCalendar()` (`src/app/calendar/feed.ts`) looks it
  up with the admin client, then reads only that owner's couple. Malformed and unknown tokens get a 404.
- `toIcs(events, feed?)` in `night-rules.ts` now takes a list of `IcsEvent`s; with `feed` (`{ name,
  refreshMinutes }`) it adds `NAME`/`X-WR-CALNAME` and the refresh hints. `FEED_REFRESH_MINUTES`,
  `FEED_DAYS_BEHIND`, `FEED_DAYS_AHEAD` live there too. Events: UID `<night id>@two-couches` (stable, so a
  moved night replaces its event), `LAST-MODIFIED` from `watch_nights.updated_at`, times in UTC.
- A night's calendar event text is built in one place: `nightEvent()` in `src/app/calendar/night-event.ts`
  (pure), used by the feed and by `src/app/watch-nights/[id]/ics/route.ts`.
- Actions `makeCalendarFeed()` / `stopCalendarFeed()` in `src/app/calendar/actions.ts` run as the user;
  `makeCalendarFeed()` returns the token to the client once. UI: `<CalendarSubscribe>`
  (`src/app/calendar/subscribe.tsx`, client) builds the links from `window.location`. Text is under
  `nights.calendar` in `src/lib/i18n/nights.ts` (plus `nights.calendar.feedName`).
- The feed reads `profiles.country` straight from the table (admin client), so with block 3's visiting
  override it keeps using the home country for title names, as intended.

**Checked locally:** the feed for both users (English and Turkish), a night 40 days ago left out, line
folding and escaping, a new link turning the old one into a 404, "Turn the link off" giving a 404,
malformed and unknown tokens giving 404 without a session, the single-night .ics, and headless Edge
screenshots of the card (desktop with a link, phone just after making one). Test nights and feeds were
deleted afterwards.

**Known issues / not checked:**
- Not tried in a real calendar app: Google can only subscribe to a public https URL (not localhost), so
  test on the deployed site. Google ignores `REFRESH-INTERVAL` and refreshes subscribed calendars on its
  own schedule (often 8 to 24 hours); Apple Calendar honours it (its own minimum may apply). The card says
  Google is slow.
- Google's mobile app can't add a calendar by URL; the steps say to use a computer.
- The `webcal://` button on desktop browsers opens whatever calendar app the OS has registered (or
  nothing); the https link with Copy is the fallback.
- The hosted app needs `SUPABASE_SECRET_KEY` (already set for the daily job); without it the feed route
  throws (500).
- Outside the files the block owns: `src/app/watch-nights/[id]/ics/route.ts` (now uses `nightEvent()`),
  the new migration and pgTAP test, and the regenerated `database.types.ts` (it includes other blocks'
  tables from the shared database; regenerate at integration).
