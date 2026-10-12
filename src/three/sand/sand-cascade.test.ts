// src/three/sand/sand-cascade.test.ts
import { expect, test } from "vitest";
import { SAND_FRAGMENT, SAND_VERTEX } from "./shaders";

test("the sand's vertex shader runs the cascade by grain index, reading its ancestors' rest spots from a texture", () => {
  expect(SAND_VERTEX).toMatch(/uniform highp usampler2D uRestWords;/);
  expect(SAND_VERTEX).toMatch(/vec3 cascadeRest\(int i\)/);
  expect(SAND_VERTEX).toMatch(/cascadeAt\(gl_VertexID, uCascade\.x\)/);
  // unborn grains are not drawn
  expect(SAND_VERTEX).toMatch(/caSize/);
});

test("the light comes up through one factor on the sand's radiance (no new rig, no glow)", () => {
  expect(SAND_FRAGMENT).toMatch(/uniform float uLightK;/);
  expect(SAND_FRAGMENT).toMatch(/col \*= uLightK;/);
});

test("the grains build the vortex as they arrive (Liam, 2026-10-12: they formed the plain cloud first): the cascade places a grain before the hero's motion acts on it, so it flies inside the vortex", () => {
  const cascade = SAND_VERTEX.indexOf("cascadeAt(gl_VertexID, uCascade.x)");
  const swirl = SAND_VERTEX.indexOf("swirlAt(p, swSeed");
  expect(cascade).toBeGreaterThan(0);
  expect(cascade).toBeLessThan(swirl);
  expect(SAND_VERTEX).not.toMatch(/heroOff/);   // (no second shape blended in afterwards)
});

test("the cascade's rest spot can be the grain's place on the ball (Contact): the ball word sits beside the chaos word", () => {
  expect(SAND_VERTEX).toMatch(/uvec2 word = texelFetch\(uRestWords/);
  expect(SAND_VERTEX).toMatch(/if \(uCascade\.z > 0\.5\)/);
  expect(SAND_VERTEX).toMatch(/uBallC \+ uBallRot \* \(normalize\(dir\)/);
});
