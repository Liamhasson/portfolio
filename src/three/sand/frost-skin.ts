import * as THREE from "three";
import { ATTEMPT_FIELD } from "./shaders";

export const SIMPLEX_DECL = /* glsl */ `
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
uniform mat3 uBallRot;
out vec3 vDir;
out float vBand;
void main() {
  vec3 d = normalize(position);                         // the ball's own frame
  float band = attBand(d);
  float v = clamp(band / 0.35, 0.0, 1.0); v = v * v * (3.0 - 2.0 * v);
  // just under the compacted grains at the patch's edge, up to full height toward its centre: flush with the sand
  vec3 w = uBallC + uBallRot * (d * uBallR * (0.94 + 0.058 * v));
  vDir = d; vBand = band;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
in vec3 vDir;
in float vBand;
uniform float uAttDepth;
uniform float uAttLo;
void main() {
  float exists = smoothstep(0.0, 0.3, vBand) * step(0.001, uAttDepth) * step(uAttLo, 0.999);
  if (exists < 0.5) discard;
  gl_FragColor = vec4(0.0);
}
`;

/**
 * 2.2-2.3: the frost's shell in the sand layer, depth only: it hides the grains behind the frost (the far side of the
 * ball) exactly where the frost is. The frost itself, and the glass it clears into, is drawn by the glass (glass-ball.ts,
 * one surface, so frost and glass are one material clearing), on the same field, in the ball's own frame.
 */
export class FrostSkin {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;

  /** `sand`: the sand's material, whose ball and attempt uniforms this shares. */
  constructor(sand: THREE.ShaderMaterial) {
    const u = sand.uniforms;
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      colorWrite: false,
      uniforms: {
        uBallC: u.uBallC, uBallR: u.uBallR, uBallRot: u.uBallRot,
        uAttUp: u.uAttUp, uAttLo: u.uAttLo, uAttBreak: u.uAttBreak, uAttDepth: u.uAttDepth, uAttFull: u.uAttFull, uMelt: u.uMelt, uMeltUp: u.uMeltUp,
      },
    });
    this.mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 48), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;   // before the grains: they test against it
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
