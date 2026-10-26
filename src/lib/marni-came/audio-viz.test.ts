import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import { MC_ASSETS } from "./assets";
import { CELL, WINDOW, burnFill, decodeTrack, flatPath, follow, levelAt, wavePath, wavePoints, type TrackData } from "./audio-viz";

const fake = (wave: number[]): TrackData => ({ fps: 20, level: [], hit: [], waveFps: 100, wave });

test("each track's data covers its whole length: loudness 20 a second, waveform 100 a second, all 0..1", () => {
  for (const t of Object.values(MC_ASSETS.tracks)) {
    const d = decodeTrack(JSON.parse(readFileSync(path.join(process.cwd(), "public", t.energy), "utf8")));
    const { duration } = JSON.parse(readFileSync(path.join(process.cwd(), "public", t.peaks), "utf8"));
    expect(d.fps).toBe(20);
    expect(d.waveFps).toBe(100);
    expect(Math.abs(d.level.length / 20 - duration)).toBeLessThan(1);
    expect(Math.abs(d.wave.length / 100 - duration)).toBeLessThan(1);
    for (const v of [...d.level, ...d.wave]) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
  }
});

test("loudness is read at the song's time, and is 0 outside it", () => {
  const d: TrackData = { fps: 20, level: [0.2, 0.9], hit: [0, 0], waveFps: 100, wave: [] };
  expect(levelAt(d, 0.01)).toBe(0.2);
  expect(levelAt(d, 0.07)).toBe(0.9);
  expect(levelAt(d, 3)).toBe(0);
  expect(levelAt(d, -1)).toBe(0);
});

test("the colour swells quickly and cools slowly", () => {
  expect(follow(0, 1, 0.1)).toBeGreaterThan(2 * (1 - follow(1, 0, 0.1)));
});

test("the fill runs the burn ramp: deep amber when quiet, amber in the middle, pale amber when loud", () => {
  expect(burnFill(0)).toEqual([0x8d, 0x48, 0x02]);
  expect(burnFill(0.5)).toEqual([0xb3, 0x6f, 0x0b]);
  expect(burnFill(1)).toEqual([0xff, 0xe1, 0xaa]);
  expect(burnFill(2)).toEqual(burnFill(1));
  expect(burnFill(0.75)[0]).toBeGreaterThan(burnFill(0.5)[0]);
});

test("the line shows the last 1.5 s, newest on the right, its ends flat", () => {
  const wave = Array.from({ length: 1000 }, (_, i) => (i >= 480 && i < 495 ? 1 : 0.2));   // one loud step at 4.8 s
  const pts = wavePoints(fake(wave), 5);
  expect(pts.length).toBeGreaterThanOrEqual(WINDOW / CELL);
  expect(pts[0].y).toBe(0);
  expect(pts.at(-1)!.y).toBe(0);
  const loud = pts.reduce((a, p) => (Math.abs(p.y) > Math.abs(a.y) ? p : a));
  expect(loud.x).toBeGreaterThan(0.8);   // 0.2 s ago: near the right
  for (const p of pts) { expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x).toBeLessThanOrEqual(1); expect(Math.abs(p.y)).toBeLessThanOrEqual(1); }
});

test("as time runs on, the line scrolls left and a step never flips side", () => {
  const wave = Array.from({ length: 1000 }, (_, i) => 0.3 + 0.5 * ((Math.floor(i / 15) * 7) % 5) / 5);
  const a = wavePoints(fake(wave), 5), b = wavePoints(fake(wave), 5.05);
  const step = Math.round(4.5 / CELL);   // a step in the middle of both windows
  const at = (pts: typeof a, t: number) => pts[1 + Math.floor(4.5 / CELL) - Math.floor((t - WINDOW) / CELL)];   // (pts[0] is the flat start)
  const pa = at(a, 5), pb = at(b, 5.05);
  expect(pb.x).toBeLessThan(pa.x);
  expect(Math.sign(pb.y)).toBe(Math.sign(pa.y));
  expect(Math.sign(pa.y)).toBe(step % 2 ? -1 : 1);
});

test("before the track has played 1.5 s the earlier part of the line is flat", () => {
  const pts = wavePoints(fake(Array(1000).fill(0.8)), 0.5);
  expect(pts.filter((p) => p.x < 0.6).every((p) => p.y === 0)).toBe(true);
});

test("the path stays inside its box", () => {
  const d = wavePath([{ x: 0, y: 0 }, { x: 0.25, y: 1 }, { x: 0.5, y: -1 }, { x: 0.75, y: 0.5 }, { x: 1, y: 0 }], 11, 26, 24, 10);
  const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
  const xs = nums.filter((_, i) => i % 2 === 0), ys = nums.filter((_, i) => i % 2 === 1);
  expect(Math.min(...xs)).toBeGreaterThanOrEqual(11 - 3); expect(Math.max(...xs)).toBeLessThanOrEqual(37 + 3);
  expect(Math.min(...ys)).toBeGreaterThanOrEqual(24 - 10 - 3); expect(Math.max(...ys)).toBeLessThanOrEqual(24 + 10 + 3);
  expect(d.startsWith("M11.00,24.00")).toBe(true);
  expect(flatPath(17, 14, 24)).toBe("M17,24 H31");
});
