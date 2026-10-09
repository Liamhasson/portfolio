/**
 * The sand's shaders (GLSL 3, three.js ShaderMaterial). Look target: the approved Cycles renders
 * (`blender/lookdev/renders/lookdev-ch1-hero-*.jpg`): solid, crisp, matte grains, no glow, lit by a warm key front left,
 * a rose rim behind and a dim cool fill, in a pitch black void.
 *
 * Each grain is one screen point shaded as a small sphere. Self-shadowing (what makes the ball read as a mass) comes from
 * marching toward each light through a density volume baked from the same grains.
 */

// Simplex noise 3D: Ian McEwan, Ashima Arts / Stefan Gustavson (webgl-noise), MIT licence.
const SIMPLEX = /* glsl */ `
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

export const SAND_VERTEX = /* glsl */ `
precision highp float;
precision highp sampler3D;

in uvec2 aPos;        // packed: chaos 11/10/11 bits in its box; ball octahedral direction 12+12 bits, distance 8 bits
in vec4 aAttr;        // hue chaos, hue ball, radii (chaos high nibble, ball low nibble, of uRadMax), compaction delay

uniform vec3 uLo;
uniform vec3 uSize;
uniform vec3 uChaosLo;
uniform vec3 uChaosSize;
uniform float uBallPosMax;
uniform float uRadMax;
uniform float uCompact;      // 0 chaos .. 1 ball
uniform float uDelaySpan;
uniform float uRampLen;
uniform vec3 uBallC;
uniform vec3 uBallVolC;      // the ball the density volume was baked for (the hero's): retargeted balls map into it
uniform float uBallVolS;     // volume units per world unit (hero radius / this ball's radius)
uniform float uBallGrain;    // grain size scale for a retargeted ball (its radius / the hero's)
uniform mat3 uBallRot;       // the ball's spin (object -> world)
uniform vec3 uChaosC;
uniform mat3 uChaosRot;      // the chaos moving around itself
uniform float uTime;
uniform float uDrift;        // ambient flow amplitude (world units)
uniform float uDriftFreq;
uniform float uDriftSpeed;
uniform float uPointScale;   // pixels per world unit at distance 1 (viewport height / (2 tan(vfov/2)))
uniform float uMinPx;
uniform float uCountScale;   // fewer grains (lower tiers) are drawn a little larger, so the surface stays covered
uniform vec2 uRadScale;    // chaos, ball
uniform vec2 uEdge;        // soft rim in px, chaos, ball (the render's grains are softer where they stand alone)
uniform float uChaosShare;   // the chaos holds fewer grains than the ball (render: ~286k vs 520k); the rest grow in

uniform sampler3D uVolA;     // the two density volumes around the current compaction
uniform sampler3D uVolB;
uniform float uVolMix;
uniform float uSigmaMax;
uniform int uSteps;
uniform vec2 uShadowK;     // chaos, ball: the volume smears the chaos's thin sheets, so they need a stronger march
uniform float uBallR;
uniform vec2 uLocal;      // local density -> occlusion (chaos), and -> bounce weight
uniform vec2 uCavity;     // ball: grains below the surface are shaded by their neighbours (start depth, strength)

uniform vec3 uLightPos[3];
uniform vec3 uLightCol[3];   // colour * power, calibrated
uniform vec3 uSpotDir;       // light 0 as a spot (the desk lamp): its direction, and the cone's cosines (outer, inner)
uniform vec2 uSpotCos;
uniform vec3 uLightR2;       // each light's radius squared: a sized light can't blow up at close range (0 = point)
uniform vec3 uRamp[4];
uniform vec4 uRampAt;
uniform vec3 uCursorPos;     // the cursor as a light (Lusion model), on a plane through the sand
uniform vec3 uCursorCol;     // colour * intensity (fades with the pointer)
uniform float uCursorReach;  // world units: how far its light carries
uniform sampler2D uPaint;    // the cursor's drift field: CSS px / s
uniform float uPaintScale;   // seconds: velocity -> offset
uniform vec2 uFront;         // the drift only moves the front layer: optical depth to the camera (strength, falloff)
uniform vec2 uViewport;      // CSS px

out vec3 vAlbedo;
out vec3 vL0; out vec3 vL1; out vec3 vL2; out vec3 vL3;   // light directions, view space (3 = cursor)
out vec3 vE0; out vec3 vE1; out vec3 vE2; out vec3 vE3;
out float vAlpha;
out float vAmbient;
out float vBounceW;
out float vPx;
out float vEdgePx;
out float vGround;   // how much of the desk below this grain sees (surface grains of the formed ball)
out vec4 vEll;      // grain shape: squash x, squash y, cos, sin of its turn (Blender: random squash +-22%, random rotation)

${SIMPLEX}

// Blender's ColorRamp, linear interpolation between the stops
vec3 ramp(float h) {
  vec3 c = uRamp[0];
  c = mix(c, uRamp[1], clamp((h - uRampAt.x) / (uRampAt.y - uRampAt.x), 0.0, 1.0));
  c = mix(c, uRamp[2], clamp((h - uRampAt.y) / (uRampAt.z - uRampAt.y), 0.0, 1.0));
  c = mix(c, uRamp[3], clamp((h - uRampAt.z) / (uRampAt.w - uRampAt.z), 0.0, 1.0));
  return c;
}

float density(vec3 p) {
  vec3 uvw = (p - uLo) / uSize;
  if (any(lessThan(uvw, vec3(0.0))) || any(greaterThan(uvw, vec3(1.0)))) return 0.0;
  float a = texture(uVolA, uvw).r;
  float b = texture(uVolB, uvw).r;
  float v = mix(a, b, uVolMix);
  return v * v * uSigmaMax;   // sqrt encoding
}

// Transmittance from p toward a light, through the sand (in the ball's object space so shadows turn with it).
float transmittance(vec3 p, vec3 lightPos, float dist, float jitter, float k) {
  vec3 dir = normalize(lightPos - p);
  float ds = dist / float(uSteps);
  float tau = 0.0;
  for (int i = 0; i < 32; i++) {
    if (i >= uSteps) break;
    vec3 q = p + dir * ds * (float(i) + 0.5 + jitter * 0.5);
    tau += density(q) * ds;
  }
  return exp(-tau * k);
}

float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }

void main() {
  vec3 A = uChaosLo + vec3(float(aPos.x & 2047u) / 2047.0, float((aPos.x >> 11) & 1023u) / 1023.0,
                           float(aPos.x >> 21) / 2047.0) * uChaosSize;
  vec2 oc = vec2(float(aPos.y & 4095u), float((aPos.y >> 12) & 4095u)) / 4095.0 * 2.0 - 1.0;
  vec3 dir = vec3(oc, 1.0 - abs(oc.x) - abs(oc.y));
  float fold = max(-dir.z, 0.0);
  dir.xy -= sign(dir.xy) * fold;
  vec3 B = uBallC + normalize(dir) * (float(aPos.y >> 24) / 255.0 * uBallPosMax);
  vec3 aPosA = (A - uLo) / uSize;    // normalised, as seeds for the per-grain randomness
  vec3 aPosB = (B - uLo) / uSize;
  // the chaos turns around itself; the ball spins
  A = uChaosC + uChaosRot * (A - uChaosC);
  vec3 Bw = uBallC + uBallRot * (B - uBallC);
  float t = clamp((uCompact - aAttr.w * uDelaySpan) / uRampLen, 0.0, 1.0);
  t = t * t * (3.0 - 2.0 * t);
  vec3 p = mix(A, Bw, t);
  // ambient flow: slow, small; calmer once compacted
  float amp = uDrift * mix(1.0, 0.35, t);
  vec3 q = p * uDriftFreq + vec3(0.0, 0.0, uTime * uDriftSpeed);
  p += amp * vec3(snoise(q), snoise(q + vec3(31.4, 0.0, 0.0)), snoise(q + vec3(0.0, 47.2, 0.0)));

  // shadows: march in the volumes' own (unturned) frame, so shadows turn with the chaos and with the ball
  mat3 chaosInv = transpose(uChaosRot);
  mat3 ballInv = transpose(uBallRot);
  vec3 pv = mix(uChaosC + chaosInv * (p - uChaosC), uBallVolC + ballInv * (p - uBallC) * uBallVolS, t);
  float j = hash(aPosA);
  vec3 E[3];
  for (int i = 0; i < 3; i++) {
    vec3 lp = mix(uChaosC + chaosInv * (uLightPos[i] - uChaosC), uBallVolC + ballInv * (uLightPos[i] - uBallC) * uBallVolS, t);
    float d = distance(p, uLightPos[i]);
    float T = transmittance(pv, lp, min(d * mix(1.0, uBallVolS, t), mix(8.5, 3.0, t)), j, mix(uShadowK.x, uShadowK.y, t));
    E[i] = uLightCol[i] * T / (d * d + uLightR2[i]);
  }
  E[0] *= smoothstep(uSpotCos.x, uSpotCos.y, dot(normalize(p - uLightPos[0]), uSpotDir));
  // how much sand stands between this grain and the viewer: the cursor can only reach the front layer
  vec3 cv = mix(uChaosC + chaosInv * (cameraPosition - uChaosC), uBallVolC + ballInv * (cameraPosition - uBallC) * uBallVolS, t);
  float toCam = transmittance(pv, cv, mix(8.5, 3.0, t), j, uFront.x);
  float frontness = uFront.x > 0.0 ? smoothstep(uFront.y, 1.0, toCam) : 1.0;
  // grain-scale occlusion on the ball: the deeper below the surface, the darker (too fine for the volume)
  float depth = clamp((uBallR - distance(B, uBallC)) / (uBallR * uCavity.x), 0.0, 1.0);
  float cavity = mix(1.0, 1.0 - uCavity.y * depth, t);
  vGround = t * (1.0 - depth);
  // local density: grains inside dense filaments are shaded by their neighbours, and catch more bounce light
  float rho = density(pv);
  float occl = mix(exp(-rho * uLocal.x), 1.0, t);
  vBounceW = 1.0 - exp(-rho * uLocal.y);
  vE0 = E[0] * cavity * occl; vE1 = E[1] * cavity * occl; vE2 = E[2] * cavity * occl;
  // a little bounce light inside the sand, from how open the grain is to the key
  vAmbient = 0.0;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vL0 = normalize((viewMatrix * vec4(uLightPos[0], 1.0)).xyz - mv.xyz);
  vL1 = normalize((viewMatrix * vec4(uLightPos[1], 1.0)).xyz - mv.xyz);
  vL2 = normalize((viewMatrix * vec4(uLightPos[2], 1.0)).xyz - mv.xyz);
  vL3 = normalize((viewMatrix * vec4(uCursorPos, 1.0)).xyz - mv.xyz);
  float dc = distance(p, uCursorPos) / uCursorReach;
  vE3 = uCursorCol / (1.0 + dc * dc * dc * dc) * cavity;
  vAlbedo = ramp(mix(aAttr.x, aAttr.y, t));

  gl_Position = projectionMatrix * mv;
  // the cursor's drift: a push in screen space from the paint field, which decays on its own
  vec2 suv = gl_Position.xy / gl_Position.w * 0.5 + 0.5;
  vec2 push = texture(uPaint, suv).xy * uPaintScale * frontness;
  gl_Position.xy += push / (uViewport * 0.5) * gl_Position.w;
  float packed = floor(aAttr.z * 255.0 + 0.5);
  float rad = mix(floor(packed / 16.0), mod(packed, 16.0), t) / 15.0;
  if (hash(aPosA + 9.1) > uChaosShare) rad *= smoothstep(0.05, 0.45, t);
  // the grain's shape: a randomly squashed, randomly turned pebble
  float h1 = hash(aPosB + 1.7), h2 = hash(aPosB + 3.1), h3 = hash(aPosB + 5.3);
  vec2 squash = 1.0 + 0.22 * (vec2(h1, h2) * 2.0 - 1.0);
  float ang = h3 * 6.2831853;
  vEll = vec4(squash, cos(ang), sin(ang));
  float px = 2.0 * rad * uRadMax * mix(uRadScale.x, uRadScale.y * uBallGrain, t) * uCountScale * uPointScale / -mv.z * max(squash.x, squash.y);   // device pixels
  // below a minimum the grain keeps its area through coverage, so it never shimmers
  vAlpha = clamp((px * px) / (uMinPx * uMinPx), 0.0, 1.0);
  gl_PointSize = max(px, uMinPx);
  vPx = gl_PointSize;
  vEdgePx = mix(uEdge.x, uEdge.y, t);
}
`;

export const SAND_FRAGMENT = /* glsl */ `
precision highp float;
out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor

in vec3 vAlbedo;
in vec3 vL0; in vec3 vL1; in vec3 vL2; in vec3 vL3;
in vec3 vE0; in vec3 vE1; in vec3 vE2; in vec3 vE3;
in float vAlpha;
in float vAmbient;
in vec4 vEll;
in float vGround;
in float vBounceW;
in float vPx;
in float vEdgePx;

uniform float uExposure;
uniform float uOutScale;   // 1 on screen; 1/4 into the filtered sand layer (see sand-composite.ts)
uniform float uSpec;
uniform float uWrap;     // light reaching past the terminator: grains are lit by the bounce off their neighbours
uniform float uBounce;   // light that has hit two grains (Cycles' multiple scattering): saturates toward the sand's colour
uniform vec3 uGroundCol;   // the lamp-lit desk below, as a broad light from beneath (colour x strength)
uniform vec3 uUpView;      // world up, in view space
uniform float uLampSat;  // the desk lamp: light that reaches a grain through the sand is filtered by it (warmer, deeper)

void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  c.y = -c.y;
  // into the grain's own frame: turn, then unsquash (the point box fits the longer axis)
  float smax = max(vEll.x, vEll.y);
  vec2 g = mat2(vEll.z, -vEll.w, vEll.w, vEll.z) * c * smax / vEll.xy;
  float r2 = dot(g, g);
  if (r2 > 1.0) discard;
  float edge = vEdgePx > 0.0 ? clamp((1.0 - sqrt(r2)) * vPx * 0.5 / vEdgePx, 0.0, 1.0) : 1.0;
  vec2 ng = g / vEll.xy;
  vec3 n = normalize(vec3(mat2(vEll.z, vEll.w, -vEll.w, vEll.z) * ng, sqrt(1.0 - r2)));
  // matte: lambert, plus a faint broad sheen (roughness 0.62, specular 0.3 in the Cycles material)
  vec3 v = vec3(0.0, 0.0, 1.0);
  vec3 L[4] = vec3[4](vL0, vL1, vL2, vL3);
  vec3 E[4] = vec3[4](vE0, vE1, vE2, vE3);
  vec3 col = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    float ndl = max((dot(n, L[i]) + uWrap) / (1.0 + uWrap), 0.0);
    vec3 h = normalize(L[i] + v);
    float spec = pow(max(dot(n, h), 0.0), 12.0) * uSpec;
    vec3 alb = i == 0 ? mix(vAlbedo, vAlbedo * vAlbedo * 2.2, uLampSat) : vAlbedo;
    col += E[i] * (alb * ndl / 3.14159265 + spec * ndl + vAlbedo * vAlbedo * uBounce * vBounceW);
  }
  // the desk below: grains facing down see a broad warm surface (no single ray, so the ball doesn't block it)
  float down = clamp(0.5 - 0.5 * dot(n, uUpView), 0.0, 1.0);
  col += vAlbedo * uGroundCol * down * down * vGround;
  col *= uExposure * uOutScale;
  gl_FragColor = vec4(col, vAlpha * edge);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

