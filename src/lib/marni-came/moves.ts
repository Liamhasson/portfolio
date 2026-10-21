/** Marni Came's five image moves (spec §3 Solution, §4.4, §5): one renderer shared by the case study's effects switch
 *  and the band site. Each move is an amount from 0 to 1; changes ease over 0.35 s (never a flash) or jump under reduced
 *  motion. */
export type MoveName = "slice" | "burn" | "doubled" | "lens" | "blowout";
/** Blowout joined as the fifth (Liam, 2026-10-21). */
export const MOVES: readonly MoveName[] = ["slice", "burn", "doubled", "lens", "blowout"];
export type MoveState = Record<MoveName, number>;
export const OFF: MoveState = { slice: 0, burn: 0, doubled: 0, lens: 0, blowout: 0 };

/** Doubled's copy: scaled about the centre of a box (x0, y0, x1, y1 as fractions of the image) and offset. */
export interface DoubledSpec { box: readonly [number, number, number, number]; dx: number; dy: number; scale: number }

/** Seconds for a move to go fully on or off. */
export const MOVE_SECONDS = 0.35;
/** The burn's breath: one slow swell every 8.6 s (the Badehaus hero loop's length). */
export const BREATH_SECONDS = 8.6;

export function stepMoves(current: MoveState, target: MoveState, dtSec: number, reduced: boolean): MoveState {
  if (reduced) return { ...target };
  const step = dtSec / MOVE_SECONDS;
  const next = { ...current };
  for (const m of MOVES) {
    const d = target[m] - current[m];
    next[m] = Math.abs(d) <= step ? target[m] : current[m] + Math.sign(d) * step;
  }
  return next;
}

export function settled(a: MoveState, b: MoveState): boolean {
  return MOVES.every((m) => a[m] === b[m]);
}

/** The slice's band offsets (fractions of the height), the same for the same seed. */
export function sliceOffsets(seed: number, bands = 5): number[] {
  let s = (seed * 2654435761) >>> 0;
  const rand = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return Array.from({ length: bands }, (_, i) => (i === 0 ? 0 : (rand() * 2 - 1) * 0.07));
}

export function burnBreath(tSec: number): number {
  return 0.5 - 0.5 * Math.cos((2 * Math.PI * tSec) / BREATH_SECONDS);
}

export const MOVES_VERT = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main() { vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5); gl_Position = vec4(aPos, 0.0, 1.0); }`;

/** Lens, then slice and doubled, then burn, then blowout, then static grain (Liam, 2026-10-21).
 *  Doubled: the same frame screened back over itself, larger and offset, so only its highlights show.
 *  Lens: the centre stays sharp; the edges smear, unevenly, some sides more than others (not a fisheye, not a vignette).
 *  Blowout: only the highlights blow out and bleed light around themselves, with a faint RGB split at their edges. Pictures
 *  only, never type. */
export const MOVES_FRAG = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 outColor;
uniform sampler2D uImg; uniform sampler2D uLight;
uniform vec2 uRes; uniform vec2 uImgSize;
uniform float uSlice; uniform float uBurn; uniform float uDoubled; uniform float uLens; uniform float uBlowout; uniform float uBreath;
uniform float uOffsets[5];
uniform vec4 uBox; uniform vec2 uD; uniform float uScale;
vec2 cover(vec2 uv) {
  float ra = uRes.x / uRes.y, ia = uImgSize.x / uImgSize.y;
  vec2 s = ra > ia ? vec2(1.0, ia / ra) : vec2(ra / ia, 1.0);
  return (uv - 0.5) * s + 0.5;
}
vec3 screenB(vec3 a, vec3 b) { return 1.0 - (1.0 - a) * (1.0 - b); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
// slice and doubled, at one point of the screen
vec3 base(vec2 v) {
  vec2 uv = cover(v);
  int band = int(clamp(floor(uv.x * 5.0), 0.0, 4.0));
  vec2 suv = vec2(uv.x, fract(uv.y + uOffsets[band] * uSlice));
  vec3 col = texture(uImg, suv).rgb;
  vec2 c = (uBox.xy + uBox.zw) * 0.5;
  vec2 duv = (suv - uD - c) / uScale + c;
  float inside = step(0.0, duv.x) * step(duv.x, 1.0) * step(0.0, duv.y) * step(duv.y, 1.0);
  vec3 copy = texture(uImg, duv).rgb;
  copy *= smoothstep(0.3, 0.85, luma(copy)) * inside;
  return mix(col, screenB(col, copy), uDoubled);
}
// the highlights of the picture blurred to a mip level (the image is mipmapped): the blowout's smooth bleed
vec3 hi(vec2 v, float lod) { vec3 c = textureLod(uImg, cover(v), lod).rgb; return c * smoothstep(0.5, 0.9, luma(c)); }
void main() {
  vec2 asp = uRes / min(uRes.x, uRes.y);
  vec2 p = (vUv - 0.5) * asp;
  float ang = atan(p.y, p.x);
  // lens: how far out we are, and how much this side smears (uneven around the frame)
  float side = 0.25 + 0.75 * clamp(0.5 + 0.5 * sin(ang * 2.0 + 1.3) * (0.7 + 0.3 * sin(ang * 3.0 - 0.7)), 0.0, 1.0);
  float smear = smoothstep(0.28, 0.78, length(p)) * side * uLens;
  vec2 dir = normalize(vec2(cos(ang + 1.1), sin(ang + 1.1)) + 0.6 * normalize(p + 1e-5)) / asp;
  vec3 col = vec3(0.0);
  float wsum = 0.0;
  for (int i = 0; i < 13; i++) {
    float o = (float(i) / 12.0 - 0.5) * smear * 0.09;
    float w = 1.0 - abs(float(i) / 12.0 - 0.5);
    col += base(vUv + dir * o) * w; wsum += w;
  }
  col /= wsum;
  float reach = 0.34 + 0.24 * uBreath;
  float ramp = pow(max(0.0, 1.0 - vUv.x / reach), 1.6);
  vec3 light = pow(texture(uLight, vUv).rgb, vec3(1.3));
  col = mix(col, screenB(col, light), ramp * uBurn);
  if (uBlowout > 0.0) {
    // the highlights blow out, then their light spills around them, wider the brighter; red and blue split a hair apart
    vec3 bleed = hi(vUv, 3.0) * 0.35 + hi(vUv, 4.5) * 0.4 + hi(vUv, 6.0) * 0.45;
    vec2 ca = vec2(0.003, 0.0);
    vec3 split = vec3(hi(vUv + ca, 2.0).r, hi(vUv, 2.0).g, hi(vUv - ca, 2.0).b) - hi(vUv, 2.0);
    float m = smoothstep(0.62, 0.95, luma(col));
    col = mix(col, screenB(col, col), m * uBlowout);
    col = screenB(col, clamp((bleed * 2.4) * uBlowout, 0.0, 1.0)) + split * 0.7 * uBlowout;
  }
  col += (hash(floor(vUv * uRes)) - 0.5) * 0.035;
  outColor = vec4(col, 1.0);
}`;
