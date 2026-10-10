import * as THREE from "three";
import type { SandData } from "./data";
import { SAND_FRAGMENT, SAND_VERTEX } from "./shaders";

/** What the page asks of the sand each frame. */
export interface SandState {
  /** 0 = chaos, 1 = the dense ball. */
  compact: number;
  /** Seconds, for the ambient flow. Frozen in compare mode. */
  time: number;
  /** Ball spin about its vertical axis, radians. */
  ballSpin: number;
  /** The chaos turning around itself, radians. */
  chaosSpin: number;
  /** The ball rolling forward about the horizontal (the rise to the top view), radians. */
  ballRoll?: number;
}

/** Calibrated against the Cycles renders (see the compare mode); light power is Blender's watts times this. */
/** The cursor light's colour: rose-gold (the palette's #b9725c, lifted toward light). */
export const CURSOR_WARM: [number, number, number] = [1.0, 0.64, 0.46];

export const SAND_LOOK = {
  // calibrated 2026-10-09 against the hero renders (chaos, mid, ball) with scripts/lab/sweep.sh: total light per channel
  // within 3-7%, colour balance within 0.02, grain and structure contrast matched on the ball
  exposure: 1.0,
  wattsToIrradiance: 1 / (4 * Math.PI),
  key: 1.7,
  rim: 1.0,
  fill: 0.25,
  shadowK: 0.8,
  shadowKChaos: 2.2,
  spec: 0.01,
  wrap: 0.1,
  bounce: 0.35,
  localBounce: 1.0,
  localOcclusion: 0.1,
  cavityDepth: 0.1,
  cavity: 0.3,
  radScale: 1.1,
  radScaleChaos: 1.15,
  edgeChaos: 0.4,
  chaosShare: 0.715,
  edgePx: 0.0,
  minPx: 1.6,
  drift: 0.012,
  driftFreq: 0.9,
  driftSpeed: 0.05,
  // the cursor on the main sand at a tenth of its first strength (Liam, 2026-10-10: it read as too strong); the grains
  // drifting off the sand (drift-grains.ts) keep the full strength, as Lusion's do
  cursor: 0.5,          // the cursor light's strength (fades with the pointer)
  cursorReach: 0.9,     // world units
  paintScale: 0.01,     // seconds: drift velocity -> grain offset
  frontK: 1.0,          // the drift reaches only grains with little sand between them and the viewer (0 = all grains)
  frontFalloff: 0.25,   // transmittance below which a grain counts as behind
  // the flow between chaos and ball (shaders.ts flowOffset; Ducky 3D's particle flow, 2026-10-10): its reach at the
  // halfway point (world units; the ball's radius is 1.1), the size of its folds, how much they curl, how fast they move
  flow: 0.55,
  flowFreq: 0.35,
  flowWarp: 1.0,
  flowSpeed: 0.04,
  // each grain streaked along its own motion over the shutter: 0.5 = film's 180-degree shutter (1/120 s; Liam's
  // reference has a light blur, a full 1/60 s read as rice), and its streak at most this many grain lengths longer
  motionBlur: 0.5,
  motionBlurMax: 1.0,
};

const Y = new THREE.Vector3(0, 1, 0);

export class SandField {
  readonly points: THREE.Points;
  readonly material: THREE.ShaderMaterial;
  private readonly data: SandData;
  private look = { ...SAND_LOOK };
  private readonly ballRot = new THREE.Matrix3();
  private readonly chaosRot = new THREE.Matrix3();
  private readonly m4 = new THREE.Matrix4();
  // everything that placed the grains at the last update (their motion blur reads it as "a frame ago")
  private readonly ballRotPrev = new THREE.Matrix3();
  private readonly chaosRotPrev = new THREE.Matrix3();
  private readonly last = { compact: 0, time: 0, ballC: new THREE.Vector3(), posMax: 0, roll: 0, at: -1 };

  constructor(data: SandData) {
    this.data = data;
    const { meta, words, attributes } = data;
    const geo = new THREE.BufferGeometry();
    const pos = new THREE.BufferAttribute(words, 2);
    pos.gpuType = THREE.IntType;   // read as uvec2 in the shader (integer attribute, no float conversion)
    geo.setAttribute("aPos", pos);
    geo.setAttribute("aAttr", new THREE.BufferAttribute(attributes, 4, true));
    // three needs a position attribute for bounds; the shader never reads it
    geo.setAttribute("position", pos);
    const [lo, hi] = meta.bounds;
    geo.boundingSphere = new THREE.Sphere(
      new THREE.Vector3((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2),
      Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2,
    );

    const ramp = meta.ramp;
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: SAND_VERTEX,
      fragmentShader: SAND_FRAGMENT,
      transparent: false,
      depthWrite: true,
      depthTest: true,
      alphaToCoverage: true,
      toneMapped: true,
      uniforms: {
        uLo: { value: new THREE.Vector3(...lo) },
        uSize: { value: new THREE.Vector3(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) },
        uChaosLo: { value: new THREE.Vector3(...meta.chaos_box[0]) },
        uChaosSize: {
          value: new THREE.Vector3(...meta.chaos_box[1]).sub(new THREE.Vector3(...meta.chaos_box[0])),
        },
        uBallPosMax: { value: meta.ball_pos_max },
        uRadMax: { value: meta.radius_max },
        uCompact: { value: 0 },
        uDelaySpan: { value: meta.compaction.delay_span },
        uRampLen: { value: meta.compaction.ramp },
        uBallC: { value: new THREE.Vector3(...meta.ball.center) },
        uBallVolC: { value: new THREE.Vector3(...meta.ball.center) },
        uBallVolS: { value: 1 },
        uBallGrain: { value: 1 },
        uAttUp: { value: new THREE.Vector3(0, 1, 0) },
        uAttLo: { value: 1 },
        uAttBreak: { value: 0 },
        uAttDepth: { value: 0 },
        uAttFull: { value: 0 },
        uMelt: { value: 0 },
        uMeltUp: { value: new THREE.Vector3(0, 0, 1) },
        uDrain: { value: 0 },
        uSinkClear: { value: 0.9 },
        uBufH: { value: 1 },
        uShutter: { value: 1 / 60 },   // motion blur: the grain's travel over this long, on screen
        uClearAlb: { value: new THREE.Vector3(0.58, 0.44, 0.36) },   // calibrated with the frost skin (frost-skin.ts)
        uBallRot: { value: this.ballRot },
        uChaosC: { value: this.chaosCentre() },
        uChaosRot: { value: this.chaosRot },
        uTime: { value: 0 },
        uDrift: { value: SAND_LOOK.drift },
        uDriftFreq: { value: SAND_LOOK.driftFreq },
        uDriftSpeed: { value: SAND_LOOK.driftSpeed },
        uPointScale: { value: 1 },
        uMinPx: { value: SAND_LOOK.minPx },
        uCountScale: { value: 1 },
        uRadScale: { value: new THREE.Vector2(SAND_LOOK.radScaleChaos, SAND_LOOK.radScale) },
        uEdge: { value: new THREE.Vector2(SAND_LOOK.edgeChaos, SAND_LOOK.edgePx) },
        uChaosShare: { value: SAND_LOOK.chaosShare },
        uWrap: { value: SAND_LOOK.wrap },
        uBallR: { value: meta.ball.radius },
        uCavity: { value: new THREE.Vector2(SAND_LOOK.cavityDepth, SAND_LOOK.cavity) },
        uLocal: { value: new THREE.Vector2(SAND_LOOK.localOcclusion, SAND_LOOK.localBounce) },
        uBounce: { value: SAND_LOOK.bounce },
        uVolA: { value: data.volumes.chaos },
        uVolB: { value: data.volumes.mid },
        uVolMix: { value: 0 },
        uSigmaMax: { value: meta.volume.sigma_max },
        uSteps: { value: 16 },
        uShadowK: { value: new THREE.Vector2(SAND_LOOK.shadowKChaos, SAND_LOOK.shadowK) },
        uLightPos: { value: meta.lights.map((l) => new THREE.Vector3(...l.pos)) },
        uLightCol: {
          value: meta.lights.map((l) =>
            new THREE.Vector3(...l.color).multiplyScalar(l.watts * SAND_LOOK.wattsToIrradiance),
          ),
        },
        uRamp: { value: ramp.map(([, c]) => new THREE.Vector3(...c)) },
        uRampAt: { value: new THREE.Vector4(ramp[0][0], ramp[1][0], ramp[2][0], ramp[3][0]) },
        uExposure: { value: SAND_LOOK.exposure },
        uOutScale: { value: 1 },
        uGroundCol: { value: new THREE.Vector3() },
        uGround: { value: new THREE.Vector2(-1e3, 1) },
        uFillCol: { value: new THREE.Vector3() },
        uUpView: { value: new THREE.Vector3(0, 1, 0) },
        uSpec: { value: SAND_LOOK.spec },
        uSpotDir: { value: new THREE.Vector3(0, 0, -1) },
        uSpotCos: { value: new THREE.Vector2(-3, -2) },   // no cone: a plain point light
        uLightR2: { value: new THREE.Vector3(0, 0, 0) },
        uLampSat: { value: 0 },
        uCursorPos: { value: new THREE.Vector3(0, 0, 100) },
        uCursorCol: { value: new THREE.Vector3() },
        uCursorReach: { value: SAND_LOOK.cursorReach },
        uPaint: { value: null },
        uPaintScale: { value: SAND_LOOK.paintScale },
        uFront: { value: new THREE.Vector2(SAND_LOOK.frontK, SAND_LOOK.frontFalloff) },
        uViewport: { value: new THREE.Vector2(1, 1) },
        uFlow: { value: new THREE.Vector4(SAND_LOOK.flow, SAND_LOOK.flowFreq, SAND_LOOK.flowWarp, SAND_LOOK.flowSpeed) },
        uCompactPrev: { value: 0 },
        uTimePrev: { value: 0 },
        uBallRotPrev: { value: this.ballRotPrev },
        uChaosRotPrev: { value: this.chaosRotPrev },
        uBallCPrev: { value: new THREE.Vector3(...meta.ball.center) },
        uBallPosMaxPrev: { value: meta.ball_pos_max },
        uFrameDt: { value: 1 / 60 },
        uMotionBlur: { value: new THREE.Vector2(SAND_LOOK.motionBlur, SAND_LOOK.motionBlurMax) },
      },
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;

    this.setLook({});
  }

  /**
   * Override the three set lights (camera moves hand the hero's lights over to the desk lamp). Each: position, colour x
   * power (already in the shader's units, gains applied); light 0 may be a spot (direction + cone cosines).
   */
  setLights(
    lights: { pos: THREE.Vector3; col: THREE.Vector3; r?: number }[],
    spot?: { dir: THREE.Vector3; cos: THREE.Vector2 },
    lampSat = 0,
  ): void {
    const u = this.material.uniforms;
    u.uLampSat.value = lampSat;
    lights.forEach((l, i) => {
      (u.uLightPos.value[i] as THREE.Vector3).copy(l.pos);
      (u.uLightCol.value[i] as THREE.Vector3).copy(l.col);
      (u.uLightR2.value as THREE.Vector3).setComponent(i, (l.r ?? 0) ** 2);
    });
    if (spot) {
      (u.uSpotDir.value as THREE.Vector3).copy(spot.dir);
      (u.uSpotCos.value as THREE.Vector2).copy(spot.cos);
    } else (u.uSpotCos.value as THREE.Vector2).set(-3, -2);
  }

  /** The hero lights in the shader's units (positions and calibrated colour x power), for blending toward another set. */
  heroLights(): { pos: THREE.Vector3; col: THREE.Vector3 }[] {
    const gains = [this.look.key, this.look.rim, this.look.fill];
    return this.data.meta.lights.map((l, i) => ({
      pos: new THREE.Vector3(...l.pos),
      col: new THREE.Vector3(...l.color).multiplyScalar(l.watts * this.look.wattsToIrradiance * gains[i]),
    }));
  }

  get lookGains(): { key: number; rim: number; fill: number; wattsToIrradiance: number } {
    return this.look;
  }

  /**
   * Where the ball forms (2.1: on the desk, smaller than the hero's). The grains, their size and the self-shadowing all
   * follow; the density volume baked for the hero's ball is reused through a mapping.
   */
  setBallTarget(center: THREE.Vector3, radius: number): void {
    const u = this.material.uniforms;
    const meta = this.data.meta;
    const s = radius / meta.ball.radius;
    (u.uBallC.value as THREE.Vector3).copy(center);
    u.uBallPosMax.value = meta.ball_pos_max * s;
    u.uBallR.value = radius;
    u.uBallVolS.value = 1 / s;
    u.uBallGrain.value = s;
  }

  /** The desk below as a broad light (colour x strength, 0 = none), reaching the loose sand up to about `reach` above
   *  its top at `deskY`; a soft fill from the viewer's side (colour x strength); and the camera (for world up). */
  setGround(col: THREE.Vector3, camera: THREE.Camera, fill?: THREE.Vector3, deskY = -1e3, reach = 1): void {
    const u = this.material.uniforms;
    (u.uGroundCol.value as THREE.Vector3).copy(col);
    (u.uFillCol.value as THREE.Vector3).copy(fill ?? new THREE.Vector3());
    (u.uGround.value as THREE.Vector2).set(deskY, reach);
    (u.uUpView.value as THREE.Vector3).set(0, 1, 0).transformDirection(camera.matrixWorldInverse);
  }

  /** 2.2: the current attempt (lo 1 = none; lower = a bigger patch), how broken, how clear; `up` faces the patch. */
  /** 2.3 build: how far the held attempt's clearing has swept over the whole ball (0..1), how far the grains have
   *  drained into the frost (0..1, gone at 1), and how far the frost has cleared into glass (0..1, a wave). */
  setBuild(full: number, drain: number, melt: number): void {
    const u = this.material.uniforms;
    u.uAttFull.value = full;
    u.uDrain.value = drain;
    u.uMelt.value = melt;
  }

  /** The ball's turn now (object -> world). */
  get ballRotation(): THREE.Matrix3 {
    return this.material.uniforms.uBallRot.value as THREE.Matrix3;
  }

  setAttempt(lo: number, breakup: number, depth: number, up?: THREE.Vector3): void {
    const u = this.material.uniforms;
    u.uAttLo.value = lo;
    u.uAttBreak.value = breakup;
    u.uAttDepth.value = depth;
    if (up) (u.uAttUp.value as THREE.Vector3).copy(up);
  }

  /** The cursor as a light: world position and intensity 0..1 (fades with the pointer). */
  setCursor(pos: THREE.Vector3, intensity: number): void {
    const u = this.material.uniforms;
    (u.uCursorPos.value as THREE.Vector3).copy(pos);
    // warm white, a little cooler than the key so it reads as the visitor's own light
    // warm, rose-gold (Liam: as Oryzo's amber cursor light, in our palette)
    (u.uCursorCol.value as THREE.Vector3).set(...CURSOR_WARM).multiplyScalar(this.look.cursor * intensity);
  }

  /** The cursor's drift field, and the viewport in CSS px it is measured in. */
  setPaint(texture: THREE.Texture | null, cssWidth: number, cssHeight: number): void {
    const u = this.material.uniforms;
    u.uPaint.value = texture;
    (u.uViewport.value as THREE.Vector2).set(cssWidth, cssHeight);
  }

  /** The chaos's own centre (its grains' mean), the point it turns around. */
  private chaosCentre(): THREE.Vector3 {
    const { words, count, meta } = this.data;
    const [lo, hi] = meta.chaos_box;
    let x = 0, y = 0, z = 0, n = 0;
    for (let i = 0; i < count; i += 97) {
      const w = words[i * 2];
      x += (w & 2047) / 2047; y += ((w >>> 11) & 1023) / 1023; z += (w >>> 21) / 2047; n++;
    }
    return new THREE.Vector3(lo[0] + (x / n) * (hi[0] - lo[0]), lo[1] + (y / n) * (hi[1] - lo[1]), lo[2] + (z / n) * (hi[2] - lo[2]));
  }

  setGrains(count: number): void {
    const n = Math.min(count, this.data.count);
    this.points.geometry.setDrawRange(0, n);
    this.material.uniforms.uCountScale.value = Math.pow(this.data.meta.count / n, 0.35);
  }

  setShadowSteps(steps: number): void {
    this.material.uniforms.uSteps.value = steps;
  }

  /** Pixels per world unit at distance 1, for the grains' point size. */
  setPointScale(viewportHeightPx: number, vfovRad: number): void {
    this.material.uniforms.uPointScale.value = viewportHeightPx / (2 * Math.tan(vfovRad / 2));
    this.material.uniforms.uBufH.value = viewportHeightPx;
  }

  update(s: SandState): void {
    const u = this.material.uniforms;
    // a frame ago, for the blur: the last update's state (the ball's centre as it was then, too)
    const now = performance.now() / 1000, last = this.last;
    const ballC = u.uBallC.value as THREE.Vector3;
    const dt = now - last.at;
    // the first frame, a stall or a jump in the page: no motion to show
    const jumped = last.at < 0 || dt > 0.25 || Math.abs(s.compact - last.compact) > 0.15
      || last.ballC.distanceTo(ballC) > (u.uBallR.value as number);
    this.ballRotPrev.copy(this.ballRot);
    this.chaosRotPrev.copy(this.chaosRot);
    u.uCompactPrev.value = last.compact;
    u.uTimePrev.value = last.time;
    (u.uBallCPrev.value as THREE.Vector3).copy(last.ballC);
    u.uBallPosMaxPrev.value = last.posMax;
    u.uFrameDt.value = Math.min(Math.max(dt, 1 / 240), 1 / 20);
    u.uCompact.value = s.compact;
    u.uTime.value = s.time;
    // the two density volumes around the current compaction (each grain's own progress varies around it)
    const { chaos, mid, ball } = this.data.volumes;
    if (s.compact < 0.5) {
      u.uVolA.value = chaos; u.uVolB.value = mid; u.uVolMix.value = s.compact / 0.5;
    } else {
      u.uVolA.value = mid; u.uVolB.value = ball; u.uVolMix.value = (s.compact - 0.5) / 0.5;
    }
    this.m4.makeRotationAxis(Y, s.ballSpin);
    if (s.ballRoll) this.m4.premultiply(new THREE.Matrix4().makeRotationX(s.ballRoll));
    this.ballRot.setFromMatrix4(this.m4);
    this.chaosRot.setFromMatrix4(this.m4.makeRotationAxis(Y, s.chaosSpin));
    // only a frame where the grains moved (the scroll, the ball travelling or rolling) draws streaks: the slow spin and
    // drift move them far less than a grain in a frame, and skipping them saves the grains a second placing
    const moved = Math.abs(s.compact - last.compact) > 1e-5 || last.ballC.distanceToSquared(ballC) > 1e-12
      || last.posMax !== u.uBallPosMax.value || last.roll !== (s.ballRoll ?? 0);
    (u.uMotionBlur.value as THREE.Vector2).x = moved && !jumped ? this.look.motionBlur : 0;
    last.compact = s.compact; last.time = s.time; last.ballC.copy(ballC); last.posMax = u.uBallPosMax.value;
    last.roll = s.ballRoll ?? 0; last.at = now;
  }

  /** Lab calibration: override the look (compare mode). Light gains multiply Blender's calibrated power. */
  setLook(look: Partial<typeof SAND_LOOK>): void {
    const u = this.material.uniforms;
    const l = { ...SAND_LOOK, ...look };
    this.look = l;
    u.uExposure.value = l.exposure;
    (u.uShadowK.value as THREE.Vector2).set(l.shadowKChaos, l.shadowK);
    u.uSpec.value = l.spec;
    u.uCursorReach.value = l.cursorReach;
    u.uPaintScale.value = l.paintScale;
    (u.uFront.value as THREE.Vector2).set(l.frontK, l.frontFalloff);
    (u.uRadScale.value as THREE.Vector2).set(l.radScaleChaos, l.radScale);
    (u.uEdge.value as THREE.Vector2).set(l.edgeChaos, l.edgePx);
    u.uChaosShare.value = l.chaosShare;
    u.uMinPx.value = l.minPx;
    (u.uFlow.value as THREE.Vector4).set(l.flow, l.flowFreq, l.flowWarp, l.flowSpeed);
    (u.uMotionBlur.value as THREE.Vector2).set(l.motionBlur, l.motionBlurMax);
    u.uWrap.value = l.wrap;
    u.uBounce.value = l.bounce;
    (u.uCavity.value as THREE.Vector2).set(l.cavityDepth, l.cavity);
    (u.uLocal.value as THREE.Vector2).set(l.localOcclusion, l.localBounce);
    const gains = [l.key, l.rim, l.fill];
    this.data.meta.lights.forEach((light, i) => {
      (u.uLightCol.value[i] as THREE.Vector3)
        .set(...light.color)
        .multiplyScalar(light.watts * l.wattsToIrradiance * gains[i]);
    });
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.material.dispose();
    Object.values(this.data.volumes).forEach((t) => t.dispose());
  }
}
