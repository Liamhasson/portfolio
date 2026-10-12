import { circle, parsePath, rect, type Stroke } from "./sketch-strokes";

/**
 * The sketches behind the desk (Liam, 2026-10-12): loose drawings of the real work, in the space beyond the desk's far
 * edge, seen through the tilt. From the approved mockup (.superpowers/brainstorm/…/desk-sketches-v2.html): each in its
 * own units (y down), placed by where its centre falls in the tilt's last frame (NDC) and its height there (a share of
 * the screen's), turned a few degrees like a sheet pinned up by hand.
 */
export type SketchNote = { text: string; x: number; y: number; size?: number; rot?: number };
export type Sketch = {
  id: "pulse" | "cyvore" | "eventread";
  /** its centre in the tilt's last frame (NDC, -1..1) */
  at: [number, number];
  /** its height there, a share of the screen's */
  height: number;
  /** its box in its own units (strokes and notes inside it) */
  box: [number, number, number, number];
  /** its own turn in its plane (radians) */
  roll: number;
  strokes: Stroke[];
  notes: SketchNote[];
};

const P = parsePath;

export const SKETCHES: Sketch[] = [
  {
    // Pulse: the goal-first onboarding, its screens one after another
    id: "pulse", at: [-0.7, 0.57], height: 0.19, box: [-6, -26, 300, 160], roll: -0.07,
    strokes: [
      ...P("M 0 6 Q 1 0 7 0 L 58 1 Q 64 1 64 7 L 63 112 Q 63 118 57 118 L 6 117 Q 0 117 0 111 Z"),
      ...P("M 10 22 L 54 22 M 10 34 L 46 34 M 10 90 Q 32 86 54 90"),
      ...P("M 70 58 Q 88 52 106 58 M 100 52 L 106 58 L 99 63"),
      ...P("M 112 8 Q 112 1 119 1 L 170 2 Q 176 2 176 8 L 175 113 Q 175 119 169 119 L 118 118 Q 112 118 112 112 Z"),
      ...circle(144, 52, 20),
      ...P("M 182 60 Q 200 54 218 60 M 212 54 L 218 60 L 211 65"),
      ...P("M 224 6 Q 224 0 231 0 L 282 1 Q 288 1 288 7 L 287 112 Q 287 118 281 118 L 230 117 Q 224 117 224 111 Z"),
      ...P("M 236 30 L 252 30 L 260 22 L 268 40 L 276 30"),
    ],
    notes: [{ text: "goal first, then the plan", x: 0, y: 146 }, { text: "4 milestones?", x: 196, y: -10, rot: 0.05 }],
  },
  {
    // Cyvore: the site's information architecture
    id: "cyvore", at: [0.62, 0.68], height: 0.19, box: [-10, -4, 360, 156], roll: 0.05,
    strokes: [
      ...rect(120, 0, 92, 34),
      ...P("M 166 34 L 166 58 M 30 58 Q 166 52 310 58 M 30 58 L 30 76 M 120 57 L 120 76 M 212 57 L 212 76 M 310 58 L 310 76"),
      ...rect(-8, 76, 76, 28), ...rect(82, 76, 76, 28), ...rect(174, 76, 76, 28), ...rect(272, 76, 76, 28),
      ...P("M 52 146 Q 120 152 230 145"),
    ],
    notes: [
      { text: "Home", x: 138, y: 23 },
      { text: "security", x: -2, y: 96, size: 14 }, { text: "exposure", x: 88, y: 96, size: 14 },
      { text: "coverage", x: 180, y: 96, size: 14 }, { text: "enables", x: 280, y: 96, size: 14 },
      { text: "find a section: 35s → 8s", x: 60, y: 140 },
    ],
  },
  {
    // Eventread: the month calendar, every day of it
    id: "eventread", at: [-0.01, 0.73], height: 0.19, box: [-4, -6, 360, 160], roll: -0.035,
    strokes: [
      ...rect(0, 0, 238, 150),
      ...P("M 0 26 L 238 26 M 34 26 L 34 150 M 68 26 L 68 150 M 102 26 L 102 150 M 136 26 L 136 150 M 170 26 L 170 150 M 204 26 L 204 150 M 0 57 L 238 57 M 0 88 L 238 88 M 0 119 L 238 119"),
      ...circle(119, 72, 11), ...circle(187, 103, 11),
      ...P("M 246 86 Q 236 96 200 102"),
    ],
    notes: [{ text: "London · March", x: 8, y: 19, size: 15 }, { text: "7 days → all 31", x: 250, y: 80 }],
  },
];
