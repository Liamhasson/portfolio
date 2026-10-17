# About: the testimonials' lit glass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** As the testimonials pass, warm light hugs and travels around the screen's edges, the edges push back and forth unevenly, the glass ball between the quotes catches that light in its rim, and the far edges turn to glass that bends the words. This works on desktop and on phones.

**Architecture:**
- **The light.** One fixed full-screen WebGL canvas (`TestimonialsLight`) draws the edge light. The page is scrubbed by one amount `q`, worked out from where the two quotes sit.
- **The ball.** The pendant's scene already draws the ball and owns it (`src/lib/about-glass.ts`). The light shares its colour field with the pendant's glass pass through one GLSL chunk, so the rim glints match the edge they face. The light draws its own ray-traced ball only when nobody has claimed the glass, for example when the pendant failed.
- **The glass edges.** A fixed layer with an SVG displacement `backdrop-filter`, Chromium only.

**Tech Stack:** Next.js 16.3.8 (read `node_modules/next/dist/docs/` before Next-specific code), React 19.2.8, three 0.186.1 (pendant side only), raw WebGL for the light, Vitest, Playwright (`playwright.about.config.ts`).

**Spec:** `docs/superpowers/specs/2026-10-16-about-pictures-design.md` §4 (all of it) and §6 (testimonials on phones). Liam settled the spec's §7 open points on 2026-10-17:
- glass edges during the testimonials only;
- under reduced motion, a fixed gentle bend;
- phones keep the light, the ball and (Chromium) the glass edges, scrubbed by vertical position.

Reference implementation (the approved mockup): `.superpowers/brainstorm/47986-1792116854/content/about-pictures-v26.html` (lines 236–390: shader, lens, q). It sits in the main checkout's `.superpowers/`, not the worktree's. Port its maths; don't copy its mockup-only parts.

## Global Constraints

- House rules: Geist, no italic, no glow, halos or bloom on anything else. The edge light is Liam's one exception: coloured light at the screen's edges (spec header).
- **No CSS `mix-blend-mode` over a WebGL canvas** (perf lesson 2026-10-11: about 14 ms a frame).
  - The light canvas draws premultiplied colour with alpha `max(r, g, b)`, which composites as an approximate screen blend.
  - This replaces the mockup's `mix-blend-mode: screen`.
- `q` (0–1):
  - It rises as Yoav's quote's centre moves from 105% to 65% of the screen width.
  - It falls as Andrada's centre moves from 35% to −5%, eased sine-in: `sineIn(fit(1.05·vw − c0, 0, 0.4·vw) · (1 − fit(0.35·vw − c1, 0, 0.4·vw)))`.
  - In the stack, the same formula uses vertical centres and the screen height.
- **Mood:** behind the words the black warms with a radial plum-brown at 0.6 × q: `radial-gradient(120% 90% at 70% 40%, #24120f 0%, #160d0c 50%, #0b0908 100%)`.
- **Edge light:**
  - padding = min(50 px, 10% of the shorter side);
  - two falloffs (cubed tight, fifth-power wide);
  - colours #ff86e0, #ff9a3c, #ffe46a, #ff5f78, cubed and doubled, the field turning at −3.2 rad/s;
  - the inner edge pushes by up to half the padding, from noise along the frame plus a shared breath;
  - warped time is `t + 0.8 sin 0.31t + 0.4 sin(0.77t + 1.3)`.
- **Arrival pulse:** one wave as q first passes 0.02, over 2 s. On desktop it starts from the right edge's middle; in the stack, from the bottom edge's middle.
- **Ball:** centred in its slot (17vw desktop, 50vw stack), radius 0.44 × the slot. Mostly glass: no colour or milk inside. The edge colour shows only in rim glints, in uneven arcs that come and go with the push and pull; the lamp's glints take a little of it.
- **Glass edges:**
  - The band is min(56 px, 6.5% of the shorter side).
  - Pull is up to 26 px at the rim, easing t² to nothing at the band's inner edge, with no blur.
  - Strength = q, breathing ×(1 + 0.2·g).
  - The SVG filter uses `filterUnits="objectBoundingBox"` x0 y0 w1 h1, and the map is rebuilt on resize.
  - Chromium only; Safari and Firefox get the light and the ball without the bend.
- **Layering inside `.ab-pin`:**
  - track (`.ab-clip`, z1)
  - pendant (z2 front / z0 back)
  - lens (z3)
  - light canvas (z4)
  - `.ab-bar` and `.ab-resume` stay readable: they're thin UI, and the light only sits at the far edges.
- **Reduced motion:** the colours hold still (T = 0), no push and pull, no pulse. The lens is a fixed gentle bend at 0.5 × the full strength, no breathing.
- **Cost:**
  - canvas devicePixelRatio ≤ 1.5;
  - the canvas and the lens run only while q > 0 or the ball is on screen;
  - no WebGL or a lost context means no canvas, and the quotes read as before.

## Review Focus

1. **Pendant running at the same time.** Two WebGL canvases plus a backdrop filter on screen together could drop frames on a 60 Hz laptop. Expect 60 fps held at 1440×900 with the lens on. Pinned by the Task 6 perf run.
2. **Pendant missing (no WebGL2, failed load).** The light must draw its own ball, so there is never an empty slot or two balls. Pinned by a Task 2 e2e that blocks the pendant's GLB.
3. **Jumping into the middle** (reload mid-testimonials, or a find-in-page jump). The light must show its scrubbed state at once, and the pulse must not replay on every jump; it plays only when q first crosses 0.02 going up. Pinned by a Task 2 unit test.
4. **Safari and iOS Chrome (WebKit).** No bend, no broken or black frame; the light and ball show normally. Pinned by a Task 4 unit test of the feature check, and a Task 6 WebKit Playwright run.
5. **Resize or rotation mid-testimonials.** The lens map, the canvas size and q all follow, with no stretched light and no stale map. Pinned by a Task 4 e2e resize test.

---

### Task 1: The edge light's shared core (pure)

**Files:**
- Create: `src/three/edge-light/field.ts`, `src/three/edge-light/field.test.ts`
- Create: `src/app/about/testimonials-q.ts`, `src/app/about/testimonials-q.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // field.ts
  export const EDGE_COLOURS: readonly [string, string, string, string]; // "#ff86e0","#ff9a3c","#ffe46a","#ff5f78" (C0..C3)
  export function warpTime(t: number): number;     // t + .8 sin(.31t) + .4 sin(.77t + 1.3)
  export function breath(tw: number): number;      // .55 sin(.6tw) + .3 sin(1.37tw + 2) + .15 sin(2.9tw + .5)
  export const EDGE_GLSL: string;  // hash, noise, sdBox, lstep, tw(), field(uv), edgeLight(px), edgeHit(c, dir),
                                   // rimGlint(n, rd, fd, BC): the mockup's functions; uniforms R, T, A, PAD, C0..C3 declared by the includer
  // testimonials-q.ts
  export function testimonialsQ(c0: number, c1: number, size: number): number; // the Global Constraints formula
  export type Pulse = { at: number | null; on: boolean };
  export function stepPulse(p: Pulse, q: number, now: number, reduced: boolean): Pulse; // starts once as q rises past 0.02
  export function pulsePhase(p: Pulse, now: number): number; // −1 none, else 0..1 over 2000 ms
  ```

- [ ] **Step 1: Write the failing tests.**
  - `testimonialsQ is 0 before Yoav reaches 105%, 1 between, 0 after Andrada passes −5%` (size 1000: c0 1100 → 0; c0 600, c1 800 → 1; c1 −60 → 0; c0 850 → `sineIn(0.5)`).
  - `the pulse starts once as q rises past 0.02, not on the way down, not again while on, never under reduced motion`.
  - `pulsePhase runs 0 → 1 over 2000 ms, then holds 1`.
  - `warpTime(0) === 0 + 0.4·sin(1.3)`, and `breath` stays within ±1.
  - `EDGE_GLSL declares field, edgeLight, edgeHit, rimGlint and no uniforms of its own`.
- [ ] **Step 2: Run** `npx vitest run src/three/edge-light src/app/about/testimonials-q.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Port the GLSL verbatim from the mockup (lines 238–281 and the rim block in 304–314) into `EDGE_GLSL`. `rimGlint` returns the additive rim colour, so both shaders call one function.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(about): the testimonials' edge light: one colour field shared by the light and the ball, and its scrub (Liam, 2026-10-17)`.

### Task 2: The light canvas on the desktop track

**Files:**
- Create: `src/three/edge-light/testimonials-light.ts` (+ `.test.ts` for the uniform math)
- Create: `src/app/about/about-testimonials.tsx` (+ `.test.tsx`)
- Modify: `src/app/about/about-track.tsx` (mount next to `<AboutPendant />`, plus the mood layer in `.ab-pin`), `src/app/about/about.css`
- Modify: `e2e/about-pendant.spec.ts`, or create `e2e/about-testimonials.spec.ts` (add it to the `playwright.about.config.ts` testMatch)

**Interfaces:**
- Consumes: Task 1, plus `glassOwner()` from `src/lib/about-glass.ts`.
- Produces:
  ```ts
  export class TestimonialsLight {
    static create(canvas: HTMLCanvasElement): TestimonialsLight | null; // null: no WebGL
    resize(cssW: number, cssH: number, dpr: number): void;              // dpr capped at 1.5 inside
    draw(f: { q: number; t: number; pulse: number; pulseFrom: "right" | "bottom";
              ball: { x: number; y: number; r: number } | null }): void; // CSS px; ball only when the light draws it
    dispose(): void;
  }
  ```
  - The mount measures the centres of `[data-pendant=quote1]`, `quote2` and the glass slot each frame (rects, read in the rAF).
  - It runs the loop only while q > 0 or the slot is within one slot width of the screen.
  - It exposes `window.__testimonials = { q, pulse, drawing, ownBall }` for tests.

- [ ] **Step 1: Write the failing tests.**
  - The component renders the canvas `aria-hidden` and `pointer-events: none`.
  - No canvas is left on a WebGL failure (stub `getContext` → null).
  - The loop stops when q = 0 and the slot is off screen.
  - `ownBall` is true only while `glassOwner() === "testimonials"`.
- [ ] **Step 2: Implement `TestimonialsLight`.**
  - Fragment shader = the mockup's `main()` with `EDGE_GLSL` included.
  - Output is `vec4(c, max(c.r, max(c.g, c.b)))` premultiplied, with `premultipliedAlpha: true` and no CSS blend.
  - The pulse origin is `vec2(1.001, .5)` for "right" and `vec2(.5, -.001)` for "bottom".
  - The own-ball block runs only when `ball` is passed.
  - On a context loss: remove the canvas, stop.
- [ ] **Step 3: Mount it in `about-testimonials.tsx`.**
  - Lazy, after paint, track mode first. The stack comes in Task 5.
  - Mood div `.ab-mood` with `opacity: calc(var(--q) * 0.6)`, z0 inside `.ab-pin`.
  - Light canvas `.ab-light` fixed full-screen, z4.
  - Reduced motion: t = 0, pulse never.
- [ ] **Step 4: E2e at 1440×900.**
  - q is 0 at the portrait, about 0.3 mid-arrival, and 1 with both quotes centred.
  - The pulse fires once, and a jump back and forth past 0.02 going down doesn't refire it.
  - With q = 1, edge pixels are warm and the centre text pixels are unchanged.
  - No console errors; the canvas stays idle on the closing screen.
  - With `**/pendant.glb` routed to abort, the slot holds the light's own ball (bright rim pixels at r ± 3 px) and the pendant draws none.
- [ ] **Step 5: Frames** at q 0, about 0.3 and 1 into `.superpowers/sdd/2026-10-17-about-testimonials/clip/t2/`. Look at them.
- [ ] **Step 6: Run** `npx vitest run src/three/edge-light src/app/about` and `npx playwright test -c playwright.about.config.ts`. Expected: PASS.
- [ ] **Step 7: Commit** `feat(about): warm light travels the screen's edges as the testimonials pass (Liam, 2026-10-17)`.

### Task 3: The pendant's ball catches the light

**Files:**
- Modify: `src/lib/about-glass.ts` (+ test), `src/three/pendant/glass.ts`, `src/three/pendant/scene.ts`, `src/app/about/about-pendant.tsx`, `src/app/about/about-testimonials.tsx`

**Interfaces:**
- Produces, replacing `setGlassRim`/`glassRim`. The Task 9 rim DirectionalLight is removed, since the shader now does the rim per direction:
  ```ts
  export type GlassLight = { q: number; t: number; pulse: number }; // t: the light's own clock, so both shaders agree
  export function setGlassLight(l: GlassLight | null): void;
  export function glassLight(): GlassLight | null;
  ```

- [ ] **Step 1: Write the failing tests:**
  - `glass light round-trips and clears with null`;
  - `resetGlassForTests clears the light`.
- [ ] **Step 2: Wire the shared field into the pendant's glass pass.**
  - The mount calls `setGlassLight({q, t, pulse})` every frame it draws, and `null` when q = 0.
  - The pendant's glass pass includes `EDGE_GLSL` and adds `rimGlint(...)` with `A = q` and the slot centre as `BC`.
  - The lamp's glints take a little of that colour, exactly as in the mockup's ball. No colour inside the ball.
- [ ] **Step 3: E2e.** At q = 1 the ball's rim pixels are warm and differ around the rim (arcs). At q = 0 the ball matches Task 9's look: the rim has no warm hue.
- [ ] **Step 4: Frames** of the ball at q 0, 0.3 and 1 (1440×900 and 1920×1080) into `clip/t3/`. Look at them next to `clip/t2/` with the pendant blocked: the two balls' rims should read the same.
- [ ] **Step 5: Run** `npx vitest run src/lib src/three src/app/about` and the About Playwright config. Expected: PASS.
- [ ] **Step 6: Commit** `feat(about): the pendant's glass ball glints in the colour of the screen edge it faces (Liam, 2026-10-17)`.

### Task 4: The glass edges

**Files:**
- Create: `src/app/about/edge-lens.ts` (+ `.test.ts`)
- Modify: `src/app/about/about-testimonials.tsx`, `src/app/about/about.css`

**Interfaces:**
- Produces:
  ```ts
  export function lensMap(w: number, h: number, band: number): Uint8ClampedArray; // RGBA; 128 neutral; R/G = inward normal × t²
  export function lensScale(q: number, t: number, reduced: boolean): number;     // 2·26·q·(1 + .2·breath(warpTime(t))); reduced: 26·q (0.5 of full)
  export function lensSupported(nav: Navigator): boolean;                          // Chromium (userAgentData brands) and not WebKit
  ```

- [ ] **Step 1: Write the failing tests.**
  - `the map is neutral in the middle, points inward at the rim, nothing past the band` (sample the centre, the four edge midpoints and one point just inside the band).
  - `lensScale is 0 at q 0, breathes within ±20% at q 1, holds 26·q under reduced motion`.
  - `lensSupported: Chrome yes; Safari, Firefox and iOS Chrome (no userAgentData) no`.
- [ ] **Step 2: Implement** `.ab-lens` (fixed, inset 0, z3, `pointer-events: none`, `backdrop-filter: url(#ab-edge-lens)`). Add the SVG filter from the mockup (`feImage` map plus `feDisplacementMap`, objectBoundingBox).
  - The map is built at half resolution on mount and on resize (debounced 150 ms).
  - It is shown only while q > 0.01, and only where `lensSupported`.
- [ ] **Step 3: E2e (Chromium).**
  - At q = 1, a letter at the screen's left edge has moved toward the rim compared with q = 0 (screenshot diff in the band).
  - The middle of the screen is pixel-identical.
  - After a resize mid-testimonials, the `feImage` width and height equal the new viewport.
- [ ] **Step 4: Frames** of a word passing under the left edge at q = 1 into `clip/t4/`. Look: the letters bend and stay crisp, without smearing into streaks.
- [ ] **Step 5: Run** unit and e2e. Expected: PASS.
- [ ] **Step 6: Commit** `feat(about): the screen's far edges turn to glass as the testimonials pass, Chromium only (Liam, 2026-10-17)`.

### Task 5: The testimonials on phones (stack)

**Files:**
- Modify: `src/app/about/about-testimonials.tsx`, `src/app/about/about.css`, the e2e spec

**Interfaces:**
- Consumes: Tasks 1–4, the stack's glass slot (50vw, collapsed unless the pendant draws: `data-glass="on"` from pendant Task 11). When the pendant isn't drawing, the light needs its own ball, so the slot must also open while `glassOwner() === "testimonials"`. Set `data-glass="on"` from this mount too.

- [ ] **Step 1: Implement stack mode.**
  - q from the quotes' vertical centres and the screen height.
  - The pulse comes from the bottom.
  - The light canvas is `top: 0; height: 100lvh` (the pendant's toolbar rule).
  - The lens is on where supported.
- [ ] **Step 2: E2e at 390×844 and 430×932.**
  - q rises and falls with vertical scroll.
  - The stacked quotes' text pixels are unchanged in the centre.
  - The ball is drawn (by the pendant, or by the light when the pendant is blocked).
  - No empty slot in either case.
- [ ] **Step 3: Phone stills** at q about 0.3 and 1 into `clip/t5/`. Look at them.
- [ ] **Step 4: Run** unit and e2e. Expected: PASS.
- [ ] **Step 5: Commit** `feat(about): the testimonials' light, ball and glass edges on phones (Liam, 2026-10-17)`.

### Task 6: Cost and browsers

**Files:**
- Modify: `scripts/about/pendant-perf.cjs`. Add a testimonials window and a "both" mode that reports the light's GPU ms and the rAF interval with the lens on.
- Modify: `playwright.about.config.ts`. Add a WebKit project for the testimonials spec only.

- [ ] **Step 1: Run the perf script** at 1440×900 with the pendant on, through the testimonials. Check `pgrep -fl Blender` first.
  - Expected: the light's median GPU time is ≤ 2 ms, and the rAF interval median is ≤ 17.5 ms with the lens on.
  - If over: drop the light canvas to devicePixelRatio 1, then halve the lens map resolution. Never the look.
- [ ] **Step 2: WebKit run.** No lens element is shown, the light and the ball draw, and there are no console errors.
- [ ] **Step 3: Commit** `test(about): the testimonials hold 60 fps beside the pendant; Safari gets the light without the bend (Liam, 2026-10-17)`.

## Self-review notes

**Spec coverage:**

| Spec | Task |
|---|---|
| §4 canvas, q, mood | 2 |
| §4.1 edge light, push and pull, uneven time, pulse | 1, 2 |
| §4.2 ball (light's own when unclaimed, rim from the edge) | 2, 3 |
| §4.3 glass edges, layering, gotchas, Chromium only | 4 |
| §4.4 fallbacks, reduced, cost | 2, 4, 6 |
| §6 testimonials on phones | 5 |
| §7.2 and §7.3 (Liam 10-17) | Global Constraints |
| §8 tests (q, lens map, browser frames) | 1, 2, 4, 5, 6 |

**Recorded interpretations:**
- `mix-blend-mode: screen` is replaced by premultiplied alpha `max(rgb)`, which looks nearly the same without the 14 ms compositor cost.
- The pendant's single rim colour (Task 9's `setGlassRim`) becomes the shared per-direction field, so its glints come and go in arcs as the spec says. The interface changes once, here.
- The phone pulse comes from the bottom middle: "where new content enters".
