import { describe, expect, test } from "vitest";
import { ballCone, breath, EDGE_COLOURS, EDGE_GLSL, warpTime } from "./field";

describe("the edge light's shared core", () => {
  test("warpTime(0) is 0.4 sin(1.3): the uneven time starts off the beat", () => {
    expect(warpTime(0)).toBeCloseTo(0.4 * Math.sin(1.3), 12);
  });

  test("warpTime follows t + .8 sin(.31t) + .4 sin(.77t + 1.3)", () => {
    const t = 7.25;
    expect(warpTime(t)).toBeCloseTo(t + 0.8 * Math.sin(t * 0.31) + 0.4 * Math.sin(t * 0.77 + 1.3), 12);
  });

  test("breath stays within ±1 over a long run, and moves", () => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let t = 0; t < 600; t += 0.05) {
      const b = breath(warpTime(t));
      lo = Math.min(lo, b);
      hi = Math.max(hi, b);
    }
    expect(lo).toBeGreaterThanOrEqual(-1);
    expect(hi).toBeLessThanOrEqual(1);
    expect(hi - lo).toBeGreaterThan(0.5);
  });

  test("the four colours are the mockup's, C0 to C3", () => {
    expect(EDGE_COLOURS).toEqual(["#ff86e0", "#ff9a3c", "#ffe46a", "#ff5f78"]);
  });

  test("EDGE_GLSL declares field, edgeLight, edgeHit, rimGlint and lampTint", () => {
    expect(EDGE_GLSL).toMatch(/vec3 field\(\s*vec2 uv\s*\)/);
    expect(EDGE_GLSL).toMatch(/float edgeLight\(\s*vec2 px\s*\)/);
    expect(EDGE_GLSL).toMatch(/vec2 edgeHit\(\s*vec2 c,\s*vec2 dir\s*\)/);
    expect(EDGE_GLSL).toMatch(/vec3 rimGlint\(\s*vec3 n,\s*vec3 rd,\s*vec2 fd,\s*vec2 BC\s*\)/);
    expect(EDGE_GLSL).toMatch(/vec3 lampTint\(\s*vec3 glass,\s*vec2 fd,\s*vec2 BC\s*\)/);
  });

  test("EDGE_GLSL keeps the ball's env() and the helpers", () => {
    for (const decl of [/float hash\(/, /float noise\(/, /float sdBox\(/, /float lstep\(/, /float tw\(\)/, /vec3 env\(/]) {
      expect(EDGE_GLSL).toMatch(decl);
    }
  });

  test("EDGE_GLSL declares no uniforms of its own: the includer declares them", () => {
    expect(EDGE_GLSL).not.toMatch(/uniform /);
  });

  test("EDGE_GLSL has balanced braces and parentheses", () => {
    const count = (ch: string) => EDGE_GLSL.split(ch).length - 1;
    expect(count("{")).toBe(count("}"));
    expect(count("(")).toBe(count(")"));
  });
});

/** The outline a cone (axis `phi` off the view's axis toward +x, half-angle `alpha`) draws on the screen z = 1, traced ray
 *  by ray: its extent along x (toward the axis) and along y (across). */
function outlineOf(phi: number, alpha: number) {
  const ax = [Math.sin(phi), 0, Math.cos(phi)], e1 = [Math.cos(phi), 0, -Math.sin(phi)], e2 = [0, 1, 0];
  let x0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < 20000; i++) {
    const t = (i / 20000) * 2 * Math.PI, c = Math.cos(alpha), s = Math.sin(alpha);
    const d = [0, 1, 2].map((k) => ax[k] * c + (e1[k] * Math.cos(t) + e2[k] * Math.sin(t)) * s);
    const x = d[0] / d[2], y = d[1] / d[2];
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return { centre: (x0 + x1) / 2, halfW: (x1 - x0) / 2, halfH: y1 };
}

describe("ballCone: the glass ball's outline wherever the slot is", () => {
  test("straight ahead it is a circle of radius r", () => {
    const { phi, alpha } = ballCone(0, 0.06);
    expect(phi).toBeCloseTo(0, 12);
    expect(Math.tan(alpha)).toBeCloseTo(0.06, 9);
  });

  for (const rho0 of [0.15, 0.35, 0.45]) {
    test(`at ${rho0} off the axis the outline is centred there, its half-axes multiplying to r², each within 5% of r`, () => {
      const r = 0.064;
      const { phi, alpha } = ballCone(rho0, r);
      const o = outlineOf(phi, alpha);
      expect(o.centre).toBeCloseTo(rho0, 6);
      expect(o.halfW * o.halfH).toBeCloseTo(r * r, 7);
      expect(Math.abs(o.halfW / r - 1)).toBeLessThan(0.05);
      expect(Math.abs(o.halfH / r - 1)).toBeLessThan(0.05);
      expect(o.halfW).toBeGreaterThan(o.halfH); // (stretched toward the axis)
    });
  }
});


test("ballCone writes into `out` when given and returns it: the same cone as a fresh call (no allocation per frame)", () => {
  const out = { phi: 9, alpha: 9 };
  for (const [rho, r] of [[0, 0.06], [0.4, 0.05], [-0.3, 0.08]]) {
    expect(ballCone(rho, r, out)).toBe(out);
    expect(out).toEqual(ballCone(rho, r));
  }
});
