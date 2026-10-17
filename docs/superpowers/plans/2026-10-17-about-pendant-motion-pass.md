# About: the pendant's motion pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The pendant moves calmly through About. Every change in its brightness eases. It is always clearly in front of the words or clearly behind them, never cutting through. The build shot (wire → clay → brass) becomes a big, in-front close-up that shows the layers being added.

**Architecture:** This changes four behaviours in the existing pendant: how bright it is, which layer it is on, how its shot blend follows the scroll, and the build shot's framing. There are no new systems. The readability rule is still binding: every line stays readable while you read it.

**Tech Stack:** Next.js 16.3.8, React 19.2.8, three 0.186.1, Vitest, Playwright (`playwright.about.config.ts`).

**Spec:** `docs/superpowers/specs/2026-10-16-about-pendant-design.md` (§3 shots, §4 motion, §5 readability), plus Liam's preview notes from 2026-10-17, recorded in `.superpowers/sdd/2026-10-16-about-pendant/progress.md`:
1. The opacity jumps between levels with no easing. Smooth it throughout About.
2. The build shot is "amazing": bring it to the front, bigger, maybe an extreme close-up like the hero, framed so the layers being added read clearly.
3. Some moves between sections are hectic and not smooth.
4. It sometimes goes through text layers rather than clearly in front or behind them.

## What the code does today (read at e480fb8)

- **Layer.** The layer is a CSS z-index flip (`canvas.dataset.layer`), and it is instant. Its sources are the solve's layer timeline and the live guard (`GUARD_HOLD` 0.2 s), plus `shotAt`'s `layer: pick(A, B)`, which switches at t = 0.5 of a blend.
- **Brightness.** `f.dim` is lerped by scroll position (1 → 0.4 into the tumble), so a fast scroll steps it. The forced dim eases (`FORCED_EASE`, about 0.5 s). But at a guard flip to back, the brass shows full-bright behind the words for a few frames before the dim catches up.
- **Lock.** `shotAt`'s `lock: pick(A, B)` snaps the locked face angle at the blend's halfway point. That is a visible jump wherever two shots lock differently.
- **Scroll follow.** `FOLLOW` 0.0008 leaves almost no lag, so the camera follows a flick at full speed. Adjacent shots differ a lot (glide `rz` 90 and `ax` 1.08 → whirl `rz` 0 and `ax` 0.13; worm `el` −62 → above `el` 89).
- **Build shot today.** `h` 0.28, `ay` 0.15, small at the top centre, over the desk film (`build`/`buildEnd`, `wire` 0 → 1).

## Global Constraints

- **Readability still binds** (spec §5): no bright pendant over a line while it is read. The solver, the guard and the e2e sweeps stay, and the box-vs-pixels check stays at ≤ 5 px.
- No glow, no italic. Liam's approved framings are opening, tumble, worm, above, glass, glide, whirl and hero, plus the phone set. Keep each shot's framing at its key; only the moves between keys and the build shot change.
- Reduced motion keeps its held shots and its 0.6 s crossfade.
- Phones (`SHOTS_STACK`) get the same brightness, layer and follow rules.
- Frame cost: no extra render passes beyond one cheap opacity change. The governor and its budget are unchanged.

## Review Focus

1. **A fast flick through About** (a trackpad swipe or the scrollbar): it should glide, with no snapping or visible jumps. Pinned by the Task 2 screen-velocity test.
2. **Scrolling back and forth over a layer boundary:** no flicker between in front and behind. Pinned by the Task 1 hysteresis test.
3. **A jump** (find-in-page, an anchor, a restore): there must be no visible fly-through on the way. It should fade, not fly. Pinned by the Task 1 jump test.
4. **The build shot on a 1024 px wide screen:** the close-up must still leave every line readable, or step down to a smaller framing. Pinned by the Task 3 e2e at four sizes.
5. **Reduced motion:** none of the new easing adds movement. Pinned by the existing reduced-motion e2e, re-run.

---

### Task 1: One eased brightness, and layer changes that never cut through the words

**Files:**
- Modify: `src/app/about/about-pendant.tsx`, `src/three/pendant/shots.ts`
- Create: `src/three/pendant/presence.ts` (+ test). This is the pure brightness and layer stepper.
- Modify: `e2e/about-pendant.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Presence = { layer: Layer; bright: number; fade: number }; // fade: the canvas's own 0..1, used only while it swaps layers
  export function stepPresence(p: Presence, want: { layer: Layer; dim: number; overlapping: boolean }, dt: number): Presence;
  ```

**Rules:**
- **Brightness.** `bright` eases toward the wanted dim, with a time constant of 0.35 s. It never steps, whatever the scroll speed. The wanted dim is the shot dim × the forced dim × the outro.
- **Clear swaps.** If the pendant's outline overlaps no line, a layer change is instant. Nothing is crossed, so nothing shows.
- **Overlapping swaps.** If a layer change is wanted while the outline overlaps a line, `fade` dips: out over 0.15 s, the z flip at fade 0, then back in over 0.15 s. The pendant is never seen half through the words.
- **Going behind.** The brightness has eased to the behind level before the fade-in completes. It never appears full-bright behind the words.
- **Layer source.** `shotAt` no longer picks `layer`. The layer comes only from the solve's timeline plus the guard, through `stepPresence`.
- **Hysteresis.** It is a new layer request only once it has held for 0.1 s, on top of the existing `GUARD_HOLD`.

- [ ] **Step 1: Unit tests** (`presence.test.ts`):
  - `bright never changes by more than 1 − e^(−dt/0.35) of the gap per step`;
  - `a swap while clear is instant`;
  - `a swap while overlapping fades out, flips at 0, fades in`;
  - `going behind arrives dimmed`;
  - `back-and-forth requests within 0.1 s don't swap`.
- [ ] **Step 2: Implement** `stepPresence`, and route the mount's layer, dim and opacity through it. The track keeps CSS opacity for the fade dip only; the stack's existing opacity product multiplies by `fade`.
- [ ] **Step 3: E2e at 1440×900.**
  - Sample every frame across a slow scroll through the tumble and the worm. The canvas's computed opacity and the hook's `bright` never step by more than 0.08 per frame.
  - With the pendant overlapping a line, a forced layer change shows fade < 0.05 at the moment the z changes.
- [ ] **Step 4: Run** `npx vitest run src/three/pendant src/app/about` and the About Playwright config. Expected: PASS.
- [ ] **Step 5: Commit** `fix(about): the pendant's brightness always eases, and it swaps layers only clear of the words or through a quick fade (Liam, 2026-10-17)`.

### Task 2: Calm moves between sections

**Files:**
- Modify: `src/three/pendant/shots.ts` (`shotAt`: smootherstep, lock blended on the circle, the build and glide spacing), `src/app/about/about-pendant.tsx` (`FOLLOW`)
- Create: `scripts/about/pendant-motion.cjs` (a measurement tool)
- Modify: `src/three/pendant/shots.test.ts`, `e2e/about-pendant.spec.ts`

**Rules:**
- **Blend curve.** `shotAt` uses smootherstep (6t⁵ − 15t⁴ + 10t³), which has zero acceleration at both keys.
- **Lock.** `lock` blends as an angle on the shortest arc, weighted by t, where both shots lock. Where only one locks, the lock eases in or out with t. It never snaps.
- **Follow.** `FOLLOW` softens to a time constant of about 0.25 s (FOLLOW ≈ 0.018), so a flick glides rather than whips. Jumps keep their existing reset.
- **Measure, then retune.** `pendant-motion.cjs` scrolls the track at a steady 1500 px/s at 1440×900. It logs per frame the pendant's screen centre, its height and its roll, and the peak screen velocity per transition. Any transition whose peak is more than 2× the median transition's gets its keys spread: move `fx` so the transition has more travel. If that isn't enough, add an intermediate key. Don't change the shots at their keys.
- **Test.** At 1500 px/s, the peak screen velocity of the pendant's centre is ≤ 1.2 vw per frame, and its height changes by ≤ 4% per frame. Report the before and after numbers.

- [ ] **Step 1: Unit tests:**
  - `smootherstep blend has zero slope at both keys`;
  - `lock blends on the shortest arc and never jumps between two frames`;
  - `a shot with no lock eases out of a locked one`.
- [ ] **Step 2: Implement** the blend and the follow. Write `pendant-motion.cjs`, run it, retune the spacing and report the table.
- [ ] **Step 3: E2e:** the velocity bound above, measured in the browser.
- [ ] **Step 4: A clip for Liam:** a 1440×900 recording of the whole track at a steady scroll, into `.superpowers/sdd/2026-10-17-about-pendant-motion/clip/`.
- [ ] **Step 5: Run** the unit and About Playwright suites. Expected: PASS.
- [ ] **Step 6: Commit** `fix(about): the pendant glides between sections: a gentler blend, its face turning on the arc, a softer follow, the busiest moves given more room (Liam, 2026-10-17)`.

### Task 3: The build shot, close and in front

**Files:**
- Modify: `src/three/pendant/shots.ts` (`build`, `buildEnd`, and their `SHOTS_STACK` equivalents if present), `e2e/about-pendant.spec.ts`

**Liam's checkpoint first:**
- Capture three candidate framings at 1440×900 and send them as stills before anything is committed. Each must keep the readability rule, and the solver must not dim it.
  - **(a)** An extreme close-up cut by the right edge, like the hero mirrored (h about 1.2), while the build sweep passes across its faces.
  - **(b)** A big three-quarter close-up in the free band above or beside the desk film (h about 0.8).
  - **(c)** A low close-up cut by the bottom edge (h about 1.0).
- In each, the sweep from wire to clay to brass must cross the faces and crown, where the detail is, slowly enough to read. Widen the `build` → `buildEnd` span if needed.
- **Wait for his pick.**

- [ ] **Step 1: Stills.** The three candidates go into `clip/build/`, each at the sweep's 25%, 50% and 75%. Send them to Liam.
- [ ] **Step 2: Implement his pick** in `SHOTS` and the phone equivalent. Keep `layer: "front"`, and check the solve keeps it front at 1024, 1280, 1440 and 1920. If a size can't fit it, the 70% scale step decides; don't silently push it behind.
- [ ] **Step 3: E2e:** at the build key, on all four sizes, it is in front, its box is at least 30% of the screen height, and no line is covered.
- [ ] **Step 4: Run** the suites. Expected: PASS.
- [ ] **Step 5: Commit** `feat(about): the pendant builds itself up close, in front, wire to clay to brass (Liam, 2026-10-17)`.

## Self-review notes

| Liam's note | Task |
|---|---|
| 1. Opacity without easing | 1 |
| 2. Build shot: front, big, close | 3 |
| 3. Hectic moves | 2 |
| 4. Through layers | 1 (swap rule, no `pick` of layer) and 2 (lock no longer snaps) |
