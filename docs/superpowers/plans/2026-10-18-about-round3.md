# About round 3: a calm, dim companion, the build in its frame, a living glass ball, a clickable laptop

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Act on Liam's notes of 2026-10-18 on preview ea7354e.

**Architecture:**
- Changes to the existing pendant on `feat/about-pendant`: its brightness rule (presence), the Find/Check shots, and a new build sequence. The build sequence is made of a dwell in the track's scroll map, a snap, an SVG construction frame, and a pendant locked to the frame.
- Cursor and tap input for the glass ball (both shaders).
- One click target on the home desk.

**Tech Stack:** Next.js 16.3.8 (read `node_modules/next/dist/docs/` first), React 19.2.8, three 0.186.1, raw WebGL, SVG, Vitest, Playwright (headless only).

**Spec:** Liam's notes and every answer are in `.superpowers/sdd/2026-10-18-about-round3/notes.md` plus the decisions below. The visual references are the stills in `.superpowers/sdd/2026-10-18-about-round3/clip/` (whatido "c" and frame "i"). The pendant spec still governs everything not changed here: `docs/superpowers/specs/2026-10-16-about-pendant-design.md`.

## Liam's decisions (2026-10-18)

1. **Brightness.** The pendant stays at the low brightness (FORCED_DIM, 0.4) all through About. The exceptions are the build shot and the pendant inside the glass ball: each comes up to full once, slowly, on the way in, and goes back down once on the way out. Nothing else ever changes brightness.
2. **Find the problem → Check I'm right.** The pendant sits at the screen's centre, dim and behind the words, spinning in place, while both sections slide past over it. It doesn't rise.
3. **Into the frame.** From the centre hold, the pendant flies to the frame's spot over clear space, never behind words.
   - It snaps into place quickly, in about 0.25 s, with a tiny overshoot that settles, like snapping to a guide.
   - The frame then grows out from the pendant: it starts tight around it and expands to full size, corner handles leading, its hairlines drawing as it grows. The frame is behind the pendant.
   - The build (wire → clay → brass) starts only once the pendant is locked at the frame's centre.
4. **During the build.** The frame and pendant hold still on screen: the track pauses while scroll drives the build.
   - The pendant stays locked at the frame's centre, still turning in place and still answering the cursor's lean and drags.
   - Size "i": the frame holds the pendant, with its crown and loop breaking slightly out of the top edge.
5. **Exit.** Once the brass is done, the frame's lines pull back into its corner handles and vanish. The page carries on, and the pendant moves on into the ending (hero).
6. **Glass ball hover.** Water rings spread from the cursor across the glass, and the pendant seen through it wobbles with them. The outline bulges very slightly toward the cursor and settles back like liquid when the cursor leaves. On phones, a tap sends one ripple. It applies to the pendant's ball and to the light's own ball.
7. **Home desk.** Clicking the laptop does what the Projects nav button does: the automatic scroll into the work. The cursor becomes a pointer over the laptop.

## Global Constraints

- **Readability is still binding.** No bright pendant over a line while it is read. The dim pendant behind the words is the readability state.
- House rules: no glow, no italic, Geist. The frame uses the loader's hairline language: the same stroke, colour and corner-handle shapes as `src/app/lab/sand/brief.tsx` / `brief-geometry.ts`.
- **Every browser run is headless** (Liam: "stop it for good"). No HEADED, no CHANNEL=chrome.
- **Phones (stack)** have no build shot and no centre hold. Their six shots are unchanged, except that the brightness rule applies there too. The frame is desktop (track) only.
- **Reduced motion:**
  - no fly-in or snap: the pendant is shown in place and crossfades as the held shots already do;
  - the frame appears fully drawn, with no grow animation;
  - the build still scrubs by scroll (scrolling isn't motion);
  - the ball ripples are off.
- Cost: no new render passes for the frame (it's SVG). The ripple is in the existing glass passes.

## Review Focus

1. **Scrolling back up through the build.** The frame must un-grow in reverse, the snap must release without a pop, and the pendant must fly back to the centre hold. Pinned in Task 3.
2. **A jump into the middle of the dwell** (reload, find-in-page): show the locked state at once, with no fly-in from somewhere else. Pinned in Task 3.
3. **A drag during the lock:** the pendant turns under the hand but stays centred in the frame, and returns to its build pose on release. Pinned in Task 3.
4. **Resizing during the dwell:** the frame and the lock follow the new size. Pinned in Task 4.
5. **A fast flick through the dwell:** the build scrubs fully, and the frame neither tears nor lags behind. Pinned in Task 3.

---

### Task 1: One dim companion

**Files:** `src/three/pendant/presence.ts` (+ test), `src/app/about/about-pendant.tsx`, `src/three/pendant/shots.ts` (a `bright` flag on the build and glass shots), e2e.

- **Wanted brightness:** FORCED_DIM everywhere, and 1.0 only where the shot asks for `bright`: build/buildEnd and the glass view. Moving in and out of a bright shot uses the existing eased brightness, with a time constant of about 0.6 s, so it reads as one slow change.
- **Lookahead:** it no longer needs to pre-dim. The pendant is always dim except in the two bright shots, so remove the lookahead or reduce it to the bright shots' edges. That removes the "changes in irregular places" cause.
- **Layer swaps:** keep the clear-swap and the fade-dip logic. A dim pendant swapping layers is barely visible, but a swap must still never cut through words.
- **Tests:**
  - outside the bright shots, brightness is constant within ±0.02 across a full slow scroll and a brisk one (e2e);
  - entering the build, brightness rises exactly once;
  - leaving it, it falls exactly once;
  - the same for the glass.

Commit: `fix(about): the pendant stays softly dimmed through About; only the build and the glass bring it up (Liam, 2026-10-18)`.

### Task 2: The centre hold through Find and Check

**Files:** `src/three/pendant/shots.ts`, plus its tests and the e2e.

- Replace `glide`, `glideEnd` and `whirl` with the centre hold: screen centre (ax 0.5, ay ≈ 0.5), layer "back", spin in place. Pick the size from stills "c": big enough to read as the companion behind the words.
- It spans from where "Find the problem" arrives to where "Check I'm right" leaves.
- The move into the hold, from the glass, must be calm under the Part B evenness rule:
  - median ≤ 1.86 vw/f at 1500 px/s;
  - max ≤ 1.6× the median;
  - height change ≤ 6%.
- Retire the extra travel Part B added around "Find the problem" if the hold no longer needs it. Re-measure with `pendant-motion.cjs`.
- **Tests:**
  - in the hold, the pendant's screen centre stays within 1% of the screen's centre, it is behind, and it is dim;
  - the even-pace e2e is updated.

Commit: `feat(about): the pendant waits at the centre, behind "Find the problem" and "Check I'm right" (Liam, 2026-10-18)`.

### Task 3: Into the frame: the flight, the snap, the dwell, the locked build

**Files:**
- `src/app/about/track.ts`: add a dwell, a scroll range where the track's x holds still.
- `src/app/about/about-track.tsx`: the section height includes the dwell.
- `src/three/pendant/shots.ts`: the build shots become "locked to the frame".
- `src/app/about/about-pendant.tsx`: the flight, the snap and the lock.
- A new `src/three/pendant/snap.ts`: a pure spring snap, with a test.
- e2e.

**Interfaces:**
```ts
// track.ts
export type Dwell = { at: number; length: number };   // track progress where it holds, and the extra scroll it takes
export function trackXWithDwell(p: number, travel: number, dwell: Dwell | null): number;
// snap.ts
export function stepSnap(s: { x: number; v: number }, target: number, dt: number): void; // ~0.25 s, overshoot ≤ 4%
```

**The sequence** (scroll-driven, reversible):
1. **Flight:** from the centre hold to the frame's spot (the build stage's centre on screen at the dwell's start), routed through clear space. Check that the path's box never covers a line. A dim pendant behind words is allowed only before the flight starts.
2. **Snap:** on arrival the pendant snaps to the exact frame centre with `stepSnap`.
3. **Lock:** the frame-grow plays (Task 4). After it, the build's wire → clay → brass scrubs with the dwell's scroll.
   - The pendant's position stays locked to the frame's centre.
   - It spins in place.
   - The cursor lean and drags turn it, but never move its centre.
   - It is bright (Task 1).
4. **Release:** the frame retracts (Task 4), the track resumes, and the pendant moves on into the hero.

**Dwell length:** enough scroll for a calm build, about 0.9 screen heights. Check it against About's total length.

**Tests:**
- the track holds still across the dwell;
- the pendant is centred in the frame within 2 px for the whole lock, including during a drag;
- scrolling back reverses each stage with no pop;
- a reload in the middle of the dwell shows the locked state at once;
- a fast flick scrubs the build fully.

Commit: `feat(about): the pendant flies to its frame, snaps in, and builds itself locked at the centre while the page holds (Liam, 2026-10-18)`.

### Task 4: The construction frame

**Files:** a new `src/app/about/build-frame.tsx` (SVG, + test), `about.css`, `about-track.tsx` (mount), e2e.

- **Look:** the loader's construction drawing:
  - a hairline bounding box;
  - eight corner ends and handle squares, drawn like `brief.tsx`;
  - small anchor points;
  - centre guides kept to the frame plus 16 px, so they never run through text.
  
  It sits behind the pendant (below the pendant's canvas in z) and is fixed on screen during the dwell.
- **Size and place:** around the locked pendant at size "i". The crown and loop break slightly out of the top edge, as in still i-2 and i-3.
- **Grow:** driven by the snap's completion (time-based, about 0.6 s, eased), not by scroll. It starts tight around the pendant and expands to full size, corner handles leading, with the hairlines drawing as they extend. Scrolling back past the snap un-grows it.
- **Retract:** at the build's end, scrubbed by scroll, the lines pull back into the corner handles, then the handles fade.
- `aria-hidden`, `pointer-events: none`, never focusable.
- **Tests:**
  - the frame stays centred on the locked pendant;
  - grow → full → retract states at the right scroll and time;
  - it is behind the pendant;
  - no text line crosses the frame during the dwell;
  - it resizes correctly.

Commit: `feat(about): a construction frame grows behind the pendant and holds it while it builds (Liam, 2026-10-18)`.

### Task 5: The glass ball comes alive under the cursor

**Files:** `src/three/edge-light/field.ts` (a shared ripple GLSL), `src/three/pendant/glass.ts`, `src/three/edge-light/testimonials-light.ts`, `src/app/about/about-pendant.tsx` and `about-testimonials.tsx` (pointer input), plus tests and e2e.

- **Pointer state:** cursor position over the slot, a hover amount (eased), and a ripple list: up to 4 rings, each with an origin and a start time. A ripple spawns on hover entry, every 0.5 s while the cursor moves over the ball, and on a tap on touch screens.
- **Shaders:**
  - each ring is a radial wave across the disc, travelling outward, damped, gone after about 1.5 s;
  - it perturbs the refraction normal, so the pendant seen through the ball wobbles, and the rim highlight;
  - the outline bulges slightly toward the cursor, at most 3% of r, easing back with liquid damping on leave.
- Both balls use the same GLSL and parameters.
- Off under reduced motion. No glow.
- **Tests:**
  - the ripple maths (unit);
  - hover at the ball's edge changes pixels inside the disc and the outline, and none outside 1.05 r (e2e);
  - a tap ripple on a touch-emulated phone.

Commit: `feat(about): the glass ball ripples and leans toward your cursor like water (Liam, 2026-10-18)`.

### Task 6: Click the laptop to go to the work

**Files:** `src/app/lab/sand/sand-lab.tsx` (pick, cursor, click), plus test and e2e.

- Clicking the laptop runs exactly what the Projects nav button runs: the same function and the same automatic scroll.
- The pointer cursor shows over the laptop while the desk is in view.
- It doesn't fire during a note story, the drive, the loader or the snap.
- It sits beside the existing desk cue (`desk-invite.ts`).
- **Test:** clicking the laptop on the desk ends at the index, the same as the nav (e2e, headless).

Commit: `feat(home): click the laptop to go to the work (Liam, 2026-10-18)`.

## Order and checkpoints

1. **Task 1:** smallest, and it fixes the "bug".
2. **Tasks 2–4**, in order. They share the shots and the mount.
3. **Task 5 and Task 6** run in parallel worktrees: different files.
4. **Liam's checkpoint:** after Task 4, stills and a frame-by-frame sheet of the build sequence (flight, snap, grow, build, retract) go to him before the final review.
5. **One combined final review**, then one push and one link.
