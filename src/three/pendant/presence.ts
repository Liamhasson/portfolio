// src/three/pendant/presence.ts
/**
 * The pendant's presence on About (plan 2026-10-17-about-pendant-motion-pass, Task 1): how bright it is, which layer it is on
 * (in front of the words or behind them), stepped once a frame (the canvas's own fade is kept, always 1, for the mount). Pure: no DOM, no three.
 *   - Brightness eases toward the wanted dim with a time constant of BRIGHT_TAU, whatever the scroll speed: it never steps.
 *   - A layer change is always instant: the canvas never fades out (Liam, 2026-10-18: a fade dip read as the pendant
 *     vanishing for a moment). It is dim all through About, so a dim pendant flipping in front of or behind a line shows
 *     nothing worth hiding; a lit one (the build, the glass) sent behind dims quickly there instead, over BACK_TAU.
 *   - Hysteresis: a request to come in front is taken only once it has held for HOLD (on top of the mount's GUARD_HOLD). A
 *     request to go behind is taken at once (readability binds: a pendant asked behind is never left in front over a line to
 *     wait), and a request for the layer it is already on is taken at once (no new layer, so nothing to hold).
 *     So scrolling back and forth over a boundary swaps at most once per HOLD: no flicker.
 */
import type { Layer } from "./shots";

/** The brightness's time constant (s): each step closes 1 − e^(−dt/BRIGHT_TAU) of the gap. */
export const BRIGHT_TAU = 0.6;
/** Behind the words and brighter than wanted, the brightness's time constant (s): a lit pendant sent behind dims quickly. */
export const BACK_TAU = 0.12;
/** A request to come in front counts once it has held this long (s). */
export const HOLD = 0.1;

export type Presence = {
  layer: Layer;
  bright: number;
  /** The canvas's own 0..1: always 1 now (no fade dip, Liam 2026-10-18), kept for the mount and its diagnostics. */
  fade: number;
  /** The layer it is heading for (a request to come in front still holding); the layer itself when left out. */
  goal?: Layer;
  /** How long a request to come in front has held so far (s); 0 when left out. */
  pending?: number;
};

/**
 * One frame of `dt` seconds. `want.layer`: the layer asked for (the solve's timeline plus the live guard); `want.dim`: the
 * brightness wanted (the shot's dim, the forced dim behind the words, the outro); `want.overlapping`: whether the pendant's
 * outline overlaps a line right now (unpadded).
 */
export function stepPresence(p: Presence, want: { layer: Layer; dim: number; overlapping: boolean }, dt: number): Presence {
  // the goal: behind at once; the layer it is on at once (no new layer); in front only once that has held for HOLD
  let goal = p.goal ?? p.layer, pending = 0;
  if (want.layer === "back" || want.layer === p.layer) goal = want.layer;
  else if (goal !== want.layer) {
    pending = (p.pending ?? 0) + dt;
    if (pending >= HOLD - 1e-9) { goal = want.layer; pending = 0; }
  }
  // (an instant swap, always: the canvas's own fade stays whole)
  const layer = goal;
  const tau = layer === "back" && p.bright > want.dim ? BACK_TAU : BRIGHT_TAU;
  const bright = p.bright + (want.dim - p.bright) * (1 - Math.exp(-Math.max(dt, 0) / tau));
  return { layer, bright, fade: 1, goal, pending };
}

/** The brightness looks ahead along the travel for this long (s) at the pendant's own speed: about the time it takes to
 *  ease from full bright to within 0.05 of solve.ts FORCED_DIM (0.35 x ln(0.6 / 0.05) = 0.87 s). */
export const AHEAD_T = 0.9;
/** A stretch behind the words ahead counts only if it is at least this long (travel px): a blip of a sample or two (the
 *  solve's STEP is 8 px) is passed through in a frame or two, and dimming for it would dim a pendant that stays in front. */
export const MIN_BACK = 48;
/** The scan's step (travel px): the solve's own sample spacing. */
export const AHEAD_STEP = 8;

/**
 * Whether the pendant will be behind the words over them (`dimAt`: the mount asks the solve's timeline for behind, and its
 * rest outline for over a line), for a sustained stretch (MIN_BACK), within `lead` travel px of `s` in direction `dir` (+1
 * forward, -1 back, 0 at rest: never). The mount dims toward the behind level from then on, so a quick scroll reaches the
 * words already dimmed instead of slipping behind them bright. Behind but clear of the words, nothing shows, so it doesn't
 * count. `lead` shrinks to the follow's own lag as the scroll stops, so a pendant that comes to rest in front brightens again.
 */
export function behindAhead(dimAt: (s: number) => boolean, s: number, lead: number, dir: number): boolean {
  if (!(lead > 0) || dir === 0) return false;
  const d = Math.sign(dir);
  for (let x = AHEAD_STEP; x <= lead; x += AHEAD_STEP) {
    if (!dimAt(s + d * x)) continue;
    let run = AHEAD_STEP;
    while (run < MIN_BACK && dimAt(s + d * (x + run))) run += AHEAD_STEP;
    if (run >= MIN_BACK) return true;
    x += run; // (a blip: on past it)
  }
  return false;
}

/**
 * The follow's lag (track px: the page's travel minus the pendant's) the pendant will have once it reaches travel `x`, from
 * `s` with `lag` now: what is left of today's once it has caught up that far (the page held still), but never less than a
 * page still scrolling the same way keeps (`pageVel`, travel px per second, times the follow's time constant `tau`), and
 * never more than today's. The brightness's look ahead pairs each stretch ahead with the words where this lag puts them.
 */
export function lagAhead(x: number, s: number, lag: number, pageVel: number, tau: number): number {
  const now = Math.abs(lag);
  const keeps = Math.sign(pageVel) === Math.sign(lag) ? Math.min(Math.abs(pageVel) * tau, now) : 0;
  return Math.sign(lag) * Math.max(keeps, now - Math.abs(x - s));
}
