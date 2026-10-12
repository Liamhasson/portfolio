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
  /** each curve anchor's tangent handle: x1, y1, x2, y2 */
  handles: [number, number, number, number][];
};

export function briefShapes(cx: number, cy: number, r: number): BriefShapes {
  const k = BRIEF.handle * r;
  return {
    cx, cy, r,
    box: { x: cx - r, y: cy - r, s: 2 * r },
    anchors: [[cx, cy], [cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy], [cx - r, cy - r], [cx + r, cy - r], [cx + r, cy + r], [cx - r, cy + r]],
    handles: [[cx - k, cy - r, cx + k, cy - r], [cx + r, cy - k, cx + r, cy + k], [cx - k, cy + r, cx + k, cy + r], [cx - r, cy - k, cx - r, cy + k]],
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
