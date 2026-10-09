import * as THREE from "three";

/**
 * 2.3: the finished glass (lookdev.py glass_material: clear, IOR 1.5, roughness 0, a faint blue-green absorption),
 * traced per pixel as Cycles does it, to the first bounce:
 *   - the camera ray meets the sphere exactly (the mesh only bounds it): reflection by the exact Fresnel, and the rest
 *     refracts in, crosses the ball and refracts out (a ball lens: what is behind it shows upside down);
 *   - each ray leaving the glass is traced against the desk as it was just drawn (its depth, in screen space); where it
 *     finds a surface it takes that pixel; where it escapes the frame it sees the room (the probe: the dome, the
 *     panels) and the set's lights (the lamp's sphere, the rim and fill panels), which are visible to glossy and
 *     transmission rays in Cycles;
 *   - it composes in light (scene-linear) and goes through Blender's view transform like the desk. The desk pixels it
 *     borrows are already display values: they are taken back to light by the transform's grey-axis inverse, and only
 *     the change the glass makes is applied, so a pixel seen through the glass unchanged comes out exactly as drawn.
 * Drawn after the desk (which it samples) and before the sand layer.
 */
export const GLASS_LAYER = 2;

export interface GlassLights {
  /** The lamp: a sphere light (hero units), its radiance. */
  lamp: { pos: THREE.Vector3; radius: number; radiance: THREE.Vector3 };
  /** Area lights: centre, half extents along their two sides, the way they shine, radiance (hero units). */
  rects: { center: THREE.Vector3; halfU: THREE.Vector3; halfV: THREE.Vector3; dir: THREE.Vector3; radiance: THREE.Vector3 }[];
}

const MAX_RECTS = 2;

const VERTEX = /* glsl */ `
out vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
precision highp sampler3D;
out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
in vec3 vWorld;
uniform mat4 projectionMatrix;
uniform vec3 uC;
uniform float uR;
uniform float uEta;
uniform vec3 uAbsorb;          // absorption per hero unit (Blender: density x (1 - colour), metres -> hero units)
uniform sampler2D uBg;         // the desk as drawn (display values)
uniform sampler2D uBgDepth;    // its depth
uniform vec2 uBgTexel;
uniform float uNear;
uniform float uFar;
uniform sampler2D uEnv;        // the room from where the glass hovers (equirectangular, scene-linear, the lights in it)
uniform sampler2D uEnv2;       // ... and from where it lands
uniform float uEnvMix;         // 0 hovering .. 1 landed
uniform float uEnvLights;      // 1: the probes lack the lights, add them
uniform sampler3D uLut;        // Blender's view transform (AgX Punchy), log-encoded input
uniform sampler2D uInvLut;     // its grey axis, inverted: display value -> scene-linear
uniform vec3 uLampP;
uniform float uLampR;
uniform vec3 uLampL;
uniform vec3 uRectC[${MAX_RECTS}];
uniform vec3 uRectU[${MAX_RECTS}];
uniform vec3 uRectV[${MAX_RECTS}];
uniform vec3 uRectD[${MAX_RECTS}];
uniform vec3 uRectL[${MAX_RECTS}];
uniform float uAmount;         // 0..1: how present the glass is (it fades in under the melting frost)
uniform float uDebug;          // lab: 1 the room along the view ray, 2 the refracted ray's room only, 3 where tracing hit

const float LUT_N = 64.0;
const float LUT_MIN = -12.47393;
const float LUT_MAX = 4.026069;

vec3 toDisplay(vec3 lin) {
  vec3 lx = clamp((log2(max(lin, vec3(1e-10))) - LUT_MIN) / (LUT_MAX - LUT_MIN), 0.0, 1.0);
  return texture(uLut, lx * ((LUT_N - 1.0) / LUT_N) + 0.5 / LUT_N).rgb;
}
vec3 toLinear(vec3 d) {
  vec3 x = clamp(d, 0.0, 1.0) * (255.0 / 256.0) + 0.5 / 256.0;
  return vec3(texture(uInvLut, vec2(x.r, 0.5)).r, texture(uInvLut, vec2(x.g, 0.5)).r, texture(uInvLut, vec2(x.b, 0.5)).r);
}
float fresnel(float c, float eta) {
  float s2 = (1.0 - c * c) / (eta * eta);
  if (s2 >= 1.0) return 1.0;
  float ct = sqrt(1.0 - s2);
  float rs = (c - eta * ct) / (c + eta * ct), rp = (eta * c - ct) / (eta * c + ct);
  return 0.5 * (rs * rs + rp * rp);
}
vec3 envAlong(vec3 d) {
  vec2 uv = vec2(atan(d.z, d.x) * 0.15915494 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.31830988 + 0.5);
  return mix(texture(uEnv, uv).rgb, texture(uEnv2, uv).rgb, uEnvMix);
}
// the set's lights a ray from o along d sees (none of them is in the probe)
vec3 lightsAlong(vec3 o, vec3 d) {
  vec3 L = vec3(0.0);
  vec3 oc = o - uLampP;
  float b = dot(oc, d), c = dot(oc, oc) - uLampR * uLampR, h = b * b - c;
  if (h > 0.0 && -b - sqrt(h) > 0.0) L += uLampL;
  for (int i = 0; i < ${MAX_RECTS}; i++) {
    float den = dot(d, uRectD[i]);
    if (den >= -1e-4) continue;                 // it shines one way: seen only from in front
    float t = dot(uRectC[i] - o, uRectD[i]) / den;
    if (t <= 0.0) continue;
    vec3 H = o + d * t - uRectC[i];
    if (abs(dot(H, uRectU[i])) <= dot(uRectU[i], uRectU[i]) && abs(dot(H, uRectV[i])) <= dot(uRectV[i], uRectV[i])) L += uRectL[i];
  }
  return L;
}
float sceneViewZ(vec2 uv) {
  float d = texture(uBgDepth, uv).r;
  if (d >= 0.99999) return -1e9;                 // nothing drawn there: the void
  float z = d * 2.0 - 1.0;
  return 2.0 * uNear * uFar / (z * (uFar - uNear) - (uFar + uNear));
}
vec2 project(vec3 q) {
  vec4 c = projectionMatrix * vec4(q, 1.0);
  return c.xy / c.w * 0.5 + 0.5;
}
// a ray (view space) against the desk's depth: where it first passes from in front of a surface to behind it (a
// crossing, refined by bisection, so neighbouring pixels agree); a crossing far behind the surface is the ray slipping
// behind something nearer (its edge), not a hit: the march goes on
bool trace(vec3 pv, vec3 dv, out vec2 hitUv) {
  float t = 0.02, prevT = 0.0, prevDz = -1.0;
  for (int i = 0; i < 64; i++) {
    vec3 q = pv + dv * t;
    if (q.z > -uNear) return false;               // behind the camera
    vec2 uv = project(q);
    if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return false;
    float dz = sceneViewZ(uv) - q.z;               // > 0: the ray is behind the surface
    float step = t - prevT;
    if (dz > 0.0 && prevDz <= 0.0 && dz < max(0.4, -q.z * 0.04) + step * 4.0) {
      float a = prevT, bb = t;
      for (int k = 0; k < 8; k++) {
        float m = 0.5 * (a + bb);
        vec3 qm = pv + dv * m;
        if (sceneViewZ(project(qm)) - qm.z > 0.0) bb = m; else a = m;
      }
      hitUv = project(pv + dv * bb);
      return true;
    }
    prevT = t; prevDz = dz;
    t = t * 1.09 + 0.04;
  }
  return false;
}
// what a ray leaving the glass at p (world) along d sees: as light, and as the desk drew it (display) if it found it
vec3 seen(vec3 p, vec3 d, out vec3 disp, out bool onDesk) {
  vec2 uv;
  vec3 pv = (viewMatrix * vec4(p, 1.0)).xyz, dv = normalize(mat3(viewMatrix) * d);
  onDesk = trace(pv, dv, uv);
  if (onDesk) {
    disp = texture(uBg, uv).rgb;
    return toLinear(disp);
  }
  vec3 L = envAlong(d) + uEnvLights * lightsAlong(p, d);
  disp = toDisplay(L);
  return L;
}

void main() {
  vec2 suv = gl_FragCoord.xy * uBgTexel;
  vec3 under = texture(uBg, suv).rgb;
  vec3 ro = cameraPosition, rd = normalize(vWorld - cameraPosition);
  vec3 oc = ro - uC;
  float b = dot(oc, rd), c = dot(oc, oc) - uR * uR, h = b * b - c;
  if (h <= 0.0) discard;
  vec3 p1 = ro + rd * (-b - sqrt(h));
  vec3 n1 = (p1 - uC) / uR;
  float cosi = clamp(dot(-rd, n1), 0.0, 1.0);
  float F = fresnel(cosi, uEta);
  // reflection
  vec3 rdR = reflect(rd, n1);
  vec3 dispR; bool hitR;
  vec3 Lr = seen(p1, rdR, dispR, hitR);
  // refraction: in, across, out (a sphere never traps it: the exit angle equals the entry angle)
  vec3 t1 = refract(rd, n1, 1.0 / uEta);
  float chord = -2.0 * dot(p1 - uC, t1);
  vec3 p2 = p1 + t1 * chord;
  vec3 n2 = (p2 - uC) / uR;
  vec3 t2 = refract(t1, -n2, uEta);
  if (dot(t2, t2) < 0.5) t2 = reflect(t1, -n2);
  vec3 dispT; bool hitT;
  vec3 Lt = seen(p2, t2, dispT, hitT);
  vec3 trans = (1.0 - F) * (1.0 - F) * exp(-uAbsorb * chord);
  // one reflection inside: off the back surface (as much as the front reflects, by symmetry) and out through the front.
  // Faint, but it carries the big bright fill panel behind the camera: the grey sheet Cycles shows in the lower half
  vec3 r2 = reflect(t1, n2);
  float chord2 = -2.0 * dot(p2 - uC, r2);
  vec3 p3 = p2 + r2 * chord2;
  vec3 n3 = (p3 - uC) / uR;
  vec3 t3 = refract(r2, -n3, uEta);
  vec3 Li = dot(t3, t3) > 0.5 ? envAlong(t3) + uEnvLights * lightsAlong(p3, t3) : vec3(0.0);
  vec3 inner = (1.0 - F) * F * (1.0 - F) * exp(-uAbsorb * (chord + chord2));
  vec3 L = trans * Lt + F * Lr + inner * Li;
  // what the glass changes, applied to what the background drew (exact where it changes nothing)
  vec3 col = dispT + toDisplay(L) - toDisplay(Lt);
  if (uDebug > 0.5 && uDebug < 1.5) col = toDisplay(envAlong(rd));
  if (uDebug > 1.5 && uDebug < 2.5) col = toDisplay(envAlong(t2) + uEnvLights * lightsAlong(p2, t2));
  if (uDebug > 2.5 && uDebug < 3.5) col = vec3(hitT ? 1.0 : 0.0, hitR ? 1.0 : 0.0, 0.0);
  if (uDebug > 3.5 && uDebug < 4.5) col = toDisplay(F * Lr);                  // reflection only
  if (uDebug > 4.5 && uDebug < 5.5) col = toDisplay(trans * Lt);            // refraction only
  if (uDebug > 5.5) col = toDisplay(inner * Li);                             // the internal reflection only
  gl_FragColor = vec4(mix(under, clamp(col, 0.0, 1.0), uAmount), 1.0);
}
`;

export class GlassBall {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;

  constructor(env: THREE.Texture, lut: THREE.Data3DTexture, invLut: THREE.Texture, lights: GlassLights, heroPerMetre: number) {
    const rect = (i: number, key: "center" | "halfU" | "halfV" | "dir" | "radiance") =>
      lights.rects[i] ? lights.rects[i][key].clone() : new THREE.Vector3(0, -1e6, 0);
    // Blender's volume absorption: coefficient density x (1 - colour) per metre
    const absorb = new THREE.Vector3(0.86, 0.92, 0.93).multiplyScalar(-1).addScalar(1).multiplyScalar(0.35 / heroPerMetre);
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        uC: { value: new THREE.Vector3() },
        uR: { value: 1 },
        uEta: { value: 1.5 },
        uAbsorb: { value: absorb },
        uBg: { value: null },
        uBgDepth: { value: null },
        uBgTexel: { value: new THREE.Vector2(1, 1) },
        uNear: { value: 0.1 },
        uFar: { value: 1000 },
        uEnv: { value: env },
        uEnv2: { value: env },
        uEnvMix: { value: 0 },
        uEnvLights: { value: 1 },
        uLut: { value: lut },
        uInvLut: { value: invLut },
        uLampP: { value: lights.lamp.pos.clone() },
        uLampR: { value: lights.lamp.radius },
        uLampL: { value: lights.lamp.radiance.clone() },
        uRectC: { value: [0, 1].map((i) => rect(i, "center")) },
        uRectU: { value: [0, 1].map((i) => rect(i, "halfU")) },
        uRectV: { value: [0, 1].map((i) => rect(i, "halfV")) },
        uRectD: { value: [0, 1].map((i) => rect(i, "dir")) },
        uRectL: { value: [0, 1].map((i) => (lights.rects[i] ? lights.rects[i].radiance.clone() : new THREE.Vector3())) },
        uAmount: { value: 0 },
        uDebug: { value: 0 },
      },
    });
    this.mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 24), this.material);
    this.mesh.layers.set(GLASS_LAYER);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /** The ball (hero units) and how present the glass is, 0..1. */
  update(center: THREE.Vector3, radius: number, amount: number): void {
    const u = this.material.uniforms;
    (u.uC.value as THREE.Vector3).copy(center);
    u.uR.value = radius;
    u.uAmount.value = amount;
    this.mesh.position.copy(center);
    this.mesh.scale.setScalar(radius * 1.004);   // the mesh only bounds the true sphere; a hair wider so it never clips it
    this.mesh.visible = amount > 0.001;
  }

  /** The room as seen from the glass's own place, hovering and landed (with the lights in them). */
  setProbes(hover: THREE.Texture, landed: THREE.Texture): void {
    const u = this.material.uniforms;
    u.uEnv.value = hover;
    u.uEnv2.value = landed;
    u.uEnvLights.value = 0;
  }

  /** Between the two probes: 0 hovering .. 1 landed. */
  set probeMix(v: number) {
    this.material.uniforms.uEnvMix.value = v;
  }

  /** A rect light's radiance now (the side fill rises with the lid). */
  setRectRadiance(i: number, radiance: THREE.Vector3): void {
    const v = (this.material.uniforms.uRectL.value as THREE.Vector3[])[i];
    if (v) v.copy(radiance);
  }

  /** The desk as just drawn, which the glass looks through and at. */
  setBackground(color: THREE.Texture, depth: THREE.Texture, width: number, height: number, camera: THREE.PerspectiveCamera): void {
    const u = this.material.uniforms;
    u.uBg.value = color;
    u.uBgDepth.value = depth;
    (u.uBgTexel.value as THREE.Vector2).set(1 / width, 1 / height);
    u.uNear.value = camera.near;
    u.uFar.value = camera.far;
  }

  get visible(): boolean {
    return this.mesh.visible;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
