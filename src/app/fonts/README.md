# Fonts

`fredoka-idot.woff2` holds one letter, the Turkish capital İ (U+0130), which Fredoka doesn't have. It is built from Fredoka's own glyphs, the same way Fredoka builds Î: the `I` plus the combining dot above (`uni0307`), with the dot sitting as far above the `I` as it does above the `i`, across the weight axis (300–700). Fredoka is under the SIL Open Font License 1.1, which allows modified versions like this one.

`src/app/layout.tsx` loads it with `unicode-range: U+0130`, ahead of Fredoka in `--font-skin-body`, so it downloads only for pages that contain an İ.

To rebuild it: `pip install fonttools brotli`, take two of Fredoka's Google Fonts files from `.next/dev/static/media` after `npm run dev` (the `latin` subset, which has `I`, `i` and `Icircumflex`, and the one that has `uni0307`), and run `python design/fonts/fredoka-idot.py <latin.woff2> <marks.woff2> src/app/fonts/fredoka-idot.woff2`.

`bagel-fat-one.woff2` is Sticker Scrapbook's lettering face: Bagel Fat One's Google Fonts `latin` file plus the five Turkish letters Bagel doesn't have, İ Ş ş Ğ ğ (U+0130, U+015E, U+015F, U+011E, U+011F; it does have Ç ç Ö ö Ü ü ı). İ is the I plus one dot of Bagel's capital diaeresis at Ö's height; Ş and ş are the S and s plus Bagel's own cedilla (ş's raised like ç's); Ğ and ğ are the G and g plus a breve drawn by the script (Bagel has none): a round-capped smile as wide as the diaeresis and about as thick as one of its dots. Bagel Fat One is under the SIL Open Font License 1.1, which allows modified versions like this one.

It is one local file (`next/font/local` in `src/app/layout.tsx`, `preload: false`) rather than `next/font/google`, because Google serves Bagel as about a hundred Korean `unicode-range` slices, which put some 90 `@font-face` rules into every page's CSS for every look.

To rebuild it: `pip install fonttools brotli`, open `https://fonts.googleapis.com/css2?family=Bagel+Fat+One` in a current browser, download the woff2 under `/* latin */`, and run `python -I design/fonts/bagel-fat-one.py <latin.woff2> src/app/fonts/bagel-fat-one.woff2`.
