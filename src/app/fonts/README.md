# Fonts

`fredoka-idot.woff2` holds one letter, the Turkish capital İ (U+0130), which Fredoka doesn't have. It is built from Fredoka's own glyphs, the same way Fredoka builds Î: the `I` plus the combining dot above (`uni0307`), with the dot sitting as far above the `I` as it does above the `i`, across the weight axis (300–700). Fredoka is under the SIL Open Font License 1.1, which allows modified versions like this one.

`src/app/layout.tsx` loads it with `unicode-range: U+0130`, ahead of Fredoka in `--font-skin-body`, so it downloads only for pages that contain an İ.

To rebuild it: `pip install fonttools brotli`, take two of Fredoka's Google Fonts files from `.next/dev/static/media` after `npm run dev` (the `latin` subset, which has `I`, `i` and `Icircumflex`, and the one that has `uni0307`), and run `python design/fonts/fredoka-idot.py <latin.woff2> <marks.woff2> src/app/fonts/fredoka-idot.woff2`.
