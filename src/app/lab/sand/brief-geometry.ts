// src/app/lab/sand/brief-geometry.ts
import { BEATS } from "@/three/sand/story-timeline";
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

/**
 * The square's growth, smooth (Liam, 2026-10-12: "something feels slightly stuck as the square is getting bigger"): a
 * critically damped spring toward the progress, its acceleration capped, so a burst in the download eases it on and a
 * stall eases it down instead of stopping it dead; through a stall it keeps creeping, never more than 8% past the real
 * progress. At least BRIEF.minGrow to grow whole; never shrinks.
 */
export class BriefGrowth {
  size = 0;
  private follow = 0;   // the spring that follows the download
  private vel = 0;
  step(progress: number, elapsed: number, dt: number): number {
    const r = Math.min(elapsed / BRIEF.minGrow, 1), ramp = r * r * (3 - 2 * r);
    const p = Math.min(Math.max(progress, 0), 1);
    const target = p >= 1 ? 1 : Math.max(p, Math.min(p + 0.08, this.follow + 0.015));
    const w = 3.5;
    const acc = Math.max(-10, Math.min(10, w * w * (target - this.follow) - 2 * w * this.vel));
    this.vel = Math.max(0, this.vel + acc * dt);
    // (the last stretch to whole closes at a steady pace instead of an endless tail)
    if (target >= 1 && 1 - this.follow < 0.05) this.vel = Math.max(this.vel, 0.3);
    this.follow = Math.min(1, this.follow + this.vel * dt);
    if (target >= 1 && this.follow > 0.999) this.follow = 1;
    // the size: the spring, held to the minimum ramp (a cached load grows along the ramp alone); never shrinks
    this.size = Math.max(this.size, Math.min(ramp, this.follow));
    return this.size;
  }
}

const ease = (x: number) => { const t = Math.min(Math.max(x, 0), 1); return t * t * (3 - 2 * t); };
/** The brief returns as the ball locks in (compaction 0.75 .. 0.85) and stays around the formed ball until the camera
 *  tilts down: it fades over the tilt's first 0.2 screens (Liam, 2026-10-12: "leave them on longer"). `p`: story
 *  progress (screens). */
export function briefReturn(compact: number, p: number): number {
  const out = 1 - ease((p - BEATS.tilt[0]) / 0.2);
  return ease((compact - 0.75) / 0.1) * out;
}
