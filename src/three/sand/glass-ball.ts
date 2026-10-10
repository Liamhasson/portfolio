import * as THREE from "three";
import { ATTEMPT_FIELD } from "./shaders";
import { SIMPLEX_DECL } from "./frost-skin";

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
 *
 * It is also the frost, from 2.2 on: frost and glass are one surface (as in Blender's frost glass material), read on the
 * attempt field in the ball's own frame, so it turns with the ball. Where the field has reached, the surface is frost,
 * lit by the sand's lights exactly as the frost skin was (the look approved in the attempts clip, through the same tone
 * mapping as the sand); where the clearing wave of the build has reached (meltAt), it turns to glass: rough, warm and
 * blurred at first, sharpening into the finished glass. Its edges blend into the sand around them (never cut).
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
// the frost (shared with the sand: its attempt field, the ball's turn, its lights)
uniform mat3 uBallRot;
uniform vec3 uLightPos[3];
uniform vec3 uLightCol[3];
uniform vec3 uLightR2;
uniform vec3 uSpotDir;
uniform vec2 uSpotCos;
uniform vec3 uGroundCol;
uniform float uExposure;
uniform float uFrostGain;
uniform vec3 uTint;            // frost tint where it has just formed
uniform float uWrapK;          // how far light wraps through the frost
uniform float uSpecK;
uniform vec3 uClearTint;       // the colour it clears toward (warm: the sand and desk show through)
uniform float uClearDark;      // clearing frost reads darker: it shows the ball's interior, not a lit surface
uniform float uRoughMax;       // the glass's roughness the moment it clears from frost (blurred, warm), sharpening to 0
uniform float uFrostOn;        // 1 while the frost exists (2.2 on); 0: the glass alone
uniform float uRoughK;         // calibration: the frost's roughness scale
uniform float uBendEnd;        // calibration: the blur at which rough glass passes light straight through
uniform float uInterior;       // the sand-filled interior's light, seen through the frost (scale on the frost's lighting)
uniform float uRidge;          // how much the clearing front's ridge tilts the surface
uniform float uClearHold;      // calibration: >= 0 holds the whole ball at this clearness (frost everywhere, no wave)

${SIMPLEX_DECL}
${ATTEMPT_FIELD}
#include <common>
#include <tonemapping_pars_fragment>

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
bool trace(vec3 pv, vec3 dv, out vec2 hitUv, out float hitT, out float hitZ) {
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
      hitT = bb; hitZ = (pv + dv * bb).z;
      return true;
    }
    prevT = t; prevDz = dz;
    t = t * 1.09 + 0.04;
  }
  return false;
}
// what a ray leaving glass of roughness r at p (world) along d sees: as light, and as the desk drew it (display) if it
// found it. A rough surface spreads the ray over a cone of ~r radians: the desk and the room are read blurred by that
// much (their mip levels), so frosted glass shows what is behind it as soft light, never noise.
vec3 seen1(vec3 p, vec3 d, float r, out vec3 disp, out bool onDesk) {
  vec2 uv; float tHit, zHit;
  vec3 pv = (viewMatrix * vec4(p, 1.0)).xyz, dv = normalize(mat3(viewMatrix) * d);
  onDesk = trace(pv, dv, uv, tHit, zHit);
  if (onDesk) {
    // the cone's width where it lands, in the desk's pixels
    float pxPerUnit = 1.0 / (2.0 * max(-zHit, 1e-3) / projectionMatrix[1][1] * uBgTexel.y);
    float lod = log2(max(r * tHit * pxPerUnit, 1.0));
    disp = textureLod(uBg, uv, lod).rgb;
    return toLinear(disp);
  }
  vec2 euv = vec2(atan(d.z, d.x) * 0.15915494 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.31830988 + 0.5);
  float elod = log2(max(r * float(textureSize(uEnv, 0).x) * 0.15915494, 1.0));
  vec3 L = mix(textureLod(uEnv, euv, elod).rgb, textureLod(uEnv2, euv, elod).rgb, uEnvMix)
    + uEnvLights * lightsAlong(p, d) * (1.0 / (1.0 + r * r * 40.0));
  disp = toDisplay(L);
  return L;
}

// as seen1, through rough glass: sharp glass needs the exact trace (what is behind it, where it is); frosted glass only
// needs the light around it, blurred, which the 360 probe rendered from the ball's own place holds (read by mip level,
// so it is smooth, never stepped). The two blend as the roughness falls.
vec3 seen(vec3 p, vec3 d, float r, out vec3 disp, out bool onDesk) {
  float w = smoothstep(0.02, 0.12, r);
  vec3 L = vec3(0.0);
  disp = vec3(0.0); onDesk = false;
  if (w < 0.999) L = seen1(p, d, r, disp, onDesk);
  if (w > 0.001) {
    vec2 euv = vec2(atan(d.z, d.x) * 0.15915494 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.31830988 + 0.5);
    float elod = log2(max(r * float(textureSize(uEnv, 0).x) * 0.15915494 * 1.5, 1.0));
    vec3 Lp = mix(textureLod(uEnv, euv, elod).rgb, textureLod(uEnv2, euv, elod).rgb, uEnvMix);
    L = mix(L, Lp, w);
    disp = mix(disp, toDisplay(Lp), w);
  }
  return L;
}

// the frost's light scattered in its skin (Blender's frost glass: the part not transmitted, subsurface, warm): the
// lights wrapping through it, and the lit desk below
vec3 frostAt(vec3 p, vec3 n, vec3 v, float clear) {
  vec3 tint = mix(uTint, uClearTint, clear);
  vec3 col = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    vec3 L = uLightPos[i] - p;
    float d2 = dot(L, L);
    L = normalize(L);
    vec3 E = uLightCol[i] / (d2 + uLightR2[i]);
    if (i == 0) E *= smoothstep(uSpotCos.x, uSpotCos.y, dot(-L, uSpotDir));
    float wrap = max((dot(n, L) + uWrapK) / (1.0 + uWrapK), 0.0);
    col += E * tint * wrap / 3.14159265;
  }
  float down = clamp(0.5 - 0.5 * n.y, 0.0, 1.0);
  col += tint * uGroundCol * down * down * 0.35;
  return col * uFrostGain;
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
  // the frost and how far it has cleared here, on the ball's own frame (Blender's frost glass: clear 0 frost .. 1)
  vec3 dObj = transpose(uBallRot) * n1;
  float band = uFrostOn > 0.5 ? attBand(dObj) : 1.0;
  float exists = uFrostOn > 0.5 ? smoothstep(0.0, 0.3, band) * step(0.001, uAttDepth) * step(uAttLo, 0.999) : 1.0;
  float m = uFrostOn > 0.5 ? meltAt(dObj) : 1.0;
  if (uClearHold >= 0.0) { exists = 1.0; band = 1.0; m = 0.0; }
  if (exists < 0.004) discard;
  // the attempt's clearness; as the build begins the whole ball frosts over (fresh, milky), then the wave clears it
  float pre = mix(band * uAttDepth, 0.1 * band, uAttFull);
  float cl = uClearHold >= 0.0 ? uClearHold : mix(pre, 1.0, smoothstep(0.0, 0.8, m));
  float done = smoothstep(0.8, 1.0, m);                               // the frost material giving way to the glass
  float rough = mix(0.6, 0.14, cl) * (1.0 - done) * uRoughK;
  float T = mix(mix(0.55, 0.85, cl), 1.0, done);                     // transmitted; the rest scatters in the skin
  vec3 tint = mix(mix(uTint, vec3(1.0), cl), vec3(1.0), done);
  // the clearing front is a ridge in the surface (the same mask drives a displacement): its slope tilts the normal, so
  // the glass bends what's behind it along the front as it travels
  if (uFrostOn > 0.5 && m > 0.001 && m < 0.999 && uClearHold < 0.0) {
    vec3 ta = normalize(cross(dObj, abs(dObj.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0))), tb = cross(dObj, ta);
    float e = 0.02;
    float h0 = m * (1.0 - m);
    float ha = meltAt(normalize(dObj + ta * e)), hb = meltAt(normalize(dObj + tb * e));
    vec2 g = vec2(ha * (1.0 - ha) - h0, hb * (1.0 - hb) - h0) / e;
    vec3 bumpObj = normalize(dObj - (ta * g.x + tb * g.y) * uRidge);
    n1 = normalize(uBallRot * bumpObj);
  }
  float cosi = clamp(dot(-rd, n1), 0.0, 1.0);
  float F = fresnel(cosi, uEta);
  // reflection
  vec3 rdR = reflect(rd, n1);
  vec3 dispR; bool hitR;
  // the glossy lobe's half-width goes with roughness squared (GGX alpha); two rough faces for what passes through
  float coneR = pow(rough, 1.5), coneT = 2.0 * pow(rough, 1.5);
  vec3 Lr = seen(p1, rdR, coneR, dispR, hitR);
  // refraction: in, across, out (a sphere never traps it: the exit angle equals the entry angle); two rough faces
  vec3 t1 = refract(rd, n1, 1.0 / uEta);
  float chord = -2.0 * dot(p1 - uC, t1);
  vec3 p2 = p1 + t1 * chord;
  vec3 n2 = (p2 - uC) / uR;
  vec3 t2 = refract(t1, -n2, uEta);
  if (dot(t2, t2) < 0.5) t2 = reflect(t1, -n2);
  // very rough glass passes light from all around the straight-through direction: it bends toward it as it frosts
  vec3 tT = normalize(mix(t2, rd, smoothstep(0.03, uBendEnd, coneT)));
  vec3 dispT; bool hitT;
  vec3 Lt = seen(p2, tT, coneT, dispT, hitT);
  // until the clearing wave passes, the ball is still sand inside: the frost transmits that lit interior, not the room
  // (the build empties it: as the frost spreads over the ball the sand goes into it, then the wave clears it)
  float hollow = uClearHold >= 0.0 ? 1.0 : max(smoothstep(0.0, 0.6, m), uAttFull);
  vec3 Lsand = frostAt(p1, n1, -rd, cl) * uInterior;
  Lt = mix(Lsand, Lt, hollow);
  dispT = mix(toDisplay(Lsand), dispT, hollow);
  vec3 trans = (1.0 - F) * (1.0 - F) * exp(-uAbsorb * chord) * T * tint;
  // one reflection inside: off the back surface (as much as the front reflects, by symmetry) and out through the front.
  // Faint, but it carries the big bright fill panel behind the camera: the grey sheet Cycles shows in the lower half
  vec3 r2 = reflect(t1, n2);
  float chord2 = -2.0 * dot(p2 - uC, r2);
  vec3 p3 = p2 + r2 * chord2;
  vec3 n3 = (p3 - uC) / uR;
  vec3 t3 = refract(r2, -n3, uEta);
  vec3 dispI; bool hitI;
  vec3 Li = dot(t3, t3) > 0.5 ? seen(p3, t3, coneT * 1.5, dispI, hitI) : vec3(0.0);
  vec3 inner = (1.0 - F) * F * (1.0 - F) * exp(-uAbsorb * (chord + chord2)) * T * tint;
  // the light scattered in the frost's skin (none once it is glass)
  vec3 Ls = (1.0 - T) * (1.0 - F) * frostAt(p1, n1, -rd, cl);
  vec3 L = trans * Lt + F * Lr + inner * Li + Ls;
  // what the glass changes, applied to what the background drew (exact where it changes nothing)
  vec3 col = dispT + toDisplay(L) - toDisplay(Lt);
  if (uDebug > 0.5 && uDebug < 1.5) col = toDisplay(envAlong(rd));
  if (uDebug > 1.5 && uDebug < 2.5) col = toDisplay(envAlong(t2) + uEnvLights * lightsAlong(p2, t2));
  if (uDebug > 2.5 && uDebug < 3.5) col = vec3(hitT ? 1.0 : 0.0, hitR ? 1.0 : 0.0, 0.0);
  if (uDebug > 3.5 && uDebug < 4.5) col = toDisplay(F * Lr);                  // reflection only
  if (uDebug > 4.5 && uDebug < 5.5) col = toDisplay(trans * Lt);            // refraction only
  if (uDebug > 5.5) col = toDisplay(inner * Li);                             // the internal reflection only
  gl_FragColor = vec4(mix(under, clamp(col, 0.0, 1.0), exists * uAmount), 1.0);
}
`;

export class GlassBall {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;

  /** `sand`: the sand's material (its attempt field, the ball's turn, its lights: the frost shares them). */
  constructor(env: THREE.Texture, lut: THREE.Data3DTexture, invLut: THREE.Texture, lights: GlassLights, heroPerMetre: number, sand: THREE.ShaderMaterial) {
    const su = sand.uniforms;
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
        uBallRot: su.uBallRot,
        uAttUp: su.uAttUp, uAttLo: su.uAttLo, uAttBreak: su.uAttBreak, uAttDepth: su.uAttDepth, uAttFull: su.uAttFull, uMelt: su.uMelt, uMeltUp: su.uMeltUp,
        uLightPos: su.uLightPos, uLightCol: su.uLightCol, uLightR2: su.uLightR2, uSpotDir: su.uSpotDir, uSpotCos: su.uSpotCos,
        uGroundCol: su.uGroundCol, uExposure: su.uExposure,
        // the frost skin's look, calibrated 2026-10-09 against the approved attempts clip (frames 24, 74, 144)
        // calibrated 2026-10-10 against Blender's frost glass at clear 0.1 / 0.5 / 0.9 (scripts/lab/frost-compare.mjs)
        uFrostGain: { value: 0.5 },
        uTint: { value: new THREE.Vector3(0.9, 0.6, 0.5) },
        uWrapK: { value: 0.8 },
        uSpecK: { value: 1 },
        uClearTint: { value: new THREE.Vector3(0.88, 0.7, 0.6) },
        uClearDark: { value: 0.45 },
        uRoughMax: { value: 0.35 },
        uRoughK: { value: 1 },
        uClearHold: { value: -1 },
        uRidge: { value: 0.015 },
        uInterior: { value: 2.5 },   // fitted 2026-10-10 against the attempts clip (frames 74, 144)
        uBendEnd: { value: 3 },
        uFrostOn: { value: 1 },
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

  /** Calibration: the frost's look (gain, tint, wrap, spec, clearTint, clearDark, roughMax). */
  setLook(l: { gain?: number; tint?: number[]; wrap?: number; spec?: number; clearTint?: number[]; clearDark?: number; roughMax?: number; roughK?: number; clearHold?: number; bendEnd?: number; ridge?: number; interior?: number }): void {
    const u = this.material.uniforms;
    if (l.gain !== undefined) u.uFrostGain.value = l.gain;
    if (l.tint) (u.uTint.value as THREE.Vector3).set(l.tint[0], l.tint[1], l.tint[2]);
    if (l.wrap !== undefined) u.uWrapK.value = l.wrap;
    if (l.spec !== undefined) u.uSpecK.value = l.spec;
    if (l.clearTint) (u.uClearTint.value as THREE.Vector3).set(l.clearTint[0], l.clearTint[1], l.clearTint[2]);
    if (l.clearDark !== undefined) u.uClearDark.value = l.clearDark;
    if (l.roughMax !== undefined) u.uRoughMax.value = l.roughMax;
    if (l.roughK !== undefined) u.uRoughK.value = l.roughK;
    if (l.clearHold !== undefined) u.uClearHold.value = l.clearHold;
    if (l.bendEnd !== undefined) u.uBendEnd.value = l.bendEnd;
    if (l.ridge !== undefined) u.uRidge.value = l.ridge;
    if (l.interior !== undefined) u.uInterior.value = l.interior;
  }

  /** The room as seen from the glass's own place, hovering and landed (with the lights in them). */
  setProbes(hover: THREE.Texture, landed: THREE.Texture): void {
    const u = this.material.uniforms;
    if (u.uEnv.value === hover && u.uEnv2.value === landed) return;
    for (const t of [hover, landed]) {
      if (t.minFilter === THREE.LinearMipmapLinearFilter) continue;
      // frosted glass reads them blurred: by mip level
      t.generateMipmaps = true;
      t.wrapS = THREE.RepeatWrapping;   // a 360: its left and right ends meet (no seam where the blur crosses them)
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.needsUpdate = true;
    }
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
