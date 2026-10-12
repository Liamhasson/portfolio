/**
 * An integer hash for the noises that move with the page's clock (the swirl's current, the name's light, the cursor's
 * drift field). sin()-based hashes lose their precision on the GPU for large arguments: hours into a visit their values
 * stopped varying smoothly and the sand jittered into streaks (Liam, 2026-10-12). PCG3D (Jarzynski & Olano, "Hash
 * Functions for GPU Rendering", 2020): integer arithmetic, exact at any input a float can hold as an integer.
 */
export const INT_HASH_GLSL = /* glsl */ `
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
// a cell's value in [0, 1): p is the cell's integer corner (floor() of the noise's input)
float ihash(vec3 p) { return float(pcg3d(uvec3(ivec3(floor(p)))).x >> 8u) * (1.0 / 16777216.0); }
float ihash(vec2 p) { return ihash(vec3(p, 0.0)); }
`;

const u32 = (v: number) => v >>> 0;

function pcg3d(x: number, y: number, z: number): number {
  x = u32(Math.imul(x, 1664525) + 1013904223); y = u32(Math.imul(y, 1664525) + 1013904223); z = u32(Math.imul(z, 1664525) + 1013904223);
  x = u32(x + Math.imul(y, z)); y = u32(y + Math.imul(z, x)); z = u32(z + Math.imul(x, y));
  x = u32(x ^ (x >>> 16)); y = u32(y ^ (y >>> 16)); z = u32(z ^ (z >>> 16));
  x = u32(x + Math.imul(y, z)); y = u32(y + Math.imul(z, x)); z = u32(z + Math.imul(x, y));
  return x;
}

/** The TS mirror of `ihash(vec3)`. */
export function ihash3(x: number, y: number, z: number): number {
  return (pcg3d(Math.floor(x) | 0, Math.floor(y) | 0, Math.floor(z) | 0) >>> 8) / 16777216;
}
