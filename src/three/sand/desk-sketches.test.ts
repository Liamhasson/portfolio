import { describe, expect, test } from "vitest";
import { SKETCH_FLOAT, SKETCH_HOVER, SKETCH_TIMES, sketchFloat, sketchHover, sketchState } from "./desk-sketches";
import { SKETCHES } from "./sketch-data";

describe("the sketches behind the desk (Liam, 2026-10-12): drawn during the tilt, light 3D motion while drawing", () => {
  test("three sketches of the real work: Pulse, Cyvore, Eventread", () => {
    expect(SKETCHES.map((s) => s.id)).toEqual(["pulse", "cyvore", "eventread"]);
    for (const s of SKETCHES) expect(s.prims.length).toBeGreaterThan(2);
  });
  const notes = (id: string) => SKETCHES.find((s) => s.id === id)!.notes.map((n) => n.text);
  test("Pulse: its four milestone screens, each with its day written above it (Liam, 2026-10-12)", () => {
    const pulse = SKETCHES.find((s) => s.id === "pulse")!;
    const phones = pulse.prims.filter((p) => p.k === "box" && p.h > 100);
    expect(phones).toHaveLength(4);
    expect(notes("pulse")).toEqual(expect.arrayContaining(["Day 7", "Day 30", "Day 60", "Day 90"]));
    for (const [i, day] of ["Day 7", "Day 30", "Day 60", "Day 90"].entries()) {
      const n = pulse.notes.find((x) => x.text === day)!, ph = phones[i] as { x: number; y: number; w: number };
      expect(n.y).toBeLessThan(ph.y);                                     // (above it)
      expect(n.x).toBeGreaterThanOrEqual(ph.x - 4); expect(n.x).toBeLessThan(ph.x + ph.w);
    }
  });
  test("Cyvore: the landing page's wireframe, with the layout's goal written on it", () => {
    expect(notes("cyvore").some((t) => /^goal: every chapter one move away/.test(t))).toBe(true);
  });
  test("Eventread: the product's month, its days critical, threat or safe; no city", () => {
    expect(notes("eventread")).toEqual(expect.arrayContaining(["critical", "threat", "safe"]));
    expect(notes("eventread").join(" ")).not.toMatch(/London/);
  });
  test("nothing before the tilt; each drawn by the tilt's end, staggered left to right; gone early in the glide", () => {
    expect(sketchState(SKETCH_TIMES.from - 0.05, 0, false).opacity).toBe(0);
    const mid = SKETCH_TIMES.from + 0.15;
    expect(sketchState(mid, 0, false).reveal).toBeGreaterThan(sketchState(mid, 2, false).reveal);
    for (const i of [0, 1, 2]) expect(sketchState(SKETCH_TIMES.drawnBy + 0.01, i, false).reveal).toBe(1);
    expect(sketchState(SKETCH_TIMES.gone, 0, false).opacity).toBe(0);
  });
  test("a light tilt and spin while drawing (a few degrees, never more), easing to rest once drawn", () => {
    const drawing = sketchState(SKETCH_TIMES.from + 0.1, 0, false), drawn = sketchState(SKETCH_TIMES.drawnBy + 0.05, 0, false);
    expect(Math.abs(drawing.spin) + Math.abs(drawing.tilt)).toBeGreaterThan(0.03);
    expect(Math.abs(drawing.spin)).toBeLessThan(0.2);   // (under ~11 degrees)
    expect(Math.abs(drawing.tilt)).toBeLessThan(0.2);
    expect(Math.abs(drawn.spin) + Math.abs(drawn.tilt)).toBeLessThan(0.01);
  });
  test("reduced motion: already drawn, still", () => {
    const s = sketchState(SKETCH_TIMES.from + 0.1, 1, true);
    expect(s.reveal).toBe(1);
    expect(s.spin).toBe(0); expect(s.tilt).toBe(0);
  });
  test("they float in space, like Oryzo's (Liam, 2026-10-12): a slow drift and a turn of a few degrees, each out of step", () => {
    let maxMove = 0, maxTurn = 0;
    const a = sketchFloat(0, 0, false), b = sketchFloat(0, 1, false);
    expect(a).not.toEqual(b);   // (out of step with each other)
    for (let t = 0; t < 60; t += 0.25) {
      const f = sketchFloat(t, 0, false);
      maxMove = Math.max(maxMove, Math.hypot(f.x, f.y, f.z));
      maxTurn = Math.max(maxTurn, Math.abs(f.rx), Math.abs(f.ry), Math.abs(f.rz));
      const g = sketchFloat(t + 1 / 60, 0, false);   // (smooth: a frame moves it a hair)
      expect(Math.hypot(g.x - f.x, g.y - f.y, g.z - f.z)).toBeLessThan(0.15);
    }
    expect(maxMove).toBeGreaterThan(SKETCH_FLOAT.move * 0.5);
    expect(maxMove).toBeLessThanOrEqual(SKETCH_FLOAT.move * Math.sqrt(3) + 1e-9);
    expect(maxTurn).toBeGreaterThan(0.01);
    expect(maxTurn).toBeGreaterThan(0.04);   // (visible: Liam, "a bit more visible")
    expect(maxTurn).toBeLessThan(0.07);   // (but never more than ~4 degrees)
  });
  test("reduced motion: they hold still", () => {
    expect(sketchFloat(12.3, 2, true)).toEqual({ x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 });
  });
  test("they stay in the background through the glide, until the camera goes into the screen (Liam, 2026-10-12)", () => {
    for (const p of [2.6, 3.0, 3.3]) expect(sketchState(p, 1, false).opacity).toBe(1);
    expect(sketchState(SKETCH_TIMES.gone, 1, false).opacity).toBe(0);
    expect(SKETCH_TIMES.gone).toBeGreaterThan(3.6);
  });
  test("hover lifts only the part under the cursor: about double at its centre (30% → 60%), nothing past its edge", () => {
    expect(sketchHover(0, 1)).toBeCloseTo(1 + SKETCH_HOVER.lift, 6);
    expect(SKETCH_HOVER.lift * 0.3).toBeGreaterThanOrEqual(0.3 - 1e-9);   // (+30% or more on the 30% base)
    expect(sketchHover(SKETCH_HOVER.radius, 1)).toBe(1);
    expect(sketchHover(SKETCH_HOVER.radius * 0.6, 1)).toBeGreaterThan(1);
    expect(sketchHover(SKETCH_HOVER.radius * 0.6, 1)).toBeLessThan(sketchHover(SKETCH_HOVER.radius * 0.3, 1));
    expect(sketchHover(0, 0)).toBe(1);   // (no cursor, or a finger: as it is)
  });
});

