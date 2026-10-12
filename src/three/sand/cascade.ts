// src/three/sand/cascade.ts
import { LOADER } from "@/app/lab/sand/loader-timeline";

/**
 * The cascade (spec 2026-10-12-loader-design.md §5.2): at 100% the brief's 9 anchors become grains, and every grain is
 * born from its parent by splitting, at its parent's place, then travels to its own place in the cloud. A binary lineage
 * over the grains' indices: grain i belongs to anchor i % 9, node j = floor(i / 9) in that anchor's tree (j = 0 the anchor
 * grain), generation floor(log2(j + 1)), parent floor((j - 1) / 2). Stateless: a grain's place is a function of its
 * index, the anchors, the rest spots of itself and its ancestors, and time. The shader computes it (CASCADE_GLSL); this
 * TS mirror is what the tests check.
 */
export type V3 = [number, number, number];

export const CASCADE = {
  anchors: 9,
  gen: 0.15,       // s between a generation and the next
  jitter: 0.1,     // s, each grain's own lateness (< gen: a child is always born after its parent)
  travel: 0.55,    // s from its birth to its place
  impulse: 0.35,   // world units: how far the two halves of a split arc apart
  settle: 0.8,     // s over which the hero's own motion takes over at the end
  maxGen: 18,
} as const;

const hash = (n: number) => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
const smoother = (x: number) => { const t = Math.min(Math.max(x, 0), 1); return t * t * t * (t * (t * 6 - 15) + 10); };
const genOf = (j: number) => Math.floor(Math.log2(j + 1) + 1e-9);
const birthOf = (i: number) => { const a = i % 9, j = Math.floor(i / 9); return LOADER.starts[a] + genOf(j) * CASCADE.gen + (j > 0 ? CASCADE.jitter * hash(i) : 0); };

export function cascadeEnd(n: number): number {
  return Math.max(...LOADER.starts) + genOf(Math.ceil(n / 9)) * CASCADE.gen + CASCADE.jitter + CASCADE.travel;
}

/** One hop: from where it was born to its own place, arcing to its side (the split), at time t. */
function hop(born: V3, home: V3, side: number, age: number): V3 {
  const u = Math.min(Math.max(age / CASCADE.travel, 0), 1), e = smoother(u);
  const d: V3 = [home[0] - born[0], home[1] - born[1], home[2] - born[2]];
  // the arc's direction: across the path, in the screen's plane (z toward the camera)
  let px = -d[1], py = d[0]; const pl = Math.hypot(px, py) || 1; px /= pl; py /= pl;
  const arc = Math.sin(Math.PI * u) * CASCADE.impulse * side;
  return [born[0] + d[0] * e + px * arc, born[1] + d[1] * e + py * arc, born[2] + d[2] * e];
}

export function cascadeAt(i: number, t: number, anchors: V3[], rest: (i: number) => V3): { born: boolean; pos: V3 } {
  const a = i % 9, j = Math.floor(i / 9), g = genOf(j);
  if (t < birthOf(i)) return { born: false, pos: anchors[a] };
  // walk the lineage from the anchor down: each ancestor's place at its child's birth is where the child is born
  let born: V3 = anchors[a];
  for (let k = 0; k <= g; k++) {
    const jk = ((j + 1) >> (g - k)) - 1, ik = jk * 9 + a;
    const side = jk === 0 ? 0 : jk % 2 === 1 ? 1 : -1;
    if (k === g) return { born: true, pos: hop(born, rest(ik), side, t - birthOf(ik)) };
    const jn = ((j + 1) >> (g - k - 1)) - 1, inext = jn * 9 + a;
    born = hop(born, rest(ik), side, birthOf(inext) - birthOf(ik));
  }
  return { born: true, pos: rest(i) };
}

/** The brief's anchors in the world: on the plane through the ball's centre facing the camera (right/up: the camera's). */
export function anchorsWorld(c: V3, r: number, right: V3, up: V3): V3[] {
  const at = (x: number, y: number): V3 => [c[0] + right[0] * x * r + up[0] * y * r, c[1] + right[1] * x * r + up[1] * y * r, c[2] + right[2] * x * r + up[2] * y * r];
  return [at(0, 0), at(0, 1), at(1, 0), at(0, -1), at(-1, 0), at(-1, 1), at(1, 1), at(1, -1), at(-1, -1)];
}

const f = (v: number) => v.toFixed(4);
export const CASCADE_GLSL = /* glsl */ `
uniform vec3 uAnchors[9];
const float CA_STARTS[9] = float[9](${LOADER.starts.map(f).join(", ")});
float caHash(float n) { return fract(sin(n * 12.9898 + 78.233) * 43758.5453); }
int caGen(int j) { int g = 0; int v = j + 1; while (v > 1 && g < ${CASCADE.maxGen}) { v >>= 1; g++; } return g; }
float caBirth(int i) { int a = i - (i / 9) * 9, j = i / 9; return CA_STARTS[a] + float(caGen(j)) * ${f(CASCADE.gen)} + (j > 0 ? ${f(CASCADE.jitter)} * caHash(float(i)) : 0.0); }
vec3 caHop(vec3 born, vec3 home, float side, float age) {
  float u = clamp(age / ${f(CASCADE.travel)}, 0.0, 1.0);
  float e = u * u * u * (u * (u * 6.0 - 15.0) + 10.0);
  vec3 d = home - born;
  vec2 pp = vec2(-d.y, d.x); float pl = length(pp); pp = pl > 0.0 ? pp / pl : vec2(0.0);
  float arc = sin(3.14159265 * u) * ${f(CASCADE.impulse)} * side;
  return born + d * e + vec3(pp * arc, 0.0);
}
vec4 cascadeAt(int i, float t) {
  int a = i - (i / 9) * 9, j = i / 9, g = caGen(j);
  if (t < caBirth(i)) return vec4(uAnchors[a], 0.0);
  vec3 born = uAnchors[a];
  for (int k = 0; k <= ${CASCADE.maxGen}; k++) {
    if (k > g) break;
    int jk = ((j + 1) >> (g - k)) - 1, ik = jk * 9 + a;
    float side = jk == 0 ? 0.0 : (jk - (jk / 2) * 2 == 1 ? 1.0 : -1.0);
    if (k == g) return vec4(caHop(born, cascadeRest(ik), side, t - caBirth(ik)), 1.0);
    int jn = ((j + 1) >> (g - k - 1)) - 1, inext = jn * 9 + a;
    born = caHop(born, cascadeRest(ik), side, caBirth(inext) - caBirth(ik));
  }
  return vec4(cascadeRest(i), 1.0);
}
`;

/** A grain's spot on the ball from its packed ball word (the vertex shader's decoding, unrotated): octahedral direction
 *  12+12 bits, distance 8 bits of `posMax`. Contact's cascade ends here (spec 2026-10-12-about-contact-design.md §4). */
export function ballRestOf(wordB: number, ballC: V3, posMax: number): V3 {
  const ox = ((wordB & 4095) / 4095) * 2 - 1, oy = (((wordB >>> 12) & 4095) / 4095) * 2 - 1;
  let x = ox, y = oy;
  const z = 1 - Math.abs(ox) - Math.abs(oy), fold = Math.max(-z, 0);
  x -= Math.sign(x) * fold; y -= Math.sign(y) * fold;
  const l = Math.hypot(x, y, z) || 1, d = ((wordB >>> 24) / 255) * posMax;
  return [ballC[0] + (x / l) * d, ballC[1] + (y / l) * d, ballC[2] + (z / l) * d];
}
