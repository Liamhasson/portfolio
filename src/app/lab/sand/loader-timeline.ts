// src/app/lab/sand/loader-timeline.ts
/**
 * The loader from 100% (spec 2026-10-12-loader-design.md §2.3), as a function of the seconds since, accumulated from the
 * frames' dt (a hidden tab pauses it): the anchors become grains, the lines dissolve, the light comes up, the copy and
 * nav arrive, scrolling unlocks.
 */
export const LOADER = {
  squareShrink: 0.22,
  dissolve: [0.2, 1.1] as const,
  briefGone: 1.4,
  light: [0.9, 2.4] as const,
  lightFloor: 0.35,
  copy: [2.8, 3.6] as const,
  unlock: 3.6,
  /** each anchor's moment: centre; the curve's top, right, bottom, left; the box's corners TL, TR, BR, BL */
  starts: [0, 0.32, 0.38, 0.44, 0.5, 0.2, 0.24, 0.28, 0.3],
  reducedFade: 0.4,
  fadeIn: 0.6,
} as const;

const ease = (x: number) => { const t = Math.min(Math.max(x, 0), 1); return t * t * (3 - 2 * t); };
const span = (t: number, [a, b]: readonly [number, number]) => Math.min(Math.max((t - a) / (b - a), 0), 1);

export function loaderAt(t: number) {
  const squares = LOADER.starts.map((s) => 1 - ease((t - s) / LOADER.squareShrink));
  const dash = ease(span(t, LOADER.dissolve));
  const briefAlpha = 1 - ease(span(t, [0.7, LOADER.briefGone]));
  const light = ease(span(t, LOADER.light));
  return {
    squares: squares.map((s) => (s <= 1e-6 ? 0 : s)),
    dash,
    briefAlpha: briefAlpha <= 1e-6 ? 0 : briefAlpha,
    light,
    lightK: LOADER.lightFloor + (1 - LOADER.lightFloor) * light,
    copy: ease(span(t, LOADER.copy)),
    unlocked: t >= LOADER.unlock,
  };
}
