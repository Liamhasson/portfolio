// src/app/about/edge-bend.ts
/**
 * The glass edges where the SVG lens can't run (WebKit: Safari and every iOS browser; Firefox; Liam, 2026-10-19): instead of
 * bending the backdrop, the words passing through the edge bands bend themselves, each letter moved and stretched by the
 * same field the lens's displacement map holds (edge-lens.ts: the band, the pull, the profile, the rounded corners), so it
 * reads the same: pulled toward the rim, magnifying toward it, no blur. An approximation of the refraction (each letter
 * stretched evenly between where its corners would show), not the refraction itself. The pure
 * parts live here; edge-bend-dom.ts splits the words and applies them.
 */
import { lensAmp, lensProfile } from "./edge-lens";

/**
 * The pull at the very rim (px) for the filter's scale (lensScale): what feDisplacementMap does with the map's channel
 * there, 128 + 127 × amp (amp: lensAmp on a narrow band), read back as scale × (channel / 255 − 0.5).
 */
export function bendPull(scale: number, band: number): number {
  return Math.max(0, scale) * lensAmp(band) * (127 / 255);
}

/** How far in a point at `inn` px from the rim samples from (px): the lens's displacement there. Past the band nothing; off
 *  the screen beyond the rim the full pull (so the mapping below goes on smoothly off the screen). */
export function bendOffset(inn: number, band: number, pull: number): number {
  if (band <= 0 || inn >= band) return 0;
  return pull * lensProfile(1 - Math.max(inn, 0) / band);
}

/**
 * Where something `u` px from the rim shows (px from the rim): the point `inn` whose sample is `u` (inn + offset(inn) = u).
 * The lens holds its slope under 1 (edge-lens.ts MAX_DERIV), so that's one point, nearer the rim than `u` (pulled out) and
 * spread wider than it (magnified). Content within the pull of the rim shows off the screen.
 */
export function bendShown(u: number, band: number, pull: number): number {
  if (pull <= 0 || band <= 0 || u >= band) return u;
  if (u <= pull) return u - pull; // (offset(≤ 0) is the full pull: a straight shift)
  let lo = 0, hi = u; // (inn ≤ u: the offset is never negative; inn ≥ 0 since u > pull = inn + offset at 0)
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (mid + bendOffset(mid, band, pull) < u) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * The screen as the lens bends it: `w` × `h` px, its band `band` deep round the rounded edge (corner radius 1.4 × the band,
 * as lensMap draws it), pulling `pull` px at the rim. `sides`: only the left and right strips show (the desktop track,
 * lensStrips "sides"), each `depth` px wide (lensDepth), so only what lies within them bends, their corners included.
 */
export type BendScreen = { w: number; h: number; band: number; pull: number; sides: boolean; depth: number };

/** A point, written in place (no object per call). */
export type Pt = { x: number; y: number };

/** The lens's sample offset at screen point (x, y) (px, inward along the rounded edge's normal), as lensMap holds it. */
export function bendField(x: number, y: number, s: BendScreen, out: Pt): Pt {
  out.x = 0; out.y = 0;
  const { w, h, band } = s;
  if (s.pull <= 0 || band <= 0) return out;
  if (s.sides && x >= s.depth && x <= w - s.depth) return out;
  const rad = 1.4 * band, hw = w / 2, hh = h / 2;
  const sx = x < hw ? -1 : 1, sy = y < hh ? -1 : 1;
  const qx = Math.abs(x - hw) - (hw - rad), qy = Math.abs(y - hh) - (hh - rad);
  let sd: number, gx: number, gy: number;
  if (qx > 0 && qy > 0) { const l = Math.hypot(qx, qy); sd = l - rad; gx = (sx * qx) / l; gy = (sy * qy) / l; }
  else if (qx > qy) { sd = qx - rad; gx = sx; gy = 0; }
  else { sd = qy - rad; gx = 0; gy = sy; }
  const m = bendOffset(-sd, band, s.pull);
  out.x = -gx * m; out.y = -gy * m;
  return out;
}

const tmp: Pt = { x: 0, y: 0 };

/**
 * Where content at screen point (x, y) shows: the point p whose sample is it (p + field(p) = (x, y)). Along an edge, away
 * from the corners, that's bendShown along the edge's normal; in a corner, found by iterating p = (x, y) − field(p) (the
 * field's slope stays well under 1 there, so it settles in a few dozen steps).
 */
export function bendPoint(x: number, y: number, s: BendScreen, out: Pt): Pt {
  out.x = x; out.y = y;
  const { w, h, band, pull } = s;
  if (pull <= 0 || band <= 0) return out;
  if (s.sides && x >= s.depth && x <= w - s.depth) return out;
  const rad = 1.4 * band;
  const cx = x < rad || x > w - rad, cy = y < rad || y > h - rad;
  if (cx && cy) {
    let px = x, py = y;
    for (let i = 0; i < 60; i++) {
      bendField(px, py, s, tmp);
      const nx = x - tmp.x, ny = y - tmp.y;
      const done = Math.abs(nx - px) + Math.abs(ny - py) < 1e-4;
      px = nx; py = ny;
      if (done) break;
    }
    out.x = px; out.y = py;
    return out;
  }
  if (x < band) out.x = bendShown(x, band, pull);
  else if (x > w - band) out.x = w - bendShown(w - x, band, pull);
  if (!s.sides) {
    if (y < band) out.y = bendShown(y, band, pull);
    else if (y > h - band) out.y = h - bendShown(h - y, band, pull);
  }
  return out;
}

const p0: Pt = { x: 0, y: 0 }, p1: Pt = { x: 0, y: 0 }, p2: Pt = { x: 0, y: 0 };

/**
 * A piece's bend: the box x0..x1 × y0..y1 (screen px) stretched evenly between where three corners of its visible part
 * show (top left, top right, bottom left), as a CSS matrix about the box's top left [a, b, c, d, e, f]; null when it shows
 * as it is (clear of the bands, or no corner moved 0.01 px). The visible part: the box less what lies within the pull of a
 * rim (that shows off the screen), so a piece straddling the rim is fitted where it is seen, not across the bend's kink.
 */
export function bendBox(x0: number, y0: number, x1: number, y1: number, s: BendScreen): [number, number, number, number, number, number] | null {
  const { w, h, band, pull } = s;
  if (pull <= 0 || x1 <= x0 || y1 <= y0) return null;
  if (x0 >= band && x1 <= w - band && y0 >= band && y1 <= h - band) return null;
  if (s.sides && x0 >= s.depth && x1 <= w - s.depth) return null;
  // (the visible part, kept at least a px across: a piece wholly past the pull is fitted on its edge nearest the screen)
  let cx0 = Math.max(x0, pull), cx1 = Math.min(x1, w - pull), cy0 = y0, cy1 = y1;
  if (!s.sides) { cy0 = Math.max(y0, pull); cy1 = Math.min(y1, h - pull); }
  if (cx1 - cx0 < 1) { if (cx0 > x0) { cx0 = Math.min(cx0, x1 - 1); cx1 = cx0 + 1; } else { cx1 = Math.max(cx1, x0 + 1); cx0 = cx1 - 1; } }
  if (cy1 - cy0 < 1) { if (cy0 > y0) { cy0 = Math.min(cy0, y1 - 1); cy1 = cy0 + 1; } else { cy1 = Math.max(cy1, y0 + 1); cy0 = cy1 - 1; } }
  bendPoint(cx0, cy0, s, p0); bendPoint(cx1, cy0, s, p1); bendPoint(cx0, cy1, s, p2);
  const bw = cx1 - cx0, bh = cy1 - cy0;
  const a = (p1.x - p0.x) / bw, b = (p1.y - p0.y) / bw, c = (p2.x - p0.x) / bh, d = (p2.y - p0.y) / bh;
  // (where the box's own top left lands, carried along from the visible part's)
  const e = p0.x + a * (x0 - cx0) + c * (y0 - cy0) - x0, f = p0.y + b * (x0 - cx0) + d * (y0 - cy0) - y0;
  const moved = Math.max(Math.abs(e), Math.abs(f), Math.abs(e + (a - 1) * (x1 - x0)), Math.abs(f + (d - 1) * (y1 - y0)), Math.abs(b) * (x1 - x0), Math.abs(c) * (y1 - y0));
  if (moved < 0.01) return null;
  return [a, b, c, d, e, f];
}
