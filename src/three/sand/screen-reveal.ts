import layout from "./screen-reveal.json";

/**
 * The project index's first reveal, as the laptop screen plays it when the camera arrives at 2.3: the same keyframes,
 * delays and easing as the index's CSS (docs/prototypes/work-index.html), so the screen and the live section that takes
 * over from it are one animation. The layout (each element's box, delay and share of the screen's light) is captured
 * from the prototype by blender/lookdev/capture_index.mjs.
 *   .wake            black overlay, opacity 1 -> 0 over 0.6 s, ease-out
 *   title/count/rows surface over 0.9 s, cubic-bezier(.22,1,.36,1): opacity 0 -> 1, 1.2cqw lower -> in place, blur 6px -> 0
 */

export interface RevealElement {
  name: string;
  /** [x0, y0, x1, y1] in the screen's 0..1 frame, y down (the texture's UVs). */
  box: number[];
  delay: number;
  /** Its share of the light the finished screen gives off. */
  light: number;
}

export const REVEAL = layout as {
  surface: { duration: number; ease: number[]; rise: number; blur_px: number; width_px: number };
  wake: { duration: number; ease: number[] };
  elements: RevealElement[];
  background_light: number;
};

/** The reveal's length in seconds (the last row's delay + its surface). */
export const REVEAL_SECONDS = Math.max(...REVEAL.elements.map((e) => e.delay)) + REVEAL.surface.duration;

/** CSS cubic-bezier(x1, y1, x2, y2) as a function of time 0..1 (Newton, then bisection; as browsers do). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const bx = (s: number) => 3 * x1 * s * (1 - s) ** 2 + 3 * x2 * s * s * (1 - s) + s ** 3;
  const by = (s: number) => 3 * y1 * s * (1 - s) ** 2 + 3 * y2 * s * s * (1 - s) + s ** 3;
  const dx = (s: number) => 3 * x1 * (1 - s) ** 2 + 6 * (x2 - x1) * s * (1 - s) + 3 * (1 - x2) * s * s;
  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let s = t;
    for (let i = 0; i < 8; i++) {
      const e = bx(s) - t;
      if (Math.abs(e) < 1e-6) return by(s);
      const d = dx(s);
      if (Math.abs(d) < 1e-6) break;
      s -= e / d;
    }
    let lo = 0, hi = 1;
    s = t;
    for (let i = 0; i < 40; i++) {
      if (bx(s) < t) lo = s; else hi = s;
      s = (lo + hi) / 2;
    }
    return by(s);
  };
}

const surfaceEase = cubicBezier(...(REVEAL.surface.ease as [number, number, number, number]));
const wakeEase = cubicBezier(...(REVEAL.wake.ease as [number, number, number, number]));

export interface RevealFrame {
  /** The black overlay's opacity (1 dark .. 0 gone). */
  wake: number;
  /** Per element: opacity, how far below its place it is (screen heights), blur (CSS px at the design's 1600 px). */
  elements: { opacity: number; offset: number; blur: number }[];
  /** The light the screen gives off, 0 (dark) .. 1 (the finished index). */
  light: number;
}

/** The reveal `t` seconds after the screen wakes (t <= 0: dark; t >= REVEAL_SECONDS: the finished index). */
export function revealAt(t: number): RevealFrame {
  const wake = 1 - wakeEase(t / REVEAL.wake.duration);
  let light = REVEAL.background_light;
  const elements = REVEAL.elements.map((e) => {
    // the keyframe runs from its `from` values to the element's own (opacity 1, in place, sharp)
    const k = surfaceEase((t - e.delay) / REVEAL.surface.duration);
    light += e.light * k;
    return { opacity: k, offset: (1 - k) * REVEAL.surface.rise, blur: (1 - k) * REVEAL.surface.blur_px };
  });
  return { wake, elements, light: light * (1 - wake) };
}
