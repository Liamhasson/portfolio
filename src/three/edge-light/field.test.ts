import { describe, expect, test } from "vitest";
import { breath, EDGE_COLOURS, EDGE_GLSL, warpTime } from "./field";

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
