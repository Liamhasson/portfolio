import { describe, expect, test } from "vitest";
import { bufferSize, eyeOf, LIGHT_FS, lightUniforms, MAX_DPR, PULSE_ORIGIN, sphereFor, TestimonialsLight, type LightFrame } from "./testimonials-light";

const frame = (o: Partial<LightFrame> = {}): LightFrame => ({ q: 1, t: 0, pulse: -1, pulseFrom: "right", ball: null, ...o });

describe("the light's uniforms", () => {
  test("the padding is min(50 px, 10% of the shorter side), in canvas px", () => {
    expect(lightUniforms(frame(), 2160, 1350, 1440, 900).PAD).toBeCloseTo(50 * 1.5, 9);
    expect(lightUniforms(frame(), 390, 300, 390, 300).PAD).toBeCloseTo(30, 9);
  });

  test("the ball's centre is flipped to GL's y-up and scaled to canvas px; no ball is radius 0", () => {
    const u = lightUniforms(frame({ ball: { x: 720, y: 300, r: 100 } }), 2160, 1350, 1440, 900);
    expect(u.BC).toEqual([1080, 1350 - 450]);
    expect(u.BR).toBeGreaterThan(150); // (the sphere: behind the screen, so bigger than the disc it shows)
    expect(lightUniforms(frame(), 2160, 1350, 1440, 900).BR).toBe(0);
  });

  test("the sphere shows as a disc of the slot's radius centred on the slot: on the eye's ray through it, its outline meeting the screen at r", () => {
    const [w, h] = [1440, 900];
    for (const [x, y, r] of [[720, 450, 107.7], [300, 450, 107.7], [1300, 200, 60]]) {
      const { c, rho } = sphereFor(x, y, r, w, h);
      const e = eyeOf(w, h);
      // the centre projects back onto (x, y) on the screen (z 0)
      const t = e[2] / (e[2] - c[2]);
      expect(e[0] + (c[0] - e[0]) * t).toBeCloseTo(x, 6);
      expect(e[1] + (c[1] - e[1]) * t).toBeCloseTo(y, 6);
      // the outline's cone: tan = r / (the eye's distance to the point), so the disc on the screen has radius r (straight ahead)
      const D = Math.hypot(c[0] - e[0], c[1] - e[1], c[2] - e[2]), L = Math.hypot(x - e[0], y - e[1], e[2]);
      expect(rho / Math.sqrt(D * D - rho * rho)).toBeCloseTo(r / L, 9);
      // 1.2 radii behind the screen along the ray, as the mockup's depth
      expect(D - L).toBeCloseTo(1.2 * rho, 6);
    }
  });

  test("the pulse starts just outside the right edge's middle (track) or the bottom edge's middle (stack)", () => {
    expect(PULSE_ORIGIN.right).toEqual([1.001, 0.5]);
    expect(PULSE_ORIGIN.bottom).toEqual([0.5, -0.001]);
    expect(lightUniforms(frame({ pulseFrom: "bottom" }), 100, 100, 100, 100).PO).toEqual([0.5, -0.001]);
  });

  test("q is clamped to 0..1; no pulse is −1", () => {
    expect(lightUniforms(frame({ q: 1.4 }), 10, 10, 10, 10).A).toBe(1);
    expect(lightUniforms(frame({ q: -0.2 }), 10, 10, 10, 10).A).toBe(0);
    expect(lightUniforms(frame({ pulse: -1 }), 10, 10, 10, 10).P).toBe(-1);
    expect(lightUniforms(frame({ pulse: 0.4 }), 10, 10, 10, 10).P).toBe(0.4);
  });

  test("the drawing buffer's pixel ratio is capped at 1.5", () => {
    expect(MAX_DPR).toBe(1.5);
    expect(bufferSize(1440, 900, 2)).toEqual({ w: 2160, h: 1350 });
    expect(bufferSize(1440, 900, 1)).toEqual({ w: 1440, h: 900 });
  });
});

describe("the shader", () => {
  test("declares what the shared core needs, and writes premultiplied colour with alpha = its brightest channel", () => {
    expect(LIGHT_FS.startsWith("precision highp float;")).toBe(true);
    for (const u of ["vec2 R", "float T, A, P, PAD", "vec3 C0, C1, C2, C3", "vec2 PO", "vec2 BC", "vec3 BP; uniform float BR"]) expect(LIGHT_FS).toContain(`uniform ${u}`);
    expect(LIGHT_FS).toContain("c = clamp(c, 0., 1.);");
    expect(LIGHT_FS).toContain("gl_FragColor = vec4(c, max(c.r, max(c.g, c.b)));");
    expect(LIGHT_FS).toContain("rimGlint(n, rd, fd, BC)");
    expect(LIGHT_FS).toContain("if (BR > 0.)");
  });

  test("no WebGL: create returns null", () => {
    const canvas = { getContext: () => null } as unknown as HTMLCanvasElement;
    expect(TestimonialsLight.create(canvas)).toBeNull();
  });
});
