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
