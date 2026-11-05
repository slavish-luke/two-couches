---
name: Two Couches
description: A shared watchlist for two people in two countries, drawn as a Saturday-morning cartoon. Two little couches, ink-outlined paper on a sunburst, and a bubblegum starburst only on what you can both watch.
colors:
  sunburst-ground: "#ffd23f"
  sunburst-ray: "#ffc61a"
  cream-paper: "#fffaf0"
  cartoon-ink: "#1d1a2b"
  dusk-muted: "#4a4360"
  ink-line: "rgb(29 26 43 / 0.2)"
  coral-me: "#ff8a65"
  coral-me-soft: "#ffdccf"
  sky-partner: "#5cc8ff"
  sky-partner-soft: "#d4f0ff"
  bubblegum-stamp: "#ff2e93"
  on-stamp: "#ffffff"
  bubblegum-text: "#b0005f"
  bubblegum-soft: "#ffd6ea"
  spotlight-both-text: "#ffebf5"
  spotlight-line: "rgb(255 255 255 / 0.35)"
  spotlight-head: "#ffd23f"
  grape-accent: "#6a4cf5"
  on-accent: "#ffffff"
  grape-soft: "#e6e0ff"
  grape-muted: "#f1edff"
  pop-yellow: "#ffd23f"
  danger: "#b0101f"
  danger-soft: "#ffe1df"
  blush: "#ff5c8a"
typography:
  display:
    fontFamily: "Luckiest Guy, sans-serif"
    fontSize: "clamp(2.4rem, 5vw, 3.6rem)"
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: "0.02em"
  headline:
    fontFamily: "Luckiest Guy, sans-serif"
    fontSize: "2rem"
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: "0.02em"
  title:
    fontFamily: "Luckiest Guy, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.03em"
  numeral:
    fontFamily: "Luckiest Guy, sans-serif"
    fontSize: "clamp(2rem, 26cqi, 3.5rem)"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.03em"
    fontFeature: "tnum"
  item-title:
    fontFamily: "Fredoka, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "Fredoka, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.625
    fontFeature: "tnum"
  meta:
    fontFamily: "Fredoka, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.4
  label:
    fontFamily: "Fredoka, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
  tag:
    fontFamily: "Fredoka, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.375
  button:
    fontFamily: "Luckiest Guy, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.04em"
rounded:
  poster: "10px"
  control: "14px"
  tab: "16px"
  panel: "22px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "20px"
  xl: "28px"
  2xl: "32px"
components:
  card:
    backgroundColor: "{colors.cream-paper}"
    textColor: "{colors.cartoon-ink}"
    rounded: "{rounded.panel}"
    padding: "20px"
  spotlight:
    backgroundColor: "{colors.grape-accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.panel}"
    padding: "20px"
  button-primary:
    backgroundColor: "{colors.pop-yellow}"
    textColor: "{colors.cartoon-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "10px 16px 8px"
  button-quiet:
    backgroundColor: "{colors.cream-paper}"
    textColor: "{colors.cartoon-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "6px 14px"
  chip:
    backgroundColor: "{colors.cream-paper}"
    textColor: "{colors.cartoon-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
  chip-selected:
    backgroundColor: "{colors.grape-accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
  tab:
    backgroundColor: "{colors.cream-paper}"
    textColor: "{colors.cartoon-ink}"
    typography: "{typography.title}"
    rounded: "{rounded.tab}"
    padding: "10px 16px 6px"
  tab-current:
    backgroundColor: "{colors.grape-accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.tab}"
  field:
    backgroundColor: "{colors.cream-paper}"
    textColor: "{colors.cartoon-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  strand:
    backgroundColor: "{colors.cream-paper}"
    textColor: "{colors.cartoon-ink}"
    rounded: "{rounded.pill}"
    padding: "0 8px"
  name-tag-me:
    backgroundColor: "{colors.coral-me}"
    textColor: "{colors.cartoon-ink}"
    rounded: "{rounded.pill}"
    padding: "0 10px"
  name-tag-partner:
    backgroundColor: "{colors.sky-partner}"
    textColor: "{colors.cartoon-ink}"
    rounded: "{rounded.pill}"
    padding: "0 10px"
  night-ticket:
    backgroundColor: "{colors.cream-paper}"
    textColor: "{colors.cartoon-ink}"
    rounded: "{rounded.control}"
    padding: "4px 10px 6px"
  burst:
    backgroundColor: "{colors.bubblegum-stamp}"
    textColor: "{colors.cream-paper}"
    size: "128px / 144px"
  poster-tab-both:
    backgroundColor: "{colors.bubblegum-stamp}"
    textColor: "{colors.cream-paper}"
    rounded: "10px"
    padding: "3px 8px 1px"
  poster-tab-one:
    backgroundColor: "{colors.cream-paper}"
    textColor: "{colors.cartoon-ink}"
    rounded: "10px"
    padding: "3px 7px"
  nav-bar:
    backgroundColor: "{colors.cream-paper}"
    textColor: "{colors.cartoon-ink}"
    rounded: "{rounded.pill}"
    padding: "4px"
  nav-pill:
    backgroundColor: "{colors.grape-accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.pill}"
---

# Design System: Two Couches

## Overview

**Creative North Star: "Saturday Morning for Two"**

The app is a Saturday-morning cartoon about two people on two couches, hours apart. Every screen is a sunny cel: a sunshine-yellow ground with rays fanning down from above the top of the screen, and cream paper panels cut out in thick ink outlines that cast hard, flat ink shadows. The two people are two little couches with faces, one coral and one sky blue, bobbing and blinking a beat apart. A bubblegum starburst pops onto a title only when both of you can watch it. Nothing else is that loud.

The look is a **skin plus a palette**, chosen per device and set on `<html>` before the first paint (`data-skin`, `data-palette`, written by `LOOK_SCRIPT` from `localStorage`). The skin owns fonts, outline weight, corner radii, shadow offsets, decorations and motion. The palette owns every colour. Components read only the tokens, so a new skin or palette is a new CSS block plus an entry in `SKINS` / `PALETTE_COLORS`, not a component rewrite. Today there is one skin, **Saturday Morning** (`saturday`), with one palette, **Sunburst** (`sunburst`). Sticker Scrapbook, POW! Comic Book and Candy Shop are planned as skins, and more palettes will come from a palette lab.

Density is relaxed and playful but legible: 17px Fredoka for reading, big cartoon lettering only for page titles, section heads, tabs and numbers. Panels lean a little (about -1 to 1 degrees), and rows wiggle when pointed at. Everything that moves overshoots once and settles. The world rejects the streaming-service dashboard (dark grids, glass, backdrop heroes) and timid "playful" SaaS (pastel cards with a mascot sticker on top).

**Key Characteristics:**
- Sunburst ground (yellow plus conic rays) under cream paper panels with 3px ink outlines and hard offset ink shadows.
- One grape spotlight panel per screen. Its display head is filled in pop yellow.
- Coral and sky person colours are fills only (couches, dots, name tags). They never colour text.
- The bubblegum starburst and the stamp colour mean "both of you" and nothing else.
- Luckiest Guy lettering with an ink stroke and a hard shadow on the ground; Fredoka for everything you read.
- One spring clock (`cubic-bezier(0.2, 1.4, 0.4, 1)`): pop, wiggle, squash, bob and blink. Reduced motion turns it all off.

## Colors

A sunny, saturated cartoon palette: one warm ground, cream paper, one ink, two person colours, one loud "both" colour and one grape hero colour. These values belong to the Sunburst palette. Every other palette must define the same roles.

Saturday Morning has eight palettes (Settings → Colours, per device), all tuned in `design/labs/sat-palette-lab.html`: **Sunburst** (the standard: yellow, grape spotlight, bubblegum burst), **Pool Party** (aqua, tomato spotlight), **Lime Fizz** (lime, cobalt spotlight), **Grape Jelly** (lilac, tangerine spotlight with ink text, lime burst), **Tangerine** (orange, deep-blue spotlight), **Bubblegum** (pink, grape spotlight, lime burst), **Big Sky** (sky blue, red spotlight) and **Night Owl** (indigo night with stars instead of rays, lamp-orange spotlight with ink text, slightly softer paper). Where pink would vanish into the ground, the burst turns lime: the stamp is a role, not a colour.

### Primary
- **Grape Accent** (`grape-accent`): fills the one spotlight panel per screen (Home's next watch night, Browse's For you, the title page's verdict banner, Stats' headline numbers, Pick's card, Coming soon's alerts, the couple page's pairing moment). It also marks a selected control (chip, tab, nav pill, chosen settings option), a done state (the "ready" tick in a ready check), the "13 h apart" badge on the clocks panel, and single-series data bars on Stats. White text on it (`on-accent`). Using it on those small things is deliberate (decided 2026-11-05 in `sat-palette-lab.html`: plain ink and paper looked flat across the palettes).
- **Grape Soft / Grape Muted** (`grape-soft`, `grape-muted`): empty poster placeholders and status pills on paper (soft); the muted text colour inside the spotlight (muted, 4.6:1 on grape).

### Secondary
- **Bubblegum Stamp** (`bubblegum-stamp`): the starburst and the dot in "We can both watch" filters. Use it only where the two of you overlap: a title you can both stream, a ready check where you're both ready. Plain text on it (the "both ready" pill, selections) is `on-stamp`; the burst's word is paper-filled display lettering.
- **Bubblegum Text** (`bubblegum-text`): the same meaning made safe as text on paper (`--both`). Inside the spotlight, `--both` swaps to `spotlight-both-text`.
- **Bubblegum Soft** (`bubblegum-soft`): the background of a ready check once you're both ready.

### Tertiary
- **Coral Me** (`coral-me`) and **Sky Partner** (`sky-partner`): fills for each person's marks: their couch, their dot in a watch badge, their name tag, their night ticket's dot, their clock's tag. They always carry ink text and an ink outline, because neither passes contrast as text. The soft variants are tints for the same person's areas.
- **Pop Yellow** (`pop-yellow`): the bright button fill, and the display-lettering fill for the spotlight's head. In Sunburst it equals the ground, so a `.btn` reads by its outline and shadow.

### Neutral
- **Sunburst Ground** (`sunburst-ground`) with **Sunburst Ray** (`sunburst-ray`): the page. A fixed `body::before` draws `repeating-conic-gradient(from 0deg at 50% -10%, ray 0 6deg, transparent 6deg 12deg)`.
- **Cream Paper** (`cream-paper`): every panel, field, chip, ticket, poster blank and the phone tab bar. Also the fill of display lettering on the ground.
- **Cartoon Ink** (`cartoon-ink`): body text, every outline (`--outline`), every hard shadow and the focus of the whole skin.
- **Dusk Muted** (`dusk-muted`): secondary text (dates, "Added by", hints).
- **Ink Line** (`ink-line`): faint dividers inside panels.
- **Danger** (`danger`, `danger-soft`): errors and mismatched file lengths.

### Named Rules
**The Overlap Rule.** Bubblegum (`--stamp`, `--both`) appears only where the two of you overlap: a title you can both stream or both being ready. It is never decoration, never a status like "under way", never a generic alert.

**The Fill-Only Rule.** Coral and sky are fills with ink text and an ink outline. They are never text colours, borders or rules.

**The One Spotlight Rule.** One grape spotlight panel per screen, for that screen's moment. Grape elsewhere marks only selection, done states or data, always at small scale.

**The Token Swap Rule.** Text tokens follow their surface. The page, `.card`, `.paper`, `.field`, `.chip`, `.btn` and `.btn-quiet` reset `--ink`, `--muted`, `--line` and `--focus` to the palette's paper values. `.spotlight` swaps them: ink becomes `on-accent`, muted becomes `accent-muted` (`grape-muted`), lines become `accent-line` (`spotlight-line`), `--both` becomes `accent-both` (`spotlight-both-text`) and focus becomes pop. The spotlight's head uses the `display-pop` utility: display lettering filled with `accent-head` (`spotlight-head`). A paper element inside the spotlight is readable without extra classes.

**What a palette defines.** `--p-bg`, `--p-surface`, `--p-ink`, `--p-muted`, `--p-line`, `--ray`, `--outline`, `--me`, `--me-soft`, `--partner`, `--partner-soft`, `--stamp`, `--on-stamp`, `--both` (text-safe), `--both-soft`, `--accent`, `--on-accent`, `--accent-soft`, `--accent-muted`, `--accent-line`, `--accent-both`, `--accent-head`, `--pop`, `--danger`, `--danger-soft`, `--blush`, `color-scheme`, plus a `PALETTE_COLORS` entry (ground, paper, ink, accent, both, me, partner) for the browser toolbar, the manifest and the Settings swatch. Every text pair must pass 4.5:1 (3:1 for big lettering and outlines); `design/labs/sat-palette-lab.html` checks them. A light accent takes ink spotlight text (`--on-accent` ink, `--accent-line` an ink tint).

**The Dark Ground Rule.** A palette with a dark ground (Night Owl) also sets `--g-ink` and `--g-muted`, the text colours straight on the page; `:root` uses them, falling back to the paper's. Everything light (`.card`, `.paper`, `.field`, `.chip`, `.btn`, `.btn-quiet`, `.tab`, `.strand`, and any element with a bare `bg-surface`, `bg-me`, `bg-partner`, `bg-pop`, `bg-stamp` or a soft fill) resets them to ink, so a component that sits on paper never needs to know the ground is dark. A new light element with text should use one of those classes; a conditional fill (`has-checked:bg-…`) doesn't reset, so give it `text-ink` itself. Night Owl's `--ray` is transparent and its stars use `--star`.

## Typography

**Display Font:** Luckiest Guy (`--font-luckiest`, fallback sans-serif)
**Body Font:** Fredoka (`--font-fredoka`, fallback sans-serif). Fredoka has no capital İ, so `--font-fredoka-idot` (one letter built from Fredoka's own I and dot, `src/app/fonts/README.md`) comes first in the stack.

**Character:** Chunky, bouncy cartoon lettering for anything shouted, paired with a round, friendly sans for everything read. Both cover Turkish, and casing comes from CSS with `<html lang>` set, so Turkish İ and ı survive. Luckiest Guy draws lower case as capitals, so everything set in it (`display`, `display-ink`, `display-pop`, `.btn`, `.tab`, the burst and tab words, the intro, any `font-display`) is `text-transform: uppercase`: with `lang="tr"` the browser turns i into İ (its latin-ext file has U+0130), where the lower-case glyph had no dot.

Fonts are loaded through `next/font` in `layout.tsx` as CSS variables. The skin block maps them to `--font-skin-display` and `--font-skin-body`, and Tailwind exposes them as `font-display` / `font-sans`. A later skin's fonts must be declared with `preload: false` so only the active skin's fonts download.

### Hierarchy
- **Display** (400, `clamp(2.4rem, 5vw, 3.6rem)`, 0.95): page titles on the ground, usually tipped `-rotate-1`. Uses the `display` treatment: cream fill, ink stroke `max(2px, 0.05em)` painted under the fill, hard ink text shadow `0.07em 0.07em 0`. The wordmark (2.3rem; 1.65rem on phones) and the intro words use it too.
- **Headline** (400, 2rem): the spotlight's head. Same `display` treatment, filled with `--pop` instead of cream.
- **Title** (400, 1.5rem, 1, 0.03em): section heads on paper, in plain ink with no stroke or shadow (`display-ink`). Tabs use it at 1.6rem (1.9rem from `sm`); Browse's Films / Series tabs, the page's main switch, at 2rem (2.6rem from `sm`).
- **Numeral** (400, `clamp(2rem, 26cqi, 3.5rem)` on the clocks, sized to the person's column): live clocks, night tickets (1.5rem; larger in the listing) and Stats tiles, in `display-ink` with tabular figures. AM/PM drops to Fredoka bold at 1rem.
- **Item title** (Fredoka 700, 1.25rem to 1.5rem, 1.25): list entries, title cards, night titles.
- **Body** (Fredoka 400, 17px, 1.625): everything you read. Notes and reviews cap at `max-w-prose`.
- **Meta** (Fredoka 500 to 600, 15px): chips, filter selects, form labels, the type-and-year line on list entries, and the time slots in the night form from `sm`.
- **Label** (Fredoka 600 to 700, 0.875rem): meta lines, name tags, badges.
- **Tag** (Fredoka 600, 13px): category strands, Coming soon's per-country dates, "Not interested", For you's "Because you liked…". 12px (`text-xs`) is the floor, except the partner's time under each slot in the night form on phones (11px, so "Thu 12 AM" fits a quarter of the row).
- **Burst word** (Luckiest Guy, 13 / 25px): the word inside the starburst scales with the burst (the title page's verdict). On a poster tab it is `clamp(12px, 11cqi, 24px)`, sized from the poster's width.
- **Button** (Luckiest Guy 400, 1.05rem, 0.04em): the bright `.btn` only. Quiet buttons use Fredoka 600.

### Named Rules
**The Ground-or-Paper Rule.** Cartoon lettering on the ground or the spotlight gets the full `display` treatment (fill, stroke, shadow). On paper it is `display-ink`: plain ink, no stroke, no shadow.

**The Tabular Rule.** `body` sets `font-variant-numeric: tabular-nums`, so times, counts and dates never jitter as they tick.

## Layout

The layout's `<main>` is a 90rem frame with 16 / 24 / 32px side padding (`px-4 sm:px-6 lg:px-8`). Each page is a 48rem reading column centred in it, unless its root sets `data-wide` (Home, Browse and other poster-grid pages). Home at `lg` is a 12-column grid: a 5-column aside (4 at `xl`) with the clocks panel, the spotlight, search and Pick, and a 7-column (8 at `xl`) list. On phones everything stacks.

Rhythm comes from Tailwind steps: 16px between list rows and inside small panels, 20px panel padding, 28 to 32px between major blocks, 36px between Stats sections. Poster grids are 2 columns on phones, 4 from `sm`, 5 at `xl`, with 20px gutters and 32px rows.

Navigation: from `md` up, the sections sit in a pill bar in the header, beside two round icon buttons (Search, Settings). Below `md`, the sections move to a fixed bottom tab bar (a paper strip with a 3px ink top edge, five icon-plus-label tabs, padded for `safe-area-inset-bottom`), and the body gets matching bottom padding. The header and tab bar stay in place during page transitions (`view-transition-name: site-header` / `tab-bar`).

## Elevation & Depth

This world is deliberately neobrutalist-cartoon. Depth is a flat ink shadow offset down and to the right, never blurred, always in `--outline`. Lifting something means growing its offset and nudging it up and left. Pressing it means sliding into its shadow until the offset is zero. The skin sets the two offsets: `--lift` 6px for panels and `--lift-sm` 3px for controls.

### Shadow Vocabulary
- **Panel** (`box-shadow: 6px 6px 0 var(--outline)`, from `outlined`): cards, spotlight, list rows, loading cut-outs. A list row grows to `8px 8px 0` on hover.
- **Control** (`box-shadow: 3px 3px 0 var(--outline)`, from `outlined-sm`): `.btn`, `.btn-quiet`, selected chips, round icon buttons, the nav bar. Hover grows it to `5px 5px 0` (`.btn`) or `4px 4px 0` (`.btn-quiet`). Active collapses it to `0 0 0`.
- **Poster** (`box-shadow: 4px 4px 0 var(--outline)`): posters in grids and rows, the current tab, Stats tiles, a checked settings option.
- **Nav pill** (`box-shadow: 2px 2px 0 var(--outline)`): the travelling grape pill.
- **Field focus** (`box-shadow: 4px 4px 0 var(--accent)`): a grape shadow appears under a focused field.
- **Peel sheet** (`box-shadow: -16px 0 28px -12px rgb(29 26 43 / 0.35)`): the only soft shadow, on the trailing edge of a page peeling away during a back transition.

### Named Rules
**The Flat Ink Rule.** Every shadow except the peel sheet is a zero-blur offset in ink. No soft ambient shadows, no glows, no glass.

**The Press Rule.** Interactive things lift on hover (translate up-left, bigger offset) and land in their shadow on press. Disabled things lose their shadow.

## Shapes

Everything is a cut-out with a thick ink outline (`--outline-width` 3px; 2.5px on chips, quiet buttons and name tags; 2px on strands and small dots). Corners are round and friendly: panels 22px, controls and tickets 14px, tabs 16px, posters 10px, chips, tags, badges and the nav fully pill-shaped. Panels and badges tilt: list rows alternate -0.5 and 0.6 degrees (`.tilt-row`), spotlights sit at about -1 degree, page titles at -1, small badges at -2 to -6, bursts settle at -8.

The starburst is a 12-point star (`burstPath(12, 48, 34, …)`) with a 4-unit ink stroke and rounded joins. The couch is drawn on a 64 by 50 grid. Icons are drawn SVG (24px box, 2.25 stroke, round caps and joins) from `src/components/icons.tsx` and the nav, never glyph characters.

## Components

### Buttons
Tactile cartoon buttons that squash when pressed.
- **Shape:** gently round (`rounded.control`, 14px), 2.5px ink outline, control shadow.
- **Primary (`.btn`):** pop-yellow fill, ink text in Luckiest Guy at 1.05rem with 0.04em tracking. Hover: up-left 2px, tilts -1 degree, shadow grows to 5px. Active: slides 3px into its shadow and squashes (`scaleX 1.03`, `scaleY 0.95`). Uses the spring clock (150ms).
- **Quiet (`.btn-quiet`):** cream paper, Fredoka 600, same lift and press at a smaller scale.
- **Icon buttons:** 44px round paper buttons with a 3px outline and control shadow. They tilt -6 degrees on hover and turn grape when current.
- **Focus:** a 3px `--focus` outline at a 3px offset (grape on paper, pop inside the spotlight).

### Chips
- **Style (`.chip`):** pill, 2.5px outline, cream paper, 15px Fredoka 600. Hover lifts 2px and tilts -2 degrees.
- **State:** selected when the chip has `aria-pressed`, `aria-current` (page or true), `aria-checked` or contains a checked input. Selected is grape with white text and a control shadow. A "We can both watch" chip leads with a small bubblegum dot.
- **Strands (`.strand`):** a list entry's categories, as small static white pills with a 2px outline and 13px text.

### Tabs
Big outlined tabs for a page's views (Up next / Watched / Dropped, Films / Series): `display-ink` lettering at 1.6rem (1.9rem from `sm`), 16px corners, 3px outline, 75% paper. The current tab (`aria-current="page"`) turns grape, tips -2 degrees and gains a 4px shadow. A count rides in a small paper pill. On phones Home's three views share the row in equal thirds (lettering up to 1.35rem, shrinking with the row's width) and the count becomes a sticker on each tab's top-right corner, so no view hides off screen.

### Cards / Containers
- **Card (`.card`):** cream paper, 22px corners, 3px outline, panel shadow, 20px padding.
- **Spotlight (`.spotlight`):** the same cut-out in grape with the token swap (see Colors). One per screen, tilted about -1 degree, its head in pop-filled display lettering.
- **Paper (`.paper`):** a bare paper background with paper text tokens, used for tickets, the ready check and name tags inside the spotlight.
- **List row:** a card in a `.tilt-row` with the poster on the left (who can watch it on a tab over the poster's top edge) and the title, meta and strands beside it.

### Inputs / Fields
- **Style (`.field`):** cream paper, 3px ink outline, 14px corners, 14px by 8px padding, muted placeholder.
- **Focus:** a 4px grape offset shadow appears under the field (its own outline is suppressed).
- **Error:** danger-coloured text with `role="alert"` below the field.

### Navigation
- **Wide screens:** a paper pill bar (3px outline, 3px shadow, 4px inner padding) of Fredoka-bold links, short labels until `xl`. A grape pill sits behind the current link. When the section changes, it travels on `cubic-bezier(.3, 1.5, .5, 1)` (`360ms + 80ms` for each extra step) and smears (`scaleX 1.25`, `scaleY 0.85`, then settles). Every tab it passes jiggles (up 6px, -6 degrees, scale 1.12, staggered 65ms). Until it has measured, the current link paints its own pill, so nothing jumps. A small outlined dot marks unseen alerts on Coming soon.
- **Phones:** the bottom tab bar described in Layout, with the same travelling pill.

### Poster Tab (signature)
Who can stream a title, on the poster itself (`<PosterTab>`, chosen in `design/labs/badge-lab.html`, option D): a tab stuck over the poster's top edge near the left, half on the poster and half above it, so it takes no height of its own. It sits inside `.poster-frame` (the poster's width, a size container) and sizes itself from it: left `clamp(4px, 7cqi, 14px)`, `translate: 0 -55%`, tilted -4 degrees, 2.5px outline, 10px corners, a 3px hard shadow. **Both:** a stamp-coloured tab with the paper-filled burst word ("Both!", or "Both of us!" once the poster is 200px or wider). **One of you:** a paper tab with two 14px outlined dots (yours, then your partner's; filled in the person's colour for whoever can) and who ("Only Sam", "Free to watch"; 13 to 15px Fredoka bold). On Home's list cards it is the dots alone (the name is read out) and "Free" short. **Neither:** nothing. It drops in (`tab-drop`: unrolls from its top edge, `scaleY` 0 to 1.25 to 1, 0.6s on the spring clock), staggered 50ms by `index`; reduced motion shows it still. Places: Home list cards, `TitleCard` grids (Browse, For you, Search, Coming soon), Pick and Coming soon's "Now streaming" alerts.

### Starburst
The bubblegum 12-point **Burst** (ink stroke, paper-filled display word with a 1.5px ink stroke and no shadow) is kept for the big moments: the title page's "you can both watch this" banner, "you're both ready" and the intro. It pops in (`pop`: scale 0 and -30 degrees, then 1.15 and 6 degrees, then settles at -8 degrees, 0.6s on the spring clock).

### Poster Deck (signature)
The title page's poster is a deck of up to five TMDB posters (`<PosterDeck>`, tuned in `design/labs/deck-lab.html`): the page's own poster on top, then the most-voted posters in the viewer's language, then textless ones (then English ones for Turkish). A messy pile: each card under the top peeks out a few pixels and degrees each way (200px wide, 240px from `sm`). Arrival: the top card morphs in from the list like any poster, then the others drop onto the pile under it, bottom card first (95ms apart, 640ms each, landing with a squash). The deck itself is the button (no Shuffle button, no counter): a tap, Enter or Space swings the top card out to the right and tucks it under while the rest step up with a small lift; on phones the top card follows a swipe and flies off the way it was swiped (a short drag springs back). The focus ring goes round the top card. Reduced motion: no drop, and the next poster fades in. One poster on TMDB: just the poster.

### Couch Mascot (signature)
Two little couches with faces, coral for you and sky for your partner, drawn in ink on a 64 by 50 grid with cheeks in the palette's `--blush`. They bob (3.2s, up 4px, -1.5 degrees) and blink (4.5s). The partner runs 0.6s and 1.7s behind, so they never move in unison. Together (`<Couches>`) they form the header logo (54px; 44px on phones, tipped -2 degrees), head the empty and loading states, and stand in the Settings Look preview. Decorative (`aria-hidden`).

### Name Tag and Night Tickets
- **Name tag:** a pill in the person's colour, 2.5px outline, ink text in Fredoka bold 0.875rem, truncating.
- **Night tickets:** in a watch night card, one paper ticket per person (14px corners, 3px outline). Each shows the person's dot and name, the start time on their own clock in `display-ink` numerals and the day under it. Two tickets sit side by side.
- **Ready check:** a paper panel with each person's tag and state. "Ready" is a grape pill with a drawn tick. When you're both ready, the panel turns bubblegum-soft and a bubblegum pill pops in.

### Clocks
Home's clocks panel: two equal columns, each a `VenueClock` (display-ink numerals sized to the column with `cqi`, weekday under them) under that person's couch and tag, with a grape "N h apart" badge tipped -6 degrees and stuck on the panel's top edge between the couches. Long names truncate inside their tag.

### Loading
Each page has its own loading state, drawn block for block in its own layout (`skeleton.tsx` next to the page; Home's is `home-skeleton.tsx`), so nothing jumps when the data arrives. They are built from the pieces in `src/components/skeleton.tsx`, which are the real classes with a no-break space for content (`.chip`, `.tab`, `.field`, an empty disabled `<select>`, `.btn`, `.btn-quiet`, `.card`, `.spotlight`, a line in the text's own size), so heights follow the skin and only widths are guesses. Bars sit inside those lines: body text is a soft bar in the text's own colour (`currentColor` at 15%, so it reads on paper, the ground, Night Owl and the spotlight), `display` lettering is a paper cut-out with an ink edge and a hard shadow, `display-pop` the same in the spotlight-head colour, `display-ink` a plain ink bar. Posters are grape-soft blanks at `<Poster>`'s sizes. The couches appear only where the page has them (Home's clocks, empty states, Settings' Look tile). Text bars pulse only with `motion-safe`. Wordless. `PageLoading` (couches over three blank cards) is left only for pages that don't have their own yet.

### Motion
- **The spring clock:** `--ease-spring: cubic-bezier(0.2, 1.4, 0.4, 1)` for presses, hovers, pops, the poster morph (420ms) and Pick's deal. `--ease-out-expo` is available for plain settles. UI moves overshoot once and settle within about 0.4 to 0.6s.
- **Vocabulary:** `pop` (bursts), `wiggle` (a `.tilt-row` on hover, ±1.5 degrees around its tilt, 0.4s), `bob` and `blink` (couches), squash (button press), `pick-deal` (a new pick deals in from the right with a spin, 0.55s), `jiggle` and `smear` (nav).
- **Intro:** once per app launch (a `sessionStorage` flag), requested by `LOOK_SCRIPT` before paint so a grape cover is up from the first frame. A bubblegum starburst spins in with "Two Couches!", the words swap for the couches, then a burst-shaped hole spins the cover open while the burst whirls into the measured header logo. About 1.7s. A tap or any key skips it. It lands on the logo at every breakpoint, takes its colours from the active palette and never runs with reduced motion.
- **Page transitions:** React `<ViewTransition>` with transition types from nav links (`flightTypes()`; nav order is `SECTIONS`). **Whoosh** forward: the old page skids off left with a skew (260ms), the new one skids in from the right (440ms, slight overshoot). Speed lines cross the screen and get denser with distance. Each section skipped riffles past as a blank paper preview (`FlightDeck`), 75ms apart. **Peel** back: the old page, drawn as an opaque sheet of the ground with its rays lined up, peels off to the right with a slight rotation. Skipped sections peel off after it, 80ms apart, and the earlier page rises from 96.5% scale underneath. Browser back and forward follow the Navigation API. Only `transform` and `opacity` animate. With reduced motion every view-transition animation is off.

### What a skin defines
A `[data-skin="…"]` block with `--font-skin-display`, `--font-skin-body`, `--outline-width`, `--skin-radius-panel`, `--skin-radius-control`, `--skin-radius-poster`, `--lift` and `--lift-sm`. It also needs any ground decoration (Saturday Morning's `body::before` rays and the matching peel-sheet background), its own `next/font` declarations (`preload: false` unless it's the default), an entry in `SKINS` with its palettes (first is standard), and Settings names and notes in i18n. Skin-only decorations are small components. Shared components keep reading the tokens.

## Do's and Don'ts

### Do:
- **Do** put every surface on cream paper with a 3px ink outline and a flat ink offset shadow (6px panels, 3px controls, 4px posters).
- **Do** use bubblegum only where the two of you overlap: the Burst for "both can watch", the dot on "We can both watch" filters, both being ready.
- **Do** keep coral and sky as fills with ink text and an ink outline (couches, dots, name tags, ticket dots).
- **Do** give each screen exactly one grape spotlight for its moment, with its head in pop-filled display lettering.
- **Do** use full `display` lettering on the ground and spotlight, and `display-ink` on paper.
- **Do** mark selected chips, tabs and options with `aria-pressed`, `aria-current`, `aria-checked` or a checked input, and let the CSS turn them grape.
- **Do** move on the spring clock (`cubic-bezier(0.2, 1.4, 0.4, 1)`), animate only transform and opacity in transitions, and gate every loop and entrance behind `prefers-reduced-motion: no-preference`.
- **Do** take every colour from tokens, so a new palette changes the whole app.
- **Do** draw icons as SVG from `icons.tsx`, and keep pages in the 48rem column unless the root sets `data-wide`.

### Don't:
- **Don't** use the bubblegum stamp for statuses, alerts or decoration that isn't about both of you.
- **Don't** set text in coral or sky. Neither passes contrast as text.
- **Don't** add soft, blurred or coloured ambient shadows, glass, backdrop blur or dark streaming-dashboard grids. The peel sheet's edge shadow is the only soft one.
- **Don't** put a second spotlight on a screen, or fill large areas with grape outside it.
- **Don't** hard-code hex values or use `dark:` variants in components. Write a palette block instead.
- **Don't** put stroke-and-shadow `display` lettering on paper, or plain `display-ink` on the ground.
- **Don't** animate blur, filters or fixed backgrounds in page transitions, or play the intro more than once per launch.
- **Don't** use glyph characters for icons or arrows in strings, or uppercase small tracked labels above headings.
