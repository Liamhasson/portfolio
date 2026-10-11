/**
 * The ball's key light (Liam, 2026-10-11: "it looks slightly too flat … move the light slightly to the side … the light
 * can move while the ball is formed; I like the light on the vortex"). The hero's key stands up and left, near the
 * camera's line, so the ball faced it whole and read flat. As the ball forms the key swings around it, at the same
 * distance (its strength on the ball unchanged), to the left side: a lit edge rolling into shadow across the face.
 */
export const BALL_KEY = {
  from: 0.3,                                    // the compaction it starts moving at (the vortex keeps its light)
  to: 1.0,                                      // and where it arrives
  dir: [-0.85, 0.45, 0.33] as [number, number, number],   // from the ball: left, a little above, a little toward the camera
} as const;

type V3 = [number, number, number];

const norm = (v: V3): V3 => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };

/** The key light's position at a compaction (0 chaos .. 1 ball), around the ball's centre. */
export function ballKeyPos(key: V3, ball: V3, compact: number): V3 {
  const x = Math.min(Math.max((compact - BALL_KEY.from) / (BALL_KEY.to - BALL_KEY.from), 0), 1);
  const k = x * x * (3 - 2 * x);
  if (k === 0) return key;
  const d: V3 = [key[0] - ball[0], key[1] - ball[1], key[2] - ball[2]];
  const r = Math.hypot(d[0], d[1], d[2]);
  // along the great circle from where it was to the side (slerp of the directions)
  const a = norm(d), b = norm(BALL_KEY.dir as unknown as V3);
  const cos = Math.min(Math.max(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1), 1), om = Math.acos(cos);
  const s = Math.sin(om);
  const wa = s < 1e-6 ? 1 - k : Math.sin((1 - k) * om) / s, wb = s < 1e-6 ? k : Math.sin(k * om) / s;
  return [ball[0] + (a[0] * wa + b[0] * wb) * r, ball[1] + (a[1] * wa + b[1] * wb) * r, ball[2] + (a[2] * wa + b[2] * wb) * r];
}
