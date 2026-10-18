// src/three/pendant/solve.ts
/**
 * Readability, solved per screen (spec 2026-10-16-about-pendant-design.md §5; plan Task 8). At layout time (never per frame)
 * the mount hands this the measured lines and chrome; it walks the whole track every STEP px of travel, poses a scratch copy
 * of the rig at rest for each sample (motion.ts REST, no cursor lean, no drift: camera.ts `still`), projects the pendant's
 * real outline (the wire copy's vertices, outlineOf) and from those boxes works out
 *   1. each front shot's resting spot on this screen: the shot as written, else its nearest clear spot (layout.ts findSpot:
 *      moved up to MAX_X / MAX_Y and scaled down to MIN_K together, kept on screen; the glass shot, pinned to the ball, may
 *      only scale), else the same for each of its
 *      alternates (shots.ts `alt`) in order; only if none clears does it rest behind the words (the mount dims it there);
 *   2. the layer timeline (layout.ts layerTimeline): in front only where the outline is clear, switching only where clear.
 * "Clear" means clear by the motion's own reach (camera.ts motionMargin: the drift, the cursor's lean at the screen's edge,
 * the breathing) plus PAD, so the live pendant can move all it does without touching a line; the mount's live guard backs
 * this up and only steps in past PAD / 2.
 * The outline at a sample: a spinning pendant shows every side, so its spin-proof outline is used (the wire copy turned
 * about its axis: `ring`); a face locked to the camera (the hero) uses all its real vertices at the lock (`all`); a tumbling one
 * adds four pitches. Boxes are clipped to the screen: what is past the edge covers nothing anyone can read.
 */
import { Object3D, PerspectiveCamera } from "three";
import { motionMargin, outlineBox, poseRig, reachOf, type Box } from "./camera";
import { clipBox, findSpot, hits, layerTimeline, padBox, SAME, type Probe, type Sample, type Spot, type TextRect } from "./layout";
import { REST } from "./motion";
import { RIDE_STEADY, rideShift, shotAt, shotLayer, smootherstep, variants, type Frame, type Layer, type Shot } from "./shots";

/** Px of travel between samples. */
export const STEP = 8;
/** Clearance (px) kept beyond the motion's reach; the live guard steps in at half of it. */
export const PAD = 8;
/** The free-spot search's reach: a share of the width sideways, of the height up or down, and the smallest scale. */
export const MAX_X = 0.25;
export const MAX_Y = 0.2;
export const MIN_K = 0.7;
/** A change may hide at most this much more of the pendant past the screen's edge than its shot does... */
export const EDGE_LOSS = 0.25;
/** ...and must leave at least this much of it on screen (else the shot goes behind the words instead). */
export const MIN_SHOWN = 0.35;
/** A shot is at rest within this share of the travel from its key (on either side): about 8.4% of the gap to the next. */
export const REST_U = 0.084;
/** ...which is where the blend (smootherstep t) is this close to it: at or below this, or at or above 1 minus it. (The
 *  window kept where smoothstep's t 0.02 had it, 2026-10-18: a gentler curve leaves the pose closer to the shot for longer,
 *  but the stretch the solve clears as the shot at rest stays the same, so no shot's rest gets harder to clear.) */
export const REST_T = smootherstep(REST_U);
/** At most this many samples of a rest window are tested (evenly spread, the key always among them). */
const PROBES = 9;
/** Brightness of a shot that wanted to be in front but rests behind the words (the tumble's own dim, Liam 2026-10-16). */
export const FORCED_DIM = 0.4;

const D = Math.PI / 180;
/** Faces posed between the one a turning lock left and the one it asks now (see `sample`). */
const TURN_STEPS = 4;
/** The shortest way round from angle `a` to `b` (degrees), in [-180, 180). */
const arcDeg = (a: number, b: number) => ((((b - a) % 360) + 540) % 360) - 180;
const PITCHES = [0, 45, 90, 135].map((d) => d * D);
/** Below this many turns per second the motion rights the pendant (motion.ts TUMBLE_OFF). */
const TUMBLE_OFF = 0.02;
const NO_LOOK = { x: 0, y: 0 };

/** The pendant's outline, three ways (xyz triples in `inner`'s space). */
export interface Outline {
  /** Every vertex of the wire copy (for a set yaw, at solve time). */
  all: Float32Array;
  /** Spin-proof: rings round the pendant's axis, as wide at each height as the widest vertex there (any yaw fits inside). */
  ring: Float32Array;
  /** Real vertices, a few hundred: the outermost at each height and side (and the very top and bottom). For a set yaw. */
  hull: Float32Array;
}

const BANDS = 24;
const SIDES = 24;
const RING_SIDES = 12;

/** Builds the outline from the wire copy's vertices (scene.ts `outline`). */
export function outlineOf(points: Float32Array): Outline {
  const n = Math.floor(points.length / 3);
  if (n === 0) return { all: points, ring: new Float32Array(0), hull: new Float32Array(0) };
  let y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < n; i++) { const y = points[i * 3 + 1]; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const span = Math.max(y1 - y0, 1e-9);
  const band = (y: number) => Math.min(BANDS - 1, Math.floor(((y - y0) / span) * BANDS));
  const R = new Float64Array(BANDS);
  const best = new Int32Array(BANDS * SIDES).fill(-1);
  const bestR = new Float64Array(BANDS * SIDES);
  let top = 0, bottom = 0;
  for (let i = 0; i < n; i++) {
    const x = points[i * 3], y = points[i * 3 + 1], z = points[i * 3 + 2];
    const r = Math.hypot(x, z), b = band(y);
    if (r > R[b]) R[b] = r;
    const side = Math.min(SIDES - 1, Math.floor(((Math.atan2(z, x) + Math.PI) / (2 * Math.PI)) * SIDES));
    const c = b * SIDES + side;
    if (best[c] < 0 || r > bestR[c]) { best[c] = i; bestR[c] = r; }
    if (y > points[top * 3 + 1]) top = i;
    if (y < points[bottom * 3 + 1]) bottom = i;
  }
  // a band with no vertex lies on edges between the bands round it: no wider than the wider of its nearest filled ones
  const has = Array.from(R, (r) => r > 0);
  for (let j = 0; j < BANDS; j++) {
    if (has[j]) continue;
    let lo = j - 1, hi = j + 1;
    while (lo >= 0 && !has[lo]) lo--;
    while (hi < BANDS && !has[hi]) hi++;
    R[j] = Math.max(lo >= 0 ? R[lo] : 0, hi < BANDS ? R[hi] : 0);
  }
  // rings at every band edge, as wide as the bands either side, on a polygon drawn round the circle (it holds the circle)
  const ring: number[] = [];
  const out = 1 / Math.cos(Math.PI / RING_SIDES);
  for (let j = 0; j <= BANDS; j++) {
    const r = Math.max(j > 0 ? R[j - 1] : 0, j < BANDS ? R[j] : 0) * out;
    const y = y0 + (span * j) / BANDS;
    for (let a = 0; a < RING_SIDES; a++) {
      const t = (a / RING_SIDES) * 2 * Math.PI;
      ring.push(r * Math.cos(t), y, r * Math.sin(t));
    }
  }
  const hull: number[] = [];
  const keep = new Set<number>([top, bottom]);
  for (const i of best) if (i >= 0) keep.add(i);
  for (const i of keep) hull.push(points[i * 3], points[i * 3 + 1], points[i * 3 + 2]);
  return { all: points, ring: new Float32Array(ring), hull: new Float32Array(hull) };
}

export interface SolveInput {
  shots: readonly Shot[];
  keys: readonly number[];
  travel: number;
  vw: number;
  vh: number;
  /** The live screen spots for the "line1" and "glass" aims at travel `s`. */
  at: (s: number) => { line1: number; glass: { x: number; y: number }; line1Y?: number };
  /** The lines of text: `l` in track px, `t` in the pinned frame's px. */
  texts: readonly TextRect[];
  /** The chrome that holds still on screen, in the pinned frame's px. */
  fixed: readonly Box[];
  outline: Outline;
  /** The cursor's lean at the screen's edge (radians: the mount's LOOK). */
  lookMax: number;
}

export interface Solved {
  /** The shots as solved on this screen: each as written or as the alternate chosen. */
  shots: Shot[];
  /** Per shot: the resting spot's change (shares of the width / height, and a scale of its size). */
  spots: Spot[];
  /** The layer at travel `s`. */
  layer: (s: number) => Layer;
  /** Whether the pendant at rest at travel `s`, grown only by the live guard's PAD / 2 (not the motion's reach), is over a
   *  line or the chrome: where being behind the words shows, so where the mount's brightness looks ahead to (presence.ts
   *  behindAhead). Each sample's answer holds until the next. */
  over: (s: number) => boolean;
  /** The same with `lag` (track px: the page's travel minus the pendant's, the follow trailing a scroll): the lines taken
   *  anywhere between where they are at `s` and where they are `lag` further along. The live pendant is drawn at the eased
   *  travel while the words ride the page, so during a scroll it meets lines the rest pairing never does, and the live guard
   *  sends it behind them there; the look ahead counts those too (in a front stretch as well), so the pendant is already
   *  dimmed when it gets there. (A pendant aimed at the glass rides partly with the page: its shift is inside that range.)
   *  `grow` (px a side, each at most half the box's longer side): the box grown first by what the live pendant reaches past
   *  its rest outline (`rest`), which the rest pairing leaves out: chiefly the lean into a scroll (motion.ts LEAN: a pendant
   *  lying along the top, the glide, tilted reaches tens of px further up and down); the chrome counts then as well. */
  overLagging: (s: number, lag: number, grow?: Box) => boolean;
  /** The pendant at rest at travel `s` as `over` takes it: its outline grown by PAD / 2 (not clipped to the screen: a part
   *  past the edge now may come on screen further along, and what reaches past it with it). */
  rest: (s: number) => Box;
  /** The front shots whose rest was changed: the alternate used (0 = as written) and the spot. */
  moved: { id: string; alt: number; dx: number; dy: number; k: number }[];
  /** The front shots that rest behind the words on this screen (nothing within the limits clears them). */
  behind: string[];
}

/** Adds the per-shot spots to a frame, blended exactly as shotAt blends `ax`, `ay` and `h` between the two shots. */
export function applySpot(f: Frame, spots: readonly Spot[]): void {
  if (spots.length === 0) return;
  const a = spots[f.index] ?? SAME;
  const b = spots[Math.min(f.index + 1, spots.length - 1)] ?? SAME;
  const mix = (p: number, q: number) => (f.t <= 0 ? p : f.t >= 1 ? q : p + (q - p) * f.t);
  f.ax += mix(a.dx, b.dx);
  f.ay += mix(a.dy, b.dy);
  f.h *= mix(a.k, b.k);
}

/** The clearance (px) the solve keeps round a held outline `box` whose aim sits at (cx, cy): the motion's reach plus PAD. */
export function clearance(f: Frame, box: Box, cx: number, cy: number, vh: number, lookMax: number): number {
  return motionMargin(f.fov, reachOf(box, cx, cy), vh, lookMax) + PAD;
}

interface At extends Probe { f: Frame }

/** Solves one screen. Pure apart from its scratch rig: the same input always gives the same answer. */
export function solve(input: SolveInput): Solved {
  const { keys, travel, vw, vh, at, texts, fixed, outline, lookMax } = input;
  const camera = new PerspectiveCamera();
  const outer = new Object3D(), inner = new Object3D();
  outer.add(inner);

  // the samples: every STEP px, both ends, and every key exactly (a shot's own rest)
  const ss = new Set<number>();
  for (let s = 0; s < travel; s += STEP) ss.add(s);
  ss.add(Math.max(travel, 0));
  for (const k of keys) if (k >= 0 && k <= travel) ss.add(k);
  const xs = [...ss].sort((a, b) => a - b);

  /** The outline's box at `s` (unpadded, unclipped), its aim point on screen and the clearance it needs. */
  const sample = (s: number, shots: readonly Shot[], spots: readonly Spot[]): At => {
    const f = shotAt(s, keys, shots, at(s));
    applySpot(f, spots);
    // (a face turning toward its lock or letting go of it may face any way: every yaw (`ring`) while the lock is easing in
    // or out; the locked face's own outline only where it holds, which is the locked shot's rest window, the stretch the
    // solve takes as that shot at rest: there the lock has settled the face. Between two different locks (buildEnd to the
    // hero, 0 to -62) the lock itself turns, faster than its pull can follow on a quick scroll, so the face drawn trails it
    // mid-blend (by about 30 degrees at 1500 px/s): there, outside the two rest windows, every face from the one the
    // blend left to the one it asks now (TURN_STEPS of them), so a trailing face is inside the outline.)
    const A = shots[f.index], B = shots[Math.min(f.index + 1, shots.length - 1)];
    const turning = A !== B && A.lock !== null && B.lock !== null && A.lock !== B.lock && f.t > REST_T && f.t < 1 - REST_T;
    const locked = f.lock !== null && f.lockMix >= 1 - REST_T;
    const pts = locked ? outline.all : outline.ring;
    const yaws = !locked ? [0] : !turning ? [(f.lock as number) * D]
      : Array.from({ length: TURN_STEPS + 1 }, (_, k) => ((A.lock as number) + (k / TURN_STEPS) * arcDeg(A.lock as number, f.lock as number)) * D);
    const pitches = f.tumble > TUMBLE_OFF ? PITCHES : [0];
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (const yaw of yaws) for (const pitch of pitches) {
      poseRig(f, { ...REST, yaw, pitch }, 0, NO_LOOK, vw, vh, camera, outer, inner, { still: true });
      const x = outlineBox(pts, inner, camera, vw, vh);
      if (x.l < l) l = x.l;
      if (x.t < t) t = x.t;
      if (x.r > r) r = x.r;
      if (x.b > b) b = x.b;
    }
    const box = { l, t, r, b }, cx = f.ax * vw, cy = f.ay * vh;
    return { s, f, box, cx, cy, pad: clearance(f, box, cx, cy, vh, lookMax) };
  };
  const covered = (a: At) => hits(clipBox(padBox(a.box, a.pad), vw, vh), texts, a.s, fixed) > 0;

  const shots = [...input.shots];
  const spots: Spot[] = shots.map(() => SAME);
  const first = xs.map((s) => sample(s, shots, spots));
  const last = shots.length - 1;
  const inWindow = (f: Frame, i: number) => (f.index === i && (f.t <= REST_T || i === last)) || (f.index === i - 1 && f.t >= 1 - REST_T);
  /** A rest window's samples, at most PROBES of them, evenly spread with the key (the middle one) kept. */
  const spread = (win: At[]): At[] => {
    if (win.length <= PROBES) return win;
    return Array.from({ length: PROBES }, (_, j) => win[Math.round((j * (win.length - 1)) / (PROBES - 1))]);
  };

  // 1. each front shot's rest on this screen
  const moved: Solved["moved"] = [];
  const unsolved: number[] = [];
  input.shots.forEach((shot, i) => {
    if (shot.layer !== "front") return;
    const win0 = first.filter((a) => inWindow(a.f, i));
    if (win0.length === 0 || !win0.some(covered)) return;
    const vs = variants(shot);
    for (let v = 0; v < vs.length; v++) {
      const trial = shots.map((s, j) => (j === i ? vs[v] : s));
      const win = v === 0 ? win0 : win0.map((a) => sample(a.s, trial, spots));
      // (a shot pinned to a live place in the page, the glass ball between the quotes, may only grow smaller: moved, it
      // would no longer be seen through the ball)
      // (and so may a shot riding with the page: the stacked opening in the gap above the first line)
      const pinned = (typeof vs[v].ax === "string" && vs[v].ax !== "line1") || typeof vs[v].ay === "string";
      const spot = findSpot(spread(win), texts, fixed, {
        vw, vh, maxX: pinned ? 0 : MAX_X, maxY: pinned ? 0 : MAX_Y, minK: MIN_K, edgeLoss: EDGE_LOSS, minShown: MIN_SHOWN,
      });
      if (spot) {
        shots[i] = vs[v];
        spots[i] = spot;
        moved.push({ id: shot.id, alt: v, ...spot });
        return;
      }
    }
    unsolved.push(i);
  });

  // 2. the layers, from the outlines as solved (only the samples a changed shot reaches are posed again)
  const changed = shots.map((s, i) => s !== input.shots[i] || spots[i] !== SAME);
  const touches = (f: Frame) => changed[f.index] || changed[Math.min(f.index + 1, last)];
  const final = first.map((a) => (touches(a.f) ? sample(a.s, shots, spots) : a));
  const samples: Sample[] = final.map((a) => ({ s: a.s, wanted: shotLayer(a.f, shots), box: clipBox(padBox(a.box, a.pad), vw, vh) }));
  const layer = layerTimeline(samples, texts, fixed);
  const xs2 = final.map((a) => a.s);
  const restBox = final.map((a) => padBox(a.box, PAD / 2)); // (unclipped: `rest`, and what a reach past it grows)
  const tightBox = restBox.map((b) => clipBox(b, vw, vh));
  const tight = final.map((a, j) => hits(tightBox[j], texts, a.s, fixed) > 0);
  /** The sample holding at `s` (each holds until the next; before the first, the first). */
  const sampleAt = (s: number): number => {
    let lo = 0, hi = xs2.length - 1;
    if (s <= xs2[0]) return 0;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (xs2[mid] <= s) lo = mid; else hi = mid - 1; }
    return lo;
  };
  const over = (s: number): boolean => xs2.length > 0 && tight[sampleAt(s)];
  /** Per sample, the lines `overLagging` can meet there, as plain numbers (l, t, r, b, and 1 for a line riding the y axis):
   *  those across the box's other axis, the box grown by the most a lean can add (a sweep along the way a line rides never
   *  changes that), worked out once each. */
  const reach: (Float64Array | undefined)[] = [];
  const reachOf = (j: number): Float64Array => {
    const had = reach[j];
    if (had) return had;
    const r0 = restBox[j], g = Math.max(r0.r - r0.l, r0.b - r0.t) / 2;
    const b = { l: r0.l - g, t: r0.t - g, r: r0.r + g, b: r0.b + g }, at = xs2[j], out: number[] = [];
    for (const x of texts) {
      const alongY = x.axis === "y";
      let l = x.l - (alongY ? 0 : at), t = x.t - (alongY ? at : 0);
      const r = l + x.w, bt = t + x.h;
      if (x.shown) {
        const c = x.shown(at);
        if (c === null) continue;
        l = Math.max(l, c.x);
        t = Math.max(t, c.y);
        if (l >= r || t >= bt) continue; // (cut past its own edge: none of it shows)
      }
      if (alongY ? b.l < r && b.r > l : b.t < bt && b.b > t) out.push(l, t, r, bt, alongY ? 1 : 0);
    }
    return (reach[j] = Float64Array.from(out));
  };
  const overLagging = (s: number, lag: number, grow?: Box): boolean => {
    if (xs2.length === 0) return false;
    const j = sampleAt(s), t0 = tightBox[j], r0 = restBox[j];
    // (a shot riding with the page, shots.ts `ride`, is carried that much of the lag with the words, at a steady scroll
    // RIDE_STEADY of it: only the rest trails)
    lag -= rideShift(final[j].f.ride * RIDE_STEADY, lag, vw);
    const cap = Math.max(r0.r - r0.l, r0.b - r0.t) / 2, g = (v: number) => Math.min(Math.max(v, 0), cap);
    const gl = g(grow?.l ?? 0), gt = g(grow?.t ?? 0), gr = g(grow?.r ?? 0), gb = g(grow?.b ?? 0);
    const grown = gl + gt + gr + gb >= 0.5;
    if (tight[j] || (Math.abs(lag) < 0.5 && !grown)) return tight[j];
    const b = grown ? clipBox({ l: r0.l - gl, t: r0.t - gt, r: r0.r + gr, b: r0.b + gb }, vw, vh) : t0;
    if (b.r <= b.l || b.b <= b.t) return false; // (off screen)
    if (grown && hits(b, [], 0, fixed) > 0) return true; // (grown onto the chrome, which holds still)
    // lines `lag` further along sit `lag` back on screen: the box swept `lag` forward (along the way each line rides) meets
    // every one in between. (layout.ts `hits` with plain numbers, and only the lines across the box at its most grown: the
    // look ahead asks this many times a frame.)
    const lo = Math.min(0, lag), hi = Math.max(0, lag), xs = reachOf(j);
    for (let k = 0; k < xs.length; k += 5) {
      const y = xs[k + 4] === 1;
      if (y
        ? b.l < xs[k + 2] && b.r > xs[k] && b.t + lo < xs[k + 3] && b.b + hi > xs[k + 1]
        : b.t < xs[k + 3] && b.b > xs[k + 1] && b.l + lo < xs[k + 2] && b.r + hi > xs[k]) return true;
    }
    return false;
  };
  const behind = input.shots
    .filter((sh, i) => sh.layer === "front" && keys[i] >= 0 && keys[i] <= travel && (unsolved.includes(i) || layer(keys[i]) === "back"))
    .map((sh) => sh.id);
  const rest = (s: number): Box => (xs2.length > 0 ? restBox[sampleAt(s)] : { l: 0, t: 0, r: 0, b: 0 });
  return { shots, spots, layer, over, overLagging, rest, moved, behind };
}
