# Case Studies Implementation Plan (Part A: content, engine, page skeleton)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the approved case-study spec (`docs/superpowers/specs/2026-10-09-case-studies-design.md`) into working `/eventread`, `/cyvore` and `/pulse` pages whose content, frame rules and Eventread's scoring engine are built and tested, then hold for Liam's copy review and the visual design round.

**Architecture:** Each case study is one typed content object (shared blocks: hero, at a glance, challenges, outcome, screen budget) plus one MDX file for the project's own middle. A validator enforces the spec's rules (2–3 challenges, at least one non-engineering, ≤ 8 screens, no percentages of small samples) in a unit test, so a content edit that breaks the frame fails CI. One `CaseStudyPage` composes the shared blocks around the MDX middle. Components ship with correct semantics and minimal styling; their visual design comes from Part B.

**Tech Stack:** Next.js 16.3 (App Router, Turbopack; read `node_modules/next/dist/docs/` before writing Next code), React 19, `@next/mdx`, Tailwind 4, Geist + Geist Mono (`geist` package, already wired in `src/app/fonts.ts`), Vitest + Testing Library, Playwright.

**Quality bar:** moto-card.com / oryzo.ai / lusion.co. No shortcuts. Nothing is designed without a reference. Ask Liam before guessing.

---

## Ground rules for this plan

- **Another chat works in this repository at the same time** (the live sand prototype: `src/three/`, `src/app/lab/`, `blender/`, `scripts/lab/`, the storyboard, the home production plan). Never edit those paths. Never `git add -A` or `git commit -a`: every commit in this plan names its paths (`git commit -m "…" -- <paths>`), so the other chat's uncommitted work is never swept in.
- `npm install` (Task 1) changes `package.json` and `node_modules` under the other chat's running dev server. Ask Liam before running it.
- `npx playwright test` runs `npm run build`, which compiles the other chat's work in progress. If the build fails in `src/three/` or `src/app/lab/`, stop and tell Liam; do not fix their files.
- Copy in the content files is a **draft from the spec**. Nothing is final until Liam approves it line by line (Task 11).

## Scope

**Part A (this plan):** MDX, content model and validator, the three content files and MDX middles, the Danger Score engine, the shared-block components and page composer, e2e checks, the Eventread calendar capture, Liam's copy review, and the design round brief.

**Part B (after this plan):** visual design of every block in each project's world (references first, mockups reviewed by Liam).
**Part C (written after Part B is approved):** styling, the signature interactions (`DangerScore` UI, `CyvoreTabs`, `FlowSequence`, `BeforeAfter`), device-into-hero transition, mobile and reduced-motion versions, Lighthouse/a11y pass. Part C cannot be written with real code before the designs exist; that is a deliberate boundary, not a gap.

## File structure

| File | Responsibility |
|---|---|
| `src/lib/case-studies/types.ts` | The content model (types only) |
| `src/lib/case-studies/validate.ts` | Frame rules from spec §3 as a pure function |
| `src/lib/case-studies/validate.test.ts` | Rule tests on fixtures |
| `src/content/case-studies/eventread.ts`, `cyvore.ts`, `pulse.ts` | Shared-block content per study (draft copy) |
| `src/content/case-studies/index.ts` | Registry: slug → content + MDX middle |
| `src/content/case-studies/content.test.ts` | Every study passes the validator; registry matches live projects |
| `src/content/case-studies/eventread.mdx`, `cyvore.mdx`, `pulse.mdx` | Each project's own middle (problem, signature, supporting) |
| `src/lib/danger-score.ts` (+ `.test.ts`) | Port of Eventread's capacity × genre × timing engine and bands |
| `src/components/case-study/case-hero.tsx` (+ test) | Title, descriptor, line, link out |
| `src/components/case-study/at-a-glance.tsx` (+ test) | Role · Timeline · Team · Tools (· Type) |
| `src/components/case-study/middle-block.tsx` (+ test) | Labelled section wrapper used by the MDX middles |
| `src/components/case-study/challenge-list.tsx` (+ test) | "What got in the way" |
| `src/components/case-study/outcome.tsx` (+ test) | Outcome lines, optional quote and link |
| `src/components/case-study/next-project.tsx` (+ test) | Next case study in the loop |
| `src/components/case-study/case-study-page.tsx` (+ test) | Composes the frame around the middle |
| `src/mdx-components.tsx` | Required by `@next/mdx`; exposes `MiddleBlock` to MDX |
| `src/app/eventread/page.tsx`, `cyvore/page.tsx`, `pulse/page.tsx` | Routes (modify) |
| `next.config.ts` | Add MDX (modify) |
| `e2e/case-studies.spec.ts` | Frame present on every study, loop works |
| `scripts/capture/eventread-calendar.mjs` | Captures the hero calendar from the live app |

---

### Task 0: Confirm the JamBase line with Liam

Eventread replaced PredictHQ with JamBase on 2026-10-09 (commit `f2c172d` in `~/Documents/Eventread project/eventread`). The spec now reads "Ticketmaster for ticketed events, JamBase for everything else". JamBase is a concert database, so "everything else" may be wrong.

- [ ] **Step 1:** Ask Liam: "What does JamBase cover that Ticketmaster doesn't, in one line?" Use his words in `docs/superpowers/specs/2026-10-09-case-studies-design.md` §5.1 (Supporting row) and in Task 4's MDX.
- [ ] **Step 2: Commit**

```bash
git commit -m "docs: case-study spec: JamBase replaces PredictHQ" -- docs/superpowers/specs/2026-10-09-case-studies-design.md
```

### Task 1: MDX support

**Files:** Modify `package.json`, `next.config.ts`. Create `src/mdx-components.tsx`.

- [ ] **Step 1: Read** `node_modules/next/dist/docs/01-app/02-guides/mdx.md` (install, `pageExtensions`, `mdx-components.tsx` is required in App Router and lives in `src/` when `src/` is used).
- [ ] **Step 2: Ask Liam** whether the other chat is idle, then install:

```bash
npm install @next/mdx @mdx-js/loader @mdx-js/react @types/mdx
```

- [ ] **Step 3: Update `next.config.ts`**

```ts
import createMDX from "@next/mdx";
import type { NextConfig } from "next";
import { legacyRedirects } from "./src/lib/redirects";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  async redirects() {
    return legacyRedirects;
  },
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
```

- [ ] **Step 4: Create `src/mdx-components.tsx`** (the `MiddleBlock` import is created in Task 7; until then export an empty map and add it there)

```tsx
import type { MDXComponents } from "mdx/types";

const components: MDXComponents = {};

export function useMDXComponents(): MDXComponents {
  return components;
}
```

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: build succeeds; routes `/`, `/eventread`, `/cyvore`, `/pulse` listed.

- [ ] **Step 6: Commit**

```bash
git add src/mdx-components.tsx
git commit -m "build: MDX for case-study middles" -- package.json package-lock.json next.config.ts src/mdx-components.tsx
```

### Task 2: Content model

**Files:** Create `src/lib/case-studies/types.ts`.

- [ ] **Step 1: Write the types**

```ts
import type { ComponentType } from "react";

export type CaseSlug = "eventread" | "cyvore" | "pulse";

/** Spec §2: the eight blocks of the frame, in page order. */
export type BlockId =
  | "hero"
  | "atAGlance"
  | "problem"
  | "signature"
  | "supporting"
  | "challenges"
  | "outcome"
  | "next";

/** Engineering-only challenges are allowed, but never alone (spec §3.3). */
export type ChallengeKind = "design" | "user" | "stakeholder" | "engineering";

export interface Challenge {
  kind: ChallengeKind;
  title: string;
  /** What happened. */
  happened: string;
  /** What I did. */
  did: string;
  /** What it changed: a number or a concrete fact. */
  changed: string;
}

export interface AtAGlance {
  role: string;
  timeline: string;
  team: string;
  tools: readonly string[];
  /** Only where it explains the context (contract, course project). */
  type?: string;
}

export interface Quote {
  text: string;
  name: string;
  title: string;
}

export interface Outcome {
  lines: readonly string[];
  quote?: Quote;
  link?: { href: string; label: string };
}

export interface CaseStudy {
  slug: CaseSlug;
  title: string;
  descriptor: string;
  /** The one line approved for the home page. */
  line: string;
  liveUrl?: string;
  atAGlance: AtAGlance;
  challenges: readonly Challenge[];
  outcome: Outcome;
  /** Screens per block at 1440×900 (spec §2). */
  budget: Readonly<Record<BlockId, number>>;
}

export interface CaseStudyEntry {
  study: CaseStudy;
  Middle: ComponentType;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors from `src/lib/case-studies/`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/case-studies/types.ts
git commit -m "feat: case-study content model" -- src/lib/case-studies/types.ts
```

### Task 3: Frame validator

**Files:** Create `src/lib/case-studies/validate.ts`, `src/lib/case-studies/validate.test.ts`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, test } from "vitest";
import type { CaseStudy, Challenge } from "./types";
import { SCREEN_CAP, STANDARD_BUDGET, validateCaseStudy } from "./validate";

const design: Challenge = { kind: "design", title: "t", happened: "h", did: "d", changed: "c" };
const engineering: Challenge = { ...design, kind: "engineering" };

const base: CaseStudy = {
  slug: "pulse",
  title: "Pulse",
  descriptor: "Fitness app",
  line: "l",
  atAGlance: { role: "r", timeline: "t", team: "s", tools: ["Figma"] },
  challenges: [design, engineering],
  outcome: { lines: ["A tested prototype."] },
  budget: STANDARD_BUDGET,
};

describe("validateCaseStudy", () => {
  test("a study inside the frame has no problems", () => {
    expect(validateCaseStudy(base)).toEqual([]);
  });

  test("the standard budget fits the cap", () => {
    const total = Object.values(STANDARD_BUDGET).reduce((s, n) => s + n, 0);
    expect(total).toBeLessThanOrEqual(SCREEN_CAP);
  });

  test("rejects fewer than 2 or more than 3 challenges", () => {
    expect(validateCaseStudy({ ...base, challenges: [design] })).toContain("pulse: 1 challenges (2–3 allowed)");
    expect(validateCaseStudy({ ...base, challenges: [design, design, design, design] })).toContain(
      "pulse: 4 challenges (2–3 allowed)",
    );
  });

  test("rejects a challenges block that is engineering only", () => {
    expect(validateCaseStudy({ ...base, challenges: [engineering, engineering] })).toContain(
      "pulse: no design, user or stakeholder challenge",
    );
  });

  test("rejects a budget over the cap", () => {
    expect(validateCaseStudy({ ...base, budget: { ...STANDARD_BUDGET, signature: 3 } })).toContain(
      "pulse: 8.5 screens (cap 8)",
    );
  });

  test("rejects percentages of a small sample", () => {
    const problems = validateCaseStudy({
      ...base,
      outcome: { lines: ["80% of testers expected a goal step."] },
    });
    expect(problems).toContain('pulse: percentage of a small sample: "80% of testers expected a goal step."');
  });

  test("allows percentages that aren't about a sample of people", () => {
    const study = {
      ...base,
      challenges: [{ ...design, did: "About 95% of a month's shows are listed one month out." }, engineering],
    };
    expect(validateCaseStudy(study)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/lib/case-studies/validate.test.ts`
Expected: FAIL, cannot resolve `./validate`.

- [ ] **Step 3: Implement**

```ts
import type { BlockId, CaseStudy } from "./types";

/** Spec §3.1: about 8 screens at 1440×900. */
export const SCREEN_CAP = 8;

/** Spec §2. */
export const STANDARD_BUDGET: Readonly<Record<BlockId, number>> = {
  hero: 1,
  atAGlance: 0.3,
  problem: 1,
  signature: 2,
  supporting: 1,
  challenges: 1,
  outcome: 0.5,
  next: 0.7,
};

// Spec §3.2: small samples are counts ("5 of 6"), never percentages.
const SAMPLE_PERCENT = /\b\d+(?:\.\d+)?%\s+of\s+(?:the\s+)?(?:testers|participants|users|people|stakeholders|interviewees)\b/i;

/** Returns every way a study breaks the frame; empty when it fits. */
export function validateCaseStudy(study: CaseStudy): string[] {
  const problems: string[] = [];
  const { slug, challenges, outcome, budget } = study;

  if (challenges.length < 2 || challenges.length > 3) {
    problems.push(`${slug}: ${challenges.length} challenges (2–3 allowed)`);
  }
  if (!challenges.some((c) => c.kind !== "engineering")) {
    problems.push(`${slug}: no design, user or stakeholder challenge`);
  }

  const total = Math.round(Object.values(budget).reduce((s, n) => s + n, 0) * 10) / 10;
  if (total > SCREEN_CAP) problems.push(`${slug}: ${total} screens (cap ${SCREEN_CAP})`);

  const texts = [...challenges.flatMap((c) => [c.happened, c.did, c.changed]), ...outcome.lines];
  for (const text of texts) {
    if (SAMPLE_PERCENT.test(text)) problems.push(`${slug}: percentage of a small sample: "${text}"`);
  }

  return problems;
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/lib/case-studies/validate.test.ts`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/case-studies/validate.ts src/lib/case-studies/validate.test.ts
git commit -m "feat: case-study frame validator" -- src/lib/case-studies/validate.ts src/lib/case-studies/validate.test.ts
```

### Task 4: The three studies' content (draft copy)

**Files:** Create `src/content/case-studies/eventread.ts`, `cyvore.ts`, `pulse.ts`, `content.test.ts`.

Every fact below comes from spec §5. Wording is a draft for Task 11.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { liveProjects } from "@/lib/projects";
import { validateCaseStudy } from "@/lib/case-studies/validate";
import { cyvore } from "./cyvore";
import { eventread } from "./eventread";
import { pulse } from "./pulse";

const studies = [eventread, cyvore, pulse];

describe("case-study content", () => {
  test.each(studies)("$slug fits the frame", (study) => {
    expect(validateCaseStudy(study)).toEqual([]);
  });

  test("one study per live project, same order", () => {
    expect(studies.map((s) => s.slug)).toEqual(liveProjects.map((p) => p.slug));
  });

  test("Cyvore's quote is the home-page wording", () => {
    expect(cyvore.outcome.quote?.text).toBe(
      "We weren't looking for a designer. Liam reached us and thanks to his work, we closed our first funding round.",
    );
  });

  test("Pulse reports counts, not percentages", () => {
    const text = [...pulse.challenges.map((c) => c.happened), ...pulse.outcome.lines].join(" ");
    expect(text).toContain("4 of 6");
    expect(text).toContain("5 of 6");
    expect(text).toContain("6 of 6");
    expect(text).not.toMatch(/\d+%/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/content/case-studies/content.test.ts`
Expected: FAIL, cannot resolve `./cyvore`.

- [ ] **Step 3: Create `src/content/case-studies/eventread.ts`**

```ts
import type { CaseStudy } from "@/lib/case-studies/types";
import { STANDARD_BUDGET } from "@/lib/case-studies/validate";

export const eventread: CaseStudy = {
  slug: "eventread",
  title: "Eventread",
  descriptor: "SaaS web app",
  line: "The check every booker skips.",
  liveUrl: "https://eventread.vercel.app",
  atAGlance: {
    role: "Research, design and build, end to end",
    timeline: "Mar 2026 – ongoing",
    team: "Solo",
    tools: ["Figma", "Figma MCP", "Claude Code", "Next.js", "Vercel", "Ticketmaster API", "JamBase API"],
  },
  challenges: [
    {
      kind: "design",
      title: "A blank calendar looked safe",
      happened:
        "A month with no data looked exactly like a month with no competition. London showed 7 days of events, Tel Aviv came back as a green “No conflicts”, and holidays were missing.",
      did: "I gave missing data its own states (“Not checked”, “No coverage here”), showed holidays without scoring them, and added an “announced” indicator built on an 8-city count: about 95% of a month's shows are listed one month out, 1% a year out.",
      changed: "London went from 7 visible days to all 31.",
    },
    {
      kind: "design",
      title: "The score claimed precision it didn't have",
      happened: "“Safe 18” on a tour date read like a date or a time, and a 0–100 number promised more precision than the formula has.",
      did: "I dropped the number and kept three bands, Safe, Threat and Critical, after checking the cut-points on 3,172 real listings.",
      changed: "The formula produced only 27 distinct values, and none fell between 35–45 or 64–80: the bands sit on real gaps.",
    },
    {
      kind: "design",
      title: "A feature I cut the same day",
      happened: "Showing the distance to each competing show meant asking for the venue first.",
      did: "I removed it. People come to Eventread to find the venue; asking for it first asks them for the answer.",
      changed: "The search stays one form: place, date, genre, capacity.",
    },
  ],
  outcome: {
    lines: [
      "Live at eventread.vercel.app, built solo.",
      "Finds every competing event, ticketed or not, before the date is booked.",
    ],
    link: { href: "https://eventread.vercel.app", label: "Try it" },
  },
  budget: STANDARD_BUDGET,
};
```

- [ ] **Step 4: Create `src/content/case-studies/cyvore.ts`**

```ts
import type { CaseStudy } from "@/lib/case-studies/types";
import { STANDARD_BUDGET } from "@/lib/case-studies/validate";

export const cyvore: CaseStudy = {
  slug: "cyvore",
  title: "Cyvore",
  descriptor: "B2B website",
  line: "A cybersecurity startup needed a site investors would believe in.",
  atAGlance: {
    role: "Research, information architecture, prototype and investor presentations",
    timeline: "About 1 month, part of a 2025–26 contract",
    team: "Solo, reviewed with the CTO, a developer and DevOps",
    tools: ["Figma", "Figma MCP", "Claude Code"],
    type: "Project-based contract",
  },
  challenges: [
    {
      kind: "stakeholder",
      title: "The CEO wanted the full video on the site",
      happened: "The CEO wanted the full product video on the site.",
      did: "I argued for a 7-second animation of the product's mission, with the video one click away. In a meeting you present with visual support; you don't narrate over a video. And investors had likely seen the only public product video already.",
      changed: "The mission reads in about 7 seconds, and the full video stays one click away.",
    },
    {
      kind: "user",
      title: "No investors to test with",
      happened: "The people the site was for, investors in a live meeting, weren't available to test with.",
      did: "I tested with the three people who'd present it, the CTO, a developer and DevOps: four navigation tasks, with the task order counterbalanced.",
      changed: "Every task was measured on the people who'd actually be presenting it.",
    },
  ],
  outcome: {
    lines: [
      "Used as the live product presentation in investor meetings.",
      "3 of 3 stakeholders completed all four tasks. Time to find a section: about 35s → about 8s.",
    ],
    quote: {
      text: "We weren't looking for a designer. Liam reached us and thanks to his work, we closed our first funding round.",
      name: "Yoav Rotem",
      title: "CTO, Cyvore",
    },
  },
  budget: STANDARD_BUDGET,
};
```

- [ ] **Step 5: Create `src/content/case-studies/pulse.ts`**

```ts
import type { CaseStudy } from "@/lib/case-studies/types";
import { STANDARD_BUDGET } from "@/lib/case-studies/validate";

export const pulse: CaseStudy = {
  slug: "pulse",
  title: "Pulse",
  descriptor: "Fitness app",
  line: "A goal-focused fitness app designed around four retention milestones.",
  atAGlance: {
    role: "UX design, research and branding",
    timeline: "Dec 2025 – Feb 2026",
    team: "Solo, with a CareerFoundry mentor",
    tools: ["Figma", "Figma MCP", "Claude Code"],
    type: "CareerFoundry final project · prototype",
  },
  challenges: [
    {
      kind: "user",
      title: "The Injury Log read as medical advice",
      happened: "4 of 6 testers took the Injury Log's results as medical advice: a liability risk.",
      did: "I renamed and reframed it as the Training Log: how sessions felt, milestones, progression. Habits, not health.",
      changed: "The liability risk is gone, and the log now feeds the habit the app is built around.",
    },
    {
      kind: "user",
      title: "People wanted to set a goal first",
      happened: "5 of 6 testers expected to set a goal during onboarding.",
      did: "I rebuilt onboarding around goals, activity preferences and booking habits, before anything else.",
      changed: "The goal-based onboarding shown above.",
    },
    {
      kind: "user",
      title: "Challenges looked public",
      happened: "4 of 6 testers thought Challenges were public.",
      did: "I gave each feature a one-screen introduction.",
      changed: "Challenges read as private, progress-based and unlimited.",
    },
  ],
  outcome: {
    lines: [
      "A tested prototype.",
      "After the fixes, 6 of 6 testers in round 2 (returning and new) completed every scenario task.",
    ],
  },
  budget: STANDARD_BUDGET,
};
```

- [ ] **Step 6: Run to verify it passes**

Run: `npx vitest run src/content/case-studies/content.test.ts`
Expected: 6 passed.

- [ ] **Step 7: Commit**

```bash
git add src/content/case-studies/eventread.ts src/content/case-studies/cyvore.ts src/content/case-studies/pulse.ts src/content/case-studies/content.test.ts
git commit -m "feat: case-study content for Eventread, Cyvore and Pulse (draft copy)" -- src/content/case-studies/
```

### Task 5: Danger Score engine

A port of `lib/dangerScore.ts` from the Eventread repo (`capacityScore`, `genreWeight`, `timingWeight`, the bands). The significance floor is left out: the calculator teaches the three-factor formula on music events, where the floor never applies.

**Files:** Create `src/lib/danger-score.ts`, `src/lib/danger-score.test.ts`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, test } from "vitest";
import { BERLIN_EVENTS, BERLIN_SHOW, band, capacityScore, dangerScore, genreWeight, timingWeight } from "./danger-score";

describe("danger score factors", () => {
  test("capacity: competing room size relative to yours", () => {
    expect(capacityScore(7366, 1000)).toBe(1.0);
    expect(capacityScore(3638, 1000)).toBe(0.8);
    expect(capacityScore(532, 1000)).toBe(0.6);
    expect(capacityScore(400, 1000)).toBe(0.3);
    expect(capacityScore(0, 1000)).toBe(0.6);
  });

  test("genre: same, neighbour, adjacent, loose, non-music", () => {
    expect(genreWeight("Rock", "Rock")).toBe(1.0);
    expect(genreWeight("Rock", "Alternative")).toBe(0.8);
    expect(genreWeight("Rock", "Pop")).toBe(0.5);
    expect(genreWeight("Rock", "Other")).toBe(0.2);
    expect(genreWeight("Rock", "Comedy", "Arts")).toBe(0.1);
  });

  test("timing: within 2 hours, same evening, different session", () => {
    expect(timingWeight("20:00", "21:30")).toBe(1.0);
    expect(timingWeight("20:00", "15:00")).toBe(0.7);
    expect(timingWeight("20:00", "10:00")).toBe(0.3);
    expect(timingWeight("20:00", "")).toBe(1.0);
  });
});

describe("the Berlin example (eventread.vercel.app hero, 18 Nov 2026)", () => {
  test("matches the live product: Critical, Threat, Safe", () => {
    const scored = BERLIN_EVENTS.map((e) => ({ name: e.name, score: dangerScore(e, BERLIN_SHOW) }));
    expect(scored.map((s) => s.score)).toEqual([80, 60, 16]);
    expect(scored.map((s) => band(s.score))).toEqual(["Critical", "Threat", "Safe"]);
  });

  test("bands cut at 40 and 70", () => {
    expect(band(39)).toBe("Safe");
    expect(band(40)).toBe("Threat");
    expect(band(69)).toBe("Threat");
    expect(band(70)).toBe("Critical");
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/lib/danger-score.test.ts`
Expected: FAIL, cannot resolve `./danger-score`.

- [ ] **Step 3: Implement**

```ts
// Port of lib/dangerScore.ts in the Eventread repo (2026-10-09). Keep the numbers in step with it.
// Danger Score = capacity × genre × timing × 100, shown to users as a band, never a number.

export interface CompetingEvent {
  name: string;
  venue: string;
  capacity: number;
  genre: string;
  time: string;
  category?: string;
}

export interface YourShow {
  capacity: number;
  genre: string;
  startTime: string;
}

export type Band = "Safe" | "Threat" | "Critical";

export function capacityScore(competing: number, yours: number): number {
  const mine = yours > 0 ? yours : 1500;
  if (!competing || !Number.isFinite(competing) || competing <= 0) return 0.6;
  const ratio = competing / mine;
  if (ratio > 5) return 1.0;
  if (ratio >= 2) return 0.8;
  if (ratio >= 0.5) return 0.6;
  return 0.3;
}

const normGenre = (s: string) => (s || "").trim().toLowerCase().replace(/-/g, " ");

const NEIGHBOURS: Record<string, string[]> = {
  rock: ["alternative", "indie", "punk", "metal", "hard rock", "classic rock"],
  metal: ["rock", "hard rock", "punk", "alternative"],
  electronic: ["techno", "house", "edm", "dance", "electro"],
  techno: ["electronic", "house", "dance", "edm"],
  house: ["electronic", "techno", "dance", "edm"],
  pop: ["r&b", "soul", "indie pop", "dance pop"],
  "hip hop": ["r&b", "rap", "soul"],
  jazz: ["blues", "soul", "funk"],
  classical: ["opera", "orchestral"],
  folk: ["country", "acoustic", "indie folk"],
  country: ["folk", "americana"],
  "r&b": ["soul", "pop", "hip hop"],
  soul: ["r&b", "jazz", "funk", "blues"],
  blues: ["jazz", "soul", "rock"],
  reggae: ["ska", "dancehall"],
};

const ADJACENT: Record<string, string[]> = {
  rock: ["pop", "country", "blues"],
  electronic: ["pop", "hip hop"],
  pop: ["rock", "electronic", "r&b"],
  "hip hop": ["pop", "electronic"],
  jazz: ["classical", "pop"],
  classical: ["jazz", "folk"],
};

const NON_MUSIC = ["sports", "theater", "theatre", "comedy", "arts", "family", "miscellaneous", "parade", "football"];

export function genreWeight(yours: string, theirs: string, category = ""): number {
  const u = normGenre(yours);
  const e = normGenre(theirs);
  const cat = normGenre(category);
  if (u === "all genres" || u === "") return 0.6;
  if (u === e) return 1.0;
  if (NEIGHBOURS[u]?.some((n) => e.includes(n) || n.includes(e))) return 0.8;
  if (u.length >= 3 && (e.includes(u) || u.includes(e))) return 0.8;
  if (ADJACENT[u]?.some((n) => e.includes(n) || n.includes(e))) return 0.5;
  if (NON_MUSIC.some((n) => e.includes(n) || cat.includes(n))) return 0.1;
  return 0.2;
}

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map((n) => parseInt(n, 10) || 0);
  return h * 60 + m;
};

export function timingWeight(yourStart: string, theirs: string): number {
  if (!theirs) return 1.0;
  const diff = Math.abs(toMinutes(yourStart) - toMinutes(theirs));
  if (diff <= 120) return 1.0;
  if (diff <= 360) return 0.7;
  return 0.3;
}

export function dangerScore(event: CompetingEvent, show: YourShow): number {
  const score = Math.round(
    capacityScore(event.capacity, show.capacity) *
      genreWeight(show.genre, event.genre, event.category) *
      timingWeight(show.startTime, event.time) *
      100,
  );
  return Math.max(0, Math.min(100, score));
}

export function band(score: number): Band {
  if (score >= 70) return "Critical";
  if (score >= 40) return "Threat";
  return "Safe";
}

/** The live product's own example: a 1,000-cap rock show in Berlin, 18 Nov 2026, 20:00. */
export const BERLIN_SHOW: YourShow = { capacity: 1000, genre: "Rock", startTime: "20:00" };

export const BERLIN_EVENTS: readonly CompetingEvent[] = [
  { name: "Muse — The Wow! Signal Europa Tour", venue: "Uber Arena", capacity: 7366, genre: "Alternative", time: "20:00", category: "Music" },
  { name: "Horse Lords", venue: "Silent Green", capacity: 532, genre: "Rock", time: "20:00", category: "Music" },
  { name: "TAEMIN", venue: "Verti Music Hall", capacity: 3638, genre: "Other", time: "20:00", category: "Music" },
];
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/lib/danger-score.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/danger-score.ts src/lib/danger-score.test.ts
git commit -m "feat: Danger Score engine ported from Eventread, with the Berlin example" -- src/lib/danger-score.ts src/lib/danger-score.test.ts
```

### Task 6: Shared-block components

Semantics and content only; styling comes from Part B. Use the site tokens already in `src/app/globals.css` (`text-ink`, `text-ink-3`, `font-mono`).

**Files:** Create in `src/components/case-study/`: `case-hero.tsx`, `at-a-glance.tsx`, `challenge-list.tsx`, `outcome.tsx`, `next-project.tsx`, and one test file per component.

- [ ] **Step 1: Write the failing tests**

`src/components/case-study/case-hero.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { eventread } from "@/content/case-studies/eventread";
import { CaseHero } from "./case-hero";

test("hero: the page's only h1, descriptor, line, link out", () => {
  render(<CaseHero study={eventread} />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Eventread");
  expect(screen.getByText("SaaS web app")).toBeInTheDocument();
  expect(screen.getByText("The check every booker skips.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Visit site" })).toHaveAttribute("href", "https://eventread.vercel.app");
});
```

`src/components/case-study/at-a-glance.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { cyvore } from "@/content/case-studies/cyvore";
import { AtAGlance } from "./at-a-glance";

test("at a glance: four fields in order, plus type when given", () => {
  render(<AtAGlance data={cyvore.atAGlance} />);
  const terms = screen.getAllByRole("term").map((t) => t.textContent);
  expect(terms).toEqual(["Role", "Timeline", "Team", "Tools", "Type"]);
  expect(screen.getByText("Figma · Figma MCP · Claude Code")).toBeInTheDocument();
});
```

`src/components/case-study/challenge-list.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { pulse } from "@/content/case-studies/pulse";
import { ChallengeList } from "./challenge-list";

test("challenges: labelled section, one item per challenge, three parts each", () => {
  render(<ChallengeList challenges={pulse.challenges} />);
  const section = screen.getByRole("region", { name: "What got in the way" });
  expect(within(section).getByText("Challenges")).toBeInTheDocument();
  const items = within(section).getAllByRole("listitem");
  expect(items).toHaveLength(3);
  expect(within(items[0]).getByRole("heading", { level: 3 })).toHaveTextContent("The Injury Log read as medical advice");
  expect(within(items[0]).getByText(/4 of 6 testers/)).toBeInTheDocument();
});
```

`src/components/case-study/outcome.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { cyvore } from "@/content/case-studies/cyvore";
import { eventread } from "@/content/case-studies/eventread";
import { Outcome } from "./outcome";

test("outcome with a quote", () => {
  render(<Outcome outcome={cyvore.outcome} />);
  expect(screen.getByRole("region", { name: "Outcome" })).toBeInTheDocument();
  expect(screen.getByRole("blockquote")).toHaveTextContent("we closed our first funding round");
  expect(screen.getByText("Yoav Rotem")).toBeInTheDocument();
});

test("outcome with a link", () => {
  render(<Outcome outcome={eventread.outcome} />);
  expect(screen.getByRole("link", { name: "Try it" })).toHaveAttribute("href", "https://eventread.vercel.app");
});
```

`src/components/case-study/next-project.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { NextProject } from "./next-project";

test("next project loops Eventread → Cyvore → Pulse → Eventread", () => {
  const { rerender } = render(<NextProject from="eventread" />);
  expect(screen.getByRole("link", { name: /Next project: Cyvore/ })).toHaveAttribute("href", "/cyvore");
  rerender(<NextProject from="pulse" />);
  expect(screen.getByRole("link", { name: /Next project: Eventread/ })).toHaveAttribute("href", "/eventread");
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/components/case-study`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `case-hero.tsx`**

```tsx
import type { CaseStudy } from "@/lib/case-studies/types";

export function CaseHero({ study }: { study: CaseStudy }) {
  return (
    <header className="flex min-h-dvh flex-col justify-end gap-4 px-[5vw] pb-[8vh]">
      <p className="font-mono text-xs uppercase tracking-[0.08em] text-ink-3">{study.descriptor}</p>
      <h1 className="text-[clamp(3rem,7vw,7rem)] font-normal leading-none">{study.title}</h1>
      <p className="max-w-[40ch] text-[clamp(1.25rem,2.6vw,2.4rem)] leading-tight">{study.line}</p>
      {study.liveUrl && (
        <a href={study.liveUrl} target="_blank" rel="noreferrer" className="w-fit font-mono text-xs uppercase tracking-[0.08em] underline">
          Visit site
        </a>
      )}
    </header>
  );
}
```

- [ ] **Step 4: Implement `at-a-glance.tsx`**

```tsx
import type { AtAGlance as Data } from "@/lib/case-studies/types";

export function AtAGlance({ data }: { data: Data }) {
  const rows: [string, string][] = [
    ["Role", data.role],
    ["Timeline", data.timeline],
    ["Team", data.team],
    ["Tools", data.tools.join(" · ")],
  ];
  if (data.type) rows.push(["Type", data.type]);

  return (
    <dl aria-label="At a glance" className="grid gap-x-8 gap-y-2 px-[5vw] py-8 md:grid-cols-5">
      {rows.map(([term, value]) => (
        <div key={term}>
          <dt className="font-mono text-xs uppercase tracking-[0.08em] text-ink-3">{term}</dt>
          <dd className="mt-1">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
```

- [ ] **Step 5: Implement `challenge-list.tsx`**

```tsx
import { useId } from "react";
import type { Challenge } from "@/lib/case-studies/types";

export function ChallengeList({ challenges }: { challenges: readonly Challenge[] }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="px-[5vw] py-[12vh]">
      <p className="font-mono text-xs uppercase tracking-[0.08em] text-ink-3">Challenges</p>
      <h2 id={headingId} className="mt-2 text-[clamp(2rem,4vw,3.6rem)] font-normal leading-[1.15]">
        What got in the way
      </h2>
      <ol className="mt-10 grid gap-10 md:grid-cols-3">
        {challenges.map((c) => (
          <li key={c.title}>
            <h3 className="text-xl">{c.title}</h3>
            <p className="mt-3 text-ink-3">{c.happened}</p>
            <p className="mt-3">{c.did}</p>
            <p className="mt-3 italic">{c.changed}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
```

- [ ] **Step 6: Implement `outcome.tsx`**

```tsx
import { useId } from "react";
import type { Outcome as Data } from "@/lib/case-studies/types";

export function Outcome({ outcome }: { outcome: Data }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="px-[5vw] py-[10vh]">
      <h2 id={headingId} className="font-mono text-xs uppercase tracking-[0.08em] text-ink-3">
        Outcome
      </h2>
      {outcome.lines.map((line) => (
        <p key={line} className="mt-4 max-w-[48ch] text-[clamp(1.25rem,2.6vw,2.4rem)] leading-tight">
          {line}
        </p>
      ))}
      {outcome.quote && (
        <figure className="mt-10 max-w-[56ch]">
          <blockquote className="text-xl italic">“{outcome.quote.text}”</blockquote>
          <figcaption className="mt-3 font-mono text-xs uppercase tracking-[0.08em] text-ink-3">
            <span>{outcome.quote.name}</span> · {outcome.quote.title}
          </figcaption>
        </figure>
      )}
      {outcome.link && (
        <a href={outcome.link.href} target="_blank" rel="noreferrer" className="mt-8 inline-block underline">
          {outcome.link.label}
        </a>
      )}
    </section>
  );
}
```

- [ ] **Step 7: Implement `next-project.tsx`**

```tsx
import Link from "next/link";
import { nextProject } from "@/lib/projects";
import type { CaseSlug } from "@/lib/case-studies/types";

export function NextProject({ from }: { from: CaseSlug }) {
  const next = nextProject(from);
  return (
    <nav aria-label="Next case study" className="px-[5vw] py-[14vh]">
      <Link href={`/${next.slug}`} aria-label={`Next project: ${next.name}`} className="block">
        <span className="font-mono text-xs uppercase tracking-[0.08em] text-ink-3">Next project</span>
        <span className="mt-2 block text-[clamp(3rem,7vw,7rem)] leading-none">{next.name}</span>
      </Link>
    </nav>
  );
}
```

- [ ] **Step 8: Run to verify they pass**

Run: `npx vitest run src/components/case-study`
Expected: 6 passed.

- [ ] **Step 9: Commit**

```bash
git add src/components/case-study/
git commit -m "feat: case-study shared blocks: hero, at a glance, challenges, outcome, next project" -- src/components/case-study/
```

### Task 7: The middles (MDX) and the page composer

**Files:** Create `src/components/case-study/middle-block.tsx` (+ test), `src/content/case-studies/eventread.mdx`, `cyvore.mdx`, `pulse.mdx`, `src/content/case-studies/index.ts`, `src/components/case-study/case-study-page.tsx` (+ test). Modify `src/mdx-components.tsx`, the three `src/app/*/page.tsx`.

- [ ] **Step 1: Write the failing tests**

`src/components/case-study/middle-block.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { MiddleBlock } from "./middle-block";

test("a middle block is a region named by its heading", () => {
  render(
    <MiddleBlock kind="problem" title="Two bands, one lost night">
      <p>Body</p>
    </MiddleBlock>,
  );
  const region = screen.getByRole("region", { name: "Two bands, one lost night" });
  expect(region).toHaveAttribute("data-block", "problem");
});
```

`src/components/case-study/case-study-page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { pulse } from "@/content/case-studies/pulse";
import { CaseStudyPage } from "./case-study-page";

vi.mock("next/navigation", () => ({ usePathname: () => "/pulse" }));

test("the frame in order: hero, at a glance, middle, challenges, outcome, next", () => {
  const Middle = () => <section aria-label="Middle">middle</section>;
  render(<CaseStudyPage study={pulse} Middle={Middle} />);
  const landmarks = screen
    .getAllByRole("region")
    .map((r) => r.getAttribute("aria-label") ?? r.querySelector("h2")?.textContent);
  expect(landmarks).toEqual(["Middle", "What got in the way", "Outcome"]);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Pulse");
  expect(screen.getByRole("link", { name: "Back to projects" })).toHaveAttribute("href", "/#pulse");
  expect(screen.getByRole("link", { name: /Next project: Eventread/ })).toBeInTheDocument();
  expect(document.querySelector("article")).toHaveAttribute("data-world", "pulse");
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/components/case-study/middle-block.test.tsx src/components/case-study/case-study-page.test.tsx`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `middle-block.tsx`**

```tsx
import { useId, type ReactNode } from "react";

type Kind = "problem" | "signature" | "supporting";

export function MiddleBlock({ kind, title, children }: { kind: Kind; title: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} data-block={kind} className="px-[5vw] py-[12vh]">
      <h2 id={headingId} className="text-[clamp(2rem,4vw,3.6rem)] font-normal leading-[1.15]">
        {title}
      </h2>
      <div className="mt-8 max-w-[60ch] space-y-5 text-lg leading-relaxed">{children}</div>
    </section>
  );
}
```

- [ ] **Step 4: Expose it to MDX** in `src/mdx-components.tsx`

```tsx
import type { MDXComponents } from "mdx/types";
import { MiddleBlock } from "@/components/case-study/middle-block";

const components: MDXComponents = { MiddleBlock };

export function useMDXComponents(): MDXComponents {
  return components;
}
```

- [ ] **Step 5: Write the middles (draft copy, from spec §5)**

`src/content/case-studies/eventread.mdx`:

```mdx
<MiddleBlock kind="problem" title="Two bands, one lost night">

My band's release show lost its audience to a Måneskin arena show on the same night. A friend's band lost theirs to the Champions League final. Nobody had checked, because there was nothing to check with.

I spent ten years booking shows for two bands. Bookers pick a date and hope: ticketing platforms show their own events, and nobody shows the whole night.

The market is 54,000 events and 151 million fans a year, mostly sold through one company. Prism.fm, TourSmart and ChatGPT each answer part of the question; none checks a date against everything happening that night.

</MiddleBlock>

<MiddleBlock kind="signature" title="Danger Score">

Every competing event gets three weights: how big its room is next to yours, how close its genre is to yours, and how close its start time is to yours. Multiplied together, they place the night in one of three bands: Safe, Threat or Critical.

On the live product's own example, a 1,000-cap rock show in Berlin on 18 November 2026, Muse at the Uber Arena is Critical, Horse Lords in a 532-cap room is a Threat because it's the same genre, and TAEMIN at 3,638 is Safe. Size isn't danger; relevance is.

</MiddleBlock>

<MiddleBlock kind="supporting" title="One search, two sources">

Ticketmaster covers ticketed events. JamBase fills in what Ticketmaster doesn't list. One search checks both, and followed dates send an update when something new lands on your night.

Under the hood: "Cambridge" returned 124 events across the UK and the US until places carried their country (21 after the fix), and tour shows wanting the same night are assigned in two passes.

</MiddleBlock>
```

`src/content/case-studies/cyvore.mdx`:

```mdx
<MiddleBlock kind="problem" title="A linear site vs an investor meeting">

Cyvore was raising its first round. Its website was one long scroll: fine for a visitor, wrong for a founder presenting live, who needs to jump to any answer in one click.

Nobody had asked for a redesign. I pitched one.

</MiddleBlock>

<MiddleBlock kind="signature" title="One screen, everything">

The whole pitch on one screen, in four tabs: Security, Exposure, Coverage, Enables. Whatever an investor asks, the answer is one click away.

</MiddleBlock>

<MiddleBlock kind="supporting" title="Before and after">

The old navigation against the new, and the micro-animations that carry a founder from one answer to the next. The design system behind it: type, colour tokens and component states.

</MiddleBlock>
```

`src/content/case-studies/pulse.mdx`:

```mdx
<MiddleBlock kind="problem" title="Users quit before the habit">

Fitness apps lose people before a habit forms. People who engage in their first week are 80% more likely to still be active six months later (Lucid). BEAT81 and Urban Sports Club sell the classes, but neither is built around keeping you coming back.

I designed Pulse around four milestones, Day 7, 30, 60 and 90, as targets for the design to hit.

</MiddleBlock>

<MiddleBlock kind="signature" title="Goal-based onboarding">

Twelve screens. Screens 1–3 frame the app and learn your goal; 4–9 walk you through your first booking; 10–12 give the tour, ask for permissions and close.

</MiddleBlock>

<MiddleBlock kind="supporting" title="Challenges without pressure">

Overview, reflect, progress: a Training Log for how sessions felt, and Challenges that are private, progress-based and unlimited. The brand carries the same promise: you set the goal, the app shows the way.

</MiddleBlock>
```

- [ ] **Step 6: Create the registry `src/content/case-studies/index.ts`**

```ts
import type { CaseSlug, CaseStudyEntry } from "@/lib/case-studies/types";
import { cyvore } from "./cyvore";
import CyvoreMiddle from "./cyvore.mdx";
import { eventread } from "./eventread";
import EventreadMiddle from "./eventread.mdx";
import { pulse } from "./pulse";
import PulseMiddle from "./pulse.mdx";

export const caseStudies: Record<CaseSlug, CaseStudyEntry> = {
  eventread: { study: eventread, Middle: EventreadMiddle },
  cyvore: { study: cyvore, Middle: CyvoreMiddle },
  pulse: { study: pulse, Middle: PulseMiddle },
};
```

- [ ] **Step 7: Implement `case-study-page.tsx`**

```tsx
import type { ComponentType } from "react";
import { BackButton } from "@/components/shell/back-button";
import type { CaseStudy } from "@/lib/case-studies/types";
import { AtAGlance } from "./at-a-glance";
import { CaseHero } from "./case-hero";
import { ChallengeList } from "./challenge-list";
import { NextProject } from "./next-project";
import { Outcome } from "./outcome";

/** Spec §2: shared top, the project's own middle, shared ending. */
export function CaseStudyPage({ study, Middle }: { study: CaseStudy; Middle: ComponentType }) {
  return (
    <article data-world={study.slug}>
      <BackButton slug={study.slug} />
      <CaseHero study={study} />
      <AtAGlance data={study.atAGlance} />
      <Middle />
      <ChallengeList challenges={study.challenges} />
      <Outcome outcome={study.outcome} />
      <NextProject from={study.slug} />
    </article>
  );
}
```

- [ ] **Step 8: Replace the three route pages.** `src/app/eventread/page.tsx`:

```tsx
import type { Metadata } from "next";
import { CaseStudyPage } from "@/components/case-study/case-study-page";
import { caseStudies } from "@/content/case-studies";

const { study, Middle } = caseStudies.eventread;

export const metadata: Metadata = { title: `${study.title} case study`, description: study.line };

export default function EventreadPage() {
  return <CaseStudyPage study={study} Middle={Middle} />;
}
```

`src/app/cyvore/page.tsx` and `src/app/pulse/page.tsx` are the same file with `caseStudies.cyvore` / `CyvorePage` and `caseStudies.pulse` / `PulsePage`.

- [ ] **Step 9: Run unit tests and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all tests pass; no type errors. If TypeScript can't resolve `*.mdx` imports, confirm `@types/mdx` is installed (Task 1) and that `next-env.d.ts` is unchanged.

- [ ] **Step 10: Commit**

```bash
git add src/components/case-study/ src/content/case-studies/ src/mdx-components.tsx src/app/eventread/page.tsx src/app/cyvore/page.tsx src/app/pulse/page.tsx
git commit -m "feat: case-study pages: the frame around each project's MDX middle" -- src/components/case-study/ src/content/case-studies/ src/mdx-components.tsx src/app/eventread/page.tsx src/app/cyvore/page.tsx src/app/pulse/page.tsx
```

### Task 8: End-to-end checks

**Files:** Create `e2e/case-studies.spec.ts`.

- [ ] **Step 1: Write the tests**

```ts
import { expect, test } from "@playwright/test";

const loop = [
  ["eventread", "Cyvore"],
  ["cyvore", "Pulse"],
  ["pulse", "Eventread"],
] as const;

for (const [slug, next] of loop) {
  test(`/${slug} has the full frame`, async ({ page }) => {
    await page.goto(`/${slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("definition").first()).toBeVisible();
    await expect(page.getByRole("region", { name: "What got in the way" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Outcome" })).toBeVisible();
    await page.getByRole("link", { name: `Next project: ${next}` }).click();
    await expect(page).toHaveURL(new RegExp(`/${next.toLowerCase()}$`));
  });
}
```

- [ ] **Step 2: Run**

Run: `npx playwright test e2e/case-studies.spec.ts e2e/smoke.spec.ts`
Expected: all pass. If the build fails in `src/three/` or `src/app/lab/`, stop and tell Liam (other chat's work in progress).

- [ ] **Step 3: Commit**

```bash
git add e2e/case-studies.spec.ts
git commit -m "test: e2e for the case-study frame and loop" -- e2e/case-studies.spec.ts
```

### Task 9: Eventread calendar capture

The hero shows the month calendar from the live app. The live app's month URL takes `range=month` and `date=YYYY-MM`; the Berlin place parameters match its own example link.

**Files:** Create `scripts/capture/eventread-calendar.mjs`. Output: `public/case-studies/eventread/calendar-berlin-2026-11.png`.

- [ ] **Step 1: Write the script**

```js
// Captures Eventread's month calendar for the case-study hero.
// Usage: node scripts/capture/eventread-calendar.mjs
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const OUT = "public/case-studies/eventread";
const params = new URLSearchParams({
  city: "Berlin",
  country: "Germany",
  countryCode: "DE",
  placeId: "hero-berlin",
  lat: "52.52",
  lon: "13.405",
  date: "2026-11",
  range: "month",
  genre: "Rock",
  capacity: "1000",
});

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 2 });
await page.goto(`https://eventread.vercel.app/results?${params}`, { waitUntil: "networkidle" });
await page.waitForTimeout(4000);
await page.screenshot({ path: `${OUT}/calendar-berlin-2026-11.png` });
await browser.close();
console.log(`saved ${OUT}/calendar-berlin-2026-11.png`);
```

- [ ] **Step 2: Run and look at the result**

Run: `node scripts/capture/eventread-calendar.mjs`
Expected: `saved public/case-studies/eventread/calendar-berlin-2026-11.png`. Open it: the calendar must be fully loaded, with no "couldn't be reached" banner. If either source fails, tell Liam rather than shipping a broken capture.

- [ ] **Step 3: Show Liam** the capture (1512×982 at 2×, the 14-inch MacBook Pro viewport, so it fits the laptop on the home page too) and get approval.
- [ ] **Step 4: Commit**

```bash
git add scripts/capture/eventread-calendar.mjs public/case-studies/eventread/calendar-berlin-2026-11.png
git commit -m "chore: Eventread calendar capture for the case-study hero" -- scripts/capture/eventread-calendar.mjs public/case-studies/eventread/
```

### Task 10: Collect the existing assets

- [ ] **Step 1: Ask Liam** where the source files are (the live site's Figma file `65QHzAsnx9NtQxHJwmccXf`, or originals on disk) for: Cyvore's hero interaction video, micro-animation video, prototype screens, old-site screenshots, token and state boards, and the 7-second mission animation if it exists as a file; Pulse's two phone videos, the 12 onboarding screens, brand renders, the annotated Challenges screen, and the Training Log before and after if available. Prefer originals over screenshots of the live site.
- [ ] **Step 2:** Copy them to `public/case-studies/<slug>/` with descriptive names (`hero-interaction.mp4`, `onboarding-01.png` … `onboarding-12.png`). Re-encode video with ffmpeg only once the other chat's Blender render is idle: `ffmpeg -i in.mov -c:v libx264 -crf 22 -preset slow -pix_fmt yuv420p -movflags +faststart -an out.mp4`.
- [ ] **Step 3: Commit** with the explicit paths: `git commit -m "chore: case-study source assets" -- public/case-studies/`

### Task 11: Copy review with Liam (gate)

- [ ] **Step 1:** Start the dev server (`preview_start` with `portfolio-dev`) and open `/eventread`, `/cyvore`, `/pulse`. The pages are unstyled; this review is about words only.
- [ ] **Step 2:** Walk Liam through every line of the content files and MDX, one study at a time. Apply his edits in `src/content/case-studies/*.ts` and `*.mdx`; re-run `npx vitest run src/content` after each study (the validator catches a broken frame).
- [ ] **Step 3: Commit** after each approved study: `git commit -m "content: <study> copy approved by Liam" -- src/content/case-studies/`

### Task 12: Part B brief (gate)

- [ ] **Step 1:** Write `docs/superpowers/plans/2026-10-09-case-studies-part-b-design.md` with: the references to study first (lusion.co project pages for case-study rhythm and type contrast; moto-card.com and oryzo.ai for object-led storytelling; Liam's live case studies for each project's world), the blocks to mock up (hero, at a glance, one middle block per study, the three signature interactions as stills, What got in the way, Outcome, Next project), each in its project world (Eventread light/navy, Cyvore deep violet, Pulse deep blue), Geist only for Liam's words, project fonts only inside product visuals, and the open items from spec §10 (mobile and reduced-motion versions; where Cyvore's 7-second animation goes).
- [ ] **Step 2:** Review the brief with Liam. Part C (styling, signature interactions, transitions) is planned only after the Part B mockups are approved.
