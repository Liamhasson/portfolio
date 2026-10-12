import { drawSketch, markBounds, type Layer, type Prim } from "./sketch-hand";
import { strokeTimes } from "./sketch-strokes";

/**
 * The sketches behind the desk (Liam, 2026-10-12): loose drawings of the real work, in the space beyond the desk's far
 * edge, seen through the tilt. Each is described here as clean primitives in its own units (y down); sketch-hand.ts
 * draws them by hand (guides first, loose doubled lines, open circles, hatching, rubbed tone). Placed by where its
 * centre falls in the tilt's last frame (NDC), sized by the screen-height share of 100 of its units, turned a few
 * degrees like a sheet pinned up by hand.
 *
 * Liam's notes (2026-10-12): Pulse shows its four milestone screens, each with its day above it; Cyvore, the landing
 * page's wireframe with the layout's goal written on it; Eventread, the product: a month whose days are critical,
 * threat or safe.
 */
export type SketchNote = { text: string; x: number; y: number; size?: number; rot?: number };
export type Sketch = {
  id: "pulse" | "cyvore" | "eventread";
  /** its centre in the tilt's last frame (NDC, -1..1) */
  at: [number, number];
  /** the screen-height share of 100 of its units */
  per100: number;
  /** its own turn in its plane (radians) */
  roll: number;
  /** the hand's seed */
  seed: number;
  prims: Prim[];
  notes: SketchNote[];
};

const box = (x: number, y: number, w: number, h: number, more: Partial<Extract<Prim, { k: "box" }>> = {}): Prim => ({ k: "box", x, y, w, h, ...more });
const line = (x0: number, y0: number, x1: number, y1: number, passes = 1): Prim => ({ k: "line", a: [x0, y0], b: [x1, y1], passes });
const ring = (cx: number, cy: number, r: number, more: Partial<Extract<Prim, { k: "ring" }>> = {}): Prim => ({ k: "ring", cx, cy, r, ...more });
const path = (d: string, passes = 1): Prim => ({ k: "path", d, passes });
const hatch = (x: number, y: number, w: number, h: number, more: Partial<Extract<Prim, { k: "hatch" }>> = {}): Prim => ({ k: "hatch", x, y, w, h, ...more });
const tone = (x: number, y: number, w: number, h: number, alpha = 0.5, round = false): Prim => ({ k: "tone", x, y, w, h, alpha, round });

// ---------- Pulse: the four milestones, a phone screen each, on one timeline ----------

const PHONE = { w: 64, h: 124, gap: 22 } as const;
const phoneX = (i: number) => i * (PHONE.w + PHONE.gap);

function phone(i: number): Prim[] {
  const x = phoneX(i);
  const frame: Prim[] = [
    box(x, 0, PHONE.w, PHONE.h, { r: 9, guides: true }),
    line(x + 26, 6, x + 38, 6),                 // the speaker
    line(x + 8, 18, x + 40, 18, 2),             // the screen's title
    box(x + 8, 102, 48, 12, { r: 6 }),          // its button
    tone(x + 8, 102, 48, 12, 0.45),
  ];
  const body: Prim[][] = [
    // Day 7, the first habit loop: a week of check-ins, five done
    [
      ...[13, 25.3, 37.6, 50].map((cx) => ring(x + cx, 44, 4.4, { passes: 1 })),
      ...[19, 31.5, 44].map((cx) => ring(x + cx, 58, 4.4, { passes: 1 })),
      ...[[13, 44], [25.3, 44], [37.6, 44], [50, 44], [19, 58]].map(([cx, cy]) => hatch(x + cx - 3.6, cy - 3.6, 7.2, 7.2, { round: true, gap: 1.7 })),
      line(x + 8, 76, x + 52, 76), line(x + 8, 84, x + 40, 84),
    ],
    // Day 30, a routine: the month, the same days every week
    [
      box(x + 7, 28, 50, 44, { passes: 1 }),
      ...[39, 50, 61].map((y) => line(x + 7, y, x + 57, y)),
      ...[1, 2, 3, 4, 5, 6].map((k) => line(x + 7 + (k * 50) / 7, 28, x + 7 + (k * 50) / 7, 72)),
      ...[0, 2, 4].flatMap((c) => [0, 1, 2, 3].map((r) => hatch(x + 7 + (c * 50) / 7 + 0.8, 28 + r * 11 + 0.8, 50 / 7 - 1.6, 9.4, { gap: 1.8 }))),
      line(x + 8, 82, x + 52, 82), line(x + 8, 90, x + 38, 90),
    ],
    // Day 60, a habit: sessions rising, the trend over them
    [
      path(`M ${x + 9} 30 L ${x + 9} 82 L ${x + 57} 82`),
      ...[8, 13, 19, 26, 34].map((h, k) => box(x + 13 + k * 9, 82 - h, 6, h, { passes: 1 })),
      hatch(x + 13 + 3 * 9, 82 - 26, 6, 26, { gap: 1.8 }), hatch(x + 13 + 4 * 9, 82 - 34, 6, 34, { gap: 1.8 }),
      path(`M ${x + 13} 68 Q ${x + 30} 62 ${x + 37} 50 Q ${x + 44} 40 ${x + 56} 36`),
      ring(x + 56, 36, 2.2, { passes: 1 }),
      line(x + 8, 92, x + 46, 92),
    ],
    // Day 90, staying power: the milestone's badge
    [
      ring(x + 32, 48, 16, { guides: true }),
      ring(x + 32, 48, 10.5, { passes: 1 }),
      tone(x + 22, 38, 20, 20, 0.5, true),
      path(`M ${x + 26.5} 48 L ${x + 30.5} 52.5 L ${x + 38} 43.5`, 2),
      path(`M ${x + 24} 62 L ${x + 21} 78 L ${x + 26} 75 L ${x + 29} 79 L ${x + 30} 64`),
      path(`M ${x + 40} 62 L ${x + 43} 78 L ${x + 38} 75 L ${x + 35} 79 L ${x + 34} 64`),
      line(x + 8, 88, x + 52, 88), line(x + 14, 95, x + 46, 95),
    ],
  ];
  return [...frame, ...body[i]];
}

const PULSE: Sketch = {
  id: "pulse", at: [-0.69, 0.53], per100: 0.118, roll: -0.05, seed: 11,
  prims: [
    ...[0, 1, 2, 3].flatMap(phone),
    // the timeline under them, a tick at each milestone
    line(-12, 140, 340, 140, 2),
    path("M 333 136 L 341 140 L 333 144"),
    ...[0, 1, 2, 3].map((i) => line(phoneX(i) + 32, 136, phoneX(i) + 32, 144)),
  ],
  notes: [
    { text: "Day 7", x: phoneX(0) + 14, y: -9, size: 17, rot: -0.03 },
    { text: "Day 30", x: phoneX(1) + 11, y: -9, size: 17, rot: 0.02 },
    { text: "Day 60", x: phoneX(2) + 11, y: -10, size: 17, rot: -0.02 },
    { text: "Day 90", x: phoneX(3) + 11, y: -9, size: 17, rot: 0.03 },
  ],
};

// ---------- Cyvore: the landing page's wireframe, and the layout's goal ----------

const CYVORE: Sketch = {
  id: "cyvore", at: [0.63, 0.5], per100: 0.112, roll: 0.04, seed: 23,
  prims: [
    box(0, 0, 300, 186, { r: 4, guides: true }),
    // the browser's bar
    line(0, 13, 300, 13),
    ...[8, 15, 22].map((cx) => ring(cx, 6.5, 2.2, { passes: 1 })),
    box(110, 3.5, 80, 6.5, { r: 3, passes: 1 }),
    // the nav: the logo, the links, the demo button
    box(8, 20, 28, 9, { passes: 1 }), hatch(8, 20, 28, 9, { gap: 2 }),
    line(196, 25, 212, 25), line(220, 25, 236, 25), line(244, 25, 258, 25),
    box(266, 19, 26, 11, { r: 5.5, passes: 1 }),
    // the chapter bar: four chapters, the first one open
    ...[0, 1, 2, 3].map((i) => box(8 + i * 72, 36, 68, 11, { r: 2, passes: 1 })),
    hatch(8, 36, 68, 11, { gap: 2.2 }),
    ...[1, 2, 3].map((i) => line(8 + i * 72 + 20, 41.5, 8 + i * 72 + 48, 41.5)),
    // the hero: the headline, its lines, the demo button…
    line(12, 62, 128, 62, 2), line(12, 72, 100, 72, 2),
    line(12, 84, 118, 84), line(12, 91, 104, 91),
    box(12, 102, 60, 14, { r: 7 }), tone(12, 102, 60, 14, 0.6),
    // …and the 7-second animation
    box(150, 56, 138, 74, { r: 3 }),
    line(150, 56, 288, 130), line(288, 56, 150, 130),
    tone(150, 56, 138, 74, 0.3),
    ring(219, 93, 11),
    path("M 215 87 L 225 93 L 215 99 Z"),
    // the numbers
    ...[12, 108, 204].flatMap((x) => [box(x, 142, 84, 26, { r: 2, passes: 1 }), line(x + 8, 151, x + 40, 151, 2), line(x + 8, 160, x + 62, 160)]),
    // the note's arrow to the chapter bar
    path("M 322 52 Q 310 50 297 44 M 297 44 L 304 42.5 M 297 44 L 302 49"),
  ],
  notes: [
    { text: "goal: every chapter one move away", x: 2, y: -12, size: 18, rot: -0.01 },
    { text: "chapters", x: 306, y: 64, size: 15, rot: 0.04 },
  ],
};

// ---------- Eventread: the month, each day critical, threat or safe ----------

/** March 2027 starts on a Monday: day d sits in row ⌊(d−1)/7⌋, column (d−1) mod 7. */
const CELL = { x: 0, y: 34, w: 34, h: 23.2 } as const;
const cell = (d: number) => ({ cx: CELL.x + ((d - 1) % 7) * CELL.w + CELL.w / 2, cy: CELL.y + Math.floor((d - 1) / 7) * CELL.h + CELL.h / 2 });
const CRITICAL = [6, 7, 19, 20, 27];
const THREAT = [5, 12, 14, 21, 26, 28];
const SAFE = Array.from({ length: 31 }, (_, k) => k + 1).filter((d) => !CRITICAL.includes(d) && !THREAT.includes(d));
const tick = (cx: number, cy: number, s = 1) => path(`M ${cx - 4.5 * s} ${cy} L ${cx - 1 * s} ${cy + 3.8 * s} L ${cx + 5 * s} ${cy - 4.5 * s}`);

const EVENTREAD: Sketch = {
  id: "eventread", at: [0.0, 0.54], per100: 0.115, roll: -0.03, seed: 37,
  prims: [
    box(0, 0, 238, 150, { r: 3, guides: true }),
    line(0, 22, 238, 22),
    ...[0, 1, 2, 3, 4].map((r) => line(0, CELL.y + r * CELL.h, 238, CELL.y + r * CELL.h)),
    ...[1, 2, 3, 4, 5, 6].map((c) => line(c * CELL.w, 22, c * CELL.w, 150)),
    // critical: cross-hatched and rubbed in
    ...CRITICAL.flatMap((d) => {
      const { cx, cy } = cell(d), x = cx - CELL.w / 2 + 2, y = cy - CELL.h / 2 + 2, w = CELL.w - 4, h = CELL.h - 4;
      return [tone(x, y, w, h, 0.55), hatch(x, y, w, h, { gap: 2.4 }), hatch(x, y, w, h, { gap: 3.2, angle: 0.55 })];
    }),
    // threat: circled
    ...THREAT.map((d) => { const { cx, cy } = cell(d); return ring(cx, cy, 9); }),
    // safe: ticked
    ...SAFE.map((d) => { const { cx, cy } = cell(d); return tick(cx, cy); }),
    // the key
    box(252, 32, 12, 10, { passes: 1 }), tone(252, 32, 12, 10, 0.55), hatch(252, 32, 12, 10, { gap: 2.2 }),
    ring(258, 57, 6.5),
    tick(258, 79, 0.9),
    // the arrow to a safe Saturday
    path("M 262 108 Q 236 104 200 76 M 200 76 L 207 77 M 200 76 L 202 83"),
  ],
  notes: [
    { text: "March", x: 7, y: 17, size: 16, rot: -0.02 },
    ...["M", "T", "W", "T", "F", "S", "S"].map((t, c) => ({ text: t, x: c * CELL.w + 14, y: 31, size: 11 })),
    ...CRITICAL.map((d) => { const { cx, cy } = cell(d); return { text: "!", x: cx + 9, y: cy + 2, size: 15 }; }),
    { text: "critical", x: 270, y: 42, size: 15 },
    { text: "threat", x: 270, y: 62, size: 15 },
    { text: "safe", x: 270, y: 83, size: 15 },
    { text: "book this one", x: 252, y: 122, size: 15, rot: 0.03 },
  ],
};

export const SKETCHES: Sketch[] = [PULSE, CYVORE, EVENTREAD];

/** How fast each layer draws, per unit of length: guides and hatching quicker than the lines. */
export const LAYER_PACE: Record<Layer, number> = { guide: 0.35, line: 1, hatch: 0.5 };

/** A sketch drawn by hand: its marks, their reveal times, its tone, and its box (marks, tone and notes, roughly). */
export function buildSketch(sk: Sketch) {
  const { marks, tones } = drawSketch(sk.prims, sk.seed);
  const times = strokeTimes(marks.map((m) => m.pts), 0.06, marks.map((m) => LAYER_PACE[m.layer]));
  const [bx, by, bw, bh] = markBounds(marks, tones);
  let x0 = bx, y0 = by, x1 = bx + bw, y1 = by + bh;
  for (const n of sk.notes) {
    const size = n.size ?? 17;
    x0 = Math.min(x0, n.x); x1 = Math.max(x1, n.x + 0.45 * size * n.text.length);
    y0 = Math.min(y0, n.y - size); y1 = Math.max(y1, n.y + size * 0.3);
  }
  const box: [number, number, number, number] = [x0 - 4, y0 - 4, x1 - x0 + 8, y1 - y0 + 8];
  return { marks, tones, times, box };
}
