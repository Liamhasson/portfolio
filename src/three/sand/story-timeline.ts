/**
 * The hero page's story in screens scrolled (spec docs/superpowers/specs/2026-10-11-scene-order-design.md §3): the
 * hero; the ball forming in place (the camera easing in); a hold; one forward shot (tilt down, glide over the desk,
 * the laptop and the push into the screen); the index.
 */
export const BEATS = {
  hero: [0, 0.4],
  compact: [0.4, 1.6],
  copyOut: [0.45, 1.45],
  hold: [1.6, 1.8],
  tilt: [1.8, 2.4],
  glide: [2.4, 3.2],
  headlineIn: [2.35, 2.65],
  headlineOut: [2.95, 3.2],
  tail: [3.2, 4.2],
  takeover: [4.12, 4.2],
  indexIn: [4.2, 4.3],
} as const satisfies Record<string, readonly [number, number]>;

/** Where the story ends and the index's own scrolling begins (screens). */
export const STORY_SCREENS = 4.3;

export const span = (p: number, [a, b]: readonly [number, number]) => Math.min(Math.max((p - a) / (b - a), 0), 1);

/** smootherstep of t over [a, b] (Blender's ease in lookdev.py). */
export function ease(t: number, r: readonly [number, number]): number {
  const x = span(t, r);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

export interface ShotBeats { ease: [number, number]; tilt: [number, number]; glide: [number, number]; tail: [number, number] }
/** public/lab/shot/camera.json's own fields (blender/lookdev/shot_path.py). */
export interface ShotMeta { frames: number; wake_frame: number; screen_from: number; beats: ShotBeats }

const segments = (b: ShotBeats): [readonly [number, number], [number, number]][] => [
  [BEATS.compact, b.ease], [BEATS.tilt, b.tilt], [BEATS.glide, b.glide], [BEATS.tail, b.tail],
];

/** Progress (screens) -> the shot's frame (0-based, fractional). Between beats it holds the last one's end. */
export function shotFrame(p: number, b: ShotBeats): number {
  let f = b.ease[0];
  for (const [[p0, p1], [f0, f1]] of segments(b)) {
    if (p <= p0) return f;
    if (p <= p1) return f0 + (f1 - f0) * ((p - p0) / (p1 - p0));
    f = f1;
  }
  return f;
}

/** The progress that shows frame f (calibration: ?shotframe=N). */
export function pAtFrame(f: number, b: ShotBeats): number {
  for (const [[p0, p1], [f0, f1]] of segments(b)) if (f <= f1) return p0 + (p1 - p0) * ((f - f0) / (f1 - f0));
  return BEATS.tail[1];
}

/** Reduced motion (spec §8): held states (the cloud, the ball, the desk with its headline, the index), each cut a
 *  short crossfade through black (veil 0..1..0 over 0.2 screens), the scene switching at the veil's peak. */
const HELD = [0, BEATS.hold[0], (BEATS.headlineIn[1] + BEATS.headlineOut[0]) / 2, STORY_SCREENS];
const CUTS = [0.9, 2.2, 3.5];
export function reducedStory(p: number): { p: number; veil: number } {
  let state = 0, veil = 0;
  CUTS.forEach((c, i) => {
    if (p >= c) state = i + 1;
    veil = Math.max(veil, 1 - Math.min(Math.abs(p - c) / 0.1, 1));
  });
  return { p: HELD[state], veil };
}
