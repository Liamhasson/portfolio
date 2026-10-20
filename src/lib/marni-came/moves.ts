/** Marni Came's four image moves (spec §3 Solution, §4.4, §5): one renderer shared by the case study's effects switch
 *  and the band site. Each move is an amount from 0 to 1; changes ease over 0.35 s (never a flash) or jump under reduced
 *  motion. */
export type MoveName = "slice" | "burn" | "doubled" | "lens";
export const MOVES: readonly MoveName[] = ["slice", "burn", "doubled", "lens"];
export type MoveState = Record<MoveName, number>;
export const OFF: MoveState = { slice: 0, burn: 0, doubled: 0, lens: 0 };

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

/** Lens (a fisheye bend), then slice, then doubled, then burn, then static grain. Doubled is the Premiere method: the same
 *  frame screened back over itself, larger and offset, so only its highlights show; Lens bends the frame like a wide lens
 *  up close, never darkening it (Liam, 2026-10-20). */
export const MOVES_FRAG = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 outColor;
uniform sampler2D uImg; uniform sampler2D uLight;
uniform vec2 uRes; uniform vec2 uImgSize;
uniform float uSlice; uniform float uBurn; uniform float uDoubled; uniform float uLens; uniform float uBreath;
uniform float uOffsets[5];
uniform vec4 uBox; uniform vec2 uD; uniform float uScale;
vec2 cover(vec2 uv) {
  float ra = uRes.x / uRes.y, ia = uImgSize.x / uImgSize.y;
  vec2 s = ra > ia ? vec2(1.0, ia / ra) : vec2(ra / ia, 1.0);
  return (uv - 0.5) * s + 0.5;
}
vec3 screenB(vec3 a, vec3 b) { return 1.0 - (1.0 - a) * (1.0 - b); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec2 bend(vec2 uv, float k) {
  vec2 asp = vec2(uRes.x / min(uRes.x, uRes.y), uRes.y / min(uRes.x, uRes.y));
  vec2 p = (uv - 0.5) * asp;
  float r2 = dot(p, p), rmax = dot(0.5 * asp, 0.5 * asp);
  return 0.5 + (uv - 0.5) * (1.0 + k * r2) / (1.0 + k * rmax);
}
void main() {
  vec2 uv = cover(bend(vUv, 0.7 * uLens));
  int band = int(clamp(floor(uv.x * 5.0), 0.0, 4.0));
  vec2 suv = vec2(uv.x, fract(uv.y + uOffsets[band] * uSlice));
  vec3 col = texture(uImg, suv).rgb;
  vec2 c = (uBox.xy + uBox.zw) * 0.5;
  vec2 duv = (suv - uD - c) / uScale + c;
  float inside = step(0.0, duv.x) * step(duv.x, 1.0) * step(0.0, duv.y) * step(duv.y, 1.0);
  vec3 copy = texture(uImg, duv).rgb;
  copy *= smoothstep(0.3, 0.85, dot(copy, vec3(0.299, 0.587, 0.114))) * inside;
  col = mix(col, screenB(col, copy), uDoubled);
  float reach = 0.34 + 0.24 * uBreath;
  float ramp = pow(max(0.0, 1.0 - vUv.x / reach), 1.6);
  vec3 light = pow(texture(uLight, vUv).rgb, vec3(1.3));
  col = mix(col, screenB(col, light), ramp * uBurn);
  col += (hash(floor(vUv * uRes)) - 0.5) * 0.035;
  outColor = vec4(col, 1.0);
}`;
