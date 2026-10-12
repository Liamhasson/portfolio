/**
 * The sketches' strokes (Liam, 2026-10-12: sketches of the real work behind the desk, hand-drawn hairlines that draw
 * themselves on): a small path syntax (M, L, Q, Z, in the sketch's own units, y down) turned into polylines, each stroke
 * timed by its length across the sketch's 0..1 reveal, and built as a thin strip whose vertices carry their reveal time.
 * A deterministic wobble gives the hand.
 */
export type Pt = [number, number];
export type Stroke = Pt[];

const Q_STEPS = 10;

/** M x y, L x y, Q cx cy x y, Z (absolute, space or comma separated) to strokes. */
export function parsePath(d: string): Stroke[] {
  const tok = d.replace(/,/g, " ").trim().split(/\s+/);
  const out: Stroke[] = [];
  let cur: Stroke | null = null;
  let i = 0;
  const num = () => Number(tok[i++]);
  while (i < tok.length) {
    const c = tok[i++];
    if (c === "M") { cur = [[num(), num()]]; out.push(cur); }
    else if (c === "L") cur!.push([num(), num()]);
    else if (c === "Q") {
      const [x0, y0] = cur!.at(-1)!, cx = num(), cy = num(), x = num(), y = num();
      for (let k = 1; k <= Q_STEPS; k++) {
        const t = k / Q_STEPS, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, e = t * t;
        cur!.push(k === Q_STEPS ? [x, y] : [a * x0 + b * cx + e * x, a * y0 + b * cy + e * y]);
      }
    } else if (c === "Z") cur!.push([...cur![0]] as Pt);
  }
  return out;
}

export function rect(x: number, y: number, w: number, h: number): Stroke[] {
  return [[[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]];
}

export function circle(cx: number, cy: number, r: number, n = 40): Stroke[] {
  return [Array.from({ length: n + 1 }, (_, k) => [cx + Math.cos((k / n) * Math.PI * 2) * r, cy + Math.sin((k / n) * Math.PI * 2) * r] as Pt)];
}

const len = (s: Stroke) => s.reduce((a, p, k) => (k ? a + Math.hypot(p[0] - s[k - 1][0], p[1] - s[k - 1][1]) : 0), 0);

/** Each stroke's [start, end] in the sketch's 0..1 reveal: in order, by length, a `pause` share between strokes. */
export function strokeTimes(strokes: Stroke[], pause = 0.08): [number, number][] {
  const lens = strokes.map(len), total = lens.reduce((a, b) => a + b, 0) || 1;
  const gap = strokes.length > 1 ? pause / (strokes.length - 1) : 0, draw = 1 - pause * (strokes.length > 1 ? 1 : 0);
  let t = 0;
  return lens.map((l, k) => { const a = t, b = a + (l / total) * draw; t = b + (k < strokes.length - 1 ? gap : 0); return [a, k === strokes.length - 1 ? 1 : b]; });
}

const wob = (n: number) => { const x = Math.sin(n * 91.345 + 13.7) * 43758.5453; return (x - Math.floor(x)) * 2 - 1; };

/** A stroke as a strip: per point, two vertices (its centre twice: the shader pushes them apart by `side`), its normal,
 *  and its reveal time (the stroke's [start, end] spread along its length). `seed`: the hand's wobble. */
export function strokeStrip(s: Stroke, [t0, t1]: [number, number], seed: number) {
  const L = len(s) || 1;
  const positions: number[] = [], normals: number[] = [], sides: number[] = [], times: number[] = [];
  let acc = 0;
  s.forEach((p, k) => {
    if (k) acc += Math.hypot(p[0] - s[k - 1][0], p[1] - s[k - 1][1]);
    const a = s[Math.max(k - 1, 0)], b = s[Math.min(k + 1, s.length - 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
    // the hand: a slow, small sideways drift along the stroke
    const w = 0.35 * (wob(seed * 17 + acc * 0.05) * 0.6 + wob(seed * 31 + acc * 0.013) * 0.4);
    const x = p[0] + nx * w, y = p[1] + ny * w, t = t0 + (t1 - t0) * (acc / L);
    for (const side of [-1, 1]) { positions.push(x, y); normals.push(nx, ny); sides.push(side); times.push(t); }
  });
  return { positions, normals, sides, times };
}
