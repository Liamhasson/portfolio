import { describe, expect, test } from "vitest";
import { homography, mapPoint, type Pt } from "./homography";

describe("homography (the live index laid over the laptop screen)", () => {
  test("maps the box's corners onto the quad's", () => {
    const quad: [Pt, Pt, Pt, Pt] = [[120, 80], [900, 140], [860, 610], [150, 560]];
    const H = homography(1600, 1000, quad);
    const src: Pt[] = [[0, 0], [1600, 0], [1600, 1000], [0, 1000]];
    src.forEach(([x, y], i) => {
      const [u, v] = mapPoint(H, x, y);
      expect(u).toBeCloseTo(quad[i][0], 6);
      expect(v).toBeCloseTo(quad[i][1], 6);
    });
  });
  test("a scaled rectangle is a plain scale", () => {
    const H = homography(100, 50, [[10, 20], [210, 20], [210, 120], [10, 120]]);
    expect(H[0]).toBeCloseTo(2, 9);
    expect(H[4]).toBeCloseTo(2, 9);
    expect(H[6]).toBeCloseTo(0, 9);
    expect(H[7]).toBeCloseTo(0, 9);
  });
});
