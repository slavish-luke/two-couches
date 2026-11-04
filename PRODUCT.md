# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Two people in a long-distance relationship who live in different countries and time zones, and watch films and series "together" from their own couches. They use the app to keep one shared watchlist, see what each of them can stream where they live, and plan nights to watch at the same moment despite the time difference.

They use it mostly on a PC or laptop, with the phone for quick checks (an alert, a ready check, adding something they just heard about). The design is built for the larger screen first and must still be complete on a phone.

The app is built for one couple. The repository is public, so another couple could self-host it, but there is no sign-up for strangers and no plan to run it as a service.

## Product Purpose
Remove the friction of watching together from two countries: "can we both even watch this?", "what's on our list?", "what time is that for you?", "are we both ready?". Success means less time negotiating and more nights actually watched together, and the app feeling like a shared space that belongs to the two of them rather than a utility.

## Positioning
Every answer is computed for two people at once. Availability is checked in both people's countries against the services each one actually pays for; a title is "watchable by both" only when each person has a subscription that carries it. Times are shown on both clocks, suggestions are weighted by both people's ratings, and moments like "you're both ready" exist only because there are two of them. Single-user watchlist apps and streaming guides answer for one person in one country.

## Operating Context
- **The list**: one shared watchlist (Up next, Watched, Dropped), with status, TV progress, both ratings, categories, a shared note and hidden reviews. Changes appear live on the other person's screen.
- **Finding things**: search; a title page showing both countries' services side by side; Browse (trending, popular on streaming in each country, For you, filters); Coming soon (cinema and digital releases, next episodes, "now streaming" alerts); Pick for tonight (one suggestion at a time, sized to the time you have, the same pick on both screens).
- **Watch nights**: plan a night on an hour grid rated for both time zones, record how you'll watch (Teleparty link, Syncplay room, other), ready checks per person including file version and length, a calendar feed, and a "How was it?" wrap-up afterwards.
- **Settings and extras**: country, language, time zone and services per person; travelling ("I'm in X until Y"); which extra service would unlock the most; theme per device; data saver; notifications.
- **Stats**: per year or all time.
- Typical moments: browsing for something to watch on the laptop in the evening; a push alert during the day; both people opening the same night card minutes before starting.

## Capabilities and Constraints
- Next.js 16 (App Router, `cacheComponents`) + Tailwind CSS, installable PWA with offline list pages, Supabase, TMDB data. Hosted on free tiers only (Vercel Hobby, Supabase Free). New frameworks or services, including animation libraries, are discussed before adding.
- Bilingual UI (English and Turkish), with each person's own language; Turkish strings are often longer. Every visible string goes through the i18n namespaces.
- Each person has their own country and IANA time zone; never assume a fixed offset.
- The app is a list, scheduler and coordinator: it never hosts, links to or distributes media files.
- TMDB and JustWatch attribution must stay visible.
- Theme is per device and already token-based (light, dark, match device). A theme picker with more choices is wanted; the number of themes is open.
- Open: the visual world, name treatment, logo and colour roles are all open to change in the redesign.

## Brand Commitments
None binding. The current name ("Two Couches"), the two overlapping circles icon, and the colour roles (one colour per person, a third only where the two overlap) are the incumbent identity and may be kept, changed or replaced.

The user wants the redesign to feel lively, custom and detailed, with real motion, and explicitly not like a generic dashboard. They liked the idea of "two quiet colours and let the loud colour do the work" as a reference to consider, not a requirement.

Decided 2026-11-04 (binding): the app is **bright, pop and cartoony**: bold colours, custom display fonts, comic and cartoon motifs, playful motion. The first, restrained "festival programme" look was judged too subtle. The app offers several looks ("skins": Saturday Morning as the default, then Sticker Scrapbook, POW! Comic Book and Candy Shop) and several colour palettes per skin, chosen per device. The mascot is two little cartoon couches, one per person. Approved prototypes are in `design/labs/`.

## Evidence on Hand
- Real content is TMDB data: posters, backdrops, titles, overviews, trailers, provider logos, release dates. Poster sizes go through `tmdbImage()` and the custom loader.
- Existing icon assets: `src/app/icon.svg`, `public/icons/`.
- No testimonials, users, metrics or press exist; none should be invented. The public repo must not contain the two real users' names, emails or countries; use neutral examples (`GB`, `NZ`).

## Product Principles
1. **Two people, always.** Every screen answers for both people, and the moments where the two meet ("we can both watch it", "you're both ready", "see you at 9 / 6") are the heart of the product.
2. **Shared space, not a tool.** It should feel like a room the two of them share, personal and warm, rather than an admin panel for a watchlist.
3. **Films lead.** Real posters and title art are the richest material available; the interface frames them rather than competing.
4. **Both clocks, both languages.** Nothing assumes one country, one time zone or one language.
5. **Calm by default, joy at the right moments.** Everyday scanning stays fast and clear; celebration and motion are spent on the shared moments.

## Accessibility & Inclusion
No product-specific requirement beyond good practice: keyboard use on PC, readable contrast in every theme, and motion that respects `prefers-reduced-motion`.
