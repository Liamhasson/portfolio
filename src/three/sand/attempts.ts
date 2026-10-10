/**
 * 2.2 "Then I test solutions": the three attempts as a function of scroll (0..1), ported frame for frame from the
 * approved Blender clip (lookdev.py attempt_keys, 144 frames). Each gets further in size and clarity; the first two
 * collapse, breaking into islands the sand swallows (accelerating: it gives way); the third overshoots a touch and holds.
 * Returns [lo, breakup, depth]: lo 1 = no attempt, lower = a bigger patch.
 */
export type AttemptKey = [number, number, number];

const REST: AttemptKey = [1, 0, 0];
const A1: AttemptKey = [0.93, 0, 0.5];
const A2: AttemptKey = [0.82, 0, 0.72];
const A3: AttemptKey = [0.68, 0, 1];
const OVER: AttemptKey = [0.655, 0, 1];

const ss = (t: number) => { t = Math.min(Math.max(t, 0), 1); return t * t * t * (t * (t * 6 - 15) + 10); };
const fall = (t: number) => { t = Math.min(Math.max(t, 0), 1); return t * t; };
const mix = (a: AttemptKey, b: AttemptKey, t: number): AttemptKey => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const broken = (a: AttemptKey): AttemptKey => [1, 1, a[2] * 0.4];

export function attemptAt(x: number): AttemptKey {
  const f = 1 + Math.min(Math.max(x, 0), 1) * 143;   // the clip's frame, fractional
  if (f <= 22) return mix(REST, A1, ss((f - 1) / 21));
  if (f <= 26) return A1;
  if (f <= 40) return mix(A1, broken(A1), fall((f - 26) / 14));
  if (f <= 46) return REST;
  if (f <= 72) return mix(REST, A2, ss((f - 46) / 26));
  if (f <= 76) return A2;
  if (f <= 94) return mix(A2, broken(A2), fall((f - 76) / 18));
  if (f <= 100) return REST;
  if (f <= 128) return mix(REST, OVER, ss((f - 100) / 28));
  return mix(OVER, A3, ss((f - 128) / 16));
}

/**
 * 2.2 in sand only (Liam, 2026-10-10): the three attempts as small bursts in which the ball breaks form a little, as
 * if going back to chaos, each a different shape (a patch, a seam, a ring) and a little stronger than the last. Each:
 * the ball draws in a touch, breaks as it swells a touch, then settles. x: 0..1 through 2.2 (scrubbed by the scroll).
 */
export interface BurstKey {
  /** which attempt (0..2), or -1 between them */
  index: number;
  /** how far it breaks, 0..1 */
  amount: number;
  /** the ball's volume, a share of its size (- drawn in, + swollen) */
  volume: number;
  /** 0 patch, 1 seam, 2 ring */
  shape: number;
}

const BURSTS = [
  { from: 0.04, to: 0.32, strength: 0.7 },
  { from: 0.36, to: 0.64, strength: 0.85 },
  { from: 0.68, to: 0.96, strength: 1 },
];

export function burstAt(x: number): BurstKey {
  const sm = (v: number) => { const t = Math.min(Math.max(v, 0), 1); return t * t * (3 - 2 * t); };
  for (let i = 0; i < BURSTS.length; i++) {
    const b = BURSTS[i];
    if (x < b.from || x > b.to) continue;
    const u = (x - b.from) / (b.to - b.from);
    const draw = -0.022, swell = 0.03;
    if (u < 0.2) return { index: i, amount: 0, volume: draw * sm(u / 0.2), shape: i };
    if (u < 0.45) {
      const k = sm((u - 0.2) / 0.25);
      return { index: i, amount: k * b.strength, volume: draw + (swell - draw) * k, shape: i };
    }
    const k = 1 - sm((u - 0.45) / 0.55);
    return { index: i, amount: k * b.strength, volume: swell * k, shape: i };
  }
  return { index: -1, amount: 0, volume: 0, shape: 0 };
}
