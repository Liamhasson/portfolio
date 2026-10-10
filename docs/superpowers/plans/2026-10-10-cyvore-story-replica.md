# Cyvore Story Replica Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Cyvore replica on the mockup board into a scroll-led story (Why it matters → The risk is real → Real-world attack → What powers us) that keeps the shipped look and fixes the shipped flow.

**Architecture:** The story's rules (beats, chapter fills, stat formatting, caption timing, scrub mapping) live in one pure TypeScript module, unit-tested with Vitest and compiled to a plain ES module for the board (the same module serves Part C later). A board script mounts each story: a sticky pin inside a tall track, GSAP ScrollTrigger reads progress, interface beats play short GSAP timelines, and only the attack video is scrubbed. Board behaviour is checked with a dedicated Playwright config against a static server.

**Tech Stack:** TypeScript 5 (pure module), Vitest 5 (jsdom), GSAP 3.12.5 + ScrollTrigger 3.12.5 from cdnjs (board only), Playwright 1.63, Python `http.server` for the static board.

**Spec:** `docs/superpowers/specs/2026-10-10-cyvore-story-replica-design.md` (approved 2026-10-10; captions and the How it works sentence kept as written).

**Working directory for every command:** `/Users/liamwindhasson/Documents/My portfolio - project/.claude/worktrees/case-studies` (branch `phase/2-case-studies`). Never `cd` to the repo root.

## Global Constraints

- Faithful look: Cyvore's content, layout, colours and fonts (Michroma, Iceland, Inter in cards) stay as shipped; only flow, pacing, transitions and readability change.
- Copy: all site text exactly as on the live site; the only new copy is the three captions: "A link lands in the call." / "Cyvore reads it." / "Blocked."
- What powers us text, exact: heading "WHAT POWERS US", sub "Three proprietary engines"; OPR "(Optical Phishing Recognition)" "AI driven visual phishing detection"; TIAO "(Threat Intelligence Autonomous Operation)" "Proactive threat engine that mimics analyst behavior, catching Zero-Day threats before they are launched."; DAN "(Data Analysis NLU)" "Context-aware language model that understands behavioral patterns across human and AI agents."
- Handover: out 360ms, then in 520ms; never overlapping; forward moves content up 16px, back moves it down 16px; nav, stage frame and chapter bar never move.
- Settle curve `cubic-bezier(0.22, 1, 0.36, 1)` for CSS; GSAP uses `power3.out` as its equivalent.
- Only `transform`, `opacity`, `clip-path` and the `--lit` custom property animate.
- Readability: panel descriptions 13px at the 1440 frame, line height 1.7, white at 96%; card and indicator text 13px.
- Reduced motion: no pin, no scrub; four still screens, fully open.
- Pinned scroll is not counted toward the 8-screen cap; what is seen must stay ≤ 8 screens.
- Script URLs: `https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js` and `.../3.12.5/ScrollTrigger.min.js`, exact.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Fast flick across several chapters** (trackpad fling from the top of the story to its end): the replica must come to rest on one chapter only, fully settled, with no half-faded chapter left behind. Test in Task 4.
2. **Reload mid-story** (scroll restored by the browser): the replica must open directly on the right chapter and beat without replaying every handover in between. Test in Task 4.
3. **Clicking the chapter bar while a handover is running** (impatient double click on two chapters): it must end on the last chapter clicked, cleanly. Test in Task 4.
4. **Hover or click a column, then keep scrolling**: the next beat takes over and opens its own column; the visitor's pick is not sticky across beats. Test in Task 3.
5. **The attack video not yet loaded** when its beat is reached (slow network, `duration` NaN): no errors, captions hidden, scrub resumes once metadata arrives. Test in Task 1 (`scrubTime` guard) and Task 5 (no console errors while scrubbing before `loadedmetadata`).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/case-studies/cyvore-story.ts` (create) | Pure story model: chapters, beats, weights, `beatAt`, `beatStart`, `firstBeatOf`, `chapterFill`, `STATS`, `formatStat`, `CAPTIONS`, `captionAt`, `scrubTime`. No DOM. |
| `src/lib/case-studies/cyvore-story.test.ts` (create) | Vitest unit tests for the model. |
| `docs/prototypes/cyvore-mockups/cyvore-story.js` (generated, committed) | The model compiled to an ES module for the board. |
| `docs/prototypes/cyvore-mockups/story-board.js` (create) | Board engine: binds columns, mounts each story (pin, beats, handovers, scrub, bar, static mode), test hook `window.__cyvoreStories`. |
| `docs/prototypes/cyvore-mockups.html` (modify) | Solution markup restructured into the story; What powers us; captions; readability; How it works without the mission block; phone story host. |
| `docs/prototypes/cyvore-mockups/cta-hover.mp4`, `cta-hover-poster.jpg` (create) | Shipped CTA hover clip for How it works. |
| `playwright.board.config.ts` (create) | Playwright config serving `docs/prototypes` on port 4323. |
| `e2e-board/cyvore-story.spec.ts` (create) | Board behaviour tests. |
| `package.json` (modify) | Scripts `build:board` and `test:board`. |

---

### Task 1: The story model

**Files:**
- Create: `src/lib/case-studies/cyvore-story.ts`
- Create: `src/lib/case-studies/cyvore-story.test.ts`
- Modify: `package.json` (scripts)
- Generate: `docs/prototypes/cyvore-mockups/cyvore-story.js`

**Interfaces:**
- Produces (exact names, used by Task 3–6 through `cyvore-story.js`):
  - `type ChapterId = "why" | "risk" | "attack" | "powers"`
  - `CHAPTERS: readonly ChapterId[]` = `["why","risk","attack","powers"]`
  - `interface Beat { chapter: ChapterId; kind: "arrive"|"open"|"handover"|"scrub"|"build"|"release"; panel: number | null; weight: number }`
  - `BEATS: readonly Beat[]` (12 beats), `TOTAL_WEIGHT: number` (15)
  - `beatAt(progress: number): { beat: number; within: number }`
  - `beatStart(beat: number): number` (0–1)
  - `firstBeatOf(chapter: ChapterId): number`
  - `chapterFill(beat: number, within: number): Record<ChapterId, number>`
  - `interface Stat { value: number; suffix: "%" | "B" }`, `STATS: readonly Stat[]`, `formatStat(stat: Stat, t: number): string`
  - `ATTACK_TRIM = 0.9`, `CAPTION_AT = [3.2, 4.4, 6.7]`, `CAPTIONS`, `captionAt(clipSeconds: number): number` (−1 before the first)
  - `scrubTime(within: number, clipDuration: number): number`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/case-studies/cyvore-story.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import {
  ATTACK_TRIM,
  BEATS,
  CAPTIONS,
  CHAPTERS,
  STATS,
  TOTAL_WEIGHT,
  beatAt,
  beatStart,
  captionAt,
  chapterFill,
  firstBeatOf,
  formatStat,
  scrubTime,
} from "./cyvore-story";

describe("beats", () => {
  test("twelve beats, chapters in story order", () => {
    expect(BEATS).toHaveLength(12);
    const order = BEATS.map((b) => b.chapter).filter((c, i, a) => a.indexOf(c) === i);
    expect(order).toEqual(["why", "risk", "attack", "powers"]);
    expect(CHAPTERS).toEqual(order);
  });

  test("why arrives closed, then opens its four columns in order", () => {
    expect(BEATS.slice(0, 5).map((b) => [b.kind, b.panel])).toEqual([
      ["arrive", null], ["open", 0], ["open", 1], ["open", 2], ["open", 3],
    ]);
  });

  test("risk opens its first statistic with the handover, then the rest in order", () => {
    expect(BEATS.slice(5, 9).map((b) => [b.kind, b.panel])).toEqual([
      ["handover", 0], ["open", 1], ["open", 2], ["open", 3],
    ]);
  });

  test("attack is scrubbed, powers builds, then the story releases", () => {
    expect(BEATS.slice(9).map((b) => [b.chapter, b.kind])).toEqual([
      ["attack", "scrub"], ["powers", "build"], ["powers", "release"],
    ]);
  });

  test("the attack beat is three units long so the video has room to scrub", () => {
    expect(BEATS[9].weight).toBe(3);
    expect(TOTAL_WEIGHT).toBe(15);
  });
});

describe("beatAt", () => {
  test("start and end of the pinned range", () => {
    expect(beatAt(0)).toEqual({ beat: 0, within: 0 });
    expect(beatAt(1)).toEqual({ beat: 11, within: 1 });
  });

  test("clamps progress outside 0–1", () => {
    expect(beatAt(-0.2).beat).toBe(0);
    expect(beatAt(1.4).beat).toBe(11);
  });

  test("halfway through the weighted attack beat", () => {
    const at = beatAt(beatStart(9) + 1.5 / 15);
    expect(at.beat).toBe(9);
    expect(at.within).toBeCloseTo(0.5);
  });

  test("every beat's start lands inside that beat", () => {
    for (let b = 0; b < BEATS.length; b++) expect(beatAt(beatStart(b) + 1e-6).beat).toBe(b);
  });
});

describe("chapters", () => {
  test("first beat of each chapter", () => {
    expect(CHAPTERS.map(firstBeatOf)).toEqual([0, 5, 9, 10]);
  });

  test("fill: past chapters full, future empty, current partial", () => {
    expect(chapterFill(6, 0.5)).toEqual({ why: 1, risk: 0.375, attack: 0, powers: 0 });
  });

  test("fill at the very end is complete everywhere", () => {
    expect(chapterFill(11, 1)).toEqual({ why: 1, risk: 1, attack: 1, powers: 1 });
  });
});

describe("stats", () => {
  test("formatted exactly like the site", () => {
    expect(STATS.map((s) => formatStat(s, 1))).toEqual(["2,535%", "83%", "967%", "15B"]);
  });

  test("count from zero", () => {
    expect(formatStat(STATS[0], 0)).toBe("0%");
  });

  test("eased: well past half the value at the time midpoint", () => {
    expect(parseInt(formatStat(STATS[1], 0.5), 10)).toBeGreaterThan(41);
  });
});

describe("attack", () => {
  test("captions appear at the recording's moments, in order", () => {
    expect(captionAt(0)).toBe(-1);
    expect(captionAt(3.2 - ATTACK_TRIM)).toBe(0);
    expect(captionAt(4.4 - ATTACK_TRIM)).toBe(1);
    expect(captionAt(6.7 - ATTACK_TRIM)).toBe(2);
    expect(CAPTIONS).toEqual(["A link lands in the call.", "Cyvore reads it.", "Blocked."]);
  });

  test("scrub reaches the end at 85% and holds the last frame", () => {
    expect(scrubTime(0, 7.6)).toBe(0);
    expect(scrubTime(0.85, 7.6)).toBeCloseTo(7.55);
    expect(scrubTime(1, 7.6)).toBeCloseTo(7.55);
  });

  test("scrub before the video has loaded stays at 0", () => {
    expect(scrubTime(0.5, NaN)).toBe(0);
    expect(scrubTime(0.5, 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/lib/case-studies/cyvore-story.test.ts`
Expected: FAIL, "Failed to resolve import ./cyvore-story".

- [ ] **Step 3: Write the model**

Create `src/lib/case-studies/cyvore-story.ts`:

```ts
/**
 * The Cyvore case study's story replica, as rules with no DOM.
 *
 * Scroll picks the beat; the beat plays itself. Only the attack video follows
 * the scroll. The board compiles this file to docs/prototypes/cyvore-mockups/
 * cyvore-story.js (npm run build:board); Part C imports it directly.
 * Spec: docs/superpowers/specs/2026-10-10-cyvore-story-replica-design.md
 */

export type ChapterId = "why" | "risk" | "attack" | "powers";

export const CHAPTERS: readonly ChapterId[] = ["why", "risk", "attack", "powers"];

export interface Beat {
  readonly chapter: ChapterId;
  readonly kind: "arrive" | "open" | "handover" | "scrub" | "build" | "release";
  /** The column (or statistic) this beat opens; null when it opens none. */
  readonly panel: number | null;
  /** Share of the pinned scroll. One unit is about a third of a screen. */
  readonly weight: number;
}

export const BEATS: readonly Beat[] = [
  { chapter: "why", kind: "arrive", panel: null, weight: 1 },
  { chapter: "why", kind: "open", panel: 0, weight: 1 },
  { chapter: "why", kind: "open", panel: 1, weight: 1 },
  { chapter: "why", kind: "open", panel: 2, weight: 1 },
  { chapter: "why", kind: "open", panel: 3, weight: 1 },
  { chapter: "risk", kind: "handover", panel: 0, weight: 1 },
  { chapter: "risk", kind: "open", panel: 1, weight: 1 },
  { chapter: "risk", kind: "open", panel: 2, weight: 1 },
  { chapter: "risk", kind: "open", panel: 3, weight: 1 },
  // Three units: 7.6 seconds of video needs room to be scrubbed at a readable pace.
  { chapter: "attack", kind: "scrub", panel: null, weight: 3 },
  { chapter: "powers", kind: "build", panel: null, weight: 2 },
  { chapter: "powers", kind: "release", panel: null, weight: 1 },
];

export const TOTAL_WEIGHT = BEATS.reduce((sum, b) => sum + b.weight, 0);

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

/** The beat a 0–1 progress through the pinned range falls in, and how far into it. */
export function beatAt(progress: number): { beat: number; within: number } {
  const p = clamp01(progress) * TOTAL_WEIGHT;
  let start = 0;
  for (let i = 0; i < BEATS.length; i++) {
    const end = start + BEATS[i].weight;
    if (p < end || i === BEATS.length - 1) {
      return { beat: i, within: clamp01((p - start) / BEATS[i].weight) };
    }
    start = end;
  }
  return { beat: BEATS.length - 1, within: 1 };
}

/** Where a beat starts, as 0–1 progress through the pinned range. */
export function beatStart(beat: number): number {
  let units = 0;
  for (let i = 0; i < beat; i++) units += BEATS[i].weight;
  return units / TOTAL_WEIGHT;
}

export function firstBeatOf(chapter: ChapterId): number {
  return BEATS.findIndex((b) => b.chapter === chapter);
}

/** How full each chapter's progress line is, 0–1. */
export function chapterFill(beat: number, within: number): Record<ChapterId, number> {
  const fill = { why: 0, risk: 0, attack: 0, powers: 0 } as Record<ChapterId, number>;
  for (const ch of CHAPTERS) {
    const own = BEATS.flatMap((b, i) => (b.chapter === ch ? [i] : []));
    const first = own[0];
    const last = own[own.length - 1];
    if (beat > last) fill[ch] = 1;
    else if (beat >= first) {
      const total = own.reduce((s, i) => s + BEATS[i].weight, 0);
      const done = own.reduce((s, i) => s + (i < beat ? BEATS[i].weight : 0), 0) + BEATS[beat].weight * within;
      fill[ch] = done / total;
    }
  }
  return fill;
}

export interface Stat {
  readonly value: number;
  readonly suffix: "%" | "B";
}

/** The risk is real, as on the live site. */
export const STATS: readonly Stat[] = [
  { value: 2535, suffix: "%" },
  { value: 83, suffix: "%" },
  { value: 967, suffix: "%" },
  { value: 15, suffix: "B" },
];

const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);

/** A statistic part-way through its count-up (t from 0 to 1). */
export function formatStat(stat: Stat, t: number): string {
  return Math.round(stat.value * easeOutCubic(t)).toLocaleString("en-US") + stat.suffix;
}

/** The board's clip starts this far into the original recording; its opening is black. */
export const ATTACK_TRIM = 0.9;

/** When each caption starts, in seconds of the original recording (checked frame by frame). */
export const CAPTION_AT = [3.2, 4.4, 6.7] as const;

export const CAPTIONS = ["A link lands in the call.", "Cyvore reads it.", "Blocked."] as const;

/** The caption showing at a moment of the trimmed clip; −1 before the first. */
export function captionAt(clipSeconds: number): number {
  const t = clipSeconds + ATTACK_TRIM;
  let shown = -1;
  CAPTION_AT.forEach((at, i) => {
    if (t >= at) shown = i;
  });
  return shown;
}

/**
 * Scroll position within the attack beat → seconds into the clip. The clip
 * reaches its end at 85% of the beat and holds there, so the BLOCK frame is
 * seen before the story moves on. Stays at 0 until the video's length is known.
 */
export function scrubTime(within: number, clipDuration: number): number {
  if (!Number.isFinite(clipDuration) || clipDuration <= 0) return 0;
  const end = Math.max(clipDuration - 0.05, 0);
  return Math.min(clamp01(within) / 0.85, 1) * end;
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run src/lib/case-studies/cyvore-story.test.ts`
Expected: PASS, 18 tests.

- [ ] **Step 5: Add the board build and test scripts**

In `package.json` `"scripts"`, add after `"test:e2e"`:

```json
    "build:board": "tsc src/lib/case-studies/cyvore-story.ts --target es2020 --module es2020 --lib es2020,dom --skipLibCheck --outDir docs/prototypes/cyvore-mockups",
    "test:board": "npm run build:board && playwright test -c playwright.board.config.ts"
```

- [ ] **Step 6: Build and check the output**

Run: `npm run build:board && head -5 docs/prototypes/cyvore-mockups/cyvore-story.js && grep -c "export" docs/prototypes/cyvore-mockups/cyvore-story.js`
Expected: the file exists, starts with the doc comment, and has 13 or more `export` lines.

- [ ] **Step 7: Run the whole unit suite**

Run: `npx vitest run`
Expected: all suites pass (87 existing + 18 new).

- [ ] **Step 8: Commit**

```bash
git add src/lib/case-studies/cyvore-story.ts src/lib/case-studies/cyvore-story.test.ts package.json docs/prototypes/cyvore-mockups/cyvore-story.js
git commit -m "feat: Cyvore story model: beats, chapter fills, stat count-up, caption timing, scrub

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The story's markup and look (still, no motion yet)

**Files:**
- Create: `playwright.board.config.ts`
- Create: `e2e-board/cyvore-story.spec.ts`
- Modify: `docs/prototypes/cyvore-mockups.html` (CSS block "4 solution", `.frame`/`.f` overflow, Solution section HTML, old replica script)

**Interfaces:**
- Consumes: nothing from Task 1 at runtime yet.
- Produces (DOM contract used by Tasks 3–6):
  - `.story[data-story="desktop"] > .story-track > .story-pin > .site[data-replica]`
  - Inside `.site`: `.s-nav`, `.s-stage` (frame only), four `section.s-chapter[data-chapter="why|risk|attack|powers"]` each holding `.s-head` and `.s-body`, `.s-chapters` with four `button.chap[data-go]` each containing `i.chap-fill`, and `p.sr-only[data-where]`.
  - Columns: `.panels[role="tablist"]` with `button.pan[role="tab"][aria-label]`; risk stats carry `.stat-num[data-stat="0..3"]`.
  - Attack: `[data-chapter="attack"] video` (no `data-inview`, no autoplay) and `ol.s-caps > li` ×3.
  - Powers: `svg.wires`, `.engines > article.eng` ×3.

- [ ] **Step 1: Add the board Playwright config**

Create `playwright.board.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

// The mockup boards are static HTML; they don't need the Next.js build.
export default defineConfig({
  testDir: "./e2e-board",
  use: { baseURL: "http://localhost:4323" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1536, height: 960 } } },
  ],
  webServer: {
    command: "python3 -m http.server 4323 --bind 127.0.0.1 --directory docs/prototypes",
    url: "http://localhost:4323/cyvore-mockups.html",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
```

- [ ] **Step 2: Write the failing markup tests**

Create `e2e-board/cyvore-story.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";

const site = (page: Page) => page.locator('.story[data-story="desktop"] .site');

test.describe("markup", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/cyvore-mockups.html");
  });

  test("all four chapters of the shipped site are there", async ({ page }) => {
    for (const ch of ["why", "risk", "attack", "powers"]) {
      await expect(site(page).locator(`[data-chapter="${ch}"]`)).toHaveCount(1);
    }
    await expect(site(page).locator(".chap[data-go]")).toHaveText([
      "Why it matters", "The risk is real", "Real-world attack", "What powers us",
    ]);
  });

  test("What powers us uses the live site's words exactly", async ({ page }) => {
    const powers = site(page).locator('[data-chapter="powers"]');
    await expect(powers.locator("h4")).toHaveText("WHAT POWERS US");
    await expect(powers.locator(".s-head p")).toHaveText("Three proprietary engines");
    await expect(powers.locator(".eng h5")).toHaveText(["OPR", "TIAO", "DAN"]);
    await expect(powers.locator(".eng-x")).toHaveText([
      "(Optical Phishing Recognition)",
      "(Threat Intelligence Autonomous Operation)",
      "(Data Analysis NLU)",
    ]);
    await expect(powers.locator(".eng-d")).toHaveText([
      "AI driven visual phishing detection",
      "Proactive threat engine that mimics analyst behavior, catching Zero-Day threats before they are launched.",
      "Context-aware language model that understands behavioral patterns across human and AI agents.",
    ]);
  });

  test("the attack chapter carries the three approved captions and a paused video", async ({ page }) => {
    const attack = site(page).locator('[data-chapter="attack"]');
    await expect(attack.locator(".s-caps li")).toHaveText([
      "A link lands in the call.", "Cyvore reads it.", "Blocked.",
    ]);
    await expect(attack.locator("video")).not.toHaveAttribute("autoplay", /.*/);
    await expect(attack.locator("video")).not.toHaveAttribute("data-inview", /.*/);
  });

  test("panel text is readable: 13px at the 1440 frame", async ({ page }) => {
    const px = await page.evaluate(() => {
      const desc = document.querySelector('.story[data-story="desktop"] .pan-desc') as HTMLElement;
      const frame = desc.closest(".frame") as HTMLElement;
      return parseFloat(getComputedStyle(desc).fontSize) / (frame.getBoundingClientRect().width / 1440);
    });
    expect(px).toBeCloseTo(13, 0);
  });

  test("the pin can stick: sticky pin, frames clip instead of hiding overflow", async ({ page }) => {
    const styles = await page.evaluate(() => {
      const pin = document.querySelector('.story[data-story="desktop"] .story-pin') as HTMLElement;
      return {
        pin: getComputedStyle(pin).position,
        frame: getComputedStyle(pin.closest(".frame")!).overflow,
        f: getComputedStyle(pin.closest(".f")!).overflow,
      };
    });
    expect(styles).toEqual({ pin: "sticky", frame: "clip", f: "clip" });
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx playwright test -c playwright.board.config.ts -g markup`
Expected: FAIL (no `.story[data-story="desktop"]` yet).

- [ ] **Step 4: Let sticky work inside the board frames**

In `docs/prototypes/cyvore-mockups.html`, in the `.frame { … }` rule change `overflow: hidden;` to `overflow: clip;`, and in the `.f { … }` rule change `overflow: hidden;` to `overflow: clip;`. (`hidden` makes each frame a scroll container, which stops `position: sticky` from sticking to the page.)

- [ ] **Step 5: Replace the replica CSS**

Replace everything from the line `/* ------------------------------ 4 solution: the replica ------------------------------ */` up to, not including, `/* ------------------------------ 5 how it works ------------------------------ */` with:

```css
/* ------------------------------ 4 solution: the story replica ------------------------------ */
.solution { padding: calc(var(--u) * 112) 0 calc(var(--u) * 104); }
.sol-glow { position: absolute; left: 50%; top: calc(var(--u) * 760); width: calc(var(--u) * 1500); height: calc(var(--u) * 700); transform: translate(-50%, -50%); background: radial-gradient(closest-side, rgba(138,56,245,.22), rgba(138,56,245,0)); pointer-events: none; }
.story { position: relative; margin: calc(var(--u) * 72) calc(var(--u) * 72) 0; }
.story-track { position: relative; } /* height set by story-board.js: pin + the pinned scroll */
.story-pin { position: sticky; top: var(--pin-top, 24px); }
.rep-anno { display: flex; justify-content: space-between; margin-bottom: calc(var(--u) * 16); }
.rep-anno span { font: 400 calc(var(--u) * 12)/1 var(--mono); text-transform: uppercase; letter-spacing: .08em; color: var(--ink-3); display: flex; align-items: center; gap: calc(var(--u) * 10); }
.rep-anno span::before { content: ""; width: calc(var(--u) * 14); height: calc(var(--u) * 1); background: var(--ink-3); }
.sol-foot { margin-top: calc(var(--u) * 72); align-items: end; }
.sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

/* The site itself (Cyvore's own UI: Michroma, Iceland, Inter in the cards) */
.site { --s: var(--u); position: relative; height: calc(var(--s) * 776); border-radius: calc(var(--s) * 20); background: var(--site); overflow: hidden; box-shadow: 0 0 0 calc(var(--s) * 1) rgba(156,131,251,.18), 0 calc(var(--s) * 40) calc(var(--s) * 120) calc(var(--s) * -40) rgba(138,56,245,.45); font-family: var(--mich); color: #fff; }
.site::before { content: ""; position: absolute; left: 50%; top: calc(var(--s) * 300); width: calc(var(--s) * 1200); height: calc(var(--s) * 560); transform: translate(-50%, -50%); background: radial-gradient(closest-side, rgba(138,56,245,.42), rgba(138,56,245,0)); pointer-events: none; }
.s-nav { position: absolute; left: calc(var(--s) * 36); right: calc(var(--s) * 36); top: calc(var(--s) * 24); height: calc(var(--s) * 40); display: flex; align-items: center; justify-content: space-between; z-index: 4; }
.s-logo { display: flex; align-items: center; gap: calc(var(--s) * 8); font: 700 calc(var(--s) * 20)/1 var(--ui); letter-spacing: -.02em; }
.s-logo img { width: calc(var(--s) * 15); height: auto; }
.s-logo sup { font-size: .4em; font-weight: 500; margin-left: calc(var(--s) * 1); opacity: .7; }
.s-links { display: flex; gap: calc(var(--s) * 34); font-size: calc(var(--s) * 9); letter-spacing: .02em; color: rgba(255,255,255,.82); }
.s-cta { height: calc(var(--s) * 32); padding: 0 calc(var(--s) * 16); border-radius: calc(var(--s) * 999); display: inline-flex; align-items: center; font: 400 calc(var(--s) * 8.5)/1 var(--mich); letter-spacing: .04em; color: #111011; background: #fff; box-shadow: 0 0 calc(var(--s) * 18) rgba(156,131,251,.65); white-space: nowrap; }
.s-cta.ghost { background: transparent; color: #fff; box-shadow: inset 0 0 0 calc(var(--s) * 1) rgba(255,255,255,.55); }
/* the stage is only a frame: it never moves; chapters draw into it */
.s-stage { position: absolute; left: calc(var(--s) * 96); right: calc(var(--s) * 96); top: calc(var(--s) * 208); height: calc(var(--s) * 544); border-radius: calc(var(--s) * 18); background: #07060b; box-shadow: 0 0 0 calc(var(--s) * 1) rgba(156,131,251,.14), 0 0 calc(var(--s) * 60) rgba(138,56,245,.35); z-index: 1; }
.s-chapter { position: absolute; inset: 0; z-index: 2; opacity: 0; visibility: hidden; }
.s-chapter.is-on { opacity: 1; visibility: visible; }
.s-head { position: absolute; left: 0; right: 0; top: calc(var(--s) * 92); text-align: center; }
.s-head h4 { margin: 0; font: 400 calc(var(--s) * 24)/1.1 var(--mich); letter-spacing: .01em; }
.site .s-head p { margin: calc(var(--s) * 8) 0 0; font: 400 calc(var(--s) * 9)/1.4 var(--mich); color: rgba(255,255,255,.7); }
.s-btns { display: flex; justify-content: center; gap: calc(var(--s) * 10); margin-top: calc(var(--s) * 16); }
.s-body { position: absolute; left: calc(var(--s) * 112); right: calc(var(--s) * 112); top: calc(var(--s) * 224); bottom: calc(var(--s) * 112); }

/* columns: one opens, the rest stay as labelled columns */
.panels { display: flex; gap: calc(var(--s) * 14); height: 100%; }
.pan { position: relative; flex: 1 1 0; min-width: 0; min-height: 0; border: 0; padding: 0; margin: 0; border-radius: calc(var(--s) * 14); background: var(--tab); color: #fff; font: inherit; cursor: pointer; overflow: hidden; text-align: left;
  transition: flex-grow 560ms var(--settle), background-color 420ms var(--settle); -webkit-tap-highlight-color: transparent; }
.pan::before { content: ""; position: absolute; inset: 0; border-radius: inherit; background: radial-gradient(70% 70% at 50% 48%, #5a1fb8 0%, #6f29df 55%, #7f31f0 100%); opacity: 0; transition: opacity 420ms var(--settle); }
.pan[aria-selected="true"] { flex-grow: 3.3; cursor: default; }
.pan[aria-selected="true"]::before { opacity: 1; }
.pan:focus-visible { outline: calc(var(--s) * 2) solid #fff; outline-offset: calc(var(--s) * 3); }
.pan-name { position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); text-align: center; font: 400 calc(var(--s) * 13)/1 var(--mich); letter-spacing: .03em; white-space: nowrap; transition: opacity 260ms var(--settle); }
.pan[aria-selected="true"] .pan-name { opacity: 0; }
.pan-body { position: absolute; inset: 0; padding: calc(var(--s) * 28) calc(var(--s) * 30); display: flex; flex-direction: column; justify-content: flex-end; opacity: 0; transition: opacity 240ms var(--settle); pointer-events: none; }
.pan[aria-selected="true"] .pan-body { opacity: 1; transition: opacity 380ms var(--settle) 400ms; } /* after the column has mostly widened */
.pan-title { text-align: center; font: 400 calc(var(--s) * 24)/1 var(--mich); letter-spacing: .03em; text-shadow: 0 calc(var(--s) * 2) calc(var(--s) * 10) rgba(20,0,60,.45); white-space: nowrap; }
.pan-desc { margin-top: calc(var(--s) * 20); font: 400 calc(var(--s) * 13)/1.7 var(--mich); color: rgba(255,255,255,.96); max-width: 44ch; }
.pan-art { position: absolute; left: 0; right: 0; top: calc(var(--s) * 30); height: calc(var(--s) * 220); }
.pan .bit { opacity: 0; transform: translateY(calc(var(--s) * 14)) scale(.96); transition: opacity 420ms var(--settle), transform 520ms var(--settle); }
.pan[aria-selected="true"] .bit { opacity: 1; transform: none; transition-delay: calc(520ms + var(--d, 0) * 110ms); }
.card { position: absolute; width: calc(var(--s) * 214); padding: calc(var(--s) * 14) calc(var(--s) * 16); border-radius: calc(var(--s) * 12); background: linear-gradient(180deg, #fff, #f1ecfb); color: #2a2440; font: 400 calc(var(--s) * 13)/1.35 var(--ui); box-shadow: 0 calc(var(--s) * 10) calc(var(--s) * 24) rgba(30,0,80,.35); }
.card .ic { color: var(--v1); width: calc(var(--s) * 15); height: calc(var(--s) * 15); display: block; margin-bottom: calc(var(--s) * 10); }
.pan[aria-selected="true"] .card.bit { transform: rotate(var(--r, 0deg)); }
.chain { position: absolute; left: 50%; top: calc(var(--s) * 6); transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; }
.link { width: calc(var(--s) * 46); height: calc(var(--s) * 46); border-radius: 50%; display: grid; place-items: center; background: rgba(255,255,255,.28); color: #fff; margin-top: calc(var(--s) * -6); }
.link:first-child { border-radius: calc(var(--s) * 12) calc(var(--s) * 12) calc(var(--s) * 30) calc(var(--s) * 30); width: calc(var(--s) * 52); height: calc(var(--s) * 52); margin-top: 0; }
.link.last { background: #fff; color: var(--v1); box-shadow: 0 0 calc(var(--s) * 24) rgba(255,255,255,.35); }
.link .ic { width: calc(var(--s) * 18); height: calc(var(--s) * 18); }
.tiles { position: absolute; left: 50%; top: calc(var(--s) * 10); transform: translateX(-50%); display: grid; grid-template-columns: repeat(4, calc(var(--s) * 54)); gap: calc(var(--s) * 12); justify-items: center; }
.tile { width: calc(var(--s) * 54); height: calc(var(--s) * 54); border-radius: calc(var(--s) * 12); background: linear-gradient(180deg, #fff, #efe9fb); color: var(--v1); display: grid; place-items: center; font: 600 calc(var(--s) * 15)/1 var(--ui); box-shadow: 0 calc(var(--s) * 8) calc(var(--s) * 18) rgba(30,0,80,.28); }
.tile.word { font-size: calc(var(--s) * 10); letter-spacing: -.02em; }
.tile .ic { width: calc(var(--s) * 20); height: calc(var(--s) * 20); }
.plus { grid-column: 1 / -1; width: calc(var(--s) * 26); height: calc(var(--s) * 26); border-radius: 50%; background: rgba(255,255,255,.3); display: grid; place-items: center; margin-top: calc(var(--s) * 2); }
.plus .ic { width: calc(var(--s) * 14); height: calc(var(--s) * 14); }
.iocs { position: absolute; left: 50%; top: 0; transform: translateX(-50%); display: flex; flex-direction: column; gap: calc(var(--s) * 12); }
.ioc { display: flex; align-items: center; gap: calc(var(--s) * 14); width: calc(var(--s) * 270); padding: calc(var(--s) * 11) calc(var(--s) * 14); border-radius: calc(var(--s) * 14); background: rgba(255,255,255,.92); color: #2a2440; font: 400 calc(var(--s) * 13)/1.35 var(--ui); }
.ioc b { flex: none; width: calc(var(--s) * 32); height: calc(var(--s) * 32); border-radius: calc(var(--s) * 8); display: grid; place-items: center; background: #fff; color: var(--v1); font: 600 calc(var(--s) * 8.5)/1 var(--ui); box-shadow: 0 0 0 calc(var(--s) * 1) rgba(42,36,64,.08); }
.ioc b .ic { width: calc(var(--s) * 15); height: calc(var(--s) * 15); }
/* The risk is real: the same columns, numbers instead of pictures */
.pan.stat .pan-name { top: calc(var(--s) * 30); transform: none; left: calc(var(--s) * 20); text-align: left; font-size: calc(var(--s) * 15); }
.pan.stat .pan-body { justify-content: center; }
.stat-num { font: 400 calc(var(--s) * 34)/1 var(--mich); font-variant-numeric: tabular-nums; }
.stat-desc { margin-top: calc(var(--s) * 18); font: 400 calc(var(--s) * 13)/1.7 var(--mich); color: rgba(255,255,255,.96); max-width: 30ch; }
/* Real-world attack: the mission animation fills the stage; the captions sit under the heading */
.attack { position: absolute; inset: 0; }
.attack video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; mix-blend-mode: lighten; }
.s-caps { position: relative; height: calc(var(--s) * 18); margin: calc(var(--s) * 10) 0 0; padding: 0; list-style: none; font: 400 calc(var(--s) * 11)/1.6 var(--mich); color: rgba(255,255,255,.9); }
.s-caps li { position: absolute; left: 0; right: 0; opacity: 0; transform: translateY(calc(var(--s) * 6)); transition: opacity 300ms var(--settle), transform 300ms var(--settle); }
.s-caps li.is-on { opacity: 1; transform: none; }
/* What powers us: three engines on a dashed diagram */
.wires { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; clip-path: inset(0% 0% 100% 0%); }
.wires path { fill: none; stroke: rgba(156,131,251,.6); stroke-width: 1.2; stroke-dasharray: 6 6; vector-effect: non-scaling-stroke; }
.wires .node { fill: #9c83fb; }
.engines { position: absolute; left: 0; right: 0; top: 27.3%; height: 45.5%; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: calc(var(--s) * 24); padding: 0 calc(var(--s) * 24); }
.eng { --lit: 0; border-radius: calc(var(--s) * 16); background: rgba(26,18,48,.92); padding: calc(var(--s) * 24) calc(var(--s) * 22); opacity: calc(.25 + .75 * var(--lit));
  box-shadow: inset 0 0 0 calc(var(--s) * 1) rgba(156,131,251, calc(.14 + .32 * var(--lit))), 0 0 calc(var(--s) * 28) rgba(138,56,245, calc(.35 * var(--lit))); }
.eng h5 { margin: 0; font: 400 calc(var(--s) * 18)/1 var(--mich); letter-spacing: .02em; }
.site .eng-x { margin-top: calc(var(--s) * 10); font: 400 calc(var(--s) * 11.5)/1.6 var(--mich); color: rgba(255,255,255,.86); }
.site .eng-d { margin-top: calc(var(--s) * 16); font: 400 calc(var(--s) * 13)/1.7 var(--mich); color: rgba(255,255,255,.96); }
/* the second nav: chapters, always on screen; a line fills as the story moves */
.s-chapters { position: absolute; left: calc(var(--s) * 112); right: calc(var(--s) * 112); bottom: calc(var(--s) * 40); height: calc(var(--s) * 58); border-radius: calc(var(--s) * 14); background: #040306; display: grid; grid-template-columns: repeat(4, 1fr); gap: calc(var(--s) * 8); padding: calc(var(--s) * 7); z-index: 3; }
.chap { position: relative; border: 0; margin: 0; border-radius: calc(var(--s) * 10); background: transparent; color: rgba(255,255,255,.82); font: 400 calc(var(--s) * 13)/1 var(--ice); letter-spacing: .14em; text-transform: uppercase; cursor: pointer; box-shadow: inset 0 0 0 calc(var(--s) * 1) transparent; transition: background-color 320ms var(--settle), box-shadow 320ms var(--settle), color 320ms var(--settle); }
.chap:hover { color: #fff; background: rgba(255,255,255,.04); }
.chap[aria-selected="true"] { color: #fff; background: #170d2a; box-shadow: inset 0 0 0 calc(var(--s) * 1) var(--v1), 0 0 calc(var(--s) * 18) rgba(138,56,245,.35); }
.chap:focus-visible { outline: calc(var(--s) * 2) solid #fff; outline-offset: calc(var(--s) * 2); }
.chap-fill { position: absolute; left: calc(var(--s) * 14); right: calc(var(--s) * 14); bottom: calc(var(--s) * 7); height: calc(var(--s) * 2); border-radius: calc(var(--s) * 2); background: var(--v1); transform-origin: 0 50%; transform: scaleX(var(--fill, 0)); }
.chap[data-done] .chap-fill { opacity: .45; }
@media (prefers-reduced-motion: reduce) {
  .pan, .pan::before, .pan-name, .pan-body, .pan .bit, .chap, .s-caps li { transition: none !important; }
  .pan .bit { transform: none !important; }
}
/* reduced motion: four still screens, one under another */
.story.is-static .story-track { height: auto !important; }
.story.is-static .story-pin { position: static; display: flex; flex-direction: column; gap: calc(var(--u) * 32); }
.story.is-static .s-caps { height: auto; }
.story.is-static .s-caps li { position: static; opacity: 1; transform: none; }
```

- [ ] **Step 6: Replace the Solution section's replica HTML**

In the Solution section, replace the whole `<div class="rep-wrap"> … </div>` block (from `<div class="rep-wrap">` to the `</div>` just before `<div class="g12 sol-foot">`) with:

```html
    <div class="story" data-story="desktop">
      <div class="story-track">
        <div class="story-pin">
          <div class="rep-anno"><span>Scroll: the story plays</span><span>Hover or click: explore · bar: jump</span></div>
          <div class="site" data-replica>
            <div class="s-nav">
              <div class="s-logo"><img src="cyvore-mockups/logo-mark.svg" alt="">cyvore<sup>TM</sup></div>
              <div class="s-links"><span>Technology</span><span>Solutions</span><span>Resources</span><span>About Us</span><span>Contact</span></div>
              <span class="s-cta">REQUEST YOUR DEMO</span>
            </div>
            <div class="s-stage" aria-hidden="true"></div>

            <section class="s-chapter is-on" data-chapter="why" aria-label="Why it matters">
              <div class="s-head"><h4>SECURITY IN EVERY PART OF YOUR WORKPLACE</h4><div class="s-btns"><span class="s-cta">REQUEST YOUR DEMO</span><span class="s-cta ghost">ABOUT US</span></div></div>
              <div class="s-body">
                <div class="panels" role="tablist" aria-label="What Cyvore does">
                  <button class="pan" role="tab" aria-selected="false" aria-label="Security">
                    <span class="pan-name" aria-hidden="true">SECURITY</span>
                    <span class="pan-body">
                      <span class="pan-art" aria-hidden="true">
                        <span class="card bit" style="left:calc(50% + var(--s) * -124);top:0;--r:-1.5deg;--d:0"><svg class="ic"><use href="#i-user"/></svg>Got a business offer from WhatsApp Business</span>
                        <span class="card bit" style="left:calc(50% + var(--s) * -84);top:calc(var(--s) * 74);--r:3deg;--d:1"><svg class="ic"><use href="#i-mail"/></svg>Received a suspicious email</span>
                        <span class="card bit" style="left:calc(50% + var(--s) * -110);top:calc(var(--s) * 140);width:calc(var(--s) * 154);--r:-1deg;--d:2"><svg class="ic"><use href="#i-phone"/></svg>Called back to an unknown number</span>
                      </span>
                      <span class="pan-title">SECURITY</span>
                      <span class="pan-desc">Secures employee activity and AI agent operations, internally and externally.</span>
                    </span>
                  </button>
                  <button class="pan" role="tab" aria-selected="false" aria-label="Exposure">
                    <span class="pan-name" aria-hidden="true">EXPOSURE</span>
                    <span class="pan-body">
                      <span class="pan-art" aria-hidden="true"><span class="chain">
                        <span class="link bit" style="--d:0"><svg class="ic"><use href="#i-at"/></svg></span>
                        <span class="link bit" style="--d:1"><svg class="ic"><use href="#i-headphones"/></svg></span>
                        <span class="link bit" style="--d:2"><svg class="ic"><use href="#i-link-out"/></svg></span>
                        <span class="link last bit" style="--d:3"><svg class="ic"><use href="#i-pin"/></svg></span>
                      </span></span>
                      <span class="pan-title">EXPOSURE</span>
                      <span class="pan-desc">Exposes the complete chain of events to stop phishing and fraud.</span>
                    </span>
                  </button>
                  <button class="pan" role="tab" aria-selected="false" aria-label="Coverage">
                    <span class="pan-name" aria-hidden="true">COVERAGE</span>
                    <span class="pan-body">
                      <span class="pan-art" aria-hidden="true"><span class="tiles">
                        <span class="tile word bit" style="--d:0">zoom</span><span class="tile bit" style="--d:1">T</span><span class="tile bit" style="--d:2">#</span><span class="tile bit" style="--d:3"><svg class="ic"><use href="#i-chat"/></svg></span>
                        <span class="tile bit" style="--d:4">M</span><span class="tile bit" style="--d:5"><svg class="ic"><use href="#i-cloud"/></svg></span><span class="tile bit" style="--d:6">O</span><span class="tile bit" style="--d:7">G</span>
                        <span class="plus bit" style="--d:8"><svg class="ic"><use href="#i-plus"/></svg></span>
                      </span></span>
                      <span class="pan-title">COVERAGE</span>
                      <span class="pan-desc">Covers Zoom, Teams, Slack, WhatsApp Business, email, CRM systems, and beyond.</span>
                    </span>
                  </button>
                  <button class="pan" role="tab" aria-selected="false" aria-label="Enables">
                    <span class="pan-name" aria-hidden="true">ENABLES</span>
                    <span class="pan-body">
                      <span class="pan-art" aria-hidden="true"><span class="iocs">
                        <span class="ioc bit" style="--d:0"><b>zoom</b>Manipulation behavior during zoom call</span>
                        <span class="ioc bit" style="--d:1"><b><svg class="ic"><use href="#i-user"/></svg></b>AI image of company representative</span>
                        <span class="ioc bit" style="--d:2"><b><svg class="ic"><use href="#i-mail"/></svg></b>New business inquiry via email</span>
                      </span></span>
                      <span class="pan-title">ENABLES</span>
                      <span class="pan-desc">Enables precise investigation of every Indicator of Compromise (IOC).</span>
                    </span>
                  </button>
                </div>
              </div>
            </section>

            <section class="s-chapter" data-chapter="risk" aria-label="The risk is real">
              <div class="s-head"><h4>THE RISK IS REAL</h4><p>The numbers you need to see</p></div>
              <div class="s-body">
                <div class="panels" role="tablist" aria-label="The numbers">
                  <button class="pan stat" role="tab" aria-selected="false" aria-label="2,535%"><span class="pan-name" aria-hidden="true">2,535%</span><span class="pan-body"><span class="stat-num bit" data-stat="0" style="--d:0">2,535%</span><span class="stat-desc bit" style="--d:1">Increase in malicious phishing messages from Q4 2022</span></span></button>
                  <button class="pan stat" role="tab" aria-selected="false" aria-label="83%"><span class="pan-name" aria-hidden="true">83%</span><span class="pan-body"><span class="stat-num bit" data-stat="1" style="--d:0">83%</span><span class="stat-desc bit" style="--d:1">Cybersecurity professionals polled reported being targets of phishing attacks</span></span></button>
                  <button class="pan stat" role="tab" aria-selected="false" aria-label="967%"><span class="pan-name" aria-hidden="true">967%</span><span class="pan-body"><span class="stat-num bit" data-stat="2" style="--d:0">967%</span><span class="stat-desc bit" style="--d:1">Increase in credential phishing from Q4 2022</span></span></button>
                  <button class="pan stat" role="tab" aria-selected="false" aria-label="15B"><span class="pan-name" aria-hidden="true">15B</span><span class="pan-body"><span class="stat-num bit" data-stat="3" style="--d:0">15B</span><span class="stat-desc bit" style="--d:1">Cyberattacks are launched every single day</span></span></button>
                </div>
              </div>
            </section>

            <section class="s-chapter" data-chapter="attack" aria-label="Real-world attack">
              <div class="s-head"><h4>REAL-WORLD ATTACK</h4><ol class="s-caps"><li>A link lands in the call.</li><li>Cyvore reads it.</li><li>Blocked.</li></ol></div>
              <div class="s-body"><div class="attack"><video src="cyvore-mockups/mission.mp4" poster="cyvore-mockups/mission-poster.jpg" muted playsinline preload="auto" aria-label="A phishing link lands in a video call; the security bot flags it and Cyvore blocks it"></video></div></div>
            </section>

            <section class="s-chapter" data-chapter="powers" aria-label="What powers us">
              <div class="s-head"><h4>WHAT POWERS US</h4><p>Three proprietary engines</p></div>
              <div class="s-body">
                <svg class="wires" viewBox="0 0 1052 440" preserveAspectRatio="none" aria-hidden="true">
                  <circle class="node" cx="526" cy="18" r="4"/>
                  <path d="M526 22 V70"/>
                  <path d="M526 70 C526 96 183 92 183 120"/>
                  <path d="M526 70 V120"/>
                  <path d="M526 70 C526 96 869 92 869 120"/>
                  <path d="M183 320 C183 352 526 348 526 392"/>
                  <path d="M526 320 V392"/>
                  <path d="M869 320 C869 352 526 348 526 392"/>
                  <path d="M520 398 L526 406 L532 398"/>
                </svg>
                <div class="engines">
                  <article class="eng"><h5>OPR</h5><p class="eng-x">(Optical Phishing Recognition)</p><p class="eng-d">AI driven visual phishing detection</p></article>
                  <article class="eng"><h5>TIAO</h5><p class="eng-x">(Threat Intelligence Autonomous Operation)</p><p class="eng-d">Proactive threat engine that mimics analyst behavior, catching Zero-Day threats before they are launched.</p></article>
                  <article class="eng"><h5>DAN</h5><p class="eng-x">(Data Analysis NLU)</p><p class="eng-d">Context-aware language model that understands behavioral patterns across human and AI agents.</p></article>
                </div>
              </div>
            </section>

            <div class="s-chapters" role="tablist" aria-label="Chapters">
              <button class="chap" role="tab" aria-selected="true" data-go="why"><i class="chap-fill" aria-hidden="true"></i>Why it matters</button>
              <button class="chap" role="tab" aria-selected="false" data-go="risk"><i class="chap-fill" aria-hidden="true"></i>The risk is real</button>
              <button class="chap" role="tab" aria-selected="false" data-go="attack"><i class="chap-fill" aria-hidden="true"></i>Real-world attack</button>
              <button class="chap" role="tab" aria-selected="false" data-go="powers"><i class="chap-fill" aria-hidden="true"></i>What powers us</button>
            </div>
            <p class="sr-only" data-where aria-live="polite">Chapter 1 of 4</p>
          </div>
        </div>
      </div>
    </div>
```

Also update the Solution caption line (the `.cap` above that frame) to:

```html
  <div class="cap"><span><b>04 · Solution</b> — the story: scroll plays it, hover or click explores, the bar jumps</span><span>~1.7 screens seen · pinned scroll not counted</span></div>
```

- [ ] **Step 7: Remove the old replica script**

Delete the whole second `<script>` block that begins with the comment `/* The replica: hover (mouse) or click/tap opens a column; arrows move between tabs.` and replace it with this smaller block (the in-view video player is still needed for the hero loops):

```html
<script>
/* Hero loops play only while on screen, and never under reduced motion. */
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    const v = en.target;
    if (en.isIntersecting && !reduce.matches) v.play().catch(() => {}); else v.pause();
  }), { threshold: 0.25 });
  document.querySelectorAll("video[data-inview]").forEach((v) => io.observe(v));
})();
</script>
```

- [ ] **Step 8: Run the markup tests**

Run: `npx playwright test -c playwright.board.config.ts -g markup`
Expected: PASS, 5 tests.

- [ ] **Step 9: Commit**

```bash
git add playwright.board.config.ts e2e-board/cyvore-story.spec.ts docs/prototypes/cyvore-mockups.html
git commit -m "feat(board): Cyvore story markup: four chapters with their own heads, What powers us, captions, readable panel text, sticky pin

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Scroll drives the beats

**Files:**
- Create: `docs/prototypes/cyvore-mockups/story-board.js`
- Modify: `docs/prototypes/cyvore-mockups.html` (script tags before `</body>`)
- Modify: `e2e-board/cyvore-story.spec.ts`

**Interfaces:**
- Consumes: Task 1 exports from `./cyvore-story.js`; Task 2's DOM contract.
- Produces: `window.__cyvoreStories[name]` with `state(): { beat:number; chapter:string; settled:boolean; visible:string[]; open:{why:number; risk:number}; fill:Record<string,number>; caption:number; lit:number[]; statText:string|null }` and `scrollToBeat(beat:number, within?:number): void`. Task 4–6 extend `story-board.js` in place; the hook's shape stays.

- [ ] **Step 1: Write the failing beat tests**

Append to `e2e-board/cyvore-story.spec.ts`:

```ts
type State = {
  beat: number; chapter: string; settled: boolean; visible: string[];
  open: { why: number; risk: number }; fill: Record<string, number>;
  caption: number; lit: number[]; statText: string | null;
};

const story = (page: Page, name = "desktop") => ({
  state: () => page.evaluate((n) => (window as any).__cyvoreStories[n].state(), name) as Promise<State>,
  go: async (beat: number, within = 0.5) => {
    await page.evaluate(([n, b, w]) => (window as any).__cyvoreStories[n].scrollToBeat(b, w), [name, beat, within] as const);
    await page.waitForFunction(([n, b]) => {
      const s = (window as any).__cyvoreStories[n].state();
      return s.beat === b && s.settled;
    }, [name, beat] as const);
  },
});

test.describe("beats", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/cyvore-mockups.html");
    await page.waitForFunction(() => (window as any).__cyvoreStories?.desktop);
  });

  test("the site arrives with every column closed", async ({ page }) => {
    await story(page).go(0, 0.5);
    const s = await story(page).state();
    expect(s.chapter).toBe("why");
    expect(s.open.why).toBe(-1);
  });

  test("each beat of Why it matters opens the next column", async ({ page }) => {
    for (const [beat, col] of [[1, 0], [2, 1], [3, 2], [4, 3]] as const) {
      await story(page).go(beat);
      expect((await story(page).state()).open.why).toBe(col);
    }
  });

  test("The risk is real opens its statistics in turn and counts each one up to its value", async ({ page }) => {
    await story(page).go(7);
    await page.waitForTimeout(1500);
    const s = await story(page).state();
    expect(s.chapter).toBe("risk");
    expect(s.open.risk).toBe(2);
    expect(s.statText).toBe("967%");
  });

  test("the bar fills with the story and marks finished chapters", async ({ page }) => {
    await story(page).go(6, 0.5);
    const s = await story(page).state();
    expect(s.fill.why).toBe(1);
    expect(s.fill.risk).toBeCloseTo(0.375, 2);
    expect(s.fill.attack).toBe(0);
    await expect(page.locator('.story[data-story="desktop"] .chap[data-go="why"]')).toHaveAttribute("data-done", "");
  });

  test("a column the visitor picks gives way to the next beat", async ({ page }) => {
    await story(page).go(2);
    await page.locator('.story[data-story="desktop"] [data-chapter="why"] .pan[aria-label="Enables"]').click();
    expect((await story(page).state()).open.why).toBe(3);
    await story(page).go(3);
    expect((await story(page).state()).open.why).toBe(2);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx playwright test -c playwright.board.config.ts -g beats`
Expected: FAIL, timeout waiting for `__cyvoreStories.desktop`.

- [ ] **Step 3: Write the engine (beats only; handovers snap for now)**

Create `docs/prototypes/cyvore-mockups/story-board.js`:

```js
/* Cyvore story replica on the mockup board.
   Scroll picks the beat; the beat plays itself. Only the attack video follows the scroll.
   Spec: docs/superpowers/specs/2026-10-10-cyvore-story-replica-design.md */
import {
  BEATS, CHAPTERS, TOTAL_WEIGHT, beatAt, beatStart, firstBeatOf, chapterFill,
  STATS, formatStat, captionAt, scrubTime,
} from "./cyvore-story.js";

const { gsap, ScrollTrigger } = window;
gsap.registerPlugin(ScrollTrigger);

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const SETTLE = "power3.out";
/** One weight unit of pinned scroll, as a share of the viewport height. */
const UNIT_VH = 0.33;

const chapterEl = (site, ch) => site.querySelector(`[data-chapter="${ch}"]`);
const listIn = (site, ch) => chapterEl(site, ch).querySelector('.panels[role="tablist"]');
const openIndex = (list) => [...list.querySelectorAll('[role="tab"]')].findIndex((t) => t.getAttribute("aria-selected") === "true");

/* ---------- columns ---------- */

function countUp(el, instant) {
  const stat = STATS[Number(el.dataset.stat)];
  gsap.killTweensOf(el);
  if (instant || reduce) { el.textContent = formatStat(stat, 1); return; }
  const o = { t: 0 };
  el.textContent = formatStat(stat, 0);
  // starts as the column finishes widening (the body fades in at 400ms)
  gsap.to(o, { t: 1, duration: 0.9, delay: 0.45, ease: "none", onUpdate: () => { el.textContent = formatStat(stat, o.t); } });
}

/** Opens column i (null closes all). Statistics count up as they open. */
export function openPanel(list, i, { instant = false } = {}) {
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  tabs.forEach((t, k) => {
    t.setAttribute("aria-selected", String(k === i));
    t.tabIndex = k === (i ?? 0) ? 0 : -1;
  });
  if (i === null) return;
  const num = tabs[i].querySelector("[data-stat]");
  if (num) countUp(num, instant);
}

/** Hover (mouse only, after a beat), click/tap and arrow keys, as on the live site. */
export function bindPanels(root, { instant = false } = {}) {
  root.querySelectorAll('.panels[role="tablist"]').forEach((list) => {
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const vertical = !!list.closest(".is-phone");
    let timer = 0;
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => openPanel(list, i, { instant }));
      t.addEventListener("pointerenter", (e) => {
        if (e.pointerType !== "mouse") return;
        clearTimeout(timer);
        timer = setTimeout(() => openPanel(list, i, { instant }), reduce ? 0 : 90);
      });
      t.addEventListener("pointerleave", () => clearTimeout(timer));
      t.addEventListener("keydown", (e) => {
        const step = vertical ? { ArrowDown: 1, ArrowUp: -1 } : { ArrowRight: 1, ArrowLeft: -1 };
        let j = null;
        if (e.key in step) j = (i + step[e.key] + tabs.length) % tabs.length;
        if (e.key === "Home") j = 0;
        if (e.key === "End") j = tabs.length - 1;
        if (j === null) return;
        e.preventDefault();
        openPanel(list, j, { instant });
        tabs[j].focus();
      });
    });
  });
}

/* ---------- chapters ---------- */

function showOnly(site, ch) {
  CHAPTERS.forEach((c) => {
    const el = chapterEl(site, c);
    const on = c === ch;
    el.classList.toggle("is-on", on);
    el.inert = !on;
    gsap.set(el, { autoAlpha: on ? 1 : 0, y: 0 });
  });
}

function setBar(site, beat, within) {
  const fill = chapterFill(beat, within);
  const current = BEATS[beat].chapter;
  site.querySelectorAll(".chap[data-go]").forEach((c) => {
    const ch = c.dataset.go;
    c.setAttribute("aria-selected", String(ch === current));
    c.tabIndex = ch === current ? 0 : -1;
    c.style.setProperty("--fill", fill[ch].toFixed(3));
    c.toggleAttribute("data-done", fill[ch] >= 1 && ch !== current);
  });
  return fill;
}

/* ---------- a story ---------- */

export function mountStory(story, name) {
  const track = story.querySelector(".story-track");
  const pin = story.querySelector(".story-pin");
  const site = story.querySelector(".site");
  const where = site.querySelector("[data-where]");

  let beat = -1;
  let chapter = null;
  let settled = true;
  let fill = chapterFill(0, 0);

  const pinTop = () => Math.max(16, (innerHeight - pin.offsetHeight) / 2);
  const layout = () => {
    story.style.setProperty("--pin-top", `${pinTop()}px`);
    track.style.height = `${pin.offsetHeight + TOTAL_WEIGHT * UNIT_VH * innerHeight}px`;
  };
  layout();

  const applyBeat = (b, instant) => {
    const B = BEATS[b];
    if (B.chapter === "why" || B.chapter === "risk") openPanel(listIn(site, B.chapter), B.panel, { instant });
  };

  const goTo = (b, dir, instant = false) => {
    const next = BEATS[b].chapter;
    if (next !== chapter) {
      chapter = next;
      where.textContent = `Chapter ${CHAPTERS.indexOf(next) + 1} of ${CHAPTERS.length}`;
      showOnly(site, next);
    }
    applyBeat(b, instant);
    beat = b;
  };

  const update = (progress, dir) => {
    const { beat: b, within } = beatAt(progress);
    if (b !== beat) goTo(b, dir || (b > beat ? 1 : -1));
    fill = setBar(site, b, within);
  };

  const st = ScrollTrigger.create({
    trigger: track,
    start: () => `top ${pinTop()}px`,
    end: () => `bottom ${pinTop() + pin.offsetHeight}px`,
    invalidateOnRefresh: true,
    onRefreshInit: layout,
    onUpdate: (self) => update(self.progress, self.direction),
  });

  bindPanels(site);

  // Land directly on wherever the page already is (a reload mid-story replays nothing).
  // Read from the scroll position itself: st.progress isn't trustworthy before the first update.
  const span = st.end - st.start;
  const first = beatAt(span > 0 ? (window.scrollY - st.start) / span : 0);
  goTo(first.beat, 1, true);
  fill = setBar(site, first.beat, first.within);

  const api = {
    state: () => {
      const risk = listIn(site, "risk");
      const openStat = risk.querySelectorAll('[role="tab"]')[openIndex(risk)];
      return {
        beat, chapter, settled, fill,
        visible: CHAPTERS.filter((c) => parseFloat(getComputedStyle(chapterEl(site, c)).opacity) > 0.01),
        open: { why: openIndex(listIn(site, "why")), risk: openIndex(risk) },
        caption: [...site.querySelectorAll('[data-chapter="attack"] .s-caps li')].findIndex((li) => li.classList.contains("is-on")),
        lit: [...site.querySelectorAll(".eng")].map((e) => parseFloat(getComputedStyle(e).getPropertyValue("--lit")) || 0),
        statText: openStat ? openStat.querySelector("[data-stat]").textContent : null,
      };
    },
    scrollToBeat: (b, within = 0.5) => {
      const p = beatStart(b) + (within * BEATS[b].weight) / TOTAL_WEIGHT;
      window.scrollTo(0, st.start + p * (st.end - st.start));
    },
  };
  (window.__cyvoreStories ||= {})[name] = api;
  return api;
}

/* ---------- boot ---------- */

function boot() {
  document.querySelectorAll(".story[data-story]").forEach((story) => mountStory(story, story.dataset.story));
  ScrollTrigger.refresh();
}

document.fonts.ready.then(boot);
```

- [ ] **Step 4: Load GSAP and the engine on the board**

In `docs/prototypes/cyvore-mockups.html`, just before `</body>`, add:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
<script type="module" src="cyvore-mockups/story-board.js"></script>
```

- [ ] **Step 5: Run the beat tests**

Run: `npx playwright test -c playwright.board.config.ts -g beats`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add docs/prototypes/cyvore-mockups/story-board.js docs/prototypes/cyvore-mockups.html e2e-board/cyvore-story.spec.ts
git commit -m "feat(board): Cyvore story: scroll picks the beat; columns open in turn, stats count up, the bar fills

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Clean handovers, the bar jumps

**Files:**
- Modify: `docs/prototypes/cyvore-mockups/story-board.js` (`goTo`, bar click)
- Modify: `e2e-board/cyvore-story.spec.ts`

**Interfaces:**
- Consumes: Task 3's `mountStory`, `showOnly`, `applyBeat`, `state()`.
- Produces: `goTo(b, dir, instant)` now animates chapter changes; `state().settled` is false while one runs.

- [ ] **Step 1: Write the failing handover tests**

Append to `e2e-board/cyvore-story.spec.ts`:

```ts
test.describe("handovers", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/cyvore-mockups.html");
    await page.waitForFunction(() => (window as any).__cyvoreStories?.desktop);
  });

  test("at rest, exactly one chapter is visible, and the others can't be reached", async ({ page }) => {
    for (const [beat, ch] of [[0, "why"], [5, "risk"], [9, "attack"], [10, "powers"]] as const) {
      await story(page).go(beat);
      expect((await story(page).state()).visible).toEqual([ch]);
      const inert = await page.$$eval('.story[data-story="desktop"] .s-chapter', (els) => els.map((e) => (e as HTMLElement).inert));
      expect(inert.filter((x) => !x)).toHaveLength(1);
    }
  });

  test("the outgoing chapter is gone before the next arrives, moving up when going forward", async ({ page }) => {
    await story(page).go(4);
    const samples = await page.evaluate(async () => {
      const api = (window as any).__cyvoreStories.desktop;
      const why = document.querySelector('.story[data-story="desktop"] [data-chapter="why"]') as HTMLElement;
      const risk = document.querySelector('.story[data-story="desktop"] [data-chapter="risk"]') as HTMLElement;
      api.scrollToBeat(5, 0.5);
      const out: { why: number; risk: number; whyY: number }[] = [];
      for (let i = 0; i < 24; i++) {
        await new Promise((r) => setTimeout(r, 40));
        out.push({
          why: parseFloat(getComputedStyle(why).opacity),
          risk: parseFloat(getComputedStyle(risk).opacity),
          whyY: new DOMMatrix(getComputedStyle(why).transform).m42,
        });
      }
      return out;
    });
    expect(samples.some((s) => s.why > 0.05 && s.risk > 0.05)).toBe(false);
    expect(samples.some((s) => s.whyY < -1)).toBe(true);
  });

  test("a fast flick to the end settles on What powers us alone", async ({ page }) => {
    await story(page).go(0);
    await page.evaluate(() => (window as any).__cyvoreStories.desktop.scrollToBeat(11, 0.5));
    await page.waitForFunction(() => (window as any).__cyvoreStories.desktop.state().settled);
    await page.waitForTimeout(600);
    expect((await story(page).state()).visible).toEqual(["powers"]);
  });

  test("clicking the bar jumps to that chapter; the last click wins", async ({ page }) => {
    const bar = page.locator('.story[data-story="desktop"] .chap');
    await story(page).go(0);
    await bar.filter({ hasText: "What powers us" }).click();
    await bar.filter({ hasText: "The risk is real" }).click();
    await page.waitForFunction(() => {
      const s = (window as any).__cyvoreStories.desktop.state();
      return s.chapter === "risk" && s.settled;
    }, null, { timeout: 5000 });
    await page.waitForTimeout(600);
    expect((await story(page).state()).visible).toEqual(["risk"]);
  });

  test("a reload mid-story opens on the right chapter without replaying the rest", async ({ page }) => {
    await story(page).go(9);
    const y = await page.evaluate(() => window.scrollY);
    await page.reload();
    await page.waitForFunction(() => (window as any).__cyvoreStories?.desktop);
    // The browser may restore the scroll before or after the story mounts; either way,
    // within one handover's time it must rest on the attack, alone.
    await page.evaluate((top) => { if (Math.abs(window.scrollY - top) > 2) window.scrollTo(0, top); }, y);
    await page.waitForFunction(() => {
      const s = (window as any).__cyvoreStories.desktop.state();
      return s.chapter === "attack" && s.settled;
    }, null, { timeout: 2000 });
    expect((await story(page).state()).visible).toEqual(["attack"]);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx playwright test -c playwright.board.config.ts -g handovers`
Expected: FAIL on "the outgoing chapter is gone before the next arrives" (Task 3 snaps, so `whyY` never goes below −1).

- [ ] **Step 3: Animate the handover**

In `story-board.js`, inside `mountStory`, add `let tl = null;` after `let settled = true;`, and replace the whole `goTo` function with:

```js
  const goTo = (b, dir, instant = false) => {
    const next = BEATS[b].chapter;
    if (next !== chapter) {
      const from = chapter;
      chapter = next;
      where.textContent = `Chapter ${CHAPTERS.indexOf(next) + 1} of ${CHAPTERS.length}`;
      // A new handover finishes the running one first, so chapters never stack up.
      if (tl) { tl.progress(1).kill(); tl = null; }
      if (!from || instant || reduce) {
        showOnly(site, next);
        applyBeat(b, true);
        settled = true;
      } else {
        settled = false;
        const out = chapterEl(site, from);
        const inn = chapterEl(site, next);
        const y = dir > 0 ? -16 : 16;
        CHAPTERS.forEach((c) => {
          if (c === from || c === next) return;
          const el = chapterEl(site, c);
          el.classList.remove("is-on");
          el.inert = true;
          gsap.set(el, { autoAlpha: 0, y: 0 });
        });
        out.inert = true;
        inn.inert = false;
        tl = gsap.timeline({ onComplete: () => { settled = true; tl = null; } })
          .to(out, { autoAlpha: 0, y, duration: 0.36, ease: "power2.in" })
          .call(() => { out.classList.remove("is-on"); gsap.set(out, { y: 0 }); inn.classList.add("is-on"); applyBeat(b, false); })
          .fromTo(inn, { autoAlpha: 0, y: -y }, { autoAlpha: 1, y: 0, duration: 0.52, ease: SETTLE });
      }
    } else {
      applyBeat(b, instant);
    }
    beat = b;
  };
```

- [ ] **Step 4: Make the bar jump**

In `mountStory`, after `bindPanels(site);`, add:

```js
  // The bar is the live site's chapter switch, and now also the story's index.
  site.querySelectorAll(".chap[data-go]").forEach((c) => {
    c.addEventListener("click", () => {
      const p = beatStart(firstBeatOf(c.dataset.go));
      window.scrollTo({ top: st.start + p * (st.end - st.start) + 2, behavior: reduce ? "auto" : "smooth" });
    });
  });
```

- [ ] **Step 5: Run the handover and beat tests**

Run: `npx playwright test -c playwright.board.config.ts -g "handovers|beats"`
Expected: PASS, 10 tests.

- [ ] **Step 6: Commit**

```bash
git add docs/prototypes/cyvore-mockups/story-board.js e2e-board/cyvore-story.spec.ts
git commit -m "feat(board): Cyvore story: chapters hand over cleanly in the direction of travel; the bar jumps

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The attack scrubs; the engines build

**Files:**
- Modify: `docs/prototypes/cyvore-mockups/story-board.js` (`powersTimeline`, attack scrub in `update`, `applyBeat`, reset on leaving)
- Modify: `e2e-board/cyvore-story.spec.ts`

**Interfaces:**
- Consumes: Task 1 `captionAt`, `scrubTime`; Task 4 `goTo`.
- Produces: `powersTimeline(site): gsap.core.Timeline` (paused; `progress(1)` = fully built), used again by Task 6's static mode.

- [ ] **Step 1: Write the failing tests**

Append to `e2e-board/cyvore-story.spec.ts`:

```ts
test.describe("attack and engines", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/cyvore-mockups.html");
    await page.waitForFunction(() => (window as any).__cyvoreStories?.desktop);
    await page.waitForFunction(() => {
      const v = document.querySelector('.story[data-story="desktop"] [data-chapter="attack"] video') as HTMLVideoElement;
      return v.readyState >= 1;
    });
  });

  test("the attack follows the scroll, captions in order", async ({ page }) => {
    const at = async (within: number) => {
      await story(page).go(9, within);
      await page.waitForTimeout(250);
      return page.evaluate(() => {
        const v = document.querySelector('.story[data-story="desktop"] [data-chapter="attack"] video') as HTMLVideoElement;
        return { t: v.currentTime, caption: (window as any).__cyvoreStories.desktop.state().caption };
      });
    };
    expect((await at(0.1)).caption).toBe(-1);
    const mid = await at(0.45);
    expect(mid.t).toBeGreaterThan(3.5);
    expect(mid.caption).toBe(1);
    expect((await at(0.95)).caption).toBe(2);
  });

  test("What powers us draws its diagram and lights the three engines in turn", async ({ page }) => {
    await story(page).go(10);
    await page.waitForTimeout(1600);
    const s = await story(page).state();
    expect(s.lit.map((x) => Math.round(x))).toEqual([1, 1, 1]);
    const clip = await page.$eval('.story[data-story="desktop"] .wires', (el) => getComputedStyle(el).clipPath);
    expect(clip).toMatch(/inset\(0(px|%)?\)|none/);
  });

  test("coming back to What powers us builds it again from the start", async ({ page }) => {
    await story(page).go(10);
    await page.waitForTimeout(1600);
    await story(page).go(9);
    await story(page).go(10);
    const early = (await story(page).state()).lit;
    expect(early.every((x) => x < 1)).toBe(true);
  });

  test("scrubbing before the video has loaded raises no errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.evaluate(() => {
      const v = document.querySelector('.story[data-story="desktop"] [data-chapter="attack"] video') as HTMLVideoElement;
      v.removeAttribute("src"); v.load();
    });
    await story(page).go(9, 0.5);
    expect(errors).toEqual([]);
    expect((await story(page).state()).caption).toBe(-1);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx playwright test -c playwright.board.config.ts -g "attack and engines"`
Expected: FAIL (video never moves, engines never light).

- [ ] **Step 3: Add the engines' build timeline**

In `story-board.js`, above `export function mountStory`, add:

```js
/** The diagram draws from the top node down, the engines light one by one, the lines meet below. */
export function powersTimeline(site) {
  const ch = chapterEl(site, "powers");
  const wires = ch.querySelector(".wires");
  const engines = [...ch.querySelectorAll(".eng")];
  gsap.set(wires, { clipPath: "inset(0% 0% 100% 0%)" });
  gsap.set(engines, { "--lit": 0 });
  return gsap.timeline({ paused: true })
    .to(wires, { clipPath: "inset(0% 0% 72% 0%)", duration: 0.35, ease: "none" })
    .to(engines, { "--lit": 1, duration: 0.3, stagger: 0.18, ease: "power1.out" })
    .to(wires, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.35, ease: "none" });
}
```

- [ ] **Step 4: Wire the attack and the engines into the story**

In `mountStory`:

a) After `const where = …`, add:

```js
  const powers = powersTimeline(site);
  const video = chapterEl(site, "attack").querySelector("video");
  const caps = [...chapterEl(site, "attack").querySelectorAll(".s-caps li")];
  const setCaption = (k) => caps.forEach((li, i) => li.classList.toggle("is-on", i === k));
  video.pause();
```

b) Replace `applyBeat` with:

```js
  const applyBeat = (b, instant) => {
    const B = BEATS[b];
    if (B.chapter === "why" || B.chapter === "risk") openPanel(listIn(site, B.chapter), B.panel, { instant });
    if (B.kind === "build") instant ? powers.progress(1) : powers.restart();
    if (B.kind === "release") powers.progress(1);
  };
```

c) In `goTo`, right after `const from = chapter;`, add:

```js
      // A chapter left behind starts fresh next time it is entered.
      if (from === "powers") powers.pause(0);
      if (from === "attack") setCaption(-1);
```

d) Replace `update` with:

```js
  const update = (progress, dir) => {
    const { beat: b, within } = beatAt(progress);
    if (b !== beat) goTo(b, dir || (b > beat ? 1 : -1));
    fill = setBar(site, b, within);
    if (BEATS[b].kind === "scrub") {
      const t = scrubTime(within, video.duration);
      if (video.readyState >= 1 && Math.abs(video.currentTime - t) > 0.03) video.currentTime = t;
      setCaption(video.readyState >= 1 ? captionAt(t) : -1);
    }
  };
```

e) After the `ScrollTrigger.create(...)` call, add (so a story already on the attack beat catches up once the video can seek):

```js
  video.addEventListener("loadedmetadata", () => update(st.progress, 0));
```

- [ ] **Step 5: Run the tests**

Run: `npx playwright test -c playwright.board.config.ts -g "attack and engines|handovers|beats"`
Expected: PASS, 14 tests.

- [ ] **Step 6: Commit**

```bash
git add docs/prototypes/cyvore-mockups/story-board.js e2e-board/cyvore-story.spec.ts
git commit -m "feat(board): Cyvore story: the attack follows the scroll with its captions; the three engines build in turn

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Reduced motion and the phone

**Files:**
- Modify: `docs/prototypes/cyvore-mockups/story-board.js` (`mountStatic`, phone clone in `boot`)
- Modify: `docs/prototypes/cyvore-mockups.html` (phone CSS, phone story host replacing `.m-site`, phone notes)
- Modify: `e2e-board/cyvore-story.spec.ts`

**Interfaces:**
- Consumes: `showOnly`, `openPanel`, `bindPanels`, `powersTimeline`, `listIn`, `chapterEl`.
- Produces: `mountStatic(story, name)`; `window.__cyvoreStories[name].state()` returns `{ static: true, copies: 4 }` in static mode. The phone story is `name = "phone"`.

- [ ] **Step 1: Write the failing tests**

Append to `e2e-board/cyvore-story.spec.ts`:

```ts
test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("four still screens, one per chapter, nothing pinned", async ({ page }) => {
    await page.goto("/cyvore-mockups.html");
    await page.waitForFunction(() => (window as any).__cyvoreStories?.desktop);
    const s = await page.evaluate(() => (window as any).__cyvoreStories.desktop.state());
    expect(s).toEqual({ static: true, copies: 4 });
    const story = page.locator('.story[data-story="desktop"]');
    await expect(story.locator(".site")).toHaveCount(4);
    expect(await story.locator(".story-pin").evaluate((el) => getComputedStyle(el).position)).toBe("static");
    await expect(story.locator('.site [data-chapter="risk"].is-on .stat-num').first()).toHaveText("2,535%");
    const lit = await story.locator('.site [data-chapter="powers"].is-on .eng').evaluateAll((els) =>
      els.map((e) => parseFloat(getComputedStyle(e).getPropertyValue("--lit"))));
    expect(lit).toEqual([1, 1, 1]);
    await expect(story.locator('.site [data-chapter="attack"].is-on .s-caps li')).toHaveCount(3);
  });
});

test.describe("phone", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/cyvore-mockups.html");
    await page.waitForFunction(() => (window as any).__cyvoreStories?.phone);
  });

  test("the phone tells the same story, stacked", async ({ page }) => {
    await story(page, "phone").go(3);
    expect((await story(page, "phone").state()).open.why).toBe(2);
    const dir = await page.$eval('.story[data-story="phone"] [data-chapter="why"] .panels', (el) => getComputedStyle(el).flexDirection);
    expect(dir).toBe("column");
    await story(page, "phone").go(5);
    expect((await story(page, "phone").state()).visible).toEqual(["risk"]);
  });

  test("the phone's chapter bar is a 2 × 2 grid of 44px-or-taller tabs", async ({ page }) => {
    const tabs = await page.$$eval('.story[data-story="phone"] .chap', (els) => els.map((e) => e.getBoundingClientRect().height));
    const frame = await page.$eval('.story[data-story="phone"]', (el) => el.closest(".frame")!.getBoundingClientRect().width / 390);
    expect(tabs).toHaveLength(4);
    for (const h of tabs) expect(h / frame).toBeGreaterThanOrEqual(44);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx playwright test -c playwright.board.config.ts -g "reduced motion|phone"`
Expected: FAIL (no static mode; no phone story).

- [ ] **Step 3: Add the static mode**

In `story-board.js`, above `/* ---------- boot ---------- */`, add:

```js
/** Reduced motion: no pin, no scrub. Four still copies of the site, each on its chapter, fully open. */
export function mountStatic(story, name) {
  const site = story.querySelector(".site");
  story.classList.add("is-static");
  const copies = CHAPTERS.map((ch, idx) => {
    const copy = site.cloneNode(true);
    showOnly(copy, ch);
    copy.querySelectorAll(".chap[data-go]").forEach((c) => {
      const on = c.dataset.go === ch;
      c.setAttribute("aria-selected", String(on));
      c.style.setProperty("--fill", on ? "1" : "0");
    });
    copy.querySelector("[data-where]").textContent = `Chapter ${idx + 1} of ${CHAPTERS.length}`;
    if (ch === "why" || ch === "risk") openPanel(listIn(copy, ch), 0, { instant: true });
    if (ch === "attack") copy.querySelectorAll(".s-caps li").forEach((li) => li.classList.add("is-on"));
    if (ch === "powers") powersTimeline(copy).progress(1);
    bindPanels(copy, { instant: true });
    return copy;
  });
  copies.forEach((copy) => copy.querySelectorAll(".chap[data-go]").forEach((c) => {
    c.addEventListener("click", () => copies[CHAPTERS.indexOf(c.dataset.go)].scrollIntoView({ block: "center" }));
  }));
  site.replaceWith(...copies);
  (window.__cyvoreStories ||= {})[name] = { state: () => ({ static: true, copies: copies.length }) };
}
```

- [ ] **Step 4: Clone the site into the phone, then mount everything**

Replace the `boot` function in `story-board.js` with:

```js
function boot() {
  const stories = [...document.querySelectorAll(".story[data-story]")];
  // The phone shows the same site: copy it in before anything mutates it.
  stories.filter((s) => s.dataset.clone).forEach((story) => {
    const src = document.querySelector(`.story[data-story="${story.dataset.clone}"] .site`);
    const copy = src.cloneNode(true);
    copy.classList.add("is-phone");
    story.querySelector(".story-pin").append(copy);
  });
  stories.forEach((story) => (reduce ? mountStatic : mountStory)(story, story.dataset.story));
  if (!reduce) ScrollTrigger.refresh();
}
```

- [ ] **Step 5: Put the phone story on the board**

In `docs/prototypes/cyvore-mockups.html`, inside `.m-sol`, replace the whole `<div class="m-site" data-replica> … </div>` block (the phone replica from v1) with:

```html
        <div class="story m-story" data-story="phone" data-clone="desktop">
          <div class="story-track"><div class="story-pin"></div></div>
        </div>
```

Delete the CSS lines from `/* phone replica: the same panels, stacked; one opens downward */` through `.m-site .chap { … }` inclusive, and add in their place:

```css
/* phone story: the same site, stacked; --s is a 390th of the phone frame */
.m-story { margin: calc(var(--u) * 28) 0 0; }
.site.is-phone { height: calc(var(--s) * 720); border-radius: calc(var(--s) * 18); }
.site.is-phone::before { top: calc(var(--s) * 260); width: calc(var(--s) * 420); height: calc(var(--s) * 420); }
.is-phone .s-nav { left: calc(var(--s) * 14); right: calc(var(--s) * 14); top: calc(var(--s) * 14); height: calc(var(--s) * 32); }
.is-phone .s-links, .is-phone .s-btns { display: none; }
.is-phone .s-logo { font-size: calc(var(--s) * 16); }
.is-phone .s-cta { height: calc(var(--s) * 28); padding: 0 calc(var(--s) * 10); font-size: calc(var(--s) * 7); }
.is-phone .s-head { top: calc(var(--s) * 64); padding: 0 calc(var(--s) * 14); }
.is-phone .s-head h4 { font-size: calc(var(--s) * 14); line-height: 1.25; }
.site.is-phone .s-head p, .is-phone .s-caps { font-size: calc(var(--s) * 9.5); }
.is-phone .s-stage { left: calc(var(--s) * 10); right: calc(var(--s) * 10); top: calc(var(--s) * 128); height: calc(var(--s) * 582); }
.is-phone .s-body { left: calc(var(--s) * 18); right: calc(var(--s) * 18); top: calc(var(--s) * 136); bottom: calc(var(--s) * 132); }
.is-phone .panels { flex-direction: column; gap: calc(var(--s) * 8); }
.is-phone .pan[aria-selected="true"] { flex-grow: 6; }
.is-phone .pan-name { font-size: calc(var(--s) * 11); }
.is-phone .pan-body { padding: calc(var(--s) * 16); }
.is-phone .pan-title { font-size: calc(var(--s) * 16); }
.is-phone .pan-desc { font-size: calc(var(--s) * 10.5); line-height: 1.6; margin-top: calc(var(--s) * 10); }
.is-phone .pan-art { top: calc(var(--s) * 10); transform: scale(.78); transform-origin: 50% 0; }
.is-phone .pan.stat .pan-name { top: 50%; transform: translateY(-50%); left: calc(var(--s) * 16); font-size: calc(var(--s) * 12); }
.is-phone .stat-num { font-size: calc(var(--s) * 26); }
.is-phone .stat-desc { font-size: calc(var(--s) * 10.5); }
.is-phone .wires { display: none; }
.is-phone .engines { top: 0; height: 100%; display: flex; flex-direction: column; gap: calc(var(--s) * 10); padding: 0; }
.is-phone .engines::before { content: ""; position: absolute; left: 50%; top: calc(var(--s) * -8); bottom: calc(var(--s) * -8); border-left: 1px dashed rgba(156,131,251,.5); z-index: -1; }
.is-phone .eng { flex: 1; padding: calc(var(--s) * 14) calc(var(--s) * 16); }
.is-phone .eng h5 { font-size: calc(var(--s) * 15); }
.site.is-phone .eng-x { font-size: calc(var(--s) * 9.5); }
.site.is-phone .eng-d { font-size: calc(var(--s) * 10.5); margin-top: calc(var(--s) * 8); }
.is-phone .s-chapters { left: calc(var(--s) * 18); right: calc(var(--s) * 18); bottom: calc(var(--s) * 18); height: auto; grid-template-columns: 1fr 1fr; grid-auto-rows: calc(var(--s) * 44); padding: calc(var(--s) * 6); gap: calc(var(--s) * 6); }
.is-phone .chap { font-size: calc(var(--s) * 11); letter-spacing: .1em; }
```

Replace the phone notes `<ol>` with:

```html
      <ol>
        <li>The hero keeps the same loop, full width, under the line.</li>
        <li>The story is the same twelve beats, pinned: columns become rows and open downward; the statistics stack the same way; the engines stack along a dashed line.</li>
        <li>The chapter bar sits under the stage as a 2 × 2 grid, each tab at least 44px tall, and still jumps.</li>
        <li>Reduced motion: four still screens, fully open, nothing pinned.</li>
      </ol>
```

- [ ] **Step 6: Run the tests**

Run: `npx playwright test -c playwright.board.config.ts`
Expected: PASS, all 22 board tests.

- [ ] **Step 7: Commit**

```bash
git add docs/prototypes/cyvore-mockups/story-board.js docs/prototypes/cyvore-mockups.html e2e-board/cyvore-story.spec.ts
git commit -m "feat(board): Cyvore story under reduced motion (four still screens) and on the phone (the same beats, stacked)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: How it works without the duplicate, and the final check

**Files:**
- Create: `docs/prototypes/cyvore-mockups/cta-hover.mp4`, `cta-hover-poster.jpg`
- Modify: `docs/prototypes/cyvore-mockups.html` (How it works section and its caption)
- Modify: `e2e-board/cyvore-story.spec.ts`

Note on the spec: §11 asked for "motion notes" here. Notes about handovers and the progress line would describe this portfolio's presentation, not the shipped site, so this task shows the shipped site's own motion instead: the real CTA hover clip, `public/case-studies/cyvore/cta-hero-hover.mp4`. The How it works text stays exactly as in `cyvore.mdx` (Liam: keep the sentence).

- [ ] **Step 1: Write the failing page tests**

Append to `e2e-board/cyvore-story.spec.ts`:

```ts
test.describe("page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/cyvore-mockups.html");
    await page.waitForFunction(() => (window as any).__cyvoreStories?.desktop);
  });

  test("How it works no longer repeats the attack video; it shows the shipped CTA motion", async ({ page }) => {
    const how = page.locator(".f.how");
    await expect(how.locator(".mission")).toHaveCount(0);
    await expect(how.locator('video[src$="cta-hover.mp4"]')).toHaveCount(1);
    await expect(how).toContainText("Motion with a job.");
    await expect(how).toContainText("A 7-second sequence tells the product's mission: a phishing link lands in a video call, and Cyvore blocks it.");
    await expect(how.locator(".ds")).toHaveCount(1);
  });

  test("what is seen stays within 8 screens (pinned scroll not counted)", async ({ page }) => {
    const screens = await page.evaluate(() => {
      const frames = [...document.querySelectorAll(".f")].filter((f) => !f.classList.contains("m") && !f.classList.contains("demo"));
      const u = frames[0].getBoundingClientRect().width / 1440;
      const track = document.querySelector('.story[data-story="desktop"] .story-track') as HTMLElement;
      const pin = document.querySelector('.story[data-story="desktop"] .story-pin') as HTMLElement;
      const total = frames.reduce((s, f) => s + f.getBoundingClientRect().height, 0) - (track.offsetHeight - pin.offsetHeight);
      return total / (900 * u);
    });
    expect(screens).toBeLessThanOrEqual(8);
  });

  test("no console errors while the whole story plays", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    for (let b = 0; b < 12; b++) await story(page).go(b);
    expect(errors).toEqual([]);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx playwright test -c playwright.board.config.ts -g page`
Expected: FAIL on "How it works no longer repeats the attack video" (`.mission` still present).

- [ ] **Step 3: Encode the CTA hover clip for the board**

Run:

```bash
ffmpeg -v error -y -i public/case-studies/cyvore/cta-hero-hover.mp4 -an -vf "crop=1200:260:600:120,scale=1200:-2" -c:v libx264 -crf 22 -preset slow -pix_fmt yuv420p -movflags +faststart docs/prototypes/cyvore-mockups/cta-hover.mp4
ffmpeg -v error -y -ss 1.5 -i docs/prototypes/cyvore-mockups/cta-hover.mp4 -frames:v 1 -q:v 3 docs/prototypes/cyvore-mockups/cta-hover-poster.jpg
```

Open `docs/prototypes/cyvore-mockups/cta-hover-poster.jpg` and confirm it shows the "WORKPLACE SECURITY" heading with the REQUEST YOUR DEMO and ABOUT US buttons, uncut. If the crop cuts them, adjust the `crop=w:h:x:y` values (source is 2400 × 1564; the buttons sit around y 150–330, centred at x 1200) and re-run both commands.

- [ ] **Step 4: Replace the mission block in How it works**

In `docs/prototypes/cyvore-mockups.html`, delete the whole `<div class="mission"> … </div>` block and put in its place:

```html
    <div class="cta-clip">
      <video data-inview src="cyvore-mockups/cta-hover.mp4" poster="cyvore-mockups/cta-hover-poster.jpg" muted loop playsinline aria-label="The main call to action on the shipped site: it glows after a delay, ripples on hover, fills on press"></video>
    </div>
```

In the CSS, replace the three rules `.mission { … }`, `.mission video { … }` and `.mission-cap { … }` with:

```css
.cta-clip { position: relative; margin: calc(var(--u) * 56) calc(var(--u) * 72) 0; border-radius: calc(var(--u) * 24); background: var(--panel); padding: calc(var(--u) * 28); box-shadow: inset 0 0 0 calc(var(--u) * 1) var(--hair); overflow: hidden; }
.cta-clip video { display: block; width: 100%; height: auto; border-radius: calc(var(--u) * 12); mix-blend-mode: lighten; }
```

Also, in the `/* the recording sits on pure black … */` rule, change `.mission video` to `.cta-clip video` so the selector list reads `.tray video, .m-tray video, .cta-clip video, .attack video`.

Update the How it works caption line to:

```html
  <div class="cap"><span><b>05 · How it works</b> — the shipped motion (the main CTA), then the design system as one strip; the attack now plays in the story</span><span>~1.1 screens · 1440 × ~1000</span></div>
```

- [ ] **Step 5: Run every board test and the unit suite**

Run: `npm run test:board && npx vitest run`
Expected: all board tests PASS (25) and all unit tests PASS.

- [ ] **Step 6: Look at it**

Run the board in the browser pane (server on 4322 serves this worktree's `docs/prototypes`): open `http://localhost:4322/cyvore-mockups.html`, emulate 1536 × 960, and scroll the Solution from top to bottom at normal speed, then back up. Check by eye, against spec §15: every beat lands; nothing overlaps; stopping mid-scroll always rests on a finished state; the bar fills in step; the captions read in order; the engines light one by one. Take one screenshot per chapter for the hand-off.

- [ ] **Step 7: Commit**

```bash
git add docs/prototypes/cyvore-mockups docs/prototypes/cyvore-mockups.html e2e-board/cyvore-story.spec.ts
git commit -m "feat(board): Cyvore How it works shows the shipped CTA motion; the attack lives in the story

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
