/**
 * The vortex to the right of the copy (Liam, 2026-10-11): on a wide screen the chaos cloud (and the vortex at its centre)
 * moves sideways so its centre stands right of "Hi, I'm Liam."; the ball still forms where it always has (each grain's
 * path runs from its moved spot to its place in the ball). Sideways only, in the hero camera's frame: never nearer the
 * lens, so no grain grows. On portrait screens the copy spans the width, so the cloud stays where it is.
 */
export const HERO_LAYOUT = {
  ndcX: 0.3,          // the cloud's centre on screen (-1 left .. 1 right): ~65% of the width
  aspectFrom: 0.9,    // no move at or below this aspect (portrait), the full move from aspectTo up
  aspectTo: 1.3,
} as const;

type V3 = [number, number, number];

/** The world offset for the cloud. `tanHalfW`: the hero lens's horizontal half-extent (tan) at this aspect. */
export function heroShift(camPos: V3, target: V3, centre: V3, tanHalfW: number, aspect: number): V3 {
  const t = Math.min(Math.max((aspect - HERO_LAYOUT.aspectFrom) / (HERO_LAYOUT.aspectTo - HERO_LAYOUT.aspectFrom), 0), 1);
  const k = t * t * (3 - 2 * t);
  if (k === 0) return [0, 0, 0];
  const f = [target[0] - camPos[0], target[1] - camPos[1], target[2] - camPos[2]];
  const fl = Math.hypot(f[0], f[1], f[2]);
  f[0] /= fl; f[1] /= fl; f[2] /= fl;
  // the screen's right: forward x up
  const rl = Math.hypot(f[2], f[0]);
  const r = [-f[2] / rl, 0, f[0] / rl];
  const d = [centre[0] - camPos[0], centre[1] - camPos[1], centre[2] - camPos[2]];
  const depth = d[0] * f[0] + d[1] * f[1] + d[2] * f[2];
  const now = (d[0] * r[0] + d[2] * r[2]) / (depth * tanHalfW);
  const m = k * (HERO_LAYOUT.ndcX - now) * depth * tanHalfW;
  return [r[0] * m, 0, r[2] * m];
}
