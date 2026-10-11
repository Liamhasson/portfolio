import * as THREE from "three";
import { looseGrainUniforms, looseGrainVertex } from "./loose-grain";
import { RISE_GLSL, spillToHero } from "./rising";
import { SAND_FRAGMENT } from "./shaders";

const DECL = `
in vec4 aRest;     // a resting spot on the desk (hero units) and its hue
in vec4 aSeed;     // four randoms
uniform float uRiseTime;
uniform float uRiseOn;
uniform float uDeskY;
uniform float uGrainR;
${RISE_GLSL}`;
const LOCALS = `
  vec3 iPos = risePos(aRest, aSeed, uRiseTime, uDeskY);
  vec3 iVel = (iPos - risePos(aRest, aSeed, uRiseTime - 1.0 / 60.0, uDeskY)) * 60.0;
  // (shrinking away within ~15 cm of the lens: the camera comes down among them, none swells into a blot over the laptop)
  float nearK = smoothstep(1.0, 2.5, distance(iPos, cameraPosition));
  vec2 iSizeHue = vec2(uGrainR * mix(0.7, 1.3, aSeed.w) * riseAlpha(aRest, aSeed, uRiseTime) * uRiseOn * nearK, aRest.w);
  float iSeed = aSeed.x;`;

/**
 * The sand on the desk, pulled upward toward the ball above (spec 2026-10-11 §5): the look-dev spill's spots
 * (public/lab/sand/desk-spill.bin), each grain resting, lifting, fading near the ball's height and growing back in at
 * rest, on its own clock (rising.ts). Drawn and lit as the sand's own grains (loose-grain.ts, SAND_FRAGMENT), in its
 * layer (the lens, the shadows). Nothing on the CPU per frame but four uniforms.
 */
export class RisingSand {
  readonly mesh: THREE.Points;
  readonly material: THREE.ShaderMaterial;

  /** `spots`: hero units, 4 floats each (x, y, z, hue), in random order; the first `count` are drawn. */
  constructor(sand: THREE.ShaderMaterial, spots: Float32Array, count: number) {
    const n = Math.min(count, spots.length / 4);
    const geo = new THREE.BufferGeometry();
    const seed = new Float32Array(n * 4);
    for (let i = 0; i < seed.length; i++) seed[i] = Math.random();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));   // (three needs one)
    geo.setAttribute("aRest", new THREE.BufferAttribute(spots.slice(0, n * 4), 4));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: looseGrainVertex(DECL, LOCALS),
      fragmentShader: SAND_FRAGMENT,
      transparent: false,
      depthWrite: true,
      depthTest: true,
      alphaToCoverage: true,
      uniforms: { ...looseGrainUniforms(sand), uRiseTime: { value: 0 }, uRiseOn: { value: 0 }, uDeskY: { value: 0 }, uGrainR: { value: 0.004 } },
    });
    this.mesh = new THREE.Points(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /** `time` seconds (ambient), `on` 0..1 (0: none drawn), `deskY` the desk top (hero units), `grainR` the sand's grain radius. */
  update(time: number, on: number, deskY: number, grainR: number): void {
    const u = this.material.uniforms;
    u.uRiseTime.value = time; u.uRiseOn.value = on; u.uDeskY.value = deskY; u.uGrainR.value = grainR;
    this.mesh.visible = on > 0.001;
  }

  static async loadSpots(url: string, c: [number, number, number], k: number): Promise<Float32Array> {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    return spillToHero(new Float32Array(await r.arrayBuffer()), c, k);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
