# media-src

Source media the site doesn't serve: originals, uncropped captures, earlier cuts and unused fonts. Moved out of
`public/` before launch (2026-10-12) so they stop shipping with every deployment (about 92 MB). Nothing in `src/` references
them; if one is needed again, move it back into `public/` at the same path.
