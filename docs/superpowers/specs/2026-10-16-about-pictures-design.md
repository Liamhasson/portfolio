# About: pictures along the track, and the testimonials' lit glass

**Status:** designed with Liam in chat on 2026-10-15/16, decided frame by frame in the brainstorming companion (final
mockup: `.superpowers/brainstorm/47986-1792116854/content/about-pictures-v26.html`). Builds on
`2026-10-12-about-contact-design.md` §3 (the About track) and changes one of its rules: the testimonials get a small
WebGL canvas (§4), so About is no longer entirely WebGL-free. House rules apply (Geist, no italic, the motion is ours),
with one exception Liam chose: the testimonials' edge light (§4.1) is coloured light at the screen's edges, which the
no-glow rule would otherwise forbid.

## 1. Decisions (Liam, 2026-10-15/16)

- **Pictures appear throughout About** as the text slides left: small add-ons to the words, not hero images. Content is
  mixed by section: Liam's life in the story half, the work's proof in the second half.
- **Never the same picture or video twice in About.**
- **One motion rule for every picture but the portrait:** it **rises out of its line** as it arrives, and it is **cut at
  the margin line** as it leaves (§3).
- **Loops where we have them**, playing only while on screen.
- **The testimonials get Oryzo's "Powered by AI" treatment, made ours** (§4): warm light hugging the screen's edges and
  travelling around them, the edges pushing back and forth unevenly, the site's glass ball between the two quotes
  catching that light in its highlights, and the screen's far edges turning to glass that bends what passes under it.
- Rejected along the way (do not reintroduce): a warm grade on the portrait; a pencil sketch above paragraph 2; Pulse in
  the product strip ("it wasn't developed"); pictures on Yoav's quote and on Find the problem / Check I'm right; a crisp
  line frame around the testimonials; colour "water" rippling across the whole screen; a ball filled with colour; the
  hard reflected ring inside the ball.

## 2. What appears where

The track, left to right (text unchanged; `docs/copy/about.md`):

| Where | What | Size | Notes |
|---|---|---|---|
| Opens the track | **Graduation portrait** (`/about/portrait.jpg`, 760×1273, original colours) | as tall as the tallest text layer (measured) | 10px corners (= the work index's thumbnails). Already built: held still and cropped away left to right, finished exactly as the first line reaches it. |
| Right after "two rock bands" | **Two word-sized loops**: Marni Came (`/playground/after-heartbreaks-loop.mp4`, poster `after-heartbreaks-film.jpg`), Sanskrit (`/playground/my-small-world-loop.mp4`, poster `my-small-world.jpg`) | 1.3em × 0.8em, inline | Part of the existing link to /playground. Titles for hover: "Marni Came", "Sanskrit". |
| Right of paragraph 2, bottom on its last line | **Studio from above** (`/playground/studio-overhead.jpg`) | 12vw wide, 3:4 | Caption (mono): "Producing · Marni Came". 3.2vw from the paragraph. |
| Under "End to end, from the problem to the shipped product." | **Strip of three loops**: Cyvore, Eventread, Nordic Logic (`/work/*.mp4`, posters `/work/*.jpg`) | 9vw each, 16:10, 1.6vw apart | Each captioned with its name and linking to its case study. |
| Between Yoav's and Andrada's quotes | **The glass ball** (§4.2) | ~15vw across | Not a picture: drawn in the testimonials' canvas. |
| Right of "Build it." | **The desk build-up video** (§5) | 34vw wide, 16:10 | 7vw before it, 5vw after it (more room than a slide gap: Liam, "it deserves space"). Caption: "This desk · wire to final". |

Nothing on "That's still how I work", Find the problem, Check I'm right, Andrada's quote, or the closing line.

## 3. Picture motion (desktop track)

Scrubbed by scroll, both ways; computed from each picture's position along the track (measured once per layout,
transform-proof), applied with `clip-path` and `visibility`, never layout.

- **Arrival: rise from its line.** Hidden until its left edge reaches 94% of the screen width, then uncovered upward
  from its bottom edge, fully shown by 70% (smoothstep).
- **Exit: cut at the margin line.** It keeps moving with its words; from the moment its left edge crosses the margin
  (6vw: where the portrait sits), the part past the line is cut away, left to right. Its caption is cut with it.
  Fully cut → `visibility: hidden` (no 1px remnant: a bug in an early mockup).
- **The portrait keeps its own rule** (already built): held still, cropped left to right over the gap to the first line.
- **Loops** play only while on screen (IntersectionObserver), muted, inline, looping, poster first; under reduced motion
  they show their posters and never play.

## 4. The testimonials: lit glass

One fixed, full-screen canvas over the track (WebGL, one fragment shader, `mix-blend-mode: screen`, aria-hidden), and
one glass layer under it. Everything is scrubbed by one amount **q** (0–1): q rises as Yoav's quote's centre moves from
105% to 65% of the screen width and falls as Andrada's centre moves from 35% to −5% (eased sine-in). Behind the words
the black warms slightly (a radial plum-brown at 0.6 × q). The canvas and the lens run only while q > 0 or the ball is
on screen.

### 4.1 The edge light (Oryzo's AppleEfx, ported; studied on oryzo.ai 2026-10-16)

- **A narrow band hugging the screen's rounded edge:** padding = min(50px, 10% of the shorter side); two falloffs from
  the rounded box (a tight one, cubed, and a wider soft one, to the fifth), as Oryzo's shader.
- **The colours travel around the frame:** four warm colours at the corners (#ff86e0, #ff9a3c, #ffe46a, #ff5f78),
  cubed and doubled, the field turning at −3.2 rad/s.
- **The edges fight back (Liam):** the band's inner edge pushes in and out by up to half its padding: a slow noise
  along the frame (in random places) plus a shared breath (all together), on warped time
  (t + 0.8 sin 0.31t + 0.4 sin(0.77t + 1.3)) so the pace is uneven and never loops visibly.
- **Arrival pulse:** as q first passes 0.02, one wave travels from the right edge's middle across the screen over
  2 s, pushing the frame outward as it passes (Oryzo's pulse starts at its scrollbar; ours where new content enters).

### 4.2 The glass ball (the site's hero object, returning)

- **Ray-traced in the same shader**, so its colours are the edge's at that instant: a true sphere behind the screen
  plane; reflection with Schlick Fresnel; refraction in and out at index 1.5.
- **Mostly glass (Liam):** what it sees is a dark room with a faint sheen from above, the lamp up to the left (a crisp
  spark in front; a soft one behind, seen through the glass as the oval the glass renders show). No colour inside it.
- **The light's bounce lives only in its highlights (Liam):** a glint along the rim in the colour of the screen edge it
  faces, in uneven arcs that come and go with the edges' push and pull; the lamp's glints take a little of that colour.
- Centred in a 17vw slot between the two quotes, radius 0.44 × the slot; travels with the track.

### 4.3 The glass edges (Liam: "like glass UI, crisp, only the far edges")

- A fixed full-screen layer with `backdrop-filter: url(#edge-lens)`: an SVG `feDisplacementMap` driven by a generated
  map (an `feImage` data URL, rebuilt on resize). A band ~56px wide (6.5% of the shorter side, at most) along the
  rounded screen edge; each point samples from further in along the edge's inward normal, by up to **26px** at the rim,
  easing (t²) to nothing at the band's inner edge. The words magnify and bend toward the rim; no blur.
- Its strength scales with q and breathes with the same uneven push and pull as the light.
- **Layering:** track (z1) → lens (z3) → light canvas (z4). The light sits above the glass, so the lens bends the page,
  not the light.
- **Gotchas found in the mockup:** the filter needs `filterUnits="objectBoundingBox"` x0 y0 w1 h1 (userSpaceOnUse did
  nothing); 34px with a steeper curve smeared letters into streaks.
- **Browser support:** `url()` in `backdrop-filter` is Chromium only. Safari and Firefox get the light and the ball
  without the bend (feature-detect; no broken frame).

### 4.4 Fallbacks and cost

- No WebGL, or a lost context: no canvas; the quotes read as before.
- Reduced motion: the colours hold still, no push and pull, no pulse; the lens is a fixed, gentle bend (or off: see §7).
- Canvas at devicePixelRatio ≤ 1.5; the frame loop stops when nothing is on screen.

## 5. The desk build-up video

Liam's idea: the desk the site is built around, modelled and lit in Blender, building itself up layer by layer.

- **One still camera** (closer than the site's whole-table view: camera (0.12, −0.64, 0.60) → (0.08, 0.06, 0.00), 36mm),
  laptop shut, no sand.
- **Five frames, the same scene:** wireframe (the real meshes; the notes' dense grids un-subdivided for this pass only),
  clay (one grey under the real lamp), materials (the real materials under flat light, same black void), light (lit,
  neutral AgX, no lens), final (AgX Punchy + the camera's depth of field: the site's exact look; no grain baked in, the
  page adds its own).
- **Cut:** each layer slides in over the last, left to right, a 1px warm seam at the wipe, 0.8 s eased wipes, 0.9 s
  holds, 2 s on the final, then back to wireframe so the loop closes. 9.6 s, 1440×900, H.264 CRF 20 (~1 MB), poster =
  the final frame. `public/about/desk-build.mp4` + `desk-build.jpg`.
- **Reproducible:** the pass and cut scripts move into `blender/lookdev/` (`desk_passes.py` via lookdev.py's
  `LOOKDEV_LIST` hook; `desk_passes_compose.py`); a full bake takes ~4.5 min. Re-bake whenever the desk changes.

## 6. Phones and reduced motion (stacked About)

About stacks on portrait phones and under reduced motion (track.ts). Proposed, not yet seen by Liam:

- The band loops stay inline in the sentence. The studio picture, the product strip and the desk video sit under their
  text at the column's width. Each rises in with its slide (the stack's existing reveal). No margin cut (nothing slides
  sideways).
- The portrait sits above the first line (as built).
- The testimonials keep the light, the ball (between the stacked quotes) and, on Chromium, the glass edges, scrubbed by
  the quotes' vertical position instead of horizontal.

## 7. Open points for Liam's review

1. **Phones (§6):** as proposed?
2. **Glass edges:** only during the testimonials (as mocked), or the screen's edges as glass for all of About?
3. **Reduced motion:** a fixed gentle bend at the edges, or no bend at all?

## 8. Testing

- Unit: the rise and cut maths (position → clip insets, the hidden state), the testimonials' q (both ends and the
  middle), the lens map (neutral in the middle, inward at the rim, nothing past the band).
- Component: the pictures render in their slides with their sources, captions and links; nothing appears twice; loops
  get posters; reduced motion renders posters only.
- Browser (the dev server, Chrome and Safari): the frames from the mockup (pictures arriving and leaving; the testimonials
  with q at 0, ~0.3 and 1; the ball; the glass edge bending letters), no console errors, the canvas idle when away.
