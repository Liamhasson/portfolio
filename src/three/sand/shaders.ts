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

/**
 * 2.2, the attempts (the approved Blender logic, lookdev.py _attempt_on_dense): a patch facing uAttUp, its edge bent by
 * noise, plus break-up noise when an attempt fails. Fixed in world space, so the grains flow through it as the ball
 * turns. rank ~ the share of the surface below this point (d.up is uniform on a sphere).
 */
/**
 * The attempts and the build, on the ball itself: every direction here is in the ball's own frame (it turns with the
 * ball's spin, the scroll's turn and the roll), so the patches, the frost and the clearing ride the ball.
 * uAttUp: where the current attempt was born (the side that faced the viewer then), in the ball's frame.
 */
export const ATTEMPT_FIELD = /* glsl */ `
uniform vec3 uAttUp;
uniform float uAttLo;        // 1 = no attempt; lower = a bigger patch
uniform float uAttBreak;     // 0..1: the patch fractures into islands
uniform float uAttDepth;     // 0..1: how clear its centre gets
uniform float uAttFull;      // 2.3 build: 0..1, the held attempt's clearing sweeps on over the whole ball
uniform float uMelt;         // 2.3 build: 0..1, the frost clears into glass, a soft wave
uniform vec3 uMeltUp;        // where the wave starts (the side that faced the viewer when the build began), ball frame
float attField(vec3 d) {
  float f = dot(d, uAttUp) + 0.22 * (0.5 * snoise(d * 1.7 + vec3(3.0, 0.0, 5.0)));
  f += uAttBreak * 0.55 * (0.5 * snoise(d * 4.2 + vec3(11.0, 2.0, 7.0)));
  return f;
}
float attBand(vec3 d) {
  float rank = clamp(attField(d) * 0.5 + 0.5, 0.0, 1.0);
  float band = clamp((rank - uAttLo) / max(1.01 - uAttLo, 1e-3), 0.0, 1.0);
  // the build: a front leaves the patch and runs down to the far side, everything behind it fully clear
  float front = mix(uAttLo + 0.05, -0.35, uAttFull);
  return uAttFull > 0.0 ? max(band, smoothstep(front, front + 0.3, rank)) : band;
}
// how far a point of the frost has cleared into glass (0 frost .. 1 glass): a wave that leaves the attempt's centre and
// runs over the ball, its front uneven (two scales of noise) and soft (no edge, no holes)
float meltAt(vec3 d) {
  if (uMelt <= 0.0) return 0.0;
  if (uMelt >= 1.0) return 1.0;
  float far = 0.5 - 0.5 * dot(d, uMeltUp);                   // 0 where it starts .. 1 opposite
  // a gradient broken up by noise in three octaves (the front's outline organic at every scale), then pushed toward
  // black and white so the two materials meet at a defined front, a narrow soft edge, not a fog
  float n = far * 0.75 + 0.15 * snoise(d * 1.6 + vec3(1.7, 4.1, 2.9)) + 0.07 * snoise(d * 3.7 + vec3(5.0))
          + 0.035 * snoise(d * 8.5 + vec3(9.0, 1.0, 3.0));
  // it starts facing the viewer: the visible side gets most of the scroll, the hidden back clears quickly at the end
  float front = -0.27 + 1.4 * pow(uMelt, 1.8);
  return smoothstep(n - 0.05, n + 0.05, front);
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
uniform vec2 uGround;        // the desk's top (y) and how far above it its bounce reaches (e-folding height)
uniform float uDelaySpan;
uniform float uRampLen;
uniform vec3 uBallC;
uniform float uDrain;        // 2.3 build: 0..1, the cleared grains drain into the skin (gone at 1)
uniform float uSinkClear;    // 2.2: how far the clearest grains of an attempt have drained into its frost
uniform vec3 uBallVolC;      // the ball the density volume was baked for (the hero's): retargeted balls map into it
uniform float uBallVolS;     // volume units per world unit (hero radius / this ball's radius)
uniform float uBallGrain;    // grain size scale for a retargeted ball (its radius / the hero's)
uniform mat3 uBallRot;       // the ball's spin (object -> world)
uniform vec3 uChaosC;
uniform mat3 uChaosRot;      // the chaos moving around itself
uniform float uTime;
uniform float uHover;        // the cursor over the formed ball: how much (0..1)
uniform vec4 uBurst;         // 2.2's attempts: how far it breaks (0..1), the ball's volume (+-), its shape (0 patch,
                             // 1 seam, 2 ring), its seed
uniform vec3 uBurstDir;      // where on the ball (its own frame)
uniform vec4 uCloud;         // 2.3's cloud: how far parted (0..1), the move's frame, radial and axial spread
uniform vec3 uCloudAxis;     // the line it parts around (world)
uniform vec4 uCloudLife;     // each grain gone between these frames (x..y), over z frames; w: the clear way's width
uniform vec3 uCloudNear;     // grains this near the lens (x .. x + y) are gone first
uniform vec3 uHoverDir;      // and where: the direction from the ball's centre to the point under it (world)
uniform vec2 uHoverShape;    // the patch's edge (cosine of its angle) and how far a grain lifts (ball radii)
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
uniform float uBufH;         // device px of the drawing buffer's height
uniform float uShutter;      // motion blur: seconds
// the flow between chaos and ball (Ducky 3D's particle flow: a 4D noise, no detail, low scale, distortion, its colour
// into the offset): the grains travel along curved, shared paths instead of straight lines, so the cloud folds into
// sheets and tendrils on its way; strongest halfway, nothing at either end (the approved chaos and ball stay as they are)
uniform vec4 uFlow;          // amplitude (world units), frequency, warp (Blender's distortion), speed
// the grain's own motion for its blur: everything that places it, as it was the frame before
uniform float uCompactPrev;
uniform float uTimePrev;
uniform mat3 uBallRotPrev;
uniform mat3 uChaosRotPrev;
uniform vec3 uBallCPrev;
uniform float uBallPosMaxPrev;
uniform float uFrameDt;      // seconds between those two frames
uniform vec2 uMotionBlur;    // strength (0 = off), longest streak in grain lengths

out vec3 vAlbedo;
out vec3 vL0; out vec3 vL1; out vec3 vL2; out vec3 vL3;   // light directions, view space (3 = cursor)
out vec3 vE0; out vec3 vE1; out vec3 vE2; out vec3 vE3;
out float vAlpha;
out float vAmbient;
out vec3 vFillE;      // the lights' irradiance here before any sand shadows it (the light the grains pass between them)
out float vCompact;
out float vBounceW;
out float vPx;
out float vEdgePx;
out float vClear;    // 2.2: how far this grain has turned toward glass
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
${ATTEMPT_FIELD}

// The flow's push on a grain at p, t of the way from chaos to ball: one smooth noise field shared by all the grains
// (neighbours move together: sheets, not static), its domain warped as Blender's distortion warps it
vec3 flowOffset(vec3 p, float t, float time) {
  float k = 4.0 * t * (1.0 - t);
  if (uFlow.x <= 0.0 || k <= 0.0) return vec3(0.0);
  vec3 q = p * uFlow.y + vec3(0.0, time * uFlow.w, 0.0);
  q += uFlow.z * snoise(q * 0.6 + vec3(17.1, 0.0, 0.0)) * vec3(0.8, -0.6, 0.7);
  return uFlow.x * k * k * vec3(snoise(q), snoise(q + vec3(31.4, 0.0, 0.0)), snoise(q + vec3(0.0, 47.2, 0.0)));
}

// A grain's straight path from its chaos spot A0 to its place in the ball Bo (both unturned), at a compaction, with
// the ball's centre, its turn and the chaos's. t: its own progress along it
vec3 pathAt(vec3 A0, vec3 Bo, float compact, vec3 ballC, mat3 ballRot, mat3 chaosRot, out float t) {
  vec3 A = uChaosC + chaosRot * (A0 - uChaosC);
  vec3 Bw = ballC + ballRot * Bo;
  t = clamp((compact - aAttr.w * uDelaySpan) / uRampLen, 0.0, 1.0);
  t = t * t * (3.0 - 2.0 * t);
  return mix(A, Bw, t);
}

void main() {
  vec3 A = uChaosLo + vec3(float(aPos.x & 2047u) / 2047.0, float((aPos.x >> 11) & 1023u) / 1023.0,
                           float(aPos.x >> 21) / 2047.0) * uChaosSize;
  vec2 oc = vec2(float(aPos.y & 4095u), float((aPos.y >> 12) & 4095u)) / 4095.0 * 2.0 - 1.0;
  vec3 dir = vec3(oc, 1.0 - abs(oc.x) - abs(oc.y));
  float fold = max(-dir.z, 0.0);
  dir.xy -= sign(dir.xy) * fold;
  float bDist = float(aPos.y >> 24) / 255.0;
  vec3 B = uBallC + normalize(dir) * (bDist * uBallPosMax);
  vec3 aPosA = (A - uLo) / uSize;    // normalised, as seeds for the per-grain randomness
  vec3 aPosB = (B - uLo) / uSize;
  // the chaos turns around itself; the ball spins; between them, the flow
  float t;
  vec3 p = pathAt(A, B - uBallC, uCompact, uBallC, uBallRot, uChaosRot, t);
  // ambient flow: slow, small; calmer once compacted
  float amp = uDrift * mix(1.0, 0.35, t);
  vec3 q = p * uDriftFreq + vec3(0.0, 0.0, uTime * uDriftSpeed);
  vec3 drift = amp * vec3(snoise(q), snoise(q + vec3(31.4, 0.0, 0.0)), snoise(q + vec3(0.0, 47.2, 0.0)));
  p += drift;
  // the flow (the shadows are baked for the straight path: they look up where the grain would be without it)
  vec3 flow = flowOffset(p, t, uTime);
  p += flow;
  // the same grain a frame ago, for its blur (only on a frame where something moved it: uMotionBlur.x is 0 otherwise);
  // the slow ambient drift barely moves in a frame, so it rides along as it is now
  vec3 pMoved = p, pPrev = p;
  if (uMotionBlur.x > 0.0) {
    float tPrev;
    pPrev = pathAt(A, normalize(dir) * (bDist * uBallPosMaxPrev), uCompactPrev, uBallCPrev, uBallRotPrev, uChaosRotPrev,
                   tPrev) + drift;
    pPrev += flowOffset(pPrev, tPrev, uTimePrev);
  }
  // 2.2's attempts (Liam, 2026-10-10, sand only): the ball breaks form a little, as if going back to chaos, in a small
  // burst, each attempt a different shape (a patch, a seam, a ring); the ball draws in a touch before and swells a
  // touch as it breaks, then settles. Its own grains, on its own frame (the bursts turn with the ball)
  if (t > 0.5 && (uBurst.x > 0.001 || abs(uBurst.y) > 0.0001)) {
    vec3 rel = p - uBallC;
    float rl = length(rel);
    vec3 nd = rel / max(rl, 1e-5);
    vec3 dObj = transpose(uBallRot) * nd;
    float c = dot(dObj, uBurstDir);
    float mask;
    if (uBurst.z < 0.5) mask = smoothstep(0.72, 0.9, c);                                   // a patch
    else if (uBurst.z < 1.5) {                                                              // a seam: a crack across it
      vec3 ax = normalize(cross(uBurstDir, vec3(0.31, 0.89, 0.33)));
      mask = (1.0 - smoothstep(0.03, 0.14, abs(dot(dObj, ax)))) * smoothstep(0.1, 0.5, c);
    } else mask = smoothstep(0.62, 0.72, c) * (1.0 - smoothstep(0.82, 0.92, c));          // a ring
    float shell = smoothstep(0.5, 0.9, rl / uBallR);
    float hk = hash(aPosA + 21.7 + uBurst.w);
    float loose = mask * shell * step(hk, 0.55) * uBurst.x;
    // out, and scattered as the chaos is (a little turbulence, each grain its own way)
    vec3 qn = rel / uBallR * 2.7 + vec3(uBurst.w * 3.1);
    vec3 scatter = vec3(snoise(qn), snoise(qn + vec3(19.1, 0.0, 0.0)), snoise(qn + vec3(0.0, 33.7, 0.0)));
    vec3 brk = (nd * (0.12 + 0.45 * hash(aPosB + 8.8 + uBurst.w)) + scatter * 0.22) * uBallR * loose;
    vec3 vol = rel * uBurst.y * smoothstep(0.5, 0.9, t);
    p += brk + vol; pMoved += brk + vol; pPrev += brk + vol;
  }
  // 2.3 in sand only: the ball parts around the camera's line of travel like a tunnel opening (out from that line, a
  // little along it, each grain at its own pace) and thins away, grain by grain, as the camera flies through
  float cloudLife = 1.0;
  if (t > 0.5 && uCloud.y > 0.0) {
    vec3 rel = p - uBallC;
    float pace = 0.6 + 0.8 * hash(aPosA + 31.3);
    float al = dot(rel, uCloudAxis);
    vec3 rad3 = rel - uCloudAxis * al;
    float rlen = length(rad3);
    vec3 rdir = rlen > 1e-6 ? rad3 / rlen : vec3(0.0);
    float k = uCloud.x * pace;
    vec3 np = uBallC + rdir * (rlen * (1.0 + uCloud.z * k) + uCloudLife.w * k) + uCloudAxis * al * (1.0 + uCloud.w * k);
    vec3 dc = np - p;
    p += dc; pMoved += dc; pPrev += dc;
    float td = uCloudLife.x + (uCloudLife.y - uCloudLife.x) * hash(aPosB + 41.9);
    float lf = 1.0 - clamp((uCloud.y - td) / uCloudLife.z, 0.0, 1.0);
    cloudLife = lf * lf * (3.0 - 2.0 * lf);
    cloudLife *= clamp((distance(p, cameraPosition) - uCloudNear.x) / uCloudNear.y, 0.0, 1.0);
  }
  // the cursor over the formed ball (Liam, 2026-10-10): the ball's own grains lift out of it there and settle back,
  // each at its own moment and height, so the patch thins while they're out; never streaked (the lift is in the
  // previous frame's place too)
  if (uHover > 0.001 && t > 0.5) {
    vec3 rel = p - uBallC;
    float rl = length(rel);
    vec3 nd = rel / max(rl, 1e-5);
    float capW = smoothstep(uHoverShape.x, mix(uHoverShape.x, 1.0, 0.6), dot(nd, uHoverDir));
    float shell = smoothstep(0.6, 0.92, rl / uBallR);       // the surface's grains leave; the core holds the shape
    float hk = hash(aPosA + 11.3);
    float leaves = step(hk, 0.12);                           // about one in eight of them (Liam: much less)
    float cyc = fract(uTime * (0.35 + 0.3 * hash(aPosB + 2.9)) + hash(aPosB + 6.1));
    float arc = sin(3.14159265 * cyc);
    // out of the surface and away from the point under the cursor (along the surface): on the face toward the viewer a
    // lift straight out would only come at the lens, so they spray outward and the spot opens
    vec3 away = nd - uHoverDir * dot(nd, uHoverDir);
    away = dot(away, away) > 1e-6 ? normalize(away) : vec3(0.0);
    vec3 lift = (nd * 0.55 + away * 0.9 + vec3(0.0, 0.15, 0.0)) * arc * arc * (0.2 + 0.8 * hash(aPosA + 4.4)) * uHoverShape.y * uBallR
      * capW * shell * leaves * uHover * smoothstep(0.5, 0.9, t);
    p += lift; pMoved += lift; pPrev += lift;
  }
  // 2.2: inside an attempt the grains pack onto the surface (closing the gaps), then drain toward glass
  vClear = 0.0;
  float attGrow = 1.0;
  if (uAttLo < 0.999 && t > 0.5) {
    vec3 rel = p - uBallC;
    float rn = length(rel) / uBallR;
    vec3 dir = rel / max(length(rel), 1e-5);
    vec3 dObj = transpose(uBallRot) * dir;                   // the ball's own frame: the field turns with the ball
    float band = attBand(dObj);
    float clear = pow(band, 1.4) * uAttDepth;
    float pull = clamp(band * 2.5, 0.0, 1.0); pull = pull * pull * (3.0 - 2.0 * pull);
    float rr = rn + (0.997 + 0.03 * hash(aPosB + 7.7) - 0.03 * clear - rn) * pull;
    p = uBallC + dir * rr * uBallR;
    vClear = clear;
    attGrow = 1.0 + 0.7 * clear;
    // the build: the grains sink into the frost one by one (each at its own moment) just ahead of the clearing wave,
    // so a point is frost when it clears; uDrain carries them under where the wave hasn't reached yet
    // (and inside an attempt, the clearest grains have already drained into the frost: Blender's attempts clip)
    float sink = max(max(meltAt(dObj) * 1.6, uDrain), smoothstep(0.45, 1.0, clear) * uSinkClear * (1.0 - uAttFull));   // 2.2 only
    if (sink > 0.0) {
      float when = 0.1 + 0.6 * hash(aPosB + 3.1);
      attGrow *= 1.0 - smoothstep(when - 0.2, when, sink);
    }
  }

  // shadows: march in the volumes' own (unturned) frame, so shadows turn with the chaos and with the ball
  mat3 chaosInv = transpose(uChaosRot);
  mat3 ballInv = transpose(uBallRot);
  vec3 ps = p - flow;   // the shadows were baked for the straight path: shaded as it would be there
  vec3 pv = mix(uChaosC + chaosInv * (ps - uChaosC), uBallVolC + ballInv * (ps - uBallC) * uBallVolS, t);
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
  // the lamp-lit desk lights the sand from below: the formed ball's open surface, and the loose sand the nearer it is
  // to the desk (Liam: the cloud's underside must never fall into black)
  vGround = mix(exp(-max(p.y - uGround.x, 0.0) / uGround.y), 1.0 - depth, t);
  // local density: grains inside dense filaments are shaded by their neighbours, and catch more bounce light
  float rho = density(pv);
  float occl = mix(exp(-rho * uLocal.x), 1.0, t);
  vBounceW = 1.0 - exp(-rho * uLocal.y);
  vE0 = E[0] * cavity * occl; vE1 = E[1] * cavity * occl; vE2 = E[2] * cavity * occl;
  // the light the grains hand each other: what the lights would give here unshadowed (Liam, 2026-10-10: the deeper,
  // shadowed grains showed black in every gap, drawing a dark stroke round each grain)
  vFillE = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    float d = distance(p, uLightPos[i]);
    vec3 e = uLightCol[i] / (d * d + uLightR2[i]);
    if (i == 0) e *= smoothstep(uSpotCos.x, uSpotCos.y, dot(normalize(p - uLightPos[0]), uSpotDir));
    vFillE += e;
  }
  // a little bounce light inside the sand, from how open the grain is to the key
  // the soft fill (from the viewer's side): shadowed by the sand in front, as the cursor's reach is
  vAmbient = toCam;
  vCompact = t;

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
  vec2 pvel = texture(uPaint, suv).xy * frontness;           // CSS px / s
  vec2 push = pvel * uPaintScale;
  gl_Position.xy += push / (uViewport * 0.5) * gl_Position.w;
  // the cursor only moves the grains, never stretches them (Liam, 2026-10-10: its streak smudged the sand)
  vec2 blur = vec2(0.0);
  float packed = floor(aAttr.z * 255.0 + 0.5);
  float rad = mix(floor(packed / 16.0), mod(packed, 16.0), t) / 15.0;
  if (hash(aPosA + 9.1) > uChaosShare) rad *= smoothstep(0.05, 0.45, t);
  // the grain's shape: a randomly squashed, randomly turned pebble
  float h1 = hash(aPosB + 1.7), h2 = hash(aPosB + 3.1), h3 = hash(aPosB + 5.3);
  vec2 squash = 1.0 + 0.22 * (vec2(h1, h2) * 2.0 - 1.0);
  float ang = h3 * 6.2831853;
  rad *= cloudLife;
  float px = 2.0 * rad * uRadMax * mix(uRadScale.x, uRadScale.y * uBallGrain, t) * uCountScale * attGrow * uPointScale / -mv.z * max(squash.x, squash.y);   // device pixels
  // and its own motion (the flow, the ball forming, the spin): its travel on screen since the frame before, over the
  // shutter, never longer than a few grains (a jump in the page is not a motion)
  if (uMotionBlur.x > 0.0 && px > 0.0) {
    vec4 c0 = projectionMatrix * modelViewMatrix * vec4(pMoved, 1.0);
    vec4 c1 = projectionMatrix * modelViewMatrix * vec4(pPrev, 1.0);
    if (c0.w > 0.0 && c1.w > 0.0) {
      vec2 bufPx = vec2(uViewport.x * uBufH / uViewport.y, uBufH);
      vec2 own = (c0.xy / c0.w - c1.xy / c1.w) * 0.5 * bufPx * (uShutter / uFrameDt) * uMotionBlur.x;
      float ol = length(own), cap = px * uMotionBlur.y;
      if (ol > cap) own *= cap / ol;
      blur += own;
    }
  }
  // a moving grain is drawn stretched along its motion by its travel in the shutter (a streak, still solid)
  float bl = length(blur);
  if (bl > 0.5 && px > 0.0) {
    float k = 1.0 + bl / px;
    squash = vec2(max(squash.x, squash.y) * k, min(squash.x, squash.y));
    ang = atan(blur.y, blur.x);
    px *= k;
  }
  vEll = vec4(squash, cos(ang), sin(ang));
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
in vec3 vFillE;
in float vCompact;
in vec4 vEll;
in float vGround;
in float vClear;
in float vBounceW;
in float vPx;
in float vEdgePx;

uniform float uExposure;
uniform float uOutScale;   // 1 on screen; 1/4 into the filtered sand layer (see sand-composite.ts)
uniform float uSpec;
uniform float uWrap;     // light reaching past the terminator: grains are lit by the bounce off their neighbours
uniform float uGapFill;  // how much of it reaches the grains in the gaps (inter-reflection)
uniform float uRough;    // Oren-Nayar roughness (radians): a rough grain's edge stays as bright as its middle (Liam,
                         // 2026-10-10: smooth-sphere shading drew a dark rim round every grain)
uniform float uBounce;   // light that has hit two grains (Cycles' multiple scattering): saturates toward the sand's colour
uniform vec3 uGroundCol;   // the lamp-lit desk below, as a broad light from beneath (colour x strength)
uniform vec3 uFillCol;     // a soft fill from the viewer's side (colour x strength)
uniform vec3 uUpView;      // world up, in view space
uniform float uLampSat;
uniform vec3 uClearAlb;    // 2.2: the colour clearing grains drain to (pale frost)  // the desk lamp: light that reaches a grain through the sand is filtered by it (warmer, deeper)

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
  // 2.2: clearing grains drain toward the frost's pale colour (no heat, no glow); they stay solid and the pixel
  // filter blends them into the skin, as in the render
  vec3 albedo = mix(vAlbedo, uClearAlb, vClear);
  vec3 L[4] = vec3[4](vL0, vL1, vL2, vL3);
  vec3 E[4] = vec3[4](vE0, vE1, vE2, vE3);
  vec3 col = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    float ndl = max((dot(n, L[i]) + uWrap) / (1.0 + uWrap), 0.0);
    // Oren-Nayar: the rough surface's retro-reflection lifts the grain's limb where lambert alone darkens it
    float nl = max(dot(n, L[i]), 0.0), nv = max(n.z, 1e-3);
    float s2 = uRough * uRough;
    float onA = 1.0 - 0.5 * s2 / (s2 + 0.33), onB = 0.45 * s2 / (s2 + 0.09);
    vec3 lp = L[i] - n * dot(n, L[i]), vp = v - n * nv;
    float cphi = max(dot(lp, vp) / max(length(lp) * length(vp), 1e-4), 0.0);
    float ai = acos(clamp(nl, 0.0, 1.0)), ar = acos(clamp(nv, 0.0, 1.0));
    float on = onA + onB * cphi * sin(max(ai, ar)) * tan(min(min(ai, ar), 1.4));
    ndl *= mix(1.0, on, step(0.001, uRough));
    vec3 h = normalize(L[i] + v);
    float spec = pow(max(dot(n, h), 0.0), 12.0) * uSpec;
    vec3 alb = i == 0 ? mix(albedo, albedo * albedo * 2.2, uLampSat) : albedo;
    col += E[i] * (alb * ndl / 3.14159265 + spec * ndl + albedo * albedo * uBounce * vBounceW);
  }
  // the desk below: grains facing down see a broad warm surface (no single ray, so the ball doesn't block it)
  float down = clamp(0.5 - 0.5 * dot(n, uUpView), 0.0, 1.0);
  // (the loose sand's grains turn every way: a broad wrap; the ball's surface faces out: Blender's falloff)
  col += albedo * uGroundCol * mix(0.4 + 0.6 * down, down * down, vCompact) * vGround;
  col += albedo * uFillCol * (0.35 + 0.65 * max(n.z, 0.0)) * vAmbient;
  col += albedo * albedo * vFillE * uGapFill / 3.14159265;
  // 2.2: clearing grains drain toward pale glass (no heat, no glow) and turn see-through, showing the frost skin
  col *= uExposure * uOutScale;
  gl_FragColor = vec4(col, vAlpha * edge);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

