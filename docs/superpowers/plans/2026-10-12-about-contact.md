# About and Contact Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two new pages, /about and /contact, reached from the story's projects index and from the nav, joined by a deliberate pull at the bottom of each page.

**Architecture:** Content lives in one typed module. A pure pull state machine (`src/lib/pull.ts`) drives one `NextPagePull` component used at the end of the index and of About. About is a DOM-only pinned horizontal track whose motion is a pure function of scroll. Contact reuses the story's sand pipeline (Stage, SandField, SandComposite, the loader's brief and cascade) in a small new scene, with one shader addition: the cascade can end on the ball instead of the cloud.

**Tech Stack:** Next.js 16 (App Router; read `node_modules/next/dist/docs` before writing route code), React 19, three.js 0.186 (GLSL3), Vitest + Testing Library, Lenis smooth scroll (`src/lib/smooth-scroll.ts`).

**Spec:** `docs/superpowers/specs/2026-10-12-about-contact-design.md`

## Global Constraints

- No glow anywhere: no halos, bloom or blurred light (memory `no-glow.md`; spec header).
- Type: Geist (`var(--font-sans)`) and Geist Mono (`var(--font-mono)`), weights 400 and 500 only.
- Colours: ground `#0b0908`; near-white `#f4efe9`; darker tone `rgba(244,239,233,.42)`; warm hairline `rgb(230, 191, 174)`.
- About copy verbatim from `docs/copy/about.md` (curly apostrophes `’`), highlights exactly as the spec's §3.2 table.
- Contact details verbatim: `Liamhasson@gmail.com`, `https://www.linkedin.com/in/liamhasson/`, `+49 160 771 0652`; headline "Got something on your mind?".
- Resume: `https://drive.google.com/file/d/1WyoDYw5Zarn3N2031RGNSLrdmAiR0yJS/view?usp=sharing`, new tab, `rel="noopener noreferrer"`.
- Never an automatic redirect: a page opens only on a click, Enter, or a full pull (spec §1–2).
- Another chat works in this repo: stage only this plan's files, by path; never `git add -A`. Leave `.claude/launch.json`, `docs/storyboard/*`, `blender/lookdev/*`, `docs/superpowers/specs/2026-10-05-portfolio-concept-v2.md` untouched. Never edit `blender/lookdev/lookdev.py`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Tests: `npx vitest run <path>` per task; the whole suite (`npm test`) green at the end of each task.

## Review Focus

1. A trackpad flick that reaches the page's end with momentum must not open the next page (only a gesture that starts at the end counts). Pinned in Task 2.
2. Back from About (or Contact) lands at the previous page's end and must not reopen the page it came from. Pinned in Task 2 (arrival nudge).
3. On a portrait phone or with reduced motion, About must not scroll sideways or overflow horizontally: it stacks. Pinned in Task 5.
4. Where the clipboard API is missing or refused (insecure origin, Safari permission), the email pill must still work, as a `mailto:` link. Pinned in Task 6.
5. A stalled or failed sand load on Contact must never leave a blank page: within 15 s the still and the words show. Pinned in Task 8 (the timeline's stall rule) and checked live in Task 9.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/content/about.ts` (new) | About and Contact content: lines as two-colour segments, quotes, What I do, resume, portrait, contact details |
| `src/content/about.test.ts` (new) | Content matches the approved copy and the spec's tables |
| `src/lib/pull.ts` (new) | The pull's pure state machine |
| `src/lib/pull.test.ts` (new) | Its rules |
| `src/components/shell/next-page-pull.tsx` (new) | The peek link, its fill line, wheel and touch input, the arrival nudge |
| `src/components/shell/next-page-pull.css` (new) | Its look |
| `src/components/shell/next-page-pull.test.tsx` (new) | Its behaviour in the DOM |
| `src/components/shell/pill-nav.tsx` (modify) | About and Contact become real links to the pages |
| `src/components/shell/pill-nav.test.tsx` (modify) | Updated expectations |
| `src/lib/story.ts` (modify) | `sectionRedirect(hash)` for old `#about` / `#contact` links |
| `src/lib/story.test.ts` (new) | Its cases |
| `src/app/lab/sand/sand-lab.tsx` (modify) | Remove the placeholder anchors; redirect old hashes |
| `src/app/lab/sand/work-index.tsx` (modify) | The pull to About after the cards |
| `src/app/lab/sand/work-index.test.tsx` (new) | The pull is there, active only in the shown layout |
| `src/app/about/track.ts` (new) | The track's pure maths and layout mode |
| `src/app/about/track.test.ts` (new) | Its cases |
| `src/app/about/about-track.tsx` (new) | The About page's client component |
| `src/app/about/about.css` (new) | Its look |
| `src/app/about/about-track.test.tsx` (new) | Rendered content and structure |
| `src/app/about/page.tsx` (new) | The route |
| `src/app/contact/contact-end.tsx` (new) | Headline and the three pills, copy-to-clipboard |
| `src/app/contact/contact-end.test.tsx` (new) | Copy, fallback, links |
| `src/three/sand/sand-field.ts` (modify) | Rest words carry the ball word too; `setCascade(…, target)` |
| `src/three/sand/shaders.ts` (modify) | `cascadeRest` returns the ball spot when the target is the ball |
| `src/three/sand/cascade.ts` (modify) | `ballRestOf`, the TS mirror of the ball spot |
| `src/three/sand/cascade.test.ts` (modify) | The mirror's cases |
| `src/three/sand/sand-cascade.test.ts` (modify) | The shader has the ball target |
| `src/three/sand/contact-view.ts` (new) | Where Contact's camera stands |
| `src/three/sand/contact-view.test.ts` (new) | The ball's size and place on screen |
| `src/app/contact/contact-timeline.ts` (new) | Contact's timeline after the brief is full, and the stall rule |
| `src/app/contact/contact-timeline.test.ts` (new) | Its cases |
| `src/app/contact/contact-scene.tsx` (new) | The scene: brief, sand, cascade to the ball, the words |
| `src/app/contact/contact.css` (new) | Its look |
| `src/app/contact/page.tsx` (new) | The route |

---

### Task 1: The content

**Files:**
- Create: `src/content/about.ts`
- Test: `src/content/about.test.ts`

**Interfaces:**
- Produces: `type Seg = { t: string; hi?: boolean }`, `type Line = Seg[]`, `type Quote = { text: Line; name: string; role: string }`, `type Skill = { name: string; proof: string; href?: string }`, `type Verb = { title: string; skills: Skill[] }`, `const ABOUT: { lines: Line[]; quotes: Quote[]; opening: { text: Line; href: string }; verbs: Verb[]; resume: { href: string; label: string }; closing: Line; portrait: { src: string; alt: string; width: number; height: number } | null }`, `const CONTACT: { headline: string; email: string; linkedin: string; phone: string }`, `const plain: (l: Line) => string`.

- [ ] **Step 1: Write the failing test**

```ts
// src/content/about.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { ABOUT, CONTACT, plain } from "./about";

const approved = readFileSync(join(process.cwd(), "docs/copy/about.md"), "utf8")
  .split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));

describe("About and Contact content (spec 2026-10-12-about-contact-design.md)", () => {
  test("Liam's approved text, verbatim, in order: three lines on the track, the last one closing it", () => {
    expect([...ABOUT.lines.map(plain), plain(ABOUT.closing)]).toEqual(approved);
  });
  test("two colours: the highlights are exactly the spec's table", () => {
    const his = (l: { t: string; hi?: boolean }[]) => l.filter((s) => s.hi).map((s) => s.t);
    expect(his(ABOUT.lines[0])).toEqual(["I’m Liam. I love crafting products"]);
    expect(his(ABOUT.lines[1])).toEqual(["ten years managing two rock bands", "making something out of nothing"]);
    expect(his(ABOUT.lines[2])).toEqual(["That’s still how I work.", "problems nobody pointed at"]);
    expect(his(ABOUT.quotes[0].text)).toEqual(["we closed our first funding round."]);
    expect(his(ABOUT.closing)).toEqual(["I’d like to hear about it."]);
  });
  test("the quotes: Yoav's verbatim; room for up to four", () => {
    expect(plain(ABOUT.quotes[0].text)).toBe("We weren't looking for a designer. Liam reached us and thanks to his work, we closed our first funding round.");
    expect(ABOUT.quotes[0]).toMatchObject({ name: "Yoav Rotem", role: "CTO, Cyvore" });
    expect(ABOUT.quotes.length).toBeGreaterThanOrEqual(1);
    expect(ABOUT.quotes.length).toBeLessThanOrEqual(4);
  });
  test("What I do: Liam's three verbs, twelve skills, each with its proof; links only to the case studies", () => {
    expect(ABOUT.verbs.map((v) => v.title)).toEqual(["Find the problem.", "Check I’m right.", "Build it."]);
    expect(ABOUT.verbs.map((v) => v.skills.length)).toEqual([3, 3, 6]);
    const skills = ABOUT.verbs.flatMap((v) => v.skills);
    expect(skills.map((s) => s.name)).toEqual([
      "User research", "Market & competitor research", "Information architecture",
      "Usability testing", "Data-informed decisions", "Stakeholder communication",
      "Interaction & motion", "Design systems", "Web design", "Branding", "Prototyping in code", "3D modeling",
    ]);
    for (const s of skills) {
      expect(s.proof.length).toBeGreaterThan(10);
      if (s.href) expect(["/eventread", "/cyvore", "/pulse"]).toContain(s.href);
    }
    expect(skills.find((s) => s.name === "3D modeling")!.href).toBeUndefined();
    expect(ABOUT.opening.href).toBe("/eventread");
  });
  test("the resume and the contact details, verbatim", () => {
    expect(ABOUT.resume.href).toBe("https://drive.google.com/file/d/1WyoDYw5Zarn3N2031RGNSLrdmAiR0yJS/view?usp=sharing");
    expect(CONTACT).toEqual({ headline: "Got something on your mind?", email: "Liamhasson@gmail.com", linkedin: "https://www.linkedin.com/in/liamhasson/", phone: "+49 160 771 0652" });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/content/about.test.ts`
Expected: FAIL, "Failed to resolve import "./about"".

- [ ] **Step 3: Write the content**

```ts
// src/content/about.ts
/**
 * About and Contact (spec 2026-10-12-about-contact-design.md §3, §4, §6). Liam's approved text (docs/copy/about.md) in
 * two colours: each line a run of segments, `hi` the part in the near-white (Liam, 2026-10-12: "highlight the important
 * parts of the sentence"). A quote, the resume, the portrait or a detail is a one-line change here.
 */
export type Seg = { t: string; hi?: boolean };
export type Line = Seg[];
export type Quote = { text: Line; name: string; role: string };
export type Skill = { name: string; proof: string; href?: string };
export type Verb = { title: string; skills: Skill[] };

export const plain = (l: Line) => l.map((s) => s.t).join("");

export const ABOUT = {
  lines: [
    [{ t: "I’m Liam. I love crafting products", hi: true }, { t: " where design and user needs meet." }],
    [
      { t: "Before design, I spent " }, { t: "ten years managing two rock bands", hi: true },
      { t: " and creative projects across a few industries: small teams of specialists " },
      { t: "making something out of nothing", hi: true }, { t: "." },
    ],
    [
      { t: "That’s still how I work.", hi: true }, { t: " I go looking for " }, { t: "problems nobody pointed at", hi: true },
      { t: ", check whether I’m actually right, and build it." },
    ],
  ] as Line[],
  // (Andrada Popan-Dorca's and, later, Emil's: added here when Liam sends them; up to four)
  quotes: [
    {
      text: [{ t: "We weren't looking for a designer. Liam reached us and thanks to his work, " }, { t: "we closed our first funding round.", hi: true }],
      name: "Yoav Rotem",
      role: "CTO, Cyvore",
    },
  ] as Quote[],
  opening: { text: [{ t: "End to end", hi: true }, { t: ", from the problem to the shipped product." }] as Line, href: "/eventread" },
  verbs: [
    {
      title: "Find the problem.",
      skills: [
        { name: "User research", proof: "Pulse: what 5 of 6 testers expected reshaped the onboarding", href: "/pulse" },
        { name: "Market & competitor research", proof: "Eventread: Prism.fm, TourSmart, ChatGPT each answer part; none checks the whole night", href: "/eventread" },
        { name: "Information architecture", proof: "Cyvore: finding a section, 35s → 8s", href: "/cyvore" },
      ],
    },
    {
      title: "Check I’m right.",
      skills: [
        { name: "Usability testing", proof: "Pulse round 2: 6 of 6 completed every task", href: "/pulse" },
        { name: "Data-informed decisions", proof: "Eventread: risk bands checked on 3,172 real listings", href: "/eventread" },
        { name: "Stakeholder communication", proof: "Cyvore: argued for a 7-second animation over the full video; it shipped", href: "/cyvore" },
      ],
    },
    {
      title: "Build it.",
      skills: [
        { name: "Interaction & motion", proof: "Cyvore: the mission animation, the CTA’s states", href: "/cyvore" },
        { name: "Design systems", proof: "Eventread: one type family, three risk colours, a CI test", href: "/eventread" },
        { name: "Web design", proof: "Cyvore’s investor site, and this one", href: "/cyvore" },
        { name: "Branding", proof: "Pulse: the brand and its promise", href: "/pulse" },
        { name: "Prototyping in code", proof: "Eventread: built and shipped in Next.js", href: "/eventread" },
        { name: "3D modeling", proof: "This site: the desk and the laptop, modelled and lit in Blender" },
      ],
    },
  ] as Verb[],
  resume: { href: "https://drive.google.com/file/d/1WyoDYw5Zarn3N2031RGNSLrdmAiR0yJS/view?usp=sharing", label: "View resume" },
  closing: [{ t: "If you’re working on something that really matters to people, " }, { t: "I’d like to hear about it.", hi: true }] as Line,
  // (Liam's photo, graded to the site, when he sends it: { src: "/about/portrait.jpg", alt, width, height })
  portrait: null as { src: string; alt: string; width: number; height: number } | null,
};

export const CONTACT = {
  headline: "Got something on your mind?",
  email: "Liamhasson@gmail.com",
  linkedin: "https://www.linkedin.com/in/liamhasson/",
  phone: "+49 160 771 0652",
};
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/content/about.test.ts`
Expected: PASS (5 tests). If the first test fails on an apostrophe, the copy file is the authority: match its characters exactly.

- [ ] **Step 5: Commit**

```bash
git add src/content/about.ts src/content/about.test.ts
git commit -m "feat(about): the About and Contact content, in two colours (spec 2026-10-12)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The pull

**Files:**
- Create: `src/lib/pull.ts`, `src/components/shell/next-page-pull.tsx`, `src/components/shell/next-page-pull.css`
- Test: `src/lib/pull.test.ts`, `src/components/shell/next-page-pull.test.tsx`

**Interfaces:**
- Produces: `PULL = { need: 0.6, gap: 0.14 }`, `type PullState = { fill: number; lastT: number; gestureAtEnd: boolean }`, `pullStart(): PullState`, `pullStep(s: PullState, e: { dy: number; t: number; atEnd: boolean; vh: number }): PullState`, `pullDone(s: PullState): boolean`; `<NextPagePull href label line className? active? />` (`active` defaults to true).

- [ ] **Step 1: Write the failing tests (the rules)**

```ts
// src/lib/pull.test.ts
import { describe, expect, test } from "vitest";
import { PULL, pullDone, pullStart, pullStep } from "./pull";

const vh = 1000;
/** A gesture: wheel events `dy` each, `every` seconds apart, from `t0`. */
function gesture(s = pullStart(), { t0 = 0, n = 10, dy = 60, every = 0.016, atEnd = () => true } = {}) {
  for (let k = 0; k < n; k++) s = pullStep(s, { dy, t: t0 + k * every, atEnd: atEnd(), vh });
  return s;
}

describe("the pull at a page's end (spec 2026-10-12 §2)", () => {
  test("a scroll that starts at the end fills it, about 0.6 of a screen to full", () => {
    const s = gesture(undefined, { n: 5, dy: 60 });
    expect(s.fill).toBeCloseTo(300 / (PULL.need * vh), 6);
    expect(pullDone(gesture(undefined, { n: 11, dy: 60 }))).toBe(true);
  });
  test("momentum from a flick that started above the end never fills it (Review Focus 1)", () => {
    let atEnd = false;
    let s = pullStart();
    for (let k = 0; k < 120; k++) {
      if (k === 20) atEnd = true;   // (the page reaches its end mid-gesture; the momentum keeps coming, 16 ms apart)
      s = pullStep(s, { dy: 40, t: k * 0.016, atEnd, vh });
    }
    expect(s.fill).toBe(0);
  });
  test("a pause, then a fresh scroll at the end, counts", () => {
    let s = gesture(pullStart(), { n: 5, atEnd: () => false });
    s = gesture(s, { t0: 0.5, n: 3 });
    expect(s.fill).toBeGreaterThan(0);
  });
  test("stopping holds it; scrolling back empties it", () => {
    const s = gesture(undefined, { n: 4 });
    const held = pullStep(s, { dy: 0, t: 5, atEnd: true, vh });
    expect(held.fill).toBe(s.fill);
    const back = gesture(held, { t0: 6, n: 10, dy: -60 });
    expect(back.fill).toBe(0);
  });
  test("never past full", () => {
    expect(gesture(undefined, { n: 100 }).fill).toBe(1);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/pull.test.ts`
Expected: FAIL, "Failed to resolve import "./pull"".

- [ ] **Step 3: Write the rules**

```ts
// src/lib/pull.ts
/**
 * The pull at the end of a page (spec 2026-10-12-about-contact-design.md §2): scrolling on past the end fills a line,
 * and the next page opens when it is full. A deliberate gesture, never an automatic redirect (Liam asked for one;
 * Claude pushed back: it fires while people read, momentum overshoots, Back loops; WCAG 3.2.5):
 * - only a gesture that starts at the end counts (wheel events closer than `gap` seconds are one gesture), so a flick's
 *   momentum carrying the page to its end never fills it;
 * - about `need` of a screen of scrolling fills it; stopping holds it; scrolling back empties it.
 */
export const PULL = { need: 0.6, gap: 0.14 } as const;

export type PullState = { fill: number; lastT: number; gestureAtEnd: boolean };

export const pullStart = (): PullState => ({ fill: 0, lastT: -Infinity, gestureAtEnd: false });

export function pullStep(s: PullState, e: { dy: number; t: number; atEnd: boolean; vh: number }): PullState {
  const fresh = e.t - s.lastT > PULL.gap;
  const gestureAtEnd = (fresh ? true : s.gestureAtEnd) && e.atEnd;
  const k = e.dy / (PULL.need * e.vh);
  let fill = s.fill;
  if (e.dy < 0) fill = Math.max(0, fill + k);
  else if (gestureAtEnd) fill = Math.min(1, fill + k);
  return { fill, lastT: e.t, gestureAtEnd };
}

export const pullDone = (s: PullState) => s.fill >= 1;
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/lib/pull.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Write the failing component tests**

```tsx
// src/components/shell/next-page-pull.test.tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const push = vi.fn(), prefetch = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, prefetch }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: React.ComponentProps<"a">) => <a href={href} {...rest}>{children}</a> }));

import { NextPagePull } from "./next-page-pull";

let now = 0, scrollY = 0;
const setPage = (y: number, height = 3000) => {
  scrollY = y;
  Object.defineProperty(window, "scrollY", { configurable: true, get: () => scrollY });
  Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, get: () => height });
};
beforeEach(() => {
  push.mockReset(); prefetch.mockReset(); now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 1000 });
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} }) as never;
  window.scrollTo = vi.fn((_x: unknown, y?: unknown) => { scrollY = Number(y); }) as never;
});
afterEach(() => vi.restoreAllMocks());

const wheel = (dy: number, n: number) => { for (let k = 0; k < n; k++) { now += 16; act(() => { fireEvent.wheel(window, { deltaY: dy }); }); } };

describe("NextPagePull", () => {
  test("a peek that is an ordinary link to the next page", () => {
    setPage(0);
    render(<NextPagePull href="/about" label="About" line="I’m Liam." />);
    const link = screen.getByRole("link", { name: "Next: About" });
    expect(link).toHaveAttribute("href", "/about");
    expect(link).toHaveTextContent("I’m Liam.");
  });
  test("a fresh scroll at the end fills the line and opens the next page when full", () => {
    setPage(2000);
    render(<NextPagePull href="/about" label="About" line="x" />);
    now += 1000;
    wheel(80, 4);
    expect(push).not.toHaveBeenCalled();
    wheel(80, 4);
    expect(push).toHaveBeenCalledWith("/about");
    expect(push).toHaveBeenCalledTimes(1);
  });
  test("arriving back at the end (history) lands just above it: nothing fires by itself (Review Focus 2)", () => {
    setPage(2000);
    render(<NextPagePull href="/about" label="About" line="x" />);
    expect(window.scrollTo).toHaveBeenCalledWith(0, 1750);
  });
  test("reduced motion: the link only, no gesture", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener() {}, removeEventListener() {} }) as never;
    setPage(1999);
    render(<NextPagePull href="/about" label="About" line="x" />);
    now += 1000;
    wheel(200, 20);
    expect(push).not.toHaveBeenCalled();
  });
  test("inactive (the other layout of the index): it doesn't listen", () => {
    setPage(1999);
    render(<NextPagePull href="/about" label="About" line="x" active={false} />);
    now += 1000;
    wheel(200, 20);
    expect(push).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run them to see them fail**

Run: `npx vitest run src/components/shell/next-page-pull.test.tsx`
Expected: FAIL, "Failed to resolve import "./next-page-pull"".

- [ ] **Step 7: Write the component and its look**

```tsx
// src/components/shell/next-page-pull.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { pullDone, pullStart, pullStep } from "@/lib/pull";
import "./next-page-pull.css";

/**
 * The end of a page (spec 2026-10-12-about-contact-design.md §2): the next page peeks in as an ordinary link, and
 * scrolling on past the end fills a thin line across it; when it is full the next page opens (src/lib/pull.ts: only a
 * gesture that starts at the end counts). Arriving back at the end (history) lands just above it, so nothing fires by
 * itself. Reduced motion: the link only.
 */
export function NextPagePull({ href, label, line, className, active = true }: { href: string; label: string; line: string; className?: string; active?: boolean }) {
  const router = useRouter();
  const fillRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    const atEnd = () => window.scrollY + window.innerHeight >= root.scrollHeight - 2;
    // arriving at the end means a restored position (a fresh page starts at the top): step back above the pull
    if (window.scrollY > 0 && atEnd()) window.scrollTo(0, window.scrollY - window.innerHeight * 0.25);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    router.prefetch(href);
    let s = pullStart(), gone = false, touchY: number | null = null;
    const feed = (dy: number) => {
      s = pullStep(s, { dy, t: performance.now() / 1000, atEnd: atEnd(), vh: window.innerHeight });
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${s.fill})`;
      if (!gone && pullDone(s)) { gone = true; router.push(href); }
    };
    const onWheel = (e: WheelEvent) => feed(e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1));
    const onTouchStart = (e: TouchEvent) => { touchY = e.touches[0]?.clientY ?? null; s = { ...s, lastT: -Infinity }; };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      if (touchY === null || y === undefined) return;
      feed(touchY - y);
      touchY = y;
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [active, href, router]);
  return (
    <Link href={href} aria-label={`Next: ${label}`} className={`np ${className ?? ""}`}>
      <span className="np-label">{label} →</span>
      <span className="np-line">{line}</span>
      <span className="np-track" aria-hidden><span ref={fillRef} className="np-fill" /></span>
    </Link>
  );
}
```

```css
/* src/components/shell/next-page-pull.css: sizes in em, so the page (or the index's container) sets the scale */
.np { display: block; color: #f4efe9; text-decoration: none; padding: 4em 0 6em; }
.np-label { display: block; font: 400 0.75em/1.4 var(--font-mono); letter-spacing: 0.06em; text-transform: uppercase; color: rgba(244, 239, 233, 0.55); }
.np-line { display: block; margin-top: 0.6em; font-size: 3.2em; line-height: 1.15; color: rgba(244, 239, 233, 0.42); }
.np:hover .np-line { color: #f4efe9; transition: color 0.3s; }
.np-track { display: block; position: relative; margin-top: 2em; height: 1px; overflow: hidden; background: rgba(255, 255, 255, 0.1); }
.np-fill { position: absolute; inset: 0; background: rgb(230, 191, 174); transform-origin: left; transform: scaleX(0); }
.np:focus-visible { outline: 1px solid rgb(230, 191, 174); outline-offset: 0.5em; }
```

- [ ] **Step 8: Run the tests to see them pass**

Run: `npx vitest run src/lib/pull.test.ts src/components/shell/next-page-pull.test.tsx`
Expected: PASS (10 tests).

- [ ] **Step 9: Commit**

```bash
git add src/lib/pull.ts src/lib/pull.test.ts src/components/shell/next-page-pull.tsx src/components/shell/next-page-pull.css src/components/shell/next-page-pull.test.tsx
git commit -m "feat(shell): the pull at a page's end, a deliberate gesture (spec 2026-10-12 §2)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The nav, and the story's old anchors

**Files:**
- Modify: `src/components/shell/pill-nav.tsx`, `src/components/shell/pill-nav.test.tsx`, `src/lib/story.ts`, `src/app/lab/sand/sand-lab.tsx:1007-1008`
- Test: `src/lib/story.test.ts`

**Interfaces:**
- Produces: `sectionRedirect(hash: string): "/about" | "/contact" | null` in `src/lib/story.ts`.

- [ ] **Step 1: Update the nav tests (failing)**

In `src/components/shell/pill-nav.test.tsx`, replace the test `"About and Contact look like the others but go nowhere yet (Liam, 2026-10-11)"` and the test `"a case study sits under Projects: Projects is the active pill"` with:

```tsx
  test("About and Contact are their own pages, from everywhere (spec 2026-10-12 §5)", () => {
    for (const path of ["/lab/sand", "/cyvore", "/about"]) {
      pathname.mockReturnValue(path);
      const { unmount } = render(<PillNav />);
      expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
      expect(screen.getByRole("link", { name: "Contact" })).toHaveAttribute("href", "/contact");
      expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("data-next-link");
      unmount();
    }
  });

  test("the pill of the page you're on is lit", () => {
    pathname.mockReturnValue("/about");
    const { unmount } = render(<PillNav />);
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("aria-current", "page");
    unmount();
    pathname.mockReturnValue("/contact");
    render(<PillNav />);
    expect(screen.getByRole("link", { name: "Contact" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Projects" })).not.toHaveAttribute("aria-current");
  });

  test("a case study sits under Projects: Projects is the active pill", () => {
    pathname.mockReturnValue("/cyvore");
    useActiveSection.mockReturnValue("projects");
    render(<PillNav />);
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "About" })).not.toHaveAttribute("aria-current");
  });
```

And change the expectation in `"tracks the home sections and re-subscribes per page"` to `expect(useActiveSection).toHaveBeenCalledWith(["projects"], "/cyvore");`.

Create `src/lib/story.test.ts`:

```ts
import { expect, test } from "vitest";
import { sectionRedirect } from "./story";

test("old links to the story's About and Contact anchors go to the pages (spec 2026-10-12 §5)", () => {
  expect(sectionRedirect("#about")).toBe("/about");
  expect(sectionRedirect("#contact")).toBe("/contact");
  expect(sectionRedirect("#projects")).toBeNull();
  expect(sectionRedirect("")).toBeNull();
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/shell/pill-nav.test.tsx src/lib/story.test.ts`
Expected: FAIL: no link named "About"; `sectionRedirect` is not a function.

- [ ] **Step 3: Implement**

In `src/lib/story.ts`, append:

```ts
/** The story's old section anchors now have their own pages (spec 2026-10-12-about-contact-design.md §5). */
export function sectionRedirect(hash: string): "/about" | "/contact" | null {
  return hash === "#about" ? "/about" : hash === "#contact" ? "/contact" : null;
}
```

In `src/components/shell/pill-nav.tsx`:
- delete the `LIVE` set and its comment, and the whole `if (!LIVE.has(item.id)) { … }` branch;
- change `const SECTION_IDS = ITEMS.map((i) => i.id);` to `const SECTION_IDS = ["projects"] as const;   // (the story's one in-page section)`;
- replace the `active` computation with:

```tsx
  // About and Contact are pages; a case study sits under Projects; on the story, the index lights Projects
  const page = pathname === "/about" ? "about" : pathname === "/contact" ? "contact" : null;
  const active = page ?? (isHome ? activeSection : "projects");
```

- replace the link rendering inside `ITEMS.map` (from `const href = …` to the end of the returned expression) with:

```tsx
          const isPage = item.id !== "projects";
          const href = isPage ? `/${item.id}` : isHome ? "#projects" : `${STORY_HREF}#projects`;
          const current = isActive ? (isHome && !isPage ? "location" : "page") : undefined;
          // On home, Projects is a plain anchor so Lenis owns the smooth scroll (no router scrollIntoView fight).
          return isHome && !isPage ? (
            <a key={item.id} href={href} data-light="" aria-current={current} className={cls} style={style}>{item.label}</a>
          ) : (
            <Link key={item.id} href={href} data-light="" aria-current={current} className={cls} style={style}>{item.label}</Link>
          );
```

In `src/app/lab/sand/sand-lab.tsx`:
- delete the two lines `{hero && <div id="about" aria-hidden className="h-px" />}` and `{hero && <div id="contact" aria-hidden className="h-px" />}`;
- add `import { sectionRedirect } from "@/lib/story";` and `import { useRouter } from "next/navigation";` to the imports, `const router = useRouter();` as the first line inside `SandLab`, and this effect right after the existing `useState` declarations:

```tsx
  // old links to the story's About and Contact anchors: their pages now (spec 2026-10-12 §5)
  useEffect(() => {
    const to = sectionRedirect(window.location.hash);
    if (to) router.replace(to);
  }, [router]);
```

- [ ] **Step 4: Run them to see them pass, then the whole suite**

Run: `npx vitest run src/components/shell/pill-nav.test.tsx src/lib/story.test.ts && npm test`
Expected: PASS. If `src/app/lab/sand/page.test.tsx` renders `SandLab` without a router mock and now fails on `useRouter`, add at its top `vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }) }));` (merging with any existing mock of that module).

- [ ] **Step 5: Commit**

```bash
git add src/components/shell/pill-nav.tsx src/components/shell/pill-nav.test.tsx src/lib/story.ts src/lib/story.test.ts src/app/lab/sand/sand-lab.tsx src/app/lab/sand/page.test.tsx
git commit -m "feat(nav): About and Contact lead to their pages; old anchors redirect (spec 2026-10-12 §5)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The pull at the end of the index

**Files:**
- Modify: `src/app/lab/sand/work-index.tsx` (the `return` block, around lines 226-243)
- Test: `src/app/lab/sand/work-index.test.tsx`

**Interfaces:**
- Consumes: `NextPagePull` (Task 2), `ABOUT`, `plain` (Task 1).

- [ ] **Step 1: Write the failing test**

```tsx
// src/app/lab/sand/work-index.test.tsx
import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: React.ComponentProps<"a">) => <a href={href} {...rest}>{children}</a> }));

import { WorkIndex } from "./work-index";

test("past the last project, About peeks in: the pull to its page (spec 2026-10-12 §2), in both layouts", () => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} }) as never;
  render(<WorkIndex bind={() => {}} />);
  const links = screen.getAllByRole("link", { name: "Next: About", hidden: true });
  expect(links).toHaveLength(2);
  for (const l of links) expect(l).toHaveAttribute("href", "/about");
  expect(links[0]).toHaveTextContent("I’m Liam. I love crafting products where design and user needs meet.");
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/app/lab/sand/work-index.test.tsx`
Expected: FAIL, "Unable to find role="link" and name "Next: About"". (If it fails earlier on a missing browser API such as `ResizeObserver` or `HTMLMediaElement.play`, stub it at the top of the test file, e.g. `globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as never;`, then rerun until the failure is the missing link.)

- [ ] **Step 3: Add the pull**

In `work-index.tsx` add the imports:

```tsx
import { NextPagePull } from "@/components/shell/next-page-pull";
import { ABOUT, plain } from "@/content/about";
```

Then in the returned JSX, after `<Cards playing={playing.wide} />` inside `.page`, add:

```tsx
          <NextPagePull href="/about" label="About" line={plain(ABOUT.lines[0])} className="np-index" active={playing.wide} />
```

and after the list's `<Cards … />` inside the `.wl` section:

```tsx
        <NextPagePull href="/about" label="About" line={plain(ABOUT.lines[0])} className="np-index np-index-list" active={playing.list} />
```

and add to the `CSS` string constant in this file (the index is laid out in container units):

```css
.np-index { font-size: 1.15cqw; margin: 0 4cqw; }
.np-index-list { font-size: 15px; margin: 0 20px; }
```

- [ ] **Step 4: Run it to see it pass, then the suite**

Run: `npx vitest run src/app/lab/sand/work-index.test.tsx && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/lab/sand/work-index.tsx src/app/lab/sand/work-index.test.tsx
git commit -m "feat(index): past the last project, the pull to About (spec 2026-10-12 §2)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The About page

**Files:**
- Create: `src/app/about/track.ts`, `src/app/about/about-track.tsx`, `src/app/about/about.css`, `src/app/about/page.tsx`
- Test: `src/app/about/track.test.ts`, `src/app/about/about-track.test.tsx`

**Interfaces:**
- Consumes: `ABOUT`, `CONTACT`, `Line` (Task 1); `NextPagePull` (Task 2).
- Produces: `type TrackMode = "track" | "stack"`, `trackLayout(v: { w: number; h: number; reduced: boolean }): TrackMode`, `sectionHeight(trackW, viewW, vh): number`, `trackProgress(scrollY, top, height, vh): number`, `trackX(p, trackW, viewW): number`; `<AboutTrack />`.

Read first: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md` (pages are server components by default; metadata export).

- [ ] **Step 1: Write the failing maths tests**

```ts
// src/app/about/track.test.ts
import { describe, expect, test } from "vitest";
import { sectionHeight, trackLayout, trackProgress, trackX } from "./track";

describe("About's sideways track (spec 2026-10-12 §3)", () => {
  test("the page is a screen plus the track's overflow: one pixel of scroll moves it one pixel", () => {
    expect(sectionHeight(5000, 1440, 900)).toBe(900 + 3560);
    expect(sectionHeight(1000, 1440, 900)).toBe(900);
  });
  test("progress runs 0..1 across the pinned stretch, clamped", () => {
    expect(trackProgress(100, 200, 4460, 900)).toBe(0);
    expect(trackProgress(200 + 1780, 200, 4460, 900)).toBeCloseTo(0.5, 9);
    expect(trackProgress(99999, 200, 4460, 900)).toBe(1);
    expect(trackProgress(500, 200, 900, 900)).toBe(0);
  });
  test("the track moves left by exactly its overflow", () => {
    expect(trackX(0, 5000, 1440)).toBeCloseTo(0, 9);
    expect(trackX(1, 5000, 1440)).toBe(-3560);
    expect(trackX(1, 1000, 1440)).toBeCloseTo(0, 9);
  });
  test("portrait phones and reduced motion stack it: never a sideways scroll (Review Focus 3)", () => {
    expect(trackLayout({ w: 1440, h: 900, reduced: false })).toBe("track");
    expect(trackLayout({ w: 390, h: 844, reduced: false })).toBe("stack");
    expect(trackLayout({ w: 1440, h: 900, reduced: true })).toBe("stack");
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/app/about/track.test.ts`
Expected: FAIL, "Failed to resolve import "./track"".

- [ ] **Step 3: Write the maths**

```ts
// src/app/about/track.ts
/**
 * About's sideways track (spec 2026-10-12-about-contact-design.md §3): a pinned section whose height is a screen plus
 * the track's overflow, so one pixel of scroll moves the track one pixel; scrubbed, never on its own clock. Portrait
 * phones and reduced motion stack the slides instead (no sideways scroll at all).
 */
export type TrackMode = "track" | "stack";

export const trackLayout = ({ w, h, reduced }: { w: number; h: number; reduced: boolean }): TrackMode =>
  reduced || w / h < 1 ? "stack" : "track";

export const sectionHeight = (trackW: number, viewW: number, vh: number) => vh + Math.max(trackW - viewW, 0);

export function trackProgress(scrollY: number, top: number, height: number, vh: number): number {
  if (height <= vh) return 0;
  return Math.min(Math.max((scrollY - top) / (height - vh), 0), 1);
}

export const trackX = (p: number, trackW: number, viewW: number) => -p * Math.max(trackW - viewW, 0);
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/app/about/track.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the failing page tests**

```tsx
// src/app/about/about-track.test.tsx
import { render, screen, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: React.ComponentProps<"a">) => <a href={href} {...rest}>{children}</a> }));

import { AboutTrack } from "./about-track";
import { ABOUT, plain } from "@/content/about";

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} }) as never;
});

test("the whole approved text, in reading order, under an About heading", () => {
  render(<AboutTrack />);
  expect(screen.getByRole("heading", { level: 1, name: "About" })).toBeInTheDocument();
  const text = document.body.textContent!;
  let at = 0;
  for (const l of [...ABOUT.lines, ABOUT.closing]) {
    const i = text.indexOf(plain(l), at);
    expect(i).toBeGreaterThanOrEqual(at);
    at = i;
  }
});

test("two colours: the highlights are the near-white spans", () => {
  render(<AboutTrack />);
  const his = [...document.querySelectorAll(".hi")].map((n) => n.textContent);
  expect(his).toContain("I’m Liam. I love crafting products");
  expect(his).toContain("we closed our first funding round.");
});

test("the quotes are quotes: a blockquote with who said it", () => {
  render(<AboutTrack />);
  const fig = screen.getByText("Yoav Rotem · CTO, Cyvore").closest("figure")!;
  expect(within(fig).getByText(/we closed our first funding round/).closest("blockquote")).not.toBeNull();
});

test("What I do: three verbs, twelve skills, each proof linking to its case study (3D modeling: no link)", () => {
  render(<AboutTrack />);
  expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Find the problem.", "Check I’m right.", "Build it."]);
  expect(screen.getAllByRole("listitem")).toHaveLength(12);
  expect(screen.getByRole("link", { name: /finding a section, 35s → 8s/ })).toHaveAttribute("href", "/cyvore");
  expect(screen.queryByRole("link", { name: /modelled and lit in Blender/ })).toBeNull();
});

test("the resume opens in a new tab, safely; the pull leads to Contact", () => {
  render(<AboutTrack />);
  const cv = screen.getByRole("link", { name: /View resume/ });
  expect(cv).toHaveAttribute("target", "_blank");
  expect(cv).toHaveAttribute("rel", "noopener noreferrer");
  expect(screen.getByRole("link", { name: "Next: Contact" })).toHaveAttribute("href", "/contact");
});
```

- [ ] **Step 6: Run them to see them fail**

Run: `npx vitest run src/app/about/about-track.test.tsx`
Expected: FAIL, "Failed to resolve import "./about-track"".

- [ ] **Step 7: Write the component, its look and the route**

```tsx
// src/app/about/about-track.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { NextPagePull } from "@/components/shell/next-page-pull";
import { ABOUT, CONTACT, type Line } from "@/content/about";
import { sectionHeight, trackLayout, trackProgress, trackX } from "./track";
import "./about.css";

/** A line in two colours: its highlights in the near-white, the rest in the darker tone (Liam, 2026-10-12). */
function Words({ line }: { line: Line }) {
  return <>{line.map((s, i) => <span key={i} className={s.hi ? "hi" : undefined}>{s.t}</span>)}</>;
}

/**
 * About (spec 2026-10-12-about-contact-design.md §3): Liam's text, the quotes as its proof, What I do under his three
 * verbs, the resume, then the pull to Contact. A pinned sideways track scrubbed by scroll (track.ts); stacked on portrait
 * phones and under reduced motion. No WebGL: the quiet reading page.
 */
export function AboutTrack() {
  const section = useRef<HTMLElement>(null), track = useRef<HTMLDivElement>(null), bar = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const sec = section.current, tr = track.current;
    if (!sec || !tr) return;
    let raf = 0, height = 0;
    const frame = () => {
      if (sec.dataset.mode !== "track") return;
      const p = trackProgress(window.scrollY, sec.offsetTop, height, window.innerHeight);
      tr.style.transform = `translate3d(${trackX(p, tr.scrollWidth, window.innerWidth)}px, 0, 0)`;
      if (bar.current) bar.current.style.transform = `scaleX(${p})`;
    };
    const layout = () => {
      const mode = trackLayout({ w: window.innerWidth, h: window.innerHeight, reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches });
      sec.dataset.mode = mode;
      if (mode === "stack") { sec.style.height = ""; tr.style.transform = ""; return; }
      height = sectionHeight(tr.scrollWidth, window.innerWidth, window.innerHeight);
      sec.style.height = `${height}px`;
      frame();
    };
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); };
    layout();
    void document.fonts?.ready.then(layout);
    window.addEventListener("resize", layout);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", layout); window.removeEventListener("scroll", onScroll); };
  }, []);
  const last = ABOUT.verbs.length - 1;
  return (
    <>
      <section ref={section} className="ab" data-mode="track" data-portrait={ABOUT.portrait ? "" : undefined} aria-labelledby="about-h">
        <h1 id="about-h" className="sr-only">About</h1>
        <div className="ab-pin">
          <div className="ab-clip">
            <div ref={track} className="ab-track">
              {ABOUT.lines.map((l, i) => <p key={i} className="ab-slide ab-big"><Words line={l} /></p>)}
              {ABOUT.quotes.map((q) => (
                <figure key={q.name} className="ab-slide ab-quote">
                  <blockquote><Words line={q.text} /></blockquote>
                  <figcaption className="ab-mono">{q.name} · {q.role}</figcaption>
                </figure>
              ))}
              <p className="ab-slide ab-big"><Link href={ABOUT.opening.href} className="ab-open"><Words line={ABOUT.opening.text} /></Link></p>
              {ABOUT.verbs.map((v, i) => (
                <div key={v.title} className="ab-slide ab-verb">
                  <div className="ab-mono">What I do · {i + 1} of {ABOUT.verbs.length}</div>
                  <h2 className="ab-verb-title">{v.title}</h2>
                  <ul className="ab-skills">
                    {v.skills.map((s) => (
                      <li key={s.name}>
                        <span className="ab-skill">{s.name}</span>
                        {s.href ? <Link href={s.href} className="ab-proof">{s.proof} ↗</Link> : <span className="ab-proof">{s.proof}</span>}
                      </li>
                    ))}
                  </ul>
                  {i === last && <a href={ABOUT.resume.href} target="_blank" rel="noopener noreferrer" className="ab-pill">{ABOUT.resume.label} ↗</a>}
                </div>
              ))}
              <p className="ab-slide ab-big"><Words line={ABOUT.closing} /></p>
            </div>
          </div>
          {ABOUT.portrait && (
            <Image className="ab-portrait" src={ABOUT.portrait.src} alt={ABOUT.portrait.alt} width={ABOUT.portrait.width} height={ABOUT.portrait.height} sizes="21vw" priority />
          )}
          <span className="ab-bar" aria-hidden><span ref={bar} /></span>
        </div>
      </section>
      <div className="ab-end">
        <NextPagePull href="/contact" label="Contact" line={CONTACT.headline} />
      </div>
    </>
  );
}
```

```css
/* src/app/about/about.css (spec 2026-10-12 §3): the graded black, Geist in two colours, no WebGL, no glow */
.ab { position: relative; background: #0b0908; color: rgba(244, 239, 233, 0.42); font-family: var(--font-sans); }
.ab .hi { color: #f4efe9; }
.ab-pin { position: relative; }
.ab[data-mode="track"] .ab-pin { position: sticky; top: 0; height: 100svh; overflow: hidden; }
.ab-clip { position: absolute; inset: 0; overflow: hidden; }
.ab[data-portrait][data-mode="track"] .ab-clip { right: 33vw; }   /* the track passes before the portrait, never under it */
.ab-track { display: flex; align-items: center; gap: 7vw; height: 100%; width: max-content; padding: 0 12vw 0 6vw; will-change: transform; }
.ab-slide { flex: 0 0 auto; margin: 0; max-width: 52vw; }
.ab-big { font-size: clamp(28px, 4vw, 72px); line-height: 1.15; letter-spacing: -0.01em; }
.ab-open { color: inherit; text-decoration: none; }
.ab-open:hover .hi, .ab-open:focus-visible .hi { text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 0.15em; }
.ab-quote { max-width: 58vw; }
.ab-quote blockquote { margin: 0; font-size: clamp(24px, 3.1vw, 56px); line-height: 1.2; position: relative; }
.ab-quote blockquote::before { content: "\201C"; position: absolute; left: -0.6em; color: #f4efe9; opacity: 0.45; }
.ab-mono { font: 400 clamp(11px, 0.95vw, 14px)/1.4 var(--font-mono); letter-spacing: 0.06em; text-transform: uppercase; color: rgba(244, 239, 233, 0.55); }
.ab-quote figcaption { margin-top: 2.2vw; }
.ab-verb { max-width: 60vw; }
.ab-verb-title { margin: 1.4vw 0 0; font-weight: 400; font-size: clamp(26px, 3.2vw, 56px); color: #f4efe9; }
.ab-skills { list-style: none; margin: 2.4vw 0 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.9vw 4vw; }
.ab-skill { display: block; font-size: clamp(17px, 1.75vw, 30px); color: #f4efe9; }
.ab-skill::before { content: ""; display: inline-block; width: 0.32em; height: 0.32em; border: 1px solid rgba(230, 191, 174, 0.8); margin: 0 0.6em 0.15em 0; vertical-align: middle; }
.ab-proof { display: block; margin: 0.35vw 0 0 0.95em; font-size: clamp(13px, 1.1vw, 18px); color: rgba(244, 239, 233, 0.45); text-decoration: none; }
a.ab-proof:hover, a.ab-proof:focus-visible { color: #f4efe9; }
.ab-pill { display: inline-block; margin-top: 3.2vw; padding: 0.85em 1.5em; border-radius: 99px; border: 1px solid rgba(255, 255, 255, 0.18); background: rgba(20, 16, 15, 0.7); color: #f4efe9; font-size: clamp(14px, 1.2vw, 18px); text-decoration: none; }
.ab-portrait { position: absolute; right: 7vw; top: 22%; width: 21vw; height: auto; aspect-ratio: 4 / 5; object-fit: cover; border-radius: 4px; }
.ab-bar { position: absolute; left: 6vw; right: 6vw; bottom: 4.5vw; height: 1px; background: rgba(255, 255, 255, 0.1); }
.ab-bar > span { position: absolute; inset: 0; background: rgba(230, 191, 174, 0.7); transform-origin: left; transform: scaleX(0); }
.ab-end { background: #0b0908; padding: 10vh 6vw 30vh; font-size: clamp(14px, 1.2vw, 20px); }
/* stacked: portrait phones and reduced motion (track.ts) */
.ab[data-mode="stack"] .ab-clip { position: static; }
.ab[data-mode="stack"] .ab-track { flex-direction: column; align-items: stretch; width: auto; height: auto; padding: 18vh 6vw 6vh; gap: 0; transform: none !important; }
.ab[data-mode="stack"] .ab-slide { max-width: none; min-height: 70svh; display: flex; flex-direction: column; justify-content: center; }
.ab[data-mode="stack"] .ab-big { font-size: clamp(28px, 7.5vw, 48px); }
.ab[data-mode="stack"] .ab-skills { grid-template-columns: 1fr; gap: 18px; }
.ab[data-mode="stack"] .ab-portrait { position: static; width: 60vw; margin: 0 6vw; }
.ab[data-mode="stack"] .ab-bar { display: none; }
```

```tsx
// src/app/about/page.tsx
import type { Metadata } from "next";
import { AboutTrack } from "./about-track";

export const metadata: Metadata = { title: "About", description: "Liam Hasson, product designer: how I work, what people say, what I do." };

export default function AboutPage() {
  return <AboutTrack />;
}
```

If `sr-only` isn't already a utility in `src/app/globals.css` (Tailwind provides it), it is: the root layout uses `sr-only`. No action needed.

- [ ] **Step 8: Run the tests to see them pass, then the suite and the build**

Run: `npx vitest run src/app/about && npm test && npx tsc --noEmit -p . && npx eslint src/app/about src/content src/lib src/components/shell`
Expected: PASS, no type or lint errors.

- [ ] **Step 9: Commit**

```bash
git add src/app/about src/content/about.ts
git commit -m "feat(about): the About page: two colours, the quotes as proof, What I do, the pull to Contact (spec 2026-10-12 §3)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Contact's words and pills

**Files:**
- Create: `src/app/contact/contact-end.tsx`
- Test: `src/app/contact/contact-end.test.tsx`

**Interfaces:**
- Consumes: `CONTACT` (Task 1).
- Produces: `<ContactEnd show={number} />` (`show` 0..1: how far the words have arrived).

- [ ] **Step 1: Write the failing tests**

```tsx
// src/app/contact/contact-end.test.tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ContactEnd } from "./contact-end";

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("Contact's words (spec 2026-10-12 §4)", () => {
  test("the headline and the three ways in", () => {
    render(<ContactEnd show={1} />);
    expect(screen.getByRole("heading", { level: 1, name: "Got something on your mind?" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Liamhasson@gmail.com/ })).toHaveAttribute("href", "mailto:Liamhasson@gmail.com");
    const li = screen.getByRole("link", { name: /LinkedIn/ });
    expect(li).toHaveAttribute("href", "https://www.linkedin.com/in/liamhasson/");
    expect(li).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: "+49 160 771 0652" })).toHaveAttribute("href", "tel:+491607710652");
  });
  test("a click on the email copies it and says so for 2 s", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ContactEnd show={1} />);
    const email = screen.getByRole("link", { name: /Liamhasson@gmail.com/ });
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 });
    await act(async () => { email.dispatchEvent(ev); });
    expect(ev.defaultPrevented).toBe(true);
    expect(writeText).toHaveBeenCalledWith("Liamhasson@gmail.com");
    expect(screen.getByRole("status")).toHaveTextContent("Copied");
    act(() => { vi.advanceTimersByTime(2100); });
    expect(screen.getByRole("status")).toHaveTextContent("");
  });
  test("from the keyboard (Enter: a click with no detail) the mailto: opens", () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    render(<ContactEnd show={1} />);
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true, detail: 0 });
    screen.getByRole("link", { name: /Liamhasson@gmail.com/ }).dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });
  test("no clipboard (insecure page, refused): the mailto: opens instead (Review Focus 4)", () => {
    Object.assign(navigator, { clipboard: undefined });
    render(<ContactEnd show={1} />);
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 });
    screen.getByRole("link", { name: /Liamhasson@gmail.com/ }).dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });
  test("before they arrive the words are invisible and out of the focus order", () => {
    render(<ContactEnd show={0} />);
    const wrap = screen.getByTestId("contact-words");
    expect(wrap).toHaveAttribute("inert");
    expect(wrap.style.opacity).toBe("0");
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/app/contact/contact-end.test.tsx`
Expected: FAIL, "Failed to resolve import "./contact-end"".

- [ ] **Step 3: Write the component**

```tsx
// src/app/contact/contact-end.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { CONTACT } from "@/content/about";

/**
 * Contact's words (spec 2026-10-12-about-contact-design.md §4): the headline, then Email, LinkedIn, Phone as pills in
 * the nav's style. A click on the email copies it ("Copied" in place for 2 s); from the keyboard, or where there is no
 * clipboard, it is a plain mailto:. `show` (0..1): how far the words have arrived; before, they are inert.
 */
export function ContactEnd({ show }: { show: number }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const onEmail = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const clip = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
    if (e.detail === 0 || !clip?.writeText) return;   // (keyboard, or no clipboard: the mailto: opens)
    e.preventDefault();
    clip.writeText(CONTACT.email).then(() => {
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    }, () => { window.location.href = `mailto:${CONTACT.email}`; });
  };
  const k = Math.min(Math.max(show, 0), 1);
  return (
    <div data-testid="contact-words" className="ct-words" inert={k < 0.5 ? true : undefined}
      style={{ opacity: String(k), transform: `translateY(${(1 - k) * 14}px)` }}>
      <h1 className="ct-head">{CONTACT.headline}</h1>
      <div className="ct-pills">
        <a href={`mailto:${CONTACT.email}`} onClick={onEmail} className="ct-pill">{copied ? "Copied" : CONTACT.email}</a>
        <a href={CONTACT.linkedin} target="_blank" rel="noopener noreferrer" className="ct-pill">LinkedIn ↗</a>
        <a href={`tel:${CONTACT.phone.replace(/\s/g, "")}`} className="ct-pill">{CONTACT.phone}</a>
      </div>
      <p role="status" className="sr-only">{copied ? "Copied" : ""}</p>
    </div>
  );
}
```

Note: when `copied` is true, the email link's accessible name becomes "Copied"; the tests click before that, so they still find it by the address. Keep it.

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/app/contact/contact-end.test.tsx`
Expected: PASS (5 tests). If `inert` is not accepted by the installed React types, render `inert={k < 0.5 ? "" : undefined}` instead (React 19 accepts the boolean; older types want a string).

- [ ] **Step 5: Commit**

```bash
git add src/app/contact/contact-end.tsx src/app/contact/contact-end.test.tsx
git commit -m "feat(contact): the words and the three pills; the email copies on click (spec 2026-10-12 §4)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The cascade can end on the ball

**Files:**
- Modify: `src/three/sand/sand-field.ts:169` (uniform), `:392-401` (`restWords`), `:404-410` (`setCascade`); `src/three/sand/shaders.ts:209-216` (`cascadeRest`); `src/three/sand/cascade.ts` (add `ballRestOf`)
- Test: `src/three/sand/cascade.test.ts`, `src/three/sand/sand-cascade.test.ts`

**Interfaces:**
- Produces: `ballRestOf(wordB: number, ballC: V3, posMax: number): V3` (identity rotation); `SandField.setCascade(clock: number | null, anchors?: THREE.Vector3[], target: "cloud" | "ball" = "cloud")`; `uCascade.z` = 1 when the target is the ball, else 0.

- [ ] **Step 1: Write the failing tests**

Append to `src/three/sand/cascade.test.ts`:

```ts
import { ballRestOf } from "./cascade";

describe("the cascade can end on the ball (Contact, spec 2026-10-12 §4)", () => {
  const pack = (ox: number, oy: number, dist: number) => ((Math.round(((ox + 1) / 2) * 4095)) | (Math.round(((oy + 1) / 2) * 4095) << 12) | (dist << 24)) >>> 0;
  test("a grain's ball spot: its octahedral direction from the centre, at its distance (the shader's own decoding)", () => {
    const c: [number, number, number] = [1, 2, 3];
    const front = ballRestOf(pack(0, 0, 255), c, 0.5);
    expect(front[0]).toBeCloseTo(1, 2); expect(front[1]).toBeCloseTo(2, 2); expect(front[2]).toBeCloseTo(3.5, 2);
    const side = ballRestOf(pack(1, 0, 128), c, 0.5);
    expect(side[0] - 1).toBeCloseTo((128 / 255) * 0.5, 2);
    // the back half folds: a direction with z < 0
    const back = ballRestOf(pack(0.5, 0.6, 255), c, 0.5);
    expect(back[2]).toBeLessThan(3);
    expect(Math.hypot(back[0] - 1, back[1] - 2, back[2] - 3)).toBeCloseTo(0.5, 2);
  });
});
```

(If `describe` isn't imported in that file yet, add it to the existing `vitest` import.)

Append to `src/three/sand/sand-cascade.test.ts`:

```ts
test("the cascade's rest spot can be the grain's place on the ball (Contact): the ball word sits beside the chaos word", () => {
  expect(SAND_VERTEX).toMatch(/uvec2 word = texelFetch\(uRestWords/);
  expect(SAND_VERTEX).toMatch(/if \(uCascade\.z > 0\.5\)/);
  expect(SAND_VERTEX).toMatch(/uBallC \+ uBallRot \* \(normalize\(dir\)/);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/three/sand/cascade.test.ts src/three/sand/sand-cascade.test.ts`
Expected: FAIL: `ballRestOf` is not exported; the shader patterns don't match.

- [ ] **Step 3: Implement the mirror, the texture, the shader and the setter**

In `src/three/sand/cascade.ts`, append:

```ts
/** A grain's spot on the ball from its packed ball word (the vertex shader's decoding, unrotated): octahedral direction
 *  12+12 bits, distance 8 bits of `posMax`. Contact's cascade ends here (spec 2026-10-12-about-contact-design.md §4). */
export function ballRestOf(wordB: number, ballC: V3, posMax: number): V3 {
  const ox = ((wordB & 4095) / 4095) * 2 - 1, oy = (((wordB >>> 12) & 4095) / 4095) * 2 - 1;
  let x = ox, y = oy;
  const z = 1 - Math.abs(ox) - Math.abs(oy), fold = Math.max(-z, 0);
  x -= Math.sign(x) * fold; y -= Math.sign(y) * fold;
  const l = Math.hypot(x, y, z) || 1, d = ((wordB >>> 24) / 255) * posMax;
  return [ballC[0] + (x / l) * d, ballC[1] + (y / l) * d, ballC[2] + (z / l) * d];
}
```

In `src/three/sand/sand-field.ts`, replace `restWords`:

```ts
  /** Every grain's packed words, chaos and ball, in an integer texture (the cascade reads its ancestors' rest spots:
   *  in the cloud for the loader, on the ball for Contact). */
  private restWords(data: SandData): THREE.DataTexture {
    const W = 2048, H = Math.ceil(data.count / W);
    const buf = new Uint32Array(W * H * 2);
    for (let i = 0; i < data.count; i++) { buf[i * 2] = data.words[i * 2]; buf[i * 2 + 1] = data.words[i * 2 + 1]; }
    const tex = new THREE.DataTexture(buf, W, H, THREE.RGIntegerFormat, THREE.UnsignedIntType);
    tex.internalFormat = "RG32UI";
    tex.minFilter = tex.magFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    return tex;
  }
```

and replace `setCascade`:

```ts
  /** The loader's cascade (cascade.ts): seconds since 100% (null: off, the hero as it is), the brief's anchors, and
   *  where the grains end: the cloud (the loader) or the ball (Contact). */
  setCascade(clock: number | null, anchors?: THREE.Vector3[], target: "cloud" | "ball" = "cloud"): void {
    const u = this.material.uniforms;
    if (anchors) anchors.forEach((a, i) => (u.uAnchors.value[i] as THREE.Vector3).copy(a));
    if (clock === null) { (u.uCascade.value as THREE.Vector3).set(0, 0, 0); return; }
    (u.uCascade.value as THREE.Vector3).set(clock, 1, target === "ball" ? 1 : 0);
    (u.uMotionBlur.value as THREE.Vector2).x = 0;   // (no streaks while it runs: its paths aren't the blur's)
  }
```

Check the uniform's initial value where `uCascade` is declared in the constructor (search `uCascade:`): make it `new THREE.Vector3(0, 0, 0)`.

In `src/three/sand/shaders.ts`, replace the `uCascade` line comment and `cascadeRest`:

```glsl
uniform vec3 uCascade;                 // x: seconds since 100% (the loader), y: 1 while it runs, z: 1 to end on the ball
vec3 cascadeRest(int i) {
  int w = textureSize(uRestWords, 0).x;
  uvec2 word = texelFetch(uRestWords, ivec2(i - (i / w) * w, i / w), 0).rg;
  if (uCascade.z > 0.5) {
    // its place on the ball (Contact): the same decoding as main()'s B
    vec2 oc = vec2(float(word.y & 4095u), float((word.y >> 12) & 4095u)) / 4095.0 * 2.0 - 1.0;
    vec3 dir = vec3(oc, 1.0 - abs(oc.x) - abs(oc.y));
    float fold = max(-dir.z, 0.0);
    dir.xy -= sign(dir.xy) * fold;
    return uBallC + uBallRot * (normalize(dir) * (float(word.y >> 24) / 255.0 * uBallPosMax));
  }
  vec3 A0 = uChaosLo + vec3(float(word.x & 2047u) / 2047.0, float((word.x >> 11) & 1023u) / 1023.0, float(word.x >> 21) / 2047.0) * uChaosSize;
  return uChaosC + uChaosShift + uChaosRot * (A0 - uChaosC);
}
```

(`uBallC`, `uBallRot`, `uBallPosMax` are declared above this point in `SAND_VERTEX`; if the compiler says otherwise, move this function below their declarations.)

- [ ] **Step 4: Run them to see them pass, then the suite**

Run: `npx vitest run src/three/sand && npm test`
Expected: PASS. The existing loader tests still pass: the loader calls `setCascade(clock, anchors)` and gets the cloud.

- [ ] **Step 5: Check the loader still looks right in a browser**

Use `preview_start` (the project's dev server in `.claude/launch.json`; do not edit that file) and open `/lab/sand?hero&loader`. Expected: the brief grows, its anchors split into grains that build the vortex, as before; no console errors (`read_console_messages`).

- [ ] **Step 6: Commit**

```bash
git add src/three/sand/cascade.ts src/three/sand/cascade.test.ts src/three/sand/sand-cascade.test.ts src/three/sand/sand-field.ts src/three/sand/shaders.ts
git commit -m "feat(sand): the cascade can end on the ball as well as the cloud (Contact, spec 2026-10-12 §4)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Contact's framing and timeline

**Files:**
- Create: `src/three/sand/contact-view.ts`, `src/app/contact/contact-timeline.ts`
- Test: `src/three/sand/contact-view.test.ts`, `src/app/contact/contact-timeline.test.ts`

**Interfaces:**
- Consumes: `LOADER` from `src/app/lab/sand/loader-timeline.ts` (`round: 0.6`, `copy: [2.8, 3.6]`).
- Produces: `CONTACT_FRAME = { share: 0.3, at: 0.42 }`, `contactView(q: THREE.Quaternion, ballC: THREE.Vector3, ballR: number, vfovRad: number, frame?): THREE.Vector3`; `CONTACT_T = { round: 0.6, words: [2.8, 3.6], stall: 15 }`, `contactAt(t0: number): { round: number; cascade: number; words: number }`, `contactStalled(stalledFor: number, progress: number): boolean`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/three/sand/contact-view.test.ts
import * as THREE from "three";
import { expect, test } from "vitest";
import { CONTACT_FRAME, contactView } from "./contact-view";

test("Contact's camera: the ball fills about 30% of the view's height, its centre 42% from the top, centred across", () => {
  const cam = new THREE.PerspectiveCamera(30, 16 / 10, 0.1, 100);
  cam.position.set(0, 0.4, 9); cam.lookAt(0, 0.1, 0);
  const ballC = new THREE.Vector3(0.2, 0.1, -0.3), ballR = 1.1;
  cam.position.copy(contactView(cam.quaternion, ballC, ballR, THREE.MathUtils.degToRad(cam.fov)));
  cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const c = ballC.clone().project(cam);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
  const top = ballC.clone().addScaledVector(up, ballR).project(cam);
  expect((1 - c.y) / 2).toBeCloseTo(CONTACT_FRAME.at, 2);
  expect(c.x).toBeCloseTo(0, 3);
  expect(Math.abs(top.y - c.y)).toBeCloseTo(CONTACT_FRAME.share, 1);   // (a diameter's share of the height, NDC spans 2)
});
```

```ts
// src/app/contact/contact-timeline.test.ts
import { expect, test } from "vitest";
import { CONTACT_T, contactAt, contactStalled } from "./contact-timeline";

test("after the brief is full: its corners round, then the cascade, then the words", () => {
  expect(contactAt(0).round).toBe(0);
  expect(contactAt(CONTACT_T.round).round).toBe(1);
  expect(contactAt(0.3).cascade).toBeLessThan(0);
  expect(contactAt(CONTACT_T.round + 1).cascade).toBeCloseTo(1, 9);
  expect(contactAt(CONTACT_T.round + 2.7).words).toBe(0);
  expect(contactAt(CONTACT_T.round + 3.6).words).toBe(1);
});

test("a stalled load gives up after 15 s, never while it still moves or once it's complete (Review Focus 5)", () => {
  expect(contactStalled(15.1, 0.4)).toBe(true);
  expect(contactStalled(14.9, 0.4)).toBe(false);
  expect(contactStalled(30, 1)).toBe(false);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/three/sand/contact-view.test.ts src/app/contact/contact-timeline.test.ts`
Expected: FAIL, unresolved imports.

- [ ] **Step 3: Write them**

```ts
// src/three/sand/contact-view.ts
import * as THREE from "three";

/** Contact's framing (spec 2026-10-12-about-contact-design.md §4): the ball about 30% of the view's height, its centre
 *  a little above the middle, so the words sit below it. */
export const CONTACT_FRAME = { share: 0.3, at: 0.42 } as const;

/** Where the camera stands, keeping its orientation `q`, so the ball (centre, radius) fills `share` of the view's height
 *  with its centre `at` from the top. */
export function contactView(q: THREE.Quaternion, ballC: THREE.Vector3, ballR: number, vfovRad: number, frame: { share: number; at: number } = CONTACT_FRAME): THREE.Vector3 {
  const tanV = Math.tan(vfovRad / 2);
  const d = ballR / (frame.share * tanV);
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q), up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  const yNdc = 1 - 2 * frame.at;   // (the ball's centre above the middle: the camera stands that much lower)
  return ballC.clone().addScaledVector(fwd, -d).addScaledVector(up, -yNdc * d * tanV);
}
```

```ts
// src/app/contact/contact-timeline.ts
import { LOADER } from "@/app/lab/sand/loader-timeline";

/** Contact's beats after the brief is full (spec 2026-10-12-about-contact-design.md §4): the loader's own rounding and
 *  cascade, then the words; and when a load is given up for stalled. */
export const CONTACT_T = { round: LOADER.round, words: LOADER.copy, stall: 15 } as const;

const ease = (x: number) => { const t = Math.min(Math.max(x, 0), 1); return t * t * (3 - 2 * t); };

export function contactAt(t0: number) {
  const t = t0 - CONTACT_T.round;
  return {
    round: ease(t0 / CONTACT_T.round),
    cascade: t,
    words: ease((t - CONTACT_T.words[0]) / (CONTACT_T.words[1] - CONTACT_T.words[0])),
  };
}

export const contactStalled = (stalledFor: number, progress: number) => progress < 1 && stalledFor > CONTACT_T.stall;
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/three/sand/contact-view.test.ts src/app/contact/contact-timeline.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/three/sand/contact-view.ts src/three/sand/contact-view.test.ts src/app/contact/contact-timeline.ts src/app/contact/contact-timeline.test.ts
git commit -m "feat(contact): its framing and timeline (spec 2026-10-12 §4)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: The Contact page

**Files:**
- Create: `src/app/contact/contact-scene.tsx`, `src/app/contact/contact.css`, `src/app/contact/page.tsx`

**Interfaces:**
- Consumes: `Stage` (`src/three/stage.ts`), `loadSandMeta`, `loadSandParts`, `SAND_BASE` (`src/three/sand/data.ts`), `SandField`, `SandState` (`src/three/sand/sand-field.ts`), `SAND_ENCODE`, `SAND_LAYER`, `SandComposite` (`src/three/sand/sand-composite.ts`), `FilmGradePass`, `PaintField`, `LoadProgress`, `anchorsWorld` (`src/three/sand/cascade.ts`), `ballKeyPos` (`src/three/sand/ball-light.ts`), `pickTier`, `readSignals`, `parseTierOverride`, `settingsFor` (`src/three/tier.ts`), `Brief`, `BriefHandle`, `BriefGrowth` (`src/app/lab/sand/brief.tsx`), `setCascade(…, "ball")` (Task 7), `contactView` (Task 8), `contactAt`, `contactStalled` (Task 8), `ContactEnd` (Task 6).

This task is the WebGL scene: it has no unit test of its own (its parts are tested in Tasks 6–8); it is verified in the browser in Steps 3–5.

- [ ] **Step 1: Write the scene, its look and the route**

```tsx
// src/app/contact/contact-scene.tsx
"use client";

import * as THREE from "three";
import { useEffect, useRef, useState } from "react";
import { Stage } from "@/three/stage";
import { loadSandMeta, loadSandParts, SAND_BASE } from "@/three/sand/data";
import { SandField, type SandState } from "@/three/sand/sand-field";
import { SAND_ENCODE, SAND_LAYER, SandComposite } from "@/three/sand/sand-composite";
import { FilmGradePass } from "@/three/sand/film-grade-pass";
import { PaintField } from "@/three/sand/paint";
import { LoadProgress } from "@/three/sand/load-progress";
import { anchorsWorld } from "@/three/sand/cascade";
import { ballKeyPos } from "@/three/sand/ball-light";
import { contactView } from "@/three/sand/contact-view";
import { parseTierOverride, pickTier, readSignals, settingsFor } from "@/three/tier";
import { Brief, type BriefHandle, BriefGrowth } from "@/app/lab/sand/brief";
import { contactAt, contactStalled } from "./contact-timeline";
import { ContactEnd } from "./contact-end";
import "./contact.css";

const damp = (a: number, b: number, k: number, dt: number) => b + (a - b) * Math.exp(-k * dt);

/**
 * Contact (spec 2026-10-12-about-contact-design.md §4): the loader's entry, ending on the ball. The brief grows from a
 * point while the sand loads (its size the progress); at 100% its corners round, its anchors become grains and split
 * (the loader's cascade), and the grains gather into the ball inside the brief, which stays. Then the words. The ball
 * keeps its slow spin; the cursor's light touches it. Reduced motion: the ball held formed, the brief drawn. No WebGL,
 * an error or a stalled load: the ball as a still with the brief over it, and the words.
 */
export function ContactScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const briefRef = useRef<BriefHandle>(null);
  const [words, setWords] = useState(0);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let stage: Stage | null = null, field: SandField | null = null, paint: PaintField | null = null;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const progress = new LoadProgress();
    progress.expect("/lab/grain.png", 60e3);
    progress.expect("haze", 90e3);
    const growth = new BriefGrowth();
    let ball = { cx: window.innerWidth / 2, cy: window.innerHeight * 0.42, r: window.innerHeight * 0.15 };
    let since = 0, last = performance.now(), lastP = -1, stalledFor = 0, raf = 0, growing = true;
    let onFull: (() => void) | null = null;
    const cleanups: (() => void)[] = [];
    // the still: no WebGL, an error, or a stalled load; never a blank page
    const giveUp = () => {
      growing = false; cancelAnimationFrame(raf);
      stage?.stop();
      setStill(true); setWords(1);
      briefRef.current?.update({ cx: window.innerWidth / 2, cy: window.innerHeight * 0.42, r: window.innerHeight * 0.15, alpha: 1, dash: 0, squares: Array(9).fill(1), round: 1 });
    };
    // the brief grows on its own frames while the sand loads (the stage isn't there yet)
    const grow = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now; since += dt;
      if (progress.value !== lastP) { lastP = progress.value; stalledFor = 0; } else stalledFor += dt;
      if (contactStalled(stalledFor, progress.value)) { giveUp(); return; }
      const size = growth.step(progress.value, since, dt);
      briefRef.current?.update({ ...ball, r: ball.r * size, alpha: 1, dash: 0, squares: Array(9).fill(1), round: 0 });
      briefRef.current?.announce(progress.value);
      if (size >= 0.999 && onFull) { const f = onFull; onFull = null; f(); }
      if (growing) raf = requestAnimationFrame(grow);
    };
    raf = requestAnimationFrame(grow);

    (async () => {
      const probe = document.createElement("canvas").getContext("webgl2");
      if (!probe || new URLSearchParams(window.location.search).has("nogl")) { giveUp(); return; }   // (?nogl: the fallback, as in the story)
      const tier = pickTier(readSignals(probe), parseTierOverride(window.location.search));
      const meta = await loadSandMeta(SAND_BASE);
      if (disposed) return;
      const { camera } = meta;
      stage = new Stage(canvas, { position: camera.position, target: camera.target, lensMm: camera.lens_mm, sensorMm: camera.sensor_mm, renderAspect: camera.render[0] / camera.render[1] }, tier, false);
      const st = stage;
      const q = st.camera.quaternion.clone(), home = st.camera.position.clone();
      const ballC = new THREE.Vector3(...meta.ball.center), ballR = meta.ball.radius;
      const right = new THREE.Vector3(), up = new THREE.Vector3();
      // the framing (contact-view.ts) and the brief on the ball's projected outline, on every resize
      const frame = () => {
        st.setView(home, q, camera.lens_mm);
        st.setView(contactView(q, ballC, ballR, THREE.MathUtils.degToRad(st.camera.fov)), q, camera.lens_mm);
        right.setFromMatrixColumn(st.camera.matrixWorld, 0).normalize();
        up.setFromMatrixColumn(st.camera.matrixWorld, 1).normalize();
        const p0 = ballC.clone().project(st.camera), p1 = ballC.clone().addScaledVector(right, ballR).project(st.camera);
        const W = canvas.clientWidth || window.innerWidth, H = canvas.clientHeight || window.innerHeight;
        ball = { cx: ((p0.x + 1) / 2) * W, cy: ((1 - p0.y) / 2) * H, r: (Math.abs(p1.x - p0.x) / 2) * W };
      };
      st.onSettings((s) => { frame(); field?.setGrains(s.grains); field?.setPointScale(st.bufferHeight, THREE.MathUtils.degToRad(st.camera.fov)); });
      const data = await loadSandParts(meta, settingsFor("low", window.devicePixelRatio || 1).grains, SAND_BASE, progress);
      if (disposed) return;
      field = new SandField(data);
      st.scene.add(field.points);
      field.setGrains(st.settings.grains);
      field.setPointScale(st.bufferHeight, THREE.MathUtils.degToRad(st.camera.fov));
      // the hero's light on the ball, its key swung to the left as in the hero (ball-light.ts)
      const c: [number, number, number] = [ballC.x, ballC.y, ballC.z];
      field.setLights(field.heroLights().map((l, i) => (i === 0 ? { ...l, pos: new THREE.Vector3(...ballKeyPos([l.pos.x, l.pos.y, l.pos.z], c, 1)) } : l)));
      // the sand through the pixel filter, graded, with the hero's haze (as in the story)
      const comp = new SandComposite();
      field.points.layers.set(SAND_LAYER);
      field.material.uniforms.uOutScale.value = 1 / SAND_ENCODE;
      st.camera.layers.enable(SAND_LAYER);
      st.renderFrame = (r, sc, cam) => comp.render(r, sc, cam);
      comp.sigma = 0.28;   // (the ball's filter width: sand-lab.tsx FILTER.ball)
      new THREE.TextureLoader().loadAsync("/lab/grain.png").finally(() => progress.done("/lab/grain.png")).then((t) => {
        if (disposed) return;
        comp.grade = new FilmGradePass(t);
        comp.gradeStill = reduced;
      }).catch(() => {});
      Promise.all([
        new THREE.TextureLoader().loadAsync(`${SAND_BASE}/haze-hero.png`).finally(() => progress.done("haze")),
        fetch(`${SAND_BASE}/haze-hero.json`).then((r) => r.json() as Promise<{ scale: number }>),
      ]).then(([texture, { scale }]) => {
        texture.colorSpace = THREE.NoColorSpace;
        comp.haze = { texture, scale };
        comp.hazeAmount = 1;
      }).catch(() => {});
      await st.renderer.compileAsync(st.scene, st.camera).catch(() => {});
      await comp.warm(st.renderer, st.scene, st.camera).catch(() => {});
      progress.compile(1);
      if (disposed) return;

      // the cursor: a light, and unless motion is reduced a soft drift (as in the hero)
      paint = new PaintField();
      paint.setSize(canvas.clientWidth, canvas.clientHeight);
      field.setPaint(paint.texture, canvas.clientWidth, canvas.clientHeight);
      const pointer = { x: 0, y: 0, active: false };
      const onMove = (e: PointerEvent) => {
        pointer.x = e.clientX; pointer.y = e.clientY;
        if (e.pointerType !== "touch" || e.buttons) { pointer.active = true; paint!.move(e.clientX, e.clientY); }
      };
      window.addEventListener("pointermove", onMove, { passive: true });
      cleanups.push(() => window.removeEventListener("pointermove", onMove));

      // the ball, formed; until the brief is full the sand waits unborn
      const state: SandState = { compact: 1, time: 0, ballSpin: 0, chaosSpin: 0 };
      field.update(state);
      let t0: number | null = null, cascading = !reduced, cursorI = 0;
      const cursorWorld = new THREE.Vector3(), ndc = new THREE.Vector3(), fwd = new THREE.Vector3();
      if (cascading) field.setCascade(-1, anchorsWorld(c, ballR, [right.x, right.y, right.z], [up.x, up.y, up.z]).map((a) => new THREE.Vector3(...a)), "ball");
      onFull = () => { t0 = 0; };
      st.onFrame((dt) => {
        if (t0 !== null) t0 += dt;
        const k = contactAt(t0 ?? 0);
        if (t0 !== null) {
          growing = false;
          briefRef.current?.update({ ...ball, alpha: 1, dash: 0, squares: Array(9).fill(1), round: k.round });
          setWords(k.words);
        }
        if (cascading) {
          if (t0 === null) field!.setCascade(-1);
          else if (field!.cascadeDone(k.cascade)) { cascading = false; field!.setCascade(null); }
          else field!.setCascade(k.cascade, undefined, "ball");
        }
        if (!reduced) { state.time += dt; state.ballSpin += dt * 0.12; }
        // the cursor's light on the ball
        const cam = st.camera;
        cam.getWorldDirection(fwd);
        ndc.set((pointer.x / canvas.clientWidth) * 2 - 1, -(pointer.y / canvas.clientHeight) * 2 + 1, 0.5).unproject(cam);
        const dir = ndc.sub(cam.position).normalize();
        const dist = ballC.clone().sub(cam.position).dot(fwd) / Math.max(dir.dot(fwd), 1e-4);
        cursorWorld.copy(cam.position).addScaledVector(dir, dist - 0.45);
        cursorI = damp(cursorI, pointer.active ? 1 : 0, pointer.active ? 5 : 2.5, dt);
        field!.setCursor(cursorWorld, cursorI);
        if (!reduced) { paint!.update(st.renderer, dt); field!.setPaint(paint!.texture, canvas.clientWidth, canvas.clientHeight); }
        field!.update(state);
      });
      st.start();
    })().catch(() => { if (!disposed) giveUp(); });

    return () => {
      disposed = true; growing = false;
      cancelAnimationFrame(raf);
      cleanups.forEach((f) => f());
      stage?.stop(); field?.dispose(); stage?.dispose();
    };
  }, []);

  return (
    <div className="ct">
      {still ? (
        // eslint-disable-next-line @next/next/no-img-element -- the approved still, the no-WebGL fallback
        <img src={`${SAND_BASE}/targets/ball.jpg`} alt="" className="ct-still" />
      ) : (
        <canvas ref={canvasRef} className="ct-canvas" data-testid="contact-canvas" />
      )}
      <Brief ref={briefRef} />
      <ContactEnd show={words} />
    </div>
  );
}
```

```css
/* src/app/contact/contact.css (spec 2026-10-12 §4): one screen, the ball and its brief, the words below */
.ct { position: relative; height: 100svh; overflow: hidden; background: #000; font-family: var(--font-sans); }
.ct-canvas { position: fixed; inset: 0; width: 100vw; height: 100vh; }
/* the still: the approved ball render (its ball at 772/1440, 415/810, 46.7% of the height) scaled to 30% and placed
   with its centre at 50% across, 42% down */
.ct-still { position: fixed; height: calc(100vh * 0.3 / 0.467); width: auto; left: calc(50vw - (772 / 1440) * (100vh * 0.3 / 0.467) * (1440 / 810)); top: calc(42vh - (415 / 810) * (100vh * 0.3 / 0.467)); }
.ct-words { position: absolute; left: 0; right: 0; bottom: 10svh; text-align: center; z-index: 10; }
.ct-head { margin: 0; font-weight: 400; font-size: clamp(30px, 3.6vw, 64px); line-height: 1.15; color: #f4efe9; }
.ct-pills { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.8vw; margin-top: 2.2vw; }
.ct-pill { padding: 0.85em 1.5em; border-radius: 99px; border: 1px solid rgba(255, 255, 255, 0.18); background: rgba(20, 16, 15, 0.7); color: #f4efe9; text-decoration: none; font-size: clamp(14px, 1.2vw, 18px); }
.ct-pill:hover, .ct-pill:focus-visible { border-color: rgba(230, 191, 174, 0.6); }
@media (max-aspect-ratio: 1/1) { .ct-pills { flex-direction: column; align-items: center; gap: 10px; margin-top: 22px; } }
```

```tsx
// src/app/contact/page.tsx
import type { Metadata } from "next";
import { ContactScene } from "./contact-scene";

export const metadata: Metadata = { title: "Contact", description: "Got something on your mind? Email, LinkedIn or call Liam Hasson." };

export default function ContactPage() {
  return <ContactScene />;
}
```

- [ ] **Step 2: Types, lint, the suite**

Run: `npx tsc --noEmit -p . && npx eslint src/app/contact && npm test`
Expected: no errors; all tests pass. If `field.heroLights()`'s element type lacks `r`, `setLights` accepts it (its `r` is optional).

- [ ] **Step 3: See it in the browser**

`preview_start` the project's dev server and open `/contact`. Check, with `read_console_messages` and screenshots:
- the brief grows from a point in the centre while loading, its corners round at full size;
- its anchors become grains that split and gather into the ball inside the circle; the brief stays;
- the headline and the three pills arrive below; clicking the email shows "Copied";
- the ball is about 30% of the height, its centre about 42% down; it spins slowly; the cursor's light touches it;
- no console errors.

Then compare against a frame of the hero's formed ball (`/lab/sand?hero`, scrolled to the hold): the ball's colour and light should match. If the Contact ball reads flatter or darker, copy the hero's per-frame `field.setGround(…)` call at `compact = 1` from `src/app/lab/sand/sand-lab.tsx:727-728` into the frame callback (with `h = 1`), and recheck.

- [ ] **Step 4: The fallbacks**

With a Playwright script in the scratchpad against the dev server (the pattern of the earlier `*.mjs` captures):
- `page.emulateMedia({ reducedMotion: "reduce" })`, open `/contact`: the ball is held formed (no cascade), the brief drawn, the words shown. Screenshot.
- open `/contact?nogl`: the still ball with the brief over it at the same place, and the words. Screenshot.
- block `**/lab/sand/*.bin` with `page.route(…, (r) => r.abort())`, open `/contact`, wait 17 s: the still and the words show (Review Focus 5). Screenshot.

- [ ] **Step 5: Commit**

```bash
git add src/app/contact/contact-scene.tsx src/app/contact/contact.css src/app/contact/page.tsx
git commit -m "feat(contact): the Contact page: the loader's entry, ending on the ball inside the brief (spec 2026-10-12 §4)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: The whole path, live

**Files:**
- No new files. Fixes found here go in the file they belong to, each with a failing test first where it can be tested.

- [ ] **Step 1: The suite, types and lint**

Run: `npm test && npx tsc --noEmit -p . && npx eslint src`
Expected: all pass.

- [ ] **Step 2: Push and wait for the preview build**

```bash
git push origin phase/2-home
```

Find the deployment with the Vercel tools (`list_deployments`, team `liamhasson-2414s-projects`, project `liamhasson-portfolio`, branch `phase/2-home`) and wait until it is READY.

- [ ] **Step 3: Walk the path on the live build (Playwright in the scratchpad, 1440×900, then 390×844)**

1. `/lab/sand?hero#projects`: scroll to the index's end; one long wheel gesture started at the end (40 events of 60 px, 16 ms apart) opens `/about`. Expected: URL `/about`.
2. A flick from above the end whose momentum reaches the end (60 events of 40 px, 16 ms apart, starting 1,000 px above the end) does **not** open `/about` (Review Focus 1).
3. On `/about`, scroll through: the track moves sideways, the progress line fills; the closing line, then the pull opens `/contact`.
4. Press Back: `/about` shows, just above its end; wait 2 s with no input: still `/about` (Review Focus 2).
5. `/contact`: the brief grows, the ball forms, the words arrive within about 6 s on a fast connection; then throttle (CDP `Network.emulateNetworkConditions` to Fast 4G) and reload: the brief grows with the progress, the ball still forms.
6. 390×844: `/about` stacks vertically, `document.documentElement.scrollWidth === 390` (Review Focus 3); `/contact` pills stack.
7. The nav from `/cyvore`: About → `/about`, Contact → `/contact`, each pill lit on its page.
8. `/lab/sand?hero#about` → redirects to `/about`.

Expected: each check passes. Screenshots of each page at both sizes for Liam.

- [ ] **Step 4: Send Liam the link**

`<deployment>/lab/sand?hero`, `<deployment>/about`, `<deployment>/contact`, with the screenshots, and the two things still owed: his portrait (`src/content/about.ts` `portrait`) and Andrada's full quote (`ABOUT.quotes`).
