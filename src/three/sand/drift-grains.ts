import * as THREE from "three";
import { SAND_FRAGMENT } from "./shaders";

/**
 * Grains leaving the sand: the atmosphere around the main object, as real pebbles.
 *
 * One system with the cloud (Liam, 2026-10-11: the near-lens grains read as a separate layer; Lusion's loose particles
 * are the cloud's own): drawn as the sand's grains are, shaded by the sand's own fragment shader (its light, gloss,
 * subsurface, coverage, streaks), moved by the cursor's drift field as the sand's front grains are, in its layer (so the
 * lens and the shadows are the same). Simulated on the CPU (Oryzo's model): each drawn toward a slowly moving path,
 * damped. Each is born on the sand's surface, carried up and out in a slow swirl, shrinks away and is reborn. About half
 * leave in streams (one wandering emitter each, its grains let go one after another along one sinuous path: a tendril
 * that fans out into a plume as it goes; each stream its own size, pace, length and depth), held together as a flock
 * (separation + cohesion, from the C4D particles tutorial); the rest stay loose, a spray.
 *
 * In the sand's own shadows (the same density volumes it is shaded with). Solid, never see-through: a grain with no
 * light on it simply isn't there (it shrinks to nothing), so none shows as a
 * dark speck over the lit desk. Motion blur: each grain is stretched behind itself along its motion by how far it moves
 * in a shutter of 1/60 s (a flicked grain streaks, a drifting one stays sharp). Drawn in the sand's layer.
 */
const VERTEX = /* glsl */ `
precision highp float;
in vec3 iPos;              // per grain: position (world), velocity (world / s), size and hue
in vec3 iVel;
in vec2 iSizeHue;
in float iSeed;
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
void main() {
  // the sand's frame for its volumes, at the sand's compaction (as the sand's own grains are shaded)
  float t = smoothstep(0.0, 1.0, uCompact);
  mat3 chaosInv = transpose(uChaosRot), ballInv = transpose(uBallRot);
  vec3 pv = mix(uChaosC + chaosInv * (iPos - uChaosC), uBallVolC + ballInv * (iPos - uBallC) * uBallVolS, t);
  float shadowK = mix(uShadowK.x, uShadowK.y, t) * uGrainShadow;
  vec3 E[3];
  for (int i = 0; i < 3; i++) {
    vec3 Lv = uLightPos[i] - iPos;
    vec3 lp = mix(uChaosC + chaosInv * (uLightPos[i] - uChaosC), uBallVolC + ballInv * (uLightPos[i] - uBallC) * uBallVolS, t);
    float T = transmittance(pv, lp, min(length(Lv) * mix(1.0, uBallVolS, t), mix(8.5, 3.0, t)), shadowK);
    E[i] = uLightCol[i] * T / (dot(Lv, Lv) + uLightR2[i]);
  }
  E[0] *= smoothstep(uSpotCos.x, uSpotCos.y, dot(normalize(iPos - uLightPos[0]), uSpotDir));
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
  vec2 blur = pvel * uPaintScale * 6.0 * uShutter * 60.0 * (uBufH / uViewport.y);
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
}
`;

// Oryzo's simulation constants (theirs: a bean of radius 0.01, 60 fps), scaled to our grain size where they are lengths
const PATH_STIFFNESS = 120;         // per second squared, toward the path (Oryzo's pull, as it acts at 120 fps)
const VELOCITY_DAMPING_RATE = 3;    // per second: a pushed grain swings back once or twice, then settles (Liam: no long bounce)
/** How much of the sand's own motion (a scene change: the camera's move, the ball forming, rising) the grains ride
 *  outright; the spring only catches up the rest, so a transition shows as a barely visible, brief give. */
const CARRY = 0.94;
// Streams (Liam, 2026-10-10, from the C4D particles tutorial: an emitter's trail, held together by a flock): most grains
// leave the sand in streams. A stream's emitter wanders slowly over the sand's surface and lets a grain go every
// tenth of a second or so; they all follow the same sinuous path, so together they draw a tendril
const PER_STREAM = 270;          // 6 streams of the hero's 1600, each holding only some of its grains (its fill)
const LOOSE = 0.15;                 // the share that stays loose, alone (the spray around the streams)
// the flock (Sedov's C4D setup: separation + cohesion): grains in a stream don't overlap, and gather like a loose liquid
const SEPARATION = 150;             // per second squared, per unit of overlap (the path's own pull is 120)
const SEPARATION_R = 2.2;           // grain radii
const COHESION = 6;                 // per second squared, toward the neighbours' centre
const COHESION_R = 7;               // grain radii
const GRID = 4096;                  // the neighbour grid's hash table size

/** A stream's drawn path (blender/lookdev/stream_curves.py, public/lab/sand/streams.json): points about the cloud's centre
 *  in cloud radii, in the view's frame (x right, y up, z toward the viewer), evenly spaced along it. */
export interface StreamCurve {
  points: [number, number, number][];
  /** Its length, in cloud radii. */
  length: number;
  /** Grain radii across where it leaves the sand. */
  width: number;
  /** How much wider it grows per unit it travels. */
  fan: number;
  /** A grain's life along it, seconds. */
  pace: number;
}

export class DriftGrains {
  readonly mesh: THREE.Points;
  readonly material: THREE.ShaderMaterial;
  readonly max: number;
  /** The share of grains that leave in streams (the rest stay loose); 0 = all loose, as before the streams. */
  streams = 1 - LOOSE;
  /** The streams' drawn paths (one per stream, in turn); none: each stream finds its own way (its emitter wanders). */
  curves: StreamCurve[] | null = null;
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly seed: Float32Array;     // 4 randoms per grain
  private readonly gen: Float32Array;      // its current life's number (rebirth: a new place)
  private readonly home: Float32Array;     // where its path had it last frame
  private readonly sizes: Float32Array;
  private readonly aPos: THREE.BufferAttribute;
  private readonly aVel: THREE.BufferAttribute;
  private readonly aSize: THREE.BufferAttribute;
  private readonly flock: Float32Array;    // each grain's acceleration from its neighbours, this frame
  private readonly gridHead = new Int32Array(GRID);
  private readonly gridNext: Int32Array;
  private readonly lastCentre = new THREE.Vector3(NaN, NaN, NaN);
  private readonly side = new THREE.Vector3();
  private readonly back = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly alt = new THREE.Vector3(1, 0, 0);
  private readonly vFwd = new THREE.Vector3();
  private readonly vRight = new THREE.Vector3();
  private readonly vUp = new THREE.Vector3();

  /** `sand`: the sand's material (its palette and lights: shared). */
  constructor(sand: THREE.ShaderMaterial, max = 1600) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.seed = new Float32Array(max * 4);
    this.gen = new Float32Array(max).fill(-1);
    this.home = new Float32Array(max * 3);
    this.sizes = new Float32Array(max * 2);
    this.flock = new Float32Array(max * 3);
    this.gridNext = new Int32Array(max);
    for (let i = 0; i < max * 4; i++) this.seed[i] = Math.random();
    const grainSeed = new Float32Array(max);
    for (let i = 0; i < max; i++) { this.sizes[i * 2 + 1] = Math.random(); grainSeed[i] = Math.random(); }
    // each grain one point, drawn as the sand's are
    const geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aVel = new THREE.BufferAttribute(this.vel, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.sizes, 2).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("position", this.aPos);   // (three needs one; the shader reads iPos)
    geo.setAttribute("iPos", this.aPos);
    geo.setAttribute("iVel", this.aVel);
    geo.setAttribute("iSizeHue", this.aSize);
    geo.setAttribute("iSeed", new THREE.BufferAttribute(grainSeed, 1));
    const su = sand.uniforms;
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERTEX,
      fragmentShader: SAND_FRAGMENT,
      transparent: false,
      depthWrite: true,
      depthTest: true,
      alphaToCoverage: true,
      // the sand's own uniforms, shared: its palette, lights, material, cursor, drift field, grain look
      uniforms: {
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
        uShadowK: su.uShadowK, uCompact: su.uCompact, uChaosC: su.uChaosC, uChaosRot: su.uChaosRot, uBallC: su.uBallC,
        uBallVolC: su.uBallVolC, uBallVolS: su.uBallVolS, uBallRot: su.uBallRot, uGrainShadow: { value: 1 },
      },
    });
    this.mesh = new THREE.Points(geo, this.material);
    this.mesh.frustumCulled = false;
  }

  /**
   * Each frame. `time`/`dt` seconds; `centre`/`radius`: the sand they leave (its shell); `density` 0..1 of max alive;
   * `travel`: how far a grain goes in its life; `grainR`: grain radius; `cursor`: a point on the cursor's line of sight
   * (world) and `cursorDir` that line, or null; `cursorR`: its reach (a tube around that line: our grains spread in
   * depth, Oryzo's flow in a plane); `cursorCol`: its warm light; `camera`: for the grains that drift in front.
   */
  update(time: number, dt: number, centre: THREE.Vector3, radius: number, density: number, travel: number, grainR: number,
    cursor: THREE.Vector3 | null, cursorDir: THREE.Vector3, cursorR: number, cursorCol: THREE.Vector3, camera: THREE.Camera): void {
    // (the cursor moves and lights them as it does the sand: its drift field and its light, shared; no push of their own)
    void cursor; void cursorDir; void cursorR; void cursorCol;
    const count = Math.round(this.max * Math.min(Math.max(density, 0), 1));
    this.mesh.geometry.setDrawRange(0, count);
    this.mesh.visible = count > 0;
    if (!count) return;
    dt = Math.min(Math.max(dt, 1e-4), 1 / 20);
    // the sand leapt (a jump in the page, a reload mid-way): the grains re-form around it, they don't fly after it
    const leapt = !(this.lastCentre.distanceTo(centre) < radius * 0.25);
    this.lastCentre.copy(centre);
    if (leapt) this.gen.fill(-1);
    const damp = Math.exp(-dt * VELOCITY_DAMPING_RATE);
    const cam = camera.position;
    // the view's frame at the sand: toward the viewer, and the screen's right and up (the streams' emitters ring it)
    const vFwd = this.vFwd.subVectors(cam, centre).normalize();
    const vRight = this.vRight.crossVectors(Math.abs(vFwd.y) > 0.99 ? this.alt : this.up, vFwd).normalize();
    const vUp = this.vUp.crossVectors(vFwd, vRight);
    const camDist = Math.max(cam.distanceTo(centre), 1e-3);
    this.flockForces(count, grainR);
    for (let i = 0; i < count; i++) {
      const s0 = this.seed[i * 4], s1 = this.seed[i * 4 + 1], s2 = this.seed[i * 4 + 2], s3 = this.seed[i * 4 + 3];
      // a stream's own randoms (its grains share them)
      const k = Math.floor(i / PER_STREAM);
      const hk = (n: number) => { const x = Math.sin((k + 1) * 91.733 + n * 13.317) * 43758.5453; return x - Math.floor(x); };
      // each stream holds only part of its grains (Liam: less dense), the rest join the loose spray
      const fill = 0.45 + 0.3 * hk(10);
      const loose = s1 >= this.streams || s1 / this.streams >= fill;
      // and has its own pace (Liam: streams of different sizes, paces, lengths and depths)
      const curve = !loose && this.curves?.length ? this.curves[k % this.curves.length] : null;
      const L = loose ? 10 * (0.7 + 0.6 * s3) : curve ? curve.pace * (0.9 + 0.2 * hk(0)) : 10 * (0.55 + 0.9 * hk(0));
      // a stream's grains are let go one after another, evenly through its life (a little jitter: not a metronome)
      const cyc = loose ? time / L + s0 * 7 : time / L + hk(1) * 7 + ((i % PER_STREAM) + 0.4 * s0) / PER_STREAM;
      const life = cyc - Math.floor(cyc), gen = Math.floor(cyc);
      const h = (n: number) => { const x = Math.sin((gen + 1) * 12.9898 * (n + 1) + s0 * 78.233 + s1 * 37.719) * 43758.5453; return x - Math.floor(x); };
      let tx: number, ty: number, tz: number;
      if (loose) {
        // its path this life: born on the sand's shell (one in ten partway toward the camera: in front of the sand)
        const a = h(0) * Math.PI * 2, b = Math.acos(2 * h(1) - 1), rr = 0.85 + 0.25 * h(2);
        let px = centre.x + Math.sin(b) * Math.cos(a) * radius * rr;
        let py = centre.y + Math.cos(b) * radius * rr;
        let pz = centre.z + Math.sin(b) * Math.sin(a) * radius * rr;
        if (s2 < 0.1) {
          const f = 0.3 + 0.25 * h(3);
          px += (cam.x - centre.x) * f; py += (cam.y - centre.y) * f; pz += (cam.z - centre.z) * f;
        }
        // out and up in a slow swirl
        const go = life * travel;
        const dx = px - centre.x, dy = py - centre.y, dz = pz - centre.z, dl = Math.hypot(dx, dy, dz) || 1;
        ty = py + (dy / dl) * go * 0.45 + go * 0.75;
        tx = px + (dx / dl) * go * 0.45; tz = pz + (dz / dl) * go * 0.45;
        const sw = life * (s3 * 1.8 - 0.9), cs = Math.cos(sw), sn = Math.sin(sw);
        const rx = tx - centre.x, rz = tz - centre.z;
        tx = centre.x + rx * cs - rz * sn; tz = centre.z + rx * sn + rz * cs;
      } else if (curve) {
        // along its stream's drawn curve (the rocks tutorial's curve guide): each grain a little faster or slower than
        // its stream, so the stream loosens along its length; tight where it leaves the sand, then each grain drifts
        // off on its own heading, across the stream and in depth, so it fans out into a plume as it goes
        const pts = curve.points, last = pts.length - 1;
        const u = life * (0.85 + 0.3 * h(7));
        const f = Math.min(u, 1) * last, j = Math.min(Math.floor(f), last - 1), w = f - j;
        const a0 = pts[j], a1 = pts[j + 1];
        // its tangent (view frame), and past the curve's end it carries on along it
        let gx = a1[0] - a0[0], gy = a1[1] - a0[1], gz = a1[2] - a0[2];
        const gl = Math.hypot(gx, gy, gz) || 1; gx /= gl; gy /= gl; gz /= gl;
        const over = Math.max(u - 1, 0) * curve.length;
        const cx = a0[0] + (a1[0] - a0[0]) * w + gx * over;
        const cy = a0[1] + (a1[1] - a0[1]) * w + gy * over;
        const cz = a0[2] + (a1[2] - a0[2]) * w + gz * over;
        // across it: one direction in the screen's plane, one in depth (both perpendicular to its way)
        let nx = -gy, ny = gx;
        const nz = 0;
        const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
        const bx = gy * nz - gz * ny, by = gz * nx - gx * nz, bz = gx * ny - gy * nx;
        const travelled = u * curve.length;   // cloud radii
        const across = (curve.width * grainR / radius + curve.fan * travelled) * Math.sqrt(h(4)), ang = h(5) * Math.PI * 2;
        const ca = Math.cos(ang) * across, sa = Math.sin(ang) * across;
        // the stream breathes: its whole path sways a little, slowly, with time
        const sway = 0.04 * travelled * Math.sin(time * 0.25 + hk(7) * 6.28);
        const qx = cx + nx * (ca + sway) + bx * sa, qy = cy + ny * (ca + sway) + by * sa, qz = cz + nz * (ca + sway) + bz * sa;
        tx = centre.x + (vRight.x * qx + vUp.x * qy + vFwd.x * qz) * radius;
        ty = centre.y + (vRight.y * qx + vUp.y * qy + vFwd.y * qz) * radius;
        tz = centre.z + (vRight.z * qx + vUp.z * qy + vFwd.z * qz) * radius;
      } else {
        // born where its stream's emitter was when it left. The emitters sit on the sand's side facing the viewer, in
        // a ring around the view, each at its own depth (from the sand's surface to halfway to the lens), spread
        // evenly around it; each wanders slowly, so the grains after it leave from beside it and the stream bends
        const tb = time - life * L;
        const a = ((k + 0.5 + 0.4 * (hk(2) - 0.5)) / Math.ceil(this.max / PER_STREAM)) * Math.PI * 2
          + 0.6 * Math.sin(tb * 0.11 + hk(3) * 6.28) + 0.3 * Math.sin(tb * 0.23 + hk(4) * 6.28);
        // (b: how far round from the side facing the viewer; it alone sets where on screen the stream starts: the pull
        // toward the lens moves it along the line of sight)
        const b = Math.min(Math.max(0.2 + 0.4 * hk(5) + 0.12 * Math.sin(tb * 0.13 + hk(6) * 6.28), 0.12), 0.75);
        const ca0 = Math.cos(a) * Math.sin(b), sa0 = Math.sin(a) * Math.sin(b), cb = Math.cos(b);
        // out from the view's centre, across the screen; q: across the stream, in the screen's plane
        const ox = vRight.x * Math.cos(a) + vUp.x * Math.sin(a);
        const oy = vRight.y * Math.cos(a) + vUp.y * Math.sin(a);
        const oz = vRight.z * Math.cos(a) + vUp.z * Math.sin(a);
        const qx = vUp.x * Math.cos(a) - vRight.x * Math.sin(a);
        const qy = vUp.y * Math.cos(a) - vRight.y * Math.sin(a);
        const qz = vUp.z * Math.cos(a) - vRight.z * Math.sin(a);
        const pull = 0.05 + 0.45 * hk(9);
        let px = centre.x + (vFwd.x * cb + vRight.x * ca0 + vUp.x * sa0) * radius * 0.95;
        let py = centre.y + (vFwd.y * cb + vRight.y * ca0 + vUp.y * sa0) * radius * 0.95;
        let pz = centre.z + (vFwd.z * cb + vRight.z * ca0 + vUp.z * sa0) * radius * 0.95;
        px += (cam.x - px) * pull; py += (cam.y - py) * pull; pz += (cam.z - pz) * pull;
        // its length: a share of the loose grains' travel; each grain a little faster or slower than its stream, so
        // the stream loosens along its length too
        const go = life * travel * (0.3 + 0.45 * hk(12)) * (0.8 + 0.4 * h(7));
        // tight where it leaves the sand, then each grain drifts off on its own heading, across the stream and in
        // depth: it fans out into a plume as it goes (Liam: spread as they get further from the sand)
        const width = grainR * (3 + 4 * hk(13)), fan = 0.06 + 0.12 * hk(14);
        const r = Math.sqrt(h(4)), ang = h(5) * Math.PI * 2;
        const across = (width + go * fan) * r;
        const ca = Math.cos(ang) * across, sa = Math.sin(ang) * across;
        // and the stream sways sideways along its length (one curve for all its grains, by their age)
        const sway = 0.25 * go * Math.sin(life * (5 + 5 * hk(15)) + hk(7) * 6.28);
        tx = px + ox * go * 0.6 + qx * (ca + sway) + vFwd.x * sa;
        ty = py + oy * go * 0.6 + go * 0.5 + qy * (ca + sway) + vFwd.y * sa;
        tz = pz + oz * go * 0.6 + qz * (ca + sway) + vFwd.z * sa;
      }
      const o = i * 3;
      if (this.gen[i] !== gen) {
        // reborn: a new place, at rest
        this.gen[i] = gen;
        this.pos[o] = tx; this.pos[o + 1] = ty; this.pos[o + 2] = tz;
        this.vel[o] = 0; this.vel[o + 1] = 0; this.vel[o + 2] = 0;
      } else {
        // it rides most of its path's own motion
        this.pos[o] += (tx - this.home[o]) * CARRY;
        this.pos[o + 1] += (ty - this.home[o + 1]) * CARRY;
        this.pos[o + 2] += (tz - this.home[o + 2]) * CARRY;
      }
      this.home[o] = tx; this.home[o + 1] = ty; this.home[o + 2] = tz;
      // drawn toward its path (a spring), and by its neighbours (the flock), damped
      this.vel[o] = (this.vel[o] + ((tx - this.pos[o]) * PATH_STIFFNESS + this.flock[o]) * dt) * damp;
      this.vel[o + 1] = (this.vel[o + 1] + ((ty - this.pos[o + 1]) * PATH_STIFFNESS + this.flock[o + 1]) * dt) * damp;
      this.vel[o + 2] = (this.vel[o + 2] + ((tz - this.pos[o + 2]) * PATH_STIFFNESS + this.flock[o + 2]) * dt) * damp;
      this.pos[o] += this.vel[o] * dt; this.pos[o + 1] += this.vel[o + 1] * dt; this.pos[o + 2] += this.vel[o + 2] * dt;
      // born small, full most of its life, shrinking away at the end (Lusion's life curve)
      const env = Math.min(life / 0.08, 1) * (1 - Math.min(Math.max((life - 0.55) / 0.45, 0), 1));
      // the main sand's own grain sizes, and on screen the size they would be at the sand (Liam: never bigger than the
      // grains of the main object): one nearer the lens is smaller, so depth shows as parallax and overlap, not growth
      const toCam = Math.hypot(this.pos[o] - cam.x, this.pos[o + 1] - cam.y, this.pos[o + 2] - cam.z);
      this.sizes[i * 2] = grainR * (0.6 + s2 * 1.0) * env * Math.min(Math.max(toCam / camDist, 0.05), 1.5);
    }
    this.aPos.needsUpdate = true; this.aVel.needsUpdate = true; this.aSize.needsUpdate = true;
  }

  /** The flock, from where the grains are now: each pushed off the grains it overlaps (separation) and drawn a little
   *  toward its neighbours' centre (cohesion). Neighbours found through a hashed grid of cohesion-sized cells. */
  private flockForces(count: number, grainR: number): void {
    const pos = this.pos, f = this.flock, head = this.gridHead, next = this.gridNext;
    const rs = grainR * SEPARATION_R, rc = grainR * COHESION_R, rc2 = rc * rc, inv = 1 / rc;
    const cell = (x: number, y: number, z: number) => (((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0) % GRID;
    head.fill(-1);
    for (let i = 0; i < count; i++) {
      // only grains in this life (a grain about to be reborn is still where its last life left it)
      if (this.gen[i] < 0 || this.sizes[i * 2] <= 0) { next[i] = -2; continue; }
      const c = cell(Math.floor(pos[i * 3] * inv), Math.floor(pos[i * 3 + 1] * inv), Math.floor(pos[i * 3 + 2] * inv));
      next[i] = head[c]; head[c] = i;
    }
    f.fill(0, 0, count * 3);
    for (let i = 0; i < count; i++) {
      if (next[i] === -2) continue;
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      const cx = Math.floor(x * inv), cy = Math.floor(y * inv), cz = Math.floor(z * inv);
      let sx = 0, sy = 0, sz = 0, mx = 0, my = 0, mz = 0, n = 0;
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) for (let oz = -1; oz <= 1; oz++) {
        for (let j = head[cell(cx + ox, cy + oy, cz + oz)]; j >= 0; j = next[j]) {
          if (j === i) continue;
          const ex = x - pos[j * 3], ey = y - pos[j * 3 + 1], ez = z - pos[j * 3 + 2];
          const d2 = ex * ex + ey * ey + ez * ez;
          if (d2 >= rc2) continue;   // also drops the hash's collisions (far grains in the same slot)
          mx += pos[j * 3]; my += pos[j * 3 + 1]; mz += pos[j * 3 + 2]; n++;
          if (d2 < rs * rs && d2 > 1e-12) {
            const d = Math.sqrt(d2), push = SEPARATION * (rs - d) / d;
            sx += ex * push; sy += ey * push; sz += ez * push;
          }
        }
      }
      if (n) {
        sx += (mx / n - x) * COHESION; sy += (my / n - y) * COHESION; sz += (mz / n - z) * COHESION;
      }
      f[i * 3] = sx; f[i * 3 + 1] = sy; f[i * 3 + 2] = sz;
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
