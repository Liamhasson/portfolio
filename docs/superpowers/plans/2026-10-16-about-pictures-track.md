# About Pictures (Part 1: the desktop track) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The pictures Liam approved appear along About's sideways track: the band loops in the sentence, the studio from above, the strip of three products, the glass ball's slot between the quotes, and the desk build-up film. Each one rises out of its line as it arrives and is cut at the margin line as it leaves.

**Architecture:**
- The pictures are data in `src/content/about.ts`, rendered by `about-track.tsx` inside the existing slides, and styled in `about.css`.
- A pure module (`picture-motion.ts`) turns each picture's track position and the track's travel into clip insets and visibility. The track's existing frame loop applies them: transform-proof, `clip-path` only, never layout.
- Loops play only while on screen. This part covers the desktop track only. The testimonials' light and glass edges (part 2) and phones (part 3) follow, each after Liam decides its open point.

**Tech Stack:** Next.js 16.3.8, React 19.2.8, Vitest + Testing Library, Playwright, Blender 5.1 (the desk film's scripts).

**Spec:** `docs/superpowers/specs/2026-10-16-about-pictures-design.md` (§1, §2, §3, §5). Final mockup with every value: `/Users/liamwindhasson/Documents/My portfolio - project/.superpowers/brainstorm/47986-1792116854/content/about-pictures-v26.html` (read it, never import it).

## Global Constraints

- **Read first:** `node_modules/next/dist/docs/` before writing Next code (AGENTS.md).
- **Fonts and copy:** Geist and Geist Mono, no italic. The About text is unchanged (`docs/copy/about.md`).
- **One appearance each:** never the same picture or video twice in About.
- **Motion (spec §3):**
  - **Arrival:** hidden until the picture's left edge reaches 94% of the screen width, then uncovered upward from its bottom edge, fully shown by 70% (smoothstep).
  - **Exit:** from the moment its left edge crosses the margin (6vw), the part past the line is cut away left to right, caption included. Fully cut means `visibility: hidden`.
  - The portrait keeps its own rule (already built).
- **Sizes (spec §2):**
  - **Band loops:** 1.3em × 0.8em, inline after "two rock bands", inside the existing /playground link, titled "Marni Came" and "Sanskrit".
  - **Studio:** 12vw wide, 3:4, right of paragraph 2 with its bottom on the last line, 3.2vw from the paragraph, caption "Producing · Marni Came".
  - **Strip:** under "End to end…", three loops 9vw each, 16:10, 1.6vw apart, each captioned and linked (Cyvore → /cyvore, Eventread → /eventread, Nordic Logic → /nordic-logic).
  - **Glass slot:** 17vw between Yoav's and Andrada's quotes. Empty: the ball is drawn by WebGL (part 2 and the pendant).
  - **Desk film:** 34vw wide, 16:10, right of "Build it.", 7vw before and 5vw after, caption "This desk · wire to final".
- **Corners:** 10px radius on pictures (12px on the desk film), matching the work index's thumbnails.
- **Loops:** muted, inline, looping, poster first, playing only while on screen. Under reduced motion they show posters and never play.
- **Pendant anchors:** each picture element that the pendant uses carries `data-pendant`: the strip `data-pendant="strip"`, the glass slot `data-pendant="glass"`, the desk film `data-pendant="deskfilm"`.
- **Commits:** `type(scope): what changed, in Liam's terms (Liam, 2026-10-16)`, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Commit only this plan's files.

## Review Focus

1. **Resize mid-scroll:** pictures re-measure and keep their rise and cut. No picture is left half-cut at the wrong position.
2. **Fast jumps** (End, Home, find-in-page focus): every picture shows the correct state for the new position at once. No stale clip on a frame.
3. **A loop that fails to load:** the poster stays, with no broken frame and no console error.
4. **Background tab and off-screen:** no loop plays.
5. **Keyboard focus on a strip link** while the picture is mid-cut: the track scrolls it into view (existing `scrollForSlide`), and the link isn't hidden by `visibility`.

---

### Task 1: The desk build-up film, in the repo

**Files:**
- Create: `blender/lookdev/desk_passes.py`, `blender/lookdev/desk_passes_compose.py`
  - Moved from `/private/tmp/claude-501/-Users-liamwindhasson-Documents-My-portfolio---project/62b745e7-6473-48a0-a883-58ccca5ccd75/scratchpad/deskpasses/bake.py` and `compose.py`.
  - Adapt the paths so they run from the repo through `lookdev.py`'s `LOOKDEV_LIST` hook.
- Create: `public/about/desk-build.mp4`, `public/about/desk-build.jpg`
  - From `/Users/liamwindhasson/Documents/My portfolio - project/.superpowers/brainstorm/33881-1792099741/content/desk-build-baked.mp4` and `desk-build-baked-poster.jpg`. This is the approved bake.

- [ ] **Step 1:** Copy the two scripts into `blender/lookdev/` and fix their paths to repo-relative ones. Add a docstring with the spec §5 values: camera (0.12, −0.64, 0.60) → (0.08, 0.06, 0.00), 36mm, 9.6 s, 1440×900, CRF 20.
- [ ] **Step 2:** Copy the approved mp4 and poster to `public/about/`. Check: `ffprobe` reports 1440×900, about 9.6 s, H.264, and the file is about 1 MB.
- [ ] **Step 3:** Commit `feat(about): the desk build-up film and the scripts that bake it (…)`.

### Task 2: The pictures as data

**Files:**
- Modify: `src/content/about.ts`
- Test: `src/content/about.test.ts` (create if absent)

**Interfaces:**
- Produces:
  ```ts
  export type Picture = { id: string; src: string; poster?: string; alt: string; caption?: string; href?: string; title?: string; loop: boolean };
  ABOUT.pictures: {
    bands: [Picture, Picture];   // Marni Came, Sanskrit (word-sized, inline after "two rock bands")
    studio: Picture;             // /playground/studio-overhead.jpg, caption "Producing · Marni Came"
    strip: [Picture, Picture, Picture];   // Cyvore, Eventread, Nordic Logic loops (/work/*.mp4, posters /work/*.jpg), hrefs to their case studies
    desk: Picture;               // /about/desk-build.mp4, poster /about/desk-build.jpg, caption "This desk · wire to final"
  }
  ```
  Sources are the spec §2 table, verbatim.

- [ ] **Step 1: Write the failing tests:**
  - `every picture's source is unique`: no `src` twice, and the portrait is included.
  - `the strip links to the three case studies`: hrefs are `/cyvore`, `/eventread` and `/nordic-logic`, in that order.
  - `Pulse is not in About`: no src or caption contains "pulse".
- [ ] **Step 2:** Run `npx vitest run src/content/about.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Add the type and data.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(about): the pictures along the track, as data (…)`.

### Task 3: The pictures on the track (markup and layout)

**Files:**
- Modify: `src/app/about/about-track.tsx`, `src/app/about/about.css`
- Test: `src/app/about/about-pictures.test.tsx`

**Interfaces:**
- Consumes: `ABOUT.pictures` (Task 2).
- Produces:
  - DOM hooks for Task 4: every picture is a `.ab-pic` element (`data-pic="<id>"`) with an inner `.ab-pic-f` frame and an optional `.ab-pic-cap` caption.
  - The anchors `data-pendant="strip" | "glass" | "deskfilm"`.

- [ ] **Step 1: Write the failing tests:**
  - `the band loops sit inside the playground link, after "two rock bands"`: two `.ab-pic` with titles "Marni Came" and "Sanskrit", descendants of `a[href="/playground"]`.
  - `the studio sits in paragraph 2's slide, with its caption`.
  - `the strip sits under End to end, three linked pictures`, with `data-pendant="strip"`.
  - `the glass slot sits between the two quotes and is empty`, with `data-pendant="glass"`.
  - `the desk film follows Build it, with its caption`, with `data-pendant="deskfilm"`.
  - `nothing appears twice`: every `.ab-pic` src is unique.
- [ ] **Step 2:** Run `npx vitest run src/app/about/about-pictures.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement the markup and CSS** with the Global Constraints sizes. Copy the v26 mockup's structure and CSS values (`.chip`, `.row`/`.studio`, `.strip`, the glass `.slot`, `.verbrow`/`.deskvid`) into About's classes (`ab-` prefix).
  - Loops render as `<video muted loop playsInline preload="none" poster=…>`.
  - Stills render with `next/image`.
- [ ] **Step 4:** Run. Expected: PASS. Also run `npx vitest run src/app/about`: the existing tests still pass.
- [ ] **Step 5:** Commit `feat(about): the pictures in their places along the track (…)`.

### Task 4: Rise in, cut out

**Files:**
- Create: `src/app/about/picture-motion.ts`, `src/app/about/picture-motion.test.ts`
- Modify: `src/app/about/about-track.tsx` (measure the pictures in `layout()`; apply in `frame()`)

**Interfaces:**
- Produces:
  ```ts
  export interface PicState { top: number; left: number; hidden: boolean }   // clip insets in % (top from the bottom-up rise; left from the margin cut)
  export function pictureState(screenLeft: number, width: number, vw: number): PicState;
  ```
  - `screenLeft` = the picture's left edge on screen, in px.
  - `width` = the picture plus its caption's width.

- [ ] **Step 1: Write the failing tests:**
  - **Before 94%:** at `screenLeft = 0.95 × vw` → `top === 100` and `hidden === true`.
  - **At 70% and left of it:** at `screenLeft ≤ 0.70 × vw` → `top === 0`.
  - **Between:** at `screenLeft = 0.82 × vw` → `top` is the smoothstep of 0.5, times 100 (= 50).
  - **Margin cut:** with `screenLeft = 0.06 × vw − width / 2` → `left === 50`.
  - **Fully cut:** with `screenLeft + width ≤ 0.06 × vw` → `hidden === true`.
- [ ] **Step 2:** Run `npx vitest run src/app/about/picture-motion.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement the formula and apply it:**
  - Measure each `.ab-pic`'s left (an offset relative to the track, so it is transform-proof) and its width (including the caption) in `layout()`.
  - In `frame()`, set `clip-path: inset(top% -100vw 0 Lpx round R)` and `visibility`, as the v26 mockup's `frame()` does.
  - Keep the portrait's own rule untouched. Track mode only: stack mode clears the styles.
- [ ] **Step 4:** Run `npx vitest run src/app/about`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(about): pictures rise out of their lines and are cut at the margin (…)`.

### Task 5: Loops that play only on screen

**Files:**
- Modify: `src/app/about/about-track.tsx` (or a small `use-on-screen-loops.ts` beside it)
- Test: `src/app/about/about-pictures.test.tsx`

- [ ] **Step 1: Write the failing tests** (mock IntersectionObserver and `HTMLMediaElement.play`):
  - `a loop plays when it enters the screen and pauses when it leaves`.
  - `under reduced motion loops never play; their posters show`.
  - `a loop that fails to play keeps its poster and logs nothing`: `play()` rejects → no `console.error`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - An IntersectionObserver on the loops plays them on intersect and pauses them off screen.
  - Pause everything on `document.hidden`.
  - Under reduced motion, never call play.
  - Catch play rejections silently.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(about): the loops play only while you can see them (…)`.

### Task 6: Seen in the browser

**Files:**
- Create: `e2e/about-pictures.spec.ts`
- Modify: `playwright.about.config.ts`
  - Create it if it isn't on this branch yet: port 3102, `npx next build --webpack && npx next start -p 3102` (Turbopack's build is broken site-wide by Google Fonts' Inter; tracked separately).
  - Make testMatch include `about-pictures.spec.ts`.

- [ ] **Step 1: Write the e2e tests:**
  - `pictures rise and are cut as About scrolls, with no console errors`: at 1440×900, scroll the section in 60 steps. Assert each picture is hidden before 94% and fully shown at ≤ 70%. Assert it's hidden once fully past the margin.
  - `a jump shows the right state at once`: End, then Home, settling one frame each. Every picture's state matches `pictureState` for its live position (Review Focus 2).
  - `resize keeps the rule`: 1440×900 mid-track → 1280×800 → the same check (Review Focus 1).
  - `a focused strip link is visible`: tab to the Eventread strip link. It is not `visibility: hidden`, and its picture is uncut (Review Focus 5).
- [ ] **Step 2:** Run `npx playwright test -c playwright.about.config.ts e2e/about-pictures.spec.ts`. Expected: PASS after Tasks 1–5 (fix any real failures in the owning task's code).
- [ ] **Step 3: Frames for Liam.** On the dev server, capture the mockup's checkpoints:
  - the band loops in the sentence;
  - the studio arriving;
  - the strip mid-rise;
  - a picture mid-cut at the margin;
  - the desk film with room either side.

  Compare them with v26 and send them to Liam.
- [ ] **Step 4:** Commit `test(about): the pictures' rise and cut, jumps, resize and focus, in the browser (…)`.

## Self-review notes

**Spec coverage:**

| Spec section | Task |
|---|---|
| §1 decisions | 2 (one appearance each, no Pulse), 3, 4 |
| §2 placements and sizes | 3 |
| §3 motion | 4, 5 |
| §5 desk film | 1 |
| §4 testimonials | part 2, after Liam decides §7.2 and §7.3 |
| §6 phones | part 3, after Liam decides §7.1 |
