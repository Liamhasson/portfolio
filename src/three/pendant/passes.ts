// src/three/pendant/passes.ts
/**
 * The pendant's build passes (spec 2026-10-16-about-pendant-design.md §3): a sweep left to right across the pendant on
 * screen, brass (built) | clay | wire (not yet built). Pure maths, so the scene stays thin and the edges can be tested.
 */

/** Half the sweep's width, in pendant units (the pendant is 1 tall and about 0.4 wide). */
export const SWEEP_SPAN = 0.42;
/** At or past this the pendant is fully built: the clay and the wire go, the clips come off. */
export const BUILT_AT = 0.999;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export interface BuildEdges {
  /** Right of this (along the camera's right vector) is wire. */
  eA: number;
  /** Left of this is brass; between eB and eA is clay. */
  eB: number;
  /** False once the pendant is fully built (w >= BUILT_AT): nothing is clipped. */
  building: boolean;
}

/** Where the two edges stand for build progress `w` (0 = all wire, 1 = all brass). The clay edge lags the wire's by a third. */
export function buildEdges(w: number): BuildEdges {
  return {
    eA: -SWEEP_SPAN + 2 * SWEEP_SPAN * clamp01(1.5 * w),
    eB: -SWEEP_SPAN + 2 * SWEEP_SPAN * clamp01(1.5 * w - 0.5),
    building: w < BUILT_AT,
  };
}
