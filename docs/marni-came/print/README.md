# Marni Came: print files for the mockup shoot

These are the flat artworks behind the shot list (board spread 13, `docs/prototypes/marni-came-mockups.html`). They are
made by `tools/marni-came/print.py` (photos treated at print size) and `tools/marni-came/print.mjs` (type set in real
millimetres, the same layout the site uses). Photographic pieces are JPEG (quality 93, no chroma subsampling). Flat or
transparent pieces are PNG. The dpi is written into every file.

| File | Trim | Bleed | Pixels | dpi | Notes |
|---|---|---|---|---|---|
| `poster-lido-A3.jpg` | A3, 297 × 420 mm | 3 mm | 3579 × 5031 | 300 | The source photo is 1365 px wide, about 114 dpi at A3. Fine for a shot, soft up close. |
| `poster-badehaus-2024-A3.jpg` | A3 | 3 mm | 3579 × 5031 | 300 | The source is 2048 px wide, about 172 dpi at A3. |
| `poster-badehaus-2023-A3.jpg` | A3 | 3 mm | 3579 × 5031 | 300 | A frame from the 4K show video, about 129 dpi at A3. |
| `poster-end-of-term-A3.jpg` | A3 | 3 mm | 3579 × 5031 | 300 | The source is 1600 px wide, about 134 dpi at A3. |
| `sleeve-12in.jpg` | 12 × 12 in (304.8 mm) | 3 mm | 3671 × 3671 | 300 | The cover master is 3000 px, about 245 dpi at 12". |
| `ticket.png` | 70 × 140 mm | 3 mm | 898 × 1724 | 300 | The Badehaus ticket. The dashed tear line sits above the price. |
| `stage-flag.jpg` | 1200 × 800 mm | none | 7087 × 4724 | 150 | 150 dpi is the large-format standard. Black cloth, edge to edge. Hems and grommets are the printer's allowance. |
| `shirt-front.png` | 12 × 16 in print area | none | 3600 × 4800 | 300 | Transparent. The bone distressed wordmark, 10 in wide, for a black tee. |
| `shirt-back.png` | 12 × 16 in print area | none | 3600 × 4800 | 300 | Transparent. "I need it / I want it / I'm after" in bone, for a black tee. |
| `epk-spread.jpg` | A4 spread, 420 × 297 mm | 3 mm | 5031 × 3579 | 300 | Left: the burned logo, the singles, the stages. Right: the four members. No contact details. |

**No A2 posters.** No poster photo reaches 150 dpi at A2: Lido gets about 81, Badehaus 2024 about 122, Badehaus 2023
about 92, End of Term about 95. So every poster is A3 only, as the plan says.

Rebuild everything:

```bash
python3 tools/marni-came/print.py /tmp/mc-print && node tools/marni-came/print.mjs /tmp/mc-print
```
