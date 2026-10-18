# About: the hand-placed pendant

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the pendant's automatic placement with a hand-written script: where it is, how big, and in front or behind, for each part of About. Then changes become quick, the behaviour is predictable, and nothing moves or dims on its own.

**Why (Liam, 2026-10-18):** since the pendant arrived, every visual change has taken hours. The main cause is the automatic system:
- a per-screen solver that nudges, shrinks or sends the pendant behind;
- a live guard that flips its layer at runtime;
- a lookahead that dims it ahead of time.

Each tweak has to get past all three, and their runtime decisions read as irregular, bug-like behaviour.

**Architecture:** One data file, the placement script, says for each beat where the pendant sits relative to a text element on screen. A small pure resolver turns scroll into a pose by blending between beats. The mount draws that pose. There is no solving at runtime. Readability is guaranteed by authoring, and checked by a test sweep across screen sizes. A failing size is fixed by editing the script, not by code.

**Tech Stack:** Next.js 16.3.8 (read `node_modules/next/dist/docs/` first), React 19.2.8, three 0.186.1, Vitest, Playwright (headless only).

**Replaces round 3 Tasks 1–3 (Liam, 2026-10-18: the automatic system "isn't approved to be used any more").** The script is written WITH round 3's behaviours instead of the solver; see `docs/superpowers/plans/2026-10-18-about-round3.md`, Liam's decisions 1–5:
- dim (0.4) everywhere except `bright` beats (the build, the glass view), changing once, slowly (τ ≈ 0.6 s);
- the centre hold through Find and Check (screen centre, behind, dim, spinning in place);
- the flight over clear space to the frame;
- the snap (≈0.25 s, ≤4% overshoot);
- the dwell (the track holds still while scroll drives the build);
- the lock (the pendant's pivot locked to the frame's centre, still turning and answering the cursor and drags);
- the retract, then on to the hero.

Round 3 Task 4 (the frame, branch feat/about-build-frame, store `src/app/about/build-frame-state.ts`) and Task 5 (the glass ripple) are built separately and merged in. Task 6 (the laptop) is home-only.

**Spec:** this plan, plus `docs/superpowers/specs/2026-10-16-about-pendant-design.md` for everything not changed here: the look, the shots' camera language, the glass, the motion feel.

## What stays and what goes

**Stays:**
- the scene, camera and render passes;
- the motion (spin, tumble, lock, drag, cursor lean);
- the blend (smootherstep, log size);
- the presence ease (brightness and the fade dip for authored layer switches);
- glass ownership;
- round 3's dwell, snap and frame;
- the stacked/phone path;
- reduced motion.

**Goes:**
- `solve.ts`: the per-screen solve, spots, alternates, the layer timeline, `over(s)`, `overLagging`, rest windows;
- `layout.ts`: `findSpot`, `freeSpot`, the motion margins;
- the live guard;
- the brightness lookahead;
- `Shot.alt`;
- the "nudged / scaled / behind" bookkeeping in the debug hook.

**Kept, as a test and a quiet fail-safe (Liam, 2026-10-18):** `hits()`, the overlap of a box and the text lines. The sweep (Task 4) uses it to fail a size where an authored in-front pendant covers a line. At runtime it's used for one thing only: on an untested screen size, if an in-front pendant would cover a line, it slips behind with the quick fade. It never moves, shrinks or pre-dims the pendant, and it never fires on the tested sizes (the sweep proves that).

## Global Constraints

- Readability is binding, now by authoring: an in-front pendant never covers a line at any tested size, and a pendant behind the words is always dim.
- Liam's look decisions from rounds 1–3 stay. This plan changes HOW placement is decided, not what he approved.
- Every browser run is headless (Liam).
- House rules: no glow, no italic.

## Review Focus

1. **Screen sizes between the tested ones** (1366×768, 1536×864, ultrawide): the anchors keep it sensible, and the sweep covers them.
2. **A resize mid-scroll:** the pose re-resolves from the new rects with no jump bigger than the resize itself.
3. **A jump into the middle** of any beat shows the right pose at once.
4. **Copy edits** that change text widths: anchors follow the text, and the sweep catches any overlap.
5. **Reduced motion:** held beats only, the same crossfade as today.

---

### Task 1: The placement script and its resolver (pure)

**Files:** a new `src/three/pendant/placement.ts`, `src/three/pendant/snap.ts`, and the dwell maths in `src/app/about/track.ts` (+ tests).

**Interfaces:**
```ts
/** Where the pendant is, on screen, at one beat: relative to a text element, so it follows the layout at every size. */
export type Place = {
  /** the element it's placed by (`data-pendant` name) and when the beat lands: that element's centre at this share of the screen width (track) or height (stack) */
  by: string; when: number;
  /** screen position of the pendant's centre: a screen share, or relative to the element's box ("el.right + 0.04", "el.top - 0.1") */
  x: number | { el: "left" | "right" | "centre"; d: number };
  y: number | { el: "top" | "bottom" | "centre"; d: number };
  h: number;                  // the pendant's height, share of the screen height
  layer: "front" | "back";
  bright?: boolean;           // only the build and the glass (Liam)
  view: View;                 // az, el, roll, fov, spin, tumble, lock, rz, aim, aperture, wire, glass: today's Shot camera fields
  hold?: number;              // optional: stays at this beat for this much extra scroll (the centre hold)
  /** the build dwell: the track's x holds still for `dwell` screens of scroll while this beat plays; `lock` pins the
   *  pendant's pivot to the frame's centre (build-frame-state cx, cy), `snap` springs it there on arrival */
  dwell?: number; lock?: "frame"; snap?: boolean;
};
export type Script = { track: Place[]; stack: Place[] };
export function resolveKeys(script: Place[], centreOf: (by: string) => number | null, size: number, travel: number): number[];
export function poseAt(s: number, keys: number[], script: Place[], rects: (by: string) => DOMRectLike | null, vw: number, vh: number): Pose;
// track.ts
export type Dwell = { at: number; length: number };
export function trackXWithDwell(p: number, travel: number, dwell: Dwell | null): number;
// snap.ts
export function stepSnap(s: { x: number; v: number }, target: number, dt: number): void; // ~0.25 s, overshoot ≤ 4%
```
`poseAt` blends between the two beats around `s` with smootherstep (log for `h`, shortest arc for `lock`). A layer switch happens exactly at a beat, by authoring.

- [ ] **Step 1:** Write unit tests for:
  - keys from anchors, monotonic;
  - holds add scroll;
  - element-relative x and y resolve from rects;
  - the blend at 0, 0.5 and 1;
  - a layer that is the beat's own, never inferred;
  - a jump returns the beat's pose.
- [ ] **Step 2:** Implement.
- [ ] **Step 3:** Commit `feat(about): the pendant's placement script and resolver (Liam, 2026-10-18)`.

### Task 2: Write the script from today's look

**Files:** a new `src/content/pendant-script.ts`, with the track and stack beats.

- Turn every current shot into beats, with round 3's changes written in: opening, let-go, tumble, worm, above, glass, the centre hold through Find and Check, the flight into the frame, the build dwell, and the hero.
- Use element-relative x and y wherever the beat sits beside text, so it follows the layout.
- Each beat gets the layer and size Liam approved. `bright` goes only on the build and the glass.
- Capture stills at 1440×900 of every beat and compare them with the round-3 stills. The poses must match within a few px.

Commit: `feat(about): the pendant's script, written from the approved shots (Liam, 2026-10-18)`.

### Task 3: The mount draws the script, and the solver goes

**Files:**
- `src/app/about/about-pendant.tsx`: use `resolveKeys` and `poseAt`, and remove the solve, the guard, the lookahead, the `alt` handling and `findSpot`.
- Delete `src/three/pendant/solve.ts` and the dead parts of `layout.ts` (keep `hits`, `padBox`, `clipBox`).
- `src/three/pendant/shots.ts` keeps only the camera blend and motion helpers, or merges into `placement.ts`.
- **Wire round 3:**
  - the dwell (the section height includes it);
  - the snap;
  - the lock: the pendant's pivot is locked to the frame's centre, and turns and drags never move it;
  - the frame store writes: the phase, cx/cy as the frame's centre (the locked pivot), w/h, linear grow over 0.6 s after the snap, scroll-scrubbed retract; `phase: null` on unmount and outside the sequence;
  - the pendant forced to the front layer for grow, build and retract;
  - reverse scrolling runs build → grow (descending) → snap;
  - a reload mid-dwell writes `build` directly.
- `presence.ts` is reduced to the brightness ease, the authored layer switch with its fade dip, and the quiet fail-safe (a front pendant over a line on an untested size goes behind through the dip). Test: the fail-safe never fires during the sweep's sizes.
- Update the tests.

Commit: `refactor(about): the pendant follows its script: no solver, no runtime guard, no lookahead (Liam, 2026-10-18)`.

### Task 4: The readability sweep

**Files:** a new `e2e/about-pendant-sweep.spec.ts`, plus a script `scripts/about/pendant-sweep.cjs` (headless) that prints a table.

- **Desktop sizes:** 1024×768, 1280×800, 1366×768, 1440×900, 1536×864, 1920×1080, 2560×1440.
- **Phones:** 375×667, 390×844, 430×932.
- For every 8 px of scroll, fail if an in-front pendant's drawn box covers a text line or the chrome. Also fail if a behind pendant isn't dim, or a `bright` beat is behind.
- The table lists each failing beat and size with the overlap in px, so it can be fixed in the script by hand.
- Fix the script until the sweep is clean, by editing the data only.

Commit: `test(about): every screen size swept for an in-front pendant over the words (Liam, 2026-10-18)`.

### Task 5: Check with Liam

Send a sheet of every beat at 1440×900 and 390×844 (the same as round 3), plus the sweep table, before the final review. Then one combined final review, one push and one link.

## What this changes for future work

- **Moving, resizing or relayering a beat** (Liam sends notes; no editor, his call 2026-10-18) is a data edit plus a sweep run: minutes, not hours, with no reviewer cycle needed (Liam's taste call, checked by the sweep).
- **Adding a new beat** is a data edit, plus a review only if it needs new behaviour.
- **Nothing decides on its own at runtime,** so what Liam sees in a still is what visitors get.
