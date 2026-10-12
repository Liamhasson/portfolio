// src/app/lab/sand/brief.tsx
"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { BRIEF, briefShapes } from "./brief-geometry";

export { BRIEF, briefReturn, briefShapes, briefSize } from "./brief-geometry";

export type BriefHandle = {
  update(o: { cx: number; cy: number; r: number; alpha: number; dash: number; squares: number[] }): void;
  announce(p: number | "ready"): void;
};

/** The brief (spec 2026-10-12-loader-design.md §2): an SVG over the canvas, under the copy. Hairlines, no glow. */
export const Brief = forwardRef<BriefHandle>(function Brief(_, ref) {
  const svg = useRef<SVGSVGElement>(null);
  const status = useRef<HTMLParagraphElement>(null);
  const lastPct = useRef(-1);
  useImperativeHandle(ref, () => ({
    update({ cx, cy, r, alpha, dash, squares }) {
      const el = svg.current;
      if (!el) return;
      el.style.opacity = String(alpha);
      const s = briefShapes(cx, cy, r);
      const set = (q: string, a: Record<string, string | number>) => el.querySelectorAll(q).forEach((n) => { for (const k in a) n.setAttribute(k, String(a[k])); });
      set("[data-brief='circle']", { cx, cy, r: Math.max(r, 0), "stroke-dasharray": dash > 0 ? `${Math.max(14 * (1 - dash), 0.01)} ${4 + 26 * dash}` : "none" });
      set("[data-brief='box']", { x: s.box.x, y: s.box.y, width: s.box.s, height: s.box.s, opacity: 0.5 * (1 - dash) });
      set("[data-brief='gh']", { x1: 0, x2: "100%", y1: cy, y2: cy, opacity: BRIEF.guide * (1 - dash) });
      set("[data-brief='gv']", { y1: 0, y2: "100%", x1: cx, x2: cx, opacity: BRIEF.guide * (1 - dash) });
      el.querySelectorAll("[data-brief='handle']").forEach((n, i) => { const [x1, y1, x2, y2] = s.handles[i]; n.setAttribute("x1", String(x1)); n.setAttribute("y1", String(y1)); n.setAttribute("x2", String(x2)); n.setAttribute("y2", String(y2)); n.setAttribute("opacity", String(0.6 * (1 - dash))); });
      el.querySelectorAll("[data-brief='end']").forEach((n, i) => { const [x1, y1, x2, y2] = s.handles[i >> 1]; n.setAttribute("cx", String(i & 1 ? x2 : x1)); n.setAttribute("cy", String(i & 1 ? y2 : y1)); n.setAttribute("opacity", String(0.8 * (1 - dash))); });
      el.querySelectorAll("[data-brief='anchor']").forEach((n, i) => { const k = BRIEF.square * (squares[i] ?? 1); const [x, y] = s.anchors[i]; n.setAttribute("x", String(x - k / 2)); n.setAttribute("y", String(y - k / 2)); n.setAttribute("width", String(k)); n.setAttribute("height", String(k)); });
    },
    announce(p) {
      if (!status.current) return;
      if (p === "ready") { status.current.textContent = "Ready"; return; }
      const pct = Math.floor(p * 10) * 10;   // (every 10%: a live region must not chatter)
      if (pct === lastPct.current && p < 1) return;
      lastPct.current = pct;
      status.current.textContent = `Loading, ${Math.round(p * 100)}%`;
    },
  }));
  const line = `rgb(${BRIEF.rgb})`;
  return (
    <>
      <svg ref={svg} aria-hidden className="pointer-events-none fixed left-0 top-0 h-screen w-screen" style={{ zIndex: 5 }} fill="none" stroke={line} strokeWidth={1} vectorEffect="non-scaling-stroke">
        <line data-brief="gh" strokeDasharray="2 4" />
        <line data-brief="gv" strokeDasharray="2 4" />
        <circle data-brief="circle" cx={0} cy={0} r={0} strokeOpacity={0.85} />
        <rect data-brief="box" strokeWidth={0.7} />
        {[0, 1, 2, 3].map((i) => <line key={i} data-brief="handle" strokeWidth={0.7} />)}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <circle key={i} data-brief="end" r={BRIEF.dot} fill={line} stroke="none" />)}
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => <rect key={i} data-brief="anchor" fill="#0b0908" strokeWidth={0.8} />)}
      </svg>
      <p ref={status} role="status" aria-live="polite" className="sr-only" />
    </>
  );
});
