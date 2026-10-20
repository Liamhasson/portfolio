# Marni Came Case Study Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the fifth case study, Marni Came, at `/marni-came`. Its middle is a brand book, and it embeds a playable
release-week band site served at `/marni-came/site`.

**Architecture:**
- The study plugs into the existing frame through `CaseStudyEntry`, exactly as Nordic Logic does.
- One WebGL "moves" renderer (Slice, Burn, Doubled, Lens) and one audio controller are shared by the case study and the
  site.
- The site runs inside the study in an iframe and hands its audio to the study's shell over `postMessage`.

**Tech Stack:**
- Next.js 16.3.8 (read `node_modules/next/dist/docs/` before writing Next code), React 19.2.8, MDX, WebGL2 (no new
  dependency), Vitest + jsdom, Playwright (headless only).
- Assets: Pillow and ffmpeg scripts.

**Spec:** `docs/superpowers/specs/2026-10-20-marni-came-case-study-design.md`.
**Board:** `docs/prototypes/marni-came-mockups.html`.

## Global Constraints

- **Branch:** feat/marni-came in `.claude/worktrees/marni-came`.
- **Commits and pushes:** commit per task; push and merge only when Liam asks.
- **Browsers:** every browser run is headless, never a visible window and never `CHANNEL=chrome`.
- **Copy:** never invent copy or facts. Every word on the page comes from a board frame Liam approved (Task 1) or from the
  spec.
- **Dates:** appear only on posters and the ticket. Posters: Badehaus 09.02.2024, Lido 12.2023, Badehaus 02.2023, End of
  Term 03.2022.
- **Logo:** never red. Versions: bone on Blackout, Blackout on bone, burned. Use the distressed SVG by default and the
  clean SVG for small sizes and production.
- **Colour:** Blackout `#0A0908`, Bone `#EEEAE2`, Title red `#EC1302` (brand material only, never Liam's titles), Burn
  `#8D4802 → #B36F0B → #FFE1AA` (only as light from an edge).
- **Type:** Liam's words (section titles, opening lines, body, labels) in Geist / Geist Mono. Brand material in
  Cormorant Garamond 600 capitals and Archivo 400/500 tracked capitals. No italic.
- **Glow:** light captured in footage or photos is allowed; glow added by the design is banned. No `text-shadow`, no
  blurred `box-shadow`, no bloom.
- **Flashing:** no more than 3 flashes a second. The idea word swaps hard every 1.6 s.
- **Reduced motion:** loops become posters, the idea word stays on "Broken", moves apply instantly, nothing animates.
- **Sound:** off by default, starts only on a click, pauses when the tab is hidden, stops on leaving the page, doesn't
  persist across visits. One audio state across the study and the embedded site.
- **Doubled rule:** frames from one moment only.
- **Length:** budget 13.7 screens; `screenCap` 14.5.
- **Text floors:** ≥ 11 px computed font size (`e2e/cs-helpers` `expectTextFloors`); axe has no serious issues.
- **Phones:** no horizontal scroll at 390 px; layout verified at 1440, 768 and 390.

## Review Focus

1. **No WebGL, or the context is lost.** The moves canvas shows the plain image, and the switch still toggles and says
   which moves are on. Test in Task 3.
2. **Two audio sources at once** (the shell's toggle while the iframe's Listen is pressed, or a second track). Only one
   ever plays, and the toggle reflects it. Test in Task 4.
3. **Reduced motion across the study and the site.** No CSS animation or rAF loop runs, the word stays on "Broken", and
   loops show posters. Tests in Tasks 5 and 6.
4. **A 390 px phone.** The iframe is replaced by three stills and a link, there's no horizontal scroll, and the floors
   hold. Test in Task 7.
5. **Added glow slipping in** (a hover style, focus ring or button bloom). No element in the study or the site has a
   `text-shadow` or a blurred `box-shadow`. Tests in Tasks 5 and 7.

---

### Task 1: Case-study and site board frames, for Liam's approval

**Files:**
- Modify: `docs/prototypes/marni-came-mockups.html` (add a "Case study" part and a "Website" part after spread 14).

**Interfaces:**
- Produces: the approved copy and layout every later task builds from. Each frame keeps a comment naming its block.

- [ ] **Step 1: Draw the case-study frames at 1440, each with a 390 px phone frame**
  - Hero, At a glance, Problem, Solution (screen 1 the idea; screen 2 the effects switch), Identity, Imagery,
    Applications, Website, Challenges, Impact, Next project.
  - Draft copy only from the spec §3 and the BA (`pdftotext` of
    `~/Downloads/Liam Hasson BA final project (1).pdf`).
  - Mark every draft line "DRAFT" in a board note.
  - Liam's words go in Geist; brand material in its own fonts.
- [ ] **Step 2: Draw the site frames**
  - Music, Videos, Shows, Merch and Band at 1440 and 390, plus the phone menu.
  - Members' names and instruments come from the EPK (`pdftotext ~/Downloads/"Marni Came EPK 2024 (2).pdf"`), with one
    photo each from the same photoshoot session.
- [ ] **Step 3: Render headlessly and send to Liam**
  - Run: `node <scratchpad>/mc/board/shot.cjs "$PWD/docs/prototypes/marni-came-mockups.html" <out>.png 1536 ".f"`
  - Expected: one PNG per frame. Send them with SendUserFile.
- [ ] **Step 4: Ask Liam, line by line, what to change; apply it; repeat until he approves.** Don't start Task 5 until
  he has approved.
- [ ] **Step 5: Commit**
  ```bash
  git add docs/prototypes/marni-came-mockups.html docs/prototypes/marni-came-mockups
  git commit -m "docs(marni-came): case-study and site frames, approved by Liam"
  ```

### Task 2: Asset pipeline and the asset manifest

**Files:**
- Create: `tools/marni-came/treat.py`
  - Move it from the scratchpad (`mc/treat.py`, `mc/posters.py`).
  - Paths come from the env vars `MC_ARCHIVE` (default `~/Documents/Marni Came`) and `MC_VIDEO` (default
    `~/Downloads/Marni Came - After Heartbreaks (Official music video).mp4`).
- Create: `tools/marni-came/build-assets.sh`.
- Create: `tools/marni-came/peaks.py`.
- Create: `src/lib/marni-came/assets.ts`.
- Create: `src/lib/marni-came/assets.test.ts`.
- Create: `public/case-studies/marni-came/**`.

**Interfaces:**
- Produces: `MC_ASSETS` (a `const` object of public paths) from `src/lib/marni-came/assets.ts`, with these keys:
  - `heroLoop`, `heroPoster`, `releaseLoop`, `releasePoster`, `releaseVideo`, `dopamineVideo`;
  - `wordmark`, `wordmarkDistressed`, `wordmarkBone`, `wordmarkDistressedBone`, `logoBurned`;
  - `cover`;
  - `posters: {lido, badehaus24, badehaus23, endOfTerm}`;
  - `moves: {slice, burn, doubled, lens}`;
  - `switchPhoto`;
  - `burnLight`;
  - `doubledBoard: string[]` (the moodboard frames, in board order);
  - `fanPhoto`;
  - `glowAllowed`;
  - `tracks: {afterHeartbreaks, dopamine, youllBeYou}`, each `{src, peaks}`.

- [ ] **Step 1: Write the failing test**
  ```ts
  test("every Marni Came asset in the manifest exists in public/", () => {
    for (const p of flatten(MC_ASSETS)) expect(existsSync(path.join("public", p)), p).toBe(true);
  });
  test("peaks files match the playground's format", () => {
    for (const t of Object.values(MC_ASSETS.tracks)) {
      const d = JSON.parse(readFileSync(path.join("public", t.peaks), "utf8"));
      expect(d.peaks).toHaveLength(160);
      expect(d.duration).toBeGreaterThan(60);
    }
  });
  ```
- [ ] **Step 2: Run it; expect a FAIL** (missing module).
  - Run: `npx vitest run src/lib/marni-came/assets.test.ts`
- [ ] **Step 3: Write `build-assets.sh` and generate**
  - Images at 2× from `treat.py`.
  - Videos through `scripts/encode-video.sh` (hero 1440 wide; full videos ≤ 1080p).
  - Masters from `$MC_ARCHIVE/Masters/*.wav` → `.m4a` AAC 128 kbps.
  - `peaks.py`: 160 normalised peaks plus the duration, using the stdlib `wave` module.
  - Bone- and Blackout-filled copies of both wordmark SVGs (`fill` baked in, for `<img>` use).
  - The Doubled moodboard frames, re-pulled from the video at the board's timestamps, at 1920 wide.
- [ ] **Step 4: Run the test; expect a PASS.**
- [ ] **Step 5: Commit**
  ```bash
  git add tools/marni-came src/lib/marni-came public/case-studies/marni-came
  git commit -m "feat(marni-came): asset pipeline and manifest"
  ```

### Task 3: The moves engine (shared by the switch and the site)

**Files:**
- Create: `src/lib/marni-came/moves.ts`.
- Create: `src/lib/marni-came/moves.test.ts`.
- Create: `src/components/marni-came/moves-canvas.tsx`.
- Create: `src/components/marni-came/moves-canvas.test.tsx`.

**Interfaces:**
- Produces from `moves.ts`:
  - `type MoveName = "slice" | "burn" | "doubled" | "lens"`;
  - `MOVES: readonly MoveName[]`;
  - `type MoveState = Record<MoveName, number>` (each 0..1);
  - `const OFF: MoveState`;
  - `stepMoves(current: MoveState, target: MoveState, dtSec: number, reduced: boolean): MoveState`. Eases toward the
    target at 0.35 s per full change, or returns the target at once when `reduced`.
  - `sliceOffsets(seed: number, bands?: number): number[]`. Deterministic; 5 bands by default; each offset in
    [-0.07, 0.07] of the width.
  - `burnBreath(tSec: number): number` (0..1, period 8.6 s).
  - `MOVES_FRAG: string` (the fragment shader).
  - `interface DoubledSpec { box: [number, number, number, number]; dx: number; dy: number; scale: number }`.
- Produces from `moves-canvas.tsx`: `<MovesCanvas src alt doubled burnSrc state className? />`.
  - Props: `src: string`, `alt: string`, `doubled: DoubledSpec`, `burnSrc: string`, `state: MoveState`.
  - Renders a `<canvas role="img" aria-label={alt}>` over an `<img>` fallback.
  - With no WebGL2 or a lost context, it keeps the `<img>` and sets `data-fallback="true"`.

- [ ] **Step 1: Write the failing tests**
  ```ts
  test("reduced motion jumps straight to the target", () => {
    expect(stepMoves(OFF, { ...OFF, burn: 1 }, 0.016, true).burn).toBe(1);
  });
  test("a full change takes about 0.35 s, so it never flashes", () => {
    const s = stepMoves(OFF, { ...OFF, slice: 1 }, 0.1, false).slice;
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(0.5);
  });
  test("slice offsets are deterministic and bounded", () => {
    expect(sliceOffsets(3)).toEqual(sliceOffsets(3));
    expect(sliceOffsets(3)).toHaveLength(5);
    sliceOffsets(3).forEach((o) => expect(Math.abs(o)).toBeLessThanOrEqual(0.07));
  });
  test("the burn breathes slower than 3 flashes a second", () => {
    expect(burnBreath(0)).toBeCloseTo(burnBreath(8.6), 5);
  });
  // moves-canvas.test.tsx (jsdom has no WebGL)
  test("without WebGL the plain image stays and is labelled", () => {
    render(<MovesCanvas src="/a.jpg" alt="x" burnSrc="/b.jpg" doubled={D} state={OFF} />);
    expect(screen.getByRole("img", { name: "x" })).toBeInTheDocument();
    expect(document.querySelector("[data-fallback='true']")).not.toBeNull();
  });
  ```
- [ ] **Step 2: Run them; expect a FAIL.**
  - Run: `npx vitest run src/lib/marni-came/moves.test.ts src/components/marni-came/moves-canvas.test.tsx`
- [ ] **Step 3: Implement**
  - The shader composes, in order: **slice** (shift bands by `sliceOffsets`), **doubled**, **burn**, **lens**.
    - Doubled: sample at `(uv − c)/scale + c − (dx, dy)` inside a feathered ellipse `box`, screen-blended at the
      doubled amount.
    - Burn: the `burnSrc` texture screened in from the left edge, masked by a ramp of reach 0.34 + 0.24·`burnBreath`,
      at the burn amount.
    - Lens: a radial vignette to Blackout, inner 0.30, outer 0.72, at the lens amount.
  - A grain uniform adds static noise.
  - Render on demand: rAF only while `state` is changing or the burn is on, and never under reduced motion.
- [ ] **Step 4: Run them; expect a PASS.**
- [ ] **Step 5: Commit**
  ```bash
  git add src/lib/marni-came/moves* src/components/marni-came/moves-canvas*
  git commit -m "feat(marni-came): the four moves as one WebGL renderer"
  ```

### Task 4: Audio controller, sound toggle and the shell slot

**Files:**
- Create: `src/lib/marni-came/audio.ts`.
- Create: `src/lib/marni-came/audio.test.ts`.
- Create: `src/components/marni-came/sound-toggle.tsx`.
- Modify: `src/lib/case-studies/types.ts` (`CaseStudyEntry` gains `Shell?: ComponentType`).
- Modify: `src/components/case-study/case-study-page.tsx` (renders `<Shell />` right after `<BackButton>`).
- Test: `src/components/case-study/case-study-page.test.tsx`.

**Interfaces:**
- Produces from `audio.ts`:
  - `type TrackId = "after-heartbreaks" | "dopamine" | "youll-be-you"`;
  - `createAudioController(win: Window, make?: (src: string) => HTMLAudioElement)`. Returns
    `{ play(id: TrackId): void; pause(): void; toggle(): void; state(): { on: boolean; track: TrackId }; subscribe(fn: () => void): () => void }`.
    - It starts off, with track `"after-heartbreaks"`, and only one element ever plays.
    - It pauses on `visibilitychange` → hidden.
  - `MC_AUDIO_MESSAGE = "mc-audio"`.
  - `bridgeParent(ctrl, win): () => void`. Accepts only same-origin `{ type: "mc-audio", action: "play" | "pause", track?: TrackId }`.
  - `isEmbedded(win): boolean` (`win.parent !== win`).
  - `requestFromParent(win, action, track?)`.
- Produces from `sound-toggle.tsx`: `<SoundToggle ctrl />`, a `button` with `aria-pressed` and the visible label "Sound off" or "Sound on".

- [ ] **Step 1: Write the failing tests**
  ```ts
  test("starts off and plays only on request", () => { const c = make(); expect(c.state().on).toBe(false); });
  test("playing a second track stops the first", () => {
    const c = make();
    c.play("dopamine"); c.play("youll-be-you");
    expect(playing()).toEqual(["youll-be-you"]);
  });
  test("a hidden tab pauses", () => {
    const c = make(); c.play("after-heartbreaks");
    hide();
    expect(c.state().on).toBe(false);
  });
  test("the bridge ignores other origins", () => {
    const c = make(); bridgeParent(c, window);
    post({ type: "mc-audio", action: "play" }, "https://evil.test");
    expect(c.state().on).toBe(false);
  });
  test("the bridge plays a same-origin request", () => {
    const c = make(); bridgeParent(c, window);
    post({ type: "mc-audio", action: "play", track: "dopamine" }, location.origin);
    expect(c.state()).toEqual({ on: true, track: "dopamine" });
  });
  // case-study-page.test.tsx
  test("an entry's Shell renders after Back", () => {
    renderPage({ ...entry, Shell: () => <i data-testid="shell" /> });
    expect(screen.getByTestId("shell")).toBeInTheDocument();
  });
  ```
- [ ] **Step 2: Run them; expect a FAIL.**
  - Run: `npx vitest run src/lib/marni-came/audio.test.ts src/components/case-study/case-study-page.test.tsx`
- [ ] **Step 3: Implement `audio.ts`, `SoundToggle`, the `Shell` field and its render.**
- [ ] **Step 4: Run them, plus the full `npx vitest run`; expect a PASS.**
- [ ] **Step 5: Commit**
  ```bash
  git commit -am "feat(marni-came): one audio state, the sound toggle and a shell slot for studies"
  ```

### Task 5: The release-week site at `/marni-came/site`

**Files:**
- Create: `src/app/(case-studies)/marni-came/site/page.tsx` (metadata `robots: { index: false }`).
- Create: `src/components/marni-came/site/{site.tsx,site-nav.tsx,hero.tsx,music.tsx,videos.tsx,shows.tsx,merch.tsx,band.tsx,lightbox.tsx,site.css,fonts.ts}`.
- Modify: `src/lib/site.ts` (`isBandSite(pathname: string): boolean`, true for `/marni-came/site`).
- Modify: `src/components/shell/pill-nav.tsx` and `src/components/shell/nav-name.tsx` (return `null` when `isBandSite`).
- Test: `e2e/mc-site.spec.ts`.

**Interfaces:**
- Consumes:
  - `MC_ASSETS` (Task 2);
  - `MovesCanvas`, `OFF`, `MoveState` (Task 3);
  - `createAudioController`, `isEmbedded`, `requestFromParent`, `SoundToggle` (Task 4).
- Produces: the page `/marni-came/site`. `?embed=1` hides the site's own sound toggle.
- `fonts.ts` exports `marniFonts` (Cormorant_Garamond 600, Archivo 400/500, as `nordicFonts` does), reused by Task 6.

- [ ] **Step 1: Write the failing e2e tests**
  - The portfolio's pill nav and name are absent.
  - The page has `meta[name=robots][content*=noindex]`.
  - Sections exist: `#music`, `#videos`, `#shows`, `#merch`, `#band`.
  - The hero title reads "After Heartbreaks" on one line: the `.rel-title` box height is less than 1.3 × its line height.
  - No `audio` element is playing on load.
  - "Watch the video" opens a `dialog` containing a `video`.
  - Shows text contains no date pattern outside `.poster` (`/\b\d{2}\.\d{2}\.\d{4}\b/`).
  - Under `reducedMotion: "reduce"`, `document.getAnimations()` is empty and the hero `video` is paused on its poster.
  - At 390 px: no horizontal scroll, the menu button opens a full-screen menu, and `expectTextFloors` passes.
  - Every element's computed `text-shadow` is `none`, and no `box-shadow` has a blur > 0.
  - axe finds no serious issues.
- [ ] **Step 2: Run them; expect a FAIL.**
  - Run: `E2E_PORT=3341 npx playwright test e2e/mc-site.spec.ts`
- [ ] **Step 3: Build the site from the approved Task 1 frames**
  - **Hero:** the release loop, with a CSS burn layer (`MC_ASSETS.burnLight`, screen blend, 8.6 s breath) that stops
    under reduced motion.
  - **Section images:** `MovesCanvas`. Slice goes to 1 for 0.35 s when an image enters view, then back to 0. Doubled
    goes to 1 on hover or focus.
  - **Music:** each track plays through the controller, or through `requestFromParent` when embedded.
- [ ] **Step 4: Run them; expect a PASS.**
- [ ] **Step 5: Commit**
  ```bash
  git commit -am "feat(marni-came): the release-week band site"
  ```

### Task 6: The study: data, registration, world, hero, Problem and Solution (the switch)

**Files:**
- Modify: `src/lib/case-studies/types.ts` (`CaseSlug` gains `"marni-came"`).
- Create: `src/content/case-studies/marni-came.ts`.
  - `title: "Marni Came"`, `descriptor: "Brand identity"`; `line`, `atAGlance`, `challenges` and `outcome` from the
    approved Task 1 frames.
  - `screenCap: 14.5`.
  - `budget: { ...STANDARD_BUDGET, signature: 2, supporting: 7, challenges: 1.2, outcome: 0.5 }`.
- Create: `src/content/case-studies/marni-came.mdx`. In order:
  - `<MarniCameProblem kind="problem" title="Problem" />`;
  - `<MarniCameSolution kind="signature" title="Solution" />`;
  - `Identity`, `Imagery`, `Applications` and `Website` as `kind="supporting"`. They're added in Task 7; this task
    lands them as stubs that render their titles.
- Create: `src/content/case-studies/marni-came.entry.ts` (`Shell` = a component rendering `<SoundToggle>` on a page
  controller with `bridgeParent`).
- Create: `src/app/(case-studies)/marni-came/page.tsx`.
- Create: `src/components/case-study/marni-came/{hero-visual,problem,solution,challenge-extras,marni-came.css}.tsx|css`.
- Modify: `src/components/case-study/worlds.css` (`[data-world="marni-came"]`).
  - `--nav-ink: #eeeae2; --nav-canvas: #0a0908`.
  - The palette tokens.
  - A static grain overlay.
- Modify: `src/content/case-studies/middles.test.ts` (`"marni-came"`: problem, signature "Solution", then supporting
  "Identity", "Imagery", "Applications", "Website").
- Test: `e2e/mc-study.spec.ts`.

**Interfaces:**
- Consumes: Tasks 2–5 (`marniFonts` from `src/components/marni-came/site/fonts.ts`).
- Produces: `marniCame: CaseStudy` and `marniCameEntry: CaseStudyEntry`.

- [ ] **Step 1: Write the failing tests**
  - Unit: `validateCaseStudy(marniCame)` returns `[]`, and `middles.test.ts` passes for `marni-came`.
  - E2E, the switch: four toggles named Slice, Burn, Doubled and Lens, each `aria-pressed="false"` at load. Pressing
    Burn sets it to `"true"`, and with WebGL the canvas pixels change (read via `toDataURL` before and after).
  - E2E, the idea word: it cycles Broken → Burned → Doubled → Bent at a 1.6 s interval, and under reduced motion stays
    "Broken".
  - E2E, the sound toggle: it reads "Sound off" at load, and no audio is playing.
  - E2E, the hero video: muted.
- [ ] **Step 2: Run them; expect a FAIL.**
  - Run: `npx vitest run src/content/case-studies && E2E_PORT=3341 npx playwright test e2e/mc-study.spec.ts`
- [ ] **Step 3: Build from the approved frames**
  - Hero: the Badehaus loop full-bleed with the distressed wordmark, in the shared hero's title and line positions.
  - The switch: `MovesCanvas` on `MC_ASSETS.switchPhoto`, with each toggle's one-line rule under it.
- [ ] **Step 4: Run them; expect a PASS.**
- [ ] **Step 5: Commit**
  ```bash
  git commit -am "feat(marni-came): the study's frame, hero, problem and the live effects switch"
  ```

### Task 7: Identity, Imagery, Applications, Website, Challenges

**Files:**
- Create: `src/components/case-study/marni-came/{identity,imagery,applications,website}.tsx`.
- Modify: `marni-came.mdx`, `challenge-extras.tsx` (the Lido fan photo beside the challenges, credited
  "photo BIMM Institute Berlin"), `marni-came.css`.
- Test: extend `e2e/mc-study.spec.ts`.

**Interfaces:**
- Consumes: `MC_ASSETS`, `MovesCanvas`, `marniFonts`, and the site route (Task 5).
- Produces: the finished middle.

- [ ] **Step 1: Extend the e2e tests**
  - Identity shows three logo versions (master, burned, print) and none is red: no logo element's computed `color` or
    `fill` is `rgb(236, 19, 2)`.
  - The type specimen contains no words; its sample strings are letters, numerals and punctuation only.
  - Imagery has the four moves, the glow pair, and the Doubled moodboard (8 + 3 frames, each credited with its
    timestamp).
  - Applications has the cover and four posters, whose dates are exactly 12.2023, 09.02.2024, 02.2023 and 03.2022.
  - The Website block at 1440 has an `iframe[src="/marni-came/site?embed=1"]` plus a link to `/marni-came/site`. At 390
    it has no iframe, three images and the link.
  - Pressing Listen inside the iframe makes the shell's toggle read "Sound on", and only one `audio` is playing.
  - Glow: no `text-shadow` and no blurred `box-shadow` anywhere in `article.cs`.
  - `expectTextFloors` and axe pass at 1440 and 390.
- [ ] **Step 2: Run them; expect a FAIL.**
- [ ] **Step 3: Build the four blocks from the approved frames**
  - Applications: lay the mockups as a collage (tape, overlaps that never cover a face or a title).
  - Missing shots show their flat artwork, labelled "Artwork".
- [ ] **Step 4: Run them; expect a PASS.**
- [ ] **Step 5: Measure the length**
  - The built page at 1440×900 must be ≤ 14.5 screens (`document.documentElement.scrollHeight / 900`).
  - If it's longer, compress the largest block, never append.
- [ ] **Step 6: Commit**
  ```bash
  git commit -am "feat(marni-came): identity, imagery, applications, the embedded site and the challenges"
  ```

### Task 8: Order, next-project loop, sitemap

**Files:**
- Modify: `src/lib/projects.ts` (insert `{ slug: "marni-came", name: "Marni Came", status: "live", tags: [from the Task 1 frames] }`
  between cyvore and pulse; update the order comment).
- Modify: `src/lib/projects.test.ts`.
- Modify: `src/components/case-study/next-project.tsx`:
  - `STUDIES` gains `"marni-came": marniCame`;
  - `PEEK` gains `"marni-came": { p: "mc", frame: "mc-frame" }`.
- Modify: `marni-came.css` (the `mc-` peek styles, as on the board's next-project frame).
- Modify: `src/lib/site.ts` (`PAGES` gains `"/marni-came"`; the site route stays out of `PAGES` and the sitemap).
- Modify: `e2e/cs-helpers.ts` (`STUDIES` gains `"marni-came"`), `e2e/case-studies.spec.ts` (Cyvore → Marni Came,
  Marni Came → Pulse), `e2e/smoke.spec.ts`, and `src/content/case-studies/content.test.ts` if it lists slugs.

- [ ] **Step 1: Update the tests**
  - `nextProject("cyvore").slug === "marni-came"` and `nextProject("marni-came").slug === "pulse"`.
  - The sitemap contains `/marni-came` and not `/marni-came/site`.
- [ ] **Step 2: Run them; expect a FAIL.**
  - Run: `npx vitest run src/lib && E2E_PORT=3341 npx playwright test e2e/case-studies.spec.ts e2e/cs-navigation.spec.ts e2e/smoke.spec.ts`
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them; expect a PASS.** The four "sits in its world" failures already exist and are out of scope.
- [ ] **Step 5: Commit**
  ```bash
  git commit -am "feat(work): Marni Came joins the loop between Cyvore and Pulse"
  ```

### Task 9: Home index card (its own approval)

**Files:**
- Modify: `docs/prototypes/work-index.html`, `src/app/lab/sand/work-index.tsx`, `public/lab/desk3d/screen{,.half}.jpg`,
  `src/three/sand/screen-reveal.json`, `src/content/case-studies/content.test.ts`, `src/lib/projects.test.ts`.
- Follow commit 0665266 (the last reorder), which changed exactly these files.

- [ ] **Step 1: Draw the five-card index on `work-index.html`**
  - The current grid holds four. Draw a 1440 frame and a 390 frame.
  - Ask Liam to approve the layout before touching code.
- [ ] **Step 2: Implement the approved index**
  - The card's loop is `/work/marni-came.mp4` + `.jpg`, a 6 s cut of the hero loop, named fresh to beat the one-day
    `/work/` cache.
- [ ] **Step 3: Re-capture the laptop screen and regenerate `screen-reveal.json`**, as in 0665266.
  - Run: `npx vitest run src/three/sand src/content src/lib`
  - Expected: PASS.
- [ ] **Step 4: Verify the home page headlessly at 1440 and 390**, with a screenshot of the laptop screen and the index.
- [ ] **Step 5: Commit**
  ```bash
  git commit -am "feat(work): Marni Came on the index and the laptop's screen"
  ```

### Task 10: Print-ready files for Liam's mockup shoot (doesn't block the build)

**Files:**
- Create: `docs/marni-came/print/{sleeve-12in.png, poster-<show>-{A3,A2}.png, stage-flag.png, shirt-front.png, shirt-back.png, ticket.png, epk-spread.png}`.
- Create: `docs/marni-came/print/README.md` (one line per file: size, bleed, dpi).

- [ ] **Step 1: Ask Liam which chorus line goes on the shirt's back.** Don't guess.
- [ ] **Step 2: Generate the files with `tools/marni-came/treat.py`**
  - 300 dpi with 3 mm bleed.
  - Where a source photo can't reach 150 dpi at A2 (the Lido images are 2048 px wide), say so in the README and size
    that poster to A3 only.
- [ ] **Step 3: Send the files to Liam with the shot list from board spread 13.**
- [ ] **Step 4: Commit**
  ```bash
  git add docs/marni-came/print
  git commit -m "docs(marni-came): print-ready files for the mockup shoot"
  ```

### Task 11: Final verification and one review

- [ ] **Step 1: Run the full suite**
  - Run: `npx vitest run && E2E_PORT=3341 npx playwright test e2e/mc-site.spec.ts e2e/mc-study.spec.ts e2e/case-studies.spec.ts e2e/cs-frame.spec.ts e2e/cs-navigation.spec.ts e2e/smoke.spec.ts`
  - Expected: all pass except the four pre-existing "sits in its world" failures.
- [ ] **Step 2: Capture headless screenshots** of `/marni-came` and `/marni-came/site` at 1440, 768 and 390, and at
  1440 with reduced motion. Look at every one.
- [ ] **Step 3: Dispatch one whole-branch review on the most capable model.** Fix what it finds and re-run Step 1.
- [ ] **Step 4: Push a preview branch and verify the deployed preview** through the GitHub deployments API.
- [ ] **Step 5: Send Liam the screenshots and the preview link, and ask before merging to main.**
