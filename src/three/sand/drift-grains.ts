import * as THREE from "three";

/**
 * Grains leaving the sand: the atmosphere around the main object (Lusion's about hero, read from their code 2026-10-10:
 * the loose particles there are the cloud's own, born on a shell around the light at its heart, carried outward and up
 * by curl noise, shrinking and fading as their life runs out, then reborn).
 *
 * Ours are the same sand (its palette, its grain sizes, its lights): each is born on the sand's surface (the chaos's
 * shell, then the ball's), drifts up and out in a slow swirl, and shrinks away. They are lit only by the scene's lights,
 * so they glow where the light reaches them and vanish into the dark as they leave it: never disconnected from it.
 * Near the camera they grow large and soft (the out-of-focus grains that give Lusion's scene its depth).
 *
 * Stateless: each grain's whole life is a function of time and its seed (no simulation buffers). Drawn in the sand's
 * layer, so the same pixel filter softens it.
 */
const VERTEX = /* glsl */ `
precision highp float;
in vec4 aSeed;                // four randoms per grain
uniform float uTime;
uniform float uCount;         // how many are alive (the density): grains past it are skipped
uniform vec3 uSpawnC;         // the sand's centre, and the size of the shell they leave from
uniform float uSpawnR;
uniform float uTravel;        // how far a grain goes in its life (world units)
uniform float uLife;          // seconds
uniform float uRadius;        // grain radius (world units)
uniform float uPointScale;
uniform float uMinPx;
uniform vec3 uRamp[4];
uniform vec4 uRampAt;
uniform vec3 uLightPos[3];
uniform vec3 uLightCol[3];
uniform vec3 uLightR2;
uniform vec3 uSpotDir;
uniform vec2 uSpotCos;
uniform vec3 uCursorPos;
uniform vec3 uCursorCol;
uniform float uCursorReach;
uniform sampler2D uPaint;
uniform float uPaintScale;
uniform vec2 uViewport;
out vec3 vAlbedo;
out vec3 vL0; out vec3 vL1; out vec3 vL2; out vec3 vL3;
out vec3 vE0; out vec3 vE1; out vec3 vE2; out vec3 vE3;
out float vAlpha;
out float vSoft;
vec3 ramp(float h) {
  vec3 c = uRamp[0];
  c = mix(c, uRamp[1], clamp((h - uRampAt.x) / (uRampAt.y - uRampAt.x), 0.0, 1.0));
  c = mix(c, uRamp[2], clamp((h - uRampAt.y) / (uRampAt.z - uRampAt.y), 0.0, 1.0));
  c = mix(c, uRamp[3], clamp((h - uRampAt.z) / (uRampAt.w - uRampAt.z), 0.0, 1.0));
  return c;
}
void main() {
  float idx = float(gl_VertexID);
  if (idx >= uCount) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
  // its life: each grain has its own length and phase, so they never pulse together
  float L = uLife * mix(0.7, 1.3, aSeed.w);
  float cyc = uTime / L + aSeed.x * 7.0;
  float life = fract(cyc);
  float gen = floor(cyc);                                   // each rebirth leaves from a new place
  vec4 s = fract(aSeed * (gen * 0.6180339 + 1.0) * vec4(12.9898, 78.233, 37.719, 4.581) * 0.0137 + aSeed);
  float u = s.x * 6.2831853, v = acos(2.0 * s.y - 1.0);
  vec3 d = vec3(sin(v) * cos(u), cos(v), sin(v) * sin(u));
  vec3 p0 = uSpawnC + d * uSpawnR * mix(0.85, 1.1, s.z);
  // one in ten drifts between the sand and the camera: passing near the lens, large and soft (the scene's depth)
  if (aSeed.z < 0.1) {
    vec3 toCam = cameraPosition - uSpawnC;
    p0 = uSpawnC + toCam * mix(0.35, 0.8, s.z) + d * uSpawnR * 1.6;
  }
  // carried out and up, in a slow swirl around the sand's vertical axis (Lusion: a spin about the light, plus curl)
  float go = life * uTravel;
  vec3 rel = p0 - uSpawnC + d * go * 0.45 + vec3(0.0, go * 0.75, 0.0);
  float a = life * mix(-0.9, 0.9, s.w);
  rel.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * rel.xz;
  rel += go * 0.18 * vec3(sin(life * 5.0 + s.x * 9.0), sin(life * 4.0 + s.y * 7.0), sin(life * 6.0 + s.z * 8.0));
  vec3 p = uSpawnC + rel;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  // the cursor: a light, and a drift (Lusion's model, at their strength)
  vec2 suv = gl_Position.xy / gl_Position.w * 0.5 + 0.5;
  gl_Position.xy += texture(uPaint, suv).xy * uPaintScale / (uViewport * 0.5) * gl_Position.w;
  // lit by the scene's lights only (Lambert terms in the fragment): where no light reaches, it is not there
  vAlbedo = ramp(fract(aSeed.y * 3.7 + aSeed.z));
  vec3 E[3];
  for (int i = 0; i < 3; i++) {
    vec3 Lv = uLightPos[i] - p;
    E[i] = uLightCol[i] / (dot(Lv, Lv) + uLightR2[i]);
  }
  E[0] *= smoothstep(uSpotCos.x, uSpotCos.y, dot(normalize(p - uLightPos[0]), uSpotDir));
  vL0 = normalize((viewMatrix * vec4(uLightPos[0], 1.0)).xyz - mv.xyz); vE0 = E[0];
  vL1 = normalize((viewMatrix * vec4(uLightPos[1], 1.0)).xyz - mv.xyz); vE1 = E[1];
  vL2 = normalize((viewMatrix * vec4(uLightPos[2], 1.0)).xyz - mv.xyz); vE2 = E[2];
  vL3 = normalize((viewMatrix * vec4(uCursorPos, 1.0)).xyz - mv.xyz);
  float dc = distance(p, uCursorPos) / uCursorReach;
  vE3 = uCursorCol / (1.0 + dc * dc * dc * dc);
  // born small, full for most of its life, shrinking away at the end
  float env = smoothstep(0.0, 0.08, life) * (1.0 - smoothstep(0.55, 1.0, life));
  float px = 2.0 * uRadius * mix(0.6, 1.6, s.z) * env * uPointScale / -mv.z;
  // near the camera: large and soft, as if out of focus (light spread over the disc: dimmer, never brighter)
  vSoft = smoothstep(10.0, 40.0, px);
  vAlpha = clamp((px * px) / (uMinPx * uMinPx), 0.0, 1.0) * env * mix(1.0, 0.35, vSoft);
  gl_PointSize = clamp(max(px, uMinPx), 0.0, 96.0);
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
in vec3 vAlbedo;
in vec3 vL0; in vec3 vL1; in vec3 vL2; in vec3 vL3;
in vec3 vE0; in vec3 vE1; in vec3 vE2; in vec3 vE3;
in float vAlpha;
in float vSoft;
uniform float uExposure;
uniform float uOutScale;
uniform float uWrap;
uniform float uGain;
void main() {
  vec2 g = gl_PointCoord * 2.0 - 1.0;
  g.y = -g.y;
  float r2 = dot(g, g);
  if (r2 > 1.0) discard;
  vec3 n = vec3(g, sqrt(1.0 - r2));
  vec3 L[4] = vec3[4](vL0, vL1, vL2, vL3);
  vec3 E[4] = vec3[4](vE0, vE1, vE2, vE3);
  vec3 col = vec3(0.0);
  for (int i = 0; i < 4; i++) col += E[i] * vAlbedo * max((dot(n, L[i]) + uWrap) / (1.0 + uWrap), 0.0) / 3.14159265;
  col *= uExposure * uOutScale * uGain;
  // a soft grain is a disc of light (no shading of its own), its edge falling off
  float edge = mix(1.0, 1.0 - smoothstep(0.2, 1.0, r2), vSoft);
  gl_FragColor = vec4(col, vAlpha * edge);
}
`;

export class DriftGrains {
  readonly points: THREE.Points;
  readonly material: THREE.ShaderMaterial;
  readonly max: number;

  /** `sand`: the sand's material (its palette, lights, cursor and drift field: shared). */
  constructor(sand: THREE.ShaderMaterial, max = 1600) {
    this.max = max;
    const seeds = new Float32Array(max * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 4));
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(max * 3), 3));
    const su = sand.uniforms;
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: false,
      depthWrite: true,
      alphaToCoverage: true,
      uniforms: {
        uTime: { value: 0 },
        uCount: { value: 0 },
        uSpawnC: { value: new THREE.Vector3() },
        uSpawnR: { value: 1 },
        uTravel: { value: 3 },
        uLife: { value: 10 },
        uRadius: { value: 0.012 },
        uGain: { value: 1 },
        uPointScale: su.uPointScale, uMinPx: su.uMinPx,
        uRamp: su.uRamp, uRampAt: su.uRampAt,
        uLightPos: su.uLightPos, uLightCol: su.uLightCol, uLightR2: su.uLightR2, uSpotDir: su.uSpotDir, uSpotCos: su.uSpotCos,
        uCursorPos: su.uCursorPos, uCursorCol: { value: new THREE.Vector3() }, uCursorReach: su.uCursorReach,
        uPaint: su.uPaint, uPaintScale: { value: 0.1 }, uViewport: su.uViewport,
        uExposure: su.uExposure, uOutScale: su.uOutScale, uWrap: su.uWrap,
      },
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
  }

  /** Each frame: time, where the sand is (centre, shell radius), how many are alive (0..1 of max), their travel and
   *  grain size (world units), and the cursor's light colour x intensity at Lusion's strength. */
  update(time: number, centre: THREE.Vector3, radius: number, density: number, travel: number, grainR: number, cursorCol: THREE.Vector3): void {
    const u = this.material.uniforms;
    u.uTime.value = time;
    (u.uSpawnC.value as THREE.Vector3).copy(centre);
    u.uSpawnR.value = radius;
    u.uCount.value = Math.round(this.max * Math.min(Math.max(density, 0), 1));
    u.uTravel.value = travel;
    u.uRadius.value = grainR;
    (u.uCursorCol.value as THREE.Vector3).copy(cursorCol);
    this.points.visible = density > 0.001;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}
