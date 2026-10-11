# Case Studies Part C Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/eventread`, `/cyvore` and `/pulse` become the case studies built on the approved boards (`docs/prototypes/{eventread,cyvore,pulse}-mockups.html`): each in its world, at any width, under the site's navigation, with every board interaction working.

**Architecture:** The three routes move into a route group with a case-study layout. `CaseStudyPage` keeps its frame (shared top, the study's middle, shared ending), and each study's board CSS is ported, scoped under `[data-world="<slug>"]`, in the boards' own `--u` unit system. Static sections are server components. The interactive parts (the Cyvore story, the Pulse story and prototype) are the boards' tested engines moved into `src` as TypeScript, mounted from client components with full cleanup.

**Tech Stack:** Next.js 16.3.8 (App Router, `@next/mdx`), React 19.2, TypeScript, Tailwind v4 (site tokens), GSAP 3.15 + ScrollTrigger (npm), Lenis 1.3 (the site's provider), `next/font/google`, `next/image`, Vitest (jsdom), Playwright, `@axe-core/playwright` (new dev dependency, approved in the spec §2).

**Spec:** `docs/superpowers/specs/2026-10-11-case-studies-part-c-design.md` (copy appendix: `docs/superpowers/specs/2026-10-11-case-studies-part-c-copy-diff.md`)

## Global Constraints

- Work only in the worktree `.claude/worktrees/case-studies`, branch `phase/2-case-studies`. Never `cd` to the main checkout except in the merge-gate tasks, and there only to run the listed git commands.
- **Write only** (spec §2): `src/app/(case-studies)/**`, `src/components/case-study/**`, `src/content/case-studies/**`, `src/lib/case-studies/**`, `src/lib/danger-score.ts`, `public/case-studies/**`, `e2e/case-studies*.spec.ts`, `e2e/cs-*.ts`, `playwright.case-studies.config.ts`, `docs/**`. Plus `package.json`/`package-lock.json` for `@axe-core/playwright` only (Task 0, its own commit).
- **Never write:** `src/app/lab/**`, `src/three/**`, `src/components/shell/**`, `src/components/providers/**`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/fonts.ts`, `src/app/page.tsx`, `src/lib/projects.ts`, `playwright.config.ts`. The one exception is spec §5.3's one-line Lenis export in `src/components/providers/smooth-scroll.tsx`, and only if Task 9's Lenis test fails. Liam approved that conditionally; record it as a ruling.
- Liam's words in Geist (site fonts already loaded). Project fonts only inside product visuals: Cyvore replica = Michroma, Iceland, Inter; Pulse app = Space Grotesk 400/700, Manrope 400/600/700. Load them with `next/font/google` in the study's own component file, never in a layout shared by all three.
- Board copy is the final copy (spec §6). Every change against today's pages is in the copy appendix; nothing else changes.
- All CSS for a study is scoped under `[data-world="<slug>"]`. No selector may match outside a case-study article.
- Port the boards' CSS in their units: `calc(var(--u) * N)`. `--u` is 1/1440 of the article width at ≥ 1100px and the board's phone unit below (Task 1). Text floors: labels and mono ≥ 11px, body ≥ 15px, everything else ≥ 13px, except inside product visuals marked `data-product` (the Cyvore replica, the Pulse app screens, the Eventread calculator UI), which scale as one object.
- Motion: only transform and opacity animate. Every engine honours `prefers-reduced-motion` with the board's still version.
- Nothing from the boards' reviewer chrome ships: `.board`, `.board-head`, `.legend`, `.cap`, `.fold`, `.phone-row`, `.phone-notes`, `.m-gap`, the boards' mock shell (`.sh-back`, `.sh-nav`, `.pill`, `.hl`, nav-motion demo and its script), the Cyvore "00 · References" frame.
- Commits end with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Merges into `phase/2-home` happen only in the merge-gate tasks, only after Liam says so in chat.
- Case-study e2e runs on **port 3101** with `playwright.case-studies.config.ts` (3100 is the other chat's). Command: `npx playwright test -c playwright.case-studies.config.ts`.

## Review Focus

1. **Client-side navigation between studies** (next-project link Cyvore → Pulse, then the browser's Back): nothing from the page left behind stays running or pinned, and the page returned to works again. Pinned in Tasks 6 and 9 (`cs-navigation.spec.ts`).
2. **Resizing across the 1100px breakpoint while a story is pinned** (window drag, tablet rotation): the story re-lays out and still shows exactly one screen, with no console errors. Pinned in Tasks 6 and 9.
3. **Mid widths 1100–1280px** (small laptops): no horizontal scroll, and no visible text under its floor outside product visuals. Pinned in Task 2 (`cs-frame.spec.ts`) for all three pages.
4. **No JavaScript, or JS still loading:** the first view of every section is readable from the server HTML. Story screens show their first screen and captions, not an empty phone. Pinned in Tasks 6 and 9.
5. **A late font load** (fonts arrive after the engine measured): the Pulse tap mark still lands on its control. Pinned in Task 9 (measure after `document.fonts.ready` and on `loadingdone`, test with throttled fonts).

---

## File structure

```
src/app/(case-studies)/
  layout.tsx                      # imports frame.css + worlds.css, mounts <CaseStudyTestHooks/>
  eventread/page.tsx  cyvore/page.tsx  pulse/page.tsx   # moved (URLs unchanged)
src/components/case-study/
  frame.css                       # --u units, text floors, shared .f section rules
  worlds.css                      # world tokens per [data-world]
  case-study-page.tsx             # frame (existing, restyled through class names)
  case-hero.tsx  at-a-glance.tsx  challenge-list.tsx  outcome.tsx  next-project.tsx   # existing, board markup
  lazy-video.tsx                  # client: play only on screen, poster, reduced-motion
  test-hooks.tsx                  # client: window.__csScrollTriggers()
  use-engine.ts                   # client hook: mount(root) → cleanup, once per mount
  eventread/eventread.css  eventread/problem.tsx  eventread/solution.tsx  eventread/how-it-works.tsx  eventread/hero-visual.tsx
  cyvore/cyvore.css  cyvore/fonts.ts  cyvore/story-engine.ts  cyvore/story.tsx  cyvore/problem.tsx  cyvore/how-it-works.tsx  cyvore/hero-visual.tsx
  pulse/pulse.css  pulse/app.css  pulse/fonts.ts  pulse/onboarding-app.ts  pulse/onboarding-story.ts  pulse/onboarding-proto.ts
  pulse/onboarding.tsx  pulse/problem.tsx  pulse/how-it-works.tsx  pulse/hero-visual.tsx
src/content/case-studies/{eventread,cyvore,pulse}.ts   # + board-only data (hero, stats, shots, peek)
src/content/case-studies/{eventread,cyvore,pulse}.mdx  # middles compose the study's section components
public/case-studies/{eventread,cyvore,pulse}/**        # board media (copied, compressed)
playwright.case-studies.config.ts
e2e/cs-helpers.ts  e2e/cs-frame.spec.ts  e2e/cs-eventread.spec.ts  e2e/cs-cyvore-story.spec.ts
e2e/cs-pulse-story.spec.ts  e2e/cs-pulse-proto.spec.ts  e2e/cs-navigation.spec.ts  e2e/case-studies.spec.ts (existing)
```

---

### Task 0: Sync with the site, the e2e harness, axe

**Files:**
- Create: `playwright.case-studies.config.ts`, `e2e/cs-helpers.ts`
- Modify: `package.json`, `package-lock.json` (one dev dependency)

**Interfaces:**
- Produces: `e2e/cs-helpers.ts` exports `STUDIES`, `expectNoSeriousA11y(page: Page): Promise<void>`, `expectNoHorizontalScroll(page: Page): Promise<void>`, `expectTextFloors(page: Page): Promise<void>`, `unitPx(section: Locator): Promise<number>`, `collectConsoleErrors(page: Page): string[]` (call before `goto`), `firstViewBudget(page: Page): Promise<{ lcpBytes: number; imageBytes: number; earlyVideos: string[] }>`.

- [ ] **Step 1: Bring in the site as it is today**

```bash
git -C "/Users/liamwindhasson/Documents/My portfolio - project/.claude/worktrees/case-studies" merge --no-edit phase/2-home
```
Expected: fast-forward or a clean merge. If it conflicts, stop and report the files; never resolve against the other chat's side.

- [ ] **Step 2: Install, add axe in its own commit**

```bash
npm install && npm install -D @axe-core/playwright@4
git add package.json package-lock.json && git commit -m "chore: @axe-core/playwright for the case-study accessibility checks (Part C spec §2)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: The case-study e2e config (port 3101)**

```ts
// playwright.case-studies.config.ts
import { defineConfig, devices } from "@playwright/test";

// Case-study pages on their own port: 3100 is the other chat's server.
export default defineConfig({
  testDir: "./e2e",
  testMatch: ["case-studies.spec.ts", "cs-*.spec.ts"],
  use: { baseURL: "http://localhost:3101" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: "npm run build && npx next start -p 3101",
    url: "http://localhost:3101/eventread",
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
```

- [ ] **Step 4: Shared test helpers**

```ts
// e2e/cs-helpers.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page } from "@playwright/test";

export const STUDIES = ["eventread", "cyvore", "pulse"] as const;

export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  return errors;
}

export async function expectNoSeriousA11y(page: Page) {
  const { violations } = await new AxeBuilder({ page }).include("article[data-world]").analyze();
  const bad = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

/** One board unit in px inside a section: a probe 100 units wide, measured. */
export async function unitPx(section: Locator) {
  return section.evaluate((el) => {
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;visibility:hidden;width:calc(var(--u) * 100);height:1px";
    el.append(probe);
    const w = probe.getBoundingClientRect().width;
    probe.remove();
    return w / 100;
  });
}

export async function expectNoHorizontalScroll(page: Page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(0);
}

/** Spec §7 budget, first view without scrolling: the LCP image's bytes, all image bytes, and any video fetched
    whose element starts more than 1.5 viewports down. */
export async function firstViewBudget(page: Page) {
  await page.waitForLoadState("networkidle");
  return page.evaluate(async () => {
    const lcpUrl = await new Promise<string>((resolve) => {
      new PerformanceObserver((list) => {
        const e = list.getEntries().at(-1) as PerformanceEntry & { url?: string };
        resolve(e?.url ?? "");
      }).observe({ type: "largest-contentful-paint", buffered: true });
      setTimeout(() => resolve(""), 1500);
    });
    const res = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const isImage = (r: PerformanceResourceTiming) => r.initiatorType === "img" || /\/_next\/image|\.(png|jpe?g|webp|avif)(\?|$)/.test(r.name);
    const lcp = res.find((r) => lcpUrl && r.name === new URL(lcpUrl, location.href).href);
    const videos = [...document.querySelectorAll("video")];
    const earlyVideos = res.filter((r) => /\.mp4(\?|$)/.test(r.name)).map((r) => r.name).filter((name) => {
      const v = videos.find((el) => el.currentSrc === name || el.src === name);
      return !v || v.getBoundingClientRect().top > innerHeight * 1.5;
    });
    return { lcpBytes: lcp?.encodedBodySize ?? 0, imageBytes: res.filter(isImage).reduce((a, r) => a + r.encodedBodySize, 0), earlyVideos };
  });
}

/** Spec text floors: mono/labels ≥ 11px, body ≥ 15px is enforced by CSS; here: nothing visible under 11px outside product visuals. */
export async function expectTextFloors(page: Page) {
  const small = await page.evaluate(() => {
    const out: string[] = [];
    const walker = document.createTreeWalker(document.querySelector("article[data-world]")!, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement!;
      if (!n.textContent!.trim() || el.closest("[data-product],[aria-hidden='true'],.sr-only")) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < 11) out.push(`${size.toFixed(1)}px: ${n.textContent!.trim().slice(0, 40)}`);
    }
    return out;
  });
  expect(small).toEqual([]);
}
```

- [ ] **Step 5: Prove the harness runs the existing page test**

Run: `npx playwright test -c playwright.case-studies.config.ts e2e/case-studies.spec.ts --reporter=line`
Expected: 3 passed (the Part A frame test, unchanged).

- [ ] **Step 6: Commit**

```bash
git add playwright.case-studies.config.ts e2e/cs-helpers.ts
git commit -m "test: case-study e2e on port 3101 with axe, overflow and text-floor helpers (Part C Task 0)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1: Route group, worlds, the unit system, scoped fonts

**Files:**
- Move: `src/app/{eventread,cyvore,pulse}/page.tsx` → `src/app/(case-studies)/{eventread,cyvore,pulse}/page.tsx` (`git mv`)
- Create: `src/app/(case-studies)/layout.tsx`, `src/components/case-study/frame.css`, `src/components/case-study/worlds.css`, `src/components/case-study/test-hooks.tsx`, `e2e/cs-frame.spec.ts`
- Modify: `src/components/case-study/case-study-page.tsx`

**Interfaces:**
- Produces: the article `<article data-world={slug} className="cs">`; every section root uses class `f` (gets `--u`); `window.__csScrollTriggers(): (string | null)[]` (the `data-world` of each live ScrollTrigger's trigger).

- [ ] **Step 1: Write the failing frame test**

```ts
// e2e/cs-frame.spec.ts
import { expect, test } from "@playwright/test";
import { STUDIES, expectNoHorizontalScroll, unitPx } from "./cs-helpers";

const WORLD_BG: Record<(typeof STUDIES)[number], string> = {
  eventread: "rgb(248, 248, 246)", // --canvas #f8f8f6
  cyvore: "rgb(11, 8, 20)",        // --void #0b0814
  pulse: "rgb(6, 11, 20)",         // --void #060b14
};

for (const slug of STUDIES) {
  test(`/${slug} sits in its world, in the board's units`, async ({ page }) => {
    await page.goto(`/${slug}`);
    const article = page.locator(`article[data-world="${slug}"]`);
    await expect(article).toHaveClass(/\bcs\b/);
    expect(await article.locator(".f").first().evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(WORLD_BG[slug]);
    expect(await unitPx(article.locator(".f").first())).toBeCloseTo(1, 1); // 1440 wide: one board unit ≈ 1px
    await expectNoHorizontalScroll(page);
  });
}

test("the worlds don't leak onto the site", async ({ page }) => {
  await page.goto("/");
  expect(await page.evaluate(() => document.querySelectorAll("[data-world]").length)).toBe(0);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.goto("/eventread");
  await page.goto("/");
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(bg);
});

test("below 1100px the sections switch to the phone unit", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/pulse");
  expect(await unitPx(page.locator("article .f").first())).toBeCloseTo(1, 1); // 390 wide: one phone-board unit ≈ 1px
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx playwright test -c playwright.case-studies.config.ts e2e/cs-frame.spec.ts --reporter=line`
Expected: FAIL (no `.cs` class, no `.f` sections).

- [ ] **Step 3: Move the routes and add the layout**

```bash
mkdir -p "src/app/(case-studies)"
git mv src/app/eventread "src/app/(case-studies)/eventread"
git mv src/app/cyvore "src/app/(case-studies)/cyvore"
git mv src/app/pulse "src/app/(case-studies)/pulse"
```

```tsx
// src/app/(case-studies)/layout.tsx
import type { ReactNode } from "react";
import "@/components/case-study/frame.css";
import "@/components/case-study/worlds.css";
import { CaseStudyTestHooks } from "@/components/case-study/test-hooks";

/** Case-study pages only: the boards' units and worlds. Fonts load per study (Global Constraints). */
export default function CaseStudiesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <CaseStudyTestHooks />
    </>
  );
}
```

```tsx
// src/components/case-study/test-hooks.tsx
"use client";
import { useEffect } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

declare global { interface Window { __csScrollTriggers?: () => (string | null)[] } }

/** For the e2e suite: which page each live ScrollTrigger belongs to (Review Focus 1). */
export function CaseStudyTestHooks() {
  useEffect(() => {
    window.__csScrollTriggers = () =>
      ScrollTrigger.getAll().map((t) => (t.trigger as Element | undefined)?.closest("[data-world]")?.getAttribute("data-world") ?? null);
  }, []);
  return null;
}
```

- [ ] **Step 4: The unit system and floors**

```css
/* src/components/case-study/frame.css
   The boards are drawn in --u: 1/1440 of the frame at desktop, 1/390 in the phone frames. The page keeps that:
   ≥ 1100px the board's desktop layout, fluid; below, the board's phone layout in a centred column (max 1.6× the
   phone frame, so tablets read it comfortably). */
.cs { container-type: inline-size; display: block; }
.cs .f { --u: calc(100cqw / 1440); position: relative; overflow: clip; }
@container (max-width: 1099px) {
  .cs .f { --u: min(calc(100cqw / 390), 1.6px);
    padding-inline: max(0px, calc((100cqw - var(--u) * 390) / 2)); }
}
.cs .f p { margin: 0; }
.cs .f :is(h1, h2, h3) { margin: 0; font-weight: 400; }
.cs .f a { color: inherit; text-decoration: none; }
/* Liam's type, with the floors (Global Constraints). Board sizes in --u, never under the floor. */
.cs .label { font: 400 max(11px, calc(var(--u) * 12))/1.15 var(--font-geist-mono, ui-monospace), monospace; text-transform: uppercase; letter-spacing: .08em; color: var(--ink-3); }
.cs .title { font-size: max(40px, calc(var(--u) * 72)); line-height: .95; letter-spacing: -.025em; }
.cs .display { font-size: max(26px, calc(var(--u) * 48)); line-height: 1.16; letter-spacing: -.018em; }
.cs .display em { font-style: italic; }
.cs .body { font-size: max(15px, calc(var(--u) * 18)); line-height: 1.55; color: var(--ink-2); max-width: 46ch; }
.cs .quiet { color: var(--ink-3); }
.cs .g12 { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); column-gap: calc(var(--u) * 24); padding: 0 calc(var(--u) * 72); }
@container (max-width: 1099px) { .cs .g12 { grid-template-columns: minmax(0, 1fr); padding: 0 calc(var(--u) * 16); } .cs .g12 > * { grid-column: 1 / -1 !important; } }
```

(`--font-geist-sans` / `--font-geist-mono` are the variables `geist/font` sets; checked in `node_modules/geist/dist/font.js`.)

```css
/* src/components/case-study/worlds.css: the boards' :root tokens, each scoped to its world.
   Eventread: docs/prototypes/eventread-mockups.html:19-26 · Cyvore: cyvore-mockups.html:19-34 · Pulse: pulse-mockups.html:22-32 */
[data-world="eventread"] {
  --canvas: #f8f8f6; --surface: #ffffff; --subtle: #f2f1ec; --hair: #e6e4de; --hair-2: #d6d3cb;
  --ink: #1a1a2e; --ink-2: #4a4a5c; --ink-3: #6b6b80; --ink-4: #9a9aac;
  --critical: #c8333a; --threat: #965a06; --threat-dot: #f0a020; --safe: #23784d; --violet: #120a24;
  background: var(--canvas); color: var(--ink);
}
[data-world="eventread"] .f { background: var(--canvas); color: var(--ink); }
[data-world="cyvore"] {
  --void: #0b0814; --panel: #120d1f; --raise: #191229; --hair: rgba(236,230,250,.09); --hair-2: rgba(236,230,250,.16);
  --ink: #f1edf9; --ink-2: rgba(241,237,249,.74); --ink-3: rgba(241,237,249,.56);
  --v1: #8a38f5; --v2: #9c83fb; --v3: #51218f; --v4: #411f6e; --v5: #43246c; --v6: #2c1747; --v7: #160b23;
  --site: #0c0e12; --tab: #1a1230; --cta-grey: #d1d5dc; --pulse: #06122a; --settle: cubic-bezier(0.22, 1, 0.36, 1);
  background: var(--void); color: var(--ink);
}
[data-world="cyvore"] .f { background: var(--void); color: var(--ink); }
[data-world="pulse"] {
  --void: #060b14; --panel: #0b1422; --raise: #101b2e; --hair: rgba(220,232,250,.09); --hair-2: rgba(220,232,250,.16);
  --ink: #eef3fa; --ink-2: rgba(238,243,250,.74); --ink-3: rgba(238,243,250,.56);
  --blue: #1f80ee; --teal: #33d0e7; --navy-glow: #113669; --grad: linear-gradient(90deg, #1f80ee, #33d0e7);
  --settle: cubic-bezier(0.22, 1, 0.36, 1);
  background: var(--void); color: var(--ink);
}
[data-world="pulse"] .f { background: var(--void); color: var(--ink); }
```

- [ ] **Step 5: The article and section classes**

In `case-study-page.tsx` change `<article data-world={study.slug}>` to `<article data-world={study.slug} className="cs">`. Add `className="f"` to the root element of `CaseHero`, `AtAGlance`, `MiddleBlock`, `ChallengeList`, `Outcome` and `NextProject`, keeping their existing classes for now (they are replaced in Task 2).

- [ ] **Step 6: Run the tests**

Run: `npx playwright test -c playwright.case-studies.config.ts e2e/cs-frame.spec.ts e2e/case-studies.spec.ts --reporter=line` and `npx vitest run src/components/case-study`
Expected: all pass. URLs `/eventread`, `/cyvore`, `/pulse` unchanged.

- [ ] **Step 7: Commit**

```bash
git add -A "src/app/(case-studies)" src/app/eventread src/app/cyvore src/app/pulse src/components/case-study e2e/cs-frame.spec.ts
git commit -m "feat(case-studies): route group with the boards' worlds and units, scoped to case-study pages (Part C Task 1)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The shared blocks in the boards' design (hero, at a glance, challenges, impact, next) + LazyVideo

**Files:**
- Modify: `src/lib/case-studies/types.ts`, `src/content/case-studies/{eventread,cyvore,pulse}.ts`, `src/content/case-studies/index.ts`, `src/components/case-study/{case-study-page,case-hero,at-a-glance,challenge-list,outcome,next-project,middle-block}.tsx` and their `.test.tsx`
- Create: `src/components/case-study/lazy-video.tsx`, `src/components/case-study/{eventread,cyvore,pulse}/{<study>.css,hero-visual.tsx}`
- Copy media: see Step 4
- Test: `e2e/cs-frame.spec.ts` (extend)

**Interfaces:**
- Consumes: Task 1 classes (`cs`, `f`) and tokens.
- Produces:
  - `types.ts` additions:
    ```ts
    export interface Media { src: string; alt: string; width: number; height: number; poster?: string; video?: boolean }
    export interface Challenge { /* existing fields */ shot?: Media; chip?: string }
    export interface CaseStudy { /* existing */ peek: Media; nextLine: string }
    export interface CaseStudyEntry { study: CaseStudy; Middle: ComponentType; HeroVisual: ComponentType }
    ```
  - `CaseStudyPage({ study, Middle, HeroVisual }: CaseStudyEntry)`. The three `page.tsx` files pass `{...caseStudies.<slug>}`, and `CaseHero` gets `visual={<HeroVisual />}`.
  - `LazyVideo(props: { src: string; poster: string; label: string; className?: string; loop?: boolean })`: muted, playsInline, `preload="none"` until within 1.5 viewports (IntersectionObserver, `rootMargin: "150% 0px"`), then `preload="metadata"` and plays while visible. Under reduced motion it never plays, and the poster stays.
  - CSS for each study's shared blocks lives in `src/components/case-study/<study>/<study>.css` (imported by that study's `hero-visual.tsx`, which every page renders), scoped `[data-world="<study>"]`.

- [ ] **Step 1: Write failing unit tests for the new content fields**

Add to `src/content/case-studies/content.test.ts`:
```ts
test.each(studies)("$slug has a peek image and a next line for the next-project block", (study) => {
  expect(study.peek.src).toMatch(new RegExp(`^/case-studies/${study.slug}/`));
  expect(study.peek.alt.length).toBeGreaterThan(10);
  expect(study.nextLine.length).toBeGreaterThan(10);
});
test("every challenge shot lives under its study's folder", () => {
  for (const s of studies) for (const c of s.challenges) if (c.shot) expect(c.shot.src.startsWith(`/case-studies/${s.slug}/`)).toBe(true);
});
```
Run: `npx vitest run src/content` → Expected: FAIL (`peek` undefined).

- [ ] **Step 2: Write the failing e2e for the shared blocks**

Append to `e2e/cs-frame.spec.ts`:
```ts
import { expectNoSeriousA11y, expectTextFloors, firstViewBudget } from "./cs-helpers";

for (const slug of STUDIES) {
  test(`/${slug} shared blocks follow the board`, async ({ page }) => {
    await page.goto(`/${slug}`);
    const challenges = page.getByRole("region", { name: "Challenges" });
    await expect(challenges.getByText("What happened").first()).toBeVisible();
    await expect(challenges.getByText("What I did").first()).toBeVisible();
    await expect(challenges.getByText("What it changed").first()).toBeVisible();
    const next = page.getByRole("navigation", { name: "Next case study" });
    await expect(next.locator("img")).toHaveCount(1); // the next study peeks in
    await expectNoSeriousA11y(page);
    await expectTextFloors(page);
  });
  for (const width of [1180, 390]) {
    test(`/${slug} at ${width}px: no sideways scroll, floors hold, accessible`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${slug}`);
      await expectNoHorizontalScroll(page);
      await expectTextFloors(page);
      await expectNoSeriousA11y(page);
    });
  }
  test(`/${slug} first view stays in budget`, async ({ page }) => {
    await page.goto(`/${slug}`);
    const b = await firstViewBudget(page);
    expect(b.lcpBytes).toBeLessThanOrEqual(200 * 1024);
    expect(b.imageBytes).toBeLessThanOrEqual(1024 * 1024);
    expect(b.earlyVideos).toEqual([]);
  });
  test(`/${slug}: every focusable in the article shows a visible focus ring`, async ({ page }) => {
    await page.goto(`/${slug}`);
    const missing: string[] = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      const r = await page.evaluate(() => {
        const a = document.activeElement as HTMLElement | null;
        if (!a || !a.closest("article[data-world]")) return null;
        const cs = getComputedStyle(a);
        const ring = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
        return ring || cs.boxShadow !== "none" ? "" : a.outerHTML.slice(0, 80);
      });
      if (r) missing.push(r);
    }
    expect(missing).toEqual([]);
  });
}
test("Cyvore's quote carries its impact, in quotation marks", async ({ page }) => {
  await page.goto("/cyvore");
  const impact = page.getByRole("region", { name: "Impact" });
  await expect(impact.locator("blockquote")).toContainText("“We weren’t looking for a designer.");
  await expect(impact.getByText("Yoav Rotem", { exact: true })).toBeVisible();
  await expect(impact.getByText("CTO, Cyvore", { exact: true })).toBeVisible();
});
```
Run: `npx playwright test -c playwright.case-studies.config.ts e2e/cs-frame.spec.ts --reporter=line` → Expected: FAIL (no labels, no peek image).

- [ ] **Step 3: Content data from the boards**

Fill the new fields from each board's markup (copy appendix sections Hero, Challenges, Impact, Next):
- `peek`: the image the previous study shows when this one "peeks in". The files are `docs/prototypes/eventread-mockups/cyvore-hero-laptop.jpg` (→ Cyvore's peek), `cyvore-mockups/pulse-peek.jpg` (→ Pulse's), and `pulse-mockups/eventread-peek.jpg` (→ Eventread's). Use the board's `alt` text exactly. `width`/`height` are the file's pixel size (`sips -g pixelWidth -g pixelHeight <file>`).
- `nextLine`: the one-line description each board shows under the next study's name in its "08 · Next" frame (Eventread board shows Cyvore's line, etc.). Store it on the study it describes.
- `Challenge.shot` and `chip`: from each board's "06 · Challenges" markup (Pulse has a final screen per challenge: `onb-02.jpg`, `training-log.jpg`, `challenges.jpg`; Eventread and Cyvore: whatever their board shows, none if none).
- The boards' stat figures are Problem content, not shared blocks: Eventread's "150" (`eventread-mockups.html:469-489`) in Task 4, Cyvore's "35s" (`cyvore-mockups.html:529`) in Task 6.
- `index.ts`: each entry gains `HeroVisual` from `@/components/case-study/<study>/hero-visual`.

- [ ] **Step 4: Media into `public/case-studies/<study>/`**

Copy every file the board references (list: `grep -o 'src="[^"]*"' docs/prototypes/<study>-mockups.html`) into `public/case-studies/<study>/`, keeping names. Skip `ref-*.jpg` (references) and `.js` files. Then compress stills: `sips -s format jpeg -s formatOptions 80 --resampleWidth 2400 <file> --out <file>` for any still over 400 KB wider than 2400px. Videos stay as the boards have them (already trimmed). Check `du -sh public/case-studies/*`.

- [ ] **Step 5: Shared components render the board markup**

Port each block from the board, replacing literal text with the content fields. Markup sources (any of the three boards; the class names are the same across boards, the CSS differs per world):
- `CaseHero`: `pulse-mockups.html:348-365` structure: `<header className="f hero">` with `.label` (descriptor), `h1.title` (keep `id="case-title" tabIndex={-1}`), `.hero-line` (line), the Visit site button if `liveUrl` (keep the sr-only "(opens in a new tab)"), and `<HeroVisual />` passed in as a prop from `CaseStudyPage`.
- `AtAGlance`: `pulse-mockups.html:366-378`, keeping the `<dl aria-label="At a glance">` semantics. Tools render as chips (one `<li>` each inside the `dd`, per the copy appendix).
- `ChallengeList`: `pulse-mockups.html:470-504` structure. A number, title, three labelled parts "What happened" / "What I did" / "What it changed" (each label a `.label` element followed by its text), the optional `chip`, and the optional `shot` via `next/image` (or `LazyVideo` if `shot.video`). Keep the `<section aria-labelledby>` heading "Challenges".
- `Outcome`: `cyvore-mockups.html:759-775` for the quote variant (curly quotes in the rendered text: wrap `quote.text` in “ ”, name and title on separate lines). `pulse-mockups.html:505-515` for lines only. Keep the heading "Impact".
- `NextProject`: `pulse-mockups.html:516-530`. Label "Next project", the next study's name, its `nextLine`, its `peek` image (`next/image`, `sizes="(min-width: 1100px) 60vw, 100vw"`). Keep `aria-label={\`Next project: ${name}\`}` on the link and `nav aria-label="Next case study"`. It reads the next study via `caseStudies[nextProject(from).slug]`.
- `MiddleBlock` stays as is apart from `className="f"`; the studies' own sections replace its use in Tasks 4, 6 and 9.

Each `<study>/hero-visual.tsx` renders the board's hero visual and imports `./<study>.css`:
- Eventread `eventread-mockups.html:436-455`: the month view `calendar-berlin-2026-11.jpg` in its tray (mobile: cropped to the day tiles, board CSS lines 338-339).
- Cyvore `cyvore-mockups.html:489-505`: `hero-loop.mp4` in `LazyVideo` (in view at load, so it plays at once).
- Pulse `pulse-mockups.html:348-365`: `home.mp4` in `.phone` (slim phone frame CSS `pulse-mockups.html:129-134`).
Mark product visuals with `data-product` (Global Constraints). Images in the first view get `priority`.

- [ ] **Step 6: Each world's CSS for the shared blocks**

Into `src/components/case-study/<study>/<study>.css`, port the board's CSS for hero, at a glance, challenges, impact, next (Eventread lines 132-150, 288-323; Cyvore 135-156, 333-374; Pulse 129-153, 220-256), and the matching phone rules (Eventread 324-359, Cyvore 382-449, Pulse 293-330) inside `@container (max-width: 1099px)`. Rules:
1. Prefix every selector with `[data-world="<study>"] ` (`.f` becomes `[data-world="<study>"] .f`).
2. Replace `.f.m` / `.m ` phone-frame selectors by the same selector inside the container query.
3. Drop the board-only rules (Global Constraints list).
4. `var(--sans)` → `var(--font-geist-sans)`, `var(--mono)` → `var(--font-geist-mono)` (names as in `src/app/fonts.ts`).
5. Text sizes keep `calc(var(--u) * N)` but go through the floors (`max(<floor>, …)`) where they render Liam's words.

- [ ] **Step 7: LazyVideo**

```tsx
// src/components/case-study/lazy-video.tsx
"use client";
import { useEffect, useRef } from "react";

/** Board videos: muted loops that fetch only when near the screen and play only while on it. Reduced motion: poster. */
export function LazyVideo({ src, poster, label, className, loop = true }: { src: string; poster: string; label: string; className?: string; loop?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current!;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const near = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      v.preload = "metadata";
      if (!v.src) v.src = src;
      near.disconnect();
    }, { rootMargin: "150% 0px" });
    const seen = new IntersectionObserver(([e]) => { if (e.isIntersecting) void v.play().catch(() => {}); else v.pause(); }, { threshold: 0.25 });
    near.observe(v); seen.observe(v);
    return () => { near.disconnect(); seen.disconnect(); v.pause(); };
  }, [src]);
  return <video ref={ref} className={className} poster={poster} muted playsInline loop={loop} preload="none" aria-label={label} />;
}
```
Add `src/components/case-study/lazy-video.test.tsx` (jsdom): renders with `preload="none"`, no `src` attribute, `poster` set, and `muted` + `playsInline`.

- [ ] **Step 8: Update the component unit tests**

Update the existing `case-hero.test.tsx`, `at-a-glance.test.tsx`, `challenge-list.test.tsx`, `outcome.test.tsx`, `next-project.test.tsx` and `case-study-page.test.tsx` to the new markup. Keep every assertion about semantics: the heading levels, `dl`/`dt`/`dd`, the region names, the link names, and "opens in a new tab". Add assertions for the three challenge labels, the curly quotes, and the next-project image `alt`.

- [ ] **Step 9: Run everything**

Run: `npx vitest run` → Expected: all pass. Run: `npx playwright test -c playwright.case-studies.config.ts --reporter=line` → Expected: all pass.

- [ ] **Step 10: Visual check against the boards**

Screenshot each page at 1440×900 and 390×844 (`page.screenshot({ fullPage: true })` into the scratchpad, never the repo), and the same frames of the boards (`python3 -m http.server 4323 --directory docs/prototypes`). Compare by eye: hero, at a glance, challenges, impact, next. Fix differences, and ledger any you keep on purpose.

- [ ] **Step 11: Commit**

```bash
git add src/lib/case-studies src/content/case-studies src/components/case-study public/case-studies e2e/cs-frame.spec.ts
git commit -m "feat(case-studies): the shared blocks in each board's design: hero visual, at a glance, challenges with their labels and shots, impact, next study peeking in (Part C Task 2)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Merge gate A (shared frame)

- [ ] **Step 1:** Full suite on the branch: `npx vitest run`, `npx playwright test -c playwright.case-studies.config.ts`, `npx eslint src e2e` (all green).
- [ ] **Step 2:** Start `npx next dev -p 3101` in the worktree (via the preview tool if available) and ask Liam to review `/eventread`, `/cyvore`, `/pulse` in his browser, including at phone width. Stop and wait for his answer. Apply changes he asks for (each with a test where it is behaviour) and re-run Step 1.
- [ ] **Step 3: On Liam's "merge"**, check the overlap with the other chat's uncommitted work, then merge:

```bash
MAIN="/Users/liamwindhasson/Documents/My portfolio - project"
git -C "$MAIN" branch --show-current   # must print phase/2-home
git diff --name-only phase/2-home...phase/2-case-studies | sort > /tmp/cs-incoming.txt
git -C "$MAIN" status --porcelain | sed 's/^...//' | sort > /tmp/cs-dirty.txt
comm -12 /tmp/cs-incoming.txt /tmp/cs-dirty.txt   # must print nothing; if not, stop and tell Liam
git -C "$MAIN" merge --no-ff phase/2-case-studies -m "merge: case studies Part C, shared frame (worlds, units, shared blocks)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
- [ ] **Step 4:** On the merged result in the main checkout, run `npx vitest run` and `npx playwright test -c playwright.case-studies.config.ts`. If red: stop, report, don't fix on `phase/2-home`.

---

### Task 4: Eventread middle (Problem, Solution navy band, How it works)

**Files:**
- Create: `src/components/case-study/eventread/{problem,solution,how-it-works}.tsx`, `e2e/cs-eventread.spec.ts`
- Modify: `src/content/case-studies/eventread.mdx`, `src/components/case-study/eventread/eventread.css`

**Interfaces:**
- Consumes: `LazyVideo` (Task 2), `src/lib/danger-score.ts` (Part A).
- Produces: `EventreadProblem`, `EventreadSolution` and `EventreadHowItWorks`, each `({ kind, title, children }: { kind: "problem" | "signature" | "supporting"; title: string; children?: ReactNode })`. They render `<section aria-labelledby data-block={kind} className="f …">`, so `middles.test.ts` (kinds and titles in the MDX) and the region-name e2e keep working.

- [ ] **Step 1: Write the failing e2e**

```ts
// e2e/cs-eventread.spec.ts
import { expect, test } from "@playwright/test";
import { collectConsoleErrors, expectNoHorizontalScroll, expectNoSeriousA11y } from "./cs-helpers";

test("Eventread's middle is the board: problem stat, the Danger Score band, the walkthrough", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.goto("/eventread");
  const problem = page.getByRole("region", { name: "Problem" });
  await expect(problem).toContainText("Two bands, one lost night.");
  await expect(problem.getByText("150", { exact: true })).toBeVisible();
  await expect(problem).toContainText("shows every night");
  const solution = page.getByRole("region", { name: "Solution" });
  await expect(solution).toContainText("The Danger Score.");
  for (const name of ["Muse - The Wow! Signal Europa Tour", "Horse Lords", "TAEMIN"]) await expect(solution).toContainText(name);
  for (const r of ["= 1.00", "= 0.60", "= 0.16"]) await expect(solution).toContainText(r);
  await expect(solution).toContainText("relevance is.");
  const how = page.getByRole("region", { name: "How it works" });
  for (const h of ["Search, then save it as an act", "Under the hood"]) await expect(how.getByText(h, { exact: true })).toBeVisible();
  await expect(how.getByRole("heading", { level: 3 })).toHaveCount(3);
  expect(errors).toEqual([]);
  await expectNoSeriousA11y(page);
});

test("Eventread's videos are only fetched near the screen", async ({ page }) => {
  const mp4: string[] = [];
  page.on("request", (r) => { if (r.url().endsWith(".mp4")) mp4.push(r.url()); });
  await page.goto("/eventread");
  await page.waitForLoadState("networkidle");
  expect(mp4).toEqual([]); // the walkthrough is far below the fold
  await page.getByRole("region", { name: "How it works" }).scrollIntoViewIfNeeded();
  await expect.poll(() => mp4.length).toBeGreaterThan(0);
});

test("Eventread at 390: the band runs edge to edge, nothing scrolls sideways", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/eventread");
  await expectNoHorizontalScroll(page);
  const band = page.getByRole("region", { name: "Solution" });
  const box = (await band.boundingBox())!;
  expect(box.x).toBeLessThanOrEqual(0.5);
  expect(box.width).toBeGreaterThanOrEqual(389);
});
```
Run: `npx playwright test -c playwright.case-studies.config.ts e2e/cs-eventread.spec.ts --reporter=line` → Expected: FAIL.

- [ ] **Step 2: Port the sections**

Markup from `eventread-mockups.html`: Problem `469-489`, Solution `490-577`, How it works `578-630`, and the phone versions from the Mobile frame `692-774`. CSS: Problem `151-156`, Solution `157-228` (the product UI block at `170-228` is the calculator, so mark its root `data-product`), How it works `229-287`, and phone `324-359` into the container query (Task 2 Step 6 rules).
- Prose that is Liam's words stays in the MDX as children, in the board's grouping. For example, "Size isn't danger; *relevance is.*" becomes its own `.display` line, and "Nobody had checked…" is set `.quiet` (copy appendix).
- The calculator rows are data, not prose. Put them in a typed constant in `solution.tsx`, with values exactly as on the board (copy appendix rows 1–3). Assert in a unit test (`solution.test.ts`) that each row's product equals `score()` from `src/lib/danger-score.ts` for the same inputs, so the band can never disagree with the engine.
- How it works: the three steps become `h3` without the full stop ("Search, then save it as an act", …) with "01"/"02"/"03" labels. "Under the hood" is a `.label`. Videos `flow-pick-act.mp4` and `flow-save-act.mp4` go through `LazyVideo` (posters: the first frame, made with `ffmpeg -i <mp4> -frames:v 1 -q:v 3 <name>-poster.jpg` into `public/case-studies/eventread/`). Images through `next/image`.

- [ ] **Step 3: MDX composes them**

```mdx
import { EventreadProblem } from "@/components/case-study/eventread/problem";
import { EventreadSolution } from "@/components/case-study/eventread/solution";
import { EventreadHowItWorks } from "@/components/case-study/eventread/how-it-works";

<EventreadProblem kind="problem" title="Problem">

Two bands, one lost night. My band's release show lost its audience to a Måneskin arena show on the same night. A friend's band lost theirs to the Champions League final. *Nobody had checked, because there was nothing to check with.*

</EventreadProblem>
```
The children are today's `eventread.mdx` prose for that block, regrouped exactly as the copy appendix's Eventread table says (the Problem above is that regrouping). Repeat for Solution and How it works. Keep `kind=` and `title=` literal (`middles.test.ts` reads them).

- [ ] **Step 4: Run tests**

Run: `npx vitest run` and `npx playwright test -c playwright.case-studies.config.ts --reporter=line` → Expected: all pass.

- [ ] **Step 5: Visual check** at 1440 and 390 against board frames 03–05 and the Mobile frame (as Task 2 Step 10).

- [ ] **Step 6: Commit**

```bash
git add src/components/case-study/eventread src/content/case-studies/eventread.mdx public/case-studies/eventread e2e/cs-eventread.spec.ts
git commit -m "feat(case-studies): Eventread's middle from its board: the problem stat, the Danger Score band, the product walkthrough (Part C Task 4)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Merge gate B (Eventread)

Same steps as Task 3, with the merge message `merge: case studies Part C, Eventread`.

---

### Task 6: Cyvore middle (Problem, the story, How it works)

**Files:**
- Create: `src/components/case-study/cyvore/{fonts.ts,story-engine.ts,story.tsx,problem.tsx,how-it-works.tsx}`, `src/components/case-study/use-engine.ts`, `e2e/cs-cyvore-story.spec.ts`, `e2e/cs-navigation.spec.ts`
- Modify: `src/content/case-studies/cyvore.mdx`, `src/components/case-study/cyvore/cyvore.css`

**Interfaces:**
- Consumes: `src/lib/case-studies/cyvore-story.ts` (`BEATS, CHAPTERS, TOTAL_WEIGHT, beatAt, beatStart, firstBeatOf, chapterFill, STATS, formatStat, captionAt, scrubTime`), `LazyVideo`.
- Produces:
  - `useEngine(mount: (root: HTMLElement) => () => void): RefObject<HTMLDivElement | null>`. It mounts once after `document.fonts.ready`, returns the ref to attach, and runs the returned cleanup on unmount.
  - `story-engine.ts` exports `mountCyvoreStory(root: HTMLElement, name: string): () => void` and `mountCyvoreStatic(root: HTMLElement, name: string): () => void`. It keeps `window.__cyvoreStories[name]` as on the board.

- [ ] **Step 1: The engine hook**

```ts
// src/components/case-study/use-engine.ts
"use client";
import { useEffect, useRef } from "react";

/** Mounts a board engine on the element once fonts are in, and tears it all down on unmount (Review Focus 1). */
export function useEngine(mount: (root: HTMLElement) => () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    let alive = true;
    void document.fonts.ready.then(() => { if (alive && ref.current) cleanup = mount(ref.current); });
    return () => { alive = false; cleanup?.(); };
    // the engine is mounted once per page; `mount` is a module-level function
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}
```

- [ ] **Step 2: Port the board tests as page tests (failing)**

Copy `e2e-board/cyvore-story.spec.ts` to `e2e/cs-cyvore-story.spec.ts`. Change `page.goto("/cyvore-mockups.html")` to `page.goto("/cyvore")`. The board's `data-story="phone"` frame doesn't exist on the page: replace the phone-story test with the same test at `page.setViewportSize({ width: 390, height: 844 })` on the single story. Keep every other assertion. Add:
```ts
test("without JavaScript the story's first screen and caption are there", async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto("http://localhost:3101/cyvore");
  const story = page.getByRole("region", { name: "Solution" });
  await expect(story.getByText("A link lands in the call.").first()).toBeVisible();
  await ctx.close();
});
test("resizing across 1100px while pinned keeps one screen and no errors", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.goto("/cyvore");
  await page.evaluate(() => window.__cyvoreStories.desktop.scrollToBeat(4, 0.5));
  await page.setViewportSize({ width: 820, height: 900 });
  await page.waitForTimeout(600);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(600);
  expect(errors).toEqual([]);
});
```
And `e2e/cs-navigation.spec.ts`:
```ts
import { expect, test } from "@playwright/test";

test("leaving Cyvore by the next-project link leaves nothing of it running; Back brings it back working", async ({ page }) => {
  await page.goto("/cyvore");
  await page.waitForFunction(() => window.__csScrollTriggers && window.__csScrollTriggers().includes("cyvore"));
  await page.getByRole("link", { name: "Next project: Pulse" }).click();
  await expect(page).toHaveURL(/\/pulse$/);
  await expect.poll(() => page.evaluate(() => window.__csScrollTriggers!().filter((w) => w === "cyvore").length)).toBe(0);
  expect(await page.locator(".pin-spacer [data-world='cyvore'], [data-world='cyvore']").count()).toBe(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/cyvore$/);
  await page.waitForFunction(() => window.__csScrollTriggers!().includes("cyvore"));
});
```
Run both → Expected: FAIL (no story on the page).

- [ ] **Step 3: Port the engine**

`docs/prototypes/cyvore-mockups/story-board.js` → `src/components/case-study/cyvore/story-engine.ts`:
1. Imports: `import { gsap } from "gsap"; import { ScrollTrigger } from "gsap/ScrollTrigger"; gsap.registerPlugin(ScrollTrigger);` and the model from `@/lib/case-studies/cyvore-story`.
2. Add types to every function signature (`HTMLElement`, `number`, the model's exported types). Leave the logic as it is.
3. `mountStory(story, name)` → `export function mountCyvoreStory(root: HTMLElement, name: string): () => void`. Collect every ScrollTrigger, tween/timeline, listener, observer and timeout it creates, and return a cleanup that kills or removes them all, then deletes `window.__cyvoreStories[name]`.
4. The board fetched the attack video as a blob (line 238: the python server had no byte ranges). `next start` serves ranges, so set the `src` directly. If seeking misbehaves in the e2e, restore the blob fetch and ledger the ruling.
5. `reduce` is read inside the mount function, not at module scope (SSR safety).
6. `mountStatic` → `mountCyvoreStatic` with the same cleanup contract.

- [ ] **Step 4: Fonts and the React markup**

```ts
// src/components/case-study/cyvore/fonts.ts
import { Iceland, Inter, Michroma } from "next/font/google";
export const michroma = Michroma({ weight: "400", subsets: ["latin"], variable: "--font-michroma", display: "swap" });
export const iceland = Iceland({ weight: "400", subsets: ["latin"], variable: "--font-iceland", display: "swap" });
export const inter = Inter({ weight: ["400", "500"], subsets: ["latin"], variable: "--font-inter", display: "swap" });
export const cyvoreFontVariables = [michroma.variable, iceland.variable, inter.variable].join(" ");
```
`story.tsx` (`"use client"`): render the board's Solution markup `cyvore-mockups.html:541-678` as JSX inside `<section aria-labelledby data-block="signature" className={\`f ${cyvoreFontVariables}\`}>`. Attach `useEngine((root) => (matchMedia("(prefers-reduced-motion: reduce)").matches ? mountCyvoreStatic : mountCyvoreStory)(root, "desktop"))` to the story root. Mark the replica `data-product`. Server HTML shows the first beat (the board's CSS initial state): the first screen and its caption visible (Review Focus 4). In `cyvore.css`, `--mich` / `--ice` / `--ui` become `var(--font-michroma)` / `var(--font-iceland)` / `var(--font-inter)`.
Problem `519-540` and How it works `679-734` go into `problem.tsx` / `how-it-works.tsx` (server components; `mission.mp4` and `cta-hover.mp4` via `LazyVideo`). CSS `157-332` and phone `382-449` go into `cyvore.css` (Task 2 Step 6 rules). The "The replica below…" line moves after the replica (copy appendix).

- [ ] **Step 5: MDX** composes `CyvoreProblem`, `CyvoreStory` (`kind="signature" title="Solution"`) and `CyvoreHowItWorks`, as in Task 4 Step 3.

- [ ] **Step 6: Run tests**

Run: `npx vitest run` and `npx playwright test -c playwright.case-studies.config.ts --reporter=line` → Expected: all pass, including `cs-cyvore-story`, `cs-navigation` and `case-studies.spec.ts` ("One screen, everything." in Solution).

- [ ] **Step 7: Visual check** against board frames 03–05 and the Phone frame.

- [ ] **Step 8: Commit**

```bash
git add src/components/case-study src/content/case-studies/cyvore.mdx public/case-studies/cyvore e2e/cs-cyvore-story.spec.ts e2e/cs-navigation.spec.ts
git commit -m "feat(case-studies): Cyvore's middle from its board: the story replica live on the page, the shipped motion, the design system strip (Part C Task 6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Merge gate C (Cyvore)

Same steps as Task 3, with the merge message `merge: case studies Part C, Cyvore`.

---

### Task 8: Pulse engines into `src` (no page change yet)

**Files:**
- Create: `src/components/case-study/pulse/{onboarding-app.ts,onboarding-story.ts,onboarding-proto.ts,app.css,fonts.ts,onboarding-app.test.ts}`; media `public/case-studies/pulse/app/**`

**Interfaces:**
- Produces:
  - `onboarding-app.ts`: `createApp(root: HTMLElement, shell: AppShell): AppApi` and `mountStoryScreens(phone: HTMLElement, opts: { gsap: typeof gsap; still: boolean }): StoryScreens`. Pure helpers are exported for unit tests: `INITIAL(): Choices`, `stateAt(n: number, k: number): Choices`, `SCRIPT` and `stepEnd(step: Step): number`.
  - `onboarding-story.ts`: `mountPulseStory(root: HTMLElement, name: string): () => void` and `mountPulseStatic(root: HTMLElement, name: string): () => void`. They keep `window.__pulseStories[name]` and its `state()` / `scrollToBeat()` exactly as on the board.
  - `onboarding-proto.ts`: `mountPulseProto(dialog: HTMLElement): () => void`. It keeps `window.__pulseProto.state()` and binds `[data-proto-open]` buttons inside the article only.

- [ ] **Step 1: Unit tests for the pure parts (failing: modules don't exist)**

```ts
// src/components/case-study/pulse/onboarding-app.test.ts
import { describe, expect, test } from "vitest";
import { INITIAL, SCRIPT, stateAt, stepEnd } from "./onboarding-app";

describe("the Pulse onboarding script", () => {
  test("the prototype starts unfilled (Liam, 2026-10-11)", () => {
    expect(INITIAL()).toMatchObject({ goals: [], activities: [], workout: null, studio: null, day: null, slot: null });
  });
  test("the story's user picks the Figma file's choices by the booking screen", () => {
    expect(stateAt(8, 0)).toMatchObject({ goals: ["Get stronger", "Stay active"], activities: ["HIIT", "Hyrox"], workout: "HIIT", studio: "Burn Club", day: "Mon, Dec 1", slot: 3 });
  });
  test("every screen rests untouched first: no step before 1.6s", () => {
    for (const steps of Object.values(SCRIPT)) for (const st of steps) expect(st.at).toBeGreaterThanOrEqual(1.6);
  });
  test("taps are at least 0.6s apart", () => {
    for (const steps of Object.values(SCRIPT)) steps.slice(1).forEach((st, i) => expect(st.at - stepEnd(steps[i])).toBeGreaterThanOrEqual(0.6));
  });
});
```
Run: `npx vitest run src/components/case-study/pulse` → Expected: FAIL (module not found).

- [ ] **Step 2: Port the three modules**

From `docs/prototypes/pulse-mockups/onboarding-{app,story,proto}.js` (board v4):
1. Use `gsap`/`ScrollTrigger` from npm. Drop `window.gsap`.
2. Asset URLs: `const A = (f: string) => new URL(\`./app/${f}\`, import.meta.url).href` becomes `const A = (f: string) => \`/case-studies/pulse/app/${f}\``. Copy `docs/prototypes/pulse-mockups/app/*` to `public/case-studies/pulse/app/`.
3. The story's `boot()` and the proto's module-level `mount()` become the exported mount functions (no work at import time). Each returns a cleanup that kills its ScrollTrigger, play tween, delayed calls, observers and listeners, removes the `[data-proto-open]` click listener, restores `document.documentElement.style.overflow`, and deletes its `window` hooks.
4. Keep every behaviour and constant (script times, 85% slider threshold, auto move-on, plays only while pinned, never behind the open prototype).
5. Add types (`Choices`, `Step`, `AppShell`, `AppApi`, `StoryScreens`) and export the pure helpers listed in Interfaces. Read `prefers-reduced-motion` inside the mount functions.
6. `onboarding-app.css` → `app.css` (scoped already by `.pa`; prefix `[data-world="pulse"] `). Font names → `var(--font-space-grotesk)` / `var(--font-manrope)`.

```ts
// src/components/case-study/pulse/fonts.ts
import { Manrope, Space_Grotesk } from "next/font/google";
export const spaceGrotesk = Space_Grotesk({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-space-grotesk", display: "swap" });
export const manrope = Manrope({ weight: ["400", "600", "700"], subsets: ["latin"], variable: "--font-manrope", display: "swap" });
export const pulseAppFontVariables = [spaceGrotesk.variable, manrope.variable].join(" ");
```

- [ ] **Step 3: Run the unit tests**

Run: `npx vitest run src/components/case-study/pulse` → Expected: PASS. Run `npx tsc --noEmit` → Expected: no errors in the new modules.

- [ ] **Step 4: Commit**

```bash
git add src/components/case-study/pulse public/case-studies/pulse/app
git commit -m "feat(case-studies): the Pulse onboarding engines in src as typed modules with full cleanup (Part C Task 8)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Pulse middle (Problem, the onboarding story + prototype, How it works)

**Files:**
- Create: `src/components/case-study/pulse/{onboarding.tsx,problem.tsx,how-it-works.tsx}`, `e2e/cs-pulse-story.spec.ts`, `e2e/cs-pulse-proto.spec.ts`
- Modify: `src/content/case-studies/pulse.mdx`, `src/components/case-study/pulse/pulse.css`, `e2e/cs-navigation.spec.ts`

**Interfaces:**
- Consumes: Task 8 mount functions, `useEngine`, `LazyVideo`, `pulseAppFontVariables`.
- Produces: `PulseOnboarding({ kind, title, children })` renders the story markup and the overlay dialog, and mounts both engines.

- [ ] **Step 1: Port the board tests (failing)**

Copy `e2e-board/pulse-story.spec.ts` → `e2e/cs-pulse-story.spec.ts` and `e2e-board/pulse-proto.spec.ts` → `e2e/cs-pulse-proto.spec.ts`. Make these changes:
- `page.goto("/pulse-mockups.html", …)` → `page.goto("/pulse", …)`. The board's still-grid "reduced motion" tests stay.
- Replace the phone-story test with the same test at 390×844 on the single story.
- Keep every other assertion and helper, and the `declare global` types.
- The Lenis check (spec §5.3) is the existing test "left alone, a screen's last tap moves the story on…", which asserts `scrollY` grew. It must pass with the site's Lenis running. Add one more assertion: after the auto move-on, one wheel tick (`page.mouse.wheel(0, 120)`) moves `scrollY` forward from the new position, not back to the old one.
- Add the late-font test (Review Focus 5): route `**/*.woff2` with a 1500ms delay (`page.route`), go to the story, wait for the first tap, then assert the mark's centre is inside "Get stronger" (the same check as the tap-mark test).
- Add the no-JS test: with `javaScriptEnabled: false`, the Solution region shows the first screen's "Get Started" and the caption "What Pulse is for, in three lines.".
- Add the resize test (as in Task 6) for `/pulse`.
- In `cs-navigation.spec.ts`, add the same leave-and-return test for Pulse → Eventread, and check that `document.documentElement.style.overflow` is empty after leaving with the prototype closed.
Run → Expected: FAIL.

- [ ] **Step 2: Markup and mounting**

`onboarding.tsx` (`"use client"`): render `pulse-mockups.html:401-443` (the Solution section: `.ob[data-story="desktop"]` with its track, pin, 12 `.ob-screen` figures each with `<div className="ob-app" role="img" aria-label=…>` and its `figcaption`, the captions, stages, count and `[data-proto-open]` button). Also render the overlay `564-579` (the `[data-proto]` dialog, `hidden`). Put `className={pulseAppFontVariables}` on the section. Mount with `useEngine`:
```ts
const ref = useEngine((root) => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const stopStory = (reduce ? mountPulseStatic : mountPulseStory)(root.querySelector('.ob[data-story="desktop"]')!, "desktop");
  const stopProto = mountPulseProto(root.querySelector("[data-proto]")!);
  return () => { stopProto(); stopStory(); };
});
```
The board's phone story frame (`531-563`) is not separate markup. The same story re-lays out below 1100px via the phone CSS (`m-ob` rules at `pulse-mockups.html:320-329`, moved into the container query). Server HTML: screen 1 visible, with its caption (Review Focus 4). This needs the coded screens rendered on the server: render the static screen markup by calling the app's pure `screensHTML` (export it in Task 8 if not already) into `dangerouslySetInnerHTML` for screen 1 only. The engine replaces it on mount.
Problem `379-400` and How it works `444-469` (trio phones + brand strip, including the 2026-10-11 crop fix) go to `problem.tsx` / `how-it-works.tsx`. The milestones render as a large "Day 7" over "**The first habit loop.**" (copy appendix). CSS `154-219` and `257-292` (try button, overlay) and phone `293-330` go into `pulse.css` (Task 2 Step 6 rules).

- [ ] **Step 3: MDX** composes `PulseProblem`, `PulseOnboarding` (`kind="signature" title="Solution"`) and `PulseHowItWorks`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run` and `npx playwright test -c playwright.case-studies.config.ts --reporter=line` → Expected: all pass. If only the Lenis assertions fail, apply spec §5.3: export the Lenis instance from `src/components/providers/smooth-scroll.tsx` (one line), use `lenis.scrollTo(top, { immediate: true })` in the story's `scrollTo`, ledger the ruling, re-run.

- [ ] **Step 5: Visual check** against board frames 03–05, the Phone frame and the prototype overlay, at 1440 and 390.

- [ ] **Step 6: Commit**

```bash
git add src/components/case-study/pulse src/content/case-studies/pulse.mdx public/case-studies/pulse e2e/cs-pulse-story.spec.ts e2e/cs-pulse-proto.spec.ts e2e/cs-navigation.spec.ts
git commit -m "feat(case-studies): Pulse's middle from its board: milestones, the onboarding story and the tap-through prototype live on the page, how it works and the brand strip (Part C Task 9)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Retire the board tests, merge gate D (Pulse)

- [ ] **Step 1:** The page suites now cover the board suites (`cs-cyvore-story`, `cs-pulse-story`, `cs-pulse-proto`). Delete `e2e-board/cyvore-story.spec.ts`, `e2e-board/pulse-story.spec.ts` and `e2e-board/pulse-proto.spec.ts`. Keep `playwright.board.config.ts` and the boards themselves (the design record). Commit: `test: retire the board suites; the case-study pages carry them now (Part C spec §5.1)`.
- [ ] **Step 2:** Merge gate as in Task 3, with the merge message `merge: case studies Part C, Pulse (boards are now the pages)`.
- [ ] **Step 3:** Update the memory file `portfolio-rebuild-project.md` (Part C done, merge hashes, what the other chat needs: index anchors `#eventread`, `#cyvore`, `#pulse`).
