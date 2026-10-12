import { parsePath, type Pt } from "./sketch-strokes";

/**
 * The sketches' hand (Liam, 2026-10-12: "the sketches look too perfect", take Oryzo's and the pencil reference's
 * style: imperfect circles and lines, more lines, the guiding lines under the final sketch). A sketch is described as
 * clean primitives; this draws them the way a hand does:
 * - construction guides first: long, straight, faint, running well past what they construct;
 * - every line in a loose stroke that bows a little and overshoots its ends, boxes side by side, in two passes;
 * - circles in one loop that overlaps past its start and wanders off the radius, then a lighter partial second loop;
 * - hatching: quick parallel strokes, trimmed unevenly at their ends;
 * - tone: soft rubbed areas, handed to the texture (desk-sketches.ts rubs them in), not strokes.
 * Deterministic: a sketch's seed draws it the same every time.
 */
export type Layer = "guide" | "line" | "hatch";
export type Mark = { pts: Pt[]; layer: Layer; alpha: number };
export type ToneArea = { pts: Pt[]; alpha: number };

export type Prim =
  | { k: "box"; x: number; y: number; w: number; h: number; r?: number; guides?: boolean; passes?: number }
  | { k: "ring"; cx: number; cy: number; r: number; guides?: boolean; passes?: number }
  | { k: "line"; a: Pt; b: Pt; passes?: number }
  | { k: "guide"; a: Pt; b: Pt }
  | { k: "path"; d: string; passes?: number }
  | { k: "hatch"; x: number; y: number; w: number; h: number; angle?: number; gap?: number; round?: boolean }
  | { k: "tone"; x: number; y: number; w: number; h: number; alpha?: number; round?: boolean };

export const HAND = {
  overshoot: [1.5, 6.5],      // units past a line's end (its start overshoots less)
  bow: 0.012,               // a line's bow, a share of its length…
  bowMax: 2.8,               // …at most this
  step: 4,                  // units between a stroke's points
  wobble: 0.45,             // the hand's low tremor (units)
  guideReach: [16, 60],     // units a guide runs past what it constructs
  guideOdds: 0.9,           // each edge's chance of a guide
  secondPass: [0.4, 0.7],   // the second pass's strength
  ringOverlap: [0.08, 0.3], // turns a circle runs past its start
  ringWarp: 0.06,           // its wander off the radius (share)
  hatchGap: 3,
  hatchAngle: -0.95,        // radians: lower left to upper right, a right hand's hatching
  hatchTrim: 0.2,           // share of a hatch stroke its ends may fall short
} as const;

export function rng(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const pick = (R: () => number, [a, b]: readonly [number, number]) => lerp(a, b, R());

/** A loose straight stroke from a to b: overshooting its ends, bowed, trembling a little. */
function roughLine(a: Pt, b: Pt, R: () => number, over: readonly [number, number] = HAND.overshoot, bowK = 1): Pt[] {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const o0 = pick(R, over) * 0.5, o1 = pick(R, over);
  const j0 = (R() - 0.5) * 1.1, j1 = (R() - 0.5) * 1.1;
  const bow = (R() * 2 - 1) * Math.min(L * HAND.bow, HAND.bowMax) * bowK;
  const ph = R() * 6.283, fr = 0.6 + R() * 1.6;
  const n = Math.max(2, Math.ceil((L + o0 + o1) / HAND.step));
  const pts: Pt[] = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n, along = -o0 + t * (L + o0 + o1);
    const off = lerp(j0, j1, t) + bow * 4 * t * (1 - t) + HAND.wobble * Math.sin(ph + t * fr * 6.283) * Math.min(1, L / 30);
    pts.push([a[0] + ux * along + nx * off, a[1] + uy * along + ny * off]);
  }
  return pts;
}

/** A polyline resampled every `step` units. */
function resample(poly: Pt[], step: number): Pt[] {
  const out: Pt[] = [poly[0]];
  let carry = 0;
  for (let i = 1; i < poly.length; i++) {
    const [x0, y0] = poly[i - 1], [x1, y1] = poly[i], L = Math.hypot(x1 - x0, y1 - y0);
    let d = step - carry;
    while (d <= L) { const t = d / L; out.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]); d += step; }
    carry = L - (d - step);
  }
  const last = poly[poly.length - 1], tail = out[out.length - 1];
  if (Math.hypot(last[0] - tail[0], last[1] - tail[1]) > 1e-6) out.push(last);
  return out;
}

/** A clean polyline made loose: shifted a touch, trembling along its normal, its end running on a little. */
function loosen(poly: Pt[], R: () => number, amp = 0.45): Pt[] {
  const pts = resample(poly, HAND.step);
  const sx = (R() - 0.5) * 1.2, sy = (R() - 0.5) * 1.2, ph = R() * 6.283, ph2 = R() * 6.283;
  const out = pts.map((p, i): Pt => {
    const a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, pts.length - 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
    const w = amp * (Math.sin(ph + i * 0.21) * 0.7 + Math.sin(ph2 + i * 0.077) * 0.6);
    return [p[0] + sx + nx * w, p[1] + sy + ny * w];
  });
  if (out.length > 1) {   // the end runs on past where it should stop
    const [x1, y1] = out[out.length - 1], [x0, y0] = out[out.length - 2], L = Math.hypot(x1 - x0, y1 - y0) || 1, on = pick(R, HAND.overshoot);
    out.push([x1 + ((x1 - x0) / L) * on, y1 + ((y1 - y0) / L) * on]);
  }
  return out;
}

function roundedRect(x: number, y: number, w: number, h: number, r: number, start: number): Pt[] {
  const rr = Math.min(r, w / 2, h / 2), pts: Pt[] = [];
  const corners: [number, number, number][] = [[x + w - rr, y + rr, -Math.PI / 2], [x + w - rr, y + h - rr, 0], [x + rr, y + h - rr, Math.PI / 2], [x + rr, y + rr, Math.PI]];
  for (let c = 0; c < 4; c++) {
    const [cx, cy, a0] = corners[(c + start) % 4];
    for (let k = 0; k <= 6; k++) { const a = a0 + (k / 6) * (Math.PI / 2); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  }
  // close, and run on past the start a little: the hand doesn't stop exactly where it began
  pts.push(pts[0], pts[1]);
  return pts;
}

/** A sketch's primitives drawn by hand: its marks in drawing order (guides, then lines, then hatching) and its tone. */
export function drawSketch(prims: readonly Prim[], seed: number): { marks: Mark[]; tones: ToneArea[] } {
  const R = rng(seed + 1);
  const guides: Mark[] = [], lines: Mark[] = [], hatch: Mark[] = [], tones: ToneArea[] = [];
  const guide = (a: Pt, b: Pt) => guides.push({ pts: roughLine(a, b, R, [0, 0], 0.15), layer: "guide", alpha: pick(R, [0.6, 1]) });
  const passAlpha = (p: number) => (p ? pick(R, HAND.secondPass) : 1);

  for (const p of prims) {
    if (p.k === "box") {
      const { x, y, w, h } = p;
      if (p.guides) {
        const reach = () => pick(R, HAND.guideReach);
        if (R() < HAND.guideOdds) guide([x - reach(), y], [x + w + reach(), y]);
        if (R() < HAND.guideOdds) guide([x - reach(), y + h], [x + w + reach(), y + h]);
        if (R() < HAND.guideOdds) guide([x, y - reach()], [x, y + h + reach()]);
        if (R() < HAND.guideOdds) guide([x + w, y - reach()], [x + w, y + h + reach()]);
      }
      for (let pass = 0; pass < (p.passes ?? 2); pass++) {
        const alpha = passAlpha(pass), d = pass ? 1.6 : 0;
        const ox = (R() - 0.5) * d * 2, oy = (R() - 0.5) * d * 2;
        if (p.r) lines.push({ pts: loosen(roundedRect(x + ox, y + oy, w, h, p.r, Math.floor(R() * 4)), R), layer: "line", alpha });
        else {
          const c: Pt[] = [[x + ox, y + oy], [x + w + ox, y + oy], [x + w + ox, y + h + oy], [x + ox, y + h + oy]];
          for (let s = 0; s < 4; s++) lines.push({ pts: roughLine(c[s], c[(s + 1) % 4], R), layer: "line", alpha });
        }
      }
    } else if (p.k === "ring") {
      const { cx, cy, r } = p;
      if (p.guides) {
        const k = () => r * pick(R, [1.3, 1.7]);
        guide([cx - k(), cy], [cx + k(), cy]);
        guide([cx, cy - k()], [cx, cy + k()]);
      }
      for (let pass = 0; pass < (p.passes ?? 2); pass++) {
        const alpha = passAlpha(pass);
        const ox = (R() - 0.5) * r * 0.12, oy = (R() - 0.5) * r * 0.12;
        const ell = 1 + (R() - 0.5) * 0.08, rot = R() * Math.PI, a0 = R() * 6.283, ph = R() * 6.283;
        const sweep = 2 * Math.PI * (pass ? pick(R, [0.55, 0.95]) : 1 + pick(R, HAND.ringOverlap));
        const drift = (R() - 0.5) * 0.05;   // a slight spiral: the loop doesn't land on itself
        const n = Math.max(16, Math.ceil((r * sweep) / 2.5));
        const pts: Pt[] = [];
        for (let i = 0; i <= n; i++) {
          const t = i / n, a = a0 + t * sweep;
          const rad = r * (1 + HAND.ringWarp * Math.sin(2 * a + ph) + drift * t);
          const ex = Math.cos(a) * rad * ell, ey = Math.sin(a) * rad / ell;
          pts.push([cx + ox + ex * Math.cos(rot) - ey * Math.sin(rot), cy + oy + ex * Math.sin(rot) + ey * Math.cos(rot)]);
        }
        lines.push({ pts, layer: "line", alpha });
      }
    } else if (p.k === "line") {
      for (let pass = 0; pass < (p.passes ?? 1); pass++) lines.push({ pts: roughLine(p.a, p.b, R), layer: "line", alpha: passAlpha(pass) });
    } else if (p.k === "guide") {
      guide(p.a, p.b);
    } else if (p.k === "path") {
      for (const s of parsePath(p.d)) for (let pass = 0; pass < (p.passes ?? 1); pass++) lines.push({ pts: loosen(s, R), layer: "line", alpha: passAlpha(pass) });
    } else if (p.k === "hatch") {
      const ang = p.angle ?? HAND.hatchAngle, gap = p.gap ?? HAND.hatchGap;
      const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
      const cx = p.x + p.w / 2, cy = p.y + p.h / 2, D = Math.hypot(p.w, p.h) / 2;
      for (let d = -D + gap * R(); d < D; d += gap * pick(R, [0.8, 1.2])) {
        const seg = clip(cx + nx * d, cy + ny * d, ux, uy, p);
        if (!seg) continue;
        let [t0, t1] = seg;
        const L = t1 - t0;
        if (L < 1.5) continue;
        t0 += L * HAND.hatchTrim * R() * 0.5; t1 -= L * HAND.hatchTrim * R();
        const a: Pt = [cx + nx * d + ux * t0, cy + ny * d + uy * t0], b: Pt = [cx + nx * d + ux * t1, cy + ny * d + uy * t1];
        hatch.push({ pts: roughLine(a, b, R, [0, 0.8], 0.5), layer: "hatch", alpha: pick(R, [0.55, 0.9]) });
      }
    } else if (p.k === "tone") {
      const n = 28, pts: Pt[] = [], cx = p.x + p.w / 2, cy = p.y + p.h / 2;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 2 * Math.PI, j = 1 + (R() - 0.5) * 0.12;
        if (p.round) pts.push([cx + Math.cos(a) * p.w / 2 * j, cy + Math.sin(a) * p.h / 2 * j]);
        else {   // the rect's outline, walked by angle, its edge uneven
          const c = Math.cos(a), s = Math.sin(a), k = Math.min(Math.abs(p.w / 2 / (c || 1e-9)), Math.abs(p.h / 2 / (s || 1e-9)));
          pts.push([cx + c * k * j, cy + s * k * j]);
        }
      }
      tones.push({ pts, alpha: p.alpha ?? 0.5 });
    }
  }
  return { marks: [...guides, ...lines, ...hatch], tones };
}

/** The line (px, py) + t·(ux, uy) clipped to a hatch's area (its rect, or the ellipse inside it): [t0, t1], or null. */
function clip(px: number, py: number, ux: number, uy: number, p: { x: number; y: number; w: number; h: number; round?: boolean }): [number, number] | null {
  if (p.round) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, rx = p.w / 2, ry = p.h / 2;
    const ax = ux / rx, ay = uy / ry, bx = (px - cx) / rx, by = (py - cy) / ry;
    const A = ax * ax + ay * ay, B = 2 * (ax * bx + ay * by), C = bx * bx + by * by - 1, disc = B * B - 4 * A * C;
    if (disc <= 0) return null;
    const s = Math.sqrt(disc);
    return [(-B - s) / (2 * A), (-B + s) / (2 * A)];
  }
  let t0 = -Infinity, t1 = Infinity;
  for (const [o, u, lo, hi] of [[px, ux, p.x, p.x + p.w], [py, uy, p.y, p.y + p.h]] as const) {
    if (Math.abs(u) < 1e-9) { if (o < lo || o > hi) return null; continue; }
    const a = (lo - o) / u, b = (hi - o) / u;
    t0 = Math.max(t0, Math.min(a, b)); t1 = Math.min(t1, Math.max(a, b));
  }
  return t1 > t0 ? [t0, t1] : null;
}

/** All a sketch's points' bounds: [x, y, w, h]. */
export function markBounds(marks: Mark[], tones: ToneArea[] = []): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const m of [...marks, ...tones]) for (const [x, y] of m.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return [x0, y0, x1 - x0, y1 - y0];
}
