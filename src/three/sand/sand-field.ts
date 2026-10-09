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
}

/** Calibrated against the Cycles renders (see the compare mode); light power is Blender's watts times this. */
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
  cursor: 5.0,          // the cursor light's strength (fades with the pointer): ~2x the key on the grains it touches
  cursorReach: 0.9,     // world units
  paintScale: 0.1,      // seconds: drift velocity -> grain offset
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

  constructor(data: SandData) {
    this.data = data;
    const { meta, positions, attributes } = data;
    const geo = new THREE.BufferGeometry();
    const posBuf = new THREE.InterleavedBuffer(positions, 6);
    geo.setAttribute("aPosA", new THREE.InterleavedBufferAttribute(posBuf, 3, 0, true));
    geo.setAttribute("aPosB", new THREE.InterleavedBufferAttribute(posBuf, 3, 3, true));
    geo.setAttribute("aAttr", new THREE.BufferAttribute(attributes, 4, true));
    // three needs a position attribute for bounds; the shader never reads it
    geo.setAttribute("position", new THREE.InterleavedBufferAttribute(posBuf, 3, 0, true));
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
        uRadMax: { value: meta.radius_max },
        uCompact: { value: 0 },
        uDelaySpan: { value: meta.compaction.delay_span },
        uRampLen: { value: meta.compaction.ramp },
        uBallC: { value: new THREE.Vector3(...meta.ball.center) },
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
        uSpec: { value: SAND_LOOK.spec },
        uCursorPos: { value: new THREE.Vector3(0, 0, 100) },
        uCursorCol: { value: new THREE.Vector3() },
        uCursorReach: { value: SAND_LOOK.cursorReach },
        uPaint: { value: null },
        uPaintScale: { value: SAND_LOOK.paintScale },
        uViewport: { value: new THREE.Vector2(1, 1) },
      },
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;

    this.setLook({});
  }

  /** The cursor as a light: world position and intensity 0..1 (fades with the pointer). */
  setCursor(pos: THREE.Vector3, intensity: number): void {
    const u = this.material.uniforms;
    (u.uCursorPos.value as THREE.Vector3).copy(pos);
    // warm white, a little cooler than the key so it reads as the visitor's own light
    (u.uCursorCol.value as THREE.Vector3).set(1.0, 0.9, 0.82).multiplyScalar(this.look.cursor * intensity);
  }

  /** The cursor's drift field, and the viewport in CSS px it is measured in. */
  setPaint(texture: THREE.Texture | null, cssWidth: number, cssHeight: number): void {
    const u = this.material.uniforms;
    u.uPaint.value = texture;
    (u.uViewport.value as THREE.Vector2).set(cssWidth, cssHeight);
  }

  /** The chaos's own centre (its grains' mean), the point it turns around. */
  private chaosCentre(): THREE.Vector3 {
    const { positions, meta } = this.data;
    const [lo, hi] = meta.bounds;
    const step = 97;
    let x = 0, y = 0, z = 0, n = 0;
    for (let i = 0; i < meta.count; i += step) {
      x += positions[i * 6] / 65535; y += positions[i * 6 + 1] / 65535; z += positions[i * 6 + 2] / 65535; n++;
    }
    return new THREE.Vector3(lo[0] + (x / n) * (hi[0] - lo[0]), lo[1] + (y / n) * (hi[1] - lo[1]), lo[2] + (z / n) * (hi[2] - lo[2]));
  }

  setGrains(count: number): void {
    const n = Math.min(count, this.data.meta.count);
    this.points.geometry.setDrawRange(0, n);
    this.material.uniforms.uCountScale.value = Math.pow(this.data.meta.count / n, 0.35);
  }

  setShadowSteps(steps: number): void {
    this.material.uniforms.uSteps.value = steps;
  }

  /** Pixels per world unit at distance 1, for the grains' point size. */
  setPointScale(viewportHeightPx: number, vfovRad: number): void {
    this.material.uniforms.uPointScale.value = viewportHeightPx / (2 * Math.tan(vfovRad / 2));
  }

  update(s: SandState): void {
    const u = this.material.uniforms;
    u.uCompact.value = s.compact;
    u.uTime.value = s.time;
    // the two density volumes around the current compaction (each grain's own progress varies around it)
    const { chaos, mid, ball } = this.data.volumes;
    if (s.compact < 0.5) {
      u.uVolA.value = chaos; u.uVolB.value = mid; u.uVolMix.value = s.compact / 0.5;
    } else {
      u.uVolA.value = mid; u.uVolB.value = ball; u.uVolMix.value = (s.compact - 0.5) / 0.5;
    }
    this.ballRot.setFromMatrix4(this.m4.makeRotationAxis(Y, s.ballSpin));
    this.chaosRot.setFromMatrix4(this.m4.makeRotationAxis(Y, s.chaosSpin));
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
    (u.uRadScale.value as THREE.Vector2).set(l.radScaleChaos, l.radScale);
    (u.uEdge.value as THREE.Vector2).set(l.edgeChaos, l.edgePx);
    u.uChaosShare.value = l.chaosShare;
    u.uMinPx.value = l.minPx;
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
