# Two Couches

A private shared watchlist and movie-night calendar for two people who live in different countries.
Search any film or series and see which streaming services carry it in each person's country,
with the titles you can *both* watch highlighted.

**Stack:** TypeScript, Next.js 16 (App Router), Tailwind CSS, Supabase (Postgres, Auth, row-level security),
TMDB API, deployed on Vercel.

**Highlights**
- Passwordless sign-in (email link or one-time code), with sign-ups closed to an allowlist.
- Two-person "couples" joined by invite code; Postgres row-level security means each user can only
  ever read their own couple's data, enforced in the database, not just the UI.
- Any country and time zone per person; times stored in UTC and shown in each person's local time.
- Streaming-service catalogues cached from TMDB in Postgres and refreshed daily.
- A daily job (pg_cron → pg_net → a Next.js route) re-checks every saved title and sends web push
  alerts when one becomes watchable for both people.
- "For you" suggestions scored from TMDB recommendations, weighted by *both* people's ratings and boosted
  when both can stream them, with "not interested" to keep a title out.
- A watch-night planner that rates each hour of the day for both time zones (evenings, weekend afternoons,
  sleep), records how you'll watch (Teleparty link or Syncplay room), notifies the other person and
  exports to any calendar app (.ics).
- English and Turkish UI, following each person's settings.
- pgTAP tests for every security policy.

**Status:** Sprints 0–5 done (foundations, search, shared list, browse, coming soon and alerts, for you and watch nights). See `CLAUDE.md` for the rules and the sprint roadmap.

## Run it locally

Needs Node 24+ and Docker Desktop running.

```sh
npm install
npm run db:start          # local Supabase in Docker; prints URLs and keys
cp .env.example .env.local # paste API_URL, PUBLISHABLE_KEY and SECRET_KEY from `npx supabase status`
npm run dev               # http://localhost:3000
```

Sign in as `one@example.com` or `two@example.com` (the local allowlist in `supabase/seed.sql`).
Sign-in emails land in Mailpit at http://127.0.0.1:54324.

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run db:reset` | Rebuild the local database from migrations and seed |
| `npm run db:test` | pgTAP tests for RLS and couple rules (`supabase/tests`) |
| `npm run db:types` | Regenerate `src/lib/supabase/database.types.ts` after a migration |

New schema changes go in a new file under `supabase/migrations/` (`npx supabase migration new <name>`).

## Going live (one-time)

### 1. TMDB
Create an account at themoviedb.org, then Settings → API → request a key (personal / non-commercial).
Copy the **API Read Access Token** (the long one). That's `TMDB_API_TOKEN`.

### 2. Supabase
1. Create a project at supabase.com (Free plan; pick the region closest to you both).
2. Link and push the schema:
   ```sh
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```
3. SQL editor: add your two real emails to the allowlist (nobody else can sign up):
   ```sql
   insert into public.signup_allowlist (email) values ('you@example.com'), ('partner@example.com');
   ```
4. Authentication → URL Configuration: set **Site URL** to your Vercel URL (e.g. `https://two-couches.vercel.app`)
   and add `https://two-couches.vercel.app/auth/confirm` to **Redirect URLs**.
5. Authentication → Email Templates: paste `supabase/templates/magic_link.html` into **Magic Link** and
   `supabase/templates/confirmation.html` into **Confirm signup**. (They send a link that works on any device
   plus a 6-digit code, which is handy when the email opens in a different browser from the app.)
6. Project Settings → API Keys: copy the URL, the publishable key and a secret key.

### 3. Vercel
Import the GitHub repo at vercel.com/new (Hobby plan), and add these environment variables before the first deploy:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |
| `SUPABASE_SECRET_KEY` | Supabase secret key (server only) |
| `TMDB_API_TOKEN` | TMDB read access token (server only) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web push public key (`npx web-push generate-vapid-keys`) |
| `VAPID_PRIVATE_KEY` | Web push private key from the same pair (server only) |
| `CRON_SECRET` | Long random string; the daily job sends it to `/api/cron/daily` (server only) |

Every push to `main` then redeploys.

### 4. The daily check
`npx supabase db push` schedules it (09:00 UTC), but it does nothing until Supabase knows where to call.
In the Supabase SQL editor, using your Vercel URL and the same `CRON_SECRET` as in Vercel:
```sql
select vault.create_secret('https://two-couches.vercel.app', 'app_url');
select vault.create_secret('<CRON_SECRET>', 'cron_secret');
-- Try it now; the response lands in net._http_response a few seconds later.
select public.request_daily_check();
```
To change one later: `select vault.update_secret((select id from vault.secrets where name = 'app_url'), '<new value>');`

Then turn notifications on from Settings on each phone. On iPhone, add the app to the Home Screen first and
turn them on from there.
