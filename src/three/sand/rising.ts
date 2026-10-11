/**
 * The rising sand's motion (spec 2026-10-11-scene-order-design.md §5): grains resting on the desk lift as if gravity
 * worked upward, toward the ball above, out of frame; in waves (a slow noise field over the desk sets each region's
 * timing), each grain at its own pace; endless. Stateless: a grain's place is a function of its rest spot, four seeds
 * and time, so the vertex shader computes it (RISE_GLSL) and these TS mirrors test it. The two agree in form, not to
 * the last bit (JS doubles, GLSL floats).
 *
 * A grain's life: rest (its share of the cycle, 72-90%), then lift (slow, then faster: pow(a, 1.8..2.8)), fading as it
 * nears the ball's height; the next life grows in from nothing a little way from the last spot (cracks: along the crack).
 */
export const RISE = {
  periodMin: 10, periodMax: 20,   // seconds per life, by region
  restMin: 0.72, restMax: 0.9,    // the share of a life at rest (8-30% in the air at once: never a snowfall; Liam's waves)
  growIn: 0.1,                    // the share of a life growing in (1-2 s)
  fadeFrom: 0.8,                  // the lift past which it fades
  height: 6.0,                    // hero units it rises (the desk is 4.6 below the ball)
  sway: 0.25,                     // hero units of sideways drift at the top
  jitter: 0.2,                    // hero units between one life's spot and the next
  waveScale: 0.35,                // the timing field's scale (per hero unit): a few regions across the desk
  offsetScale: 0.6,
} as const;

const f = (v: number) => v.toFixed(4);
export const RISE_GLSL = /* glsl */ `
float rHash(float n) { return fract(sin(n) * 43758.5453123); }
float rNoise(vec2 p) {
  vec2 i = floor(p), q = fract(p);
  vec2 u = q * q * (3.0 - 2.0 * q);
  float a = rHash(dot(i, vec2(127.1, 311.7)));
  float b = rHash(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7)));
  float c = rHash(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7)));
  float d = rHash(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7)));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// x: which life, y: how far through it (0..1)
vec2 risePhase(vec4 rest, vec4 seed, float t) {
  float n1 = rNoise(rest.xz * ${f(RISE.waveScale)});
  float n2 = rNoise(rest.xz * ${f(RISE.offsetScale)} + vec2(17.3, -4.1));
  float period = mix(${f(RISE.periodMin)}, ${f(RISE.periodMax)}, n1) * (1.0 + 0.08 * (seed.x * 2.0 - 1.0));
  float ph = t / period + 2.0 * n2 + 0.15 * seed.y;
  return vec2(floor(ph), fract(ph));
}
float riseLift(vec4 seed, float u) {
  float restShare = mix(${f(RISE.restMin)}, ${f(RISE.restMax)}, seed.z);
  float a = clamp((u - restShare) / (1.0 - restShare), 0.0, 1.0);
  return pow(a, 1.8 + seed.w);
}
float riseAlpha(vec4 rest, vec4 seed, float t) {
  vec2 ph = risePhase(rest, seed, t);
  return smoothstep(0.0, ${f(RISE.growIn)}, ph.y) * (1.0 - smoothstep(${f(RISE.fadeFrom)}, 1.0, riseLift(seed, ph.y)));
}
vec3 risePos(vec4 rest, vec4 seed, float t, float deskY) {
  vec2 ph = risePhase(rest, seed, t);
  float lift = riseLift(seed, ph.y);
  vec2 j = (vec2(rHash(seed.x * 91.7 + ph.x * 13.13), rHash(seed.y * 53.3 + ph.x * 7.77)) - 0.5) * ${f(RISE.jitter)};
  if (rest.y < deskY - 1e-4) j.y = 0.0;   // in a plank's crack: only along it
  float sway = lift * ${f(RISE.sway)};
  return vec3(rest.x + j.x + sin(t * 0.7 + seed.x * 6.2831) * sway, rest.y + lift * ${f(RISE.height)}, rest.z + j.y + cos(t * 0.6 + seed.y * 6.2831) * sway);
}
`;

const fract = (x: number) => x - Math.floor(x);
const rHash = (n: number) => fract(Math.sin(n) * 43758.5453123);
const smoothstep = (a: number, b: number, x: number) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };

export function rNoise(x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z), qx = x - ix, qz = z - iz;
  const ux = qx * qx * (3 - 2 * qx), uz = qz * qz * (3 - 2 * qz);
  const h = (a: number, b: number) => rHash(a * 127.1 + b * 311.7);
  const a = h(ix, iz), b = h(ix + 1, iz), c = h(ix, iz + 1), d = h(ix + 1, iz + 1);
  return (a + (b - a) * ux) + ((c + (d - c) * ux) - (a + (b - a) * ux)) * uz;
}

export function grainAt(rest: [number, number, number], seed: [number, number, number, number], t: number, deskY = rest[1]) {
  const n1 = rNoise(rest[0] * RISE.waveScale, rest[2] * RISE.waveScale);
  const n2 = rNoise(rest[0] * RISE.offsetScale + 17.3, rest[2] * RISE.offsetScale - 4.1);
  const period = (RISE.periodMin + (RISE.periodMax - RISE.periodMin) * n1) * (1 + 0.08 * (seed[0] * 2 - 1));
  const ph = t / period + 2.0 * n2 + 0.15 * seed[1];
  const cycle = Math.floor(ph), u = ph - cycle;
  const restShare = RISE.restMin + (RISE.restMax - RISE.restMin) * seed[2];
  const a = Math.min(Math.max((u - restShare) / (1 - restShare), 0), 1);
  const lift = Math.pow(a, 1.8 + seed[3]);
  const alpha = smoothstep(0, RISE.growIn, u) * (1 - smoothstep(RISE.fadeFrom, 1, lift));
  const jx = (rHash(seed[0] * 91.7 + cycle * 13.13) - 0.5) * RISE.jitter;
  const jz = rest[1] < deskY - 1e-4 ? 0 : (rHash(seed[1] * 53.3 + cycle * 7.77) - 0.5) * RISE.jitter;
  const sway = lift * RISE.sway;
  const pos: [number, number, number] = [
    rest[0] + jx + Math.sin(t * 0.7 + seed[0] * 6.2831) * sway,
    rest[1] + lift * RISE.height,
    rest[2] + jz + Math.cos(t * 0.6 + seed[1] * 6.2831) * sway,
  ];
  return { cycle, lift, alpha, pos };
}

/** desk-spill.bin (x, y, z, hue in desk metres, Blender z-up) -> hero units, three y-up (Pullback.toHero). */
export function spillToHero(raw: Float32Array, c: [number, number, number], k: number): Float32Array {
  const out = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i += 4) {
    const x = (raw[i] - c[0]) / k, y = (raw[i + 1] - c[1]) / k, z = (raw[i + 2] - c[2]) / k;
    out[i] = x; out[i + 1] = z; out[i + 2] = -y; out[i + 3] = raw[i + 3];
  }
  return out;
}
