// src/three/pendant/glass.test.ts
import { describe, expect, it } from "vitest";
import { distanceFor } from "./camera";
import { EDGE_COLOURS } from "@/three/edge-light/field";
import { GLASS_FINISH_FRAGMENT, GLASS_FRAGMENT, GLASS_IOR, GLASS_MAG, glassAt, glassCone, glassFinishMaterial, glassMaterial } from "./glass";

const D2R = Math.PI / 180;

/** An independent check of the ball's optics: a 2D ray trace (Snell's law at both surfaces) from a camera at the origin
 *  looking down +z, through a sphere at (0, g D) of screen radius r, to the plane z = D. Returns where the ray meets the
 *  plane (world units off the axis), or null if it misses the ball. `sy`: the ray's screen offset as a share of the height. */
function trace(sy: number, g: number, D: number, r: number, fov: number): number | null {
  const t = Math.tan((fov * D2R) / 2);
  const gd = g * D, R = r * 2 * t * gd;
  const refract = (d: number[], n: number[], eta: number) => {
    const c = -(d[0] * n[0] + d[1] * n[1]);
    const k = 1 - eta * eta * (1 - c * c);
    if (k < 0) return null;
    const b = eta * c - Math.sqrt(k);
    return [eta * d[0] + b * n[0], eta * d[1] + b * n[1]];
  };
  let d = [2 * sy * t, 1];
  const len = Math.hypot(d[0], d[1]);
  d = [d[0] / len, d[1] / len];
  const b = -gd * d[1], h = b * b - (gd * gd - R * R);
  if (h < 0) return null;
  const t1 = -b - Math.sqrt(h);
  const p1 = [d[0] * t1, d[1] * t1];
  const T1 = refract(d, [p1[0] / R, (p1[1] - gd) / R], 1 / GLASS_IOR)!;
  const s = -2 * (p1[0] * T1[0] + (p1[1] - gd) * T1[1]);
  const p2 = [p1[0] + T1[0] * s, p1[1] + T1[1] * s];
  const T2 = refract(T1, [-p2[0] / R, -(p2[1] - gd) / R], GLASS_IOR);
  if (!T2 || T2[1] <= 0) return null;
  return p2[0] + T2[0] * ((D - p2[1]) / T2[1]);
}

// the glass shot (az 150, el 8, fov 30, h 0.15) at 1440 x 900 and 1920 x 1080: 0.44 of a 17vw slot, as a share of the height
const SCREENS = [{ name: "1440 x 900", r: (0.44 * 0.17 * 1440) / 900 }, { name: "1920 x 1080", r: (0.44 * 0.17 * 1920) / 1080 }];
const FOV = 30, D = distanceFor(0.15, 30);

describe("glassAt: where the ball sits so the pendant behind it is magnified and upside down", () => {
  for (const { name, r } of SCREENS) {
    it(`at ${name}, a ray near the middle shows the pendant GLASS_MAG times larger, upside down`, () => {
      const g = glassAt(r, FOV);
      const sy = 1e-4;
      const x = trace(sy, g, D, r, FOV)!;
      // without the ball that ray meets the plane at sy x the screen height there (2 D tan(fov/2)), on the same side
      const mag = (sy * 2 * D * Math.tan((FOV * D2R) / 2)) / x;
      expect(mag).toBeCloseTo(-GLASS_MAG, 2);
    });

    it(`at ${name}, the pendant's ends (0.5 off its middle) land inside the ball, not at its rim`, () => {
      const g = glassAt(r, FOV);
      let at: number | null = null;
      for (let sy = 0; sy < r; sy += r / 4000) {
        const x = trace(sy, g, D, r, FOV);
        if (x === null) break;
        if (x <= -0.5) { at = sy / r; break; }
      }
      expect(at).not.toBeNull();
      expect(at!).toBeGreaterThan(0.55); // (it fills the ball, as the storyboard has it)
      expect(at!).toBeLessThan(0.85);
    });

    it(`at ${name}, the ball stays well clear of the pendant`, () => {
      const g = glassAt(r, FOV);
      const R = r * 2 * Math.tan((FOV * D2R) / 2) * g * D;
      expect(D - (g * D + R)).toBeGreaterThan(0.6); // (the pendant reaches about 0.3 toward the camera as it turns)
    });
  }
});

describe("the glass pass's material", () => {
  it("has a uniform for every uniform the shader reads", () => {
    const m = glassMaterial();
    const names = [...GLASS_FRAGMENT.matchAll(/uniform\s+\w+\s+(\w+)\s*;/g)].map((x) => x[1]);
    expect(names.length).toBeGreaterThan(10);
    for (const n of names) expect(Object.keys(m.uniforms)).toContain(n);
    m.dispose();
  });

  it("catches the testimonials' light through the shared field: the lamp's glints tinted here, no rim light left", () => {
    expect(GLASS_FRAGMENT).toContain("vec3 rimGlint(");   // (EDGE_GLSL included)
    expect(GLASS_FRAGMENT).toMatch(/glints \*= lampTint\(/);
    expect(GLASS_FRAGMENT).not.toMatch(/rimColor|rimDir/);
    for (const u of ["R", "T", "A", "PAD", "C0", "C1", "C2", "C3", "BC", "see"]) expect(GLASS_FRAGMENT).toMatch(new RegExp(`uniform \\w+ ${u};`));
  });

  it("its colours are the light's, sRGB 0..1 as the light's shader takes them, and the light starts off (A 0)", () => {
    const m = glassMaterial();
    EDGE_COLOURS.forEach((h, i) => {
      const v = m.uniforms[`C${i}`].value as { x: number; y: number; z: number };
      expect([v.x, v.y, v.z]).toEqual([1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16) / 255));
    });
    expect(m.uniforms.A.value).toBe(0);
    m.dispose();
  });
});

describe("the glass finish pass (after the tone mapping)", () => {
  it("adds the rim glints, leaves the ball out of the dim, and has a uniform for every uniform it reads", () => {
    const glass = glassMaterial();
    const m = glassFinishMaterial(glass.uniforms);
    const names = [...GLASS_FINISH_FRAGMENT.matchAll(/uniform\s+\w+\s+(\w+)\s*;/g)].map((x) => x[1]);
    for (const n of names) expect(Object.keys(m.uniforms)).toContain(n);
    expect(GLASS_FINISH_FRAGMENT).toMatch(/rimGlint\(/);
    // (left out of the dim while it rides its slot; dimmed with the pendant, glints too, while held over the words)
    expect(GLASS_FINISH_FRAGMENT).toMatch(/mix\( dim, 1\.0, cover \* \( 1\.0 - ballDim \) \)/);
    expect(GLASS_FINISH_FRAGMENT).toMatch(/rim \*= mix\( 1\.0, dim, ballDim \)/);
    expect(m.uniforms.ballDim.value).toBe(0);
    m.dispose();
    glass.dispose();
  });

  it("shares the glass pass's sphere and light (the same objects), but has its own frame", () => {
    const glass = glassMaterial();
    const m = glassFinishMaterial(glass.uniforms);
    for (const n of ["centre", "radius", "camWorld", "projInv", "view", "camPos", "R", "T", "A", "BC", "C0"]) expect(m.uniforms[n]).toBe(glass.uniforms[n]);
    expect(m.uniforms.tDiffuse).not.toBe(glass.uniforms.tDiffuse);
    glass.uniforms.A.value = 0.7;
    expect(m.uniforms.A.value).toBe(0.7);
    m.dispose();
    glass.dispose();
  });
});

describe("glassCone: the ball shows at the slot's size wherever the slot is", () => {
  // the camera's z = -1 plane at fov 30 and 16:10: the slot's centre (as tangents) and its 0.44 x 17vw radius
  const t = Math.tan((30 * D2R) / 2), r = 2 * t * ((0.44 * 0.17 * 1440) / 900);
  for (const [x, y] of [[0, 0], [-0.8 * 1.6 * t, 0], [0.8 * 1.6 * t, 0], [0, 0.7 * t], [0.5 * t, -0.5 * t]]) {
    it(`at (${x.toFixed(3)}, ${y.toFixed(3)}) the outline is centred on the slot and r across both ways, within 3.5%`, () => {
      const { dir, sine } = glassCone(x, y, r);
      expect(Math.hypot(...dir)).toBeCloseTo(1, 9);
      // the grazing rays round the cone, met with z = -1
      const ax = dir, a = Math.asin(sine);
      let e1 = [ax[1], -ax[0], 0];
      if (Math.hypot(...e1) < 1e-9) e1 = [1, 0, 0];
      e1 = e1.map((v) => v / Math.hypot(...e1));
      const e2 = [ax[1] * e1[2] - ax[2] * e1[1], ax[2] * e1[0] - ax[0] * e1[2], ax[0] * e1[1] - ax[1] * e1[0]];
      const off = Math.hypot(x, y), ux = off > 0 ? x / off : 1, uy = off > 0 ? y / off : 0;
      let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
      for (let i = 0; i < 4000; i++) {
        const s = (i / 4000) * 2 * Math.PI;
        const d = [0, 1, 2].map((k) => ax[k] * Math.cos(a) + (e1[k] * Math.cos(s) + e2[k] * Math.sin(s)) * Math.sin(a));
        const px = -d[0] / d[2] - x, py = -d[1] / d[2] - y;
        const along = px * ux + py * uy, across = -px * uy + py * ux;
        a0 = Math.min(a0, along); a1 = Math.max(a1, along); b0 = Math.min(b0, across); b1 = Math.max(b1, across);
      }
      expect(Math.abs((a0 + a1) / 2) / r).toBeLessThan(1e-3);
      expect(Math.abs((b0 + b1) / 2) / r).toBeLessThan(1e-3);
      for (const half of [(a1 - a0) / 2, (b1 - b0) / 2]) expect(Math.abs(half / r - 1)).toBeLessThan(0.035);
    });
  }
});


it("glassCone writes into `out` when given and returns it: the same cone as a fresh call (no allocation per frame)", () => {
  const out = { dir: [9, 9, 9] as [number, number, number], sine: 9 };
  const dir = out.dir;
  for (const [x, y, r] of [[0, 0, 0.05], [0.3, -0.1, 0.06], [-0.4, 0.2, 0.04]]) {
    expect(glassCone(x, y, r, out)).toBe(out);
    expect(out.dir).toBe(dir);
    expect(out).toEqual(glassCone(x, y, r));
  }
});
