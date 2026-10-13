/**
 * The notes' pencil (Liam, 2026-10-13/14, approved in the mockups): graphite drawn on a 2D canvas the way a hand draws,
 * so each sketch can draw itself on. Every line in loose passes that land a little off the last, pressure swelling and
 * tapering, the hand's tremor; construction guides that run past what they build; hatching with a rubbed tone under it;
 * handwriting with one key word pressed harder. Every mark is counted, so a sketch drawn with a `limit` stops part-way
 * (the draw-on). Deterministic: a seed draws it the same every time.
 *
 * Units: a sketch is drawn in its own units around (0, 0); `S` canvas px per unit.
 */
export type Pt = [number, number];
export type Run = [string, 0 | 1];   // a run of words, 1 = the key word

export interface StrokeOpts { w?: number; a?: number; passes?: number; wob?: number; jit?: number; smooth?: boolean; ov?: number }

export class Pencil {
  /** canvas px per unit */
  S = 2;
  font = "cursive";
  private seed = 7;
  /** the draw-on: only marks numbered in (from, limit] are made; the randomness is used up all the same, so the
   *  drawing holds, and a sheet can be drawn on a little more each frame without redrawing what's there */
  used = 0;
  limit = Infinity;
  from = -1;

  constructor(readonly ctx: CanvasRenderingContext2D) {}

  reset(seed: number, limit: number, from = -1): void { this.seed = seed; this.used = 0; this.limit = limit; this.from = from; }

  private makes(u: number): boolean { return u > this.from && u <= this.limit; }

  rnd(): number { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }
  R(a: number, b: number): number { return a + (b - a) * this.rnd(); }

  private catmull(pts: Pt[], step = 2): Pt[] {
    if (pts.length < 3) return pts;
    const out: Pt[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, pts.length - 1)];
      const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
      for (let j = 0; j < n; j++) {
        const t = j / n, t2 = t * t, t3 = t2 * t;
        out.push([
          0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        ]);
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  private resample(pts: Pt[], step = 1.6): Pt[] {
    const out: Pt[] = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(L / step));
      for (let j = 1; j <= n; j++) out.push([ax + (bx - ax) * j / n, ay + (by - ay) * j / n]);
    }
    return out;
  }

  /** One graphite stroke: passes that land a little apart, pressure swelling and tapering, the hand trembling. */
  stroke(pts: Pt[], o: StrokeOpts = {}): void {
    const { ctx, S } = this;
    const w = (o.w ?? 1.1) * 1.25, a = Math.min(1, (o.a ?? 0.55) * 1.35), passes = (o.passes ?? 2) + 1, wob = (o.wob ?? 0.7) * 1.5;
    const jit = o.jit ?? 1.1;
    const J: Pt[] = o.smooth === false ? pts : pts.map(([x, y]) => [x + this.R(-jit, jit), y + this.R(-jit, jit)]);
    const P = this.resample(o.smooth === false ? J : this.catmull(J));
    for (let p = 0; p < passes; p++) {
      const ph = [this.R(0, 6.28), this.R(0, 6.28)], fr = [this.R(0.015, 0.03), this.R(0.05, 0.09)];
      const off = p ? this.R(-2.2, 2.2) : 0, pa = p ? this.R(0.35, 0.7) : 1, s0 = this.R(0, 0.06), s1 = this.R(0.94, 1);
      let d = 0;
      for (let i = 1; i < P.length; i++) {
        if (!this.makes(++this.used)) continue;
        const t = i / (P.length - 1);
        if (p && (t < s0 || t > s1)) continue;
        const [ax, ay] = P[i - 1], [bx, by] = P[i], L = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / L, ny = (bx - ax) / L;
        d += L;
        const n = off + wob * (Math.sin(d * fr[0] + ph[0]) + 0.5 * Math.sin(d * fr[1] + ph[1]));
        const pr = Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, t))), 0.55) * (0.75 + 0.25 * Math.sin(d * 0.04 + ph[1]));
        ctx.globalAlpha = a * pa * (0.25 + 0.75 * pr);
        ctx.lineWidth = S * w * (0.45 + 0.75 * pr);
        ctx.beginPath(); ctx.moveTo(S * (ax + nx * n), S * (ay + ny * n)); ctx.lineTo(S * (bx + nx * n), S * (by + ny * n)); ctx.stroke();
      }
    }
  }

  /** A loose line that bows a little and overshoots its ends. */
  line(a: Pt, b: Pt, o: StrokeOpts = {}): void {
    const ov = o.ov ?? this.R(2, 7), dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    const bow = Math.min(L * 0.012, 2.5) * this.R(-1, 1);
    const m: Pt = [(a[0] + b[0]) / 2 - uy * bow, (a[1] + b[1]) / 2 + ux * bow];
    this.stroke([[a[0] - ux * ov * 0.4, a[1] - uy * ov * 0.4], m, [b[0] + ux * ov, b[1] + uy * ov]], o);
  }

  /** A construction guide: long, straight, faint, running past what it builds. */
  guide(a: Pt, b: Pt, reach = 40): void { this.line(a, b, { ov: reach, w: 0.55, a: 0.2, passes: 0, wob: 0.3 }); }

  /** An imperfect ellipse that runs past its start. */
  loop(cx: number, cy: number, rx: number, ry: number, o: StrokeOpts = {}): void {
    const t0 = this.R(0, 6.28), turns = 1 + this.R(0.08, 0.3), pts: Pt[] = [];
    for (let i = 0; i <= 60 * turns; i++) {
      const t = t0 + (i / 60) * 6.283, k = 1 + 0.06 * Math.sin(t * 2 + t0) + this.R(-0.01, 0.01);
      pts.push([cx + rx * k * Math.cos(t), cy + ry * k * Math.sin(t)]);
    }
    this.stroke(pts, { passes: 0, ...o });
  }

  private path(poly: Pt[]): void {
    const { ctx, S } = this;
    ctx.beginPath();
    poly.forEach(([x, y], i) => (i ? ctx.lineTo(S * x, S * y) : ctx.moveTo(S * x, S * y)));
    ctx.closePath();
  }

  /** Hatching inside a shape: quick parallel strokes, uneven ends, a rubbed tone under them. */
  hatch(poly: Pt[], o: { gap?: number; ang?: number; a?: number; w?: number } = {}): void {
    const { ctx, S } = this;
    const gap = o.gap ?? 3.2, ang = o.ang ?? -0.95, a = o.a ?? 0.32;
    if (this.makes(this.used + 1)) { ctx.save(); ctx.globalAlpha = a * 0.45; ctx.filter = `blur(${S * 3}px)`; this.path(poly); ctx.fill(); ctx.restore(); }
    ctx.save(); this.path(poly); ctx.clip();
    const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
    const x0 = Math.min(...xs) - 40, x1 = Math.max(...xs) + 40, y0 = Math.min(...ys) - 40, y1 = Math.max(...ys) + 40;
    const c = Math.cos(ang), s = Math.sin(ang), span = Math.hypot(x1 - x0, y1 - y0), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    for (let k = -span / 2; k < span / 2; k += gap * this.R(0.8, 1.25)) {
      const px = cx - s * k, py = cy + c * k, L = span / 2;
      this.stroke([[px - c * L * this.R(0.8, 1), py - s * L * this.R(0.8, 1)], [px + c * L * this.R(0.8, 1), py + s * L * this.R(0.8, 1)]], { smooth: false, w: o.w ?? 0.7, a, passes: 0, wob: 0.25 });
    }
    ctx.restore();
  }

  /** The width of a run of handwriting, in units. */
  measure(t: string, size: number, key = false): number {
    const { ctx, S } = this;
    ctx.save(); ctx.font = `${S * size * (key ? 1.22 : 1)}px ${this.font}`;
    const w = ctx.measureText(t).width / S;
    ctx.restore();
    return w;
  }

  /** Handwriting: runs of words, the key ones pressed harder and a touch larger. */
  words(x: number, y: number, runs: Run[], size: number, o: { align?: "left" | "center"; rot?: number; a?: number } = {}): void {
    const u = this.used + 1; this.used += 60; if (!this.makes(u)) return;
    const { ctx, S } = this;
    ctx.save(); ctx.translate(S * x, S * y); ctx.rotate(o.rot || 0);
    const font = (k: number) => `${S * size * (k ? 1.22 : 1)}px ${this.font}`;
    let total = 0;
    for (const [t, k] of runs) { ctx.font = font(k); total += ctx.measureText(t).width; }
    let cx = o.align === "center" ? -total / 2 : 0;
    for (const [t, k] of runs) {
      ctx.font = font(k);
      if (k) { ctx.globalAlpha = 1; for (const [dx, dy] of [[0, 0], [0.9, 0.3], [-0.5, 0.6], [0.4, -0.5]]) ctx.fillText(t, cx + dx * S, dy * S); }
      else { ctx.globalAlpha = o.a ?? 0.62; ctx.fillText(t, cx, 0); }
      cx += ctx.measureText(t).width;
    }
    ctx.restore();
  }

  // ---------- the shapes the stories share ----------

  /** A rounded box in one loose loop. */
  rrect(x: number, y: number, w: number, h: number, r: number, o: StrokeOpts = {}): void {
    const pts: Pt[] = [];
    const arc = (cx: number, cy: number, a0: number) => { for (let i = 0; i <= 6; i++) { const a = a0 + (i / 6) * Math.PI / 2; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
    arc(x + w - r, y + r, -Math.PI / 2); arc(x + w - r, y + h - r, 0); arc(x + r, y + h - r, Math.PI / 2); arc(x + r, y + r, Math.PI); pts.push([x + w - r + 4, y]);
    this.stroke(pts, o);
  }

  /** A loose four-sided box (paper, a screen). */
  box(x0: number, y0: number, x1: number, y1: number, o: StrokeOpts = {}): void {
    this.line([x0, y0], [x1, y0 + 2], o); this.line([x1, y0 + 2], [x1 - 2, y1], o); this.line([x1 - 2, y1], [x0 + 2, y1 + 2], o); this.line([x0 + 2, y1 + 2], [x0, y0], o);
  }

  /** A phone, its top at y, centred on x. */
  phone(x: number, y: number, w: number, h: number, o: StrokeOpts = {}): void {
    this.guide([x - w / 2, y], [x + w / 2, y], 18); this.guide([x - w / 2, y], [x - w / 2, y + h], 14);
    this.rrect(x - w / 2, y, w, h, 14, o); this.line([x - 12, y + 9], [x + 12, y + 9], { w: 0.8, a: 0.5, passes: 0 });
  }

  /**
   * A person, drawn from contours: 100 units tall, feet at (X, Y). Each their own build and stance. phone | cane | none
   * for the near arm; skirt, coat, bun, hat; hunch (a lean from the hips); noArms (another drawing supplies them).
   */
  figure(X: number, Y: number, H: number, o: { phone?: boolean; cane?: boolean; skirt?: boolean; coat?: boolean; bun?: boolean; hat?: boolean; hunch?: number; sway?: number; build?: number; flip?: boolean; quick?: boolean; passes?: number; a?: number; w?: number; noArms?: boolean } = {}): void {
    const k = H / 100, flip = o.flip ? -1 : 1, hunch = o.hunch || 0;
    const sw = o.build ?? this.R(0.86, 1.16), hd = this.R(0.9, 1.12), sway = o.sway ?? this.R(-0.06, 0.06), tilt = this.R(-2.5, 2.5);
    const T = ([x, y]: Pt): Pt => {
      const lean = (y < -40 ? (-y - 40) * hunch : 0) + -y * sway;
      const wx = y < -30 ? x * sw : x * (1 + (sw - 1) * 0.5);
      return [X + flip * (wx + lean) * k, Y + y * k];
    };
    const tl = (pts: Pt[]) => pts.map(T), ow: StrokeOpts = { w: o.w ?? 1, a: o.a ?? 0.6, passes: o.passes ?? 2 };
    if (!o.quick) { this.guide(T([0, -100]), T([0, 4]), 6); this.guide(T([-22, -72]), T([22, -72]), 4); }
    const [hx, hy] = T([tilt * 0.4, -89]); this.loop(hx, hy, 6.4 * k * hd, 7.8 * k * hd, { w: ow.w, a: ow.a });
    if (o.bun) { const [bx, by] = T([-4 + tilt * 0.3, -97.5]); this.loop(bx, by, 3 * k, 2.6 * k, { w: (ow.w ?? 1) * 0.9, a: ow.a }); }
    if (o.hat) { this.stroke(tl([[-9, -93], [0, -99], [9, -93]]), ow); this.stroke(tl([[-12, -92.5], [12, -92.5]]), ow); }
    const L: Pt[] = [[-3.5, -81], [-5, -77.5], [-13, -74.5], [-16, -70], [-15.5, -60], [-12.5, -48], [-13, -40]];
    const Rr: Pt[] = L.map(([x, y]) => [-x, y]);
    this.stroke(tl(L), ow); this.stroke(tl(Rr), ow);
    this.stroke(tl(L.slice(2, 5)), { ...ow, a: (ow.a ?? 0.6) * 0.5, passes: 0 }); this.stroke(tl(Rr.slice(3, 7)), { ...ow, a: (ow.a ?? 0.6) * 0.45, passes: 0 });
    if (o.coat) { this.stroke(tl([[0, -77], [0.5, -50], [0, -24]]), { ...ow, a: (ow.a ?? 0.6) * 0.6, passes: 0 }); this.stroke(tl([[-13, -40], [-14, -30], [-14.5, -24], [14.5, -24], [14, -30], [13, -40]]), ow); }
    if (o.skirt) {
      this.stroke(tl([[-13, -40], [-15.5, -30], [-18, -19]]), ow); this.stroke(tl([[13, -40], [15.5, -30], [18, -19]]), ow);
      this.stroke(tl([[-18, -19], [-6, -17.5], [6, -17.5], [18, -19]]), ow);
      this.stroke(tl([[-6, -18], [-5.5, -9], [-5, -1]]), ow); this.stroke(tl([[6, -18], [5.5, -9], [5, -1]]), ow);
      this.hatch(tl([[2, -46], [13, -40], [15.5, -30], [18, -19], [2, -18]]), { gap: (2.6 * k) / 1.4 + 1.2, a: 0.26 });
    } else {
      this.stroke(tl([[-13, -40], [-11.5, -22], [-9.5, -9], [-8, -1]]), ow); this.stroke(tl([[13, -40], [11.5, -22], [9.5, -9], [8, -1]]), ow);
      this.stroke(tl([[-3, -1], [-3, -15], [-1.5, -30], [0, -36], [1.5, -30], [3, -15], [3, -1]]), ow);
      this.hatch(tl([[2, -74], [13, -74], [16, -70], [15.5, -60], [12.5, -48], [13, -40], [11.5, -22], [9.5, -9], [8, -1], [3, -1], [3, -15], [1.5, -30], [2, -50]]), { gap: (2.6 * k) / 1.4 + 1.2, a: 0.3 });
      this.hatch(tl([[8, -74], [13, -74], [16, -70], [15.5, -60], [12.5, -48], [13, -40], [11.5, -22], [9.5, -9], [8, -1], [6, -1], [7, -40]]), { gap: (3 * k) / 1.4 + 1.4, a: 0.22, ang: 0.55 });
    }
    const dim = { ...ow, a: (ow.a ?? 0.6) * 0.8 };
    if (!o.noArms) { this.stroke(tl([[-16, -70], [-19.5, -58], [-20.5, -47], [-19, -37]]), ow); this.stroke(tl([[-13.5, -62], [-15, -52], [-15.5, -38]]), dim); }
    if (o.noArms) { /* (supplied by the caller) */ }
    else if (o.phone) {
      this.stroke(tl([[16, -70], [19, -60], [17.5, -53], [10, -57], [6.5, -61]]), ow); this.stroke(tl([[13.5, -62], [13.5, -58], [9, -60.5]]), dim);
      const ph = tl([[2.5, -69], [8.5, -69], [8.5, -58.5], [2.5, -58.5], [2.5, -69]]); this.stroke(ph, { ...ow, smooth: false, passes: 0 });
      this.hatch(ph, { gap: 1.6, a: 0.4 });
    } else if (o.cane) {
      this.stroke(tl([[16, -70], [20, -60], [22, -50], [24, -46]]), ow); this.stroke(tl([[13.5, -62], [16.5, -53], [20, -46]]), dim);
      this.stroke(tl([[20, -47], [23, -49], [26, -47], [27, -43], [29, 0]]), ow);
    } else { this.stroke(tl([[16, -70], [19.5, -58], [20.5, -47], [19, -37]]), ow); this.stroke(tl([[13.5, -62], [15, -52], [15.5, -38]]), dim); }
    this.stroke(tl([[-8, -1], [-12, 0]]), { ...ow, passes: 0 }); this.stroke(tl([[8, -1], [12, 0]]), { ...ow, passes: 0 });
    this.guide([X - 26 * k, Y + 1], [X + 26 * k, Y + 1], 10);
  }
}
