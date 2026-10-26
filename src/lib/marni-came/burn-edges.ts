/** The burn along the screen's edges that plays with the music (Liam, 2026-10-26: "bottom-led"). A light burn: it comes
 *  in from the bottom edge, now and then from the sides and the top, and sits behind everything on the page. How loud the
 *  track is sets how far in and how bright it burns; each hit can start a new burn. Every burn is a different shape
 *  (two of the sixteen, crossfading), at its own place, width and length, so it never repeats.
 *
 *  The numbers come from tools/marni-came/energy.py (20 a second, read at the song's current time) and the shapes from
 *  tools/marni-came/burn_edges.py. Pure functions here; the canvas is in components/case-study/marni-came/burn-edges.tsx. */

export type Edge = "b" | "l" | "r" | "t";
export interface Energy { fps: number; level: number[]; hit: number[] }
export interface Burn { edge: Edge; at: number; width: number; a: number; b: number; born: number; life: number; rise: number; flip: boolean }

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
export const SHAPES = 16;

export function decodeEnergy(d: { fps: number; level: string; hit: string }): Energy {
  const dec = (s: string) => Array.from(s, (c) => Math.max(0, B64.indexOf(c)) / 63);
  return { fps: d.fps, level: dec(d.level), hit: dec(d.hit) };
}

/** The level and hit at a time in the track (0 outside it). */
export function sample(e: Energy, time: number): { level: number; hit: number } {
  const i = Math.floor(time * e.fps);
  return i >= 0 && i < e.level.length ? { level: e.level[i], hit: e.hit[i] } : { level: 0, hit: 0 };
}

/** How far each edge's burn reaches in, as a share of the screen's shorter side (its height on a desktop, its width on a
 *  phone, so a phone's sides stay thin too): the bottom leads, the sides and top stay thin. */
export const REACH: Record<Edge, [number, number]> = { b: [0.1, 0.12], l: [0.05, 0.05], r: [0.05, 0.05], t: [0.04, 0.04] };
export const reach = (edge: Edge, level: number) => REACH[edge][0] + REACH[edge][1] * level;

/** The loudness, eased: it rises quickly with the music and falls back slowly, so the burn swells rather than flickers. */
export function follow(current: number, target: number, dt: number): number {
  const k = 1 - Math.exp(-dt / (target > current ? 0.12 : 0.6));
  return current + (target - current) * k;
}

/** A new burn starts on a hit, at most this often: no more than three a second (the brand's flash rule). */
export const MIN_GAP = 0.34;
export const HIT = 0.35;
export const MAX_BURNS = 7;

/** Which edge a new burn comes from: mostly the bottom; the sides more when it's loud; the top rarely. */
export function pickEdge(level: number, r: number): Edge {
  const w: [Edge, number][] = [["b", 1], ["l", 0.2 + 0.25 * level], ["r", 0.2 + 0.25 * level], ["t", 0.08 + 0.17 * level]];
  const total = w.reduce((s, [, v]) => s + v, 0);
  let x = r * total;
  for (const [e, v] of w) { if ((x -= v) < 0) return e; }
  return "b";
}

/** A burn's shape, place and life, from a random source (Math.random in the page, seeded in tests). */
export function makeBurn(edge: Edge, now: number, level: number, rnd: () => number, ambient = false): Burn {
  const a = Math.floor(rnd() * SHAPES);
  const b = (a + 1 + Math.floor(rnd() * (SHAPES - 1))) % SHAPES;
  return {
    edge, a, b, born: now, flip: rnd() < 0.5,
    at: -0.1 + rnd() * 1.2,
    width: 0.3 + rnd() * 0.3,
    // (louder music, shorter burns; the bottom's resting burn lasts longest)
    life: ambient ? 2.5 + rnd() * 2.5 : 0.8 + rnd() * 1.6 * (1.2 - level),
    rise: 0.14 + rnd() * 0.14,
  };
}

/** How bright a burn is at a moment (0..1): a soft rise (never a pop), a hold, a long fade. */
export function envelope(b: Burn, now: number): number {
  const t = now - b.born;
  if (t < 0 || t > b.life) return 0;
  if (t < b.rise) return t / b.rise;
  const fadeFrom = b.life * 0.55;
  return t < fadeFrom ? 1 : 1 - (t - fadeFrom) / (b.life - fadeFrom);
}

/** The burns after one step: the old ones gone, a resting one kept at the bottom, a new one on a hit. */
export function step(burns: Burn[], now: number, level: number, hit: number, lastNew: number, rnd: () => number): { burns: Burn[]; lastNew: number } {
  const live = burns.filter((b) => now - b.born <= b.life);
  if (!live.some((b) => b.edge === "b")) live.push(makeBurn("b", now, level, rnd, true));
  if (hit >= HIT && now - lastNew >= MIN_GAP && live.length < MAX_BURNS) {
    live.push(makeBurn(pickEdge(level, rnd()), now, level, rnd));
    return { burns: live, lastNew: now };
  }
  return { burns: live, lastNew };
}

/** How bright the burns are overall (0..1), from the loudness: dim when it's quiet, never full. */
export const brightness = (level: number) => 0.4 + 0.6 * level;

/** The canvas transform that lays a shape (drawn at x -w/2..w/2, y 0..depth, its lit side at y = depth) along an edge. */
export function edgeTransform(edge: Edge, along: number, depth: number, W: number, H: number): [number, number, number, number, number, number] {
  switch (edge) {
    case "b": return [1, 0, 0, 1, along * W, H - depth];
    case "t": return [1, 0, 0, -1, along * W, depth];
    case "l": return [0, 1, -1, 0, depth, along * H];
    case "r": return [0, 1, 1, 0, W - depth, along * H];
  }
}
