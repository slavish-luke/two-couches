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
Done on `phase3/after-night` (migration `20261103131309_after_night.sql`, test `supabase/tests/database/after_night.test.sql`).

**Status line:** Home shows a "How was {title}?" card for each watch night with a title that ended in the last 7 days
(start + film runtime, else `DEFAULT_LENGTH_MIN`) and that you haven't dealt with, above "Next watch night". Films: "We
watched it" (ticked; watched_on = the night's start date on your clock), or "On your Watched list since …" if it already
is. Series: "Watched up to" season/episode, prefilled with the next episode, or with the current progress plus "{name}
has already moved it on" once your partner has saved their card (so it isn't moved on twice). Optional rating (your
stars, your partner's shown) and review. "Save" or "Not now" hides the card for you only. A night's title that isn't on
the list is added when there's something to save. Hidden reviews: one per person per list item, up to 1,000
characters, on the title page's "On our list" panel ("Reviews") and in the wrap-up card. Your partner's text shows only
once you've written yours; until then "{name} has written theirs: write yours to see it". Emptying yours and saving
deletes it, which hides theirs again.

**Data model rows:**
- `list_reviews` | Each person's hidden review of a list item | list item, couple (copied for Realtime), profile, body (1–1,000 chars), created_at, updated_at. FK to `list_items (id, couple_id)` on delete cascade.
- `night_wrapups` | Who has dealt with a night's "How was it?" card | watch night, couple, profile, outcome (saved/skipped), done_at. FK to `watch_nights (id, couple_id)` on delete cascade.

**Policies (for the data-model paragraph):** `list_reviews`: each person inserts, updates (body only) and deletes only
their own; select is your own rows, and your partner's only when `public.has_reviewed(list_item_id)` (security definer,
so the policy doesn't recurse). `public.review_authors(uuid[])` (security definer, own couple only) says who has written
one without the text. `night_wrapups`: insert/delete own rows only, but both members read them (a deliberate change from
"own rows only" in the plan: the second person needs to know the first already moved a series on; the outcome isn't
private). Both tables are in Realtime and `ListSync`.

**Conventions:**
- After the night: rules are pure in `src/lib/review-rules.ts` (`nightEndsAt()`, `isWrapupDue()`, `nextEpisode()`,
  `cleanReview()`, `MAX_REVIEW_LENGTH`, `WRAPUP_DAYS`). Queries in `src/lib/reviews.ts`: `getReviews(itemIds, myId)`
  returns `{ mine, partner: none | hidden | shown }`; `getWrapups()`. Actions in `src/app/after-night/actions.ts`:
  `saveReview()`, `saveWrapup()` (reuses `addToList`, `updateListItem` and `rateListItem` from `src/app/list/actions.ts`,
  then records the wrap-up), `skipWrapup()`. UI: `<AfterNight />` (home, self-contained with its own `<Suspense>`),
  `wrapup-card.tsx`, `review-box.tsx` (`ReviewSection` for the title panel, `ReviewField`, `PartnerReviewView`).
- `StarPicker` is now exported from `src/app/title/[type]/[id]/list-panel.tsx` (the wrap-up card uses it, controlled).

**Known issues:** Realtime applies the same RLS, so when your partner writes a review on the title page and you haven't
written one, their "has written theirs" notice reaches your screen on the next refresh (any other list change, or
returning to the tab), not instantly. From the wrap-up card it is instant (the `night_wrapups` insert is visible to
both). A card is refilled (draft lost) if your partner saves their card for the same night while you're typing. Tested
with curl and headless Edge (both users, en and tr, hidden text absent from the HTML and RSC payload), not on a phone.

**Outside the files this block owns:** `src/app/title/[type]/[id]/page.tsx` (`OnOurList` fetches `getReviews()` for the
item and passes `reviews` to `ListPanel`: one import, one line, one prop). Shared files as the table says:
`src/lib/i18n/index.ts` (namespace `reviews`), `src/components/list-sync.tsx` (two table names), `src/app/page.tsx`
(import + `<AfterNight />`), `database.types.ts` (regenerated; it also contains block 4's `calendar_feeds` from the shared
database). No page-title keys (no new page).

### Block 2: Pick for tonight
(not started)

### Block 3: Places and services
(not started)

### Block 4: Calendar subscription
(not started)
