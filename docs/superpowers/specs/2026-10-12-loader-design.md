# The loader: the brief grows from nothing, its points become sand

**Status:** designed with Liam in chat on 2026-10-12, with mockups in the brainstorming companion
(`.superpowers/brainstorm/…/content/loader-blueprint.html`). Chapter 0 of `2026-10-11-scene-order-design.md`. It hands off
into the hero without a cut. The quality bar: Lusion's and Oryzo's loaders (studied frame by frame on 2026-10-12).
House rules apply: no glow anywhere, every grain the hero's own sand, and the motion is ours.

## 1. Why this loader

Oryzo's loader is the construction drawing of its hero object, drawn at the exact size and place where the object then
appears. Lusion's progress bar folds into the brand's "L". Both work for the same reason: the loading element is a real
thing from the next scene, so the hand-off is a transformation, not a cut.

Ours: **the brief.** A circle with a designer's construction (anchor points, curve handles, bounding box, centre guides),
at the exact size and place where the ball will form later. It grows from nothing as the files arrive. At 100% its
points turn into sand: each anchor becomes a grain, the grains split and multiply, and the lines dissolve as their
points become material. The grains stream into the vortex while the key light comes up. Later, when the ball forms on
scroll, the brief returns for a beat as the sand locks into it.

The story it tells, without a word: a brief, then ambiguity, then a product that meets the brief.

## 2. The sequence

### 2.1 First paint

- The graded black (#0b0908) and nothing else.
- The nav, the copy and the outlined name are hidden, and scrolling is locked.

### 2.2 The brief grows with the loading

- A single anchor appears at the ball's centre, where the ball will form (its projected centre and radius from the 3D
  scene, so it registers exactly).
- From it, the circle grows from 0% to the ball's full size, as if dragged out from its centre with a design tool's
  ellipse tool. **The size is the progress.** It never draws itself on, and it never shrinks.
- Its construction grows with it:
  - the bounding box, with a hollow square handle at each corner;
  - the curve's four anchors (top, right, bottom, left), each with its tangent handles (the bezier construction of a
    circle: handle length 0.5523 × the radius, ending in small dots);
  - the centre anchor;
  - the dashed hairline guides through the centre, across the full width and height.
- The style is approved option B, "in the scene's light":
  - warm hairlines (rgb 230, 191, 174) at 1 CSS px;
  - anchors are 5 px hollow squares filled with the background;
  - guides are dashed at about 30% opacity;
  - no glow, no shadow, no fill.
- The size follows the real progress but is smoothed:
  - it chases the progress with a damped ease, so bursts and stalls read as natural;
  - it takes at least 1.2 s, so a cached load still lets the brief read;
  - it ends with an ease-out into full size.

### 2.3 At 100%: its points become sand (about 3.6 s)

- **The anchors become grains**, in order: the centre at 0 s, then the box's corners (0.2 to 0.3 s), then the curve's
  four anchors (0.32 to 0.5 s). Each anchor's square shrinks away over 0.22 s while a real grain (the hero's own, lit
  and shaded) appears at its point.
- **The lines dissolve:** the circle breaks into dashes whose gaps open from 0.2 s and fade, and the box, handles and
  guides fade with it. All of it is gone by 1.4 s.
- **The grains split.** Each grain divides on its own clock (every 0.14 to 0.42 s, slowing as the count grows), the two
  halves pushed apart by a small impulse. The cascade from the 9 points reaches the full cloud (the tier's grain count)
  by about 2.6 s.
- **The flow:** as they multiply, the grains spread outward from the anchors into the vortex, each to its own place in
  the cloud, turning with the vortex (counter-clockwise). The vortex turns about the ball's centre
  (`hero-layout.ts` `vortexOnBall`, Liam, 2026-10-12), so the brief, the vortex and the ball share one centre. The
  cascade ends as the hero's own cloud with its own motion (`swirl.ts`, the streams), with no seam.
- **The cursor's lean** (`parallax.ts`: the front of the cloud follows the cursor more than the back) stays at rest until
  scrolling unlocks, then follows the cursor.
- **The key light comes up** from 0.9 s to 2.4 s: the hero's lighting, from dark to its normal level. The outlined name
  LIAM HASSON comes up with it.
- **The copy and the nav** fade in from 2.8 s to 3.6 s: "Hi, I'm Liam." and its lines, and the pills, with their
  entrance (`sh-enter`). Scrolling unlocks at 3.6 s.

### 2.4 Later, on scroll: the brief returns as the ball locks in

- As the ball forms (compaction from about 0.75 to 1.0), the brief fades back in, drawn at the ball's exact projected
  outline: the circle, the box and its handles, and the curve's anchors with their handles.
- It holds for a beat as the sand locks into it, then fades.
- It is scroll-driven and reverses when scrolling back, like everything after the loader.

## 3. When it plays

- **Every fresh page load of the story** (Liam, 2026-10-12, revising "once per session": opening or reloading it plays
  the loader).
- **No loader** in these cases, which get a 0.6 s fade from black instead:
  - client-side arrivals (Back or Projects from a case study), which don't reload the page;
  - deep links that land past the hero (`#projects`, `#about`, `#contact`).
- **`?loader`** plays it even on a deep link.
- **Reduced motion:**
  - The brief still grows, since it is progress feedback, not decoration.
  - At 100% there is no splitting or flow: a 0.4 s crossfade to the hero's held state.
  - The brief does not return on scroll; reduced motion holds the ball as a held state.
- **No WebGL, or an error:** no loader, the existing fallback.

## 4. What it waits for (the progress)

- **Counted:** what the hero needs:
  - the sand: `sand.json`, the three density volumes, the tier's grain parts;
  - the shot's `camera.json`, the haze, the grain tile and the wordmark's font;
  - the first frames compiled and warm (`composite.warm`, `compileAsync`).
- **Weighting:** the bytes are counted as they stream (`Content-Length`). The compile and warm-up is the last 10%,
  estimated by time.
- **Not counted:** the desk (about 20 MB). It keeps loading in the background during the hero, as now, so the first
  wait stays short.

## 5. How it's built

### 5.1 The brief

- A crisp SVG overlay above the canvas and below the copy.
- Positioned each frame from the ball's projected centre and radius (the same projection the scene uses), so it
  registers exactly at any viewport and pixel ratio.
- Pure drawing, no WebGL. A small module, `src/app/lab/sand/brief.tsx`, with its geometry in a tested TS function.

### 5.2 The cascade

- On the GPU and stateless, like `swirl.ts` and `rising.ts`, so no per-grain state on the CPU.
- **Lineage:** a binary tree over the grains' indices.
  - Grain i descends from one of the 9 anchors.
  - Its generation is floor(log2(i + 1)) within its anchor's share.
  - It is born at its parent's position at its generation's time (plus its own jitter), with an impulse away from its
    sibling.
- **The path:** from its birth, a smooth path to its own place in the cloud, turning with the vortex. It reaches its
  place by the end of the cascade, where the hero's normal motion takes over with no jump.
- **Driver:** one uniform, the cascade's clock.
- **Tested with a TS mirror:**
  - no grain pops or jumps;
  - the count roughly doubles per generation;
  - every grain is home and joins the swirl continuously by the end.

### 5.3 Light and copy

- **Light:** the hero's light levels scaled by one factor, 0 to 1 over the cascade. No new light rig.
- **Copy and nav:**
  - The hero overlay and the pill nav take a "held until" signal from the loader.
  - They stay hidden (and out of the accessibility tree's focus order) until it's released.
  - A visually hidden live region announces the loading ("Loading, 64%") and "Ready".

### 5.4 Scroll lock

- Lenis stopped, and `overflow: hidden` on the root, until the unlock.
- Keyboard scrolling is locked too.

## 6. Budgets and checks

- **Duration:**
  - Cached or fast: the brief (at least 1.2 s) plus the cascade (3.6 s), about 5 s in all. That stays within the
    concept's limit of 6 s, unskippable.
  - Slow connections: the brief grows as long as the files take, and the cascade starts at 100%.
- **Frame rate:** 60 fps through the cascade on the high tier. Its per-grain cost is measured against the hero's
  (it replaces, not adds to, the swirl while it runs).
- **Checks:**
  - unit tests for the brief's geometry, the progress weighting, the session gating and the cascade's mirror;
  - a frame-by-frame capture of the sequence on desktop and phone, the phone with the circle and the vortex centred;
  - the live build's timing measured on a throttled connection (Fast 4G).

## 7. Out of scope

- A counter or percentage on screen: the brief's size is the progress.
- Sound.
- The desk's own loading state: it's in the background, ready by the time the shot needs it.
