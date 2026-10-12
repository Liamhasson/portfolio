// src/three/sand/sand-cascade.test.ts
import { expect, test } from "vitest";
import { SAND_FRAGMENT, SAND_VERTEX } from "./shaders";

test("the sand's vertex shader runs the cascade by grain index, reading its ancestors' rest spots from a texture", () => {
  expect(SAND_VERTEX).toMatch(/uniform highp usampler2D uRestWords;/);
  expect(SAND_VERTEX).toMatch(/vec3 cascadeRest\(int i\)/);
  expect(SAND_VERTEX).toMatch(/cascadeAt\(gl_VertexID, uCascade\.x\)/);
  // unborn grains are not drawn; the hero's own motion takes over over the settle
  expect(SAND_VERTEX).toMatch(/caSize/);
  expect(SAND_VERTEX).toMatch(/uCascade\.z/);
});

test("the light comes up through one factor on the sand's radiance (no new rig, no glow)", () => {
  expect(SAND_FRAGMENT).toMatch(/uniform float uLightK;/);
  expect(SAND_FRAGMENT).toMatch(/col \*= uLightK;/);
});
