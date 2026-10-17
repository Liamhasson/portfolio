// src/three/pendant/layout.ts
/**
 * Readability (spec 2026-10-16-about-pendant-design.md §5): while you read a line, the pendant never sits on top of it.
 * Pure rules, no DOM and no three: where the pendant's screen box overlaps a text (or a picture: a box like a line, counted
 * only where it is drawn), which layer (in front of the words or
 * behind them) it may be on at each point of the scroll, and where to nudge a shot whose spot is taken.
 * Coordinates: a text's `l` is in TRACK px (the sideways track's own x, before it moves) and its `t` is viewport px (the
 * track only moves sideways). At travel `s` (px of the track gone by) a text's screen left is `l - s`. Boxes are screen px.
 * `fixed` boxes are what holds still on screen while the track moves (the site's wordmark and pill nav, About's resume pill
 * and progress bar): screen px, never shifted by `s`, and treated exactly like text (the pendant is never in front over one).
 * Stacked (phones, reduced motion: plan Task 11) the travel is the page's own vertical scroll through the section: a text
 * marked `axis: "y"` has its `l` in screen px and its `t` in the section's px, and at travel `s` its screen top is `t - s`.
 */
import type { Box } from "./camera";
import type { Layer } from "./shots";

/** A text block: `l` in track px, `t` in viewport px, `w` and `h` its size. */
export interface TextRect {
  l: number; t: number; w: number; h: number;
  /** For what is only partly drawn as the track moves (a picture rising out of its line, or cut at the margin as it leaves:
   *  about/picture-motion.ts): at travel `s`, the screen point (px) left of and above which none of it shows, or null when
   *  none of it shows at all. Without it the whole box always counts. */
  shown?: (s: number) => { x: number; y: number } | null;
  /** Which way it rides with the travel: "x" (the default) the sideways track, "y" the stacked page scrolling up. */
  axis?: "x" | "y";
}
/** One look ahead along the scroll: the layer the shots want at travel `s`, and the pendant's projected bounds there. */
export interface Sample { s: number; wanted: Layer; box: Box }

/**
 * How many text boxes (and fixed boxes) the pendant's box overlaps at travel `s`. Touching edges do not overlap (strict
 * inequalities), so a pendant that just kisses a line's edge may stay in front. Fixed boxes are counted where they are, with
 * no `s` shift.
 */
export function hits(box: Box, texts: readonly TextRect[], s: number, fixed: readonly Box[] = []): number {
  let n = 0;
  for (const x of texts) {
    const dx = x.axis === "y" ? 0 : s, dy = x.axis === "y" ? s : 0;
    let l = x.l - dx, t = x.t - dy;
    const r = l + x.w, b = t + x.h;
    if (x.shown) {
      const c = x.shown(s);
      if (c === null) continue;
      l = Math.max(l, c.x);
      t = Math.max(t, c.y);
      if (l >= r || t >= b) continue; // (cut past its own edge: none of it shows)
    }
    if (box.l < r && box.r > l && box.t < b && box.b > t) n++;
  }
  for (const f of fixed) if (box.l < f.r && box.r > f.l && box.t < f.b && box.b > f.t) n++;
  return n;
}

/**
 * Turns the shots' wanted layers into the layers the pendant may really be on, as a function of travel. Walking the samples
 * in `s` order: front is allowed only on a sample whose box hits nothing (otherwise back), and a change of layer must happen
 * at a sample whose box hits nothing. A switch to back that would land on a covered sample is moved to the closest
 * preceding clear sample, so the layer flips while the pendant is still clear of words. Since front only ever stands on
 * clear samples, that sample is always the one just before; where there is none (words covered from the very first sample)
 * there is no switch to place and the answer stays the safe one, back. A switch to front lands on its own (clear) sample.
 * The returned lookup holds a sample's layer until the next sample (binary search); before the first sample it answers the
 * first sample's layer, after the last the last's, and with no samples at all, back. Samples must be in ascending `s`.
 */
export function layerTimeline(samples: readonly Sample[], texts: readonly TextRect[], fixed: readonly Box[] = []): (s: number) => Layer {
  const n = samples.length;
  const xs = new Float64Array(n);
  const clear: boolean[] = new Array(n);
  const layer: Layer[] = new Array(n);
  for (let i = 0; i < n; i++) {
    xs[i] = samples[i].s;
    clear[i] = hits(samples[i].box, texts, samples[i].s, fixed) === 0;
    layer[i] = samples[i].wanted === "front" && clear[i] ? "front" : "back";
  }
  // A drop from front to back at a covered sample moves to the closest preceding clear sample (front stands only on clear
  // samples, so that is the previous one) and holds back from there.
  for (let i = 1; i < n; i++) {
    if (layer[i] === "back" && layer[i - 1] === "front" && !clear[i]) {
      let j = i - 1;
      while (j > 0 && !clear[j]) j--;
      if (clear[j]) for (let k = j; k < i; k++) layer[k] = "back";
    }
  }
  return (s: number): Layer => {
    if (n === 0) return "back";
    if (s <= xs[0]) return layer[0];
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) { // the last sample with xs <= s
      const mid = (lo + hi + 1) >> 1;
      if (xs[mid] <= s) lo = mid; else hi = mid - 1;
    }
    return layer[lo];
  };
}

/** The step the search moves in, as a share of the screen's width. */
const STEP = 0.01;

/**
 * The nearest horizontal nudge (a signed share of the screen width, to add to the shot's ax) that leaves the box on no text
 * at travel `s`, searched at +0.01, -0.01, +0.02, -0.02 ... up to `maxShift`. At equal distance the positive shift is tried
 * first. 0 if the box is already free; null if nothing within `maxShift` is. Fixed boxes block it as text does.
 */
export function freeSpot(
  box: Box, texts: readonly TextRect[], s: number, vw: number, maxShift: number, fixed: readonly Box[] = [],
): number | null {
  const free = (d: number): boolean => hits({ l: box.l + d * vw, r: box.r + d * vw, t: box.t, b: box.b }, texts, s, fixed) === 0;
  if (free(0)) return 0;
  for (let k = 1; k * STEP <= maxShift + 1e-9; k++) {
    const d = k * STEP;
    if (free(d)) return d;
    if (free(-d)) return -d;
  }
  return null;
}

// ---------- the free-spot search (Task 8, fix round 1): sideways, up or down, and smaller, searched together ----------

/** A box that overlaps nothing (every comparison with it fails). */
export const NOWHERE: Box = { l: -Infinity, t: -Infinity, r: -Infinity, b: -Infinity };

/** A box grown by `px` on every side. */
export function padBox(box: Box, px: number): Box {
  return { l: box.l - px, t: box.t - px, r: box.r + px, b: box.b + px };
}

/** The part of a box on screen; a box wholly off screen comes back as NOWHERE (what is past the edge covers nothing). */
export function clipBox(box: Box, vw: number, vh: number): Box {
  const l = Math.max(box.l, 0), r = Math.min(box.r, vw), t = Math.max(box.t, 0), b = Math.min(box.b, vh);
  return l < r && t < b ? { l, t, r, b } : NOWHERE;
}

/** The share of a box's area that is on screen (0 for an empty box). */
export function shownShare(box: Box, vw: number, vh: number): number {
  const area = (x: Box) => (x.r > x.l && x.b > x.t ? (x.r - x.l) * (x.b - x.t) : 0); // (NOWHERE included: no NaN)
  const full = area(box);
  return full > 0 ? area(clipBox(box, vw, vh)) / full : 0;
}

/** A change to a shot's resting spot: moved by `dx` / `dy` (shares of the screen's width / height) and scaled by `k`. */
export interface Spot { dx: number; dy: number; k: number }
export const SAME: Spot = { dx: 0, dy: 0, k: 1 };

/** One look at a shot at rest: the outline's box at travel `s`, the screen point it scales about (where the shot puts its aim,
 *  px), and the clearance it needs from every line (px). */
export interface Probe { s: number; box: Box; cx: number; cy: number; pad: number }

/** Where a probe's box lands with a spot: scaled by `k` about its aim point, then moved. */
export function placeBox(p: Probe, spot: Spot, vw: number, vh: number): Box {
  const { box, cx, cy } = p, { dx, dy, k } = spot;
  return {
    l: cx + (box.l - cx) * k + dx * vw, r: cx + (box.r - cx) * k + dx * vw,
    t: cy + (box.t - cy) * k + dy * vh, b: cy + (box.b - cy) * k + dy * vh,
  };
}

export interface SpotLimits {
  vw: number;
  vh: number;
  /** The furthest move sideways / up or down (share of the width / height). */
  maxX: number;
  maxY: number;
  /** The smallest scale. */
  minK: number;
  /** A change may hide at most this much more of the box past the screen's edge than the shot as written does... */
  edgeLoss: number;
  /** ...and must leave at least this share of it on screen. */
  minShown: number;
}

/** The search's grid: a hundredth of the screen for moves, five percent for scale. */
const MOVE_STEP = 0.01;
const SCALE_STEP = 0.05;

/** The search's candidates, nearest first (see findSpot), for a screen shape and reach: built once and kept. */
const grids = new Map<string, readonly Spot[]>();
function candidates(aspect: number, maxX: number, maxY: number, minK: number): readonly Spot[] {
  const key = `${aspect.toFixed(4)} ${maxX} ${maxY} ${minK}`;
  const kept = grids.get(key);
  if (kept) return kept;
  const n = (v: number) => Math.round(v / MOVE_STEP);
  const cands: (Spot & { cost: number })[] = [];
  for (let ix = -n(maxX); ix <= n(maxX); ix++) {
    for (let iy = -n(maxY); iy <= n(maxY); iy++) {
      for (let j = 0; 1 - j * SCALE_STEP >= minK - 1e-9; j++) {
        const dx = ix * MOVE_STEP, dy = iy * MOVE_STEP, k = Math.round((1 - j * SCALE_STEP) * 100) / 100;
        cands.push({ dx, dy, k, cost: Math.hypot(dx * aspect, dy) + (1 - k) });
      }
    }
  }
  cands.sort((a, b) => a.cost - b.cost || Math.abs(a.dx) - Math.abs(b.dx) || b.dx - a.dx || b.dy - a.dy || b.k - a.k);
  const out = cands.map(({ dx, dy, k }) => ({ dx, dy, k }));
  if (grids.size > 16) grids.clear();
  grids.set(key, out);
  return out;
}

/**
 * The nearest spot where the pendant covers no line and no fixed box at any of the probes (a shot's whole rest window at
 * once): moves up to `maxX` / `maxY` and scales down to `minK`, searched together, nearest first by one cost (the move's
 * length as a share of the screen's height, plus the scale given up). At equal cost the smaller sideways move, then right
 * before left, then down before up. The shot as written (SAME) comes first and needs no screen rule; any change must keep
 * `minShown` of the box on screen and lose at most `edgeLoss` to the edge. Null when nothing within the limits is clear.
 * Each probe's box is padded by its `pad` and clipped to the screen before it is tested.
 */
export function findSpot(probes: readonly Probe[], texts: readonly TextRect[], fixed: readonly Box[], lim: SpotLimits): Spot | null {
  const { vw, vh, maxX, maxY, minK, edgeLoss, minShown } = lim;
  if (probes.length === 0) return SAME;
  // only the lines and boxes some candidate could reach, per probe
  const reach = probes.map((p) => {
    const kx = Math.max(Math.abs(p.box.l - p.cx), Math.abs(p.box.r - p.cx));
    const ky = Math.max(Math.abs(p.box.t - p.cy), Math.abs(p.box.b - p.cy));
    const area = padBox({ l: p.cx - kx - maxX * vw, r: p.cx + kx + maxX * vw, t: p.cy - ky - maxY * vh, b: p.cy + ky + maxY * vh }, p.pad);
    return {
      texts: texts.filter((x) => hits(area, [x], p.s) > 0),
      fixed: fixed.filter((f) => hits(area, [], 0, [f]) > 0),
      shown: shownShare(p.box, vw, vh),
    };
  });
  const clear = (spot: Spot, same: boolean) => probes.every((p, i) => {
    const placed = placeBox(p, spot, vw, vh);
    if (!same) {
      const shown = shownShare(placed, vw, vh);
      if (shown < minShown || shown < reach[i].shown - edgeLoss) return false;
    }
    return hits(clipBox(padBox(placed, p.pad), vw, vh), reach[i].texts, p.s, reach[i].fixed) === 0;
  });
  for (const c of candidates(vw / vh, maxX, maxY, minK)) {
    const same = c.dx === 0 && c.dy === 0 && c.k === 1;
    if (clear(c, same)) return { dx: c.dx, dy: c.dy, k: c.k };
  }
  return null;
}
