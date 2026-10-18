import { describe, expect, test } from "vitest";
import { bufferSize, emptyUniforms, eyeOf, LIGHT_FS, lightUniforms, MAX_DPR, PULSE_ORIGIN, sphereFor, TestimonialsLight, type LightFrame } from "./testimonials-light";
import { RIPPLE_GLSL, RIPPLE_UNIFORMS } from "./field";

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

  test("the sphere shows as the slot's ball wherever it is: its outline centred on the slot, about r across both ways, 1.2 radii behind the screen", () => {
    const [w, h] = [1440, 900];
    for (const [x, y, r] of [[720, 450, 107.7], [300, 450, 107.7], [144, 450, 107.7], [1300, 200, 60]]) {
      const { c, rho } = sphereFor(x, y, r, w, h);
      const e = eyeOf(w, h);
      // its outline on the screen (z 0), traced: the rays from the eye that graze the sphere
      const toC = [c[0] - e[0], c[1] - e[1], c[2] - e[2]], D = Math.hypot(...toC), ax = toC.map((v) => v / D);
      const a = Math.asin(rho / D), up = [0, 0, 1];
      const cross = (p: number[], q: number[]) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
      let e1 = cross(ax, up);
      if (Math.hypot(...e1) < 1e-9) e1 = [1, 0, 0];
      e1 = e1.map((v) => v / Math.hypot(...e1));
      const e2 = cross(ax, e1);
      const u = [x - e[0], y - e[1]], ul = Math.hypot(...u) || 1, ux = u[0] / ul || 1, uy = u[1] / ul;
      let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
      for (let i = 0; i < 4000; i++) {
        const t = (i / 4000) * 2 * Math.PI;
        const d = [0, 1, 2].map((k) => ax[k] * Math.cos(a) + (e1[k] * Math.cos(t) + e2[k] * Math.sin(t)) * Math.sin(a));
        const s = -e[2] / d[2], px = e[0] + d[0] * s - x, py = e[1] + d[1] * s - y;
        const along = px * ux + py * uy, across = -px * uy + py * ux;
        a0 = Math.min(a0, along); a1 = Math.max(a1, along); b0 = Math.min(b0, across); b1 = Math.max(b1, across);
      }
      expect((a0 + a1) / 2).toBeCloseTo(0, 3); // (centred on the slot)
      expect((b0 + b1) / 2).toBeCloseTo(0, 3);
      for (const half of [(a1 - a0) / 2, (b1 - b0) / 2]) expect(Math.abs(half / r - 1)).toBeLessThan(0.03); // (the slot's 0.44)
      // 1.2 radii behind the screen along the cone's axis, as the mockup's depth
      expect(D - -e[2] / ax[2]).toBeCloseTo(1.2 * rho, 6);
    }
  });

  test("the ball's opacity: 1 when left out, clamped, 0 with no ball", () => {
    expect(lightUniforms(frame({ ball: { x: 10, y: 10, r: 5 } }), 100, 100, 100, 100).BA).toBe(1);
    expect(lightUniforms(frame({ ball: { x: 10, y: 10, r: 5, a: 0.4 } }), 100, 100, 100, 100).BA).toBe(0.4);
    expect(lightUniforms(frame({ ball: { x: 10, y: 10, r: 5, a: 1.5 } }), 100, 100, 100, 100).BA).toBe(1);
    expect(lightUniforms(frame(), 100, 100, 100, 100).BA).toBe(0);
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
    expect(LIGHT_FS).toContain("if (BR > 0. && BA > 0.)");
    expect(LIGHT_FS).toContain("* aa * BA;");
  });

  test("no WebGL: create returns null", () => {
    const canvas = { getContext: () => null } as unknown as HTMLCanvasElement;
    expect(TestimonialsLight.create(canvas)).toBeNull();
  });
});

describe("no allocation per frame", () => {
  test("sphereFor writes into `out` when given and returns it: the same sphere as a fresh call", () => {
    const out = { c: [9, 9, 9] as [number, number, number], rho: 9 };
    const c = out.c;
    for (const [x, y, r] of [[720, 450, 107.7], [144, 450, 107.7], [1300, 200, 60]]) {
      expect(sphereFor(x, y, r, 1440, 900, out)).toBe(out);
      expect(out.c).toBe(c);
      expect(out).toEqual(sphereFor(x, y, r, 1440, 900));
    }
  });

  test("bufferSize writes into `out` when given and returns it", () => {
    const out = { w: 0, h: 0 };
    expect(bufferSize(1440, 900, 2, out)).toBe(out);
    expect(out).toEqual({ w: 2160, h: 1350 });
    expect(bufferSize(390, 844, 1, out)).toEqual({ w: 390, h: 844 });
  });

  test("lightUniforms writes into `out` when given (its arrays kept): the same uniforms as a fresh call, a frame without the ball clearing it", () => {
    const out = emptyUniforms();
    const arrays = [out.R, out.PO, out.BC, out.BP];
    const frames = [
      frame({ ball: { x: 300, y: 200, r: 80, a: 0.5 }, pulse: 0.3, pulseFrom: "bottom" }),
      frame({ q: 0.4, t: 2 }),
      frame({ ball: { x: 1200, y: 700, r: 60 } }),
    ];
    for (const f of frames) {
      expect(lightUniforms(f, 2160, 1350, 1440, 900, out)).toBe(out);
      [out.R, out.PO, out.BC, out.BP].forEach((a, i) => expect(a).toBe(arrays[i]));
      expect(out).toEqual(lightUniforms(f, 2160, 1350, 1440, 900));
    }
  });
});

describe("the water under the cursor on the light's own ball (round 3, Task 5)", () => {
  const ripple = () => {
    const waves = new Float32Array(16);
    waves.set([0.5, -0.25, 0.4, 0.6], 4); // (ring 1: origin, age, strength)
    return { waves, lean: new Float32Array([0.3, -0.4]) };
  };

  test("the rings and the lean go to RW and RB as given (disc units: nothing to scale), the ball's radius in canvas px", () => {
    const w = ripple();
    const u = lightUniforms(frame({ ball: { x: 720, y: 300, r: 100 }, ripple: w }), 2160, 1350, 1440, 900);
    expect(Array.from(u.RW)).toEqual(Array.from(w.waves));
    expect(u.RB[0]).toBeCloseTo(0.3, 6);
    expect(u.RB[1]).toBeCloseTo(-0.4, 6);
    expect(u.RB[2]).toBeCloseTo(150, 9);
  });

  test("no water without a ball, or with none given; the out object's own arrays are rewritten, never replaced", () => {
    const out = emptyUniforms(), rw = out.RW;
    lightUniforms(frame({ ball: { x: 720, y: 300, r: 100 }, ripple: ripple() }), 1440, 900, 1440, 900, out);
    lightUniforms(frame({ ball: null, ripple: ripple() }), 1440, 900, 1440, 900, out);
    expect(out.RW).toBe(rw);
    expect(Array.from(out.RW).every((v) => v === 0)).toBe(true);
    expect(out.RB).toEqual([0, 0, 0]);
    lightUniforms(frame({ ball: { x: 720, y: 300, r: 100 } }), 1440, 900, 1440, 900, out);
    expect(Array.from(out.RW).every((v) => v === 0)).toBe(true);
    expect(out.RB).toEqual([0, 0, 100]);
  });

  test("the shader takes the shared water (field.ts RIPPLE_GLSL), grows the sphere by the lean and tilts the normal by the rings", () => {
    expect(LIGHT_FS).toContain(RIPPLE_UNIFORMS);
    expect(LIGHT_FS).toContain(RIPPLE_GLSL);
    expect(LIGHT_FS).toContain("float br = BR * (1. + rippleBulge(normalize(q + 1e-5)));");
    expect(LIGHT_FS).toContain("- vec3(rippleSlope(q), 0.)");
    expect(LIGHT_FS).toContain("float aa = clamp(br - dp + .5, 0., 1.);");
  });
});
