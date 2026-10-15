import type { Pencil, Pt } from "./pencil";

/**
 * The four notes' stories (Liam, 2026-10-13/14, each approved as a mockup). Each: the insight, written first above the
 * note, then four steps that join a tilted circle around it one by one, each drawn as it passes the front. A step is
 * drawn in its own units around (0, 0) (the mockups' 1600x1000 frame: 100 units = a tenth of its height).
 */
export interface Step { seed: number; base: number; dy?: number; draw(p: Pencil): void }
export interface Story {
  /** the desk mesh it belongs to, its size (m) and its turn on the desk (lookdev.py build_desk) */
  mesh: string;
  size: [number, number];
  rotZ: number;
  /** the paper's two tones (a soft diagonal), the handwriting's image, and the paper's shape */
  paper: [string, string];
  ink: string;
  /** sticky (square) or card (landscape) */
  shape: "sticky" | "card";
  /** the case study it comes from: named on the selection frame's label, which opens it (Liam, 2026-10-15) */
  study: { name: string; href: string };
  insight: { seed: number; draw(p: Pencil): void };
  steps: [Step, Step, Step, Step];
}

// ---------- shapes only one story uses ----------

/** A body map: the standing outline seen from the front. */
function bodyFront(p: Pencil, x: number, y: number, s: number): void {
  const P = (pts: Pt[]) => pts.map(([a, b]): Pt => [x + a * s, y + b * s]), ow = { w: 0.8, a: 0.55, passes: 1 };
  p.loop(x, y - 92 * s, 6 * s, 7.5 * s, ow);
  p.stroke(P([[-4, -84], [-14, -78], [-17, -60], [-21, -42], [-20, -38]]), ow); p.stroke(P([[4, -84], [14, -78], [17, -60], [21, -42], [20, -38]]), ow);
  p.stroke(P([[-13, -74], [-12, -52], [-11, -40], [-10, -20], [-9, 0]]), ow); p.stroke(P([[13, -74], [12, -52], [11, -40], [10, -20], [9, 0]]), ow);
  p.stroke(P([[-2, 0], [-2, -20], [0, -38], [2, -20], [2, 0]]), ow);
}

/** A leg from the side: thigh, knee, shin; hurt, the knee shaded dark with pain marks round it. */
function leg(p: Pencil, x: number, y: number, s: number, hurt: boolean): void {
  const P = (pts: Pt[]) => pts.map(([a, b]): Pt => [x + a * s, y + b * s]), ow = { w: 0.95, a: 0.6 };
  p.stroke(P([[-8, -100], [-6, -70], [-3, -50], [-6, -25], [-5, 0]]), ow); p.stroke(P([[10, -100], [11, -72], [9, -50], [6, -25], [5, 0]]), ow);
  p.stroke(P([[-5, 0], [16, 1]]), { ...ow, passes: 0 });
  p.loop(x + 3 * s, y - 50 * s, 8 * s, 7 * s, { w: 0.8, a: 0.5 });
  if (hurt) {
    const k = P([[-4, -60], [10, -60], [10, -41], [-4, -41]]);
    p.hatch(k, { gap: 1.6, a: 0.5 }); p.hatch(k, { gap: 2, a: 0.35, ang: 0.6 });
    for (const [a, b, d] of [[-22, -58, -1], [-22, -44, -1], [26, -60, 1], [26, -42, 1]])
      p.stroke(P([[a, b], [a + 4 * d, b - 3], [a + 8 * d, b + 2], [a + 12 * d, b - 2]]), { w: 0.7, a: 0.5, passes: 0, smooth: false });
  }
}

/** A puzzle piece: a square with a knob (+1), a socket (-1) or a flat edge (0) on each side (top, right, bottom, left). */
function piece(p: Pencil, cx: number, cy: number, s: number, tabs: number[]): Pt[] {
  const h = s / 2, pts: Pt[] = [], corners: Pt[] = [[-h, -h], [h, -h], [h, h], [-h, h]];
  for (let e = 0; e < 4; e++) {
    const [ax, ay] = corners[e], [bx, by] = corners[(e + 1) % 4], nx = (by - ay) / s, ny = -(bx - ax) / s;
    for (let i = 0; i <= 12; i++) {
      const u = i / 12;
      let x = ax + (bx - ax) * u, y = ay + (by - ay) * u;
      const k = Math.abs(u - 0.5) < 0.17 ? Math.sqrt(1 - ((u - 0.5) / 0.17) ** 2) : 0;
      x += nx * tabs[e] * k * s * 0.2; y += ny * tabs[e] * k * s * 0.2;
      pts.push([cx + x, cy + y]);
    }
  }
  p.stroke(pts, { w: 1, a: 0.62 });
  return pts;
}

/** A light bulb, clicking on: rays as pencil strokes (never a glow). */
function bulb(p: Pencil, x: number, y: number, r: number): void {
  p.loop(x, y, r, r * 1.08, { w: 1.05, a: 0.7 });
  p.stroke([[x - r * 0.55, y + r * 0.85], [x - r * 0.45, y + r * 1.35]], { w: 0.9, a: 0.6, passes: 1 }); p.stroke([[x + r * 0.55, y + r * 0.85], [x + r * 0.45, y + r * 1.35]], { w: 0.9, a: 0.6, passes: 1 });
  for (let i = 0; i < 3; i++) p.line([x - r * 0.48, y + r * (1.4 + i * 0.2)], [x + r * 0.48, y + r * (1.4 + i * 0.2)], { w: 0.8, a: 0.55, passes: 0, ov: 1 });
  p.stroke([[x - r * 0.3, y + r * 0.6], [x - r * 0.25, y - r * 0.1], [x - r * 0.1, y + r * 0.15], [x, y - r * 0.15], [x + r * 0.1, y + r * 0.15], [x + r * 0.25, y - r * 0.1], [x + r * 0.3, y + r * 0.6]], { w: 0.8, a: 0.65, passes: 1, smooth: false });
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * (0.12 + i * 0.127), r0 = r * 1.45, r1 = r * (1.85 + (i % 2) * 0.2);
    p.line([x + r0 * Math.cos(a), y + r0 * Math.sin(a)], [x + r1 * Math.cos(a), y + r1 * Math.sin(a)], { w: 0.9, a: 0.6, passes: 0, ov: 1 });
  }
}

/** A person with arms folded: the sceptic. */
function crossedFigure(p: Pencil, X: number, Y: number, H: number, o: { coat?: boolean; sway?: number }): void {
  p.figure(X, Y, H, { ...o, noArms: true });
  const k = H / 100, P = (pts: Pt[]) => pts.map(([x, y]): Pt => [X + x * k, Y + y * k]), ow = { w: 1, a: 0.62, passes: 2 };
  p.stroke(P([[-16, -70], [-19, -60], [-17, -52]]), ow); p.stroke(P([[16, -70], [19, -60], [17, -52]]), ow);
  p.stroke(P([[-17, -52], [-6, -58], [10, -61], [15, -59]]), ow); p.stroke(P([[17, -51], [6, -55], [-10, -57], [-15, -55]]), ow);
  p.hatch(P([[-14, -60], [14, -62], [16, -54], [-14, -52]]), { gap: 1.8, a: 0.3 });
}

function button(p: Pencil, x: number, y: number, w: number, h: number, text: string, size: number): void {
  p.rrect(x - w / 2, y - h / 2, w, h, h / 2, { w: 1.1, a: 0.72, passes: 2 });
  p.words(x, y + size * 0.34, [[text, 1]], size, { align: "center" });
}

const insightCircle = (p: Pencil, rx: number) => { p.loop(0, 12, rx, 62, { w: 1.1, a: 0.7 }); p.loop(4, 15, rx + 4, 58, { w: 0.8, a: 0.35 }); };

export const STORIES: Story[] = [
  // ---------- 1 · "Who is this product for?" · Cyvore: the audience growing ----------
  {
    mesh: "sticky_hero", size: [0.076, 0.076], rotZ: -0.21, paper: ["#efe0b0", "#e0cc95"], ink: "/lab/notes/who-for.png", shape: "sticky", study: { name: "Cyvore", href: "/cyvore" },
    insight: { seed: 71, draw(p) {
      p.words(0, -20, [["Attackers don't target companies.", 0]], 23, { align: "center", rot: -0.02, a: 0.7 });
      p.words(0, 14, [["They target ", 0], ["the person", 1]], 23, { align: "center", rot: -0.02, a: 0.7 });
      p.words(0, 46, [["most likely to click.", 0]], 23, { align: "center", rot: -0.02, a: 0.7 });
      p.loop(0, 12, 256, 70, { w: 1.1, a: 0.7 }); p.loop(4, 15, 260, 66, { w: 0.8, a: 0.35 });
    } },
    steps: [
      { seed: 11, base: 1.0, draw(p) {   // the CTO's mum, the message that started it
        p.figure(-60, 70, 150, { phone: true, skirt: true, bun: true, build: 0.95, sway: 0.02 });
        p.box(0, -110, 150, -48);
        p.stroke([[20, -50], [-4, -18], [-38, 18]], { w: 0.8, a: 0.4, passes: 0 });
        p.words(14, -82, [["you've won!", 0]], 20); p.words(14, -60, [["click here", 0]], 16, { a: 0.5 });
        p.words(-150, 124, [["the CTO's ", 0], ["mum", 1]], 29); p.words(-138, 156, [["a side project", 0]], 20, { a: 0.5 });
      } },
      { seed: 23, base: 0.95, draw(p) {   // elderly, not tech-savvy
        p.figure(-95, 60, 168, { phone: true, hunch: 0.1, skirt: true, bun: true });
        p.figure(-5, 64, 178, { cane: true, hunch: 0.2, hat: true, coat: true });
        p.figure(85, 58, 170, { phone: true, hunch: 0.12, coat: true });
        p.words(-130, 122, [["elderly,", 1]], 31); p.words(-100, 156, [["not tech-savvy", 0]], 29);
      } },
      { seed: 37, base: 0.8, draw(p) {   // attacks happen to everyone: a crowd, quick gesture figures, all kinds
        const crowd = [[-215, -20, 92], [-165, -34, 100], [-110, -16, 96], [-54, -38, 104], [4, -22, 94], [60, -36, 102], [114, -18, 92], [168, -32, 98], [222, -16, 90], [-140, 40, 84], [-28, 48, 88], [86, 44, 86], [198, 38, 82]];
        crowd.forEach(([x, y, h], i) => p.figure(x, y, h, { phone: i % 3 === 0, skirt: i % 4 === 1, coat: i % 5 === 2, hat: i % 6 === 4, flip: i % 2 === 1, quick: true, passes: 1, a: 0.55 }));
        p.words(-230, 92, [["cyber attacks happen to ", 0], ["everyone", 1]], 29);
      } },
      { seed: 53, base: 0.72, draw(p) {   // banks, armies, institutions (no words: the buildings say it)
        const P = (x: number, y: number): Pt => [x - 380, y - 800];
        p.guide(P(60, 935), P(700, 935), 60); p.guide(P(95, 770), P(365, 770), 50); p.guide(P(230, 690), P(230, 935), 30);
        p.line(P(92, 770), P(230, 712)); p.line(P(230, 712), P(368, 770)); p.line(P(92, 770), P(368, 770));
        p.loop(...P(230, 748), 16, 9, { w: 0.8, a: 0.45 });
        p.line(P(96, 782), P(364, 782)); p.line(P(96, 770), P(96, 782)); p.line(P(364, 770), P(364, 782));
        for (let i = 0; i < 6; i++) {
          const x = 112 + i * 44;
          p.line(P(x, 786), P(x, 912), { w: 0.9 }); p.line(P(x + 18, 786), P(x + 18, 912), { w: 0.9 }); p.line(P(x - 3, 786), P(x + 21, 786), { w: 0.8 });
          if (i < 5) p.hatch([P(x + 18, 788), P(x + 44, 788), P(x + 44, 910), P(x + 18, 910)], { gap: 2.6, a: 0.3 });
        }
        p.line(P(96, 914), P(364, 914)); p.line(P(88, 924), P(372, 924)); p.line(P(80, 934), P(380, 934));
        p.line(P(400, 935), P(400, 640)); p.line(P(400, 640), P(500, 632)); p.line(P(500, 632), P(500, 935));
        p.line(P(500, 632), P(534, 646)); p.line(P(534, 646), P(534, 935));
        p.hatch([P(500, 632), P(534, 646), P(534, 935), P(500, 935)], { gap: 2.4, a: 0.34, ang: -1.2 });
        for (let r = 0; r < 9; r++) for (let q = 0; q < 3; q++) {
          const x = 414 + q * 29, y = 656 + r * 30, o = { w: 0.65, a: 0.42, passes: 0 };
          p.line(P(x, y), P(x + 16, y - 1), o); p.line(P(x + 16, y - 1), P(x + 16, y + 16), o); p.line(P(x, y), P(x, y + 17), o);
        }
        p.line(P(560, 935), P(560, 830)); p.line(P(560, 830), P(668, 826)); p.line(P(668, 826), P(668, 935));
        p.line(P(612, 828), P(612, 724), { w: 0.8 });
        const flag = [P(612, 726), P(636, 722), P(656, 732), P(640, 744), P(612, 748)];
        p.stroke(flag, { w: 0.9, a: 0.55 }); p.hatch(flag, { gap: 2.2, a: 0.35 });
      } },
    ],
  },
  // ---------- 2 · "What would make this fail?" · Pulse: the Injury Log ----------
  {
    mesh: "sticky_b", size: [0.076, 0.076], rotZ: 0.52, paper: ["#f1d3cd", "#e2b6b0"], ink: "/lab/notes/make-fail.png", shape: "sticky", study: { name: "Pulse", href: "/pulse" },
    insight: { seed: 73, draw(p) {
      p.words(0, -2, [["A feature's name is a ", 0], ["promise", 1], [".", 0]], 23, { align: "center", rot: -0.02, a: 0.7 });
      p.words(0, 34, [["'Injury Log' promised a doctor.", 0]], 23, { align: "center", rot: -0.02, a: 0.7 });
      insightCircle(p, 250);
    } },
    steps: [
      { seed: 13, base: 0.95, draw(p) {   // the Injury Log: a body map, a sore knee, the app's confident reply
        p.phone(-40, -150, 132, 250);
        p.words(-86, -112, [["Injury Log", 1]], 17);
        bodyFront(p, -62, 20, 1.15);
        p.loop(-51, -2, 7, 6, { w: 1, a: 0.7 }); p.hatch([[-57, -8], [-45, -8], [-45, 4], [-57, 4]], { gap: 1.4, a: 0.5 });
        p.stroke([[-48, -6], [-20, -30], [2, -34]], { w: 0.6, a: 0.4, passes: 0 });
        p.words(4, -30, [["sore", 0]], 14, { a: 0.7 });
        p.line([-92, 46], [12, 46], { w: 0.7, a: 0.5, passes: 0 });
        for (let i = 0; i < 6; i++) p.line([-92 + i * 20.8, 41], [-92 + i * 20.8, 51], { w: 0.5, a: 0.4, passes: 0, ov: 1 });
        p.loop(-30, 46, 4, 4, { w: 1, a: 0.7 });
        p.rrect(-94, 62, 108, 30, 8, { w: 0.8, a: 0.55 }); p.hatch([[-94, 62], [14, 62], [14, 92], [-94, 92]], { gap: 3.4, a: 0.14 });
        p.line([-84, 73], [-10, 73], { w: 0.6, a: 0.45, passes: 0 }); p.line([-84, 82], [-30, 82], { w: 0.6, a: 0.35, passes: 0 });
        p.words(-40, 142, [["your ", 0], ["recovery plan", 1], [" is ready", 0]], 27, { align: "center" });
      } },
      { seed: 29, base: 0.88, draw(p) {   // what testers heard: a doctor behind it
        p.figure(-130, 110, 160, { phone: true, coat: true, sway: -0.03 });
        p.loop(-98, -50, 4.5, 4, { w: 0.8, a: 0.5 }); p.loop(-74, -66, 7.5, 6.5, { w: 0.8, a: 0.5 });
        const cl: Pt[] = [];
        for (let i = 0; i <= 90; i++) { const t = (i / 90) * Math.PI * 2.08, r = 1 + 0.1 * Math.sin(t * 7); cl.push([62 + 108 * r * Math.cos(t), -60 + 72 * r * Math.sin(t)]); }
        p.stroke(cl, { w: 1, a: 0.55, passes: 1 });
        const d = (pts: Pt[]) => pts.map(([x, y]): Pt => [x + 40, y + 92]);
        p.loop(50, -76, 12, 14, { w: 0.95, a: 0.65 });
        p.stroke(d([[-26, -108], [-18, -138], [0, -150], [20, -150], [38, -138], [46, -108]]), { w: 0.95, a: 0.6 });
        p.stroke(d([[2, -150], [10, -122], [18, -150]]), { w: 0.8, a: 0.55 });
        p.stroke(d([[-4, -150], [-10, -134], [-6, -118], [4, -112]]), { w: 0.8, a: 0.6 }); p.stroke(d([[24, -150], [30, -134], [26, -122]]), { w: 0.8, a: 0.6 });
        p.loop(48, -18, 5, 5, { w: 0.9, a: 0.7 }); p.hatch([[43, -23], [53, -23], [53, -13], [43, -13]], { gap: 1.4, a: 0.5 });
        p.words(118, -34, [["?", 1]], 50);
        p.words(-20, 158, [["is there a real ", 0], ["doctor", 1], [" behind this?", 0]], 26, { align: "center" });
      } },
      { seed: 41, base: 0.78, draw(p) {   // what could go wrong: a wrong entry, confident advice, a worse knee, and it's on us
        p.ctx.save(); p.ctx.translate(60 * p.S, 0);
        p.guide([-300, 40], [300, 40], 30);
        leg(p, -250, 40, 1.05, false); p.words(-282, -78, [["sore", 0]], 18, { a: 0.75 });
        p.words(-238, -78, [["torn", 0]], 13, { a: 0.45 }); p.line([-240, -84], [-206, -86], { w: 0.6, a: 0.45, passes: 0, ov: 1 });
        p.rrect(-150, -60, 104, 74, 9, { w: 0.9, a: 0.6 });
        p.words(-138, -36, [["plan", 1]], 16); p.words(-138, -14, [["keep running", 0]], 13, { a: 0.7 }); p.words(-138, 4, [["light stretches", 0]], 13, { a: 0.55 });
        leg(p, 14, 40, 1.05, true);
        const g = (x: number, y: number): Pt => [104 + x, -30 + y];
        const head = [g(0, 0), g(48, -28), g(60, -8), g(12, 20), g(0, 0)];
        p.stroke(head, { w: 1, a: 0.65, smooth: false }); p.hatch(head.slice(0, 4), { gap: 2.2, a: 0.32 });
        p.line(g(30, 6), g(86, 92), { w: 1 }); p.line(g(36, 2), g(92, 88), { w: 0.8, a: 0.5 });
        p.rrect(124, 68, 86, 20, 5, { w: 0.95, a: 0.6 }); p.hatch([g(20, 98), g(106, 98), g(106, 118), g(20, 118)], { gap: 2, a: 0.3 });
        p.words(-20, 120, [["liability", 1], [" risk", 0]], 31, { align: "center" });
        p.ctx.restore();
      } },
      { seed: 67, base: 0.8, draw(p) {   // the reframe: the screen drawn again (two earlier tries beneath), now the Training Log
        p.ctx.save(); p.ctx.globalAlpha = 0.35; p.phone(-24, -168, 150, 270, { a: 0.4, passes: 0 }); p.phone(-14, -162, 150, 270, { a: 0.45, passes: 0 }); p.ctx.restore();
        p.phone(0, -156, 150, 270);
        p.words(-52, -110, [["Injury", 0]], 15, { a: 0.55 }); p.line([-56, -115], [4, -117], { w: 1.1, a: 0.8, ov: 3 });
        p.words(-56, -128, [["Training", 1]], 17); p.words(18, -110, [["Log", 1]], 17);
        p.rrect(-62, -92, 124, 46, 8, { w: 0.8, a: 0.55 });
        p.words(-54, -74, [["weekly goal", 0]], 12, { a: 0.6 });
        p.rrect(-54, -64, 108, 9, 4, { w: 0.7, a: 0.55 }); p.hatch([[-54, -64], [22, -64], [22, -55], [-54, -55]], { gap: 1.5, a: 0.5 });
        p.rrect(-62, -38, 58, 38, 7, { w: 0.75, a: 0.5 }); p.rrect(4, -38, 58, 38, 7, { w: 0.75, a: 0.5 });
        p.words(-56, -22, [["focus", 0]], 11, { a: 0.55 }); p.words(-56, -8, [["strength", 0]], 12, { a: 0.7 }); p.words(10, -22, [["weekly", 0]], 11, { a: 0.55 }); p.words(10, -6, [["3", 1]], 15);
        for (let i = 0; i < 3; i++) { const y = 14 + i * 22; p.rrect(-62, y, 124, 18, 5, { w: 0.65, a: 0.45, passes: 0 }); p.line([-54, y + 9], [-10, y + 9], { w: 0.55, a: 0.4, passes: 0, ov: 1 }); }
        p.words(0, 156, [["from guiding recovery to tracking ", 0], ["habits", 1]], 25, { align: "center" });
        p.words(0, 186, [["round 2: no one raised it", 0]], 18, { a: 0.5, align: "center" });
      } },
    ],
  },
  // ---------- 3 · "Who does this better?" · Eventread: the gap between them ----------
  {
    mesh: "sticky_c", size: [0.076, 0.076], rotZ: -0.35, paper: ["#efe0b0", "#e0cc95"], ink: "/lab/notes/does-better.png", shape: "sticky", study: { name: "Eventread", href: "/eventread" },
    insight: { seed: 79, draw(p) {
      p.words(0, -2, [["Nobody did it better.", 0]], 23, { align: "center", rot: -0.02, a: 0.7 });
      p.words(0, 34, [["The answer was ", 0], ["between", 1], [" them.", 0]], 23, { align: "center", rot: -0.02, a: 0.7 });
      insightCircle(p, 236);
    } },
    steps: [
      { seed: 17, base: 0.95, draw(p) {   // picking a date: the wall calendar, a date circled, question marks gathering round
        const X0 = 0, Y0 = -96, CW = 26, CH = 24, B = Y0 + 26 + 5 * CH;
        p.guide([X0, Y0], [X0 + 7 * CW, Y0], 18); p.guide([X0, Y0], [X0, B], 14);
        p.line([X0, Y0], [X0 + 7 * CW, Y0 + 2]); p.line([X0 + 7 * CW, Y0 + 2], [X0 + 7 * CW - 2, B]); p.line([X0 + 7 * CW - 2, B], [X0 + 2, B + 2]); p.line([X0 + 2, B + 2], [X0, Y0]);
        p.line([X0 + 2, Y0 + 24], [X0 + 7 * CW - 2, Y0 + 25], { w: 0.8, a: 0.5 });
        for (let i = 1; i < 7; i++) p.line([X0 + i * CW, Y0 + 25], [X0 + i * CW, B], { w: 0.55, a: 0.32, passes: 0, ov: 1 });
        for (let j = 1; j < 5; j++) p.line([X0 + 2, Y0 + 25 + j * CH], [X0 + 7 * CW - 2, Y0 + 25 + j * CH], { w: 0.55, a: 0.32, passes: 0, ov: 1 });
        const dx = X0 + 4 * CW, dy = Y0 + 25 + 2 * CH;
        p.hatch([[dx + 2, dy + 2], [dx + CW - 2, dy + 2], [dx + CW - 2, dy + CH - 2], [dx + 2, dy + CH - 2]], { gap: 2, a: 0.4 }); p.loop(dx + CW / 2, dy + CH / 2, 20, 16, { w: 1.1, a: 0.75 });
        p.figure(-96, 130, 178, { coat: true, sway: 0.03 });
        p.stroke([[-70, -6], [-50, -30], [-36, -46]], { w: 1.1, a: 0.7, passes: 1 });
        p.words(-206, -18, [["?", 1]], 44, { rot: -0.2 }); p.words(-150, -96, [["?", 0]], 28, { rot: 0.2, a: 0.7 });
        p.words(-196, 78, [["?", 0]], 30, { rot: 0.1, a: 0.7 }); p.words(-46, -82, [["?", 1]], 34, { rot: 0.12 });
        p.words(-30, 62, [["?", 0]], 26, { rot: -0.12, a: 0.65 }); p.words(196, -56, [["?", 1]], 36, { rot: 0.08 });
      } },
      { seed: 31, base: 0.9, dy: 28, draw(p) {   // what exists: three tools, a piece each, the pieces don't meet
        const cols = [-168, 0, 168], what = [["books the venue's", "calendar"], ["routes", "the tour"], ["answers", "in general"]];
        const tabs = [[0, -1, 1, 0], [1, 1, -1, 1], [-1, 0, 0, 1]];
        cols.forEach((x, i) => {
          p.rrect(x - 72, -150, 144, 118, 10, { w: 0.9, a: 0.6 }); p.line([x - 72, -132], [x + 72, -131], { w: 0.7, a: 0.45, passes: 0 });
          for (let d = 0; d < 3; d++) p.loop(x - 60 + d * 9, -141, 2.4, 2.4, { w: 0.6, a: 0.5 });
          p.hatch(piece(p, x + (i - 1) * 8, -80, 52, tabs[i]), { gap: 3, a: 0.25 });
          p.words(x, 8, [[what[i][0], 0]], 19, { align: "center", a: 0.75 }); p.words(x, 32, [[what[i][1], 0]], 19, { align: "center", a: 0.75 });
        });
        p.words(0, 100, [["competitors each answer ", 0], ["part", 1], [" of it", 0]], 27, { align: "center" });
      } },
      { seed: 43, base: 0.9, dy: 44, draw(p) {   // the light bulb over the gap, and the formula that covers it
        const L = piece(p, -128, -112, 54, [0, 1, 0, 0]), R = piece(p, 128, -112, 54, [0, 0, 0, -1]);
        p.hatch(L, { gap: 3, a: 0.22 }); p.hatch(R, { gap: 3, a: 0.22 });
        p.guide([-92, -112], [92, -112], 6);
        bulb(p, 0, -150, 22);
        const f: [string, 0 | 1][] = [["danger = ", 0], ["capacity", 1], [" × ", 0], ["genre", 1], [" × ", 0], ["timing", 1]];
        const size = 25, total = f.reduce((s, [t, k]) => s + p.measure(t, size, !!k), 0);
        p.words(0, -30, f, size, { align: "center" });
        const fill: Record<string, number> = { capacity: 1, genre: 1, timing: 0.6 };
        let x = -total / 2;
        for (const [t, k] of f) {
          const w = p.measure(t, size, !!k);
          if (k) { p.rrect(x + 2, -14, w - 4, 9, 4, { w: 0.7, a: 0.55, passes: 0 }); p.hatch([[x + 2, -14], [x + 2 + (w - 4) * fill[t], -14], [x + 2 + (w - 4) * fill[t], -5], [x + 2, -5]], { gap: 1.6, a: 0.5 }); }
          x += w;
        }
        p.words(0, 64, [["No one covers the ", 0], ["gap", 1]], 30, { align: "center" });
      } },
      { seed: 59, base: 0.9, dy: 40, draw(p) {   // the scan: every field at once, through the month, down to one safe date
        const ix = [-96, -32, 32, 96], iy = -150;
        p.rrect(ix[0] - 15, iy - 9, 30, 18, 3, { w: 0.8, a: 0.6 }); p.line([ix[0] + 5, iy - 9], [ix[0] + 5, iy + 9], { w: 0.55, a: 0.45, passes: 0, ov: 1 });
        p.loop(ix[1], iy - 6, 6, 7, { w: 0.8, a: 0.6 }); p.line([ix[1], iy + 1], [ix[1], iy + 14], { w: 0.8, a: 0.6 }); p.hatch([[ix[1] - 5, iy - 12], [ix[1] + 5, iy - 12], [ix[1] + 5, iy - 1], [ix[1] - 5, iy - 1]], { gap: 1.5, a: 0.4 });
        p.loop(ix[2], iy, 11, 11, { w: 0.8, a: 0.6 }); p.stroke([[ix[2] - 4, iy - 3], [ix[2] + 4, iy - 3], [ix[2] + 5, iy + 3], [ix[2], iy + 6], [ix[2] - 5, iy + 3], [ix[2] - 4, iy - 3]], { w: 0.7, a: 0.55, passes: 0, smooth: false });
        p.line([ix[3] - 8, iy + 14], [ix[3] - 8, iy - 14], { w: 0.8, a: 0.6 }); p.stroke([[ix[3] - 8, iy - 13], [ix[3] + 10, iy - 9], [ix[3] - 8, iy - 3]], { w: 0.8, a: 0.6, passes: 0, smooth: false });
        const gx = -105, gy = -112, cw = 30, ch = 24;
        for (let r = 0; r <= 5; r++) p.line([gx, gy + r * ch], [gx + 7 * cw, gy + r * ch], { w: 0.55, a: 0.35, passes: 0, ov: 1 });
        for (let q = 0; q <= 7; q++) p.line([gx + q * cw, gy], [gx + q * cw, gy + 5 * ch], { w: 0.55, a: 0.35, passes: 0, ov: 1 });
        for (const [q, r] of [[1, 0], [4, 1], [5, 1], [2, 2], [6, 3], [0, 4], [3, 4]])
          p.hatch([[gx + q * cw + 2, gy + r * ch + 2], [gx + (q + 1) * cw - 2, gy + r * ch + 2], [gx + (q + 1) * cw - 2, gy + (r + 1) * ch - 2], [gx + q * cw + 2, gy + (r + 1) * ch - 2]], { gap: 2, a: 0.32 });
        for (const [q, r] of [[4, 1], [6, 3]]) p.words(gx + q * cw + 12, gy + r * ch + 18, [["!", 1]], 15);
        p.hatch([[gx + 3.4 * cw, gy - 26], [gx + 4.2 * cw, gy - 26], [gx + 4.2 * cw, gy + 5 * ch + 8], [gx + 3.4 * cw, gy + 5 * ch + 8]], { gap: 4, a: 0.14, ang: 1.45 });
        p.line([gx + 4.2 * cw, gy - 30], [gx + 4.2 * cw, gy + 5 * ch + 10], { w: 1, a: 0.7 });
        p.loop(gx + 3 * cw + cw / 2, gy + 3 * ch + ch / 2, 19, 15, { w: 1.1, a: 0.75 });
        p.stroke([[gx + 3 * cw + cw / 2 + 18, gy + 3 * ch + 4], [128, -40]], { w: 0.6, a: 0.45, passes: 0 });
        p.rrect(124, -58, 96, 34, 17, { w: 1, a: 0.7 });
        p.stroke([[136, -41], [143, -34], [156, -50]], { w: 1.2, a: 0.8, passes: 1, smooth: false });
        p.words(162, -34, [["safe", 1]], 20);
        p.words(0, 76, [["every field scanned, one ", 0], ["safe", 1], [" date", 0]], 27, { align: "center" });
      } },
    ],
  },
  // ---------- 4 · "What do they check before they commit?" · Nordic Logic: winning a sceptic's trust ----------
  {
    mesh: "card_a", size: [0.127, 0.076], rotZ: -0.34, paper: ["#f4f0e7", "#e6e0d3"], ink: "/lab/notes/check-commit-card.png", shape: "card", study: { name: "Nordic Logic", href: "/nordic-logic" },
    insight: { seed: 83, draw(p) {
      p.words(0, -2, [["Knowing they can ", 0], ["decide", 1]], 23, { align: "center", rot: -0.02, a: 0.7 });
      p.words(0, 34, [["is what makes a stranger trust it.", 0]], 23, { align: "center", rot: -0.02, a: 0.7 });
      insightCircle(p, 250);
    } },
    steps: [
      { seed: 19, base: 0.95, draw(p) {   // the sceptic, asked by a company he's never heard of
        crossedFigure(p, -110, 120, 186, { coat: true, sway: -0.01 });
        p.box(10, -112, 150, 54);
        p.guide([10, -112], [10, 56], 12);
        p.words(24, -78, [["send your", 0]], 17, { a: 0.8 }); p.words(24, -56, [["invoices", 1]], 17);
        p.words(24, -22, [["sign a power", 0]], 17, { a: 0.8 }); p.words(24, 0, [["of attorney", 1]], 17);
        p.line([26, 34], [130, 33], { w: 0.7, a: 0.5, passes: 0 }); p.words(26, 30, [["x", 0]], 14, { a: 0.6 });
        p.words(-206, -40, [["?", 1]], 40, { rot: -0.2 }); p.words(-40, -70, [["?", 0]], 28, { rot: 0.15, a: 0.7 }); p.words(-196, 66, [["?", 0]], 26, { rot: 0.1, a: 0.65 });
        p.words(0, 150, [["a stranger is being asked", 0]], 24, { align: "center" });
        p.words(0, 180, [["to ", 0], ["trust", 1], [" in a new company", 0]], 24, { align: "center" });
      } },
      { seed: 33, base: 0.92, draw(p) {   // the differentiators: level on price, different on what matters
        const x0 = -200, x1 = 222, xm = -20;
        p.guide([x0, -150], [x1, -150], 14); p.guide([xm, -150], [xm, 50], 10);
        p.words(-110, -128, [["them", 0]], 18, { align: "center", a: 0.55 }); p.words(85, -128, [["us", 1]], 20, { align: "center" });
        p.line([x0, -118], [x1, -117], { w: 0.8, a: 0.5 });
        p.words(-110, -92, [["35%", 0]], 19, { align: "center", a: 0.6 }); p.words(85, -92, [["35%", 0]], 19, { align: "center", a: 0.85 }); p.words(xm, -92, [["=", 1]], 22, { align: "center" });
        p.line([x0, -78], [x1, -77], { w: 0.55, a: 0.32, passes: 0 });
        const rows = [["a trial, or a demo", "one CSV, free breakdown"], ["one of four products", "only the audit"], ["automated claims", "one named person"]];
        rows.forEach(([a, b], i) => {
          const y = -52 + i * 34;
          p.words(-110, y, [[a, 0]], 16, { align: "center", a: 0.45 }); p.words(85, y, [[b, 0]], 17, { align: "center", a: 0.9 });
          p.stroke([[200, y - 8], [205, y - 3], [214, y - 15]], { w: 1.1, a: 0.8, passes: 1, smooth: false });
          p.line([x0, y + 12], [x1, y + 13], { w: 0.5, a: 0.28, passes: 0 });
        });
        p.hatch([[xm + 4, -62], [x1 - 30, -62], [x1 - 30, 52], [xm + 4, 52]], { gap: 5, a: 0.08 });
        p.words(0, 106, [["present ", 0], ["differentiators", 1]], 28, { align: "center" });
      } },
      { seed: 47, base: 0.92, draw(p) {   // show the work first: one CSV becomes the full breakdown
        p.box(-170, -120, -60, 10);
        p.words(-152, -96, [["CSV", 1]], 18);
        for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) p.line([-158 + q * 32, -78 + r * 18], [-136 + q * 32, -78 + r * 18], { w: 0.5, a: 0.4, passes: 0, ov: 1 });
        p.box(-40, -140, 130, 34);
        p.hatch([[-40, -140], [130, -138], [128, 34], [-38, 36]], { gap: 6, a: 0.05 });
        p.words(-26, -114, [["full breakdown", 1]], 17);
        [312, 48, 1270, 96].forEach((v, r) => { const y = -88 + r * 22; p.line([-26, y], [60, y], { w: 0.55, a: 0.4, passes: 0, ov: 1 }); p.words(80, y + 4, [["$" + v, 0]], 14, { a: 0.7 }); });
        p.line([-26, 6], [116, 5], { w: 0.9, a: 0.6 }); p.words(-26, 24, [["total", 0]], 15, { a: 0.7 }); p.words(72, 24, [["$1,726", 1]], 16);
        p.words(0, 72, [["nothing to connect · nothing signed", 0]], 17, { align: "center", a: 0.6 });
        p.words(0, 116, [["show the ", 0], ["work", 1], [" before asking", 0]], 28, { align: "center" });
      } },
      { seed: 61, base: 0.92, draw(p) {   // the decision: continue or walk away, drawn with the same weight, the scale level
        p.line([0, -150], [0, -64]); p.line([-26, -62], [26, -62]); p.loop(0, -152, 4, 4, { w: 0.9, a: 0.6 });
        p.line([-130, -146], [130, -146], { w: 1.1 });
        p.guide([-170, -146], [170, -146], 20);
        for (const s of [-1, 1]) {
          const px = s * 124;
          p.line([px, -146], [px - 22, -108], { w: 0.7, a: 0.5, passes: 0 }); p.line([px, -146], [px + 22, -108], { w: 0.7, a: 0.5, passes: 0 });
          p.stroke([[px - 30, -108], [px - 18, -98], [px + 18, -98], [px + 30, -108], [px - 30, -108]], { w: 0.9, a: 0.6 });
        }
        button(p, -95, -10, 150, 44, "continue", 21);
        button(p, 95, -10, 150, 44, "walk away", 21);
        p.words(0, 58, [["the same weight, either way", 0]], 16, { align: "center", a: 0.55 });
        p.words(0, 106, [["continue", 1], [" or ", 0], ["walk away", 1]], 30, { align: "center" });
      } },
    ],
  },
];

export const storyFor = (mesh: string): Story | undefined => STORIES.find((s) => s.mesh === mesh);
