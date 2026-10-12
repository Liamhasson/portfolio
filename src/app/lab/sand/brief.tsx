// src/app/lab/sand/brief.tsx
"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { BRIEF, briefShapes } from "./brief-geometry";

export { BRIEF, BriefGrowth, briefReturn, briefShapes } from "./brief-geometry";

/** Which curve anchor (the cascade's index) each corner end becomes at the circle: TL.top, TR.top → top (1); TR.right,
 *  BR.right → right (2); BR.bottom, BL.bottom → bottom (3); BL.left, TL.left → left (4). */
const END_ANCHOR = [1, 1, 2, 2, 3, 3, 4, 4];

export type BriefHandle = {
  /** `round`: the corner radius, 0 (the square) .. 1 (the circle) */
  update(o: { cx: number; cy: number; r: number; alpha: number; dash: number; squares: number[]; round?: number }): void;
  announce(p: number | "ready"): void;
  /** The wait for the desk (story-timeline.ts deskWait): a thin line under the brief filling with its loading, 0..1;
   *  null: gone. `ball`: where the ball is (else the brief's last place). Drawn on its own layer: it shows even when the
   *  brief is faded out (reduced motion). */
  wait(k: number | null, ball?: { cx: number; cy: number; r: number }): void;
};

/** The brief (spec 2026-10-12-loader-design.md §2): an SVG over the canvas, under the copy. Hairlines, no glow. */
export const Brief = forwardRef<BriefHandle>(function Brief(_, ref) {
  const svg = useRef<SVGSVGElement>(null);
  const status = useRef<HTMLParagraphElement>(null);
  const lastPct = useRef(-1);
  const lastBox = useRef<{ x: number; y: number; s: number } | null>(null);
  const waitK = useRef<number | null>(null);
  const waitSvg = useRef<SVGSVGElement>(null);
  const drawWait = () => {
    const el = waitSvg.current, b = lastBox.current, k = waitK.current;
    if (!el) return;
    const fill = el.querySelector("[data-brief='wait']"), track = el.querySelector("[data-brief='wait-track']");
    if (!fill || !track) return;
    if (k === null || !b) { fill.setAttribute("opacity", "0"); track.setAttribute("opacity", "0"); return; }
    const y = b.y + b.s + BRIEF.waitGap;
    for (const [n, x2, o] of [[track, b.x + b.s, 0.25], [fill, b.x + b.s * Math.min(Math.max(k, 0), 1), 0.85]] as const) {
      n.setAttribute("x1", String(b.x)); n.setAttribute("x2", String(x2)); n.setAttribute("y1", String(y)); n.setAttribute("y2", String(y));
      n.setAttribute("opacity", String(o));
    }
  };
  useImperativeHandle(ref, () => ({
    update({ cx, cy, r, alpha, dash, squares, round = 1 }) {
      const el = svg.current;
      if (!el) return;
      el.style.opacity = String(alpha);
      const s = briefShapes(cx, cy, Math.max(r, 0), round);
      lastBox.current = { x: s.box.x, y: s.box.y, s: s.box.s };
      drawWait();
      const set = (q: string, a: Record<string, string | number>) => el.querySelectorAll(q).forEach((n) => { for (const k in a) n.setAttribute(k, String(a[k])); });
      set("[data-brief='shape']", { d: s.path, "stroke-dasharray": dash > 0 ? `${Math.max(14 * (1 - dash), 0.01)} ${4 + 26 * dash}` : "none" });
      set("[data-brief='box']", { x: s.box.x, y: s.box.y, width: s.box.s, height: s.box.s, opacity: 0.5 * (1 - dash) });
      set("[data-brief='gh']", { x1: 0, x2: "100%", y1: cy, y2: cy, opacity: BRIEF.guide * (1 - dash) });
      set("[data-brief='gv']", { y1: 0, y2: "100%", x1: cx, x2: cx, opacity: BRIEF.guide * (1 - dash) });
      el.querySelectorAll("[data-brief='handle']").forEach((n, i) => { const [x1, y1, x2, y2] = s.handles[i]; n.setAttribute("x1", String(x1)); n.setAttribute("y1", String(y1)); n.setAttribute("x2", String(x2)); n.setAttribute("y2", String(y2)); n.setAttribute("opacity", String(0.6 * (1 - dash))); });
      el.querySelectorAll("[data-brief='end']").forEach((n, i) => { const [, , x2, y2] = s.handles[i]; n.setAttribute("cx", String(x2)); n.setAttribute("cy", String(y2)); n.setAttribute("opacity", String(0.8 * (1 - dash))); });
      // the anchors: the centre, the 8 corner ends (each the curve anchor it becomes at the circle), the box's 4 corners
      const pts: [number, number, number][] = [
        [...s.anchors[0], squares[0] ?? 1],
        ...s.ends.map(([x, y], i) => [x, y, squares[END_ANCHOR[i]] ?? 1] as [number, number, number]),
        ...s.anchors.slice(5).map(([x, y], i) => [x, y, squares[5 + i] ?? 1] as [number, number, number]),
      ];
      el.querySelectorAll("[data-brief='anchor']").forEach((n, i) => { const [x, y, sc] = pts[i]; const k = BRIEF.square * sc; n.setAttribute("x", String(x - k / 2)); n.setAttribute("y", String(y - k / 2)); n.setAttribute("width", String(k)); n.setAttribute("height", String(k)); });
    },
    announce(p) {
      if (!status.current) return;
      if (p === "ready") { status.current.textContent = "Ready"; return; }
      const pct = Math.floor(p * 10) * 10;   // (every 10%: a live region must not chatter)
      if (pct === lastPct.current && p < 1) return;
      lastPct.current = pct;
      status.current.textContent = `Loading, ${Math.round(p * 100)}%`;
    },
    wait(k, ball) {
      waitK.current = k;
      if (ball) { const s = briefShapes(ball.cx, ball.cy, Math.max(ball.r, 0), 1); lastBox.current = { x: s.box.x, y: s.box.y, s: s.box.s }; }
      drawWait();
    },
  }));
  const line = `rgb(${BRIEF.rgb})`;
  return (
    <>
      <svg ref={svg} aria-hidden className="pointer-events-none fixed left-0 top-0 h-screen w-screen" style={{ zIndex: 5 }} fill="none" stroke={line} strokeWidth={1} vectorEffect="non-scaling-stroke">
        <line data-brief="gh" strokeDasharray="2 4" />
        <line data-brief="gv" strokeDasharray="2 4" />
        <path data-brief="shape" d="" strokeOpacity={0.85} />
        <rect data-brief="box" strokeWidth={0.7} />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <line key={i} data-brief="handle" strokeWidth={0.7} />)}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <circle key={i} data-brief="end" r={BRIEF.dot} fill={line} stroke="none" />)}
        {Array.from({ length: 13 }, (_, i) => <rect key={i} data-brief="anchor" fill="#0b0908" strokeWidth={0.8} />)}
      </svg>
      <svg ref={waitSvg} aria-hidden className="pointer-events-none fixed left-0 top-0 h-screen w-screen" style={{ zIndex: 5 }} fill="none" stroke={line} strokeWidth={1}>
        <line data-brief="wait-track" opacity={0} />
        <line data-brief="wait" opacity={0} />
      </svg>
      <p ref={status} role="status" aria-live="polite" className="sr-only" />
    </>
  );
});
