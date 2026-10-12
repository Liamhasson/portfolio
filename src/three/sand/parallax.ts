/**
 * The vortex leans toward the cursor in depth (Liam, 2026-10-12: "the FRONT LAYER of the vortex to follow the cursor
 * more than the BACK LAYER, so it feels like it's moving in a 3D motion"). Each grain is offset on screen toward the
 * cursor by its depth in the cloud: the front by the full lean, the back by a fraction, so the layers slide past each
 * other as a volume would. The lean follows the cursor softly and settles back when it leaves.
 */
export const PARALLAX = {
  reach: 0.045,   // the front's lean at the screen's edge, in NDC (about 2% of the width)
  back: 0.15,     // the back's share of it
  follow: 3.2,    // 1/s: how quickly the lean follows the cursor
} as const;

/** A grain's share of the lean by its depth in the cloud (0 at the back, 1 at the front). */
export function parallaxWeight(front: number): number {
  const f = Math.min(Math.max(front, 0), 1);
  return PARALLAX.back + (1 - PARALLAX.back) * f;
}

/** The lean (NDC) a frame on: toward the cursor's lean (cursor in NDC, -1..1), or back to rest without one. */
export function stepParallax(cur: [number, number], cursor: [number, number] | null, dt: number): [number, number] {
  const tx = cursor ? Math.max(-1, Math.min(1, cursor[0])) * PARALLAX.reach : 0;
  const ty = cursor ? Math.max(-1, Math.min(1, cursor[1])) * PARALLAX.reach : 0;
  const k = 1 - Math.exp(-dt * PARALLAX.follow);
  return [cur[0] + (tx - cur[0]) * k, cur[1] + (ty - cur[1]) * k];
}

/** The shaders' half: a grain's depth in the cloud (uParallaxC: the cloud's centre and radius) and its lean. */
export const PARALLAX_GLSL = /* glsl */ `
uniform vec3 uParallax;    // xy: the front's lean (NDC), z: the back's share
uniform vec4 uParallaxC;   // the cloud's centre (xyz) and radius (w)
float parallaxFront(vec3 p) {
  vec3 toCam = normalize(cameraPosition - uParallaxC.xyz);
  return clamp(0.5 + 0.5 * dot(p - uParallaxC.xyz, toCam) / max(uParallaxC.w, 1e-3), 0.0, 1.0);
}
`;
