# Fonts

`fredoka-turkish.woff2` holds the five Turkish letters Fredoka's Google Fonts files don't have: İ Ş ş Ğ ğ (U+0130, U+015E, U+015F, U+011E, U+011F; checked 2026-11-12 in the current `latin` and `latin-ext` files). Each is built from Fredoka's own glyphs, the way Fredoka builds its accented letters, with the mark's place worked out at the lightest and heaviest weight (300 and 700) and varying in between:

- İ: the `I` plus the dot above (`uni0307`), centred like Î's circumflex and as far above the `I` as the dot is above the `i` (at least half that gap at 700, where bold i's dot nearly touches its stem).
- Ş, ş: the `S` and `s` plus Fredoka's cedilla (`uni0327`), placed under them as Ç and ç place it.
- Ğ, ğ: the `G` and `g` plus Fredoka's breve (`uni0306`), placed over them as Ô and ô place the circumflex (over g's bowl, not its tail).

The served `latin` file has no dot above or breve, so those two come from Google's full Fredoka source (`wdth` 100). Fredoka is under the SIL Open Font License 1.1, which allows modified versions like this one. It replaced `fredoka-idot.woff2` (İ only) on 2026-11-12.

`src/app/layout.tsx` loads it with `unicode-range: U+0130, U+011E-011F, U+015E-015F`, ahead of Fredoka in `--font-skin-body`, so it downloads only for pages that contain one of those letters.

To rebuild it: `pip install fonttools brotli`, open `https://fonts.googleapis.com/css2?family=Fredoka:wght@300..700` in a current browser and download the woff2 under `/* latin */`, download `https://github.com/google/fonts/raw/main/ofl/fredoka/Fredoka%5Bwdth%2Cwght%5D.ttf`, and run `python -I design/fonts/fredoka-turkish.py <latin.woff2> <Fredoka[wdth,wght].ttf> src/app/fonts/fredoka-turkish.woff2`.

`bagel-fat-one.woff2` is Sticker Scrapbook's lettering face: Bagel Fat One's Google Fonts `latin` file plus the five Turkish letters Bagel doesn't have, İ Ş ş Ğ ğ (U+0130, U+015E, U+015F, U+011E, U+011F; it does have Ç ç Ö ö Ü ü ı). İ is the I plus one dot of Bagel's capital diaeresis at Ö's height; Ş and ş are the S and s plus Bagel's own cedilla (ş's raised like ç's); Ğ and ğ are the G and g plus a breve drawn by the script (Bagel has none): a round-capped smile as wide as the diaeresis and about as thick as one of its dots. Bagel Fat One is under the SIL Open Font License 1.1, which allows modified versions like this one.

It is one local file (`next/font/local` in `src/app/layout.tsx`, `preload: false`) rather than `next/font/google`, because Google serves Bagel as about a hundred Korean `unicode-range` slices, which put some 90 `@font-face` rules into every page's CSS for every look.

To rebuild it: `pip install fonttools brotli`, open `https://fonts.googleapis.com/css2?family=Bagel+Fat+One` in a current browser, download the woff2 under `/* latin */`, and run `python -I design/fonts/bagel-fat-one.py <latin.woff2> src/app/fonts/bagel-fat-one.woff2`.

## Candy Shop: Dela Gothic One and Rubik

Both come from Google Fonts through `next/font` with `preload: false`, and both cover Turkish without help. Checked on 2026-11-05 with fontTools in the files `next/font` serves (the face the browser picks for each letter by `unicode-range`): İ ı Ş ş Ğ ğ Ç ç Ö ö Ü ü are all in the cmap and drawn (İ is taller than I, so it has its dot). Dela Gothic One is a Japanese face: its CSS has 123 `@font-face` slices, but Latin text only downloads the `latin` (14 KB) and `latin-ext` (9 KB) files, which hold every Turkish letter.

## The year in review image: Luckiest Guy as a TTF

`recap-luckiest-guy.ttf` is Luckiest Guy cut down to Latin, Latin Extended-A and punctuation (52 KB), for the PNG that `src/app/stats/recap/[year]/route.tsx` draws with `next/og`. Satori reads only TTF, OTF and WOFF (not the WOFF2 that `next/font` serves) and runs on the server, so the image needs its own copy. Luckiest Guy has every Turkish letter (İ ı Ş ş Ğ ğ Ç ç Ö ö Ü ü), so the image is lettered in it throughout: Google's Fredoka has no İ Ş ş Ğ ğ (on the site they come from `fredoka-turkish.woff2`, which Satori can't read). Luckiest Guy is under the Apache License 2.0.

To rebuild it: `pip install fonttools`, download `https://github.com/google/fonts/raw/main/apache/luckiestguy/LuckiestGuy-Regular.ttf` and run `python -I design/fonts/recap-font.py <LuckiestGuy-Regular.ttf> src/app/fonts/recap-luckiest-guy.ttf`.
