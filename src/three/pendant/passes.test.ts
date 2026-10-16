// src/three/pendant/passes.test.ts
import { describe, expect, it } from "vitest";
import { buildEdges, BUILT_AT, SWEEP_SPAN } from "./passes";

describe("buildEdges", () => {
  it("starts with both edges at the left end: all wire", () => {
    const e = buildEdges(0);
    expect(e.eA).toBeCloseTo(-SWEEP_SPAN);
    expect(e.eB).toBeCloseTo(-SWEEP_SPAN);
    expect(e.building).toBe(true);
  });

  it("the wire edge leaves first; the clay edge starts a third of the way in", () => {
    const e = buildEdges(1 / 3);
    expect(e.eA).toBeCloseTo(-SWEEP_SPAN + SWEEP_SPAN); // clamp(0.5) = 0.5 -> the middle
    expect(e.eB).toBeCloseTo(-SWEEP_SPAN); // clamp(0) = 0
  });

  it("keeps the edges ordered (brass | clay | wire) the whole way", () => {
    for (let w = 0; w <= 1; w += 0.01) {
      const e = buildEdges(w);
      expect(e.eB).toBeLessThanOrEqual(e.eA);
    }
  });

  it("ends with both edges at the right end", () => {
    const e = buildEdges(1);
    expect(e.eA).toBeCloseTo(SWEEP_SPAN);
    expect(e.eB).toBeCloseTo(SWEEP_SPAN);
  });

  it("is building until w reaches BUILT_AT", () => {
    expect(buildEdges(BUILT_AT - 0.001).building).toBe(true);
    expect(buildEdges(BUILT_AT).building).toBe(false);
    expect(buildEdges(1).building).toBe(false);
  });

  it("clamps w outside 0..1", () => {
    expect(buildEdges(-3).eA).toBeCloseTo(-SWEEP_SPAN);
    expect(buildEdges(7).eB).toBeCloseTo(SWEEP_SPAN);
  });
});
