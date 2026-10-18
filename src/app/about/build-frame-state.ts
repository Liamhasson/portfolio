// src/app/about/build-frame-state.ts
/**
 * The construction frame's state (plan 2026-10-18-about-round3, Tasks 3 and 4): the pendant's mount writes it every frame
 * of the build sequence (Task 3: the flight, the snap, the frame's grow, the locked build, the retract), and the frame
 * (build-frame.tsx, Task 4) reads it and redraws its SVG. A module-level store, like `src/lib/about-glass.ts`: no React, no
 * DOM. A set that changes nothing tells nobody, so the held build (the same state frame after frame) costs no redraw.
 *
 * What the numbers mean (for whoever writes them):
 *   - `cx`, `cy` are THE FRAME's centre on screen, and that is the point the pendant's pivot (its aim point, the point the
 *     camera aims at in the locked shot) is locked to. It is NOT the centre of the pendant's bounding box on screen.
 *   - `w`, `h` are the frame's own full size, not the pendant's.
 *   - The vertical relation at size "i" (mockup still i-2, 1440 x 900, clip/frame/frames/frame-i-2-y10200.jpg, measured on
 *     its pixels: loop top 107, frame top 227, base 648, frame bottom 672, CSS px): the crown and loop break out of the top
 *     edge, the loop's top about 90–120 px above the frame's top (120 in that still); the base sits inside the bottom edge
 *     (about 25 px clear). So the frame's centre lies BELOW the centre of the pendant's box (about 70 px at 1440 x 900): a
 *     frame centred on the pendant's box would push the base out through the bottom edge. In terms of the pendant's box on
 *     screen (top t, bottom b, its height ph = b - t), from that still: frame top ≈ t + 0.22 ph, frame bottom ≈ b + 0.045 ph,
 *     so h ≈ 0.82 ph and cy ≈ (t + b) / 2 + 0.13 ph. Horizontally the frame is centred on the pivot.
 *
 * Who owns what:
 *   - Task 3 owns the clock: `grow` is the snap's completion as a plain linear fraction of the grow's 0.6 s (0 at the snap,
 *     1 once 0.6 s have passed; scrolling back past the snap runs it back down). `retract` is linear in the scroll.
 *   - Task 4 owns the curves: the frame eases both itself (build-frame.tsx `frameParts`, `GROW_EASE`), so the writer
 *     never eases.
 */

export type FramePhase = "flight" | "snap" | "grow" | "build" | "retract" | null;
export type FrameState = {
  phase: FramePhase;
  /** the frame's centre on screen, CSS px: the point the pendant's pivot is locked to (not its box's centre; see above) */
  cx: number; cy: number;
  /** the frame's own full size, CSS px (size "i": the crown and loop break out above, the base sits inside; see above) */
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
/** Sub-pixel jitter is no change: px to 0.01, the 0..1 fractions to 0.001. */
const px = (x: number) => Math.round(x * 100) / 100;
const frac = (x: number) => Math.round(clamp01(x) * 1000) / 1000;

/** The frame's state this frame. Fields are copied in, rounded (px to 0.01, grow and retract clamped to 0..1 and rounded
 *  to 0.001); the subscribers hear of it only if something changed after the rounding. */
export function setFrameState(s: FrameState): void {
  const cx = px(s.cx), cy = px(s.cy), w = px(s.w), h = px(s.h), grow = frac(s.grow), retract = frac(s.retract);
  if (s.phase === state.phase && cx === state.cx && cy === state.cy && w === state.w && h === state.h && grow === state.grow && retract === state.retract) return;
  state.phase = s.phase; state.cx = cx; state.cy = cy; state.w = w; state.h = h; state.grow = grow; state.retract = retract;
  listeners.forEach((fn) => fn());
}

/** Back to no frame, the listeners kept (they hear of it if there was a frame). BuildFrame calls it on unmount: the store
 *  outlives the page, and a visit back to About must not open on the last visit's frame. */
export function clearFrame(): void {
  setFrameState(EMPTY);
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
