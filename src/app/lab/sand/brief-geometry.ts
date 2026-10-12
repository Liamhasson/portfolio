// src/app/lab/sand/brief-geometry.ts
/**
 * The brief (spec 2026-10-12-loader-design.md §2.2, §2.4): the ball's circle with a designer's construction, at the
 * ball's projected centre and radius. It grows from nothing as the hero's files load (dragged out from its centre, as in
 * a design tool), and returns for a beat as the ball locks in on scroll. Screen px.
 */
export const BRIEF = { handle: 0.5523, square: 5, dot: 1.6, rgb: "230, 191, 174", guide: 0.3, minGrow: 1.2 } as const;

export type BriefShapes = {
  cx: number; cy: number; r: number;
  box: { x: number; y: number; s: number };
  /** centre; the curve's top, right, bottom, left; the box's corners TL, TR, BR, BL (the cascade's order) */
  anchors: [number, number][];
  /** the shape: a square whose corners round by `round` (0 the square .. 1 the circle), as an SVG path */
  path: string;
  /** each corner's two ends, clockwise from the top-left's top: TL.top, TR.top, TR.right, BR.right, BR.bottom, BL.bottom,
   *  BL.left, TL.left (at 1 they meet in pairs at the edges' midpoints: the curve's anchors) */
  ends: [number, number][];
  /** each end's handle toward its corner: x1, y1, x2, y2 (0.5523 x the corner's radius) */
  handles: [number, number, number, number][];
};

/** The brief at the ball's centre and radius; `round`: the corner radius, 0 (the square) .. 1 (the circle; Liam,
 *  2026-10-12: the square grows with the load, then its corners round into the circle, a designer's corner radius). */
export function briefShapes(cx: number, cy: number, r: number, round = 1): BriefShapes {
  const x0 = cx - r, y0 = cy - r, x1 = cx + r, y1 = cy + r;
  const rho = Math.min(Math.max(round, 0), 1) * r, k = BRIEF.handle * rho;
  const ends: [number, number][] = [[x0 + rho, y0], [x1 - rho, y0], [x1, y0 + rho], [x1, y1 - rho], [x1 - rho, y1], [x0 + rho, y1], [x0, y1 - rho], [x0, y0 + rho]];
  // each end's handle points along its edge toward its corner
  const dirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const handles = ends.map(([x, y], i) => [x, y, x + dirs[i][0] * k, y + dirs[i][1] * k] as [number, number, number, number]);
  const h = (i: number) => `${handles[i][2]} ${handles[i][3]}`, e = (i: number) => `${ends[i][0]} ${ends[i][1]}`;
  const path = `M ${e(0)} L ${e(1)} C ${h(1)} ${h(2)} ${e(2)} L ${e(3)} C ${h(3)} ${h(4)} ${e(4)} L ${e(5)} C ${h(5)} ${h(6)} ${e(6)} L ${e(7)} C ${h(7)} ${h(0)} ${e(0)} Z`;
  return {
    cx, cy, r,
    box: { x: x0, y: y0, s: 2 * r },
    anchors: [[cx, cy], [cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy], [x0, y0], [x1, y0], [x1, y1], [x0, y1]],
    path, ends, handles,
  };
}

/** The size (0..1 of the ball's): chases the progress (a damped ease), at most the minimum-duration ramp, never back. */
export function briefSize(prev: number, progress: number, elapsed: number, dt: number): number {
  const cap = Math.min(elapsed / BRIEF.minGrow, 1);
  const target = Math.min(progress, cap * cap * (3 - 2 * cap));
  const gap = target - prev;
  if (gap <= 0) return prev;   // never shrinks
  // a damped chase, closing at least 0.3 a second, so it lands on the target instead of creeping at it forever
  const step = Math.max(gap * (1 - Math.exp(-dt * 6)), Math.min(gap, 0.3 * dt));
  return Math.min(prev + step, 1);
}

const ease = (x: number) => { const t = Math.min(Math.max(x, 0), 1); return t * t * (3 - 2 * t); };
/** As the ball locks in (compaction 0.75 .. 1): in by 0.85, held to 0.92, gone at 1. */
export function briefReturn(compact: number): number {
  if (compact <= 0.75 || compact >= 1) return 0;
  return compact < 0.85 ? ease((compact - 0.75) / 0.1) : compact <= 0.92 ? 1 : 1 - ease((compact - 0.92) / 0.08);
}
