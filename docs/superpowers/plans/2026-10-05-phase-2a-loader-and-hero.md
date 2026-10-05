# Phase 2a: Welcome Loader and Hero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The home page opens with the once-per-session welcome loader (dot → greeting → collapse into the particle sphere), hands off to the scroll-scrubbed particle backdrop, and plays in the hero: typed "Hi, I'm Liam" with portrait, the fixed "Product Designer" title, the alternating "I can help you with …" line, and finally the pill nav.

**Architecture:** A tiny external store (`intro-state`) holds the intro phase (`idle → loader → ready`). The loader drives it, and the hero, backdrop video and pill nav react to it, so nothing depends on component order. A synchronous inline script in `<head>` (the pattern from `node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md`) marks `<html data-loader="skip">` before first paint when the loader must not play, so a CSS rule hides the server-rendered overlay with no flash. All timing lives in constants; all logic that can be tested without a browser sits in hooks with unit tests, and the visual sequence is covered by Playwright.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind v4, Motion 13 (`motion/react`), Vitest 5 + Testing Library + jsdom, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-01-portfolio-site-design.md` (§3.1 H1–H6, §4.1, §5, §6 "Loader and SSR", §7).

**This is plan 2a of 2 for Phase 2.** Plan 2b (projects grid with recorded hover loops, toolkit, about, testimonials, contact) is written after 2a is reviewed.

**Branching:** all work happens on `phase/2-home` (already created from `main`). Vercel builds a preview for every push. Merge to `main` only after Liam approves the preview.

**Known open item:** `SPHERE_TIME` (3.5s) and `--loader-sphere` are measured from a contact sheet of `public/media/particles.mp4` and must be confirmed on screen in Task 14.

---

## File map

| File | Responsibility |
|---|---|
| `public/images/liam-avatar.webp` | 120×120 portrait used next to "Hi, I'm Liam" (exported from Figma node `1:211`) |
| `src/content/home.ts` | Hero and loader copy, `joinList`, `heroSentence` |
| `src/lib/intro-state.ts` | Intro phase store (`idle / loader / ready`) with subscribe/get/set/reset |
| `src/hooks/use-intro-phase.ts` | `useIntroPhase()` via `useSyncExternalStore` |
| `src/hooks/use-prefers-reduced-motion.ts` | `usePrefersReducedMotion()` (matchMedia, SSR-safe) |
| `src/lib/loader-gate.ts` | `loaderGateScript` string run in `<head>` before first paint |
| `src/components/providers/inline-script.tsx` | Server-side inline `<script>` helper (React-warning-safe) |
| `src/hooks/use-typewriter.ts` | Per-character reveal, with instant mode |
| `src/hooks/use-phrase-cycle.ts` | Index cycler that pauses when the tab is hidden |
| `src/components/home/hero-line.tsx` | "I can help you with {phrase}" with swap animation and static a11y sentence |
| `src/lib/backdrop.ts` | `SPHERE_TIME`, scroll keyframes for the particle backdrop |
| `src/components/home/particle-backdrop.tsx` | Fixed particle video, scroll-scrubbed opacity and scale, poster under reduced motion |
| `src/lib/loader-timeline.ts` | Loader timing constants |
| `src/hooks/use-loader-sequence.ts` | Loader stage machine (timers, skip events, session flag, intro phase) |
| `src/components/home/welcome-loader.tsx` | The overlay: dot grid, rose glow, typed greeting, fade-out |
| `src/components/home/hero.tsx` | Hero composition and entrance choreography |
| `src/app/layout.tsx` | Adds the inline gate script, `suppressHydrationWarning`, no-JS fallback, `main` stacking |
| `src/app/globals.css` | `.dot-grid`, loader skip rule, caret, `--loader-sphere` |
| `src/app/page.tsx` | Mounts loader, backdrop, hero above the remaining placeholder sections |
| `src/components/shell/pill-nav.tsx` | Waits for the intro on home (`inert` until ready) and fades in last |
| `e2e/home-intro.spec.ts` | Loader once per session, skip, reduced motion, alternating line a11y |

---

### Task 1: Portrait asset

**Files:**
- Create: `public/images/liam-avatar.webp`

- [ ] **Step 1: Export the portrait from Figma**

Call the Figma MCP `get_screenshot` with `fileKey` `65QHzAsnx9NtQxHJwmccXf`, `nodeId` `1:211`, `maxDimension` `120`. It returns an `image_url`. Download it into the scratchpad directory (the session scratchpad given in the system prompt; the commands below use `$SCRATCH` for it):

```bash
curl -sL -o "$SCRATCH/avatar.png" "<image_url from the tool result>"
file "$SCRATCH/avatar.png"
```

Expected: `PNG image data, 120 x 120` (the node is 40×40 in Figma, rendered at 3×).

- [ ] **Step 2: Convert to WebP into the repo**

```bash
mkdir -p public/images
ffmpeg -v error -y -i "$SCRATCH/avatar.png" -c:v libwebp -quality 90 public/images/liam-avatar.webp
ls -l public/images/liam-avatar.webp
```

Expected: a file under 10 KB. Open it with the Read tool and confirm it is the round portrait (the same image as the Figma frame).

- [ ] **Step 3: Commit**

```bash
git add public/images/liam-avatar.webp
git commit -m "feat: add portrait asset

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Home copy

**Files:**
- Create: `src/content/home.ts`
- Test: `src/content/home.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { hero, heroSentence, joinList, loaderGreeting } from "./home";

describe("joinList", () => {
  test("joins with commas and a final 'and'", () => {
    expect(joinList(["a", "b", "c"])).toBe("a, b and c");
  });
  test("handles one and two items", () => {
    expect(joinList(["a"])).toBe("a");
    expect(joinList(["a", "b"])).toBe("a and b");
  });
  test("handles an empty list", () => {
    expect(joinList([])).toBe("");
  });
});

describe("hero copy", () => {
  test("has the six phrases from the spec, in order", () => {
    expect(hero.phrases).toEqual([
      "market research",
      "user research",
      "streamlining workflows",
      "design systems",
      "interaction design",
      "rapid prototyping",
    ]);
  });

  test("static sentence reads as one sentence", () => {
    expect(heroSentence()).toBe(
      "I can help you with market research, user research, streamlining workflows, design systems, interaction design and rapid prototyping.",
    );
  });

  test("loader greeting", () => {
    expect(loaderGreeting).toBe("Hi, I’m Liam. Welcome.");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/content/home.test.ts`
Expected: FAIL (cannot resolve `./home`).

- [ ] **Step 3: Implement `src/content/home.ts`**

```ts
export const hero = {
  greeting: "Hi, I’m Liam",
  title: "Product Designer",
  lead: "I can help you with",
  phrases: [
    "market research",
    "user research",
    "streamlining workflows",
    "design systems",
    "interaction design",
    "rapid prototyping",
  ],
} as const;

export const loaderGreeting = "Hi, I’m Liam. Welcome.";

/** "a, b and c" */
export function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** The single static sentence used by screen readers, reduced motion and no-JS. */
export function heroSentence(): string {
  return `${hero.lead} ${joinList(hero.phrases)}.`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/content/home.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/content/home.ts src/content/home.test.ts
git commit -m "feat: add home hero copy

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Intro phase store

**Files:**
- Create: `src/lib/intro-state.ts`, `src/hooks/use-intro-phase.ts`
- Test: `src/lib/intro-state.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getIntroPhase, resetIntro, setIntroPhase, subscribeIntro } from "./intro-state";

beforeEach(() => resetIntro());

describe("intro state", () => {
  test("starts idle", () => {
    expect(getIntroPhase()).toBe("idle");
  });

  test("notifies subscribers when the phase changes", () => {
    const fn = vi.fn();
    subscribeIntro(fn);
    setIntroPhase("loader");
    expect(getIntroPhase()).toBe("loader");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("does not notify when the phase is unchanged", () => {
    setIntroPhase("ready");
    const fn = vi.fn();
    subscribeIntro(fn);
    setIntroPhase("ready");
    expect(fn).not.toHaveBeenCalled();
  });

  test("unsubscribe stops notifications", () => {
    const fn = vi.fn();
    const off = subscribeIntro(fn);
    off();
    setIntroPhase("ready");
    expect(fn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/intro-state.test.ts`
Expected: FAIL (cannot resolve `./intro-state`).

- [ ] **Step 3: Implement `src/lib/intro-state.ts`**

```ts
/**
 * Where the home intro is. The loader drives it; the hero, particle video and pill nav react to it.
 * idle   = nothing has started (server render, or a page without the loader)
 * loader = the welcome loader is playing
 * ready  = the intro is over (played, skipped, or not needed): content may play in
 */
export type IntroPhase = "idle" | "loader" | "ready";

let phase: IntroPhase = "idle";
const listeners = new Set<() => void>();

export function getIntroPhase(): IntroPhase {
  return phase;
}

export function setIntroPhase(next: IntroPhase): void {
  if (next === phase) return;
  phase = next;
  listeners.forEach((l) => l());
}

export function subscribeIntro(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test helper. */
export function resetIntro(): void {
  setIntroPhase("idle");
}
```

- [ ] **Step 4: Implement `src/hooks/use-intro-phase.ts`**

```ts
"use client";

import { useSyncExternalStore } from "react";
import { getIntroPhase, subscribeIntro, type IntroPhase } from "@/lib/intro-state";

export function useIntroPhase(): IntroPhase {
  return useSyncExternalStore(subscribeIntro, getIntroPhase, () => "idle");
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/intro-state.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/intro-state.ts src/lib/intro-state.test.ts src/hooks/use-intro-phase.ts
git commit -m "feat: add intro phase store

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Reduced-motion hook

**Files:**
- Create: `src/hooks/use-prefers-reduced-motion.ts`
- Test: `src/hooks/use-prefers-reduced-motion.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("usePrefersReducedMotion", () => {
  test("true when the user prefers reduced motion", () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
  });

  test("false otherwise", () => {
    stubMatchMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });

  test("false when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/hooks/use-prefers-reduced-motion.test.tsx`
Expected: FAIL (cannot resolve the hook).

- [ ] **Step 3: Implement the hook**

```ts
"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(QUERY).matches;
}

/** True when the user asked the OS/browser for reduced motion. Server render assumes false. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/hooks/use-prefers-reduced-motion.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-prefers-reduced-motion.ts src/hooks/use-prefers-reduced-motion.test.tsx
git commit -m "feat: add reduced-motion hook

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Loader gate script, layout wiring and base CSS

The loader overlay is server-rendered so there is no flash of the hero underneath. This task makes sure it is *hidden before first paint* whenever it must not play: on a repeat visit within the session, and when the session started on a non-home page.

**Files:**
- Create: `src/lib/loader-gate.ts`, `src/components/providers/inline-script.tsx`
- Modify: `src/app/layout.tsx`, `src/app/globals.css`
- Test: `src/lib/loader-gate.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { loaderGateScript } from "./loader-gate";
import { LOADER_SEEN_KEY } from "./session-flags";

function run() {
  new Function(loaderGateScript)();
}

beforeEach(() => {
  sessionStorage.clear();
  document.documentElement.removeAttribute("data-loader");
  window.history.pushState({}, "", "/");
});
afterEach(() => vi.restoreAllMocks());

describe("loaderGateScript", () => {
  test("first arrival on home: leaves the loader to play", () => {
    run();
    expect(document.documentElement).not.toHaveAttribute("data-loader");
    expect(sessionStorage.getItem(LOADER_SEEN_KEY)).toBeNull();
  });

  test("repeat visit to home in the same session: skips the loader", () => {
    sessionStorage.setItem(LOADER_SEEN_KEY, "1");
    run();
    expect(document.documentElement).toHaveAttribute("data-loader", "skip");
  });

  test("session that starts on a case study: marks the loader seen and skips it", () => {
    window.history.pushState({}, "", "/cyvore");
    run();
    expect(sessionStorage.getItem(LOADER_SEEN_KEY)).toBe("1");
    expect(document.documentElement).toHaveAttribute("data-loader", "skip");
  });

  test("blocked storage never throws and the loader still plays", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(run).not.toThrow();
    expect(document.documentElement).not.toHaveAttribute("data-loader");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/loader-gate.test.ts`
Expected: FAIL (cannot resolve `./loader-gate`).

- [ ] **Step 3: Implement `src/lib/loader-gate.ts`**

```ts
import { LOADER_SEEN_KEY } from "./session-flags";

/**
 * Runs synchronously in <head> on every full page load, before first paint.
 * - Loader already seen this session → mark <html data-loader="skip"> so CSS hides the overlay.
 * - Session starts on any page other than "/" → record the loader as seen (it plays on first arrival only)
 *   and skip it.
 * Storage errors are swallowed: the loader then plays, which is acceptable.
 */
export const loaderGateScript = `(function(){try{var s=window.sessionStorage;var k=${JSON.stringify(
  LOADER_SEEN_KEY,
)};if(s.getItem(k)!=="1"&&location.pathname!=="/"){s.setItem(k,"1")}if(s.getItem(k)==="1"){document.documentElement.setAttribute("data-loader","skip")}}catch(e){}})();`;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/loader-gate.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Create `src/components/providers/inline-script.tsx`** (the helper from the Next guide: a real script on the server, inert on the client so React does not warn about rendered `<script>` tags)

```tsx
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
```

- [ ] **Step 6: Replace `src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { fontVariables } from "./fonts";
import { InlineScript } from "@/components/providers/inline-script";
import { MotionPreferences } from "@/components/providers/motion-preferences";
import { SmoothScroll } from "@/components/providers/smooth-scroll";
import { PillNav } from "@/components/shell/pill-nav";
import { loaderGateScript } from "@/lib/loader-gate";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Liam Hasson | Product Designer", template: "%s | Liam Hasson" },
  description: "Product designer who researches, prototypes and ships products people trust.",
};

// Without JS the intro never runs: show everything and drop the loader.
const NO_JS_CSS = ".intro-hidden{opacity:1!important;transform:none!important}[data-intro-loader]{display:none!important}";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the gate script sets data-loader on <html> before React hydrates.
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <head>
        <InlineScript html={loaderGateScript} />
      </head>
      <body>
        <noscript>
          <style>{NO_JS_CSS}</style>
        </noscript>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-bg"
        >
          Skip to content
        </a>
        <MotionPreferences>
          <SmoothScroll>
            <main id="main" tabIndex={-1} className="relative z-10 outline-none">{children}</main>
            <PillNav />
          </SmoothScroll>
        </MotionPreferences>
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Append to `src/app/globals.css`** (after the existing content)

```css

/* Home intro */
:root {
  /* Diameter of the compact sphere in the particle video at the loader handoff. Tuned in Task 14. */
  --loader-sphere: min(48vmax, 720px);
}

/* The gate script (in <head>) sets this before first paint when the loader must not play. */
html[data-loader="skip"] [data-intro-loader] {
  display: none;
}

.dot-grid {
  background-image: radial-gradient(rgb(247 250 252 / 0.16) 1px, transparent 1.5px);
  background-size: 28px 28px;
  mask-image: linear-gradient(to bottom, #000 0%, #000 55%, transparent 100%);
}

@keyframes caret-blink {
  50% {
    opacity: 0;
  }
}

.caret {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 2px;
  vertical-align: -0.12em;
  background: currentColor;
  animation: caret-blink 1s steps(1) infinite;
}
```

- [ ] **Step 8: Verify the build and existing tests still pass**

Run: `npm run lint && npx vitest run && npm run build`
Expected: lint clean, all tests pass (existing 31 plus the new ones), build succeeds with routes `/`, `/cyvore`, `/eventread`, `/pulse`. If `@next/next/no-head-element` fires on the `<head>` in the layout, move the inline script into `<body>` as the first child instead (the script still runs before first paint because it is parsed before any content).

- [ ] **Step 9: Commit**

```bash
git add src/lib/loader-gate.ts src/lib/loader-gate.test.ts src/components/providers/inline-script.tsx src/app/layout.tsx src/app/globals.css
git commit -m "feat: gate the loader before first paint and add intro base styles

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Typewriter hook

**Files:**
- Create: `src/hooks/use-typewriter.ts`
- Test: `src/hooks/use-typewriter.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useTypewriter } from "./use-typewriter";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useTypewriter", () => {
  test("shows nothing until enabled, then types one character per tick after the start delay", () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useTypewriter("Hi", { enabled, charMs: 10, startDelayMs: 20 }),
      { initialProps: { enabled: false } },
    );
    expect(result.current).toEqual({ shown: "", done: false });

    rerender({ enabled: true });
    act(() => vi.advanceTimersByTime(20));
    expect(result.current.shown).toBe("");

    act(() => vi.advanceTimersByTime(10));
    expect(result.current).toEqual({ shown: "H", done: false });

    act(() => vi.advanceTimersByTime(10));
    expect(result.current).toEqual({ shown: "Hi", done: true });
  });

  test("instant mode shows the full text immediately", () => {
    const { result } = renderHook(() => useTypewriter("Hello", { enabled: false, instant: true }));
    expect(result.current).toEqual({ shown: "Hello", done: true });
  });

  test("disabling hides the text again", () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useTypewriter("Hi", { enabled, charMs: 10 }),
      { initialProps: { enabled: true } },
    );
    act(() => vi.advanceTimersByTime(20));
    expect(result.current.shown).toBe("Hi");
    rerender({ enabled: false });
    expect(result.current).toEqual({ shown: "", done: false });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/hooks/use-typewriter.test.tsx`
Expected: FAIL (cannot resolve the hook).

- [ ] **Step 3: Implement `src/hooks/use-typewriter.ts`**

```ts
"use client";

import { useEffect, useState } from "react";

interface Options {
  /** Typing starts when this becomes true and the text is hidden while false. */
  enabled: boolean;
  /** Show the full text at once (reduced motion). */
  instant?: boolean;
  charMs?: number;
  startDelayMs?: number;
}

/** Reveals `text` one character at a time. */
export function useTypewriter(
  text: string,
  { enabled, instant = false, charMs = 45, startDelayMs = 0 }: Options,
): { shown: string; done: boolean } {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled || instant) return;
    let interval: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      let i = 0;
      setCount(0);
      interval = setInterval(() => {
        i += 1;
        setCount(i);
        if (i >= text.length) clearInterval(interval);
      }, charMs);
    }, startDelayMs);
    return () => {
      clearTimeout(start);
      clearInterval(interval);
    };
  }, [text, enabled, instant, charMs, startDelayMs]);

  if (instant) return { shown: text, done: true };
  if (!enabled) return { shown: "", done: false };
  return { shown: text.slice(0, count), done: count >= text.length };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/hooks/use-typewriter.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-typewriter.ts src/hooks/use-typewriter.test.tsx
git commit -m "feat: add typewriter hook

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Alternating hero line

**Files:**
- Create: `src/hooks/use-phrase-cycle.ts`, `src/components/home/hero-line.tsx`
- Test: `src/hooks/use-phrase-cycle.test.tsx`, `src/components/home/hero-line.test.tsx`

- [ ] **Step 1: Write the failing hook test**

`src/hooks/use-phrase-cycle.test.tsx`:

```tsx
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { usePhraseCycle } from "./use-phrase-cycle";

let hidden = false;
beforeEach(() => {
  vi.useFakeTimers();
  hidden = false;
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
});
afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(document, "hidden");
});

function setHidden(value: boolean) {
  hidden = value;
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("usePhraseCycle", () => {
  test("advances every interval and wraps around", () => {
    const { result } = renderHook(() => usePhraseCycle(3, 1000, true));
    expect(result.current).toBe(0);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBe(1);
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current).toBe(0);
  });

  test("stays on the first phrase while inactive", () => {
    const { result } = renderHook(() => usePhraseCycle(3, 1000, false));
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current).toBe(0);
  });

  test("pauses while the tab is hidden and resumes when it is visible again", () => {
    const { result } = renderHook(() => usePhraseCycle(3, 1000, true));
    act(() => setHidden(true));
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current).toBe(0);
    act(() => setHidden(false));
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBe(1);
  });

  test("does nothing with a single phrase", () => {
    const { result } = renderHook(() => usePhraseCycle(1, 1000, true));
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/hooks/use-phrase-cycle.test.tsx`
Expected: FAIL (cannot resolve the hook).

- [ ] **Step 3: Implement `src/hooks/use-phrase-cycle.ts`**

```ts
"use client";

import { useEffect, useState } from "react";

/** Index that advances every `intervalMs` while `active`, pausing while the tab is hidden. */
export function usePhraseCycle(count: number, intervalMs: number, active: boolean): number {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active || count < 2) return;
    let id: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      if (id === undefined) id = setInterval(() => setIndex((i) => (i + 1) % count), intervalMs);
    };
    const stop = () => {
      if (id !== undefined) {
        clearInterval(id);
        id = undefined;
      }
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [count, intervalMs, active]);

  return index;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/hooks/use-phrase-cycle.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the failing component test**

`src/components/home/hero-line.test.tsx`:

```tsx
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { hero, heroSentence } from "@/content/home";
import { resetIntro, setIntroPhase } from "@/lib/intro-state";
import { HeroLine, PHRASE_INTERVAL_MS } from "./hero-line";

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  resetIntro();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("HeroLine", () => {
  test("exposes one static sentence to assistive tech", () => {
    stubReducedMotion(false);
    render(<HeroLine />);
    const sentence = screen.getAllByText(heroSentence());
    expect(sentence.some((el) => el.classList.contains("sr-only"))).toBe(true);
  });

  test("hides the animated line from assistive tech", () => {
    stubReducedMotion(false);
    const { container } = render(<HeroLine />);
    expect(container.querySelector("[aria-hidden='true']")).not.toBeNull();
  });

  test("starts on the first phrase and moves on after the interval once the intro is ready", () => {
    stubReducedMotion(false);
    render(<HeroLine />);
    act(() => setIntroPhase("ready"));
    expect(screen.getByText(hero.phrases[0])).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(PHRASE_INTERVAL_MS));
    expect(screen.getByText(hero.phrases[1])).toBeInTheDocument();
  });

  test("does not cycle before the intro is ready", () => {
    stubReducedMotion(false);
    render(<HeroLine />);
    act(() => vi.advanceTimersByTime(PHRASE_INTERVAL_MS * 3));
    expect(screen.getByText(hero.phrases[0])).toBeInTheDocument();
    expect(screen.queryByText(hero.phrases[1])).toBeNull();
  });

  test("reduced motion shows the static sentence and never cycles", () => {
    stubReducedMotion(true);
    render(<HeroLine />);
    act(() => setIntroPhase("ready"));
    act(() => vi.advanceTimersByTime(PHRASE_INTERVAL_MS * 3));
    expect(screen.getAllByText(heroSentence()).length).toBe(2); // sr-only + visible copy
    expect(screen.queryByText(hero.phrases[1])).toBeNull();
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run src/components/home/hero-line.test.tsx`
Expected: FAIL (cannot resolve `./hero-line`).

- [ ] **Step 7: Implement `src/components/home/hero-line.tsx`**

```tsx
"use client";

import { AnimatePresence, motion } from "motion/react";
import { hero, heroSentence } from "@/content/home";
import { useIntroPhase } from "@/hooks/use-intro-phase";
import { usePhraseCycle } from "@/hooks/use-phrase-cycle";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { distance, dur, ease } from "@/lib/motion";

export const PHRASE_INTERVAL_MS = 2400;
const SWAP_DISTANCE = distance.text * 0.5;

/**
 * "I can help you with {phrase}". The phrase swaps with a short vertical slide-and-fade; the lead text
 * glides to its new position as the phrase width changes (layout="position"), so there is no jump.
 * Assistive tech gets one static sentence; the animated copy is aria-hidden.
 */
export function HeroLine() {
  const reduced = usePrefersReducedMotion();
  const ready = useIntroPhase() === "ready";
  const index = usePhraseCycle(hero.phrases.length, PHRASE_INTERVAL_MS, ready && !reduced);
  const phrase = hero.phrases[index];
  const move = { duration: dur.ui, ease: ease.settle };

  return (
    <p className="text-lg text-ink-2 sm:text-2xl">
      <span className="sr-only">{heroSentence()}</span>
      <span aria-hidden="true" className="inline-flex items-baseline justify-center gap-[0.35em]">
        {reduced ? (
          <span>{heroSentence()}</span>
        ) : (
          <>
            <motion.span layout="position" transition={move}>
              {hero.lead}
            </motion.span>
            <span className="relative inline-flex">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={phrase}
                  className="font-accent whitespace-nowrap italic text-rose-soft"
                  initial={{ opacity: 0, y: SWAP_DISTANCE }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -SWAP_DISTANCE }}
                  transition={move}
                >
                  {phrase}
                </motion.span>
              </AnimatePresence>
            </span>
          </>
        )}
      </span>
    </p>
  );
}
```

- [ ] **Step 8: Run it to verify it passes**

Run: `npx vitest run src/components/home/hero-line.test.tsx`
Expected: PASS (5 tests). If the phrase-swap test fails because the exiting phrase is still in the DOM while its exit animation runs, assert on the entering phrase with `getAllByText` instead of `getByText`; do not change the component.

- [ ] **Step 9: Commit**

```bash
git add src/hooks/use-phrase-cycle.ts src/hooks/use-phrase-cycle.test.tsx src/components/home/hero-line.tsx src/components/home/hero-line.test.tsx
git commit -m "feat: add alternating hero line

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Particle backdrop

**Files:**
- Create: `src/lib/backdrop.ts`, `src/components/home/particle-backdrop.tsx`
- Test: `src/lib/backdrop.test.ts`, `src/components/home/particle-backdrop.test.tsx`

- [ ] **Step 1: Write the failing keyframe test**

`src/lib/backdrop.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { BACKDROP, SPHERE_TIME } from "./backdrop";

describe("backdrop keyframes", () => {
  for (const [name, frames] of Object.entries({ opacity: BACKDROP.opacity, scale: BACKDROP.scale })) {
    test(`${name}: input and output line up and input is strictly increasing`, () => {
      expect(frames.input.length).toBe(frames.output.length);
      for (let i = 1; i < frames.input.length; i++) {
        expect(frames.input[i]).toBeGreaterThan(frames.input[i - 1]);
      }
    });
  }

  test("matches the live site: starts dim at 1.6× and ends fully faded", () => {
    expect(BACKDROP.opacity.output[0]).toBeCloseTo(0.24);
    expect(BACKDROP.opacity.output.at(-1)).toBe(0);
    expect(BACKDROP.scale.output[0]).toBeCloseTo(1.6);
    expect(BACKDROP.scale.output.at(-1)).toBe(5);
  });

  test("the sphere frame is inside the 6.2s loop", () => {
    expect(SPHERE_TIME).toBeGreaterThan(0);
    expect(SPHERE_TIME).toBeLessThan(6.2);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/backdrop.test.ts`
Expected: FAIL (cannot resolve `./backdrop`).

- [ ] **Step 3: Implement `src/lib/backdrop.ts`**

```ts
/** Seconds into `particles.mp4` where the cloud has collapsed into a compact sphere (clean from ~2.5s to ~5s). */
export const SPHERE_TIME = 3.5;

/**
 * Scroll-scrubbed backdrop (spec H3): dim at first, fully visible through the hero and projects, gone by ~3900px;
 * scales from 1.6× to 5×. Inputs are scroll offsets in px.
 */
export const BACKDROP = {
  opacity: { input: [0, 600, 2800, 3900], output: [0.24, 1, 1, 0] },
  scale: { input: [0, 3300], output: [1.6, 5] },
} as const;
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/lib/backdrop.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the failing component test**

`src/components/home/particle-backdrop.test.tsx`:

```tsx
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { resetIntro, setIntroPhase } from "@/lib/intro-state";
import { SPHERE_TIME } from "@/lib/backdrop";
import { ParticleBackdrop } from "./particle-backdrop";

vi.mock("next/image", () => ({
  default: ({ priority, fill, ...rest }: React.ComponentProps<"img"> & { priority?: boolean; fill?: boolean }) => {
    void priority;
    void fill;
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt="" {...rest} />;
  },
}));

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

let pause: ReturnType<typeof vi.spyOn>;
let play: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetIntro();
  pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ParticleBackdrop", () => {
  test("renders a muted looping video with both formats and a poster", () => {
    stubReducedMotion(false);
    const { container } = render(<ParticleBackdrop />);
    const video = container.querySelector("video")!;
    expect(video).not.toBeNull();
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(true);
    expect(video).toHaveAttribute("poster", "/media/particles.jpg");
    const sources = [...container.querySelectorAll("source")].map((s) => s.getAttribute("src"));
    expect(sources).toEqual(["/media/particles.webm", "/media/particles.mp4"]);
  });

  test("is decorative: hidden from assistive tech and not focusable", () => {
    stubReducedMotion(false);
    const { container } = render(<ParticleBackdrop />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("video")).toHaveAttribute("tabindex", "-1");
  });

  test("while the loader plays, holds on the sphere frame", () => {
    stubReducedMotion(false);
    const { container } = render(<ParticleBackdrop />);
    const video = container.querySelector("video")!;
    act(() => setIntroPhase("loader"));
    act(() => {
      video.dispatchEvent(new Event("loadedmetadata"));
    });
    expect(pause).toHaveBeenCalled();
    expect(video.currentTime).toBe(SPHERE_TIME);
    expect(play).not.toHaveBeenCalled();
  });

  test("starts playing when the intro is ready", () => {
    stubReducedMotion(false);
    render(<ParticleBackdrop />);
    act(() => setIntroPhase("ready"));
    expect(play).toHaveBeenCalled();
  });

  test("reduced motion: static poster, no video", () => {
    stubReducedMotion(true);
    const { container } = render(<ParticleBackdrop />);
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("img")).toHaveAttribute("src", "/media/particles.jpg");
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run src/components/home/particle-backdrop.test.tsx`
Expected: FAIL (cannot resolve `./particle-backdrop`).

- [ ] **Step 7: Implement `src/components/home/particle-backdrop.tsx`**

```tsx
"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform } from "motion/react";
import { useIntroPhase } from "@/hooks/use-intro-phase";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { BACKDROP, SPHERE_TIME } from "@/lib/backdrop";

const POSTER = "/media/particles.jpg";

/**
 * Fixed full-viewport particle video behind the page (spec H3). Opacity and scale are scrubbed by scroll in
 * both directions. While the loader plays the video holds on its sphere frame; it starts when the intro is ready,
 * so the loader's sphere becomes the particle cloud. Reduced motion: static poster, no scrub.
 */
export function ParticleBackdrop() {
  const reduced = usePrefersReducedMotion();
  const phase = useIntroPhase();
  const videoRef = useRef<HTMLVideoElement>(null);
  const { scrollY } = useScroll();
  const opacity = useTransform(scrollY, [...BACKDROP.opacity.input], [...BACKDROP.opacity.output]);
  const scale = useTransform(scrollY, [...BACKDROP.scale.input], [...BACKDROP.scale.output]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (phase === "loader") {
      video.pause();
      const seek = () => {
        video.currentTime = SPHERE_TIME;
      };
      if (video.readyState >= 1) seek();
      else video.addEventListener("loadedmetadata", seek, { once: true });
      return () => video.removeEventListener("loadedmetadata", seek);
    }
    if (phase === "ready") {
      void video.play().catch(() => {});
    }
  }, [phase]);

  if (reduced) {
    return (
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 opacity-60">
        <Image src={POSTER} alt="" fill priority sizes="100vw" className="object-cover" />
      </div>
    );
  }

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <motion.div className="h-full w-full mix-blend-screen" style={{ opacity, scale }}>
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          preload="auto"
          poster={POSTER}
          tabIndex={-1}
          className="h-full w-full object-cover"
        >
          <source src="/media/particles.webm" type="video/webm" />
          <source src="/media/particles.mp4" type="video/mp4" />
        </video>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 8: Run it to verify it passes**

Run: `npx vitest run src/components/home/particle-backdrop.test.tsx`
Expected: PASS (5 tests). Note: jsdom has no `matchMedia`-driven `muted` reflection issues; if `video.muted` is `false` because React sets `muted` as a property after mount, assert `video.defaultMuted` or the `muted` attribute instead.

- [ ] **Step 9: Commit**

```bash
git add src/lib/backdrop.ts src/lib/backdrop.test.ts src/components/home/particle-backdrop.tsx src/components/home/particle-backdrop.test.tsx
git commit -m "feat: add scroll-scrubbed particle backdrop

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Welcome loader

**Files:**
- Create: `src/lib/loader-timeline.ts`, `src/hooks/use-loader-sequence.ts`, `src/components/home/welcome-loader.tsx`
- Test: `src/lib/loader-timeline.test.ts`, `src/hooks/use-loader-sequence.test.tsx`, `src/components/home/welcome-loader.test.tsx`

- [ ] **Step 1: Write the failing timeline test**

`src/lib/loader-timeline.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { LOADER } from "./loader-timeline";

describe("loader timeline", () => {
  test("stages are ordered and the whole loader fits the 3.2s budget", () => {
    const { field, collapse, handoff, done } = LOADER.at;
    expect(field).toBeGreaterThan(0);
    expect(collapse).toBeGreaterThan(field);
    expect(handoff).toBeGreaterThan(collapse);
    expect(done).toBeGreaterThan(handoff);
    expect(done).toBeLessThanOrEqual(3200);
  });

  test("the greeting finishes typing before the collapse", () => {
    const typingEnds = LOADER.at.field + LOADER.typeDelayMs + 22 * LOADER.charMs; // "Hi, I’m Liam. Welcome." = 22 chars
    expect(typingEnds).toBeLessThan(LOADER.at.collapse);
  });

  test("reduced motion is a 300ms fade", () => {
    expect(LOADER.reducedMs).toBe(300);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/loader-timeline.test.ts`
Expected: FAIL (cannot resolve `./loader-timeline`).

- [ ] **Step 3: Implement `src/lib/loader-timeline.ts`**

```ts
/** Milliseconds from the start of the loader. Total ≤ 3.2s (spec §4.1). */
export const LOADER = {
  at: {
    /** The point begins to expand into a soft rose field and the greeting starts typing. */
    field: 250,
    /** The field collapses into a compact sphere; the greeting fades out. */
    collapse: 1800,
    /** The overlay fades out, revealing the particle video on its sphere frame. */
    handoff: 2500,
    /** The overlay is removed and the hero plays in. */
    done: 3100,
  },
  /** Delay after `field` before the first character. */
  typeDelayMs: 250,
  charMs: 38,
  reducedMs: 300,
} as const;
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/lib/loader-timeline.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing sequence-hook test**

`src/hooks/use-loader-sequence.test.tsx`:

```tsx
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getIntroPhase, resetIntro } from "@/lib/intro-state";
import { LOADER } from "@/lib/loader-timeline";
import { LOADER_SEEN_KEY } from "@/lib/session-flags";
import { useLoaderSequence } from "./use-loader-sequence";

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  document.documentElement.removeAttribute("data-loader");
  resetIntro();
});
afterEach(() => vi.useRealTimers());

describe("useLoaderSequence", () => {
  test("walks through the stages on schedule and finishes the intro", () => {
    const { result } = renderHook(() => useLoaderSequence(false));
    expect(result.current).toBe("dot");
    expect(getIntroPhase()).toBe("loader");

    act(() => vi.advanceTimersByTime(LOADER.at.field));
    expect(result.current).toBe("field");
    act(() => vi.advanceTimersByTime(LOADER.at.collapse - LOADER.at.field));
    expect(result.current).toBe("collapse");
    act(() => vi.advanceTimersByTime(LOADER.at.handoff - LOADER.at.collapse));
    expect(result.current).toBe("handoff");
    expect(getIntroPhase()).toBe("loader");
    act(() => vi.advanceTimersByTime(LOADER.at.done - LOADER.at.handoff));
    expect(result.current).toBe("done");
    expect(getIntroPhase()).toBe("ready");
    expect(sessionStorage.getItem(LOADER_SEEN_KEY)).toBe("1");
    // so a later client-side return to home never flashes the overlay
    expect(document.documentElement).toHaveAttribute("data-loader", "skip");
  });

  test("is skipped when it has already played this session", () => {
    sessionStorage.setItem(LOADER_SEEN_KEY, "1");
    const { result } = renderHook(() => useLoaderSequence(false));
    act(() => vi.advanceTimersByTime(0));
    expect(result.current).toBe("done");
    expect(getIntroPhase()).toBe("ready");
  });

  for (const eventName of ["pointerdown", "keydown", "wheel", "touchstart"]) {
    test(`${eventName} skips it`, () => {
      const { result } = renderHook(() => useLoaderSequence(false));
      act(() => vi.advanceTimersByTime(LOADER.at.field));
      act(() => {
        window.dispatchEvent(new Event(eventName));
      });
      expect(result.current).toBe("done");
      expect(getIntroPhase()).toBe("ready");
    });
  }

  test("reduced motion is a 300ms fade", () => {
    const { result } = renderHook(() => useLoaderSequence(true));
    act(() => vi.advanceTimersByTime(0));
    expect(result.current).toBe("handoff");
    act(() => vi.advanceTimersByTime(LOADER.reducedMs));
    expect(result.current).toBe("done");
    expect(getIntroPhase()).toBe("ready");
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run src/hooks/use-loader-sequence.test.tsx`
Expected: FAIL (cannot resolve the hook).

- [ ] **Step 7: Implement `src/hooks/use-loader-sequence.ts`**

```ts
"use client";

import { useEffect, useState } from "react";
import { setIntroPhase } from "@/lib/intro-state";
import { LOADER } from "@/lib/loader-timeline";
import { hasSeenLoader, markLoaderSeen } from "@/lib/session-flags";

export type LoaderStage = "dot" | "field" | "collapse" | "handoff" | "done";

const SKIP_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

/**
 * Drives the welcome loader. Starts the intro (`loader`), walks the stages on a timer, and when finished (or skipped)
 * records the session flag and sets the intro `ready` so the hero can play in.
 */
export function useLoaderSequence(reduced: boolean): LoaderStage {
  const [stage, setStage] = useState<LoaderStage>("dot");

  useEffect(() => {
    if (hasSeenLoader()) {
      const t = setTimeout(() => setStage("done"), 0);
      return () => clearTimeout(t);
    }
    setIntroPhase("loader");
    const steps: ReadonlyArray<readonly [LoaderStage, number]> = reduced
      ? [
          ["handoff", 0],
          ["done", LOADER.reducedMs],
        ]
      : [
          ["field", LOADER.at.field],
          ["collapse", LOADER.at.collapse],
          ["handoff", LOADER.at.handoff],
          ["done", LOADER.at.done],
        ];
    const timers = steps.map(([next, ms]) => setTimeout(() => setStage(next), ms));
    return () => timers.forEach(clearTimeout);
  }, [reduced]);

  useEffect(() => {
    if (stage !== "done") return;
    markLoaderSeen();
    // The gate script only runs on full page loads. Setting the attribute here keeps the overlay hidden
    // from the first paint when the visitor later returns to home via client-side navigation.
    document.documentElement.setAttribute("data-loader", "skip");
    setIntroPhase("ready");
  }, [stage]);

  useEffect(() => {
    if (stage === "done") return;
    const skip = () => setStage("done");
    SKIP_EVENTS.forEach((name) => window.addEventListener(name, skip, { passive: true }));
    return () => SKIP_EVENTS.forEach((name) => window.removeEventListener(name, skip));
  }, [stage]);

  return stage;
}
```

- [ ] **Step 8: Run it to verify it passes**

Run: `npx vitest run src/hooks/use-loader-sequence.test.tsx`
Expected: PASS (8 tests).

- [ ] **Step 9: Write the failing component test**

`src/components/home/welcome-loader.test.tsx`:

```tsx
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { resetIntro } from "@/lib/intro-state";
import { LOADER } from "@/lib/loader-timeline";
import { LOADER_SEEN_KEY } from "@/lib/session-flags";
import { WelcomeLoader } from "./welcome-loader";

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  resetIntro();
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("WelcomeLoader", () => {
  test("renders a decorative overlay that the gate script can hide", () => {
    const { container } = render(<WelcomeLoader />);
    const overlay = container.querySelector("[data-intro-loader]");
    expect(overlay).not.toBeNull();
    expect(overlay).toHaveAttribute("aria-hidden", "true");
  });

  test("types the greeting and is removed when finished", () => {
    const { container } = render(<WelcomeLoader />);
    act(() => vi.advanceTimersByTime(LOADER.at.field + LOADER.typeDelayMs + LOADER.charMs * 22));
    expect(container.textContent).toContain("Hi, I’m Liam. Welcome.");
    act(() => vi.advanceTimersByTime(LOADER.at.done));
    expect(container.querySelector("[data-intro-loader]")).toBeNull();
  });

  test("renders nothing once it has been seen this session", () => {
    sessionStorage.setItem(LOADER_SEEN_KEY, "1");
    const { container } = render(<WelcomeLoader />);
    act(() => vi.advanceTimersByTime(0));
    expect(container.querySelector("[data-intro-loader]")).toBeNull();
  });
});
```

- [ ] **Step 10: Run it to verify it fails**

Run: `npx vitest run src/components/home/welcome-loader.test.tsx`
Expected: FAIL (cannot resolve `./welcome-loader`).

- [ ] **Step 11: Implement `src/components/home/welcome-loader.tsx`**

```tsx
"use client";

import { motion } from "motion/react";
import { loaderGreeting } from "@/content/home";
import { useLoaderSequence, type LoaderStage } from "@/hooks/use-loader-sequence";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useTypewriter } from "@/hooks/use-typewriter";
import { ease } from "@/lib/motion";
import { LOADER } from "@/lib/loader-timeline";

/** The rose glow: a small point, then a soft field, then a compact sphere (sized by --loader-sphere). */
const GLOW: Record<LoaderStage, { scale: number; opacity: number }> = {
  dot: { scale: 0.02, opacity: 0.95 },
  field: { scale: 1.9, opacity: 0.4 },
  collapse: { scale: 1, opacity: 0.95 },
  handoff: { scale: 1, opacity: 0.95 },
  done: { scale: 1, opacity: 0.95 },
};

const GLOW_SECONDS: Record<LoaderStage, number> = { dot: 0.3, field: 1.45, collapse: 0.7, handoff: 0.3, done: 0.3 };

/**
 * Welcome loader (spec §4.1). Server-rendered so there is no flash of the hero underneath; the gate script in
 * <head> hides it before first paint when it must not play. Any click, key, wheel or touch skips it.
 */
export function WelcomeLoader() {
  const reduced = usePrefersReducedMotion();
  const stage = useLoaderSequence(reduced);
  const { shown } = useTypewriter(loaderGreeting, {
    enabled: stage !== "dot",
    charMs: LOADER.charMs,
    startDelayMs: LOADER.typeDelayMs,
  });

  if (stage === "done") return null;

  const fadeSeconds = reduced ? LOADER.reducedMs / 1000 : (LOADER.at.done - LOADER.at.handoff) / 1000;

  return (
    <motion.div
      data-intro-loader=""
      aria-hidden="true"
      suppressHydrationWarning
      className="fixed inset-0 z-80 overflow-hidden bg-bg"
      initial={false}
      animate={{ opacity: stage === "handoff" ? 0 : 1 }}
      transition={{ duration: fadeSeconds, ease: ease.settle }}
    >
      <div className="dot-grid absolute inset-0 opacity-50" />
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: "var(--loader-sphere)",
          height: "var(--loader-sphere)",
          background:
            "radial-gradient(circle, rgb(205 162 185 / 0.95) 0%, rgb(187 104 123 / 0.55) 38%, rgb(187 104 123 / 0) 70%)",
        }}
        initial={false}
        animate={GLOW[stage]}
        transition={{ duration: GLOW_SECONDS[stage], ease: ease.settle }}
      />
      <motion.p
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-2xl text-ink sm:text-4xl"
        initial={false}
        animate={{ opacity: stage === "field" ? 1 : 0 }}
        transition={{ duration: 0.3, ease: ease.settle }}
      >
        <span className="relative inline-block">
          <span className="invisible">{loaderGreeting}</span>
          <span className="absolute inset-0 text-left">{shown}</span>
        </span>
      </motion.p>
    </motion.div>
  );
}
```

Note on `z-80`: Tailwind v4 accepts any integer for `z-*`, and `z-80` is the loader/transition overlay layer documented at the top of `globals.css`.

- [ ] **Step 12: Run it to verify it passes**

Run: `npx vitest run src/components/home/welcome-loader.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 13: Commit**

```bash
git add src/lib/loader-timeline.ts src/lib/loader-timeline.test.ts src/hooks/use-loader-sequence.ts src/hooks/use-loader-sequence.test.tsx src/components/home/welcome-loader.tsx src/components/home/welcome-loader.test.tsx
git commit -m "feat: add welcome loader

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Hero composition

**Files:**
- Create: `src/components/home/hero.tsx`
- Test: `src/components/home/hero.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { hero } from "@/content/home";
import { resetIntro, setIntroPhase } from "@/lib/intro-state";
import { Hero } from "./hero";

vi.mock("next/image", () => ({
  default: ({ priority, ...rest }: React.ComponentProps<"img"> & { priority?: boolean }) => {
    void priority;
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...rest} />;
  },
}));

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  resetIntro();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Hero", () => {
  test("the page has one h1 with the title, from the first render", () => {
    stubReducedMotion(false);
    render(<Hero />);
    expect(screen.getByRole("heading", { level: 1, name: hero.title })).toBeInTheDocument();
  });

  test("shows a decorative portrait", () => {
    stubReducedMotion(false);
    render(<Hero />);
    expect(screen.getByRole("presentation", { hidden: true })).toHaveAttribute("src", expect.stringContaining("liam-avatar"));
  });

  test("the greeting is available to screen readers in full", () => {
    stubReducedMotion(false);
    render(<Hero />);
    expect(screen.getByText(hero.greeting, { selector: ".sr-only" })).toBeInTheDocument();
  });

  test("types the greeting once the intro is ready", () => {
    stubReducedMotion(false);
    const { container } = render(<Hero />);
    const typed = () => container.querySelector("[data-typed]")?.textContent ?? "";
    expect(typed()).toBe("");
    act(() => setIntroPhase("ready"));
    act(() => vi.advanceTimersByTime(150 + 45 * hero.greeting.length + 100));
    expect(typed()).toBe(hero.greeting);
  });

  test("reduced motion shows the greeting immediately", () => {
    stubReducedMotion(true);
    const { container } = render(<Hero />);
    expect(container.querySelector("[data-typed]")?.textContent).toBe(hero.greeting);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/home/hero.test.tsx`
Expected: FAIL (cannot resolve `./hero`).

- [ ] **Step 3: Implement `src/components/home/hero.tsx`**

```tsx
"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { hero } from "@/content/home";
import { useIntroPhase } from "@/hooks/use-intro-phase";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useTypewriter } from "@/hooks/use-typewriter";
import { distance, dur, ease } from "@/lib/motion";
import { HeroLine } from "./hero-line";

/**
 * Hero (spec §4.1): portrait + typed "Hi, I'm Liam" (small), "Product Designer" (largest, fixed), the alternating
 * line, in that order, once the intro is ready. The particle backdrop sits behind (ParticleBackdrop) and the pill
 * nav fades in last (PillNav).
 */
export function Hero() {
  const reduced = usePrefersReducedMotion();
  const ready = useIntroPhase() === "ready";
  const { shown, done } = useTypewriter(hero.greeting, { enabled: ready, instant: reduced, startDelayMs: 150 });

  const rise = (delay: number) => ({
    initial: reduced ? (false as const) : { opacity: 0, y: distance.text },
    animate: ready || reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: distance.text },
    transition: { duration: dur.reveal, ease: ease.settle, delay: reduced ? 0 : delay },
  });

  return (
    <section className="relative flex min-h-dvh flex-col items-center justify-end gap-5 px-6 pb-36 text-center">
      <div aria-hidden="true" className="dot-grid pointer-events-none absolute inset-0" />

      <motion.div {...rise(0)} className="intro-hidden relative flex items-center gap-4 text-2xl text-ink">
        <Image
          src="/images/liam-avatar.webp"
          alt=""
          role="presentation"
          width={40}
          height={40}
          className="size-10 rounded-full"
        />
        <p>
          <span className="sr-only">{hero.greeting}</span>
          <span aria-hidden="true" className="relative inline-block">
            <span className="invisible">{hero.greeting}</span>
            <span data-typed="" className="absolute inset-0 text-left">
              {shown}
              {!done && <span className="caret" />}
            </span>
          </span>
        </p>
      </motion.div>

      <motion.h1
        {...rise(0.35)}
        className="intro-hidden relative text-[clamp(3rem,10vw,9rem)] font-bold uppercase leading-[0.95] tracking-tight"
      >
        {hero.title}
      </motion.h1>

      <motion.div {...rise(0.65)} className="intro-hidden relative">
        <HeroLine />
      </motion.div>
    </section>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/components/home/hero.test.tsx`
Expected: PASS (5 tests). If `getByRole("presentation", { hidden: true })` finds nothing because jsdom exposes `<img alt="">` as `presentation` only in some versions, use `container.querySelector("img")` and assert on `src`; do not remove `role="presentation"` from the component.

- [ ] **Step 5: Commit**

```bash
git add src/components/home/hero.tsx src/components/home/hero.test.tsx
git commit -m "feat: add hero composition

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Assemble the home page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace `src/app/page.tsx`** (the old first section is now the Hero, which owns the page's only `h1`; the remaining placeholder sections stay until plan 2b)

```tsx
import { Hero } from "@/components/home/hero";
import { ParticleBackdrop } from "@/components/home/particle-backdrop";
import { WelcomeLoader } from "@/components/home/welcome-loader";

export default function Home() {
  return (
    <>
      <WelcomeLoader />
      <ParticleBackdrop />
      <Hero />
      <section id="projects" className="min-h-dvh px-16 py-24">
        <h2 className="text-5xl font-bold uppercase">Projects</h2>
      </section>
      <section id="about" className="min-h-dvh px-16 py-24">
        <h2 className="text-5xl font-bold uppercase">About me</h2>
      </section>
      <section id="contact" className="min-h-dvh px-16 pb-32 pt-24 text-center">
        <p>If you made it here,</p>
        <h2 className="font-accent text-5xl italic text-rose">let&rsquo;s just talk?</h2>
      </section>
    </>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npm run lint && npx vitest run && npm run build`
Expected: lint clean, all tests pass, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: mount loader, backdrop and hero on home

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Pill nav waits for the intro

On home the nav must fade in last. Until the intro is `ready` it is invisible, so it must also be `inert` (not focusable or clickable). On case studies it behaves as before.

**Files:**
- Modify: `src/components/shell/pill-nav.tsx`
- Modify: `src/components/shell/pill-nav.test.tsx`

- [ ] **Step 1: Update the existing test setup and add the failing tests**

In `src/components/shell/pill-nav.test.tsx`, add this import next to the other imports (after the `import { PillNav } from "./pill-nav";` line):

```tsx
import { resetIntro, setIntroPhase } from "@/lib/intro-state";
```

Replace the existing `beforeEach` with:

```tsx
beforeEach(() => {
  pathname.mockReturnValue("/");
  useActiveSection.mockReset();
  useActiveSection.mockReturnValue(null);
  setIntroPhase("ready");
});
```

Add these tests inside the `describe("PillNav", ...)` block:

```tsx
  test("on home it is inert until the intro is ready", () => {
    resetIntro();
    const { container } = render(<PillNav />);
    expect(container.querySelector("nav")).toHaveAttribute("inert");
    act(() => setIntroPhase("ready"));
    expect(container.querySelector("nav")).not.toHaveAttribute("inert");
  });

  test("on case studies it never waits for the intro", () => {
    resetIntro();
    pathname.mockReturnValue("/cyvore");
    const { container } = render(<PillNav />);
    expect(container.querySelector("nav")).not.toHaveAttribute("inert");
  });
```

Change the first line of the file to also import `act`:

```tsx
import { act, render, screen } from "@testing-library/react";
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `npx vitest run src/components/shell/pill-nav.test.tsx`
Expected: the two new tests FAIL (no `inert` attribute yet); the others PASS.

- [ ] **Step 3: Update `src/components/shell/pill-nav.tsx`**

Add the import:

```tsx
import { useIntroPhase } from "@/hooks/use-intro-phase";
```

Add this constant above the component:

```tsx
/** Seconds after the intro is ready: the greeting, title and line play in first (see Hero). */
const NAV_DELAY = 0.9;
```

Replace the start of `PillNav` and the `motion.nav` opening element so the component reads (the hook is called unconditionally, at the top):

```tsx
export function PillNav() {
  const pathname = usePathname();
  const introPhase = useIntroPhase();
  const isHome = pathname === "/";
  const activeSection = useActiveSection(SECTION_IDS, pathname);
  const active = isHome ? activeSection : null;
  // On home the nav is the last thing to appear, after the hero has played in.
  const waiting = isHome && introPhase !== "ready";

  return (
    <motion.nav
      aria-label="Primary"
      inert={waiting}
      initial={{ opacity: 0, y: 16 }}
      animate={waiting ? { opacity: 0, y: 16 } : { opacity: 1, y: 0 }}
      transition={{ duration: dur.ui, ease: ease.settle, delay: isHome ? NAV_DELAY : 0 }}
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
    >
```

The rest of the component (the `div`, the items map) is unchanged.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/shell/pill-nav.test.tsx`
Expected: PASS (all tests, including the two new ones).

- [ ] **Step 5: Run the full suite and lint**

Run: `npm run lint && npx vitest run`
Expected: lint clean (this confirms there is no conditional hook call), all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/shell/pill-nav.tsx src/components/shell/pill-nav.test.tsx
git commit -m "feat: pill nav fades in last on home

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 13: End-to-end tests

**Files:**
- Create: `e2e/home-intro.spec.ts`

- [ ] **Step 1: Write the tests**

```ts
import { expect, test } from "@playwright/test";

const LOADER = "[data-intro-loader]";
const SENTENCE =
  "I can help you with market research, user research, streamlining workflows, design systems, interaction design and rapid prototyping.";

test("first visit plays the loader, then the hero and nav appear", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(LOADER)).toBeVisible();
  await expect(page.locator(LOADER)).toHaveCount(0, { timeout: 5000 });
  await expect(page.getByRole("heading", { level: 1, name: "Product Designer" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary" })).not.toHaveAttribute("inert");
  expect(await page.evaluate(() => sessionStorage.getItem("lh:loader-seen"))).toBe("1");
});

test("a reload in the same session does not replay the loader", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(LOADER)).toHaveCount(0, { timeout: 5000 });
  await page.reload();
  await expect(page.locator(LOADER)).toBeHidden();
});

test("a click skips the loader", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(LOADER)).toBeVisible();
  await page.mouse.click(300, 300);
  await expect(page.locator(LOADER)).toHaveCount(0, { timeout: 1000 });
  await expect(page.getByRole("heading", { level: 1, name: "Product Designer" })).toBeVisible();
});

test("a session that starts on a case study never plays the loader", async ({ page }) => {
  await page.goto("/cyvore");
  await page.getByRole("link", { name: "Projects" }).click();
  await expect(page).toHaveURL(/\/#projects$/);
  await expect(page.locator(LOADER)).toBeHidden();
  await expect(page.getByRole("heading", { level: 1, name: "Product Designer" })).toBeVisible();
});

test("the alternating line is exposed as one static sentence", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(LOADER)).toHaveCount(0, { timeout: 5000 });
  await expect(page.locator("p.sr-only, span.sr-only").filter({ hasText: SENTENCE }).first()).toBeAttached();
});

test("reduced motion: no particle video, no loader wait, static sentence", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(LOADER)).toHaveCount(0, { timeout: 1500 });
  await expect(page.locator("video")).toHaveCount(0);
  await expect(page.getByText(SENTENCE).first()).toBeVisible();
});
```

- [ ] **Step 2: Run the e2e suite**

Run: `npm run test:e2e`
Expected: all tests pass, including the existing smoke tests (`/` still has a visible `h1` and the primary nav; the nav is `inert` and invisible only until the intro is ready, and Playwright treats opacity-0 elements as visible). The run builds the app first, so it takes a minute or two.

Add one more test to the same file for the client-side return path, then re-run:

```ts
test("returning to home by client-side navigation does not flash the loader", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(LOADER)).toHaveCount(0, { timeout: 5000 });
  await page.getByRole("link", { name: "Projects" }).click(); // stays on home (anchor)
  await page.goto("/cyvore");
  await page.getByRole("link", { name: "Projects" }).click(); // Link back to /#projects
  await expect(page).toHaveURL(/\/#projects$/);
  await expect(page.locator(LOADER)).toBeHidden();
});
```

- [ ] **Step 3: Commit**

```bash
git add e2e/home-intro.spec.ts
git commit -m "test: cover the home intro end to end

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Verify in the browser, tune, and push the preview

This is the visual acceptance step. Unit tests cannot say whether the loader *feels* right or whether the sphere handoff lines up, so check it on screen.

**Files:**
- Modify (only if tuning is needed): `src/app/globals.css` (`--loader-sphere`), `src/lib/backdrop.ts` (`SPHERE_TIME`)

- [ ] **Step 1: Start the dev server in the in-app browser**

Use `preview_start` with `{name: "portfolio-dev"}`. Then `read_console_messages` with `onlyErrors: true`.
Expected: no errors and no hydration warnings. A hydration warning about `<html>`, the loader overlay or `<script>` means `suppressHydrationWarning` or `InlineScript` is misplaced: fix that before continuing.

- [ ] **Step 2: Check the loader sequence frame by frame**

Navigate to the dev URL in a fresh tab so the session flag is empty (or run `sessionStorage.clear()` with `javascript_tool` and reload). Take screenshots at roughly 0.2s, 1.0s, 2.0s, 2.6s and 3.2s after load. Expected:
1. a dark screen with a faint dot grid and a small rose point;
2. a soft rose field with the greeting partly typed;
3. the field collapsing, the greeting gone;
4. the overlay fading and the particle sphere beneath it;
5. the hero text visible.

- [ ] **Step 3: Check the sphere handoff lines up**

Hold the sphere frame without the overlay: `sessionStorage.setItem("lh:loader-seen","1")`, reload, then with `javascript_tool` run `const v=document.querySelector("video");v.pause();v.currentTime=3.5;document.querySelector("[data-intro-loader]")?.remove();`, and screenshot. The video's sphere (scaled 1.6× at scroll 0) should be about the same diameter as the loader's rose sphere (`--loader-sphere`). If they differ by more than ~10%, measure the video sphere's diameter in the screenshot and set `--loader-sphere` to that many pixels (keep it viewport-relative with `vmax`, e.g. `min(48vmax, 720px)` → adjust the 48). If the frame at 3.5s is not a clean full sphere, pick the cleanest second between 2.5 and 5.0 and update `SPHERE_TIME` in `src/lib/backdrop.ts`.

- [ ] **Step 4: Check the hero and the phrase swap**

With the loader skipped, screenshot the hero. Expected: portrait and "Hi, I'm Liam" typed, "PRODUCT DESIGNER" as the largest text, the line "I can help you with {phrase}" with the phrase in italic rose-soft, the pill nav last. Watch two phrase swaps (take screenshots 2.4s apart): the lead text should glide as the phrase width changes, with no sudden jump. If it jumps, set `layout="position"`'s `transition` to the same `move` object on the parent `span` too, and re-check; do not add a fixed-width slot.

- [ ] **Step 5: Check scrolling and the backdrop**

Scroll to ~600px, ~2000px and ~3900px (`javascript_tool`: `window.scrollTo(0, n)`). Expected: the backdrop brightens, scales up and is gone by ~3900px; scrolling back up reverses it. The pill nav active highlight still tracks Projects / About / Contact.

- [ ] **Step 6: Check mobile width**

Reduced motion is covered by the e2e test in Task 13. Here, `resize_window` with preset `mobile`, reload, and screenshot the hero: the title must not overflow (the clamp keeps it at 3rem minimum), the alternating line must wrap cleanly, and the pill nav must not overlap the line. Reset with preset `desktop`.

- [ ] **Step 7: Run everything one last time**

Run: `npm run lint && npx vitest run && npm run test:e2e`
Expected: all green.

- [ ] **Step 8: Commit tuning (only if Step 3 changed values) and push**

```bash
git add -A
git diff --cached --stat
git commit -m "chore: tune loader sphere handoff

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push -u origin phase/2-home
```

Skip the commit if nothing changed; always push.

- [ ] **Step 9: Find the preview and hand off**

Use the Vercel connector: `list_deployments` for project `liamhasson-portfolio` (team `team_xqMVV73uQk2d6wLWGqmCMxkh`), branch `phase/2-home`; wait for state `READY`. If it errors, read the build log (`list_deployment_events`) before changing anything. Fetch the preview home page with `web_fetch_vercel_url` and confirm it returns 200 with the hero markup (`Product Designer`, the sr-only sentence). Send Liam the preview URL (the branch alias `liamhasson-portfolio-git-phase-2-home-…vercel.app`) with a short list of what to look at: the loader once per session (open a new tab to see it again), click-to-skip, the phrase swap, the backdrop on scroll, and the nav appearing last. Merge to `main` only after he approves.

---

## Spec coverage (Phase 2a slice)

| Spec item | Task |
|---|---|
| §4.1 loader: dot → rose field + greeting "Hi, I'm Liam. Welcome." → collapse to sphere → crossfade into video at its sphere frame, ≤ 3.2s | 8, 9 |
| §4.1 once per browser session, first arrival only, never between pages; click/scroll/key skips | 5, 9, 13 |
| §6 loader overlay server-rendered, inline script removes it before paint when the flag is set | 5 |
| §6 sessionStorage flag with try/catch | 5 (script), existing `session-flags.ts` |
| §4.1 hero hierarchy: video behind, typed "Hi, I'm Liam" + portrait (H4), fixed "Product Designer" title, alternating line, nav last | 8, 10, 12 |
| §3.1 H3 particle cloud: opacity 0.24 → 1, scale 1.6× → 5×, gone by ~3900px, scrubbed both ways | 8 |
| §3.1 H2 dot-grid background (CSS, not an image) | 5, 10 |
| §3.1 H5 hero sentence fade-up when the loader finishes | 10 |
| §3.1 H6 pill nav fades up after the hero | 12 |
| §4.1 alternating phrase: slide-and-fade swap, ~2.4s per phrase, no layout jump, pauses when the tab is hidden | 7 |
| §4.1/§7 static comma-separated list under reduced motion; single static sentence for screen readers | 7, 13 |
| §5 reduced motion: loader becomes a 300ms fade, video replaced by a poster, scrubbed effects off | 4, 8, 9, 13 |
| §7 one `h1`, contrast, keyboard (nav inert while hidden, skip link intact), no-JS fallback | 5, 10, 12 |

Deferred to plan 2b: projects grid and card hover loops (recorded from the live products), toolkit burst, About and "I own my work", testimonials, contact with copy-to-clipboard. Deferred to Phase 4: tablet and mobile layout passes, Lighthouse targets, cross-browser checks.
