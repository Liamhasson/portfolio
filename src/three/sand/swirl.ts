/**
 * The chaos at rest (Liam, 2026-10-11: "a continuous inwards and around themselves motion, no identical movements",
 * Lusion's about page as the reference): every grain is carried by a strong inward vortex and a slowly changing
 * turbulent current, so the cloud tumbles and breathes like smoke in a draught while keeping its colours and grains.
 *
 * A region's life (20-60 s; its grains share it, each a few % off: they move in sheets and the filaments hold): born at a spot a little outside its place in the cloud, it spirals in toward the
 * core around the vortex's axis, faster nearer the centre (a vortex: ~20 s a turn at the core, ~60 s at the rim), its
 * height drawn in too, and shrinks away there; then it grows back in at its spot. Lives are staggered, so the cloud
 * keeps its size overall (born outside, drawn in). On top, a smooth noise field that drifts in time pushes
 * neighbouring grains together, in sheets, as Lusion's do. Stateless (a function of the grain's rest spot, three seeds
 * and time): the vertex shader computes it (SWIRL_GLSL); the TS mirror below is what the tests check.
 */
export const SWIRL = {
  lifeMin: 20, lifeMax: 60,   // seconds
  born: 1.4,                  // the radius it is born at, x its spot's
  core: 0.45,                 // and drawn in to
  field: 1.4,                 // the scale (per cloud radius) of the field that gives each region its life, phase and pace:
                              // neighbours share them (they move in sheets, the filaments hold), regions differ
  turn: 0.126,                // the vortex's angular speed scale (rad/s): ~20 s a turn at the core, ~60 s at the rim
  turb: 0.12,                 // the current's push (cloud radii)
  turbFreq: 0.9,              // its scale (per cloud radius)
  turbSpeed: 0.05,            // how fast it changes
  axis: [0.15, 0.55, 0.82] as [number, number, number],   // the vortex's axis: tilted toward the camera, so the spiral reads
} as const;

const f = (v: number) => v.toFixed(4);
const AX = (() => { const [x, y, z] = SWIRL.axis, l = Math.hypot(x, y, z); return [x / l, y / l, z / l] as [number, number, number]; })();

export const SWIRL_GLSL = /* glsl */ `
float swHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123); }
float swNoise(vec3 p) {
  vec3 i = floor(p), q = fract(p);
  vec3 u = q * q * (3.0 - 2.0 * q);
  return mix(mix(mix(swHash(i), swHash(i + vec3(1, 0, 0)), u.x), mix(swHash(i + vec3(0, 1, 0)), swHash(i + vec3(1, 1, 0)), u.x), u.y),
             mix(mix(swHash(i + vec3(0, 0, 1)), swHash(i + vec3(1, 0, 1)), u.x), mix(swHash(i + vec3(0, 1, 1)), swHash(i + vec3(1, 1, 1)), u.x), u.y), u.z) * 2.0 - 1.0;
}
// xyz: the grain's place now (world), w: its size (0..1: grown in, shrunk away); seed: three randoms (its own few %)
vec4 swirlAt(vec3 p, vec3 seed, vec3 c, float R, float time) {
  const vec3 ax = vec3(${f(AX[0])}, ${f(AX[1])}, ${f(AX[2])});
  vec3 fq = (p - c) * (${f(SWIRL.field)} / R);
  float n1 = 0.5 + 0.5 * swNoise(fq + vec3(11.0)), n2 = 0.5 + 0.5 * swNoise(fq + vec3(-7.0, 23.0, 5.0)), n3 = swNoise(fq + vec3(41.0, -3.0, 17.0));
  float life = mix(${f(SWIRL.lifeMin)}, ${f(SWIRL.lifeMax)}, n1);   // (shared: a grain's own life would drift it off its sheet)
  float ph = fract(time / life + 2.0 * n2 + 0.03 * seed.y);
  float inK = pow(ph, 1.4);
  vec3 d = p - c;
  float along = dot(d, ax);
  vec3 rad = d - ax * along;
  float rn = clamp(length(rad) / R, 0.05, 1.5);
  float ang = ${f(SWIRL.turn)} * (1.0 + 0.15 * n3 + 0.02 * (seed.z - 0.5)) / (0.35 + rn) * ph * life;
  vec3 radR = rad * cos(ang) + cross(ax, rad) * sin(ang);
  vec3 np = c + (radR + ax * along) * mix(${f(SWIRL.born)}, ${f(SWIRL.core)}, inK);
  vec3 q = np * (${f(SWIRL.turbFreq)} / R) + vec3(time * ${f(SWIRL.turbSpeed)});
  np += vec3(swNoise(q), swNoise(q + vec3(31.4, 0.0, 0.0)), swNoise(q + vec3(0.0, 47.2, 0.0))) * (${f(SWIRL.turb)} * R);
  return vec4(np, smoothstep(0.0, 0.07, ph) * (1.0 - smoothstep(0.82, 1.0, ph)));
}
`;

// ---- the TS mirror (tests) ----
const fract = (x: number) => x - Math.floor(x);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (a: number, b: number, x: number) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
const swHash = (x: number, y: number, z: number) => fract(Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123);
function swNoise(x: number, y: number, z: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const qx = x - ix, qy = y - iy, qz = z - iz;
  const ux = qx * qx * (3 - 2 * qx), uy = qy * qy * (3 - 2 * qy), uz = qz * qz * (3 - 2 * qz);
  const h = (a: number, b: number, c: number) => swHash(ix + a, iy + b, iz + c);
  const z0 = mix(mix(h(0, 0, 0), h(1, 0, 0), ux), mix(h(0, 1, 0), h(1, 1, 0), ux), uy);
  const z1 = mix(mix(h(0, 0, 1), h(1, 0, 1), ux), mix(h(0, 1, 1), h(1, 1, 1), ux), uy);
  return mix(z0, z1, uz) * 2 - 1;
}

export function swirlAt(p: [number, number, number], seed: [number, number, number], c: [number, number, number], R: number, time: number) {
  const fs = SWIRL.field / R, fx = (p[0] - c[0]) * fs, fy = (p[1] - c[1]) * fs, fz = (p[2] - c[2]) * fs;
  const n1 = 0.5 + 0.5 * swNoise(fx + 11, fy + 11, fz + 11), n2 = 0.5 + 0.5 * swNoise(fx - 7, fy + 23, fz + 5), n3 = swNoise(fx + 41, fy - 3, fz + 17);
  const life = mix(SWIRL.lifeMin, SWIRL.lifeMax, n1);
  const phRaw = time / life + 2 * n2 + 0.03 * seed[1];
  const ph = fract(phRaw), lifeIndex = Math.floor(phRaw);
  const inK = Math.pow(ph, 1.4);
  const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
  const along = d[0] * AX[0] + d[1] * AX[1] + d[2] * AX[2];
  const rad = [d[0] - AX[0] * along, d[1] - AX[1] * along, d[2] - AX[2] * along];
  const rn = Math.min(Math.max(Math.hypot(rad[0], rad[1], rad[2]) / R, 0.05), 1.5);
  const ang = SWIRL.turn * (1 + 0.15 * n3 + 0.02 * (seed[2] - 0.5)) / (0.35 + rn) * ph * life;
  const cr = [AX[1] * rad[2] - AX[2] * rad[1], AX[2] * rad[0] - AX[0] * rad[2], AX[0] * rad[1] - AX[1] * rad[0]];
  const k = mix(SWIRL.born, SWIRL.core, inK);
  const np = [0, 1, 2].map((i) => c[i] + (rad[i] * Math.cos(ang) + cr[i] * Math.sin(ang) + AX[i] * along) * k);
  const s = SWIRL.turbFreq / R;
  const qx = np[0] * s + time * SWIRL.turbSpeed, qy = np[1] * s + time * SWIRL.turbSpeed, qz = np[2] * s + time * SWIRL.turbSpeed;
  const tk = SWIRL.turb * R;
  const pos: [number, number, number] = [
    np[0] + swNoise(qx, qy, qz) * tk,
    np[1] + swNoise(qx + 31.4, qy, qz) * tk,
    np[2] + swNoise(qx, qy + 47.2, qz) * tk,
  ];
  return { pos, size: smoothstep(0, 0.07, ph) * (1 - smoothstep(0.82, 1, ph)), life: lifeIndex };
}
