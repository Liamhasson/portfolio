// src/app/about/build-frame.tsx
"use client";

import { useEffect, useRef } from "react";
import { BRIEF } from "@/app/lab/sand/brief-geometry";
import { getFrameState, setFrameState, subscribeFrame, type FrameState } from "./build-frame-state";

/**
 * The construction frame (plan 2026-10-18-about-round3, Task 4; Liam's decisions 3–5): the loader's construction drawing
 * (src/app/lab/sand/brief.tsx, spec 2026-10-12-loader-design.md §2.2) round the pendant while it builds itself, as in
 * mockup i (clip/frame/frame-build-i-ii.jpg). The same hairlines as the loader: rgb(230, 191, 174), 1 px, no glow, no fill;
 *   - a sharp bounding box (0.7 px at 0.5) and on it the shape: a rect whose corners round by a designer's corner radius
 *     (the loader's square before it rounds, at 0.85);
 *   - eight corner ends, each with its 0.5523 × radius handle (0.7 px at 0.6) toward its corner, ending in a 1.6 px dot;
 *   - thirteen 5 px hollow square anchors filled with the background: the centre, the eight ends, the box's four corners;
 *   - dashed centre guides (2 4, at 0.3), kept to the frame plus 16 px so they never run through text (the loader's run the
 *     whole screen: the one departure, as in the mockup).
 *
 * The motion (state from build-frame-state.ts, written by the pendant's mount):
 *   - grow (0.6 s after the snap, Task 3's linear clock; eased here): it starts tight round the pendant and opens out to its
 *     full size, the corner handles leading (eased out, they arrive first) and the hairlines drawing out of them behind,
 *     from each corner toward the edge's middle, where they meet;
 *   - build: whole and still;
 *   - retract (scrubbed by scroll at the build's end): the lines pull back into the corner handles, then the handles fade.
 * Reduced motion: whole at once, no grow (the retract is scroll, not motion). Fixed on the screen, behind the pendant's
 * canvas and above the track's words (about.css `.ab-frame`), on the track only (hidden when stacked). It redraws by writing
 * attributes in the store's subscriber: no React render per frame.
 */

export const FRAME = {
  /** the designer's corner radius, px (the mockup's 18) */
  radius: 18,
  /** how far the centre guides run past the frame, px */
  guideOver: 16,
  /** the grow's first size, as a share of the full one: tight round the pendant's body at size "i" (about 0.39 of the
   *  frame's width; its crown already breaks out of the top) */
  tight: { w: 0.46, h: 0.88 },
  /** the corner handles fade in over this much of the grow, as they appear round the snapped pendant */
  fadeIn: 0.12,
  /** the hairlines start drawing this far into the grow: the corners lead */
  lineLag: 0.2,
  /** the retract: the lines are back in the corners by this much of it, and the handles fade over this span */
  linesGone: 0.7,
  handlesFade: [0.6, 1] as const,
} as const;

const clamp01 = (x: number) => (x > 0 ? (x < 1 ? x : 1) : 0);
const smooth = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
/** The corners' grow: eased out, so they lead and settle into place. */
export const GROW_EASE = (x: number) => 1 - (1 - clamp01(x)) ** 3;

/** The three parts of the frame at a moment: `size` how far the corners have opened (0 tight .. 1 full), `lines` how much
 *  of each edge is drawn (0 none .. 1 whole), `handles` the corner handles' opacity. */
export function frameParts(s: Pick<FrameState, "phase" | "grow" | "retract">, reduced: boolean): { size: number; lines: number; handles: number } {
  if (s.phase === "grow") {
    const t = reduced ? 1 : clamp01(s.grow);
    return { size: GROW_EASE(t), lines: smooth((t - FRAME.lineLag) / (1 - FRAME.lineLag)), handles: smooth(t / FRAME.fadeIn) };
  }
  if (s.phase === "build") return { size: 1, lines: 1, handles: 1 };
  if (s.phase === "retract") {
    const r = clamp01(s.retract), [a, b] = FRAME.handlesFade;
    return { size: 1, lines: 1 - smooth(r / FRAME.linesGone), handles: 1 - smooth((r - a) / (b - a)) };
  }
  return { size: 0, lines: 0, handles: 0 };
}

type Seg = [number, number, number, number];
export type FrameGeometry = {
  visible: boolean;
  /** the corners' box now (screen px) and its corner radius */
  box: { x0: number; y0: number; x1: number; y1: number; r: number };
  parts: { size: number; lines: number; handles: number };
  /** the four edges, clockwise from the top: the sharp box's corner to corner, and the shape's between its corner ends,
   *  each with its dash (drawn from both ends toward the middle: `d gap d`) */
  boxEdges: { seg: Seg; dash: string }[];
  edges: { seg: Seg; dash: string; drawn: number }[];
  /** the shape's four rounded corners, one path */
  arcs: string;
  /** the corner ends clockwise from the top-left's top (TL.top, TR.top, TR.right, BR.right, BR.bottom, BL.bottom, BL.left,
   *  TL.left, as in brief-geometry.ts), and each one's handle toward its corner */
  ends: [number, number][];
  handles: Seg[];
  /** the anchors' centres: the centre, the eight ends, the box's corners TL, TR, BR, BL */
  anchors: [number, number][];
  /** the centre guides: horizontal and vertical, each kept to the box plus FRAME.guideOver */
  guides: { h: Seg; v: Seg; alpha: number };
};

const n = (x: number) => Math.round(x * 100) / 100;
/** A line drawn from both its ends toward its middle: `d` at each end of `len`. */
const fromEnds = (d: number, len: number) => `${n(d)} ${n(Math.max(len - 2 * d, 0))} ${n(d)}`;

/** The frame at its state: pure, screen px. */
export function frameGeometry(s: FrameState, reduced: boolean): FrameGeometry {
  const parts = frameParts(s, reduced);
  const { cx, cy } = s;
  const bw = s.w * (FRAME.tight.w + (1 - FRAME.tight.w) * parts.size), bh = s.h * (FRAME.tight.h + (1 - FRAME.tight.h) * parts.size);
  const x0 = cx - bw / 2, x1 = cx + bw / 2, y0 = cy - bh / 2, y1 = cy + bh / 2;
  const r = Math.max(Math.min(FRAME.radius, bw / 2, bh / 2), 0), k = BRIEF.handle * r;
  const ends: [number, number][] = [[x0 + r, y0], [x1 - r, y0], [x1, y0 + r], [x1, y1 - r], [x1 - r, y1], [x0 + r, y1], [x0, y1 - r], [x0, y0 + r]];
  const dirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const handles = ends.map(([x, y], i) => [x, y, x + dirs[i][0] * k, y + dirs[i][1] * k] as Seg);
  const tip = (i: number) => `${n(handles[i][2])} ${n(handles[i][3])}`, e = (i: number) => `${n(ends[i][0])} ${n(ends[i][1])}`;
  // each corner's arc, from the end before it to the end after it (clockwise): TL, TR, BR, BL
  const arcs = [[7, 0], [1, 2], [3, 4], [5, 6]].map(([a, b]) => `M ${e(a)} C ${tip(a)} ${tip(b)} ${e(b)}`).join(" ");
  // the edges clockwise from the top; the shape's straight run lies between two ends, the box's between two corners
  const corners: [number, number][] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const runs: [number, number][] = [[0, 1], [2, 3], [4, 5], [6, 7]];
  const edges = runs.map(([a, b]) => {
    const len = Math.hypot(ends[b][0] - ends[a][0], ends[b][1] - ends[a][1]), d = (parts.lines * len) / 2;
    return { seg: [ends[a][0], ends[a][1], ends[b][0], ends[b][1]] as Seg, dash: fromEnds(d, len), drawn: 2 * d };
  });
  const boxEdges = corners.map(([ax, ay], i) => {
    const [bx, by] = corners[(i + 1) % 4], len = Math.hypot(bx - ax, by - ay);
    // the corner's own bit (out to its ends) belongs to the corner handle; the rest draws with the lines
    return { seg: [ax, ay, bx, by] as Seg, dash: fromEnds(r + (parts.lines * (len - 2 * r)) / 2, len) };
  });
  const g = FRAME.guideOver;
  return {
    visible: (parts.handles > 0 || parts.lines > 0) && s.w > 0 && s.h > 0,
    box: { x0, y0, x1, y1, r },
    parts, boxEdges, edges, arcs, ends, handles,
    anchors: [[cx, cy], ...ends, ...corners],
    guides: { h: [x0 - g, cy, x1 + g, cy], v: [cx, y0 - g, cx, y1 + g], alpha: BRIEF.guide * parts.lines },
  };
}

declare global {
  interface Window {
    /** Diagnostics, only with ?pendant-debug: set the frame's state by hand (headless stills before Task 3 writes it). */
    __frame?: { set: (s: FrameState) => void; get: () => Readonly<FrameState> };
  }
}

const LINE = `rgb(${BRIEF.rgb})`;

/** The frame: one SVG over the screen, drawn from the store (build-frame-state.ts). */
export function BuildFrame() {
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const q = <T extends Element>(sel: string) => [...el.querySelectorAll<T>(`[data-frame='${sel}']`)];
    const [gh] = q("gh"), [gv] = q("gv"), [arcs] = q("arc");
    const boxes = q("box"), edges = q("edge"), handles = q("handle"), dots = q("end"), anchors = q("anchor");
    const reducedQ = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    const at = (node: Element, a: Record<string, string | number>) => { for (const key in a) node.setAttribute(key, String(a[key])); };
    const seg = (node: Element, [x1, y1, x2, y2]: Seg) => at(node, { x1: n(x1), y1: n(y1), x2: n(x2), y2: n(y2) });
    let shown = false;
    const draw = () => {
      const f = frameGeometry(getFrameState() as FrameState, !!reducedQ?.matches);
      el.dataset.phase = getFrameState().phase ?? "none";
      if (!f.visible) {
        if (shown) { el.style.visibility = "hidden"; shown = false; }
        return;
      }
      if (!shown) { el.style.visibility = ""; shown = true; }
      const { lines, handles: ha } = f.parts;
      seg(gh, f.guides.h); seg(gv, f.guides.v);
      at(gh, { opacity: n(f.guides.alpha) }); at(gv, { opacity: n(f.guides.alpha) });
      f.boxEdges.forEach((b, i) => { seg(boxes[i], b.seg); at(boxes[i], { "stroke-dasharray": b.dash, opacity: n(0.5 * ha) }); });
      f.edges.forEach((d, i) => { seg(edges[i], d.seg); at(edges[i], { "stroke-dasharray": d.dash, opacity: lines > 0 ? 1 : 0 }); });
      at(arcs, { d: f.arcs, opacity: n(ha) });
      f.handles.forEach((h, i) => { seg(handles[i], h); at(handles[i], { opacity: n(0.6 * ha) }); });
      f.handles.forEach(([, , x, y], i) => at(dots[i], { cx: n(x), cy: n(y), opacity: n(0.8 * ha) }));
      const s = BRIEF.square;
      f.anchors.forEach(([x, y], i) => at(anchors[i], { x: n(x - s / 2), y: n(y - s / 2), width: s, height: s, opacity: n(ha) }));
    };
    const off = subscribeFrame(draw);
    reducedQ?.addEventListener?.("change", draw);
    draw();
    const debug = new URLSearchParams(window.location.search).has("pendant-debug");
    const hook = { set: setFrameState, get: getFrameState };
    if (debug) window.__frame = hook;
    return () => {
      off();
      reducedQ?.removeEventListener?.("change", draw);
      if (window.__frame === hook) delete window.__frame;
    };
  }, []);
  return (
    <svg ref={svg} className="ab-frame" aria-hidden="true" focusable="false" data-phase="none" style={{ visibility: "hidden" }}
      fill="none" stroke={LINE} strokeWidth={1}>
      <line data-frame="gh" strokeDasharray="2 4" />
      <line data-frame="gv" strokeDasharray="2 4" />
      {[0, 1, 2, 3].map((i) => <line key={i} data-frame="box" strokeWidth={0.7} />)}
      {[0, 1, 2, 3].map((i) => <line key={i} data-frame="edge" strokeOpacity={0.85} />)}
      <path data-frame="arc" d="" strokeOpacity={0.85} />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <line key={i} data-frame="handle" strokeWidth={0.7} />)}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <circle key={i} data-frame="end" r={BRIEF.dot} fill={LINE} stroke="none" />)}
      {Array.from({ length: 13 }, (_, i) => <rect key={i} data-frame="anchor" fill="#0b0908" strokeWidth={0.8} />)}
    </svg>
  );
}
