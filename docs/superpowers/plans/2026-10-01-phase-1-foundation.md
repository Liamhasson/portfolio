# Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deployed Next.js skeleton of liamhasson.com, with design tokens, motion tokens, fonts, smooth scroll, the shared shell (pill nav with active highlight and reading progress, back button), all four routes, legacy redirects, the particle-video media pipeline, and tests. Phases 2–4 build on it.

**Architecture:** Next.js App Router with static pages. Design and motion tokens live in one CSS `@theme` block (Tailwind v4) plus one TS module. Client behavior (Lenis smooth scroll, active-section tracking, nav highlight) sits in small client components and hooks with unit tests. A project registry (`src/lib/projects.ts`) is the single list of projects that nav, redirects, back links and the next-project footer read from.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Motion 13 (`motion/react`), GSAP 3 + ScrollTrigger, Lenis 1.3, Vitest 5 + Testing Library + jsdom, Playwright (smoke e2e), ffmpeg (SVT-AV1 + x264).

**Spec:** `docs/superpowers/specs/2026-10-01-portfolio-site-design.md`

**This is plan 1 of 4.** Plans for Phase 2 (Home), Phase 3 (Case studies) and Phase 4 (Polish and launch) are written when each phase starts.

**Branching:** all work happens on branch `phase/1-foundation`. Vercel builds a preview for every push. Merging to `main` (= production) happens only after Liam approves the preview.

---

## File map

| File | Responsibility |
|---|---|
| `package.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs` | Scaffolded by create-next-app. `next.config.ts` wires redirects |
| `vitest.config.ts`, `vitest.setup.ts` | Unit/component test runner |
| `playwright.config.ts`, `e2e/smoke.spec.ts` | Route and redirect smoke tests against a production build |
| `.claude/launch.json` | Dev server config for the in-app browser preview |
| `src/app/globals.css` | Tailwind import, design tokens (`@theme`), base styles, reduced-motion base |
| `src/app/fonts.ts` | `next/font/google` instances (Host Grotesk, Plus Jakarta Sans, Playfair Display, DM Mono) |
| `src/app/layout.tsx` | HTML shell: fonts, skip link, `SmoothScroll`, `PillNav` |
| `src/app/page.tsx` | Home skeleton with section anchors `projects`, `about`, `contact` (filled in Phase 2) |
| `src/app/{pulse,cyvore,eventread}/page.tsx` | Case-study route skeletons with `BackButton` (filled in Phase 3) |
| `src/lib/motion.ts` | Motion tokens (easing, durations, distances, stagger, spring) |
| `src/lib/projects.ts` | Project registry, `liveProjects`, `nextProject()` |
| `src/lib/redirects.ts` | Legacy Figma Sites URL redirects derived from the registry |
| `src/lib/session-flags.ts` | "Loader seen this session" flag with safe storage access |
| `src/lib/smooth-scroll.ts` | `shouldUseSmoothScroll()` decision function |
| `src/hooks/use-active-section.ts` | Which home section is in the middle of the viewport |
| `src/components/providers/smooth-scroll.tsx` | Lenis + GSAP ticker/ScrollTrigger sync |
| `src/components/shell/pill-nav.tsx` | Floating nav: links, sliding active highlight, reading progress |
| `src/components/shell/back-button.tsx` | Case-study back link to the originating card |
| `scripts/encode-video.sh` | ffmpeg → AV1 WebM + H.264 MP4 + poster JPG |
| `public/media/particles.{webm,mp4,jpg}` | Particle cloud asset (from live site) |

---

### Task 1: Scaffold the Next.js app

**Files:**
- Create: everything from `create-next-app` (merged into the existing repo)
- Create: `.claude/launch.json`

The project folder name ("My portfolio - project") isn't a valid npm package name, so scaffold in the scratchpad and copy it in.

- [ ] **Step 1: Create the branch**

```bash
cd "/Users/liamwindhasson/Documents/My portfolio - project"
git checkout -b phase/1-foundation
```

- [ ] **Step 2: Scaffold into a temp folder**

```bash
SCRATCH="/private/tmp/claude-501/-Users-liamwindhasson-Documents-My-portfolio---project/2a94d69b-db91-4cf0-a422-f96fd24583d7/scratchpad"
cd "$SCRATCH" && rm -rf liamhasson-portfolio
npx --yes create-next-app@16.3.8 liamhasson-portfolio --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --turbopack --disable-git --yes
```

Expected: `Success! Created liamhasson-portfolio`.

- [ ] **Step 3: Copy into the repo (keep docs and .git) and install**

```bash
cd "/Users/liamwindhasson/Documents/My portfolio - project"
rsync -a --exclude node_modules --exclude .git "$SCRATCH/liamhasson-portfolio/" ./
npm install
```

Expected: `added N packages`, no errors. The scaffold's `.gitignore` replaces ours. It already covers `.DS_Store`, `node_modules`, `.next`, `.vercel` and `.env*`.

- [ ] **Step 4: Add the in-app browser dev server config**

Create `.claude/launch.json`:

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "portfolio-dev",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 3000
    }
  ]
}
```

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: `✓ Compiled successfully` and a route table listing `/`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 16 app

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Test tooling (Vitest + Testing Library + Playwright)

**Files:**
- Create: `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts`, `src/lib/sanity.test.ts` (deleted in Step 6)
- Modify: `package.json` (scripts)

- [ ] **Step 1: Install dev dependencies**

```bash
npm install -D vitest@5 @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
```

- [ ] **Step 3: Create `vitest.setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Create `playwright.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://localhost:3100" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npx next start -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
```

- [ ] **Step 5: Add scripts to `package.json`**

In `"scripts"`, add:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:e2e": "playwright test"
```

- [ ] **Step 6: Prove the runner works, then remove the sanity test**

Create `src/lib/sanity.test.ts`:

```ts
import { expect, test } from "vitest";
test("vitest runs", () => expect(1 + 1).toBe(2));
```

Run: `npm test`
Expected: `1 passed`. Then delete it: `rm src/lib/sanity.test.ts`

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: add Vitest, Testing Library and Playwright

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Motion tokens

**Files:**
- Create: `src/lib/motion.ts`
- Test: `src/lib/motion.test.ts`

Values come from spec section 5. Durations are in **seconds** (Motion's unit). GSAP also uses seconds.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { dur, ease, distance, exitDuration, spring, stagger } from "./motion";

describe("motion tokens", () => {
  test("durations match the spec", () => {
    expect(dur).toEqual({ micro: 0.18, ui: 0.32, reveal: 0.6, page: 0.9 });
  });

  test("exits run at ~65% of the enter duration", () => {
    expect(exitDuration(dur.reveal)).toBe(0.39);
    expect(exitDuration(dur.ui)).toBe(0.208);
  });

  test("easing curves are cubic-bezier tuples", () => {
    expect(ease.settle).toEqual([0.22, 1, 0.36, 1]);
    expect(ease.exit).toEqual([0.55, 0, 1, 0.45]);
  });

  test("distances, stagger and spring", () => {
    expect(distance).toEqual({ text: 24, card: 48 });
    expect(stagger).toBe(0.06);
    expect(spring.pop).toEqual({ type: "spring", stiffness: 400, damping: 22 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/motion.test.ts`
Expected: FAIL, `Failed to resolve import "./motion"`.

- [ ] **Step 3: Implement `src/lib/motion.ts`**

```ts
// Single source of truth for motion. Every animation on the site reads from here
// (or from the matching CSS custom properties in globals.css).

export const ease = {
  /** Entrances: fast start, long soft landing. */
  settle: [0.22, 1, 0.36, 1],
  /** Exits: quick departure. */
  exit: [0.55, 0, 1, 0.45],
} as const;

/** Seconds. */
export const dur = {
  micro: 0.18,
  ui: 0.32,
  reveal: 0.6,
  page: 0.9,
} as const;

/** Exits run at ~65% of the matching entrance so the UI feels responsive. */
export function exitDuration(enter: number): number {
  return Math.round(enter * 0.65 * 1000) / 1000;
}

/** Pixels travelled by reveals. */
export const distance = {
  text: 24,
  card: 48,
} as const;

/** Seconds between siblings in a staggered reveal. */
export const stagger = 0.06;

export const spring = {
  pop: { type: "spring", stiffness: 400, damping: 22 },
} as const;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/motion.test.ts`
Expected: `4 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/motion.ts src/lib/motion.test.ts
git commit -m "feat: add motion tokens

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Design tokens, fonts and base styles

**Files:**
- Create: `src/app/fonts.ts`
- Modify (replace contents): `src/app/globals.css`

Token values were measured from the live site's computed styles on 2026-10-01: page `#000`, surface `#14161A` (Figma variable `cs/surface`), rule `#25282E` (`cs/rule`), tag text `#A7ADB6` (`cs/ink-2`), primary text `#F7FAFC`, secondary text `#C9CBCD`, muted text `#777777`, rose accent `#BB687B`, soft rose `#CDA2B9`, Blender-chip orange `#EA7600`. Fonts on home: Host Grotesk (all UI and headings), Plus Jakarta Sans (tags), Playfair Display italic (rose accent words), DM Mono. Case-study fonts (DM Sans, Inter, Michroma, Iceland) are added in Phase 3 with their pages.

- [ ] **Step 1: Create `src/app/fonts.ts`**

```ts
import { DM_Mono, Host_Grotesk, Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";

export const hostGrotesk = Host_Grotesk({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-host-grotesk",
  display: "swap",
});

export const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

export const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400"],
  style: ["italic"],
  variable: "--font-playfair",
  display: "swap",
});

export const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-dm-mono",
  display: "swap",
});

export const fontVariables = [hostGrotesk, plusJakarta, playfair, dmMono]
  .map((f) => f.variable)
  .join(" ");
```

- [ ] **Step 2: Replace `src/app/globals.css`**

```css
@import "tailwindcss";

@theme {
  /* Color: measured from liamhasson.figma.site (2026-10-01) */
  --color-bg: #000000;
  --color-surface: #14161a;
  --color-surface-2: #0f0f0f;
  --color-rule: #25282e;
  --color-ink: #f7fafc;
  --color-ink-2: #c9cbcd;
  --color-ink-3: #a7adb6;
  --color-ink-muted: #777777;
  --color-rose: #bb687b;
  --color-rose-soft: #cda2b9;
  --color-blender: #ea7600;

  /* Type */
  --font-sans: var(--font-host-grotesk), ui-sans-serif, system-ui, sans-serif;
  --font-tag: var(--font-plus-jakarta), ui-sans-serif, system-ui, sans-serif;
  --font-accent: var(--font-playfair), ui-serif, Georgia, serif;
  --font-mono: var(--font-dm-mono), ui-monospace, monospace;

  /* Motion: mirrors src/lib/motion.ts */
  --ease-settle: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-exit: cubic-bezier(0.55, 0, 1, 0.45);
  --duration-micro: 180ms;
  --duration-ui: 320ms;
  --duration-reveal: 600ms;
  --duration-page: 900ms;
}

html {
  background: var(--color-bg);
  color: var(--color-ink);
  color-scheme: dark;
  -webkit-font-smoothing: antialiased;
}

body {
  background: var(--color-bg);
  font-family: var(--font-sans);
  min-height: 100dvh;
}

/* Lenis */
html.lenis,
html.lenis body {
  height: auto;
}
.lenis.lenis-smooth {
  scroll-behavior: auto !important;
}
.lenis.lenis-stopped {
  overflow: hidden;
}

:focus-visible {
  outline: 2px solid var(--color-rose-soft);
  outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 3: Verify the build accepts the fonts and CSS**

Run: `npm run build`
Expected: `✓ Compiled successfully`. If `Host_Grotesk` isn't exported by `next/font/google`, the build fails with `Unknown font`. In that case, download Host Grotesk from Google Fonts into `src/app/fonts/` and use `next/font/local` with the same `variable`.

- [ ] **Step 4: Commit**

```bash
git add src/app/fonts.ts src/app/globals.css
git commit -m "feat: add design tokens, fonts and base styles

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Project registry

**Files:**
- Create: `src/lib/projects.ts`
- Test: `src/lib/projects.test.ts`

Tags are copied from the live site (newer than Figma). Pulse's live tags list "Habit formation focused" twice; the duplicate is dropped.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { liveProjects, nextProject, projects } from "./projects";

describe("project registry", () => {
  test("home grid order matches the live site", () => {
    expect(projects.map((p) => p.slug)).toEqual([
      "eventread",
      "cyvore",
      "pulse",
      "nordic-logic",
      "stub",
    ]);
  });

  test("only Eventread, Cyvore and Pulse are live", () => {
    expect(liveProjects.map((p) => p.slug)).toEqual(["eventread", "cyvore", "pulse"]);
  });

  test("tags have no duplicates", () => {
    for (const p of projects) expect(new Set(p.tags).size).toBe(p.tags.length);
  });

  test("next project cycles through live projects", () => {
    expect(nextProject("eventread").slug).toBe("cyvore");
    expect(nextProject("cyvore").slug).toBe("pulse");
    expect(nextProject("pulse").slug).toBe("eventread");
  });

  test("next project rejects in-progress or unknown slugs", () => {
    expect(() => nextProject("stub")).toThrow("Unknown live project: stub");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/projects.test.ts`
Expected: FAIL, `Failed to resolve import "./projects"`.

- [ ] **Step 3: Implement `src/lib/projects.ts`**

```ts
export type ProjectStatus = "live" | "in-progress";

export interface Project {
  slug: string;
  name: string;
  status: ProjectStatus;
  tags: string[];
}

/** Order = order on the home grid. */
export const projects: Project[] = [
  { slug: "eventread", name: "Eventread", status: "live", tags: ["B2B", "Web design", "Designer-builder"] },
  {
    slug: "cyvore",
    name: "Cyvore",
    status: "live",
    tags: ["B2B website design", "Information architecture", "Advanced animation"],
  },
  {
    slug: "pulse",
    name: "Pulse",
    status: "live",
    tags: ["Front-end development", "Usability testing", "Habit formation focused"],
  },
  {
    slug: "nordic-logic",
    name: "Nordic Logic",
    status: "in-progress",
    tags: ["B2B", "Web design", "Motion", "Brand", "Design system"],
  },
  {
    slug: "stub",
    name: "Stub",
    status: "in-progress",
    tags: ["Convert-focus onboarding", "Mono-line illustration", "User trust"],
  },
];

export const liveProjects = projects.filter((p) => p.status === "live");

/** The case study shown in the next-project footer. Cycles through live projects. */
export function nextProject(slug: string): Project {
  const i = liveProjects.findIndex((p) => p.slug === slug);
  if (i < 0) throw new Error(`Unknown live project: ${slug}`);
  return liveProjects[(i + 1) % liveProjects.length];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/projects.test.ts`
Expected: `5 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/projects.ts src/lib/projects.test.ts
git commit -m "feat: add project registry

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Legacy redirects

**Files:**
- Create: `src/lib/redirects.ts`
- Test: `src/lib/redirects.test.ts`
- Modify (replace contents): `next.config.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "vitest";
import { legacyRedirects } from "./redirects";

test("every live project's old Figma Sites URL redirects permanently", () => {
  expect(legacyRedirects).toEqual([
    { source: "/eventread-case-study", destination: "/eventread", permanent: true },
    { source: "/cyvore-case-study", destination: "/cyvore", permanent: true },
    { source: "/pulse-case-study", destination: "/pulse", permanent: true },
  ]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/redirects.test.ts`
Expected: FAIL, `Failed to resolve import "./redirects"`.

- [ ] **Step 3: Implement `src/lib/redirects.ts`**

```ts
import { liveProjects } from "./projects";

/** Old liamhasson.figma.site paths → new routes, so shared links keep working. */
export const legacyRedirects = liveProjects.map((p) => ({
  source: `/${p.slug}-case-study`,
  destination: `/${p.slug}`,
  permanent: true,
}));
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/redirects.test.ts`
Expected: `1 passed`.

- [ ] **Step 5: Wire it into `next.config.ts`** (replace contents)

```ts
import type { NextConfig } from "next";
import { legacyRedirects } from "./src/lib/redirects";

const nextConfig: NextConfig = {
  async redirects() {
    return legacyRedirects;
  },
};

export default nextConfig;
```

- [ ] **Step 6: Verify the build**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/redirects.ts src/lib/redirects.test.ts next.config.ts
git commit -m "feat: redirect legacy Figma Sites case-study URLs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Session flag for the welcome loader

**Files:**
- Create: `src/lib/session-flags.ts`
- Test: `src/lib/session-flags.test.ts`

The loader itself is Phase 2. This task adds the storage helper. It must never throw: private windows and blocked storage can make `sessionStorage` throw, and then the loader simply plays.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { hasSeenLoader, LOADER_SEEN_KEY, markLoaderSeen } from "./session-flags";

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
}

const throwingStorage = {
  getItem() {
    throw new Error("SecurityError");
  },
  setItem() {
    throw new Error("SecurityError");
  },
} as unknown as Storage;

describe("loader session flag", () => {
  test("false before, true after marking", () => {
    const s = memoryStorage();
    expect(hasSeenLoader(s)).toBe(false);
    markLoaderSeen(s);
    expect(hasSeenLoader(s)).toBe(true);
    expect(s.getItem(LOADER_SEEN_KEY)).toBe("1");
  });

  test("blocked storage: reports unseen and never throws", () => {
    expect(hasSeenLoader(throwingStorage)).toBe(false);
    expect(() => markLoaderSeen(throwingStorage)).not.toThrow();
  });

  test("defaults to window.sessionStorage", () => {
    window.sessionStorage.clear();
    expect(hasSeenLoader()).toBe(false);
    markLoaderSeen();
    expect(hasSeenLoader()).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/session-flags.test.ts`
Expected: FAIL, `Failed to resolve import "./session-flags"`.

- [ ] **Step 3: Implement `src/lib/session-flags.ts`**

```ts
export const LOADER_SEEN_KEY = "lh:loader-seen";

function storage(s?: Storage): Storage {
  return s ?? window.sessionStorage;
}

/** True once the welcome loader has played in this browser session. */
export function hasSeenLoader(s?: Storage): boolean {
  try {
    return storage(s).getItem(LOADER_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markLoaderSeen(s?: Storage): void {
  try {
    storage(s).setItem(LOADER_SEEN_KEY, "1");
  } catch {
    // Storage blocked: the loader will play again next time, which is acceptable.
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/session-flags.test.ts`
Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/session-flags.ts src/lib/session-flags.test.ts
git commit -m "feat: add once-per-session loader flag

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Smooth scroll (Lenis + GSAP)

**Files:**
- Create: `src/lib/smooth-scroll.ts`, `src/components/providers/smooth-scroll.tsx`
- Test: `src/lib/smooth-scroll.test.ts`

- [ ] **Step 1: Install runtime dependencies**

```bash
npm install motion@13 gsap@3 lenis@1.3
```

- [ ] **Step 2: Write the failing test**

```ts
import { expect, test } from "vitest";
import { shouldUseSmoothScroll } from "./smooth-scroll";

const media = (matches: Record<string, boolean>) => (q: string) => matches[q] ?? false;

test("on for a mouse/trackpad without reduced motion", () => {
  expect(shouldUseSmoothScroll(media({ "(pointer: fine)": true }))).toBe(true);
});

test("off on touch devices (native scrolling stays intact)", () => {
  expect(shouldUseSmoothScroll(media({ "(pointer: fine)": false }))).toBe(false);
});

test("off when the user prefers reduced motion", () => {
  expect(
    shouldUseSmoothScroll(
      media({ "(pointer: fine)": true, "(prefers-reduced-motion: reduce)": true }),
    ),
  ).toBe(false);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/lib/smooth-scroll.test.ts`
Expected: FAIL, `Failed to resolve import "./smooth-scroll"`.

- [ ] **Step 4: Implement `src/lib/smooth-scroll.ts`**

```ts
type MediaMatcher = (query: string) => boolean;

/** Smooth scrolling only for fine pointers, and never under reduced motion. */
export function shouldUseSmoothScroll(matches: MediaMatcher): boolean {
  return matches("(pointer: fine)") && !matches("(prefers-reduced-motion: reduce)");
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/smooth-scroll.test.ts`
Expected: `3 passed`.

- [ ] **Step 6: Implement the provider `src/components/providers/smooth-scroll.tsx`**

```tsx
"use client";

import { useEffect, type ReactNode } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { shouldUseSmoothScroll } from "@/lib/smooth-scroll";

gsap.registerPlugin(ScrollTrigger);

export function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (!shouldUseSmoothScroll((q) => window.matchMedia(q).matches)) return;

    const lenis = new Lenis({ lerp: 0.1, anchors: true });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
```

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/lib/smooth-scroll.ts src/lib/smooth-scroll.test.ts src/components/providers/smooth-scroll.tsx
git commit -m "feat: add Lenis smooth scroll synced with GSAP ScrollTrigger

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Active-section hook

**Files:**
- Create: `src/hooks/use-active-section.ts`
- Test: `src/hooks/use-active-section.test.tsx`

A thin band in the middle of the viewport (`rootMargin: -45% 0px -45% 0px`) decides the active section, so only one section counts at a time.

- [ ] **Step 1: Write the failing test**

```tsx
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useActiveSection } from "./use-active-section";

let callback: IntersectionObserverCallback;
const observe = vi.fn();
const disconnect = vi.fn();

beforeEach(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    vi.fn(function (this: unknown, cb: IntersectionObserverCallback) {
      callback = cb;
      return { observe, disconnect, unobserve: vi.fn(), takeRecords: () => [] };
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  observe.mockClear();
  disconnect.mockClear();
});

function Probe() {
  const active = useActiveSection(["projects", "about", "contact"]);
  return (
    <>
      <section id="projects" />
      <section id="about" />
      <section id="contact" />
      <output>{active ?? "none"}</output>
    </>
  );
}

function fire(id: string) {
  const target = document.getElementById(id)!;
  act(() => {
    callback([{ target, isIntersecting: true } as unknown as IntersectionObserverEntry], {} as IntersectionObserver);
  });
}

test("starts with no active section and observes every section", () => {
  render(<Probe />);
  expect(screen.getByRole("status")).toHaveTextContent("none");
  expect(observe).toHaveBeenCalledTimes(3);
});

test("reports the section crossing the middle of the viewport", () => {
  render(<Probe />);
  fire("about");
  expect(screen.getByRole("status")).toHaveTextContent("about");
  fire("contact");
  expect(screen.getByRole("status")).toHaveTextContent("contact");
});

test("disconnects on unmount", () => {
  const { unmount } = render(<Probe />);
  unmount();
  expect(disconnect).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/hooks/use-active-section.test.tsx`
Expected: FAIL, `Failed to resolve import "./use-active-section"`.

- [ ] **Step 3: Implement `src/hooks/use-active-section.ts`**

```ts
"use client";

import { useEffect, useState } from "react";

/** Id of the section currently crossing the middle of the viewport, or null. */
export function useActiveSection(ids: readonly string[]): string | null {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join("|");

  useEffect(() => {
    const elements = key
      .split("|")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    elements.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [key]);

  return active;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/hooks/use-active-section.test.tsx`
Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/hooks
git commit -m "feat: add active-section hook

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Pill nav

**Files:**
- Create: `src/components/shell/pill-nav.tsx`
- Test: `src/components/shell/pill-nav.test.tsx`

Behavior (spec H6 and 4.4):
- Fixed bottom center.
- Three 44px-tall pills with a 1px rose border and 12px Host Grotesk text.
- Fades up on mount (opacity 0 → 1, y 16 → 0, `dur.ui`, `ease.settle`).
- Hover gives a rose fill.
- The active section gets a highlight that **slides between pills** (shared `layoutId`), and the active link gets `aria-current="location"`.
- Off the home page, a 2px reading-progress line runs along the top of the nav.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const pathname = vi.fn(() => "/");
const active = vi.fn<() => string | null>(() => null);

vi.mock("next/navigation", () => ({ usePathname: () => pathname() }));
vi.mock("@/hooks/use-active-section", () => ({ useActiveSection: () => active() }));

import { PillNav } from "./pill-nav";

beforeEach(() => {
  pathname.mockReturnValue("/");
  active.mockReturnValue(null);
});

describe("PillNav", () => {
  test("links to the three home sections from any page", () => {
    render(<PillNav />);
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("href", "/#projects");
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/#about");
    expect(screen.getByRole("link", { name: "Contact" })).toHaveAttribute("href", "/#contact");
  });

  test("marks the active section on home", () => {
    active.mockReturnValue("about");
    render(<PillNav />);
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("aria-current", "location");
    expect(screen.getByRole("link", { name: "Projects" })).not.toHaveAttribute("aria-current");
  });

  test("no reading progress on home", () => {
    render(<PillNav />);
    expect(screen.queryByTestId("reading-progress")).toBeNull();
  });

  test("reading progress on case studies, without active section", () => {
    pathname.mockReturnValue("/cyvore");
    active.mockReturnValue("about");
    render(<PillNav />);
    expect(screen.getByTestId("reading-progress")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "About" })).not.toHaveAttribute("aria-current");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/shell/pill-nav.test.tsx`
Expected: FAIL, `Failed to resolve import "./pill-nav"`.

- [ ] **Step 3: Implement `src/components/shell/pill-nav.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useScroll } from "motion/react";
import { useActiveSection } from "@/hooks/use-active-section";
import { dur, ease } from "@/lib/motion";

const ITEMS = [
  { id: "projects", label: "Projects" },
  { id: "about", label: "About" },
  { id: "contact", label: "Contact" },
] as const;

const SECTION_IDS = ITEMS.map((i) => i.id);

export function PillNav() {
  const isHome = usePathname() === "/";
  const activeSection = useActiveSection(SECTION_IDS);
  const active = isHome ? activeSection : null;
  const { scrollYProgress } = useScroll();

  return (
    <motion.nav
      aria-label="Primary"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: dur.ui, ease: ease.settle }}
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
    >
      <div className="relative flex gap-2 rounded-full p-1">
        {!isHome && (
          <motion.span
            data-testid="reading-progress"
            aria-hidden
            className="absolute inset-x-4 -top-2 h-0.5 origin-left rounded-full bg-rose"
            style={{ scaleX: scrollYProgress }}
          />
        )}
        {ITEMS.map((item) => {
          const isActive = active === item.id;
          return (
            <Link
              key={item.id}
              href={`/#${item.id}`}
              aria-current={isActive ? "location" : undefined}
              className="relative flex min-h-11 items-center rounded-full border border-rose bg-surface-2/80 px-5 text-xs text-ink backdrop-blur-sm transition-colors duration-(--duration-micro) hover:bg-rose/30"
            >
              {isActive && (
                <motion.span
                  layoutId="pill-active"
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-rose/45"
                  transition={{ duration: dur.ui, ease: ease.settle }}
                />
              )}
              <span className="relative">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </motion.nav>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/shell/pill-nav.test.tsx`
Expected: `4 passed`. If jsdom lacks `window.scrollTo` or `matchMedia` for `useScroll`, add the stubs below to `vitest.setup.ts` and re-run:

```ts
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({ matches: false, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }) as MediaQueryList;
}
window.scrollTo = () => {};
```

- [ ] **Step 5: Commit**

```bash
git add src/components/shell/pill-nav.tsx src/components/shell/pill-nav.test.tsx vitest.setup.ts
git commit -m "feat: add floating pill nav with active highlight and reading progress

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Back button

**Files:**
- Create: `src/components/shell/back-button.tsx`
- Test: `src/components/shell/back-button.test.tsx`

It links to `/#<slug>`. Phase 2 gives each project card `id={slug}`, so this lands on the exact card the visitor came from.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { BackButton } from "./back-button";

test("returns to the originating card on home", () => {
  render(<BackButton slug="cyvore" />);
  const link = screen.getByRole("link", { name: "Back to projects" });
  expect(link).toHaveAttribute("href", "/#cyvore");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/shell/back-button.test.tsx`
Expected: FAIL, `Failed to resolve import "./back-button"`.

- [ ] **Step 3: Implement `src/components/shell/back-button.tsx`**

```tsx
import Link from "next/link";

export function BackButton({ slug }: { slug: string }) {
  return (
    <Link
      href={`/#${slug}`}
      aria-label="Back to projects"
      className="fixed left-6 top-6 z-50 flex size-11 items-center justify-center rounded-full bg-ink text-bg transition-transform duration-(--duration-micro) ease-(--ease-settle) hover:-translate-x-0.5"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/shell/back-button.test.tsx`
Expected: `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/components/shell/back-button.tsx src/components/shell/back-button.test.tsx
git commit -m "feat: add case-study back button

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Layout and route skeletons

**Files:**
- Modify (replace contents): `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `src/app/pulse/page.tsx`, `src/app/cyvore/page.tsx`, `src/app/eventread/page.tsx`
- Delete: unused scaffold assets in `public/` (`next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg`)

The pages are deliberately minimal. Phases 2 and 3 replace their content. They exist now so the shell, anchors, redirects and deploy can be verified end to end.

- [ ] **Step 1: Replace `src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { fontVariables } from "./fonts";
import { SmoothScroll } from "@/components/providers/smooth-scroll";
import { PillNav } from "@/components/shell/pill-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Liam Hasson | Product Designer",
  description: "Product designer who researches, prototypes and ships products people trust.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-bg"
        >
          Skip to content
        </a>
        <SmoothScroll>
          <main id="main">{children}</main>
          <PillNav />
        </SmoothScroll>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Replace `src/app/page.tsx`**

```tsx
export default function Home() {
  return (
    <>
      <section className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-2xl">Hi, I&rsquo;m Liam</p>
        <h1 className="text-5xl font-bold uppercase">Product Designer</h1>
      </section>
      <section id="projects" className="min-h-dvh px-16 py-24">
        <h2 className="text-5xl font-bold uppercase">Projects</h2>
      </section>
      <section id="about" className="min-h-dvh px-16 py-24">
        <h2 className="text-5xl font-bold uppercase">About me</h2>
      </section>
      <section id="contact" className="min-h-dvh px-16 py-24 text-center">
        <p>If you made it here,</p>
        <h2 className="font-accent text-5xl italic text-rose">let&rsquo;s just talk?</h2>
      </section>
    </>
  );
}
```

- [ ] **Step 3: Create `src/app/cyvore/page.tsx`**

```tsx
import type { Metadata } from "next";
import { BackButton } from "@/components/shell/back-button";

export const metadata: Metadata = { title: "Cyvore case study | Liam Hasson" };

export default function CyvorePage() {
  return (
    <article className="min-h-[200dvh] px-16 pt-32">
      <BackButton slug="cyvore" />
      <h1 className="text-6xl font-bold uppercase">Cyvore</h1>
    </article>
  );
}
```

- [ ] **Step 4: Create `src/app/pulse/page.tsx`**

```tsx
import type { Metadata } from "next";
import { BackButton } from "@/components/shell/back-button";

export const metadata: Metadata = { title: "Pulse case study | Liam Hasson" };

export default function PulsePage() {
  return (
    <article className="min-h-[200dvh] px-16 pt-32">
      <BackButton slug="pulse" />
      <h1 className="text-6xl font-bold uppercase">Pulse</h1>
    </article>
  );
}
```

- [ ] **Step 5: Create `src/app/eventread/page.tsx`**

```tsx
import type { Metadata } from "next";
import { BackButton } from "@/components/shell/back-button";

export const metadata: Metadata = { title: "Eventread case study | Liam Hasson" };

export default function EventreadPage() {
  return (
    <article className="min-h-[200dvh] px-16 pt-32">
      <BackButton slug="eventread" />
      <h1 className="text-6xl font-bold uppercase">Eventread</h1>
    </article>
  );
}
```

- [ ] **Step 6: Remove scaffold assets**

```bash
rm -f public/next.svg public/vercel.svg public/file.svg public/globe.svg public/window.svg
```

- [ ] **Step 7: Verify unit tests and build**

Run: `npm test && npm run build`
Expected: all tests pass. The route table lists `/`, `/cyvore`, `/eventread`, `/pulse` as static (○).

- [ ] **Step 8: Visual check in the in-app browser**

Start the dev server with the in-app browser's `preview_start` (name `portfolio-dev`) and check at 1440×900:
1. Black page, Host Grotesk text, pill nav fades up at the bottom center.
2. Scrolling is smooth (Lenis) with a trackpad or mouse.
3. Scrolling into Projects / About / Contact slides the rose highlight to the matching pill.
4. Clicking "Contact" scrolls smoothly to the contact section.
5. On `/cyvore`, the back button sits top-left, the progress line fills as you scroll, and clicking back lands on home.
6. With emulated reduced motion, there's no smooth scroll and the nav appears without travel.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add root layout, home and case-study route skeletons

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Smoke e2e tests

**Files:**
- Create: `e2e/smoke.spec.ts`

- [ ] **Step 1: Write the tests**

```ts
import { expect, test } from "@playwright/test";

for (const path of ["/", "/pulse", "/cyvore", "/eventread"]) {
  test(`${path} renders with nav`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
}

for (const slug of ["pulse", "cyvore", "eventread"]) {
  test(`legacy /${slug}-case-study redirects to /${slug}`, async ({ page }) => {
    await page.goto(`/${slug}-case-study`);
    await expect(page).toHaveURL(new RegExp(`/${slug}$`));
  });
}

test("skip link moves focus to main content", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
});
```

- [ ] **Step 2: Run them**

Run: `npm run test:e2e`
Expected: `8 passed`.

- [ ] **Step 3: Commit**

```bash
git add e2e
git commit -m "test: add route, redirect and skip-link smoke tests

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Media pipeline and particle asset

**Files:**
- Create: `scripts/encode-video.sh`
- Create: `public/media/particles.webm`, `public/media/particles.mp4`, `public/media/particles.jpg`

The source is the live site's particle video (`1d9fe745…`, 1920×1080, 24fps, 6.25s). Its compact-sphere phase is around 2.5–4.2s, so the poster frame is taken at 3.3s. Phase 2's loader hands off at that frame.

- [ ] **Step 1: Create `scripts/encode-video.sh`**

```bash
#!/usr/bin/env bash
# Encode a source clip into the site's web formats.
# Usage: scripts/encode-video.sh <input> <output-path-without-extension> [max-width=1920] [poster-second=0]
set -euo pipefail

in="$1"
out="$2"
width="${3:-1920}"
poster_at="${4:-0}"
scale="scale='min(${width},iw)':-2"

ffmpeg -v error -y -i "$in" -vf "$scale" -an -c:v libsvtav1 -crf 38 -preset 6 -pix_fmt yuv420p "${out}.webm"
ffmpeg -v error -y -i "$in" -vf "$scale" -an -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p -movflags +faststart "${out}.mp4"
ffmpeg -v error -y -ss "$poster_at" -i "$in" -frames:v 1 -vf "$scale" -q:v 3 "${out}.jpg"

ls -lh "${out}".webm "${out}".mp4 "${out}".jpg
```

```bash
chmod +x scripts/encode-video.sh
```

- [ ] **Step 2: Fetch the source and encode**

```bash
mkdir -p public/media .media-src
curl -sL -o .media-src/particles.mp4 "https://liamhasson.figma.site/_videos/v1/1d9fe745bc7d42f6f607fbcdd3afa31b1c3a01d6"
scripts/encode-video.sh .media-src/particles.mp4 public/media/particles 1920 3.3
```

Expected: three files listed. `particles.webm` is clearly smaller than the 7.4MB source; `particles.mp4` is ≤ 5MB.

- [ ] **Step 3: Keep source clips out of git**

Append to `.gitignore`:

```
# raw media sources (re-downloadable)
.media-src/
```

- [ ] **Step 4: Verify the poster shows the compact sphere**

Open `public/media/particles.jpg` with the Read tool. Expected: a compact round particle sphere on black. If it's mid-morph, re-run Step 2 with a poster second between 2.6 and 4.0 until it shows the sphere.

- [ ] **Step 5: Commit**

```bash
git add scripts/encode-video.sh public/media .gitignore
git commit -m "feat: add video encode pipeline and particle cloud asset

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: GitHub repo and Vercel preview deploy

**Files:** none (infrastructure)

- [ ] **Step 1: Create the GitHub repo (needs Liam)**

The GitHub CLI isn't installed. SSH push works as `Liamhasson`. Ask Liam to create an **empty private repo** named `portfolio` at https://github.com/new (no README, .gitignore or license), and to confirm when done.

- [ ] **Step 2: Push both branches**

```bash
git remote add origin git@github.com:Liamhasson/portfolio.git
git push -u origin main
git push -u origin phase/1-foundation
```

Expected: both pushed, no errors.

- [ ] **Step 3: Connect Vercel**

Use the Vercel connector: discover Liam's team (`list_teams`), then create a project linked to `Liamhasson/portfolio` (framework Next.js, production branch `main`). If the connector can't link a Git repo, ask Liam to import it at https://vercel.com/new (Import Git Repository → `portfolio` → Deploy).

- [ ] **Step 4: Verify the preview deployment**

Find the deployment for branch `phase/1-foundation` (`list_deployments`) and wait until its state is `READY`. If it fails, read the build logs before changing anything. Then open the preview URL in the in-app browser and repeat the Task 12 Step 8 checks. Also confirm `/cyvore-case-study` redirects to `/cyvore`.

- [ ] **Step 5: Hand off for review**

Send Liam the preview URL and a short summary of what to look at. Merge `phase/1-foundation` into `main` only after he approves:

```bash
git checkout main
git merge --no-ff phase/1-foundation -m "Merge phase 1: foundation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push origin main
```

---

## Spec coverage (Phase 1 slice)

| Spec item | Task |
|---|---|
| §5 motion tokens | 3 (TS), 4 (CSS mirror) |
| §5 Lenis desktop-only, off under reduced motion | 8 |
| §5 reduced-motion base | 4 (CSS), 8 |
| §2 fonts (home set) | 4 |
| §4 routes, §4 redirects | 6, 12, 13 |
| §4.4 pill nav, sliding highlight, reading progress | 9, 10 |
| §4.4 back button to originating card | 11 (card ids come in Phase 2) |
| §6 sessionStorage loader flag with try/catch | 7 |
| §6 media pipeline (AV1 + H.264 + poster) | 14 |
| §6 hosting: GitHub + Vercel previews, production on approval | 15 |
| §7 skip link, focus ring | 4, 12, 13 |
| Project registry (cards, next-project footer) | 5 |

Deferred by design: loader, hero, sections and card transitions → Phase 2. Case-study content, project themes and fonts, signature interactions → Phase 3. Tablet/mobile, accessibility and performance passes, SEO, domain → Phase 4.
