# Case studies, Part C: the boards become the pages

Date: 2026-10-11 · Branch: `phase/2-case-studies` (worktree `.claude/worktrees/case-studies`) · Status: for Liam's review

## 1. What Liam asked for

> "start the Part C plan. make sure you dont override the other chats work with this. just connect the case studies to the main site. replace the placeholders that are inside each of the case studies."

Clarified (2026-10-11):
- **Placeholders** = the pages `/eventread`, `/cyvore`, `/pulse` as deployed today: Liam's approved words in plain, unstyled sections (Part A). Each becomes the case study we built together on its board (`docs/prototypes/{eventread,cyvore,pulse}-mockups.html`).
- **Connection:** don't touch the home. The real home is the other chat's `/lab/sand`, whose project grid already links to `/eventread`, `/cyvore`, `/pulse`.
- **Shipping:** one study at a time, each reviewed in the browser by Liam and merged into `phase/2-home` only when he says so.
- **Approach (approved):** real pages built from the boards, reusing the boards' tested engines for the interactive parts; not a rewrite from scratch, not embedded boards.

Success = a visitor opening any of the three pages on the site sees the approved board, at any screen width, with the site's navigation, and every interaction behaves as it does on the board.

## 2. The boundary with the other chat

The other chat is building the home (`/lab/sand`, the sand 3D scene, the hero, `src/three/**`), the site-wide look (`src/app/globals.css`, `src/app/layout.tsx`, `src/app/fonts.ts`) and the shell (`src/components/shell/**`, `src/components/providers/**`).

**Part C writes only:**
- `src/app/(case-studies)/**`: the three routes move into a route group (URLs unchanged) with their own `layout.tsx` for the case-study fonts and styles
- `src/components/case-study/**`
- `src/content/case-studies/**`, `src/lib/case-studies/**`, `src/lib/danger-score.ts` (already Part A's)
- `public/case-studies/**`
- `e2e/case-studies*.spec.ts` and new `e2e/<study>-*.spec.ts`
- `docs/**` for this spec and its plan

**Part C does not write:** anything under `src/app/lab`, `src/three`, `src/components/shell`, `src/components/providers`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/fonts.ts`, `src/app/page.tsx`, `src/lib/projects.ts`.

Two changes would need a shared file, so they are listed here for Liam to approve:
- **`package.json`:** one dev dependency, `@axe-core/playwright`, for the accessibility check. It is additive, and the plan merges it in its own commit.
- **Lenis access:** if the Pulse story's automatic move-on can't go through the site's smooth scroller without it, the provider needs a one-line export of the Lenis instance. The plan tries the no-change route first (§5.3).

Before every merge, the plan checks that no incoming file is among the other chat's uncommitted changes in the main checkout (as for the board merges).

## 3. The page frame (shared by all three)

`CaseStudyPage` keeps its shape: Back, shared top (hero, at a glance), the project's own middle, shared ending (challenges, impact, next project). It is restyled per board:
- **Worlds:** each page sets `data-world` (already does). The world's tokens (Eventread light/navy, Cyvore violet, Pulse deep navy) come from the boards and live in `src/components/case-study/worlds.css`, scoped to `[data-world]` and imported only by the case-study layout. The site's warm black (`--color-bg`) stays the site's, and the case-study pages paint their own world over it.
- **Type:** Geist for all of Liam's words (the site's fonts, already loaded). Project fonts only inside product visuals: Michroma and Inter in the Cyvore replica; Space Grotesk and Manrope in the Pulse app. They load with `next/font` in the case-study layout, scoped to the page that uses them.
- **Units:** the boards are drawn at 1440 with a `--u` unit. The pages use real responsive layout (fluid type with `clamp`, grids that reflow) that matches the board at 1440 and the boards' phone frames at 390. Nothing is scaled down as a picture.
- **Shared blocks restyled:** hero, at a glance, challenges (with each challenge's final screen where the board shows one), impact (the quote, for Cyvore), next project (the next study "peeks in" in its own world, as on the boards: Eventread → Cyvore → Pulse → Eventread).
- **Navigation:** the site's pill nav and Back sit on top, unchanged (the shell is the other chat's). Back keeps `/#<slug>` and NextProject keeps `/<slug>`. For the other chat: the index needs `id="eventread"`, `id="cyvore"`, `id="pulse"` on its rows for Back to land, noted in §9.

## 4. Each study, board → page

Section order is the board's. The boards' reviewer annotations (frame captions, sizes, dimension marks, the "00" reference and nav-motion frames) are not page content.

### 4.1 Eventread (light world, one navy band)
1. Hero (shared).
2. At a glance.
3. Problem.
4. Solution: the Danger Score as the one navy band. The calendar capture (Berlin, Nov 2026) and the score's three weights → Safe / Threat / Critical. The score maths is `src/lib/danger-score.ts` (Part A port, 0 divergences).
5. How it works, the product walked through: 01 search + acts (videos `flow-pick-act`, `flow-save-act`), 02 followed dates, 03 tour (8-city EU route).
6. Challenges. 7. Impact (live link). 8. Next: Cyvore peeks in.
Mobile: the board's 390 frame (hero, then the Solution band, stacked).

### 4.2 Cyvore (violet world)
1. Hero (no Visit site). 2. At a glance. 3. Problem.
4. Solution: the pinned scroll story. 12 beats; scroll plays it, hover or click explores, and the bar shows progress and jumps. The model is `src/lib/case-studies/cyvore-story.ts` (already in `src`, unit-tested). The engine is `docs/prototypes/cyvore-mockups/story-board.js` → ported (§5). Look = refined version C.
5. How it works: the shipped mission motion (the main CTA), then the design system as one strip.
6. Challenges (two). 7. Impact: the quote carries it. 8. Next: Pulse peeks in.
Phone: hero and the replica, stacked.

### 4.3 Pulse (deep navy world)
1. Hero: the home screen loading in, in the slim phone (`home.mp4`). 2. At a glance.
3. Problem: the four milestones as one line (Day 7 / 30 / 60 / 90).
4. Solution: the onboarding story. Coded screens, played by a scripted user on its own clock: each screen rests untouched, the finger taps through, the story moves on by itself, and it plays only while pinned. Plus "Tap through it yourself", the coded prototype in its overlay: it starts unfilled, Back / Skip / bar stay fixed, Book now can be dragged, and choices carry through. Engines: `onboarding-app.js`, `onboarding-story.js`, `onboarding-proto.js`.
5. How it works: overview, reflect, progress (the trio of phones), then the brand strip (logo, phone, billboard, with the crops fixed 2026-10-11).
6. Challenges, each with its final screen. 7. Impact. 8. Next: Eventread peeks in, light.
Phone: hero and the onboarding story, stacked.

## 5. The interactive parts

### 5.1 Engines move into `src`, unchanged in behaviour
- `docs/prototypes/pulse-mockups/onboarding-{app,story,proto}.js` and `.css` → `src/components/case-study/pulse/` as TypeScript modules (types added; logic untouched). `docs/prototypes/cyvore-mockups/story-board.js` → `src/components/case-study/cyvore/`.
- GSAP comes from npm (the site's `gsap` 3.15), not the CDN.
- Each engine is mounted by a small client component (`"use client"`) in a `useEffect` that returns a cleanup. The cleanup kills its ScrollTriggers, tweens, observers and listeners. Going from one case study to the next by the next-project link (client-side navigation) must leave nothing running.
- The boards stay in `docs/prototypes` as the design record. After Part C, the source of truth for the engines is `src`. The board copies are frozen, and their `e2e-board` tests are retired once the page tests cover the same behaviour (§7).

### 5.2 Static and media blocks are plain React
Hero, problem, how it works, challenges, impact, next: server components, no client JS. Images via `next/image` with sizes. Videos are `<video muted playsInline loop>` with a poster and `preload="metadata"`, and they start only when on screen.

### 5.3 Smooth scrolling
The site runs Lenis, synced to ScrollTrigger in the provider. The stories use ScrollTrigger as they do on the boards. Programmatic scrolls (the Pulse story's automatic move-on and the test hook `scrollToBeat`) must not fight Lenis. The plan proves with a test that `window.scrollTo({ behavior: "instant" })` is honoured under Lenis. Only if it isn't does it ask Liam for the one-line provider change in §2.

### 5.4 Reduced motion and small screens
Reduced motion gets the boards' still versions: the Cyvore story's four still screens, the Pulse grid of the 12 finished screens, and no autoplaying video (posters instead). Below 768px, each page follows its board's phone frame.

## 6. Copy

The board copy is the final copy. Where it differs from what the pages render today, the board wins, and `src/content/case-studies/*.{ts,mdx}` are updated to match. Appendix A lists every difference, so Liam can see each change before it ships. The content validator's rules (2–3 challenges, ≥1 non-engineering, ≤ 8 screens, no percentages of small samples) still hold and still run in CI.

## 7. Testing

- **Unit (vitest):** content and validator (existing, kept green) plus the Pulse engine's pure parts (state → screen, `stateAt`, the slider maths) where they can be tested without a browser.
- **Page e2e (Playwright, `e2e/`, the case-study server on port 3101):** the board suites are ported to run against the real pages. That covers `cyvore-story.spec.ts`, `pulse-story.spec.ts` and `pulse-proto.spec.ts`: stories, prototype, auto move-on, reduced motion and phone width. Added per page: the section order matches the board; there are no console errors; client navigation between studies leaves no ScrollTrigger running (`ScrollTrigger.getAll()` only holds the current page's).
- **Accessibility:** `@axe-core/playwright` on each page at 1440 and 390, with no serious or critical violations. Focus order and visible focus get one keyboard walk per page.
- **Performance budget per page:** LCP image ≤ 200 KB, total images on first view ≤ 1 MB, videos not fetched until near the viewport, no layout shift from media (sizes reserved). Checked in the e2e suite via the network log.
- **Visual check:** each page screenshotted at 1440 and 390 next to its board and compared by eye before Liam's review.

## 8. Order of work and merges

0. **Sync:** merge `phase/2-home` into `phase/2-case-studies`, so the work starts on the site as it is today.
1. **Shared frame:** the route group layout, world tokens, case-study fonts, and the restyled shared blocks (hero, at a glance, challenges, impact, next). All three pages get their world and shared blocks; the middles are still Part A text. **Review → merge.**
2. **Eventread middle** + copy + its tests. **Review → merge.**
3. **Cyvore middle** (story engine ported) + copy + tests. **Review → merge.**
4. **Pulse middle** (story, prototype) + copy + tests. **Review → merge.**

Each merge: full unit and e2e green on the merged result, the overlap check against the other chat's uncommitted files, and Liam's go-ahead.

## 9. Out of scope (and notes for the other chat)

- The home and index (`/lab/sand` and `/`), including the device-into-hero page transition from the Part A plan. It starts on the index, so it belongs with the other chat's home work.
- The pill nav's motion (the Eventread board's "00 · Nav motion" frame) is shell work, so the other chat owns it.
- For the other chat: Back links go to `/#eventread`, `/#cyvore`, `/#pulse`, so the index rows need those ids once `/lab/sand` becomes `/`.

## Appendix A: copy differences, board vs page today

The full line-by-line comparison is in [2026-10-11-case-studies-part-c-copy-diff.md](2026-10-11-case-studies-part-c-copy-diff.md). Summary: every sentence the pages render today appears word for word on its board. The section order matches on all three, and so do the nav and Back. What changes when the boards become the pages:

**Rewordings (8):**
- **Eventread, How it works:** the three step titles become headings without the full stop. For example, "**Search, then save it as an act.**" (a bold run-in) becomes step "01" with the heading "Search, then save it as an act". The same applies to steps 02 and 03.
- **Eventread, How it works:** "Under the hood:" becomes a separate "Under the hood" label.
- **Pulse, Problem:** "**Day 7:** the first habit loop." becomes a large "Day 7" over "**The first habit loop.**", and likewise for Days 30, 60 and 90.
- **Cyvore, Impact:** the quote gets curly quotation marks. The attribution splits into "Yoav Rotem" / "CTO, Cyvore" (today it's one line, "Yoav Rotem · CTO, Cyvore").

**Same words, regrouped:** sentences move between paragraphs or into display lines. Examples are Eventread's "Size isn't danger; relevance is." as its own display line, Cyvore's "The replica below…" placed after the replica, and Pulse's brand sentence.

**New visible text from the boards:**
- **Pulse:** the 12 onboarding captions, the counter, the stage labels, "Tap through it yourself" and the prototype's dialog text.
- **Cyvore:** the whole replica, including the story captions "A link lands in the call." / "Cyvore reads it." / "Blocked.", the chapter bar and the design-system strip.
- **Eventread:** the Danger Score calculator text.
- **Stat figures:** Eventread's "150 shows every night" and Cyvore's "35s".
- **All three:** challenge numbers and the labels "What happened" / "What I did" / "What it changed", one line describing the next project, and the boards' shorter Solution intros on phones (Pulse: "Twelve screens, one goal-first flow.").

**Kept from the page, though the boards don't show them:** screen-reader-only text: " (opens in a new tab)", the "At a glance" list label, "Next project: X".

All of it was approved on the boards. This list is here so nothing changes on the live pages without Liam seeing it.
