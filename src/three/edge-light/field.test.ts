import { describe, expect, test } from "vitest";
import {
  ballCone, breath, EDGE_COLOURS, EDGE_GLSL, NO_RIPPLE, rimBulge, RIPPLE_AMP, RIPPLE_BULGE, RIPPLE_GLSL, RIPPLE_K, RIPPLE_LIFE, RIPPLE_MAX,
  RIPPLE_RIM0, RIPPLE_RIM_KEEP, RIPPLE_SLOPE_MAX, RIPPLE_SPEED, slopeCap, RIPPLE_UNIFORMS, RIPPLE_W, rimKeep, rippleHeight, rippleSlope, rippleStrength, warpTime,
} from "./field";

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

describe("the glass ball's water (round 3, Task 5)", () => {
  test("a ring's strength: 0 before it starts, rises quickly, dies away, and is exactly 0 from RIPPLE_LIFE (about 1.5 s)", () => {
    expect(RIPPLE_LIFE).toBeCloseTo(1.5, 9);
    expect(rippleStrength(-0.01)).toBe(0);
    expect(rippleStrength(0)).toBe(0);
    expect(rippleStrength(0.08)).toBeGreaterThan(0.8);
    expect(rippleStrength(RIPPLE_LIFE)).toBe(0);
    expect(rippleStrength(5)).toBe(0);
    // damped: never rises again after its start, and fades smoothly to nothing (no step at the end)
    let prev = rippleStrength(0.08);
    for (let a = 0.09; a < RIPPLE_LIFE; a += 0.01) {
      const k = rippleStrength(a);
      expect(k).toBeLessThanOrEqual(prev + 1e-12);
      prev = k;
    }
    expect(rippleStrength(RIPPLE_LIFE - 0.01)).toBeLessThan(0.002);
  });

  test("its crests travel outward at RIPPLE_SPEED: the biggest wave sits at the front", () => {
    for (const age of [0.3, 0.6, 0.9]) {
      let best = 0, at = 0;
      for (let d = 0.06; d < 2.5; d += 0.002) {
        const h = Math.abs(rippleHeight(d, age));
        if (h > best) { best = h; at = d; }
      }
      expect(Math.abs(at - RIPPLE_SPEED * age)).toBeLessThan(0.2); // (within a crest of the front)
    }
  });

  test("it is a small wave, damped: its height at most RIPPLE_AMP, less as it travels", () => {
    const peak = (age: number) => { let m = 0; for (let d = 0.06; d < 3; d += 0.002) m = Math.max(m, Math.abs(rippleHeight(d, age))); return m; };
    expect(peak(0.1)).toBeLessThanOrEqual(RIPPLE_AMP);
    expect(peak(0.3)).toBeGreaterThan(peak(0.9));
    expect(peak(0.9)).toBeGreaterThan(peak(1.4));
    expect(peak(RIPPLE_LIFE)).toBe(0);
  });

  test("rippleSlope is rippleHeight's slope along the radius (what tilts the normal)", () => {
    const e = 1e-5;
    for (const [d, age] of [[0.4, 0.3], [0.8, 0.6], [1.1, 0.9], [0.3, 0.2]]) {
      const num = (rippleHeight(d + e, age) - rippleHeight(d - e, age)) / (2 * e);
      expect(rippleSlope(d, age)).toBeCloseTo(num, 6);
    }
  });

  test("the slope is kept whole inside RIPPLE_RIM0 and eased to RIPPLE_RIM_KEEP at the rim (the glass bends hardest there)", () => {
    expect(rimKeep(0)).toBe(1);
    expect(rimKeep(RIPPLE_RIM0)).toBe(1);
    expect(rimKeep(1)).toBeCloseTo(RIPPLE_RIM_KEEP, 12);
    expect(rimKeep(0.85)).toBeLessThan(1);
    expect(rimKeep(0.85)).toBeGreaterThan(RIPPLE_RIM_KEEP);
    expect(RIPPLE_GLSL).toContain("return g * (1. - (1. - RIP_RIM_KEEP) * smoothstep(RIP_RIM0, 1., length(q)));");
  });

  test("the rings' summed slope is softly capped: one ring keeps most of its slope, a pile never passes RIPPLE_SLOPE_MAX", () => {
    let one = 0;
    for (let d = 0.06; d < 2; d += 0.001) one = Math.max(one, Math.abs(rippleSlope(d, 0.1)));
    expect(slopeCap(one)).toBeGreaterThan(0.6 * one);
    for (const m of [0.3, 1, 5, 50]) expect(slopeCap(m)).toBeLessThan(RIPPLE_SLOPE_MAX);
    expect(slopeCap(0)).toBe(0);
    expect(slopeCap(0.01)).toBeCloseTo(0.01, 4);
    expect(RIPPLE_GLSL).toContain("g /= sqrt(1. + dot(g, g) / (RIP_SLOPE_MAX * RIP_SLOPE_MAX));");
  });

  test("the outline's lean: at most RIPPLE_BULGE (3% of r), facing the cursor only, as long as the lean", () => {
    expect(RIPPLE_BULGE).toBeLessThanOrEqual(0.03);
    expect(rimBulge(1, 1)).toBeCloseTo(RIPPLE_BULGE, 12);
    expect(rimBulge(1, 3)).toBeCloseTo(RIPPLE_BULGE, 12); // (a longer lean is clamped)
    expect(rimBulge(1, 0.5)).toBeCloseTo(RIPPLE_BULGE / 2, 12);
    expect(rimBulge(0, 1)).toBe(0);
    expect(rimBulge(-0.7, 1)).toBe(0);
    expect(rimBulge(0.5, 1)).toBeCloseTo(RIPPLE_BULGE / 8, 12);
  });

  test("RIPPLE_GLSL is the JS maths: the same numbers, both functions, no uniforms of its own; RIPPLE_UNIFORMS declares them", () => {
    expect(RIPPLE_GLSL).toMatch(/vec2 rippleSlope\(vec2 q\)/);
    expect(RIPPLE_GLSL).toMatch(/float rippleBulge\(vec2 u\)/);
    for (const [name, v] of [["RIP_SPEED", RIPPLE_SPEED], ["RIP_K", RIPPLE_K], ["RIP_W2", RIPPLE_W * RIPPLE_W], ["RIP_AMP", RIPPLE_AMP], ["RIP_BULGE", RIPPLE_BULGE], ["RIP_RIM0", RIPPLE_RIM0], ["RIP_RIM_KEEP", RIPPLE_RIM_KEEP], ["RIP_SLOPE_MAX", RIPPLE_SLOPE_MAX]] as const) {
      const m = RIPPLE_GLSL.match(new RegExp(`const float ${name} = ([0-9.]+);`));
      expect(m).not.toBeNull();
      expect(Number(m![1])).toBeCloseTo(v, 5);
    }
    expect(RIPPLE_GLSL).toContain(`i < ${RIPPLE_MAX}`);
    expect(RIPPLE_GLSL).not.toMatch(/uniform /);
    expect(RIPPLE_UNIFORMS).toContain(`uniform vec4 RW[${RIPPLE_MAX}];`);
    expect(RIPPLE_UNIFORMS).toContain("uniform vec3 RB;");
    const count = (ch: string) => RIPPLE_GLSL.split(ch).length - 1;
    expect(count("{")).toBe(count("}"));
    expect(count("(")).toBe(count(")"));
  });

  test("NO_RIPPLE: no rings, no lean", () => {
    expect(NO_RIPPLE.waves).toHaveLength(RIPPLE_MAX * 4);
    expect(Array.from(NO_RIPPLE.waves).every((v) => v === 0)).toBe(true);
    expect(Array.from(NO_RIPPLE.lean)).toEqual([0, 0]);
  });
});
