import * as THREE from "three";

/**
 * Grains leaving the sand: the atmosphere around the main object, as real pebbles.
 *
 * Read from Lusion's and Oryzo's code (2026-10-10): their loose particles are real meshes (Oryzo: a scanned bean, a few
 * thousand instances), simulated on the CPU: each is drawn toward a slowly moving path, damped, pushed by the cursor (a
 * sphere that shoves them out and hands them some of its own speed), and turned to face where it is going plus its own
 * fixed tumble. Ours do the same with our grains: the shape the sand is made of in Blender (an icosphere, smooth shaded,
 * randomly squashed and turned; roughness 0.62), in the sand's palette, lit by the scene's lights and the cursor's warm
 * light. Each is born on the sand's surface, carried up and out in a slow swirl, shrinks away and is reborn. About half
 * leave in streams (one wandering emitter each, its grains let go one after another along one sinuous path: a tendril
 * that fans out into a plume as it goes; each stream its own size, pace, length and depth), held together as a flock
 * (separation + cohesion, from the C4D particles tutorial); the rest stay loose, a spray.
 *
 * Solid, never see-through: a grain with no light on it simply isn't there (it shrinks to nothing), so none shows as a
 * dark speck over the lit desk. Motion blur: each grain is stretched behind itself along its motion by how far it moves
 * in a shutter of 1/60 s (a flicked grain streaks, a drifting one stays sharp). Drawn in the sand's layer.
 */
const VERTEX = /* glsl */ `
precision highp float;
in vec3 iPos;              // per grain: position (world), velocity (world / s), rotation, squash, size and hue
in vec3 iVel;
in vec4 iRot;
in vec3 iSquash;
in vec2 iSizeHue;
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
uniform float uExposure;
uniform float uShutter;    // seconds the blur spans
out vec3 vNormal;          // view space
out vec3 vView;
out vec3 vAlbedo;
out vec3 vL0; out vec3 vL1; out vec3 vL2; out vec3 vL3;
out vec3 vE0; out vec3 vE1; out vec3 vE2; out vec3 vE3;
vec3 ramp(float h) {
  vec3 c = uRamp[0];
  c = mix(c, uRamp[1], clamp((h - uRampAt.x) / (uRampAt.y - uRampAt.x), 0.0, 1.0));
  c = mix(c, uRamp[2], clamp((h - uRampAt.y) / (uRampAt.z - uRampAt.y), 0.0, 1.0));
  c = mix(c, uRamp[3], clamp((h - uRampAt.z) / (uRampAt.w - uRampAt.z), 0.0, 1.0));
  return c;
}
vec3 qrot(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
void main() {
  vec3 E[3];
  for (int i = 0; i < 3; i++) {
    vec3 Lv = uLightPos[i] - iPos;
    E[i] = uLightCol[i] / (dot(Lv, Lv) + uLightR2[i]);
  }
  E[0] *= smoothstep(uSpotCos.x, uSpotCos.y, dot(normalize(iPos - uLightPos[0]), uSpotDir));
  float dc = distance(iPos, uCursorPos) / uCursorReach;
  vec3 Ec = uCursorCol / (1.0 + dc * dc * dc * dc);
  // where no light reaches it, it isn't there
  float lit = smoothstep(0.015, 0.12, dot((E[0] + E[1] + E[2] + Ec) * uExposure, vec3(0.2126, 0.7152, 0.0722)));
  float size = iSizeHue.x * lit;
  vec3 local = qrot(iRot, position * iSquash) * size;
  vec3 nrm = normalize(qrot(iRot, normal / iSquash));
  vec4 mv = viewMatrix * vec4(iPos + local, 1.0);
  // motion blur: the side facing away from the motion trails behind it
  // (no grain, no trail; and never longer than a few grains: a jump is not a motion)
  vec3 vv = mat3(viewMatrix) * iVel * uShutter * step(1e-6, size);
  float vl = length(vv), cap = iSizeHue.x * 6.0;
  if (vl > cap) vv *= cap / vl;
  vec3 nv = normalize(mat3(viewMatrix) * nrm);
  mv.xyz -= vv * step(dot(nv, vv), 0.0);
  gl_Position = projectionMatrix * mv;
  vNormal = nv;
  vView = -mv.xyz;
  vAlbedo = ramp(iSizeHue.y);
  vL0 = normalize((viewMatrix * vec4(uLightPos[0], 1.0)).xyz - mv.xyz); vE0 = E[0];
  vL1 = normalize((viewMatrix * vec4(uLightPos[1], 1.0)).xyz - mv.xyz); vE1 = E[1];
  vL2 = normalize((viewMatrix * vec4(uLightPos[2], 1.0)).xyz - mv.xyz); vE2 = E[2];
  vL3 = normalize((viewMatrix * vec4(uCursorPos, 1.0)).xyz - mv.xyz); vE3 = Ec;
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
in vec3 vNormal;
in vec3 vView;
in vec3 vAlbedo;
in vec3 vL0; in vec3 vL1; in vec3 vL2; in vec3 vL3;
in vec3 vE0; in vec3 vE1; in vec3 vE2; in vec3 vE3;
uniform float uExposure;
uniform float uOutScale;
uniform float uWrap;
uniform float uSpec;
uniform float uLampSat;
uniform float uGain;
void main() {
  vec3 n = normalize(vNormal), v = normalize(vView);
  vec3 L[4] = vec3[4](vL0, vL1, vL2, vL3);
  vec3 E[4] = vec3[4](vE0, vE1, vE2, vE3);
  vec3 col = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    float ndl = max((dot(n, L[i]) + uWrap) / (1.0 + uWrap), 0.0);
    // the sand's matte stone (Blender: roughness 0.62): a broad, faint sheen, at the sand's calibrated strength
    float spec = pow(max(dot(n, normalize(L[i] + v)), 0.0), 12.0) * uSpec;
    // as the sand: the lamp's light, filtered through sand, saturates the grain's colour
    vec3 alb = i == 0 ? mix(vAlbedo, vAlbedo * vAlbedo * 2.2, uLampSat) : vAlbedo;
    col += E[i] * (alb * ndl / 3.14159265 + spec * ndl);
  }
  gl_FragColor = vec4(col * uExposure * uOutScale * uGain, 1.0);
}
`;

// Oryzo's simulation constants (theirs: a bean of radius 0.01, 60 fps), scaled to our grain size where they are lengths
const PATH_STIFFNESS = 120;         // per second squared, toward the path (Oryzo's pull, as it acts at 120 fps)
const VELOCITY_DAMPING_RATE = 3;    // per second: a pushed grain swings back once or twice, then settles (Liam: no long bounce)
/** How much of the sand's own motion (a scene change: the camera's move, the ball forming, rising) the grains ride
 *  outright; the spring only catches up the rest, so a transition shows as a barely visible, brief give. */
const CARRY = 0.94;
const MOUSE_PUSH_FORCE = 0.25;      // per unit of overlap, per 60 fps frame
const MOUSE_VELOCITY_TRANSFER = 0.1;
const TURN_RATE = 6;                // per second: how fast a grain turns to face its motion
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

export class DriftGrains {
  readonly mesh: THREE.InstancedMesh;
  readonly material: THREE.ShaderMaterial;
  readonly max: number;
  /** The share of grains that leave in streams (the rest stay loose); 0 = all loose, as before the streams. */
  streams = 1 - LOOSE;
  /**
   * Burst mode (Liam, 2026-10-10: once the ball has formed, no grains hang around it; under the cursor they come out of
   * the ball and go back in): every grain is born on the ball's surface near `burstAt` (the direction from the centre
   * to where the cursor meets the ball), arcs out and sinks back in. A grain only starts a new life while `burstOn`;
   * otherwise it finishes the one it has (back into the ball) and rests, unseen.
   */
  burst = false;
  burstOn = false;
  readonly burstAt = new THREE.Vector3(0, 0, 1);
  private readonly bdir: Float32Array;     // burst: the direction it left the ball by (this life)
  private readonly live: Uint8Array;       // burst: whether this life is one it was born into (else it rests)
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly rot: Float32Array;
  private readonly tumble: Float32Array;   // each grain's own fixed turn (quaternion)
  private readonly seed: Float32Array;     // 4 randoms per grain
  private readonly gen: Float32Array;      // its current life's number (rebirth: a new place)
  private readonly home: Float32Array;     // where its path had it last frame
  private readonly sizes: Float32Array;
  private readonly aPos: THREE.InstancedBufferAttribute;
  private readonly aVel: THREE.InstancedBufferAttribute;
  private readonly aRot: THREE.InstancedBufferAttribute;
  private readonly aSize: THREE.InstancedBufferAttribute;
  private readonly flock: Float32Array;    // each grain's acceleration from its neighbours, this frame
  private readonly gridHead = new Int32Array(GRID);
  private readonly gridNext: Int32Array;
  private readonly cursorPrev = new THREE.Vector3();
  private cursorHas = false;
  private readonly lastCentre = new THREE.Vector3(NaN, NaN, NaN);
  private readonly q = new THREE.Quaternion();
  private readonly q2 = new THREE.Quaternion();
  private readonly qt = new THREE.Quaternion();
  private readonly m = new THREE.Matrix4();
  private readonly dir = new THREE.Vector3();
  private readonly side = new THREE.Vector3();
  private readonly back = new THREE.Vector3();
  private readonly push = new THREE.Vector3();
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
    this.rot = new Float32Array(max * 4);
    this.tumble = new Float32Array(max * 4);
    this.seed = new Float32Array(max * 4);
    this.gen = new Float32Array(max).fill(-1);
    this.home = new Float32Array(max * 3);
    this.bdir = new Float32Array(max * 3);
    this.live = new Uint8Array(max);
    this.sizes = new Float32Array(max * 2);
    this.flock = new Float32Array(max * 3);
    this.gridNext = new Int32Array(max);
    for (let i = 0; i < max * 4; i++) this.seed[i] = Math.random();
    const axis = new THREE.Vector3();
    for (let i = 0; i < max; i++) {
      this.q.setFromAxisAngle(axis.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize(), (Math.random() - 0.5) * 2 * Math.PI);
      this.q.toArray(this.tumble, i * 4);
      this.q.toArray(this.rot, i * 4);
      this.sizes[i * 2 + 1] = Math.random();
    }
    // the grain: Blender's (an icosphere, smooth), each squashed +-22% and coloured from the sand's ramp
    const ico = new THREE.IcosahedronGeometry(1, 2);
    const geo = new THREE.InstancedBufferGeometry();
    geo.setIndex(ico.getIndex());
    geo.setAttribute("position", ico.getAttribute("position"));
    geo.setAttribute("normal", ico.getAttribute("normal"));
    const squash = new Float32Array(max * 3);
    for (let i = 0; i < max * 3; i++) squash[i] = 1 + 0.22 * (Math.random() * 2 - 1);
    this.aPos = new THREE.InstancedBufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aVel = new THREE.InstancedBufferAttribute(this.vel, 3).setUsage(THREE.DynamicDrawUsage);
    this.aRot = new THREE.InstancedBufferAttribute(this.rot, 4).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.InstancedBufferAttribute(this.sizes, 2).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("iPos", this.aPos);
    geo.setAttribute("iVel", this.aVel);
    geo.setAttribute("iRot", this.aRot);
    geo.setAttribute("iSquash", new THREE.InstancedBufferAttribute(squash, 3));
    geo.setAttribute("iSizeHue", this.aSize);
    geo.instanceCount = max;
    const su = sand.uniforms;
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        uRamp: su.uRamp, uRampAt: su.uRampAt,
        uLightPos: su.uLightPos, uLightCol: su.uLightCol, uLightR2: su.uLightR2, uSpotDir: su.uSpotDir, uSpotCos: su.uSpotCos,
        uCursorPos: su.uCursorPos, uCursorCol: { value: new THREE.Vector3() }, uCursorReach: su.uCursorReach,
        uExposure: su.uExposure, uOutScale: su.uOutScale, uWrap: su.uWrap,
        uSpec: su.uSpec, uLampSat: su.uLampSat,   // the sand's calibrated sheen and lamp colour
        uGain: { value: 1 },
        uShutter: { value: 1 / 60 },
      },
    });
    this.mesh = new THREE.InstancedMesh(geo, this.material, max);
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
    (this.material.uniforms.uCursorCol.value as THREE.Vector3).copy(cursorCol);
    const count = Math.round(this.max * Math.min(Math.max(density, 0), 1));
    this.mesh.count = count;
    this.mesh.visible = count > 0;
    if (!count) return;
    dt = Math.min(Math.max(dt, 1e-4), 1 / 20);
    // the sand leapt (a jump in the page, a reload mid-way): the grains re-form around it, they don't fly after it
    const leapt = !(this.lastCentre.distanceTo(centre) < radius * 0.25);
    this.lastCentre.copy(centre);
    if (leapt) this.gen.fill(-1);
    // the cursor's own motion (handed to the grains it touches)
    this.push.set(0, 0, 0);
    if (cursor) {
      if (this.cursorHas) this.push.subVectors(cursor, this.cursorPrev);
      this.cursorPrev.copy(cursor);
      this.cursorHas = true;
    } else this.cursorHas = false;
    const f60 = dt * 60;
    const damp = Math.exp(-dt * VELOCITY_DAMPING_RATE);
    const turn = 1 - Math.exp(-dt * TURN_RATE);
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
      const L = loose ? 10 * (0.7 + 0.6 * s3) : 10 * (0.55 + 0.9 * hk(0));
      // a stream's grains are let go one after another, evenly through its life (a little jitter: not a metronome)
      const cyc = loose ? time / L + s0 * 7 : time / L + hk(1) * 7 + ((i % PER_STREAM) + 0.4 * s0) / PER_STREAM;
      const bcyc = time / (1.5 * (0.8 + 0.4 * s3)) + s0 * 7;
      const life = this.burst ? bcyc - Math.floor(bcyc) : cyc - Math.floor(cyc);
      const gen = this.burst ? Math.floor(bcyc) : Math.floor(cyc);
      const h = (n: number) => { const x = Math.sin((gen + 1) * 12.9898 * (n + 1) + s0 * 78.233 + s1 * 37.719) * 43758.5453; return x - Math.floor(x); };
      let tx: number, ty: number, tz: number;
      if (this.burst) {
        // out of the ball near the cursor and back in: a short life, an arc along the surface's normal
        const o3 = i * 3;
        if (this.gen[i] !== Math.floor(time / (1.5 * (0.8 + 0.4 * s3)) + s0 * 7)) {
          // a new life: where it leaves (a spot within ~25 degrees of the cursor's), and whether it's born at all
          const jx = h(0) - 0.5, jy = h(1) - 0.5, jz = h(2) - 0.5;
          this.dir.set(this.burstAt.x + jx * 0.9, this.burstAt.y + jy * 0.9, this.burstAt.z + jz * 0.9).normalize();
          this.bdir[o3] = this.dir.x; this.bdir[o3 + 1] = this.dir.y; this.bdir[o3 + 2] = this.dir.z;
          this.live[i] = this.burstOn ? 1 : 0;
        }
        const bl = 1.5 * (0.8 + 0.4 * s3), bc = time / bl + s0 * 7, bli = bc - Math.floor(bc);
        const out = travel * (0.35 + 0.65 * h(3)) * Math.sin(Math.PI * bli);
        const bx = this.bdir[o3], by = this.bdir[o3 + 1], bz = this.bdir[o3 + 2];
        tx = centre.x + bx * (radius * 0.96 + out);
        ty = centre.y + by * (radius * 0.96 + out) + out * 0.25;
        tz = centre.z + bz * (radius * 0.96 + out);
      } else if (loose) {
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
      // the cursor: a sphere that shoves grains out of it and hands them some of its own speed
      if (cursor) {
        let ex = this.pos[o] - cursor.x, ey = this.pos[o + 1] - cursor.y, ez = this.pos[o + 2] - cursor.z;
        const along = ex * cursorDir.x + ey * cursorDir.y + ez * cursorDir.z;   // off the line of sight, not the point
        ex -= cursorDir.x * along; ey -= cursorDir.y * along; ez -= cursorDir.z * along;
        const d = Math.hypot(ex, ey, ez), reach = cursorR + grainR;
        if (d < reach && d > 1e-5) {
          const f = MOUSE_PUSH_FORCE * (reach - d) * 60 * f60;
          this.vel[o] += (ex / d) * f + this.push.x / dt * MOUSE_VELOCITY_TRANSFER;
          this.vel[o + 1] += (ey / d) * f + this.push.y / dt * MOUSE_VELOCITY_TRANSFER;
          this.vel[o + 2] += (ez / d) * f + this.push.z / dt * MOUSE_VELOCITY_TRANSFER;
        }
      }
      this.pos[o] += this.vel[o] * dt; this.pos[o + 1] += this.vel[o + 1] * dt; this.pos[o + 2] += this.vel[o + 2] * dt;
      // it turns to face where it goes, plus its own tumble
      const sp = Math.hypot(this.vel[o], this.vel[o + 1], this.vel[o + 2]);
      if (sp > grainR * 2) {
        this.dir.set(this.vel[o] / sp, this.vel[o + 1] / sp, this.vel[o + 2] / sp);
        this.side.crossVectors(this.dir, Math.abs(this.dir.y) > 0.99 ? this.alt : this.up).normalize();
        this.back.crossVectors(this.side, this.dir);
        this.m.makeBasis(this.side, this.dir, this.back);
        this.q2.setFromRotationMatrix(this.m).multiply(this.qt.fromArray(this.tumble, i * 4));
        this.q.fromArray(this.rot, i * 4).slerp(this.q2, turn).toArray(this.rot, i * 4);
      }
      // born small, full most of its life, shrinking away at the end (Lusion's life curve)
      const env = this.burst
        ? this.live[i] * Math.min(life / 0.12, 1) * (1 - Math.min(Math.max((life - 0.82) / 0.18, 0), 1))   // up out of it, back in
        : Math.min(life / 0.08, 1) * (1 - Math.min(Math.max((life - 0.55) / 0.45, 0), 1));
      // the main sand's own grain sizes, and on screen the size they would be at the sand (Liam: never bigger than the
      // grains of the main object): one nearer the lens is smaller, so depth shows as parallax and overlap, not growth
      const toCam = Math.hypot(this.pos[o] - cam.x, this.pos[o + 1] - cam.y, this.pos[o + 2] - cam.z);
      this.sizes[i * 2] = grainR * (0.6 + s2 * 1.0) * env * Math.min(Math.max(toCam / camDist, 0.05), 1.5);
    }
    this.aPos.needsUpdate = true; this.aVel.needsUpdate = true; this.aRot.needsUpdate = true; this.aSize.needsUpdate = true;
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
