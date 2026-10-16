// src/three/pendant/layout.ts
/**
 * Readability (spec 2026-10-16-about-pendant-design.md §5): while you read a line, the pendant never sits on top of it.
 * Pure rules, no DOM and no three: where the pendant's screen box overlaps a text, which layer (in front of the words or
 * behind them) it may be on at each point of the scroll, and where to nudge a shot whose spot is taken.
 * Coordinates: a text's `l` is in TRACK px (the sideways track's own x, before it moves) and its `t` is viewport px (the
 * track only moves sideways). At travel `s` (px of the track gone by) a text's screen left is `l - s`. Boxes are screen px.
 * `fixed` boxes are what holds still on screen while the track moves (the site's wordmark and pill nav, About's resume pill
 * and progress bar): screen px, never shifted by `s`, and treated exactly like text (the pendant is never in front over one).
 */
import type { Box } from "./camera";
import type { Layer } from "./shots";

/** A text block: `l` in track px, `t` in viewport px, `w` and `h` its size. */
export interface TextRect { l: number; t: number; w: number; h: number }
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
    const l = x.l - s;
    if (box.l < l + x.w && box.r > l && box.t < x.t + x.h && box.b > x.t) n++;
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
