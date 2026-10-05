# Phase 2a: Real-Time Stage, Loader and Scroll-Triggered Hero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Quality bar (standing order for this plan and every later plan)

Agreed with Liam on 2026-10-05, recorded in spec §12.1. The target is the level of **moto-card.com** and **oryzo.ai**: motion that is mesmerizing and not what a visitor expects.

- **No shortcuts. Only the best-quality option is accepted.** When two options exist, pick the one that produces the better result, not the cheaper one. If a result needs a Blender-authored asset or a GLB file, we make it.
- **Real-time 3D beats baked video** wherever it is better (it is controllable, adaptable and resolution-independent). The old `particles.mp4` is not used for the hero.
- **Visual acceptance gates are reviewed with Liam** before a phase is called done. The job is to match or beat the reference, not to tick boxes. Task 14 is such a gate.
- **Smoothness is quality.** 60fps, quality tiers and a runtime governor are part of the work, not a nice-to-have. Reduced motion and no-WebGL users get a designed fallback, not a broken page.
- When something is uncertain, say so and ask. Do not paper over it.

**Goal:** The home page opens with a non-skippable loader (≤ 6s, built at 5.4s): a dot ignites and bursts into a chaotic particle cloud while "Hi, I'm Liam." types in. The hero is then **scroll-triggered**: as the visitor scrolls, the cloud resolves into a perfect, exactly centered ball while the copy shifts from "I build ambiguous ideas" to "into products where design and user needs meet."

**Architecture:** One fixed full-viewport WebGL canvas (a "stage", as the references use) owned by a plain TypeScript `Stage` class on raw three.js. Plain TypeScript, not React Three Fiber, for full control, minimal React overhead, and so the same canvas can serve the 3D devices in plan 2b. The particles are fully GPU-driven: positions for the chaos state and the ball state are vertex attributes and the shader blends between them from a single `uProgress` uniform, with depth of field, soft sprites and bloom. Scroll feeds `uProgress` through a small store and frame-rate-independent damping. Everything that can be tested without a GPU (geometry, camera framing, tiers, the quality governor, scroll mapping, the intro state machine, the loader gate script) is pure and unit-tested; the rendered result is verified by Playwright, including an **automated measurement that the rendered ball is centered**. A DOM intro controller drives the loader with one GSAP timeline.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, three.js (WebGL2, `three/addons` post-processing), GSAP 3.15 (ScrollTrigger, SplitText), Lenis, Vitest 5 + Testing Library, Playwright (+ `pngjs` for pixel measurement).

**Spec:** `docs/superpowers/specs/2026-10-01-portfolio-site-design.md` §12 (amendments of 2026-10-05) overrides earlier hero and loader sections.

**This is plan 2a of 3 for Phase 2.** Plan 2b (Blender-modelled 3D devices carrying the recorded product screens, and the projects section on the same stage) and plan 2c (toolkit, about, testimonials, contact) are written after 2a is accepted. Their outlines are at the end of this file so the quality bar carries forward.

**Branching:** all work happens on `phase/2-home`. Vercel builds a preview for every push. Merge to `main` only after Liam approves the preview.

**Known open items (resolved in Task 14, not guessed here):**
1. The particle look (size, density, colors, bloom strength) is specified numerically below as a **starting point**; it is tuned on screen against the old video's frames, and Liam decides whether it matches or beats them.
2. Hero typography and layout (bottom-left copy, centered ball) is a proposal reviewed in Task 14.
3. If Liam judges the real-time ball is not better than the video, the documented fallback is the old video re-centered with `translate: -3.61% -1.23%` (measured: ball bbox 384×378 centered at (772, 415) in the 1440×810 frame, vs frame center (720, 405)).

---

## File map

| File | Responsibility |
|---|---|
| `package.json` | Adds `three`, `@types/three`, `pngjs`, `@types/pngjs` |
| `playwright.config.ts` | WebGL-capable headless flags |
| `src/three/math.ts` | `clamp01`, `smoothstep`, `smootherstep`, `damp` |
| `src/three/camera.ts` | `FOV`, `cameraDistanceFor` (frames the ball; camera is always on-axis, so the ball is centered) |
| `src/three/tier.ts` | Quality tiers, `pickTier`, `settingsFor`, `readSignals` |
| `src/three/quality.ts` | `QualityGovernor` (steps quality down when frames are slow) |
| `src/three/particles/geometry.ts` | Seeded RNG, Fibonacci sphere, chaos cloud, seeds, shuffle, centroid |
| `src/three/hero-map.ts` | Maps hero scroll progress to particle state and copy state |
| `src/three/hero-progress.ts` | Scroll → stage progress store |
| `src/three/particles/uniforms.ts` | Uniform names and defaults |
| `src/three/particles/shaders.ts` | Vertex and fragment GLSL |
| `src/three/particles/particle-field.ts` | `ParticleField` (the `THREE.Points` and its API) |
| `src/three/stage.ts` | `Stage`: renderer, composer, loop, resize, visibility, governor, e2e hooks |
| `src/three/stage-registry.ts` | Lets the intro controller wait for the stage |
| `src/three/e2e.ts` | Global typings for the e2e hooks |
| `src/components/home/stage-canvas.tsx` | Mounts the canvas, creates the stage (dynamic import), falls back |
| `src/lib/intro-state.ts`, `src/hooks/use-intro-step.ts` | Intro step store (`idle → ignite → burst → greeting → line → label → ready`) |
| `src/lib/scroll-lock.ts` | Scroll lock store (class on `<html>` + subscribers) |
| `src/lib/loader-gate.ts`, `src/components/providers/inline-script.tsx` | Pre-paint gate script (no flash, no skip-by-reload bugs) |
| `src/lib/loader-timeline.ts` | Intro timing constants (≤ 6s) |
| `src/components/home/intro-controller.tsx` | Runs the intro timeline (renders nothing) |
| `src/hooks/use-prefers-reduced-motion.ts`, `src/hooks/use-typewriter.ts` | Hooks |
| `src/content/home.ts` | Hero copy |
| `src/components/home/hero.tsx` | Sticky scroll hero, word-by-word copy swap |
| `src/components/providers/smooth-scroll.tsx` | Modified: honours the scroll lock |
| `src/components/shell/pill-nav.tsx` | Modified: waits for the intro on home |
| `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx` | Wiring, styles, mounting |
| `scripts/capture-hero-poster.mjs`, `public/media/hero-ball.jpg` | Poster rendered from our own scene (reduced motion and no-WebGL) |
| `e2e/home-intro.spec.ts` | Loader, scroll hero, centering measurement, fallbacks |

---

### Task 1: Dependencies and WebGL-capable test runner

**Files:**
- Modify: `package.json`, `package-lock.json`, `playwright.config.ts`

- [ ] **Step 1: Install**

```bash
npm install three
npm install -D @types/three pngjs @types/pngjs
```

Expected: installs cleanly. Run `node -e "console.log(require('three/package.json').version)"` and note the version in the commit message. GSAP is already installed; confirm SplitText ships in it: `node -e "require.resolve('gsap/SplitText'); console.log('SplitText ok')"` → `SplitText ok`. If it is not found, stop and report: the plan depends on it.

- [ ] **Step 2: Make headless Chromium able to run WebGL**

Replace `playwright.config.ts` with:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://localhost:3100",
    // Software GL so WebGL works in headless runs (slow, but deterministic enough for geometry checks).
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npx next start -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
```

- [ ] **Step 3: Verify nothing else broke**

Run: `npm run lint && npx vitest run && npm run build`
Expected: all green (existing tests only so far).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json playwright.config.ts
git commit -m "chore: add three.js and WebGL-capable Playwright config

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Math helpers and camera framing

The ball is centered by construction: the camera sits on the Z axis looking at the origin and the geometry's centroid is the origin. `cameraDistanceFor` only decides *how big* the ball is.

**Files:**
- Create: `src/three/math.ts`, `src/three/camera.ts`
- Test: `src/three/math.test.ts`, `src/three/camera.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/three/math.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { clamp01, damp, smootherstep, smoothstep } from "./math";

describe("easing helpers", () => {
  test("clamp01", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(9)).toBe(1);
  });

  test("smoothstep and smootherstep hit 0, 0.5 and 1", () => {
    for (const fn of [smoothstep, smootherstep]) {
      expect(fn(0, 1, -5)).toBe(0);
      expect(fn(0, 1, 0.5)).toBeCloseTo(0.5, 10);
      expect(fn(0, 1, 5)).toBe(1);
    }
  });

  test("smootherstep respects its edges", () => {
    expect(smootherstep(0.2, 0.8, 0.2)).toBe(0);
    expect(smootherstep(0.2, 0.8, 0.8)).toBe(1);
    expect(smootherstep(0.2, 0.8, 0.5)).toBeCloseTo(0.5, 10);
  });
});

describe("damp", () => {
  test("does not move when dt is 0", () => {
    expect(damp(3, 10, 6, 0)).toBe(3);
  });

  test("converges toward the target", () => {
    let v = 0;
    for (let i = 0; i < 120; i++) v = damp(v, 1, 6, 1 / 60);
    expect(v).toBeGreaterThan(0.99);
    expect(v).toBeLessThanOrEqual(1);
  });

  test("is frame-rate independent: two half steps equal one full step", () => {
    const one = damp(0, 1, 6, 0.032);
    const two = damp(damp(0, 1, 6, 0.016), 1, 6, 0.016);
    expect(two).toBeCloseTo(one, 10);
  });
});
```

`src/three/camera.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { cameraDistanceFor, FOV } from "./camera";

/** Height of the sphere's silhouette as a fraction of the viewport height, from first principles. */
function heightFraction(distance: number, radius: number, fovDeg = FOV): number {
  const tanHalfV = Math.tan((fovDeg * Math.PI) / 360);
  return Math.tan(Math.asin(radius / distance)) / tanHalfV;
}

describe("cameraDistanceFor", () => {
  test("landscape: the ball spans exactly the requested fraction of the height", () => {
    const d = cameraDistanceFor(16 / 9, 1, 0.46, 0.7);
    expect(heightFraction(d, 1)).toBeCloseTo(0.46, 9);
  });

  test("portrait: the width limit wins, so the ball never exceeds the requested width fraction", () => {
    const aspect = 9 / 19;
    const d = cameraDistanceFor(aspect, 1, 0.46, 0.7);
    const widthFraction = heightFraction(d, 1) / aspect;
    expect(widthFraction).toBeCloseTo(0.7, 9);
    expect(heightFraction(d, 1)).toBeLessThan(0.46);
  });

  test("a bigger radius needs a proportionally farther camera", () => {
    const a = cameraDistanceFor(16 / 9, 1, 0.46, 0.7);
    const b = cameraDistanceFor(16 / 9, 2, 0.46, 0.7);
    expect(b / a).toBeGreaterThan(1.9);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/three/math.test.ts src/three/camera.test.ts`
Expected: FAIL (cannot resolve the modules).

- [ ] **Step 3: Implement**

`src/three/math.ts`:

```ts
export const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function smootherstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Frame-rate independent exponential smoothing toward `target`. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}
```

`src/three/camera.ts`:

```ts
/** Vertical field of view in degrees. */
export const FOV = 32;

/**
 * Distance from the origin at which a sphere of `radius` spans at most `heightFraction` of the viewport height and
 * at most `widthFraction` of its width. Uses the exact silhouette (asin), not the small-angle approximation.
 * The camera is always placed on the Z axis looking at the origin, so the sphere is centered.
 */
export function cameraDistanceFor(
  aspect: number,
  radius: number,
  heightFraction: number,
  widthFraction: number,
  fovDeg: number = FOV,
): number {
  const tanHalfV = Math.tan((fovDeg * Math.PI) / 360);
  const tanHalfH = tanHalfV * aspect;
  const distanceFor = (fraction: number, tanHalf: number) => radius / Math.sin(Math.atan(fraction * tanHalf));
  return Math.max(distanceFor(heightFraction, tanHalfV), distanceFor(widthFraction, tanHalfH));
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run src/three/math.test.ts src/three/camera.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/three/math.ts src/three/math.test.ts src/three/camera.ts src/three/camera.test.ts
git commit -m "feat: add easing helpers and on-axis camera framing

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Quality tiers and the frame-time governor

**Files:**
- Create: `src/three/tier.ts`, `src/three/quality.ts`
- Test: `src/three/tier.test.ts`, `src/three/quality.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/three/tier.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { pickTier, settingsFor, type TierSignals } from "./tier";

const desktop: TierSignals = {
  isMobile: false,
  automated: false,
  cores: 10,
  memoryGb: 16,
  dpr: 2,
  maxTextureSize: 16384,
};

describe("pickTier", () => {
  test("a capable desktop is high", () => {
    expect(pickTier(desktop)).toBe("high");
  });
  test("a modest desktop is mid", () => {
    expect(pickTier({ ...desktop, cores: 4, memoryGb: 8, maxTextureSize: 8192 })).toBe("mid");
  });
  test("a weak desktop is low", () => {
    expect(pickTier({ ...desktop, cores: 2, memoryGb: 4, maxTextureSize: 4096 })).toBe("low");
  });
  test("a strong phone is mid, a normal phone is low", () => {
    expect(pickTier({ ...desktop, isMobile: true, cores: 8, memoryGb: 8 })).toBe("mid");
    expect(pickTier({ ...desktop, isMobile: true, cores: 6, memoryGb: 4 })).toBe("low");
  });
  test("automated browsers always get low so tests stay fast and deterministic", () => {
    expect(pickTier({ ...desktop, automated: true })).toBe("low");
  });
});

describe("settingsFor", () => {
  test("particle counts shrink with the tier", () => {
    expect(settingsFor("high", 2).particles).toBeGreaterThan(settingsFor("mid", 2).particles);
    expect(settingsFor("mid", 2).particles).toBeGreaterThan(settingsFor("low", 2).particles);
  });
  test("pixel ratio is capped per tier and never above the device ratio", () => {
    expect(settingsFor("high", 3).pixelRatio).toBe(2);
    expect(settingsFor("mid", 3).pixelRatio).toBe(1.5);
    expect(settingsFor("low", 3).pixelRatio).toBe(1);
    expect(settingsFor("high", 1).pixelRatio).toBe(1);
  });
  test("bloom is off only on the low tier", () => {
    expect(settingsFor("high", 2).bloom).toBe(true);
    expect(settingsFor("mid", 2).bloom).toBe(true);
    expect(settingsFor("low", 2).bloom).toBe(false);
  });
});
```

`src/three/quality.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { QualityGovernor } from "./quality";

function feed(g: QualityGovernor, frameMs: number, frames: number) {
  const changes: string[] = [];
  for (let i = 0; i < frames; i++) {
    const next = g.sample(frameMs);
    if (next) changes.push(next);
  }
  return changes;
}

describe("QualityGovernor", () => {
  test("steps down one tier when the average frame is slow over a window", () => {
    const g = new QualityGovernor("high");
    expect(feed(g, 33, 70)).toEqual(["mid"]);
  });

  test("a cooldown stops it dropping twice in a row, then it can drop again", () => {
    const g = new QualityGovernor("high");
    expect(feed(g, 33, 70)).toEqual(["mid"]);
    expect(feed(g, 33, 60)).toEqual([]); // still cooling down (~2s of 33ms frames)
    expect(feed(g, 33, 200)).toEqual(["low"]);
  });

  test("never goes below low", () => {
    const g = new QualityGovernor("low");
    expect(feed(g, 60, 400)).toEqual([]);
  });

  test("never changes when frames are fast", () => {
    const g = new QualityGovernor("high");
    expect(feed(g, 16.7, 1200)).toEqual([]);
  });

  test("one long hitch in an otherwise smooth window does not trigger a drop", () => {
    const g = new QualityGovernor("high");
    expect(feed(g, 16, 119)).toEqual([]);
    expect(g.sample(300)).toBeNull();
    expect(feed(g, 16, 10)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/three/tier.test.ts src/three/quality.test.ts`
Expected: FAIL (cannot resolve).

- [ ] **Step 3: Implement `src/three/tier.ts`**

```ts
export type QualityTier = "high" | "mid" | "low";

export interface TierSignals {
  isMobile: boolean;
  /** navigator.webdriver: a test or automation browser. */
  automated: boolean;
  cores: number;
  memoryGb: number;
  dpr: number;
  maxTextureSize: number;
}

export interface TierSettings {
  tier: QualityTier;
  particles: number;
  pixelRatio: number;
  bloom: boolean;
}

export function pickTier(s: TierSignals): QualityTier {
  if (s.automated) return "low";
  if (s.isMobile) return s.cores >= 8 && s.memoryGb >= 6 ? "mid" : "low";
  if (s.cores >= 8 && s.memoryGb >= 8 && s.maxTextureSize >= 16384) return "high";
  if (s.cores >= 4 && s.memoryGb >= 4) return "mid";
  return "low";
}

const PARTICLES: Record<QualityTier, number> = { high: 160_000, mid: 100_000, low: 50_000 };
const MAX_PIXEL_RATIO: Record<QualityTier, number> = { high: 2, mid: 1.5, low: 1 };

export function settingsFor(tier: QualityTier, dpr: number): TierSettings {
  return {
    tier,
    particles: PARTICLES[tier],
    pixelRatio: Math.min(dpr, MAX_PIXEL_RATIO[tier]),
    bloom: tier !== "low",
  };
}

/** Reads the signals from the browser. Safari does not expose deviceMemory, so a capable device is assumed. */
export function readSignals(gl?: WebGLRenderingContext | WebGL2RenderingContext | null): TierSignals {
  const nav = typeof navigator === "undefined" ? undefined : (navigator as Navigator & { deviceMemory?: number });
  return {
    isMobile: !!nav && /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent),
    automated: !!nav?.webdriver,
    cores: nav?.hardwareConcurrency ?? 4,
    memoryGb: nav?.deviceMemory ?? 8,
    dpr: typeof window === "undefined" ? 1 : window.devicePixelRatio || 1,
    maxTextureSize: gl ? (gl.getParameter(gl.MAX_TEXTURE_SIZE) as number) : 4096,
  };
}
```

- [ ] **Step 4: Implement `src/three/quality.ts`**

```ts
import type { QualityTier } from "./tier";

const ORDER: readonly QualityTier[] = ["high", "mid", "low"];

export interface GovernorOptions {
  /** Length of the measuring window, ms. */
  windowMs?: number;
  /** Average frame time above this over a window means the device is struggling, ms. */
  slowFrameMs?: number;
  /** After a drop, ignore frames for this long so the new tier can settle, ms. */
  cooldownMs?: number;
}

/**
 * Feeds on frame durations and steps quality down one tier at a time when the average over a window is slow.
 * It never steps back up (that would oscillate). Returns the new tier when it changes, otherwise null.
 */
export class QualityGovernor {
  private samples = 0;
  private elapsed = 0;
  private cooldown = 0;
  private readonly windowMs: number;
  private readonly slowFrameMs: number;
  private readonly cooldownMs: number;

  constructor(
    private tier: QualityTier,
    { windowMs = 2000, slowFrameMs = 24, cooldownMs = 3000 }: GovernorOptions = {},
  ) {
    this.windowMs = windowMs;
    this.slowFrameMs = slowFrameMs;
    this.cooldownMs = cooldownMs;
  }

  sample(frameMs: number): QualityTier | null {
    if (this.cooldown > 0) {
      this.cooldown -= frameMs;
      return null;
    }
    this.samples += 1;
    this.elapsed += frameMs;
    if (this.elapsed < this.windowMs) return null;

    const average = this.elapsed / this.samples;
    this.samples = 0;
    this.elapsed = 0;
    if (average <= this.slowFrameMs) return null;

    const i = ORDER.indexOf(this.tier);
    if (i >= ORDER.length - 1) return null;
    this.tier = ORDER[i + 1];
    this.cooldown = this.cooldownMs;
    return this.tier;
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/three/tier.test.ts src/three/quality.test.ts`
Expected: PASS (13 tests). If "a cooldown stops it dropping twice" fails on the count of frames, adjust only the frame counts in the *test* (cooldown 3000ms ÷ 33ms ≈ 91 frames, then a 2000ms window ≈ 61 frames): the intent is "no change during cooldown, a second drop afterwards".

- [ ] **Step 6: Commit**

```bash
git add src/three/tier.ts src/three/tier.test.ts src/three/quality.ts src/three/quality.test.ts
git commit -m "feat: add quality tiers and frame-time governor

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Particle geometry (pure, tested for exact centering)

**Files:**
- Create: `src/three/particles/geometry.ts`
- Test: `src/three/particles/geometry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { centroid, chaosCloud, fibonacciSphere, mulberry32, particleSeeds, shuffleVec3 } from "./geometry";

describe("mulberry32", () => {
  test("is deterministic and in [0, 1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("fibonacciSphere", () => {
  const N = 20_000;
  const pts = fibonacciSphere(N);

  test("every point is on the unit sphere", () => {
    for (let i = 0; i < N; i++) {
      const r = Math.hypot(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]);
      expect(r).toBeCloseTo(1, 5);
    }
  });

  test("the ball is centered on the origin", () => {
    const [x, y, z] = centroid(pts);
    expect(Math.abs(x)).toBeLessThan(2e-3);
    expect(Math.abs(y)).toBeLessThan(1e-6);
    expect(Math.abs(z)).toBeLessThan(2e-3);
  });
});

describe("shuffleVec3", () => {
  test("keeps every point and makes any prefix cover the whole sphere", () => {
    const N = 20_000;
    const shuffled = shuffleVec3(fibonacciSphere(N), mulberry32(7));
    const quarter = shuffled.slice(0, (N / 4) * 3);
    let minY = 1;
    let maxY = -1;
    for (let i = 1; i < quarter.length; i += 3) {
      minY = Math.min(minY, quarter[i]);
      maxY = Math.max(maxY, quarter[i]);
    }
    expect(minY).toBeLessThan(-0.95);
    expect(maxY).toBeGreaterThan(0.95);
    const [x, y, z] = centroid(quarter);
    expect(Math.hypot(x, y, z)).toBeLessThan(0.03);
  });
});

describe("chaosCloud", () => {
  const cloud = chaosCloud(50_000, 1234);

  test("is exactly centered on the origin", () => {
    const [x, y, z] = centroid(cloud);
    expect(Math.abs(x)).toBeLessThan(1e-5);
    expect(Math.abs(y)).toBeLessThan(1e-5);
    expect(Math.abs(z)).toBeLessThan(1e-5);
  });

  test("is finite, deterministic per seed, and different across seeds", () => {
    for (const v of cloud) expect(Number.isFinite(v)).toBe(true);
    expect(chaosCloud(100, 1234)).toEqual(chaosCloud(100, 1234));
    expect(chaosCloud(100, 1)).not.toEqual(chaosCloud(100, 2));
  });

  test("is much wider than the ball it resolves into", () => {
    let maxR = 0;
    for (let i = 0; i < cloud.length; i += 3) maxR = Math.max(maxR, Math.hypot(cloud[i], cloud[i + 1], cloud[i + 2]));
    expect(maxR).toBeGreaterThan(2);
  });
});

describe("particleSeeds", () => {
  test("four values per particle in sensible ranges", () => {
    const seeds = particleSeeds(1000, 99);
    expect(seeds.length).toBe(4000);
    for (let i = 0; i < 1000; i++) {
      const [delay, size, swirl, phase] = [seeds[i * 4], seeds[i * 4 + 1], seeds[i * 4 + 2], seeds[i * 4 + 3]];
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThan(1);
      expect(size).toBeGreaterThanOrEqual(0.55);
      expect(size).toBeLessThanOrEqual(1.45);
      expect(swirl).toBeGreaterThanOrEqual(0);
      expect(swirl).toBeLessThan(1);
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThan(1);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/three/particles/geometry.test.ts`
Expected: FAIL (cannot resolve `./geometry`).

- [ ] **Step 3: Implement `src/three/particles/geometry.ts`**

```ts
/** Small, fast, seedable PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mean of an array of xyz triples. */
export function centroid(positions: Float32Array): [number, number, number] {
  let x = 0;
  let y = 0;
  let z = 0;
  const n = positions.length / 3;
  for (let i = 0; i < positions.length; i += 3) {
    x += positions[i];
    y += positions[i + 1];
    z += positions[i + 2];
  }
  return [x / n, y / n, z / n];
}

/** `count` points spread evenly over the unit sphere (golden-angle spiral). */
export function fibonacciSphere(count: number): Float32Array {
  const out = new Float32Array(count * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (2 * (i + 0.5)) / count;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    out[i * 3] = Math.cos(theta) * r;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = Math.sin(theta) * r;
  }
  return out;
}

/**
 * Fisher-Yates over xyz triples, in place. A spiral's first N points cover only a cap of the sphere, so the lattice is
 * shuffled to make any prefix (a lower quality tier draws a prefix) cover the whole sphere evenly.
 */
export function shuffleVec3(points: Float32Array, rnd: () => number): Float32Array {
  for (let i = points.length / 3 - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    for (let k = 0; k < 3; k++) {
      const a = i * 3 + k;
      const b = j * 3 + k;
      const tmp = points[a];
      points[a] = points[b];
      points[b] = tmp;
    }
  }
  return points;
}

/**
 * The chaotic starting state: a wide, soft, slightly flattened cloud, denser toward the middle. Re-centered on the
 * origin so the cloud, like the ball, has no off-center bias.
 */
export function chaosCloud(count: number, seed: number): Float32Array {
  const rnd = mulberry32(seed);
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = rnd() * 2 - 1;
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    const radius = 0.5 + 1.9 * Math.pow(rnd(), 0.65);
    out[i * 3] = Math.cos(a) * r * radius * 1.35;
    out[i * 3 + 1] = u * radius * 0.95;
    out[i * 3 + 2] = Math.sin(a) * r * radius;
  }
  const [cx, cy, cz] = centroid(out);
  for (let i = 0; i < out.length; i += 3) {
    out[i] -= cx;
    out[i + 1] -= cy;
    out[i + 2] -= cz;
  }
  return out;
}

/** Per-particle randoms: x = start delay, y = size multiplier, z = swirl direction, w = motion phase. */
export function particleSeeds(count: number, seed: number): Float32Array {
  const rnd = mulberry32(seed);
  const out = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    out[i * 4] = rnd();
    out[i * 4 + 1] = 0.55 + rnd() * 0.9;
    out[i * 4 + 2] = rnd();
    out[i * 4 + 3] = rnd();
  }
  return out;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/three/particles/geometry.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/three/particles/geometry.ts src/three/particles/geometry.test.ts
git commit -m "feat: add particle geometry generators

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Hero scroll mapping and the progress store

**Files:**
- Create: `src/three/hero-map.ts`, `src/three/hero-progress.ts`
- Test: `src/three/hero-map.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, test } from "vitest";
import { HERO, heroMap } from "./hero-map";
import { getHeroTarget } from "./hero-progress";

describe("heroMap", () => {
  test("starts as chaos and holds for the first stretch of scroll", () => {
    expect(heroMap(0).progress).toBe(0);
    expect(heroMap(HERO.chaosHold).progress).toBe(0);
  });

  test("is a complete ball from ballComplete onward", () => {
    expect(heroMap(HERO.ballComplete).progress).toBe(1);
    expect(heroMap(1).progress).toBe(1);
  });

  test("progress only ever increases with scroll", () => {
    let last = -1;
    for (let p = 0; p <= 1.0001; p += 0.01) {
      const v = heroMap(p).progress;
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
  });

  test("the ball is intact while the copy is being read, and only fades at the end of the hero", () => {
    expect(heroMap(HERO.ballComplete).out).toBe(0);
    expect(heroMap(HERO.outFrom).out).toBe(0);
    expect(heroMap(1).out).toBe(1);
  });

  test("copy flips from a to b at the swap point", () => {
    expect(heroMap(HERO.copySwap - 0.01).copy).toBe("a");
    expect(heroMap(HERO.copySwap).copy).toBe("b");
  });
});

describe("hero progress store", () => {
  beforeEach(() => setHeroTarget(0));

  test("holds the latest target", () => {
    setHeroTarget(0.4);
    expect(getHeroTarget()).toBe(0.4);
  });

  test("clamps to [0, 1]", () => {
    setHeroTarget(-3);
    expect(getHeroTarget()).toBe(0);
    setHeroTarget(7);
    expect(getHeroTarget()).toBe(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/three/hero-map.test.ts`
Expected: FAIL (cannot resolve).

- [ ] **Step 3: Implement**

`src/three/hero-map.ts`:

```ts
import { smootherstep, smoothstep } from "./math";

/** Scroll breakpoints of the hero, as fractions of its scroll length. */
export const HERO = {
  /** The cloud stays fully chaotic for the first 8% of the scroll. */
  chaosHold: 0.08,
  /** The ball is complete at 82%, leaving time to read the second half of the copy on a finished ball. */
  ballComplete: 0.82,
  /** The ball fades and shrinks away over the last 10%, as the hero scrolls off. */
  outFrom: 0.9,
  /** The copy swaps from the first half to the second half here. */
  copySwap: 0.5,
} as const;

export interface HeroState {
  /** 0 = chaos, 1 = perfect ball. */
  progress: number;
  /** 0 = present, 1 = gone. */
  out: number;
  copy: "a" | "b";
}

export function heroMap(p: number): HeroState {
  return {
    progress: smootherstep(HERO.chaosHold, HERO.ballComplete, p),
    out: smoothstep(HERO.outFrom, 1, p),
    copy: p < HERO.copySwap ? "a" : "b",
  };
}
```

`src/three/hero-progress.ts`:

```ts
let target = 0;

/** Latest scroll progress through the hero, 0..1. Written by ScrollTrigger, read by the stage every frame. */
export function getHeroTarget(): number {
  return target;
}

export function setHeroTarget(p: number): void {
  target = Math.min(1, Math.max(0, p));
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/three/hero-map.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/three/hero-map.ts src/three/hero-map.test.ts src/three/hero-progress.ts
git commit -m "feat: add hero scroll mapping

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Particle shaders and `ParticleField`

The shader does all the work on the GPU. Per particle it blends from a chaos position to a ball position by `uProgress`, with a per-particle delay and a swirl so particles travel on curved paths. The look: soft round sprites, depth of field (blur grows with distance from the focal plane), rose / gold / magenta patches, lambert plus rim lighting on the ball, additive blending (then bloom in post).

**Files:**
- Create: `src/three/particles/uniforms.ts`, `src/three/particles/shaders.ts`, `src/three/particles/particle-field.ts`
- Test: `src/three/particles/shaders.test.ts`

- [ ] **Step 1: Write the failing contract test** (every uniform the shader declares must exist in the defaults, and vice versa; this catches the most common shader wiring bug without a GPU)

```ts
import { describe, expect, test } from "vitest";
import { fragmentShader, vertexShader } from "./shaders";
import { createUniforms, PARTICLE_UNIFORM_NAMES } from "./uniforms";

function declaredUniforms(source: string): string[] {
  return [...source.matchAll(/uniform\s+\w+\s+(u\w+)\s*;/g)].map((m) => m[1]);
}

describe("particle shader contract", () => {
  test("every uniform declared in GLSL has a default, and none are unused", () => {
    const declared = new Set([...declaredUniforms(vertexShader), ...declaredUniforms(fragmentShader)]);
    expect([...declared].sort()).toEqual([...PARTICLE_UNIFORM_NAMES].sort());
  });

  test("defaults are finite numbers", () => {
    for (const [name, u] of Object.entries(createUniforms())) {
      expect(Number.isFinite(u.value), name).toBe(true);
    }
  });

  test("the vertex shader reads the attributes the field provides", () => {
    for (const attribute of ["aChaos", "aSeed", "position"]) {
      expect(vertexShader).toContain(attribute);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/three/particles/shaders.test.ts`
Expected: FAIL (cannot resolve).

- [ ] **Step 3: Implement `src/three/particles/uniforms.ts`**

```ts
export const PARTICLE_UNIFORM_NAMES = [
  "uProgress",
  "uIntro",
  "uIgnite",
  "uIgniteAlpha",
  "uOut",
  "uTime",
  "uSize",
  "uPixelRatio",
  "uFocus",
  "uAperture",
  "uSphereRadius",
] as const;

export type ParticleUniformName = (typeof PARTICLE_UNIFORM_NAMES)[number];
export type ParticleUniforms = Record<ParticleUniformName, { value: number }>;

export function createUniforms(): ParticleUniforms {
  return {
    /** 0 = chaos, 1 = ball. */
    uProgress: { value: 0 },
    /** 0 = every particle at one point, 1 = fully burst out. */
    uIntro: { value: 0 },
    /** 0 = invisible, 1 = visible: the dot igniting. */
    uIgnite: { value: 0 },
    /** Per-particle alpha while the cloud is a single point (so 160k additive points do not blow out). */
    uIgniteAlpha: { value: 0.01 },
    /** 0 = present, 1 = gone. */
    uOut: { value: 0 },
    uTime: { value: 0 },
    /** Point size in px at a 1080px-tall viewport, before perspective. */
    uSize: { value: 17 },
    uPixelRatio: { value: 1 },
    /** Camera distance of the focal plane (the ball). */
    uFocus: { value: 7.5 },
    /** Distance from the focal plane at which blur is at its maximum. */
    uAperture: { value: 2.6 },
    uSphereRadius: { value: 1 },
  };
}
```

- [ ] **Step 4: Implement `src/three/particles/shaders.ts`**

```ts
export const vertexShader = /* glsl */ `
uniform float uProgress;
uniform float uIntro;
uniform float uIgnite;
uniform float uIgniteAlpha;
uniform float uOut;
uniform float uTime;
uniform float uSize;
uniform float uPixelRatio;
uniform float uFocus;
uniform float uAperture;
uniform float uSphereRadius;

// position = this particle's place on the unit ball. aChaos = its place in the chaotic cloud.
// aSeed: x start delay, y size multiplier, z swirl direction, w motion phase.
attribute vec3 aChaos;
attribute vec4 aSeed;

varying vec3 vColor;
varying float vAlpha;
varying float vCoc;

const float PI = 3.14159265359;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i + vec3(0.0, 0.0, 0.0)), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}

mat2 rot(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c);
}

float smoother(float x) {
  x = clamp(x, 0.0, 1.0);
  return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
}

void main() {
  float phase = aSeed.w * 6.28318;

  // Chaos -> ball, each particle on its own delay so the resolve ripples instead of snapping.
  float t = smoother((uProgress - aSeed.x * 0.4) / 0.6);

  // The chaotic cloud is never still.
  vec3 chaos = aChaos;
  chaos += 0.10 * vec3(
    sin(uTime * 0.35 + phase + chaos.y * 1.6),
    sin(uTime * 0.42 + phase * 1.3 + chaos.z * 1.4),
    cos(uTime * 0.38 + phase * 0.7 + chaos.x * 1.5));

  // The ball turns slowly about its own vertical axis (its centre never moves).
  float spin = uTime * 0.12 + uProgress * 1.2;
  vec3 sph = position;
  sph.xz = rot(spin) * sph.xz;
  vec3 normal = normalize(sph);
  sph *= uSphereRadius * (1.0 + 0.008 * sin(uTime * 0.8 + phase));

  vec3 pos = mix(chaos, sph, t);
  // Travel on a curved path: swirl peaks mid-transition and is gone at both ends.
  pos.xz = rot((aSeed.z - 0.5) * 3.2 * sin(t * PI)) * pos.xz;

  // Intro: everything starts as one point and bursts outward.
  float ti = smoother(uIntro * 1.35 - aSeed.x * 0.35);
  float burst = 1.0 - pow(1.0 - ti, 4.0);
  pos *= burst;
  pos *= mix(1.0, 0.85, uOut);

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  float dist = -mv.z;

  // Depth of field: blur grows with distance from the focal plane.
  float coc = clamp(abs(dist - uFocus) / uAperture, 0.0, 1.0);

  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * aSeed.y * (1.0 + coc * 2.6) * mix(1.6, 1.0, burst) * uPixelRatio / dist;

  // Colour: rose, gold and magenta patches drifting over the ball.
  float band = vnoise(position * 2.2 + vec3(0.0, uTime * 0.05, 0.0));
  vec3 magenta = vec3(0.62, 0.20, 0.46);
  vec3 rose = vec3(0.80, 0.36, 0.52);
  vec3 gold = vec3(0.86, 0.70, 0.34);
  vec3 base = mix(mix(magenta, rose, smoothstep(0.25, 0.55, band)), gold, smoothstep(0.55, 0.75, band));

  // The ball is lit from upper-left-front with a rim; the cloud is a soft haze.
  vec3 light = normalize(vec3(-0.5, 0.7, 0.6));
  float lambert = max(dot(normal, light), 0.0);
  float rim = pow(1.0 - max(dot(normal, vec3(0.0, 0.0, 1.0)), 0.0), 2.5);
  float lit = 0.25 + 0.95 * lambert + 0.6 * rim;
  float haze = 0.65 + 0.35 * vnoise(chaos * 1.7 + uTime * 0.1);
  vColor = base * mix(haze, lit, t);

  // Out-of-focus particles are larger, so they are dimmer: energy is roughly conserved.
  float glow = mix(uIgniteAlpha, 1.0, burst * burst);
  vAlpha = uIgnite * glow * (1.0 - uOut) * mix(1.0, 0.35, coc) / (1.0 + coc * coc * 2.0);
  vCoc = coc;
}
`;

export const fragmentShader = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vCoc;

void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;

  // In focus: a tight soft dot. Out of focus: a wide soft disc with a faint bokeh rim.
  float softness = mix(0.35, 1.0, vCoc);
  float disc = 1.0 - smoothstep(1.0 - softness, 1.0, d);
  float ring = smoothstep(0.55, 0.9, d) * (1.0 - smoothstep(0.9, 1.0, d));
  float a = mix(disc, disc * 0.55 + ring * 0.45, vCoc);

  gl_FragColor = vec4(vColor * a * vAlpha, a * vAlpha);
}
`;
```

- [ ] **Step 5: Run the contract test to verify it passes**

Run: `npx vitest run src/three/particles/shaders.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Implement `src/three/particles/particle-field.ts`**

```ts
import * as THREE from "three";
import { chaosCloud, fibonacciSphere, mulberry32, particleSeeds, shuffleVec3 } from "./geometry";
import { fragmentShader, vertexShader } from "./shaders";
import { createUniforms, type ParticleUniformName } from "./uniforms";

/** Particle size in CSS px at a 1080px-tall viewport (scaled with the viewport height). */
const BASE_SIZE_PX = 17;

export class ParticleField {
  readonly object: THREE.Points;
  readonly uniforms = createUniforms();
  private readonly geometry = new THREE.BufferGeometry();
  private readonly material: THREE.ShaderMaterial;

  constructor(
    readonly maxCount: number,
    seed = 20261005,
  ) {
    // `position` holds the ball targets; any prefix of it covers the whole sphere (see shuffleVec3), so a lower
    // quality tier can simply draw fewer particles.
    const ball = shuffleVec3(fibonacciSphere(maxCount), mulberry32(seed + 2));
    this.geometry.setAttribute("position", new THREE.BufferAttribute(ball, 3));
    this.geometry.setAttribute("aChaos", new THREE.BufferAttribute(chaosCloud(maxCount, seed), 3));
    this.geometry.setAttribute("aSeed", new THREE.BufferAttribute(particleSeeds(maxCount, seed + 1), 4));

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.object = new THREE.Points(this.geometry, this.material);
    this.object.frustumCulled = false;
    this.setCount(maxCount);
  }

  /** Draw only the first `count` particles. */
  setCount(count: number): void {
    const n = Math.max(1, Math.min(count, this.maxCount));
    this.geometry.setDrawRange(0, n);
    this.uniforms.uIgniteAlpha.value = 1.2 / n;
  }

  set(name: ParticleUniformName, value: number): void {
    this.uniforms[name].value = value;
  }

  /** Keeps particle size proportional to the viewport and the focal plane on the ball. */
  setViewport(heightPx: number, cameraDistance: number, pixelRatio: number): void {
    this.uniforms.uSize.value = (BASE_SIZE_PX * heightPx) / 1080;
    this.uniforms.uFocus.value = cameraDistance;
    this.uniforms.uPixelRatio.value = pixelRatio;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
```

- [ ] **Step 7: Type-check and commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

```bash
git add src/three/particles/uniforms.ts src/three/particles/shaders.ts src/three/particles/shaders.test.ts src/three/particles/particle-field.ts
git commit -m "feat: add GPU particle shaders and ParticleField

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The stage, its registry, the canvas component, and a first look

**Files:**
- Create: `src/three/stage.ts`, `src/three/stage-registry.ts`, `src/three/e2e.ts`, `src/components/home/stage-canvas.tsx`
- Test: `src/three/stage-registry.test.ts`
- Modify: `src/app/page.tsx` (temporary mount, finalized in Task 9)

- [ ] **Step 1: Write the failing registry test**

```ts
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Stage } from "./stage";
import { registerStage, unregisterStage, whenStage } from "./stage-registry";

const fake = { id: "stage" } as unknown as Stage;

beforeEach(() => unregisterStage());

describe("stage registry", () => {
  test("calls back immediately when the stage already exists", () => {
    registerStage(fake);
    const cb = vi.fn();
    whenStage(cb);
    expect(cb).toHaveBeenCalledWith(fake);
  });

  test("calls back once the stage registers", () => {
    const cb = vi.fn();
    whenStage(cb);
    expect(cb).not.toHaveBeenCalled();
    registerStage(fake);
    expect(cb).toHaveBeenCalledWith(fake);
  });

  test("a cancelled wait never fires", () => {
    const cb = vi.fn();
    const cancel = whenStage(cb);
    cancel();
    registerStage(fake);
    expect(cb).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/three/stage-registry.test.ts`
Expected: FAIL (cannot resolve).

- [ ] **Step 3: Implement `src/three/stage-registry.ts`**

```ts
import type { Stage } from "./stage";

let current: Stage | null = null;
const waiting = new Set<(stage: Stage) => void>();

export function registerStage(stage: Stage): void {
  current = stage;
  waiting.forEach((cb) => cb(stage));
  waiting.clear();
}

export function unregisterStage(): void {
  current = null;
}

/** Runs `cb` with the stage as soon as it exists. Returns a cancel function. */
export function whenStage(cb: (stage: Stage) => void): () => void {
  if (current) {
    cb(current);
    return () => {};
  }
  waiting.add(cb);
  return () => {
    waiting.delete(cb);
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/three/stage-registry.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement `src/three/e2e.ts`** (typings for the test hooks; the hooks are only installed when the URL has `?e2e`)

```ts
export interface StageSnapshot {
  progress: number;
  out: number;
  intro: number;
  ignite: number;
  tier: string;
  count: number;
  /** Average frame time over the last ~120 frames, ms. */
  frameMs: number;
}

export interface StageE2E {
  setHeroProgress(p: number): void;
  setIntroComplete(): void;
  /** Fix the shader clock at `seconds` so renders are deterministic. */
  freeze(seconds: number): void;
  snapshot(): StageSnapshot;
}

declare global {
  interface Window {
    __stage?: StageE2E;
    /** Written by the intro controller when `?e2e` is present. */
    __intro?: { startedAt: number; doneAt?: number };
  }
}
```

- [ ] **Step 6: Implement `src/three/stage.ts`**

```ts
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { cameraDistanceFor, FOV } from "./camera";
import type { StageE2E, StageSnapshot } from "./e2e";
import { heroMap } from "./hero-map";
import { getHeroTarget, setHeroTarget } from "./hero-progress";
import { damp } from "./math";
import { ParticleField } from "./particles/particle-field";
import { QualityGovernor } from "./quality";
import { pickTier, readSignals, settingsFor, type QualityTier } from "./tier";

const SPHERE_RADIUS = 1;
/** The ball spans at most this fraction of the viewport height / width. */
const BALL_HEIGHT_FRACTION = 0.46;
const BALL_WIDTH_FRACTION = 0.7;
/** Frames ignored by the governor while shaders compile and the first uploads happen. */
const GOVERNOR_WARMUP_FRAMES = 45;
const FRAME_HISTORY = 120;

export interface StageOptions {
  /** Force a tier (honoured only together with `e2e`). */
  tier?: QualityTier;
  /** Force bloom on or off (honoured only together with `e2e`). */
  bloom?: boolean;
  /** Install `window.__stage` for tests. */
  e2e?: boolean;
}

export class Stage {
  /** Intro controls (set by the intro controller): 0..1. */
  private intro = 0;
  private ignite = 0;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60);
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly field: ParticleField;
  private readonly governor: QualityGovernor;
  private readonly resizeObserver: ResizeObserver;
  private readonly forceBloom: boolean | undefined;

  private tier: QualityTier;
  private pixelRatio = 1;
  private cameraDistance = 8;
  private raf = 0;
  private lastNow = 0;
  private time = 0;
  private frozenTime: number | null = null;
  private heroSmoothed = 0;
  /** Set by the e2e hook: holds the hero at a fixed progress regardless of scroll. */
  private heroPinned: number | null = null;
  private drawCount = 0;
  private frames = 0;
  private recentFrameMs: number[] = [];
  private lastState = { progress: 0, out: 0 };
  private disposed = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    opts: StageOptions = {},
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;

    const forced = opts.e2e ? opts.tier : undefined;
    this.tier = forced ?? pickTier(readSignals(this.renderer.getContext()));
    this.forceBloom = opts.e2e ? opts.bloom : undefined;
    const settings = settingsFor(this.tier, window.devicePixelRatio || 1);

    this.field = new ParticleField(settings.particles);
    this.scene.add(this.field.object);
    this.governor = new QualityGovernor(this.tier);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.85, 0.7, 0.12);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.applySettings();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.resize();

    if (opts.e2e) window.__stage = this.e2eApi();
  }

  start(): void {
    if (this.raf || this.disposed) return;
    this.raf = requestAnimationFrame(this.tick);
  }

  setIntro(value: number): void {
    this.intro = value;
  }

  setIgnite(value: number): void {
    this.ignite = value;
  }

  /** The intro has finished (or is being skipped): show the cloud fully. */
  setIntroComplete(): void {
    this.intro = 1;
    this.ignite = 1;
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.resizeObserver.disconnect();
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.field.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    if (window.__stage) delete window.__stage;
  }

  private applySettings(): void {
    const s = settingsFor(this.tier, window.devicePixelRatio || 1);
    this.pixelRatio = s.pixelRatio;
    this.drawCount = s.particles;
    this.field.setCount(s.particles);
    this.bloom.enabled = this.forceBloom ?? s.bloom;
    this.resize();
  }

  private applyTier(next: QualityTier): void {
    this.tier = next;
    this.applySettings();
  }

  private resize(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w, h);
    this.camera.aspect = w / h;
    // On-axis camera: the ball is always centered. Only its size depends on the viewport.
    this.cameraDistance = cameraDistanceFor(w / h, SPHERE_RADIUS, BALL_HEIGHT_FRACTION, BALL_WIDTH_FRACTION);
    this.camera.position.set(0, 0, this.cameraDistance);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
    this.field.setViewport(h, this.cameraDistance, this.pixelRatio);
  }

  private readonly onVisibility = (): void => {
    if (document.hidden) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    } else if (!this.disposed) {
      this.lastNow = 0;
      this.start();
    }
  };

  private readonly tick = (now: number): void => {
    this.raf = requestAnimationFrame(this.tick);
    const dtMs = this.lastNow === 0 ? 16.7 : now - this.lastNow;
    this.lastNow = now;
    const dt = Math.min(dtMs, 100) / 1000;

    this.frames += 1;
    this.recentFrameMs.push(dtMs);
    if (this.recentFrameMs.length > FRAME_HISTORY) this.recentFrameMs.shift();
    if (this.frames > GOVERNOR_WARMUP_FRAMES && this.frozenTime === null) {
      const next = this.governor.sample(dtMs);
      if (next) this.applyTier(next);
    }

    this.time = this.frozenTime ?? this.time + dt;
    this.heroSmoothed = damp(this.heroSmoothed, this.heroPinned ?? getHeroTarget(), 6, dt);
    const hero = heroMap(this.heroSmoothed);
    this.lastState = { progress: hero.progress, out: hero.out };

    const f = this.field;
    f.set("uProgress", hero.progress);
    f.set("uOut", hero.out);
    f.set("uIntro", this.intro);
    f.set("uIgnite", this.ignite);
    f.set("uTime", this.time);

    this.composer.render(dt);
  };

  private e2eApi(): StageE2E {
    return {
      setHeroProgress: (p) => {
        // Pinned: ScrollTrigger refreshes during a test must not pull the ball back.
        this.heroPinned = Math.min(1, Math.max(0, p));
        this.heroSmoothed = this.heroPinned;
      },
      setIntroComplete: () => this.setIntroComplete(),
      freeze: (seconds) => {
        this.frozenTime = seconds;
      },
      snapshot: (): StageSnapshot => ({
        progress: this.lastState.progress,
        out: this.lastState.out,
        intro: this.intro,
        ignite: this.ignite,
        tier: this.tier,
        count: this.drawCount,
        frameMs: this.recentFrameMs.length
          ? this.recentFrameMs.reduce((a, b) => a + b, 0) / this.recentFrameMs.length
          : 0,
      }),
    };
  }
}

/** Creates and starts a stage, or returns null when WebGL is unavailable. */
export function createStage(canvas: HTMLCanvasElement, opts: StageOptions = {}): Stage | null {
  try {
    const stage = new Stage(canvas, opts);
    stage.start();
    return stage;
  } catch {
    return null;
  }
}
```

- [ ] **Step 7: Implement `src/components/home/stage-canvas.tsx`**

```tsx
"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { registerStage, unregisterStage } from "@/three/stage-registry";
import type { QualityTier } from "@/three/tier";

/**
 * The fixed full-viewport WebGL canvas behind the page. three.js is loaded on demand so it does not block hydration.
 * With reduced motion, or when WebGL is unavailable, the CSS poster (.hero-poster) shows instead.
 */
export function StageCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || reduced) return;
    let cancelled = false;
    let dispose: (() => void) | undefined;

    const params = new URLSearchParams(window.location.search);
    const e2e = params.has("e2e");

    import("@/three/stage").then(({ createStage }) => {
      if (cancelled) return;
      const stage = createStage(canvas, {
        e2e,
        tier: (params.get("tier") as QualityTier | null) ?? undefined,
        bloom: params.has("bloom") ? params.get("bloom") === "1" : undefined,
      });
      if (!stage) {
        document.documentElement.setAttribute("data-stage", "fallback");
        return;
      }
      registerStage(stage);
      dispose = () => {
        unregisterStage();
        stage.dispose();
      };
    });

    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [reduced]);

  return (
    <>
      <div aria-hidden="true" className="hero-poster" />
      <canvas
        ref={ref}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 h-full w-full motion-reduce:hidden"
      />
    </>
  );
}
```

- [ ] **Step 8: Add the poster rule to `src/app/globals.css`** (append; the image itself is generated in Task 12, until then the rule shows nothing because the element is only displayed in fallback/reduced-motion states)

```css

/* Static poster for reduced motion and no-WebGL (rendered from the real scene in Task 12). */
.hero-poster {
  position: fixed;
  inset: 0;
  z-index: 0;
  display: none;
  background: center / cover no-repeat url("/media/hero-ball.jpg");
}
html[data-stage="fallback"] .hero-poster {
  display: block;
}
@media (prefers-reduced-motion: reduce) {
  .hero-poster {
    display: block;
  }
}
```

- [ ] **Step 9: Temporary mount so the first render can be inspected** (finalized in Task 9)

Replace `src/app/page.tsx` with:

```tsx
import { StageCanvas } from "@/components/home/stage-canvas";

export default function Home() {
  return (
    <>
      <StageCanvas />
      <section className="h-dvh" />
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

- [ ] **Step 10: First look**

Run `npm run lint && npx tsc --noEmit && npx vitest run`, then `preview_start` with `{name: "portfolio-dev"}`. Open `/?e2e=1&tier=high&bloom=1` (the app shows a black page because the intro has not run; ignite and intro are 0). With `javascript_tool` run:

```js
window.__stage.setIntroComplete(); window.__stage.setHeroProgress(0); 1
```

Screenshot (chaos), then `window.__stage.setHeroProgress(0.85)` and screenshot (ball), then `0.45` (mid-transition). Read the console for shader compile errors (`read_console_messages`, `onlyErrors: true`): **there must be none**. If the shader fails to compile, the error names the line; fix it in `shaders.ts` before continuing. Expected: a soft rose/gold cloud, resolving into a ball in the centre. Do not tune the look yet (that is Task 14); only confirm it renders and nothing is broken.

- [ ] **Step 11: Commit**

```bash
git add src/three/stage.ts src/three/stage-registry.ts src/three/stage-registry.test.ts src/three/e2e.ts src/components/home/stage-canvas.tsx src/app/globals.css src/app/page.tsx
git commit -m "feat: add the WebGL stage and canvas

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Intro state, scroll lock, loader gate, layout wiring

The intro runs in steps (`ignite → burst → greeting → line → label → ready`) that the hero reacts to. Scroll is locked (class on `<html>` and Lenis stopped) until `ready`. A script in `<head>` decides before first paint whether the loader plays, so there is never a flash.

**Files:**
- Create: `src/lib/intro-state.ts`, `src/hooks/use-intro-step.ts`, `src/lib/scroll-lock.ts`, `src/lib/loader-gate.ts`, `src/components/providers/inline-script.tsx`, `src/hooks/use-prefers-reduced-motion.ts`
- Modify: `src/components/providers/smooth-scroll.tsx`, `src/app/layout.tsx`, `src/app/globals.css`
- Test: `src/lib/intro-state.test.ts`, `src/lib/scroll-lock.test.ts`, `src/lib/loader-gate.test.ts`, `src/hooks/use-prefers-reduced-motion.test.tsx`

- [ ] **Step 1: Write the failing tests**

`src/lib/intro-state.test.ts`:

```ts
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getIntroStep, INTRO_STEPS, reached, resetIntro, setIntroStep, subscribeIntro } from "./intro-state";

beforeEach(() => resetIntro());

describe("intro state", () => {
  test("starts idle", () => {
    expect(getIntroStep()).toBe("idle");
  });

  test("steps are in the order the intro plays", () => {
    expect(INTRO_STEPS).toEqual(["idle", "ignite", "burst", "greeting", "line", "label", "ready"]);
  });

  test("reached() compares positions in the sequence", () => {
    expect(reached("line", "greeting")).toBe(true);
    expect(reached("line", "line")).toBe(true);
    expect(reached("burst", "line")).toBe(false);
    expect(reached("ready", "label")).toBe(true);
    expect(reached("idle", "ignite")).toBe(false);
  });

  test("notifies on change, not on repeat", () => {
    const fn = vi.fn();
    subscribeIntro(fn);
    setIntroStep("ignite");
    setIntroStep("ignite");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("unsubscribe stops notifications", () => {
    const fn = vi.fn();
    const off = subscribeIntro(fn);
    off();
    setIntroStep("ready");
    expect(fn).not.toHaveBeenCalled();
  });
});
```

`src/lib/scroll-lock.test.ts`:

```ts
import { afterEach, describe, expect, test, vi } from "vitest";
import { isScrollLocked, setScrollLocked, subscribeScrollLock } from "./scroll-lock";

afterEach(() => setScrollLocked(false));

describe("scroll lock", () => {
  test("toggles the class on <html> and the flag", () => {
    setScrollLocked(true);
    expect(document.documentElement).toHaveClass("intro-lock");
    expect(isScrollLocked()).toBe(true);
    setScrollLocked(false);
    expect(document.documentElement).not.toHaveClass("intro-lock");
    expect(isScrollLocked()).toBe(false);
  });

  test("notifies subscribers and supports unsubscribe", () => {
    const fn = vi.fn();
    const off = subscribeScrollLock(fn);
    setScrollLocked(true);
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    setScrollLocked(false);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
```

`src/lib/loader-gate.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { loaderGateScript } from "./loader-gate";
import { LOADER_SEEN_KEY } from "./session-flags";

const html = () => document.documentElement;

function run() {
  new Function(loaderGateScript)();
}

beforeEach(() => {
  sessionStorage.clear();
  html().removeAttribute("data-loader");
  html().classList.remove("intro-lock");
  window.history.pushState({}, "", "/");
});
afterEach(() => vi.restoreAllMocks());

describe("loaderGateScript", () => {
  test("first arrival on home: the loader plays and scroll is locked", () => {
    run();
    expect(html()).not.toHaveAttribute("data-loader");
    expect(html()).toHaveClass("intro-lock");
    expect(sessionStorage.getItem(LOADER_SEEN_KEY)).toBeNull();
  });

  test("repeat visit to home in the same session: skip, no lock", () => {
    sessionStorage.setItem(LOADER_SEEN_KEY, "1");
    run();
    expect(html()).toHaveAttribute("data-loader", "skip");
    expect(html()).not.toHaveClass("intro-lock");
  });

  test("a session that starts on a case study records the loader as seen: skip, no lock", () => {
    window.history.pushState({}, "", "/cyvore");
    run();
    expect(sessionStorage.getItem(LOADER_SEEN_KEY)).toBe("1");
    expect(html()).toHaveAttribute("data-loader", "skip");
    expect(html()).not.toHaveClass("intro-lock");
  });

  test("blocked storage on home: still plays and locks, never throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(run).not.toThrow();
    expect(html()).toHaveClass("intro-lock");
  });

  test("blocked storage on another page: never locks scroll", () => {
    window.history.pushState({}, "", "/pulse");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    run();
    expect(html()).not.toHaveClass("intro-lock");
  });
});
```

`src/hooks/use-prefers-reduced-motion.test.tsx`:

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
    expect(renderHook(() => usePrefersReducedMotion()).result.current).toBe(true);
  });
  test("false otherwise", () => {
    stubMatchMedia(false);
    expect(renderHook(() => usePrefersReducedMotion()).result.current).toBe(false);
  });
  test("false when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(renderHook(() => usePrefersReducedMotion()).result.current).toBe(false);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/intro-state.test.ts src/lib/scroll-lock.test.ts src/lib/loader-gate.test.ts src/hooks/use-prefers-reduced-motion.test.tsx`
Expected: FAIL (cannot resolve the modules).

- [ ] **Step 3: Implement the stores and hooks**

`src/lib/intro-state.ts`:

```ts
/**
 * Where the home intro is. The intro controller advances it; the hero and pill nav react.
 * idle → ignite (the dot) → burst (it explodes into the cloud) → greeting (typing) → line (first copy rises)
 * → label ("Product Designer" and the scroll cue) → ready (scroll unlocks, nav appears).
 */
export const INTRO_STEPS = ["idle", "ignite", "burst", "greeting", "line", "label", "ready"] as const;
export type IntroStep = (typeof INTRO_STEPS)[number];

let step: IntroStep = "idle";
const listeners = new Set<() => void>();

export function getIntroStep(): IntroStep {
  return step;
}

export function setIntroStep(next: IntroStep): void {
  if (next === step) return;
  step = next;
  listeners.forEach((l) => l());
}

export function subscribeIntro(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** True when `current` is `target` or any later step. */
export function reached(current: IntroStep, target: IntroStep): boolean {
  return INTRO_STEPS.indexOf(current) >= INTRO_STEPS.indexOf(target);
}

/** Test helper. */
export function resetIntro(): void {
  setIntroStep("idle");
}
```

`src/hooks/use-intro-step.ts`:

```ts
"use client";

import { useSyncExternalStore } from "react";
import { getIntroStep, subscribeIntro, type IntroStep } from "@/lib/intro-state";

export function useIntroStep(): IntroStep {
  return useSyncExternalStore(subscribeIntro, getIntroStep, () => "idle");
}
```

`src/lib/scroll-lock.ts`:

```ts
const listeners = new Set<() => void>();
let locked = false;

export function isScrollLocked(): boolean {
  return locked;
}

/** Locks or unlocks page scrolling: a class on <html> (native scroll) plus a signal for Lenis. */
export function setScrollLocked(next: boolean): void {
  locked = next;
  document.documentElement.classList.toggle("intro-lock", next);
  listeners.forEach((l) => l());
}

export function subscribeScrollLock(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
```

`src/hooks/use-prefers-reduced-motion.ts`:

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

`src/lib/loader-gate.ts`:

```ts
import { LOADER_SEEN_KEY } from "./session-flags";

/**
 * Runs synchronously in <head> on every full page load, before first paint:
 * - the loader has already played this session → <html data-loader="skip"> (CSS shows the hero at once);
 * - the session starts on any page other than "/" → record the loader as seen (it plays on first arrival only);
 * - otherwise (first arrival at "/") → <html class="intro-lock"> so the page cannot scroll while the loader plays.
 * Storage errors are swallowed: on "/" the loader then plays; elsewhere nothing is locked.
 */
export const loaderGateScript = `(function(){var h=document.documentElement;try{var s=window.sessionStorage,k=${JSON.stringify(
  LOADER_SEEN_KEY,
)};if(s.getItem(k)!=="1"&&location.pathname!=="/"){s.setItem(k,"1")}if(s.getItem(k)==="1"){h.setAttribute("data-loader","skip");return}}catch(e){}if(location.pathname==="/"){h.classList.add("intro-lock")}})();`;
```

`src/components/providers/inline-script.tsx` (the helper from `node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md`: a real script on the server, inert on the client so React does not warn about rendered `<script>` tags):

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

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/intro-state.test.ts src/lib/scroll-lock.test.ts src/lib/loader-gate.test.ts src/hooks/use-prefers-reduced-motion.test.tsx`
Expected: PASS (16 tests).

- [ ] **Step 5: Make Lenis honour the scroll lock.** Replace `src/components/providers/smooth-scroll.tsx` with:

```tsx
"use client";

import { useEffect, type ReactNode } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { isScrollLocked, subscribeScrollLock } from "@/lib/scroll-lock";
import { shouldUseSmoothScroll } from "@/lib/smooth-scroll";

gsap.registerPlugin(ScrollTrigger);

export function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (!shouldUseSmoothScroll((q) => window.matchMedia(q).matches)) return;

    const lenis = new Lenis({ lerp: 0.1, anchors: true, stopInertiaOnNavigate: true });
    // The gate script may already have locked the page (first arrival, loader about to play).
    const applyLock = () => (isScrollLocked() || document.documentElement.classList.contains("intro-lock") ? lenis.stop() : lenis.start());
    applyLock();
    const offLock = subscribeScrollLock(applyLock);

    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      offLock();
      gsap.ticker.remove(tick);
      // Restore GSAP's documented defaults (lagSmoothing is global).
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
```

- [ ] **Step 6: Wire the layout.** Replace `src/app/layout.tsx` with:

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

// Without JS the intro never runs: show everything.
const NO_JS_CSS = ".intro-hidden{opacity:1!important;transform:none!important}";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the gate script sets data-loader / class on <html> before React hydrates.
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

- [ ] **Step 7: Append the intro CSS to `src/app/globals.css`**

```css

/* Home intro */
html.intro-lock {
  overflow: hidden;
}

/* Hidden until the intro reveals them. The gate script sets data-loader="skip" when the intro must not play. */
html:not([data-loader="skip"]) .intro-hidden {
  opacity: 0;
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

- [ ] **Step 8: Verify**

Run: `npm run lint && npx vitest run && npm run build`
Expected: lint clean, all tests pass, build succeeds. If `@next/next/no-head-element` fires on the `<head>` in the layout, move the `InlineScript` to be the first child of `<body>` instead (it is still parsed before any content).

- [ ] **Step 9: Commit**

```bash
git add src/lib/intro-state.ts src/lib/intro-state.test.ts src/hooks/use-intro-step.ts src/lib/scroll-lock.ts src/lib/scroll-lock.test.ts src/lib/loader-gate.ts src/lib/loader-gate.test.ts src/components/providers/inline-script.tsx src/hooks/use-prefers-reduced-motion.ts src/hooks/use-prefers-reduced-motion.test.tsx src/components/providers/smooth-scroll.tsx src/app/layout.tsx src/app/globals.css
git commit -m "feat: add intro state, scroll lock and the pre-paint loader gate

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: The intro (loader) timeline

One GSAP timeline drives the whole intro: the dot ignites, bursts into the cloud, the greeting types, the first line rises, the label appears, scroll unlocks. **Nothing can skip it.** Total 5.4s, hard cap 6s.

**Files:**
- Create: `src/lib/loader-timeline.ts`, `src/components/home/intro-controller.tsx`
- Test: `src/lib/loader-timeline.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { INTRO, INTRO_MAX_SECONDS } from "./loader-timeline";

describe("intro timeline", () => {
  test("never exceeds the 6 second cap", () => {
    expect(INTRO_MAX_SECONDS).toBe(6);
    expect(INTRO.doneAt).toBeLessThanOrEqual(INTRO_MAX_SECONDS);
  });

  test("events are in order", () => {
    const { igniteAt, burstAt, greetingAt, lineAt, labelAt, doneAt } = INTRO;
    expect(igniteAt).toBeLessThan(burstAt);
    expect(burstAt).toBeLessThan(greetingAt);
    expect(greetingAt).toBeLessThan(lineAt);
    expect(lineAt).toBeLessThan(labelAt);
    expect(labelAt).toBeLessThan(doneAt);
  });

  test("the burst has finished before the first line rises", () => {
    expect(INTRO.burstAt + INTRO.burstDur).toBeLessThan(INTRO.lineAt);
  });

  test("the greeting has finished typing before the first line rises", () => {
    expect(INTRO.greetingAt + (13 * INTRO.charMs) / 1000).toBeLessThan(INTRO.lineAt); // "Hi, I’m Liam." = 13 characters
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/loader-timeline.test.ts`
Expected: FAIL (cannot resolve).

- [ ] **Step 3: Implement `src/lib/loader-timeline.ts`**

```ts
/** Seconds from the start of the intro. Hard cap 6s (agreed with Liam); built at 5.4s. */
export const INTRO_MAX_SECONDS = 6;

export const INTRO = {
  /** A dot ignites in the dark. */
  igniteAt: 0,
  igniteDur: 0.6,
  /** The dot bursts into the chaotic cloud. */
  burstAt: 0.6,
  burstDur: 2.0,
  /** "Hi, I’m Liam." types in. */
  greetingAt: 1.1,
  charMs: 55,
  /** "I build ambiguous ideas" rises in. */
  lineAt: 3.6,
  /** "Product Designer" and the scroll cue appear. */
  labelAt: 4.6,
  /** Scroll unlocks and the pill nav fades in. */
  doneAt: 5.4,
} as const;
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/lib/loader-timeline.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Implement `src/components/home/intro-controller.tsx`**

```tsx
"use client";

import { useEffect } from "react";
import { gsap } from "gsap";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { setIntroStep } from "@/lib/intro-state";
import { INTRO } from "@/lib/loader-timeline";
import { setScrollLocked } from "@/lib/scroll-lock";
import { hasSeenLoader, markLoaderSeen } from "@/lib/session-flags";
import { whenStage } from "@/three/stage-registry";
import type { Stage } from "@/three/stage";

/**
 * Plays the welcome intro on the first arrival of a session. It is not skippable: input does nothing until it
 * completes. Renders nothing. Reduced motion, and any later visit in the session, go straight to `ready`.
 */
export function IntroController() {
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const root = document.documentElement;
    const e2e = new URLSearchParams(window.location.search).has("e2e");
    let finished = false;
    let stage: Stage | null = null;

    const finish = () => {
      finished = true;
      markLoaderSeen();
      root.setAttribute("data-loader", "skip");
      setScrollLocked(false);
      stage?.setIntroComplete();
      setIntroStep("ready");
      if (e2e && window.__intro) window.__intro.doneAt = performance.now();
    };

    if (hasSeenLoader() || reduced) {
      const off = whenStage((s) => {
        stage = s;
        s.setIntroComplete();
      });
      finish();
      return off;
    }

    setScrollLocked(true);
    const state = { ignite: 0, intro: 0 };
    const push = () => {
      stage?.setIgnite(state.ignite);
      stage?.setIntro(state.intro);
    };
    const off = whenStage((s) => {
      stage = s;
      push();
    });
    if (e2e) window.__intro = { startedAt: performance.now() };

    const tl = gsap.timeline({ onComplete: finish });
    tl.call(() => setIntroStep("ignite"), [], INTRO.igniteAt)
      .to(state, { ignite: 1, duration: INTRO.igniteDur, ease: "power2.out", onUpdate: push }, INTRO.igniteAt)
      .call(() => setIntroStep("burst"), [], INTRO.burstAt)
      .to(state, { intro: 1, duration: INTRO.burstDur, ease: "expo.out", onUpdate: push }, INTRO.burstAt)
      .call(() => setIntroStep("greeting"), [], INTRO.greetingAt)
      .call(() => setIntroStep("line"), [], INTRO.lineAt)
      .call(() => setIntroStep("label"), [], INTRO.labelAt)
      .set({}, {}, INTRO.doneAt); // pads the timeline to its full length; onComplete then calls finish()

    return () => {
      tl.kill();
      off();
      if (!finished) setScrollLocked(false);
    };
  }, [reduced]);

  return null;
}
```

- [ ] **Step 6: Run everything**

Run: `npm run lint && npx tsc --noEmit && npx vitest run && npm run build`
Expected: all green. (The controller is not mounted on the page yet; Task 10 mounts it together with the hero and watches the intro play.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/loader-timeline.ts src/lib/loader-timeline.test.ts src/components/home/intro-controller.tsx
git commit -m "feat: add the non-skippable intro timeline

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Hero copy and the scroll-triggered hero

The hero is a tall section (400vh) with a sticky 100vh frame. Scroll progress through it drives the stage (`setHeroTarget`) and a GSAP timeline that swaps the copy word by word. The first-visit intro reveals the greeting, the first line and the label step by step.

**Files:**
- Create: `src/content/home.ts`, `src/hooks/use-typewriter.ts`, `src/components/home/hero.tsx`
- Modify: `src/app/page.tsx`
- Test: `src/content/home.test.ts`, `src/hooks/use-typewriter.test.tsx`

- [ ] **Step 1: Write the failing tests**

`src/content/home.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { hero, heroLineA, heroLineB, heroSentence, plain } from "./home";

describe("hero copy", () => {
  test("the full sentence, for screen readers and no-motion", () => {
    expect(heroSentence()).toBe(
      "Hi, I’m Liam. I build ambiguous ideas into products where design and user needs meet.",
    );
  });

  test("each half reads as plain text without its markup", () => {
    expect(plain(heroLineA)).toBe("I build ambiguous ideas");
    expect(plain(heroLineB)).toBe("into products where design and user needs meet.");
  });

  test("each half has exactly one accented phrase", () => {
    expect(heroLineA.filter((s) => s.accent).map((s) => s.text)).toEqual(["ambiguous ideas"]);
    expect(heroLineB.filter((s) => s.accent).map((s) => s.text)).toEqual(["design and user needs"]);
  });

  test("the role label", () => {
    expect(hero.label).toBe("Product Designer");
  });
});
```

`src/hooks/use-typewriter.test.tsx`:

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
    const { result, rerender } = renderHook(({ enabled }) => useTypewriter("Hi", { enabled, charMs: 10 }), {
      initialProps: { enabled: true },
    });
    act(() => vi.advanceTimersByTime(20));
    expect(result.current.shown).toBe("Hi");
    rerender({ enabled: false });
    expect(result.current).toEqual({ shown: "", done: false });
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/content/home.test.ts src/hooks/use-typewriter.test.tsx`
Expected: FAIL (cannot resolve).

- [ ] **Step 3: Implement `src/content/home.ts`**

```ts
export interface Segment {
  text: string;
  /** Set in the rose accent (Playfair italic). */
  accent?: boolean;
}

export const hero = {
  greeting: "Hi, I’m Liam.",
  label: "Product Designer",
} as const;

/** First half of the sentence, shown until the scroll swaps it. */
export const heroLineA: readonly Segment[] = [{ text: "I build " }, { text: "ambiguous ideas", accent: true }];

/** Second half, swapped in word by word as the cloud becomes a ball. */
export const heroLineB: readonly Segment[] = [
  { text: "into products where " },
  { text: "design and user needs", accent: true },
  { text: " meet." },
];

export const plain = (segments: readonly Segment[]): string => segments.map((s) => s.text).join("");

/** The whole sentence: the single static reading for screen readers and for reduced motion. */
export function heroSentence(): string {
  return `${hero.greeting} ${plain(heroLineA)} ${plain(heroLineB)}`;
}
```

- [ ] **Step 4: Implement `src/hooks/use-typewriter.ts`**

```ts
"use client";

import { useEffect, useState } from "react";

interface Options {
  /** Typing starts when this becomes true; the text is hidden while false. */
  enabled: boolean;
  /** Show the full text at once (reduced motion, or the intro is skipped). */
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

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/content/home.test.ts src/hooks/use-typewriter.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 6: Implement `src/components/home/hero.tsx`**

```tsx
"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { hero, heroLineA, heroLineB, heroSentence, type Segment } from "@/content/home";
import { useIntroStep } from "@/hooks/use-intro-step";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useTypewriter } from "@/hooks/use-typewriter";
import { reached } from "@/lib/intro-state";
import { INTRO } from "@/lib/loader-timeline";
import { HERO } from "@/three/hero-map";
import { setHeroTarget } from "@/three/hero-progress";

gsap.registerPlugin(ScrollTrigger, SplitText);

const skippedStore = {
  subscribe: () => () => {},
  getSnapshot: () => document.documentElement.getAttribute("data-loader") === "skip",
  getServerSnapshot: () => false,
};

function Line({ segments }: { segments: readonly Segment[] }) {
  return (
    <>
      {segments.map((s) =>
        s.accent ? (
          <span key={s.text} className="font-accent italic text-rose-soft">
            {s.text}
          </span>
        ) : (
          <span key={s.text}>{s.text}</span>
        ),
      )}
    </>
  );
}

/**
 * Scroll-triggered hero. A 400dvh section with a sticky full-height frame: scroll progress through it drives the
 * particle stage (chaos → ball) and swaps the copy word by word. On first arrival the intro reveals the greeting, the
 * first line and the label in turn. Reduced motion: no pinning, both lines shown, the poster behind.
 */
export function Hero() {
  const reduced = usePrefersReducedMotion();
  const step = useIntroStep();
  const skipped = useSyncExternalStore(skippedStore.subscribe, skippedStore.getSnapshot, skippedStore.getServerSnapshot);

  const sectionRef = useRef<HTMLElement>(null);
  const greetingRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLParagraphElement>(null);
  const cueRef = useRef<HTMLDivElement>(null);
  const lineARef = useRef<HTMLSpanElement>(null);
  const lineBRef = useRef<HTMLSpanElement>(null);
  const wordsA = useRef<Element[]>([]);

  const instant = reduced || skipped;
  const { shown, done } = useTypewriter(hero.greeting, {
    enabled: reached(step, "greeting"),
    instant,
    charMs: INTRO.charMs,
  });

  // Scroll choreography: stage progress + word-by-word copy swap.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || reduced) return;
    const ctx = gsap.context(() => {
      const a = SplitText.create(lineARef.current!, { type: "words", mask: "words" });
      const b = SplitText.create(lineBRef.current!, { type: "words", mask: "words" });
      wordsA.current = a.words;
      // On a first visit the intro reveals line A; the second half waits below its mask until the scroll brings it.
      gsap.set(a.words, { yPercent: skipped ? 0 : 115 });
      gsap.set(b.words, { yPercent: 115 });

      const tl = gsap.timeline({
        scrollTrigger: { trigger: section, start: "top top", end: "bottom bottom", scrub: 0.6 },
      });
      tl.to(a.words, { yPercent: -115, duration: 0.12, stagger: 0.02, ease: "power2.in" }, 0.4).to(
        b.words,
        { yPercent: 0, duration: 0.14, stagger: 0.025, ease: "power3.out" },
        0.5,
      );

      ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          setHeroTarget(self.progress);
          section.dataset.copy = self.progress < HERO.copySwap ? "a" : "b";
          section.dataset.scrolled = self.progress > 0.03 ? "true" : "false";
        },
      });
    }, section);

    // Splitting changes line wrapping: re-measure once fonts are in.
    void document.fonts?.ready.then(() => ScrollTrigger.refresh());
    return () => {
      ctx.revert();
      setHeroTarget(0);
    };
  }, [reduced, skipped]);

  // Intro reveals (first visit only; with a skipped intro the CSS already shows everything).
  useEffect(() => {
    const show = (el: Element | null, y = 0) =>
      el && gsap.to(el, { opacity: 1, y, duration: reduced ? 0 : 0.7, ease: "power3.out" });
    if (reached(step, "greeting")) show(greetingRef.current);
    if (reached(step, "line") && !reduced && wordsA.current.length) {
      gsap.to(wordsA.current, { yPercent: 0, duration: 0.9, stagger: 0.06, ease: "power3.out", overwrite: false });
    }
    if (reached(step, "label")) {
      show(labelRef.current);
      show(cueRef.current);
    }
  }, [step, reduced]);

  return (
    <section
      ref={sectionRef}
      id="hero"
      data-copy="a"
      data-scrolled="false"
      className="group relative h-[400dvh] motion-reduce:h-auto"
    >
      <div className="sticky top-0 flex h-dvh flex-col justify-between px-6 pb-10 pt-8 sm:px-10 motion-reduce:static motion-reduce:min-h-dvh">
        <p
          ref={labelRef}
          className="intro-hidden font-mono text-xs uppercase tracking-[0.28em] text-ink-3 motion-reduce:opacity-100!"
        >
          {hero.label}
        </p>

        <div className="max-w-[1100px]">
          <h1>
            <span className="sr-only">{heroSentence()}</span>
            <span aria-hidden="true" className="block">
              <span
                ref={greetingRef}
                className="intro-hidden block text-[clamp(1.25rem,2.2vw,2rem)] font-bold text-ink-2 motion-reduce:opacity-100!"
              >
                <span className="relative inline-block">
                  <span className="invisible">{hero.greeting}</span>
                  <span data-typed="" className="absolute inset-0 text-left">
                    {shown}
                    {!done && <span className="caret" />}
                  </span>
                </span>
              </span>
              <span className="mt-3 grid text-[clamp(2rem,4.6vw,4.4rem)] font-bold leading-[1.02] tracking-tight">
                <span ref={lineARef} className="col-start-1 row-start-1 motion-reduce:row-start-1">
                  <Line segments={heroLineA} />
                </span>
                <span ref={lineBRef} className="col-start-1 row-start-1 motion-reduce:row-start-2">
                  <Line segments={heroLineB} />
                </span>
              </span>
            </span>
          </h1>
        </div>

        <div
          aria-hidden="true"
          className="absolute bottom-10 right-6 transition-opacity duration-(--duration-ui) group-data-[scrolled=true]:opacity-0 sm:right-10 motion-reduce:hidden"
        >
          <div
            ref={cueRef}
            className="intro-hidden flex items-center gap-3 font-mono text-xs uppercase tracking-[0.28em] text-ink-3"
          >
            <span>Scroll</span>
            <span className="h-px w-10 bg-ink-3" />
          </div>
        </div>
      </div>
    </section>
  );
}
```

The scroll cue has two layers on purpose: the outer wrapper carries the position and the fade-out once the visitor scrolls (`group-data-[scrolled=true]:opacity-0`), and the inner element carries `intro-hidden` and is revealed by the intro with an inline GSAP opacity (an inline style would otherwise beat the CSS fade).

- [ ] **Step 7: Mount it.** Replace `src/app/page.tsx` with:

```tsx
import { Hero } from "@/components/home/hero";
import { IntroController } from "@/components/home/intro-controller";
import { StageCanvas } from "@/components/home/stage-canvas";

export default function Home() {
  return (
    <>
      <StageCanvas />
      <IntroController />
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

- [ ] **Step 8: Verify the build**

Run: `npm run lint && npx tsc --noEmit && npx vitest run && npm run build`
Expected: all green.

- [ ] **Step 9: Watch the intro and the hero in the browser**

`preview_start {name: "portfolio-dev"}`; open `/?e2e=1` in a fresh tab (sessionStorage empty). Take screenshots about 0.3s, 1.2s, 2.4s, 3.9s, 5.0s and 6.0s after load. Expected: a dot; a burst into the cloud with "Hi, I'm Liam." typing; the cloud breathing; "I build ambiguous ideas" rising in; the label and "Scroll"; then scrolling works. Try wheel, click and keys while it plays: **nothing may skip or scroll it**. Read `window.__intro` in the console: `doneAt - startedAt` must be between 5200 and 6000 ms. Check the console for errors.

- [ ] **Step 10: Commit**

```bash
git add src/content/home.ts src/content/home.test.ts src/hooks/use-typewriter.ts src/hooks/use-typewriter.test.tsx src/components/home/hero.tsx src/app/page.tsx
git commit -m "feat: add the scroll-triggered hero

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Pill nav waits for the intro

On home the nav is the last thing to appear and is inert until `ready`. On case studies it behaves as before.

**Files:**
- Modify: `src/components/shell/pill-nav.tsx`, `src/components/shell/pill-nav.test.tsx`

- [ ] **Step 1: Update the tests first**

In `src/components/shell/pill-nav.test.tsx`: change the first import line to `import { act, render, screen } from "@testing-library/react";`, add `import { resetIntro, setIntroStep } from "@/lib/intro-state";` next to the other imports, replace the `beforeEach` with:

```tsx
beforeEach(() => {
  pathname.mockReturnValue("/");
  useActiveSection.mockReset();
  useActiveSection.mockReturnValue(null);
  setIntroStep("ready");
});
```

and add inside the `describe("PillNav", ...)` block:

```tsx
  test("on home it is inert until the intro is ready", () => {
    resetIntro();
    const { container } = render(<PillNav />);
    expect(container.querySelector("nav")).toHaveAttribute("inert");
    act(() => setIntroStep("ready"));
    expect(container.querySelector("nav")).not.toHaveAttribute("inert");
  });

  test("on case studies it never waits for the intro", () => {
    resetIntro();
    pathname.mockReturnValue("/cyvore");
    const { container } = render(<PillNav />);
    expect(container.querySelector("nav")).not.toHaveAttribute("inert");
  });
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx vitest run src/components/shell/pill-nav.test.tsx`
Expected: the two new tests FAIL; the rest PASS.

- [ ] **Step 3: Modify `src/components/shell/pill-nav.tsx`**

Add the import `import { useIntroStep } from "@/hooks/use-intro-step";`. Add above the component:

```tsx
/** Seconds after the intro is ready: the nav is the last thing to appear. */
const NAV_DELAY = 0.4;
```

Replace the start of `PillNav` through the opening `<motion.nav ...>` tag with:

```tsx
export function PillNav() {
  const pathname = usePathname();
  const introStep = useIntroStep();
  const isHome = pathname === "/";
  const activeSection = useActiveSection(SECTION_IDS, pathname);
  const active = isHome ? activeSection : null;
  // On home the nav waits for the intro to finish.
  const waiting = isHome && introStep !== "ready";

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

The rest of the component is unchanged.

- [ ] **Step 4: Run to verify, lint, commit**

Run: `npx vitest run src/components/shell/pill-nav.test.tsx && npm run lint`
Expected: PASS and clean.

```bash
git add src/components/shell/pill-nav.tsx src/components/shell/pill-nav.test.tsx
git commit -m "feat: pill nav fades in last on home

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Poster and fallbacks (reduced motion, no WebGL)

Visitors who ask for reduced motion, or whose browser has no WebGL, get a designed state: a still of the real ball, centered, with the full sentence as plain text. The poster is rendered from our own scene, so it cannot be off-center.

**Files:**
- Create: `scripts/capture-hero-poster.mjs`, `public/media/hero-ball.jpg`
- Modify: `package.json` (script)

- [ ] **Step 1: Write the capture script**

```js
// Renders the hero ball from the real scene and saves it as the CSS poster.
// Usage: start the production server first (npm run build && npx next start -p 3101), then: npm run poster
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3101";
const OUT = "public/media/hero-ball.jpg";

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.addInitScript(() => sessionStorage.setItem("lh:loader-seen", "1"));
await page.goto(`${BASE}/?e2e=1&tier=high&bloom=1`);
await page.waitForFunction(() => !!window.__stage, null, { timeout: 30000 });
await page.evaluate(() => {
  window.__stage.setIntroComplete();
  window.__stage.setHeroProgress(0.86);
  window.__stage.freeze(2.2);
});
await page.addStyleTag({ content: "main, nav, .hero-poster { visibility: hidden !important }" });
await page.waitForTimeout(1500);
const buffer = await page.screenshot({ type: "jpeg", quality: 90 });
fs.writeFileSync(OUT, buffer);
console.log(`wrote ${OUT} (${buffer.length} bytes)`);
await browser.close();
```

- [ ] **Step 2: Add the npm script.** In `package.json` `scripts`, add `"poster": "node scripts/capture-hero-poster.mjs"`.

- [ ] **Step 3: Generate it**

```bash
npm run build
npx next start -p 3101 &
sleep 4
npm run poster
kill %1
```

Expected: `wrote public/media/hero-ball.jpg (… bytes)` with a size well under 300 KB (if larger, lower the quality to 82). Open the file with the Read tool: a rose/gold ball in the exact middle of a black frame. **This poster must be reviewed together with the tuned look in Task 14; re-run this step after any look change.**

- [ ] **Step 4: Commit**

```bash
git add scripts/capture-hero-poster.mjs public/media/hero-ball.jpg package.json
git commit -m "feat: render the hero poster from the real scene

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 13: End-to-end tests (including the centering measurement)

**Files:**
- Create: `e2e/home-intro.spec.ts`

- [ ] **Step 1: Write the tests**

```ts
import { expect, test, type Page } from "@playwright/test";
import { PNG } from "pngjs";

const LOCK = "html.intro-lock";
const HEADLINE =
  "Hi, I’m Liam. I build ambiguous ideas into products where design and user needs meet.";

/** Marks the loader as already played, so a test can go straight to the hero. */
async function skipIntroForTest(page: Page) {
  await page.addInitScript(() => sessionStorage.setItem("lh:loader-seen", "1"));
}

async function stageReady(page: Page) {
  await page.waitForFunction(() => !!window.__stage, null, { timeout: 30000 });
}

test("the intro cannot be skipped and finishes in under 6 seconds", async ({ page }) => {
  await page.goto("/?e2e=1");
  await expect(page.locator(LOCK)).toHaveCount(1);

  // Try every way of skipping it.
  await page.mouse.click(300, 300);
  await page.keyboard.press("Space");
  await page.keyboard.press("End");
  await page.mouse.wheel(0, 1500);
  await page.waitForTimeout(1200);
  await expect(page.locator(LOCK)).toHaveCount(1);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  await expect(page.locator(LOCK)).toHaveCount(0, { timeout: 8000 });
  const { startedAt, doneAt } = await page.evaluate(() => window.__intro!);
  expect(doneAt! - startedAt).toBeGreaterThanOrEqual(5200);
  expect(doneAt! - startedAt).toBeLessThan(6000);

  expect(await page.evaluate(() => sessionStorage.getItem("lh:loader-seen"))).toBe("1");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Hi, I’m Liam.");
  await expect(page.getByRole("navigation", { name: "Primary" })).not.toHaveAttribute("inert");
});

test("after it has played, a reload does not replay it", async ({ page }) => {
  await page.goto("/?e2e=1");
  await expect(page.locator(LOCK)).toHaveCount(0, { timeout: 8000 });
  await page.reload();
  await expect(page.locator(LOCK)).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("data-loader", "skip");
});

test("a session that starts on a case study never plays it", async ({ page }) => {
  await page.goto("/cyvore");
  await page.getByRole("link", { name: "Projects" }).click();
  await expect(page).toHaveURL(/\/#projects$/);
  await expect(page.locator(LOCK)).toHaveCount(0);
});

test("the rendered ball is exactly centered and the right size", async ({ page }) => {
  await skipIntroForTest(page);
  await page.goto("/?e2e=1&tier=low");
  await stageReady(page);
  await page.evaluate(() => {
    window.__stage!.setIntroComplete();
    window.__stage!.setHeroProgress(0.86); // a complete ball, not yet fading out
    window.__stage!.freeze(2);
  });
  // Hide every DOM overlay: only the WebGL canvas should be in the picture.
  await page.addStyleTag({ content: "main, nav, .hero-poster { visibility: hidden !important }" });
  await page.waitForTimeout(1500);

  const png = PNG.sync.read(await page.screenshot());
  let minX = png.width;
  let maxX = -1;
  let minY = png.height;
  let maxY = -1;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const i = (y * png.width + x) * 4;
      if (Math.max(png.data[i], png.data[i + 1], png.data[i + 2]) > 12) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  expect(maxX).toBeGreaterThan(minX);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const w = maxX - minX;
  const h = maxY - minY;

  // Centered within 3px, round within 6px, and about 46% of the viewport height (±8%).
  expect(Math.abs(cx - png.width / 2)).toBeLessThanOrEqual(3);
  expect(Math.abs(cy - png.height / 2)).toBeLessThanOrEqual(3);
  expect(Math.abs(w - h)).toBeLessThanOrEqual(6);
  expect(h / png.height).toBeGreaterThan(0.46 * 0.92);
  expect(h / png.height).toBeLessThan(0.46 * 1.08);
});

test("scrolling drives the ball and the copy, both ways", async ({ page }) => {
  await skipIntroForTest(page);
  await page.goto("/?e2e=1&tier=low");
  await stageReady(page);
  await page.evaluate(() => window.__stage!.setIntroComplete());

  const hero = page.locator("#hero");
  const scrollRange = await page.evaluate(() => {
    const el = document.getElementById("hero")!;
    return el.offsetHeight - window.innerHeight;
  });
  const progress = () => page.evaluate(() => window.__stage!.snapshot().progress);

  await expect(hero).toHaveAttribute("data-copy", "a");
  expect(await progress()).toBeLessThan(0.05);

  await page.evaluate((y) => window.scrollTo(0, y), scrollRange * 0.6);
  await expect(hero).toHaveAttribute("data-copy", "b");
  await expect.poll(progress, { timeout: 5000 }).toBeGreaterThan(0.5);

  await page.evaluate((y) => window.scrollTo(0, y), scrollRange * 0.84);
  await expect.poll(progress, { timeout: 5000 }).toBeGreaterThan(0.97);

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(hero).toHaveAttribute("data-copy", "a");
  await expect.poll(progress, { timeout: 5000 }).toBeLessThan(0.05);
});

test("the headline is one static sentence for assistive tech", async ({ page }) => {
  await skipIntroForTest(page);
  await page.goto("/");
  const sr = page.locator("h1 .sr-only");
  await expect(sr).toHaveText(HEADLINE);
  await expect(page.locator("h1 [aria-hidden='true']")).toHaveCount(1);
});

test("reduced motion: no WebGL stage, a still poster, both lines of copy, no loader wait", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?e2e=1");
  await expect(page.locator(LOCK)).toHaveCount(0, { timeout: 2000 });
  expect(await page.evaluate(() => !!window.__stage)).toBe(false);
  await expect(page.locator(".hero-poster")).toBeVisible();
  await expect(page.locator("h1 .sr-only")).toHaveText(HEADLINE);
  const visual = page.locator("h1 [aria-hidden='true']");
  await expect(visual).toContainText("I build ambiguous ideas");
  await expect(visual).toContainText("into products where design and user needs meet.");
});

test("no WebGL: the poster shows and the page still works", async ({ page }) => {
  await skipIntroForTest(page);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...rest: unknown[]) {
      if (/webgl/i.test(type)) return null;
      return (original as (...a: unknown[]) => unknown).call(this, type, ...rest) as never;
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-stage", "fallback");
  await expect(page.locator(".hero-poster")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeAttached();
});
```

- [ ] **Step 2: Run the whole e2e suite**

Run: `npm run test:e2e`
Expected: all tests pass, including the earlier smoke tests (`/` still has a visible `h1` and the primary nav). The run builds first, so it takes a few minutes.

Likely adjustments, in order, **only if a test fails for the reason named** (do not loosen a requirement to make it pass):
- *Centering test fails on a 1-pixel border or a bright edge:* the threshold 12 is catching a vignette or poster; confirm the overlays are hidden (the `addStyleTag` ran) and re-run. The 3px tolerance is deliberate (points are sparse at the rim on the low tier).
- *Scroll test cannot reach 0.97:* the hero's scroll range and Lenis; make sure `scrollTo` is called after `ScrollTrigger.refresh` (wait for `document.fonts.ready`) and that the `window.scrollY` actually moved (`expect.poll`).
- *First test fails at the `<6s` bound under software GL:* the timeline is time-based, so this is a real bug (a long task blocking the main thread); investigate before touching the bound.

- [ ] **Step 3: Commit**

```bash
git add e2e/home-intro.spec.ts
git commit -m "test: cover the intro, scroll hero, centering and fallbacks end to end

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Visual acceptance gate (with Liam), tuning and the preview

Unit and e2e tests prove the machinery. They cannot say whether the result is **as good as or better than the reference level**. This task does, and Liam decides.

**Files:**
- Modify (tuning only): `src/three/particles/shaders.ts`, `src/three/particles/uniforms.ts`, `src/three/stage.ts` (bloom values, `BALL_*_FRACTION`), `src/components/home/hero.tsx` (type sizes, layout)

- [ ] **Step 1: Capture the real thing at full quality**

Start the dev server (`preview_start {name: "portfolio-dev"}`) and open `/?e2e=1&tier=high&bloom=1` at 1440×810 (`resize_window` with `width: 1440, height: 810`). With `javascript_tool`, set `__stage.setIntroComplete(); __stage.freeze(2.2);` and, for each of `setHeroProgress(0)`, `0.25`, `0.45`, `0.65`, `0.86`, take a screenshot. Also capture the intro at about 0.3s, 1.2s, 2.4s, 3.9s and 5.0s (fresh tab, no `e2e` freeze).

- [ ] **Step 2: Compare against the old video, frame for frame**

Extract matching reference frames from the old asset and put ours next to them:

```bash
ffmpeg -v error -y -ss 3.5 -i public/media/particles.mp4 -frames:v 1 -vf scale=1440:810 "$SCRATCH/old-ball.png"
ffmpeg -v error -y -ss 0.5 -i public/media/particles.mp4 -frames:v 1 -vf scale=1440:810 "$SCRATCH/old-chaos.png"
```

Build two side-by-side sheets (old on the left, new on the right, same size): ball and chaos. Use `ffmpeg -i old.png -i new.png -filter_complex hstack=inputs=2 out.png`. Look at them yourself with the Read tool first and write down, honestly, where the new one is weaker (dot character, richness of the cloud, color patches, depth of field, glow, edge softness) and where it is stronger (sharpness, true centering, no compression artifacts).

- [ ] **Step 3: Tune toward matching or beating it**

Iterate on the look until the new ball is at least as good. The knobs, in the order to try them (change one, re-screenshot, repeat): `uSize` / `BASE_SIZE_PX` (dot size), the tier particle counts in `tier.ts` (density), the `base` color mix and `band` thresholds (patch character), the `lit` / `rim` weights (ball shape), `uAperture` and the DoF coefficients (depth), bloom `strength / radius / threshold` in `stage.ts` (glow), `BALL_HEIGHT_FRACTION` (ball size). After any look change re-run the centering test and Task 12 Step 3 (the poster). Keep a short log of what changed and why in the commit message.

- [ ] **Step 4: Check the hero composition**

Screenshot the finished hero at 1440×810 and 1920×1080 at scroll progress 0, 0.45 and 0.86 with the real copy. Check: the ball is centered; copy A and B are legible against the particles (add a very subtle dark gradient scrim behind the copy only if needed); the `Scroll` cue fades once scrolling begins; the label sits cleanly. Then `resize_window` preset `mobile` and check: the headline does not overflow, the ball scales down (width limit) and stays centered.

- [ ] **Step 5: Measure performance**

On this machine with `tier=high`: scroll the hero and read `__stage.snapshot().frameMs` while scrolling. Target: ≤ 16.7ms average on `high`. If higher, lower `high`'s particle count or pixel ratio rather than letting the governor hide it. Then force `?e2e=1&tier=mid` and `tier=low` and confirm both still look good (they are what most visitors on weaker devices will see).

- [ ] **Step 6: The gate: send Liam the comparison and the preview**

Send Liam (with `SendUserFile`) the old-vs-new sheets, the hero frames and the intro frames, and say plainly: what is better, what is weaker, and whether you judge the real-time ball to match or beat the video. **Do not call this task done until Liam answers.** If he says it does not match, execute the documented fallback instead (spec §12.6): use the old video re-centered with `translate: -3.61% -1.23%` behind the same hero copy and scroll behaviour, and stop here.

- [ ] **Step 7: Full verification, push, preview**

Run: `npm run lint && npx vitest run && npm run test:e2e`
Expected: all green.

```bash
git add -A
git diff --cached --stat
git commit -m "chore: tune the particle look and hero composition

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push -u origin phase/2-home
```

Use the Vercel connector (`list_deployments`, project `liamhasson-portfolio`, team `team_xqMVV73uQk2d6wLWGqmCMxkh`, branch `phase/2-home`) and wait for `READY` (read the build log first if it fails). Fetch the preview with `web_fetch_vercel_url` to confirm a 200 with the hero markup, and send Liam the branch alias URL (`liamhasson-portfolio-git-phase-2-home-…vercel.app`) with a short list of what to try: the intro (open a new tab to see it again), scroll slowly through the hero and back, resize the window, and (if possible) open it on a phone. Merge to `main` only after he approves.

---

## Spec coverage (Phase 2a slice, spec §12)

| Requirement | Task |
|---|---|
| Quality bar: best-quality option, real 3D over baked video, acceptance gates with Liam | Plan header, 14 |
| Loader not skippable, ≤ 6s (built at 5.4s), once per session, dot → chaos burst + typed greeting | 8, 9, 13 |
| Hero scroll-triggered; copy swaps word by word; small "Product Designer" label; six phrases removed | 10 |
| Particles chaos → perfect ball driven by scroll | 5, 6, 7, 10 |
| Ball exactly centered (by construction and by measurement) | 2, 4, 7, 13 |
| Real-time GPU particles, rose and gold, depth of field, bloom | 6, 7, 14 |
| Match or beat the old video, with the documented fallback | 14 |
| Quality tiers, runtime governor, device-pixel-ratio caps | 3, 7 |
| Reduced-motion and no-WebGL fallback (poster from our own scene) | 7, 12, 13 |
| No flash on first paint, scroll lock, repeat visits skip | 8, 13 |
| Accessibility: one h1 with a static sentence, aria-hidden visuals, nav inert while hidden, focus unaffected | 10, 11, 13 |

---

## Outlines of the next plans (written when 2a is accepted)

**Plan 2b: 3D devices and the projects section (the recurring motif is the work).** Same quality bar. Real-time devices on the **same stage**, modelled in Blender, exported as GLB, carrying the real recorded product screens, moving with scroll in the style of Moto Card and Oryzo.
1. Capture the footage from the live products: Eventread (the search → calendar → results flow, no login), Cyvore (the hero interaction and the "after" micro-animation from the live case-study page) and Pulse (the phone flows). A contact sheet of candidate "wow" screens per project goes to Liam for approval before anything is encoded. Encode AV1/WebM + H.264 with posters.
2. Blender (installed): model a laptop, a phone and a browser window as **original** designs (no trademarked product shapes), with beveled edges and believable materials; bake what is worth baking; export Draco-compressed GLB (budget < 1 MB each) with a shared matcap/lighting rig in the same rose-and-gold light as the hero. Scripted export (`blender --background --python`) so the pipeline is repeatable.
3. Extend the stage to host the devices on its single canvas (scissored views for the grid, as the references do), with video textures on the screens, scroll-scrubbed pose, hover playback, and a card → case-study transition that carries the device.
4. Projects section: the five cards (live and "in progress" states), tags reconciled with Liam (Figma vs live differ), keyboard and screen-reader parity, and the reduced-motion variant (flat poster frames).
5. Acceptance gate with Liam against the references.

**Plan 2c: toolkit, about, testimonials, contact.** The toolkit icon burst (H12 to H14, no particle morphing), About ("I love looking for problems", "I own my work", the capability phrases moved here, View resume), the two testimonials, and Contact with copy-to-clipboard. An optional quiet return of the unmoving ball at Contact if it earns its place.
