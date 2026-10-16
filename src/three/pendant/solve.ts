// src/three/pendant/solve.ts
/**
 * Readability, solved per screen (spec 2026-10-16-about-pendant-design.md §5; plan Task 8). At layout time (never per frame)
 * the mount hands this the measured words and chrome; it walks the whole track every STEP px of travel, poses a scratch copy
 * of the rig at rest for each sample (motion.ts REST, no cursor lean, no drift: camera.ts `still`), and from the pendant's
 * projected boxes works out
 *   1. a sideways nudge per shot (a share of the screen's width added to the shot's `ax`): a shot that wants to be in front
 *      of the words but whose resting spot covers a line or a piece of chrome moves to the nearest clear spot within
 *      MAX_SHIFT (layout.ts `freeSpot`'s search, over every sample of the shot's rest window at once). A nudge that pushes
 *      the pendant off the screen is no spot at all: it may hide at most EDGE_LOSS more of the box past the screen's edge
 *      than the shot itself does (the hero is cut by the left edge by design; it is not cut further to dodge a line);
 *   2. the layer timeline (layout.ts `layerTimeline`): in front only where the box covers nothing, switching only where it
 *      is clear. A shot no nudge can clear goes behind the words (the mount then dims it, FORCED_DIM there).
 * The box at each sample is the union over the turns the pendant can show there (it spins: its section is square-ish, so its
 * outline is narrowest face-on and widest at 45 degrees, and the box at those two yaws holds every yaw between; a locked face
 * uses the lock; a tumbling one adds four pitches), grown by GROW to cover the
 * breathing, the lean into the scroll and the cursor's lean, then clipped to the screen (what is past the edge covers
 * nothing anyone can read).
 */
import { Object3D, PerspectiveCamera, type Box3 } from "three";
import { poseRig, screenBox, type Box } from "./camera";
import { hits, layerTimeline, type Sample, type TextRect } from "./layout";
import { REST } from "./motion";
import { shotAt, type Frame, type Layer, type Shot } from "./shots";

/** Px of travel between samples. */
export const STEP = 8;
/** How much the box grows (a share of its width and height, half on each side) to cover the breathing, spin and leans. */
export const GROW = 0.03;
/** The furthest a shot is nudged sideways (a share of the screen's width) before it goes behind the words instead. */
export const MAX_SHIFT = 0.25;
/** The most a nudge may add to the share of the pendant's box past the screen's edge. */
export const EDGE_LOSS = 0.25;
/** A shot is at rest where its blend is this close to it (smoothstep t at or below this, or at or above 1 minus it). */
export const REST_T = 0.02;
/** Brightness of a shot that wanted to be in front but is solved behind the words (the tumble's own dim, Liam 2026-10-16). */
export const FORCED_DIM = 0.4;

const D = Math.PI / 180;
const YAWS = [0, 45].map((d) => d * D);
const PITCHES = [0, 45, 90, 135].map((d) => d * D);
/** Below this many turns per second the motion rights the pendant (motion.ts TUMBLE_OFF). */
const TUMBLE_OFF = 0.02;
const NOWHERE: Box = { l: -Infinity, t: -Infinity, r: -Infinity, b: -Infinity };
const NO_LOOK = { x: 0, y: 0 };

export interface SolveInput {
  shots: readonly Shot[];
  keys: readonly number[];
  travel: number;
  vw: number;
  vh: number;
  /** The live screen spots for the "line1" and "glass" aims at travel `s`. */
  at: (s: number) => { line1: number; glass: { x: number; y: number } };
  /** The words: `l` in track px, `t` in the pinned frame's px. */
  texts: readonly TextRect[];
  /** The chrome that holds still on screen, in the pinned frame's px. */
  fixed: readonly Box[];
  /** The model's bounds in `inner`'s space (scene.ts). */
  bounds: Box3;
}

export interface Solved {
  /** Per shot: the share of the screen's width added to its `ax` on this screen (0 = where the shot puts it). */
  shift: number[];
  /** The layer at travel `s`. */
  layer: (s: number) => Layer;
  /** The shots that want to be in front, nudged: their id and nudge. */
  moved: { id: string; dx: number }[];
  /** The shots that want to be in front but rest behind the words on this screen (no nudge within MAX_SHIFT clears them). */
  behind: string[];
}

/** Adds the per-shot nudges to a frame's `ax`, blended exactly as shotAt blends `ax` (so it equals nudging the shots). */
export function shiftAx(f: Frame, shift: readonly number[]): void {
  if (shift.length === 0) return;
  const a = shift[f.index] ?? 0;
  const b = shift[Math.min(f.index + 1, shift.length - 1)] ?? 0;
  f.ax += f.t <= 0 ? a : f.t >= 1 ? b : a + (b - a) * f.t;
}

/** A box grown by `grow` of its size (half on each side), moved `dx` px sideways, and clipped to the screen. A box wholly off
 *  screen comes back as one that overlaps nothing. */
export function onScreen(box: Box, vw: number, vh: number, grow = 0, dx = 0): Box {
  const gx = ((box.r - box.l) * grow) / 2, gy = ((box.b - box.t) * grow) / 2;
  const l = Math.max(box.l - gx + dx, 0), r = Math.min(box.r + gx + dx, vw);
  const t = Math.max(box.t - gy, 0), b = Math.min(box.b + gy, vh);
  return l < r && t < b ? { l, t, r, b } : NOWHERE;
}

interface At { s: number; f: Frame; box: Box }

/** Solves one screen. Pure apart from its scratch rig: the same input always gives the same answer. */
export function solve(input: SolveInput): Solved {
  const { shots, keys, travel, vw, vh, at, texts, fixed, bounds } = input;
  const camera = new PerspectiveCamera();
  const outer = new Object3D(), inner = new Object3D();
  outer.add(inner);

  // the samples: every STEP px, both ends, and every key exactly (a shot's own rest)
  const ss = new Set<number>();
  for (let s = 0; s < travel; s += STEP) ss.add(s);
  ss.add(Math.max(travel, 0));
  for (const k of keys) if (k >= 0 && k <= travel) ss.add(k);
  const xs = [...ss].sort((a, b) => a - b);

  /** The raw (unclipped, ungrown) box at `s` with these nudges: the union over the turns the pendant can show there. */
  const sample = (s: number, shift: readonly number[]): At => {
    const f = shotAt(s, keys, shots, at(s));
    shiftAx(f, shift);
    const yaws = f.lock !== null ? [f.lock * D] : YAWS;
    const pitches = f.tumble > TUMBLE_OFF ? PITCHES : [0];
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (const yaw of yaws) {
      for (const pitch of pitches) {
        poseRig(f, { ...REST, yaw, pitch }, 0, NO_LOOK, vw, vh, camera, outer, inner, { still: true });
        const x = screenBox(bounds, inner, camera, vw, vh);
        if (x.l < l) l = x.l;
        if (x.t < t) t = x.t;
        if (x.r > r) r = x.r;
        if (x.b > b) b = x.b;
      }
    }
    return { s, f, box: { l, t, r, b } };
  };
  const covers = (a: At, dx = 0) => hits(onScreen(a.box, vw, vh, GROW, dx), texts, a.s, fixed) > 0;
  /** The share of the box on screen, moved `dx` px. */
  const shown = (a: At, dx = 0) => {
    const area = (x: Box) => Math.max(x.r - x.l, 0) * Math.max(x.b - x.t, 0);
    const full = area(a.box);
    return full > 0 ? area(onScreen(a.box, vw, vh, 0, dx)) / full : 0;
  };

  const none = shots.map(() => 0);
  const first = xs.map((s) => sample(s, none));

  // 1. the nudges: each front shot's rest window must be clear at one and the same nudge
  const last = shots.length - 1;
  const shift = shots.map(() => 0);
  const moved: Solved["moved"] = [];
  shots.forEach((shot, i) => {
    if (shot.layer !== "front") return;
    const win = first.filter(({ f }) =>
      (f.index === i && (f.t <= REST_T || i === last)) || (f.index === i - 1 && f.t >= 1 - REST_T));
    if (win.length === 0 || !win.some((a) => covers(a))) return;
    for (let k = 1; k * 0.01 <= MAX_SHIFT + 1e-9; k++) {
      for (const d of [k * 0.01, -k * 0.01]) { // (as freeSpot: nearest first, the positive side first at equal distance)
        if (win.every((a) => !covers(a, d * vw) && shown(a, d * vw) >= shown(a) - EDGE_LOSS)) {
          shift[i] = d;
          moved.push({ id: shot.id, dx: d });
          return;
        }
      }
    }
  });

  // 2. the layers, from the boxes as nudged (only the samples a nudged shot reaches are posed again)
  const nudged = (f: Frame) => shift[f.index] !== 0 || shift[Math.min(f.index + 1, last)] !== 0;
  const final = first.map((a) => (nudged(a.f) ? sample(a.s, shift) : a));
  const samples: Sample[] = final.map(({ s, f, box }) => ({ s, wanted: f.layer, box: onScreen(box, vw, vh, GROW) }));
  const layer = layerTimeline(samples, texts, fixed);
  const behind = shots.filter((sh, i) => sh.layer === "front" && keys[i] >= 0 && keys[i] <= travel && layer(keys[i]) === "back").map((sh) => sh.id);
  return { shift, layer, moved, behind };
}
