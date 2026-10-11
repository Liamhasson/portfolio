import * as THREE from "three";

/**
 * Loose grains (the floating grains, the rising sand) drawn and lit as the sand's own: one vertex shader (light through
 * the sand's density volumes, the cursor's light and drift, motion blur, the pebble's shape) feeding the sand's fragment
 * shader. Each system declares its inputs (`decl`) and computes the four locals the body reads (`locals`):
 *   vec3 iPos (world), vec3 iVel (world / s), vec2 iSizeHue (radius, hue), float iSeed.
 */
const LOOSE_UNIFORMS = /* glsl */ `
uniform vec3 uRamp[5];
uniform float uRampAt[5];
uniform vec3 uLightPos[3];
uniform vec3 uLightCol[3];
uniform vec3 uLightR2;
uniform vec3 uSpotDir;
uniform vec2 uSpotCos;
uniform vec3 uCursorPos;
uniform vec3 uCursorCol;
uniform float uCursorReach;
uniform float uExposure;
uniform float uShutter;
uniform vec4 uShadeBall;   // the ball's shadow on the lamp's light (rising sand): its centre and radius, the lamp's,
uniform vec4 uShadeLamp;   // and how dark (0: none, the floating grains)
uniform float uShadeK;
uniform vec2 uMotionBlur;
uniform float uPointScale;
uniform float uMinPx;
uniform vec2 uEdge;
uniform vec2 uGround;
uniform sampler2D uPaint;    // the cursor's drift field, as the sand's (CSS px / s)
uniform float uPaintScale;
uniform vec2 uViewport;
uniform float uBufH;
// the sand's own shadows (shaders.ts: the same density volumes, frames and march), so a grain behind the cloud is in
// its shadow as the cloud's own grains are
uniform vec3 uLo;
uniform vec3 uSize;
uniform sampler3D uVolA;
uniform sampler3D uVolB;
uniform float uVolMix;
uniform float uSigmaMax;
uniform vec2 uShadowK;
uniform float uCompact;
uniform float uGrainShadow;   // 1 = in the sand's shadows, 0 = as before (lab compare)
uniform vec3 uChaosC;
uniform vec3 uChaosShift;
uniform mat3 uChaosRot;
uniform vec3 uBallC;
uniform vec3 uBallVolC;
uniform float uBallVolS;
uniform mat3 uBallRot;
// what the sand's fragment shader reads (shaders.ts SAND_FRAGMENT): these grains are shaded by it, as its own
out vec3 vAlbedo;
out vec3 vL0; out vec3 vL1; out vec3 vL2; out vec3 vL3;
out vec3 vE0; out vec3 vE1; out vec3 vE2; out vec3 vE3;
out float vAlpha;
out float vAmbient;
out vec3 vFillE;
out float vCompact;
out vec4 vEll;
out float vGround;
out float vBounceW;
out float vPx;
out float vEdgePx;
out float vBlur;
out float vBig;
`;
const LOOSE_FUNCS = /* glsl */ `
vec3 ramp(float h) {
  vec3 c = uRamp[0];
  for (int i = 1; i < 5; i++) c = mix(c, uRamp[i], clamp((h - uRampAt[i - 1]) / max(uRampAt[i] - uRampAt[i - 1], 1e-4), 0.0, 1.0));
  return c;
}
float density(vec3 p) {
  vec3 uvw = (p - uLo) / uSize;
  if (any(lessThan(uvw, vec3(0.0))) || any(greaterThan(uvw, vec3(1.0)))) return 0.0;
  float v = mix(texture(uVolA, uvw).r, texture(uVolB, uvw).r, uVolMix);
  return v * v * uSigmaMax;   // sqrt encoding
}
// light reaching p from a light through the sand (fewer steps than the sand's own: these grains are few and small)
float transmittance(vec3 p, vec3 lightPos, float dist, float k) {
  vec3 dir = normalize(lightPos - p);
  float ds = dist / 6.0, tau = 0.0;
  for (int i = 0; i < 6; i++) tau += density(p + dir * ds * (float(i) + 0.5)) * ds;
  return exp(-tau * k);
}
`;
const LOOSE_BODY = /* glsl */ `
  // the sand's frame for its volumes, at the sand's compaction (as the sand's own grains are shaded)
  float t = smoothstep(0.0, 1.0, uCompact);
  mat3 chaosInv = transpose(uChaosRot), ballInv = transpose(uBallRot);
  vec3 pv = mix(uChaosC + chaosInv * (iPos - uChaosShift - uChaosC), uBallVolC + ballInv * (iPos - uBallC) * uBallVolS, t);
  float shadowK = mix(uShadowK.x, uShadowK.y, t) * uGrainShadow;
  vec3 E[3];
  for (int i = 0; i < 3; i++) {
    vec3 Lv = uLightPos[i] - iPos;
    vec3 lp = mix(uChaosC + chaosInv * (uLightPos[i] - uChaosShift - uChaosC), uBallVolC + ballInv * (uLightPos[i] - uBallC) * uBallVolS, t);
    float T = shadowK > 0.0 ? transmittance(pv, lp, min(length(Lv) * mix(1.0, uBallVolS, t), mix(8.5, 3.0, t)), shadowK) : 1.0;   // (no march when unshadowed)
    E[i] = uLightCol[i] * T / (dot(Lv, Lv) + uLightR2[i]);
  }
  E[0] *= smoothstep(uSpotCos.x, uSpotCos.y, dot(normalize(iPos - uLightPos[0]), uSpotDir));
  // in the ball's shadow (the share of the lamp's disc the ball covers, seen from the grain): as the desk under it
  if (uShadeK > 0.0) {
    vec3 toL = uShadeLamp.xyz - iPos, toB = uShadeBall.xyz - iPos;
    float dL = length(toL), dB = length(toB);
    if (dB < dL) {
      float rL = uShadeLamp.w / dL, rB = uShadeBall.w / dB;
      float a = acos(clamp(dot(toL / dL, toB / dB), -1.0, 1.0));
      E[0] *= 1.0 - uShadeK * (1.0 - smoothstep(abs(rL - rB), rL + rB, a)) * min(1.0, (rB * rB) / (rL * rL));
    }
  }
  float dc = distance(iPos, uCursorPos) / uCursorReach;
  vec3 Ec = uCursorCol / (1.0 + dc * dc * dc * dc);
  // where no light reaches it, it isn't there
  float lit = smoothstep(0.015, 0.12, dot((E[0] + E[1] + E[2] + Ec) * uExposure, vec3(0.2126, 0.7152, 0.0722)));
  float size = iSizeHue.x * lit;
  vec4 mv = viewMatrix * vec4(iPos, 1.0);
  gl_Position = projectionMatrix * mv;
  // the cursor's drift, as it moves the sand's front grains (one system: the same field, the same strength)
  vec2 suv = gl_Position.xy / gl_Position.w * 0.5 + 0.5;
  vec2 pvel = texture(uPaint, suv).xy;
  gl_Position.xy += pvel * uPaintScale / (uViewport * 0.5) * gl_Position.w;
  // the cursor only moves them, never stretches them (Liam, 2026-10-10, the sand's own fix 01138e3: its streak smudged)
  vec2 blur = vec2(0.0);
  // the grain: a randomly squashed, randomly turned pebble, as the sand's
  float h1 = fract(iSeed * 7.13), h2 = fract(iSeed * 13.71), h3 = fract(iSeed * 3.97);
  vec2 squash = 1.0 + 0.22 * (vec2(h1, h2) * 2.0 - 1.0);
  float ang = h3 * 6.2831853;
  float px = 2.0 * size * uPointScale / -mv.z * max(squash.x, squash.y);
  // its own motion over the shutter, as the sand's (at most a few grain lengths)
  if (uMotionBlur.x > 0.0 && px > 0.0) {
    vec4 c1 = projectionMatrix * viewMatrix * vec4(iPos - iVel * uShutter * uMotionBlur.x, 1.0);
    if (c1.w > 0.0) {
      vec2 bufPx = vec2(uViewport.x * uBufH / uViewport.y, uBufH);
      vec2 own = (gl_Position.xy / gl_Position.w - c1.xy / c1.w) * 0.5 * bufPx;
      float ol = length(own), cap = px * uMotionBlur.y;
      if (ol > cap) own *= cap / ol;
      blur += own;
    }
  }
  float bl = length(blur);
  if (bl > 0.5 && px > 0.0) {
    float k = 1.0 + bl / px;
    squash = vec2(max(squash.x, squash.y) * k, min(squash.x, squash.y));
    ang = atan(blur.y, blur.x);
    px *= k;
  }
  vEll = vec4(squash, cos(ang), sin(ang));
  vAlpha = clamp((px * px) / (uMinPx * uMinPx), 0.0, 1.0);
  gl_PointSize = px > 0.0 ? max(px, uMinPx) : 0.0;
  vPx = gl_PointSize;
  vEdgePx = uEdge.x;
  vBlur = 0.0;
  vBig = 0.0;
  vAlbedo = ramp(iSizeHue.y);
  vL0 = normalize((viewMatrix * vec4(uLightPos[0], 1.0)).xyz - mv.xyz); vE0 = E[0];
  vL1 = normalize((viewMatrix * vec4(uLightPos[1], 1.0)).xyz - mv.xyz); vE1 = E[1];
  vL2 = normalize((viewMatrix * vec4(uLightPos[2], 1.0)).xyz - mv.xyz); vE2 = E[2];
  vL3 = normalize((viewMatrix * vec4(uCursorPos, 1.0)).xyz - mv.xyz); vE3 = Ec;
  vAmbient = 1.0;
  vFillE = vec3(0.0);
  vCompact = 0.0;
  vBounceW = 0.0;
  vGround = exp(-max(iPos.y - uGround.x, 0.0) / uGround.y);
`;

export function looseGrainVertex(decl: string, locals: string): string {
  return `precision highp float;\n${decl}\n${LOOSE_UNIFORMS}\n${LOOSE_FUNCS}\nvoid main() {\n${locals}\n${LOOSE_BODY}\n}\n`;
}

/** The sand's own uniforms, shared (its palette, lights, material, cursor, drift field, grain look, shadows). */
export function looseGrainUniforms(sand: THREE.ShaderMaterial): Record<string, THREE.IUniform> {
  const su = sand.uniforms;
  return {
    uRamp: su.uRamp, uRampAt: su.uRampAt,
    uLightPos: su.uLightPos, uLightCol: su.uLightCol, uLightR2: su.uLightR2, uSpotDir: su.uSpotDir, uSpotCos: su.uSpotCos,
    uCursorPos: su.uCursorPos, uCursorCol: su.uCursorCol, uCursorReach: su.uCursorReach,
    uExposure: su.uExposure, uOutScale: su.uOutScale, uWrap: su.uWrap, uGapFill: su.uGapFill, uRough: su.uRough,
    uBounce: su.uBounce, uGroundCol: su.uGroundCol, uFillCol: su.uFillCol, uFrontKey: su.uFrontKey, uUpView: su.uUpView,
    uSpec: su.uSpec, uGloss: su.uGloss, uSSS: su.uSSS, uLampSat: su.uLampSat,
    uShutter: su.uShutter, uMotionBlur: su.uMotionBlur, uPointScale: su.uPointScale, uMinPx: su.uMinPx, uEdge: su.uEdge,
    uGround: su.uGround, uPaint: su.uPaint, uPaintScale: su.uPaintScale, uViewport: su.uViewport, uBufH: su.uBufH,
    // the sand's shadows: its own uniforms, shared (its volumes swap as it compacts)
    uLo: su.uLo, uSize: su.uSize, uVolA: su.uVolA, uVolB: su.uVolB, uVolMix: su.uVolMix, uSigmaMax: su.uSigmaMax,
    uShadowK: su.uShadowK, uCompact: su.uCompact, uChaosC: su.uChaosC, uChaosShift: su.uChaosShift, uChaosRot: su.uChaosRot, uBallC: su.uBallC,
    uBallVolC: su.uBallVolC, uBallVolS: su.uBallVolS, uBallRot: su.uBallRot, uGrainShadow: { value: 1 },
    uShadeBall: { value: new THREE.Vector4() }, uShadeLamp: { value: new THREE.Vector4() }, uShadeK: { value: 0 },
  };
}
