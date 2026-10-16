// src/app/about/glass-lean.test.ts
import { describe, expect, it } from "vitest";
import { leanFor } from "./glass-lean";

const look = { x: 0.03, y: -0.02 };
const keep = 1 / 2.2;

describe("leanFor: the lean eases through the glass only while a ball is drawn", () => {
  it("with a ball drawn, it eases to `keep` at full glass and halfway at half glass", () => {
    const full = leanFor(look, true, 1, keep, { x: 0, y: 0 });
    expect(full.x).toBeCloseTo(0.03 * keep);
    expect(full.y).toBeCloseTo(-0.02 * keep);
    expect(leanFor(look, true, 0.5, keep, { x: 0, y: 0 }).x).toBeCloseTo(0.03 * (1 - (1 - keep) / 2));
  });

  it("with no ball drawn (not ours, or no slot), it keeps the full lean even at full glass", () => {
    expect(leanFor(look, false, 1, keep, { x: 0, y: 0 })).toEqual(look);
  });

  it("outside the glass shot it is the full lean either way", () => {
    expect(leanFor(look, true, 0, keep, { x: 0, y: 0 })).toEqual(look);
  });
});
