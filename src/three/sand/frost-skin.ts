import * as THREE from "three";
import { ATTEMPT_FIELD } from "./shaders";

/**
 * 2.2: the frost skin that grows out of the sand inside an attempt (the approved Blender logic: a sphere just under the
 * compacted grains, raised toward the patch's centre, visible where the attempt has reached; warm translucent frost where
 * it has just turned, clearing toward glass). Shares the sand's attempt field and lights, and is drawn in the sand layer
 * so the grains poke through it and the pixel filter treats both alike.
 */
const SIMPLEX_DECL = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

const VERTEX = /* glsl */ `
${SIMPLEX_DECL}
${ATTEMPT_FIELD}
uniform vec3 uBallC;
uniform float uBallR;
out vec3 vDir;
out vec3 vWorld;
out float vBand;
void main() {
  vec3 d = normalize(position);
  float band = attBand(d);
  float v = clamp(band / 0.35, 0.0, 1.0); v = v * v * (3.0 - 2.0 * v);
  // just under the compacted grains at the patch's edge, up to full height toward its centre: flush with the sand
  vec3 w = uBallC + d * uBallR * (0.94 + 0.058 * v);
  vDir = d; vWorld = w; vBand = band;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
${SIMPLEX_DECL}
${ATTEMPT_FIELD}
in vec3 vDir;
in vec3 vWorld;
in float vBand;
uniform vec3 uLightPos[3];
uniform vec3 uLightCol[3];
uniform vec3 uLightR2;
uniform vec3 uSpotDir;
uniform vec2 uSpotCos;
uniform vec3 uGroundCol;
uniform float uExposure;
uniform float uOutScale;
uniform float uFrostGain;
uniform vec3 uTint;        // frost tint where it has just formed
uniform float uWrapK;      // how far light wraps through the frost
uniform vec2 uAlpha;       // opacity: just formed, clear
uniform float uSpecK;
uniform vec3 uClearTint;   // the colour it clears toward (warm: the sand and desk show through the glass)
uniform float uClearDark;  // clearing glass reads darker: it shows the ball's interior, not a lit surface
uniform float uDissolve;   // 2.3 build: 0..1, the frost melts away in an uneven front, the glass beneath it
void main() {
  float clear = vBand * uAttDepth;                     // linear across the skin (the grains use band^1.4)
  float exists = smoothstep(0.0, 0.3, vBand) * step(0.001, uAttDepth) * step(uAttLo, 0.999);
  float melt = 0.0;   // 1 at the melting edge: a thin bright rim of frost, as at the edge of melting ice
  if (uDissolve > 0.0) {
    // where it melts first: noise over the ball, so the glass opens in pools that join, never a wipe
    float n = 0.5 + 0.5 * snoise(vDir * 2.3 + vec3(1.7, 4.1, 2.9)) * 0.8 + 0.1 * snoise(vDir * 7.0);
    float th = uDissolve * 1.25 - 0.1;
    exists *= 1.0 - smoothstep(n - 0.02, n + 0.02, th);
    melt = 1.0 - smoothstep(0.0, 0.07, n - th);
  }
  if (exists < 0.01) discard;
  vec3 n = normalize(vDir);
  vec3 v = normalize(cameraPosition - vWorld);
  // frost: a warm translucent tint that whitens as it clears; light wraps through it (subsurface), highlights sharpen
  vec3 tint = mix(uTint, uClearTint, clear);
  float rough = mix(0.6, 0.14, clear);
  float shin = mix(8.0, 90.0, 1.0 - rough);
  vec3 col = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    vec3 L = uLightPos[i] - vWorld;
    float d2 = dot(L, L);
    L = normalize(L);
    vec3 E = uLightCol[i] / (d2 + uLightR2[i]);
    if (i == 0) E *= smoothstep(uSpotCos.x, uSpotCos.y, dot(-L, uSpotDir));
    float wrap = max((dot(n, L) + uWrapK) / (1.0 + uWrapK), 0.0);
    float spec = pow(max(dot(n, normalize(L + v)), 0.0), shin) * mix(0.15, 0.9, clear) * uSpecK;
    col += E * (tint * wrap * 0.35 / 3.14159265 + spec);
  }
  float down = clamp(0.5 - 0.5 * n.y, 0.0, 1.0);
  col += tint * uGroundCol * down * down * 0.35;
  float fres = pow(1.0 - max(dot(n, v), 0.0), 4.0);
  col += fres * 0.02 * tint;
  col *= uExposure * uOutScale * uFrostGain * mix(1.0, uClearDark, clear);
  col = mix(col, col / max(mix(1.0, uClearDark, clear), 1e-3) * 1.6, melt);   // the rim: lit frost, not see-through
  // frost is nearly opaque; as it clears it lets the grains and the desk through
  float alpha = exists * mix(uAlpha.x, uAlpha.y, clear);
  gl_FragColor = vec4(col, alpha);
}
`;

export class FrostSkin {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  private readonly sandClearAlb: THREE.Vector3;

  /** `sand`: the sand's material, whose ball, attempt and light uniforms this shares. */
  constructor(sand: THREE.ShaderMaterial) {
    const u = sand.uniforms;
    this.sandClearAlb = u.uClearAlb.value as THREE.Vector3;
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      alphaToCoverage: true,
      toneMapped: true,
      uniforms: {
        uBallC: u.uBallC, uBallR: u.uBallR,
        uAttUp: u.uAttUp, uAttLo: u.uAttLo, uAttBreak: u.uAttBreak, uAttDepth: u.uAttDepth, uAttFull: u.uAttFull,
        uDissolve: { value: 0 },
        uLightPos: u.uLightPos, uLightCol: u.uLightCol, uLightR2: u.uLightR2, uSpotDir: u.uSpotDir, uSpotCos: u.uSpotCos,
        uGroundCol: u.uGroundCol, uExposure: u.uExposure, uOutScale: u.uOutScale,
        // calibrated 2026-10-09 against the approved attempts clip (frames 24, 74, 144): brightness within 8%, warmth 0.04
        uFrostGain: { value: 0.95 },
        uTint: { value: new THREE.Vector3(0.9, 0.6, 0.5) },
        uWrapK: { value: 0.8 },
        uAlpha: { value: new THREE.Vector2(1, 1) },   // solid: see-through by coverage showed as a crosshatch
        uSpecK: { value: 1 },
        uClearTint: { value: new THREE.Vector3(0.88, 0.7, 0.6) },
        uClearDark: { value: 0.45 },
      },
    });
    this.mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 48), this.material);
    this.mesh.frustumCulled = false;
  }

  /** 2.3 build: the frost melting into the glass, 0..1. */
  setDissolve(v: number): void {
    this.material.uniforms.uDissolve.value = v;
    this.mesh.visible = v < 0.999;
  }

  /** Calibration: the frost's look (gain, tint, wrap, alpha [formed, clear], spec). */
  setLook(l: { gain?: number; tint?: number[]; wrap?: number; alpha?: number[]; spec?: number; grain?: number[]; clearTint?: number[]; clearDark?: number }): void {
    const u = this.material.uniforms;
    if (l.grain) (this.sandClearAlb as THREE.Vector3).set(l.grain[0], l.grain[1], l.grain[2]);
    if (l.gain !== undefined) u.uFrostGain.value = l.gain;
    if (l.tint) (u.uTint.value as THREE.Vector3).set(l.tint[0], l.tint[1], l.tint[2]);
    if (l.wrap !== undefined) u.uWrapK.value = l.wrap;
    if (l.alpha) (u.uAlpha.value as THREE.Vector2).set(l.alpha[0], l.alpha[1]);
    if (l.spec !== undefined) u.uSpecK.value = l.spec;
    if (l.clearTint) (u.uClearTint.value as THREE.Vector3).set(l.clearTint[0], l.clearTint[1], l.clearTint[2]);
    if (l.clearDark !== undefined) u.uClearDark.value = l.clearDark;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
