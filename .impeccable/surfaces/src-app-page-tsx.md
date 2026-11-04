---
version: 1
slug: "src-app-page-tsx"
primary_target: "src/app/page.tsx"
related_targets: ["src/app/layout.tsx","src/app/browse/page.tsx","src/app/globals.css"]
---

# The whole app, Saturday Morning skin

Scope: the skin system and the default skin across every page (shell, Home, Browse, title page, search, Coming soon, Watch nights and their forms, Pick, Stats, Settings, couple, login, offline, not-found), plus the couch mascot, intro D and the whoosh/peel page transitions. Mode: Operate. PC/laptop first, phone complete. Approved prototypes: `design/labs/cartoon-lab.html#sat`, `intro-lab.html` (D), `transition-lab.html` (whoosh + peel back).

Audience and job: the couple, evenings, hours apart. Home: both clocks, the next watch night, the list with what you can both watch popping out. Browse: find something you can both stream. Watch nights: plan, get ready together.

Constraints: no animation library; transitions animate only transform and opacity (no blur, filters or fixed backgrounds); reduced motion turns intro and transitions off; bilingual (Turkish runs long; uppercase from CSS with `lang`); every visible string through i18n; skins and palettes are per device, set before paint (`data-skin`, `data-palette`), only the active skin's fonts load; colours only through tokens.

Decided with the user (2026-11-04): the festival editions are removed; Saturday Morning ships with its one approved palette now (the palette lab adds more later); Settings shows Look with the one skin.

## Direction contract

THESIS: The shared list as a Saturday-morning cartoon for two: every screen is a sunny cel of ink-outlined paper panels, the two people are two little couches, and a bubblegum starburst pops only on what both can watch. Refuses the streaming-service dashboard (dark grids, glass, backdrop heroes) and timid "playful" SaaS (pastel cards plus a mascot sticker).

OWN-WORLD: Sunburst yellow #ffd23f ground with conic rays from top centre; cream paper #fffaf0 panels, 3px ink #1d1a2b outlines, 22px corners, hard offset ink shadows (4–6px); one grape #6a4cf5 hero panel per screen; coral #ff8a65 me, sky #5cc8ff partner, bubblegum #ff2e93 starburst for both only. Luckiest Guy display with ink stroke and offset shadow; Fredoka body. Pill nav with a travelling grape pill. Blinking, bobbing couch mascots.

STORY: Launch: a starburst spins in with "Two Couches!", swaps for the couches and whirls into the header logo as the cover spins open. Home shows both clocks with a tilted "13 h apart!" badge, the grape "Next watch night" ticket panel, and the list, where bursts pop onto titles you can both watch. Moving forward whooshes, going back peels.

FIRST VIEWPORT: Home at 1440: header with couches and outlined wordmark left, pill nav right. Left 5/12: paper clocks box (two clocks, grape "apart" badge between), grape night panel tilted -1° with poster, two paper tickets and "I'm ready!"; search and Pick under it. Right 7/12: outlined tab buttons (Up next / Watched / Dropped), filter chips, list rows as tilted paper boxes with posters and bursts. Phone: stacked; bottom tab bar is a paper strip with the grape pill.

FORM: Saturday Morning, pinned by the user from the approved labs, overriding the roll (seed key 47eb74ce, which assigned grounded candidate 6). Raise from the declined "zoo guide map" challenger: one motion clock, every UI move overshoots once and settles in about 0.4 s.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Signature interaction: the BOTH starburst pops onto a title (scale from 0 with a spin, overshoot, settle at a tilt) as availability arrives; page whoosh/peel with the travelling nav pill. Motion grammar: springy overshoot `cubic-bezier(.2,1.4,.4,1)` for pops and presses, wiggle on hover for rows, squash on press for buttons; reduced motion = instant.
