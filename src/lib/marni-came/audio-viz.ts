/** The case study's audio button (Liam, 2026-10-26, after lusion.co's): a round button at the bottom of the screen. Off,
 *  a flat line and the word Audio. On, its fill follows the track's loudness in the burn colours (deep amber when quiet,
 *  pale amber when loud) and its line draws the track's real waveform, the last second and a half, scrolling as it plays.
 *
 *  The numbers come from tools/marni-came/energy.py, read at the song's current time (Web Audio is never used: routing the
 *  page's <audio> through it can leave a phone silent). Pure functions here; the button is
 *  components/case-study/marni-came/audio-button.tsx. */

export interface TrackData { fps: number; level: number[]; hit: number[]; waveFps: number; wave: number[] }

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const dec = (s: string) => Array.from(s, (c) => Math.max(0, B64.indexOf(c)) / 63);

export function decodeTrack(d: { fps: number; level: string; hit: string; waveFps: number; wave: string }): TrackData {
  return { fps: d.fps, level: dec(d.level), hit: dec(d.hit), waveFps: d.waveFps, wave: dec(d.wave) };
}

/** The loudness at a time in the track (0 outside it). */
export function levelAt(d: TrackData, time: number): number {
  const i = Math.floor(time * d.fps);
  return i >= 0 && i < d.level.length ? d.level[i] : 0;
}

/** Eased toward a target: quick to rise, slow to fall, so the colour swells with the music rather than flickering. */
export function follow(current: number, target: number, dt: number, up = 0.12, down = 0.6): number {
  return current + (target - current) * (1 - Math.exp(-dt / (target > current ? up : down)));
}

/** The burn colour for a loudness: the brand's ramp, 8D4802 (quiet) → B36F0B → FFE1AA (loud). */
const RAMP: [number, [number, number, number]][] = [[0, [0x8d, 0x48, 0x02]], [0.5, [0xb3, 0x6f, 0x0b]], [1, [0xff, 0xe1, 0xaa]]];
export function burnFill(level: number): [number, number, number] {
  const l = Math.min(1, Math.max(0, level));
  const i = l <= 0.5 ? 0 : 1;
  const [a, ca] = RAMP[i], [b, cb] = RAMP[i + 1];
  const k = (l - a) / (b - a);
  return [0, 1, 2].map((j) => Math.round(ca[j] + (cb[j] - ca[j]) * k)) as [number, number, number];
}

/** The waveform the line draws: the last WINDOW seconds in CELL-long steps, each step's highest point, alternately up
 *  and down. Steps sit on the track's own clock, so the line scrolls smoothly and a step never flips side. x runs 0..1
 *  across the window (newest on the right), y -1..1; both ends fade to the middle so the line starts and ends flat. */
export const WINDOW = 1.5, CELL = 0.15;
const EDGE = 0.15;
export function wavePoints(d: TrackData, time: number): { x: number; y: number }[] {
  const from = time - WINDOW, out: { x: number; y: number }[] = [{ x: 0, y: 0 }];
  for (let c = Math.floor(from / CELL); c <= Math.floor(time / CELL); c++) {
    const a = Math.max(0, Math.floor(c * CELL * d.waveFps)), b = Math.min(d.wave.length, Math.ceil(Math.min((c + 1) * CELL, time) * d.waveFps));
    let v = 0;
    for (let i = a; i < b; i++) v = Math.max(v, d.wave[i]);
    const x = Math.min(1, Math.max(0, ((c + 0.5) * CELL - from) / WINDOW));
    const fade = Math.max(0, Math.min(1, x / EDGE, (1 - x) / EDGE));
    out.push({ x, y: (c % 2 ? -1 : 1) * v * fade });
  }
  out.push({ x: 1, y: 0 });
  return out;
}

/** An SVG path through the points (Catmull-Rom as cubic Béziers), drawn in a box: x0..x0+w across, mid ± amp. */
export function wavePath(pts: { x: number; y: number }[], x0: number, w: number, mid: number, amp: number): string {
  if (pts.length < 2) return flatPath(x0, w, mid);
  const P = pts.map((p) => [x0 + p.x * w, mid - p.y * amp]);
  const f = (n: number) => n.toFixed(2);
  let d = `M${f(P[0][0])},${f(P[0][1])}`;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])},${f(p2[1])}`;
  }
  return d;
}

export const flatPath = (x0: number, w: number, mid: number) => `M${x0},${mid} H${x0 + w}`;
