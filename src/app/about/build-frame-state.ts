// src/app/about/build-frame-state.ts
/**
 * The construction frame's state (plan 2026-10-18-about-round3, Tasks 3 and 4): the pendant's mount writes it every frame
 * of the build sequence (Task 3: the flight, the snap, the frame's grow, the locked build, the retract), and the frame
 * (build-frame.tsx, Task 4) reads it and redraws its SVG. A module-level store, like `src/lib/about-glass.ts`: no React, no
 * DOM. A set that changes nothing tells nobody, so the held build (the same state frame after frame) costs no redraw.
 *
 * Who owns what:
 *   - Task 3 owns the clock: `grow` is the snap's completion as a plain linear fraction of the grow's 0.6 s (0 at the snap,
 *     1 once 0.6 s have passed; scrolling back past the snap runs it back down). `retract` is linear in the scroll.
 *   - Task 4 owns the curves: the frame eases both itself (build-frame.tsx `GROW_EASE`, `retractParts`), so the writer
 *     never eases.
 */

export type FramePhase = "flight" | "snap" | "grow" | "build" | "retract" | null;
export type FrameState = {
  phase: FramePhase;
  /** the locked pendant's centre on screen, CSS px */
  cx: number; cy: number;
  /** the frame's full size, CSS px (size "i": the pendant's box minus the crown's break-out above) */
  w: number; h: number;
  /** 0..1, linear in time after the snap (Task 3's clock; the frame eases it) */
  grow: number;
  /** 0..1, scrubbed by scroll at the build's end (linear; the frame eases it) */
  retract: number;
};

const EMPTY: FrameState = { phase: null, cx: 0, cy: 0, w: 0, h: 0, grow: 0, retract: 0 };
/** The store's own copy, written in place (the caller may reuse its object). */
const state: FrameState = { ...EMPTY };
const listeners = new Set<() => void>();

const clamp01 = (x: number) => (x > 0 ? (x < 1 ? x : 1) : 0);

/** The frame's state this frame. Fields are copied in (grow and retract clamped to 0..1); the subscribers hear of it only
 *  if something changed. */
export function setFrameState(s: FrameState): void {
  const grow = clamp01(s.grow), retract = clamp01(s.retract);
  if (s.phase === state.phase && s.cx === state.cx && s.cy === state.cy && s.w === state.w && s.h === state.h && grow === state.grow && retract === state.retract) return;
  state.phase = s.phase; state.cx = s.cx; state.cy = s.cy; state.w = s.w; state.h = s.h; state.grow = grow; state.retract = retract;
  listeners.forEach((fn) => fn());
}

/** The state as last set: the store's own object, read-only (the next set rewrites it). */
export function getFrameState(): Readonly<FrameState> {
  return state;
}

/** Hears every change. Returns the unsubscribe. */
export function subscribeFrame(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Tests only: back to no frame, and nobody listening (the store is global: a test must not leak into the next). */
export function resetFrameForTests(): void {
  Object.assign(state, EMPTY);
  listeners.clear();
}
