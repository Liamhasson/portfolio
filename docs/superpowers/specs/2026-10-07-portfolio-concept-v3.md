# Liam Hasson Portfolio: Concept v3 (chapters 0 to 3 locked)

**Status:** approved by Liam through the look-dev rounds of 2026-10-06 and 2026-10-07. Supersedes `2026-10-05-portfolio-concept-v2.md` for chapters 0 to 3 and for every visual decision below. Chapters 3.1 onward (project sets, toolkit, about, reviews, contact) still follow v2 until they are revised. Phase 1 (foundation) stands as built. The quality bar (spec §12.1 of the original spec) applies to everything.

**Visual target:** the approved Blender renders in `blender/lookdev/renders/lookdev-*.jpg`, produced by `blender/lookdev/lookdev.py` (Cycles, scripted, repeatable). The real-time build must match them; the storyboard (`docs/storyboard/portfolio-storyboard.html`, "Portfolio Storyboard" artifact) shows each one in place with the page copy.

---

## 1. The story

One sphere is Liam's process made visible:

| State | Look | Meaning |
|---|---|---|
| **Chaos** | Loose filaments of solid sand in the dark | Ambiguity |
| **Dense ball** | The same grains packed into a sphere, alive | The idea taking shape, being tested |
| **Glass** | The sand turns into clear glass, inside out | The shipped product |

Every transition is driven by scroll and reverses when scrolling back. The only timed sequence is the loader. The particles never morph into anything other than the ball or the glass.

## 2. Materials (approved)

**Sand grains**
- Solid, crisp, **matte** grains. No glow, no additive light: grains in front hide grains behind.
- Shape: small, slightly irregular **rounded pebbles** (no facets).
- Size: about 0.4 to 0.9% of the ball's radius; the dense ball is a solid-looking mass.
- Structure: grains sit on warped noise filaments (bright ridges, dark gaps); the chaos uses sharper filaments than the ball.
- Colour grade, chosen by Claude on Liam's trust ("cinematic, not cheap"): plum `#2e0d1c` in the shadows and folds, dusty rose `#8f4258` for the body, rose-gold `#b9725c` where the key light lands, muted gold `#b98a4a` for the brightest grains. Nothing pastel or neon.
- Light: warm key from the front left, rose rim from behind, a dim cool fill. Strong contrast.

**Near-camera grains (gusts):** crisp as they approach the lens; they blur only in the very last moment before passing it.

**Flares: removed (2026-10-09, Liam).** In the live prototype they read as static, an event that pulls the eye every few seconds that the visitor didn't cause; the drift, spin and cursor light already make the ball alive. Original note, kept for history: every few seconds a loose spray of short streamers lifts off a patch of the ball's surface and falls back (like a solar prominence). Never a single solid stem.

**Glass (final state)**
- Clear, thick glass, physically true to the dark set: mostly see-through, with crisp edges and highlights carrying the shape.
- Soft studio reflections (broad overhead light, two soft side strips); colour only on the rims (rose on one side, gold on the other). Nothing recognisable reflected. No ring-shaped highlight (it reads as an opening).

**The transformation (sand to glass)**
- **Inside out:** the core becomes glass first and the clarity spreads outward through the sand.
- **One material turning into another, never two objects:** grains compact, their colour drains, and the surface becomes a **warm translucent frost, flush with the sand** (no holes, no glass core revealed inside the particles). The frost then clears into glass.
- **No heat** (no molten glow). The colour drains as it clears.
- The ball **contracts** as it turns, and stays alive: it is moving while it consolidates.

## 3. Chapters 0 to 3

**Chapter 0, loader (timed, 5.4s, never more than 6s, not skippable, once per session).**
- 0 to 2s: darkness; the light slowly finds the sand, faint, everywhere at once. No dot, no design-tool handles.
- 1.5 to 3.4s: "Hi, I'm Liam." types in over the drifting sand.
- 3.6 to 5.4s: the name glows up in the haze, "I build ambiguous ideas" rises in, the "Product Designer" label and scroll cue appear, scroll unlocks, the pill nav fades in last.
- Targets: `lookdev-ch0-loader-a.jpg`, `lookdev-ch0-loader-b.jpg`, `lookdev-ch1-hero-light.jpg`.

**Chapter 1, hero (scroll, about 3 screens, pinned).**
- Set: **pure dark void, no floor**, a thin haze, a soft rim glow upper right.
- Wordmark: **LIAM HASSON glowing faintly in the haze behind the sand** (option 2 of 3). The sand passes in front of it.
- Scroll 0%: chaos. About 50%: the sand pulls inward. About 85%: the dense ball, **exactly centred**, about 46% of the viewport height, in front of the name. Scroll turns the ball; when scrolling stops it keeps a slow idle spin.
- Copy: "Hi, I'm Liam. I build ambiguous ideas" → "into products where design and user needs meet." (word-by-word swap). A small "Product Designer" label.
- Targets: `lookdev-ch1-hero-light.jpg`, `lookdev-ch1-hero-mid.jpg`, `lookdev-ch1-hero-ball.jpg`.

**Chapter 2, how I work (scroll, about 3 screens): the dense ball, alive in three sets.**
- 2.1 "Finding the problem": a realistic research desk. Scanned dark walnut (Poly Haven, CC0, darkened) with a plank seam, scratches, a faint coffee ring and subtle dust. A warm lamp off-frame (not in shot) is the only key light; the ball does not emit. Soft shadow with a lighter core. Notes with **Liam's real handwriting** (lifted from his photos by `blender/lookdev/extract_ink.py`): "Who is this product for?" (front, in focus), "What would make this fail?", "Who does this better?", "What do they check before they commit?". Rough paper edges, overlapping layout, a transcript stack. Three dark grey 351-shape picks piled loosely at the back (an aside, never the focus). Camera grain, vignette, gentle bloom. Target: `lookdev-ch2-desk.jpg`.
- 2.2 "Checking I'm right": **a glowing grid on a dark floor** sinking into a gravity well under the ball. Target: `lookdev-ch2-bench-glow.jpg`.
- 2.3 "Building it": a dark design-tool canvas made of **physical beads**, crowding toward the ball and thinning to a regular grid further away. Live: the beads part around the cursor (reach about a quarter of the viewport width). Target: `lookdev-ch2-canvas.jpg`.

**Chapter 3.0, it ships.** A dark studio: the sphere floats before a large soft gradient of light. Dense ball → the transformation → glass. Headline "And then it ships." Targets: `lookdev-ch3-dense.jpg`, `lookdev-ch3-mid.jpg`, `lookdev-ch3-glass.jpg`.

## 4. Type and copy

- **Sans-serif only, no serif anywhere.** A free, self-hosted grotesk (Hanken Grotesk is the working choice; final pick side by side before launch) plus DM Mono for labels and footnotes. Accents by weight and colour.
- Voice: light, personal, memorable. Not satire, not formal.

## 5. How it is built (direction for the plans)

- One fixed WebGL stage (three.js). The sand and the ball are real-time GPU particles drawn as **lit, depth-tested sphere impostors** (solid, matte), not glowing sprites.
- **Same data as the renders:** the grain positions and colours are exported from the same Python code that produced the renders (`blender/lookdev/lookdev.py`), so the real-time ball has the identical filament structure.
- Sets for chapters 2 and 3 are rendered in Blender as backplates with matching cameras; the live sphere is composited in front and lit to match.
- Every real-time frame is compared side by side with its target render before Liam approves it.

## 5a. The live sand, as built and approved (build step 2, 2026-10-09)

Lab page `/lab/sand` (noindex). Decisions Liam approved while reviewing it on his own devices:

- **Material:** matched to the Cycles renders by measurement (`scripts/lab/sweep.sh`): total light per colour channel within about 5% in the chaos, the halfway state and the ball; grain and structure contrast matched on the ball. Self-shadowing from density volumes baked by the same Python as the renders.
- **Ambient life:** a slow drift and an idle spin; scroll turns the ball. **No flares** (removed: they read as static, an event the visitor didn't cause).
- **The cursor:** a light (grains near it brighten) plus a soft drift of the grains along its trail, with Lusion's ScreenPaint constants. The drift reaches **only the front layer**: grains with sand between them and the viewer stay put, so the ball keeps its shape. On phones the light follows the finger while it touches.
- **The wordmark:** LIAM HASSON in heavy Geist (Black) as dark outlines behind the sand, the one deliberate exception to the type weights. Light in the sand's colours travels through the strokes: a wave that comes in from a different spot each time, takes over the letters (~3s each), and moves on, every 15s; plus the cursor lighting the strokes along its trail.
- **Weight:** the grains download per tier (low 0.72 MB, mid 1.9 MB, high 4.8 MB, packed to under a pixel of precision, proven identical in the compare tool); density volumes ~0.45 MB with brotli.
- **Fallbacks:** reduced motion keeps the scroll compaction, drops drift, spin and the wave; no WebGL shows the approved renders as stills, crossfading chaos to ball with scroll.

## 6. Open items

1. The final typeface (side-by-side test).
2. Chapters 3.1 onward: revise next, starting with the case studies.
3. Loader frequency: once per session (current) or every visit.
4. Project tags: Figma and the live site disagree (Eventread, Pulse).
