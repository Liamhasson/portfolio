import * as THREE from "three";

/**
 * Hero → 2.1, the pull-back: one continuous camera move from the hero framing down to the lamp-lit desk.
 * The desk is a rendered backplate sequence (no sand, no wordmark, a lens 1.5x wider so it covers any screen shape);
 * the sand and the wordmark stay live, in the hero's units. The camera path exported with the plate is converted
 * into those units, so the live layers sit exactly in the rendered space:
 *   hero = (desk - chaos_center) / chaos_scale, then Blender's z-up to three's y-up: (x, y, z) -> (x, z, -y).
 */

export interface PullbackPath {
  frames: number;
  plate_overscan: number;
  chaos_center: [number, number, number];
  chaos_scale: number;
  path: { frame: number; position: [number, number, number]; quaternion: [number, number, number, number]; lens_mm: number }[];
  /** Ray-traced depth per frame (lookdev.py --scene raygrid): the plate is laid onto it and viewed by the live camera. */
  depth?: { file: string; gw: number; gh: number; unit: "mm"; plate_aspect: number };
  lights: {
    lamp: { pos: number[]; target: number[]; watts: number; color: number[]; spot_deg: number; blend: number };
    rim: { pos: number[]; watts: number; color: number[] };
    bounce: { pos: number[]; watts: number; color: number[] };
  };
}

export const PULLBACK_BASE = "/lab/pullback";
const Z_UP_TO_Y_UP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

const PLATE_VERTEX = /* glsl */ `
out vec2 vNdc;
void main() { vNdc = position.xy; gl_Position = vec4(position.xy, 0.9999, 1.0); }
`;
const PLATE_FRAGMENT = /* glsl */ `
precision highp float;
out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
in vec2 vNdc;
uniform sampler2D uA;
uniform sampler2D uB;
uniform float uMix;
uniform vec2 uScale;      // live tan(half fov) / plate tan(half fov), per axis
uniform float uOpacity;
void main() {
  vec2 uv = 0.5 + 0.5 * vNdc * uScale;
  vec3 c = mix(texture(uA, uv).rgb, texture(uB, uv).rgb, uMix);
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) c = vec3(0.0);
  gl_FragColor = vec4(c * uOpacity, 1.0);
  #include <colorspace_fragment>
}
`;

const REPROJECT_VERTEX = /* glsl */ `
out vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const REPROJECT_FRAGMENT = /* glsl */ `
precision highp float;
out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
in vec2 vUv;
uniform sampler2D uMap;
uniform float uOpacity;
void main() {
  gl_FragColor = vec4(texture(uMap, vUv).rgb, uOpacity);
  #include <colorspace_fragment>
}
`;

/** One plate frame laid onto its depth: a grid mesh in the hero's units, rebuilt when the frame changes. */
class ReprojectedFrame {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  readonly texture = new THREE.Texture();
  shown = -1;
  constructor(gw: number, gh: number, order: number, transparent: boolean) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(gw * gh * 3), 3));
    const uv = new Float32Array(gw * gh * 2);
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      uv[(j * gw + i) * 2] = (i + 0.5) / gw;
      uv[(j * gw + i) * 2 + 1] = 1 - (j + 0.5) / gh;
    }
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    const idx: number[] = [];
    for (let j = 0; j < gh - 1; j++) for (let i = 0; i < gw - 1; i++) {
      const a = j * gw + i, b = a + 1, c = a + gw, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    geo.setIndex(idx);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: REPROJECT_VERTEX,
      fragmentShader: REPROJECT_FRAGMENT,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      transparent,
      toneMapped: false,
      uniforms: { uMap: { value: this.texture }, uOpacity: { value: 1 } },
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = order;
  }
}

export class Pullback {
  readonly plate: THREE.Object3D;
  private readonly flat: THREE.Mesh;
  private readonly frames: [ReprojectedFrame, ReprojectedFrame] | null = null;
  private depth: Uint16Array | null = null;
  private readonly material: THREE.ShaderMaterial;
  private readonly images: (HTMLImageElement | null)[];
  private readonly texA = new THREE.Texture();
  private readonly texB = new THREE.Texture();
  private shownA = -1;
  private shownB = -1;
  private readonly c: THREE.Vector3;
  private readonly k: number;

  constructor(readonly data: PullbackPath, frameUrl: (i: number) => string) {
    this.c = new THREE.Vector3(...data.chaos_center);
    this.k = data.chaos_scale;
    for (const t of [this.texA, this.texB]) {
      t.colorSpace = THREE.SRGBColorSpace;
      t.minFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
    }
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: PLATE_VERTEX,
      fragmentShader: PLATE_FRAGMENT,
      depthTest: false,
      depthWrite: false,
      toneMapped: false, // the plate is already tone mapped (AgX in Blender)
      uniforms: { uA: { value: this.texA }, uB: { value: this.texB }, uMix: { value: 0 }, uScale: { value: new THREE.Vector2(1, 1) }, uOpacity: { value: 1 } },
    });
    this.flat = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.flat.frustumCulled = false;
    this.flat.renderOrder = -100;
    this.plate = new THREE.Group();
    this.plate.add(this.flat);
    if (data.depth) {
      this.frames = [new ReprojectedFrame(data.depth.gw, data.depth.gh, -101, false), new ReprojectedFrame(data.depth.gw, data.depth.gh, -100, true)];
      this.frames.forEach((r) => this.plate.add(r.mesh));
      this.frames.forEach((r) => (r.mesh.visible = false));
    }
    // the frames load in the background, the start of the move first
    this.images = new Array(data.frames).fill(null);
    for (let i = 0; i < data.frames; i++) {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => { this.images[i] = img; };
      img.src = frameUrl(i + 1);
    }
  }

  static async load(base = PULLBACK_BASE): Promise<Pullback> {
    const data = (await (await fetch(`${base}/camera.json`)).json()) as PullbackPath;
    const pb = new Pullback(data, (i) => `${base}/f_${String(i).padStart(4, "0")}.jpg`);
    if (data.depth) {
      fetch(`${base}/${data.depth.file}`)
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .then((buf) => { if (buf) pb.depth = new Uint16Array(buf); })
        .catch(() => {});
    }
    return pb;
  }

  /** Lay frame `i` onto its depth: grid points along the frame camera's rays, in the hero's units. */
  private build(r: ReprojectedFrame, i: number): void {
    const dd = this.data.depth!, depth = this.depth!;
    const { gw, gh } = dd;
    const fr = this.data.path[i];
    const o = new THREE.Vector3(...fr.position);
    const q = new THREE.Quaternion(fr.quaternion[1], fr.quaternion[2], fr.quaternion[3], fr.quaternion[0]);
    const tanH = 18 / (fr.lens_mm / this.data.plate_overscan);
    const pos = r.mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const d = new THREE.Vector3(), p = new THREE.Vector3();
    const base = i * gw * gh;
    for (let j = 0; j < gh; j++) {
      const v = 1 - ((j + 0.5) / gh) * 2;
      for (let k = 0; k < gw; k++) {
        const u = ((k + 0.5) / gw) * 2 - 1;
        d.set(u * tanH, (v * tanH) / dd.plate_aspect, -1).normalize().applyQuaternion(q);
        const dist = depth[base + j * gw + k] / 1000;
        p.copy(o).addScaledVector(d, dist);
        const h = this.toHero([p.x, p.y, p.z]);
        const n = (j * gw + k) * 3;
        arr[n] = h.x; arr[n + 1] = h.y; arr[n + 2] = h.z;
      }
    }
    pos.needsUpdate = true;
  }

  /** A desk-space (Blender, z up, metres) point in the hero's units (three, y up). */
  toHero(p: number[]): THREE.Vector3 {
    const h = new THREE.Vector3(...(p as [number, number, number])).sub(this.c).divideScalar(this.k);
    return new THREE.Vector3(h.x, h.z, -h.y);
  }

  /** The camera at a fractional frame (0..frames-1): position, orientation (three), lens. */
  view(f: number): { position: THREE.Vector3; quaternion: THREE.Quaternion; lens: number } {
    const n = this.data.frames;
    const x = Math.min(Math.max(f, 0), n - 1);
    const i = Math.min(Math.floor(x), n - 2), t = x - i;
    const a = this.data.path[i], b = this.data.path[i + 1];
    const pos = this.toHero(a.position).lerp(this.toHero(b.position), t);
    const qa = new THREE.Quaternion(a.quaternion[1], a.quaternion[2], a.quaternion[3], a.quaternion[0]);
    const qb = new THREE.Quaternion(b.quaternion[1], b.quaternion[2], b.quaternion[3], b.quaternion[0]);
    const q = Z_UP_TO_Y_UP.clone().multiply(qa.slerp(qb, t));
    return { position: pos, quaternion: q, lens: a.lens_mm + (b.lens_mm - a.lens_mm) * t };
  }

  /** Show the plate at a fractional frame, cropped to the live camera (its tan(half fov) per axis). */
  show(f: number, liveTanH: number, liveTanV: number, lens: number): void {
    const n = this.data.frames;
    const x = Math.min(Math.max(f, 0), n - 1);
    const i = Math.min(Math.floor(x), n - 2);
    // nearest loaded frames (until all have arrived)
    const near = (j: number) => {
      for (let d = 0; d < n; d++) {
        if (this.images[j - d]) return j - d;
        if (this.images[j + d]) return j + d;
      }
      return -1;
    };
    const ia = near(i), ib = near(i + 1);
    if (ia < 0) { this.material.uniforms.uOpacity.value = 0; return; }
    if (this.frames && this.depth) {
      // the two nearest frames, each laid onto its own depth and seen by the live camera: aligned, so blending them
      // only evens out the small view-dependent differences (no double edges)
      this.flat.visible = false;
      const [ra, rb] = this.frames;
      for (const [r, j] of [[ra, ia], [rb, ib]] as const) {
        r.mesh.visible = true;
        if (r.shown !== j) {
          this.build(r, j);
          r.texture.image = this.images[j];
          r.texture.needsUpdate = true;
          r.shown = j;
        }
      }
      rb.material.uniforms.uOpacity.value = ib !== ia ? x - i : 0;
      rb.mesh.visible = ib !== ia;
      return;
    }
    this.material.uniforms.uOpacity.value = 1;
    if (ia !== this.shownA) { this.texA.image = this.images[ia]; this.texA.needsUpdate = true; this.shownA = ia; }
    if (ib !== this.shownB) { this.texB.image = this.images[ib]; this.texB.needsUpdate = true; this.shownB = ib; }
    this.material.uniforms.uMix.value = ib !== ia ? x - i : 0;
    const plateTanH = 18 / (lens / this.data.plate_overscan);
    const plateTanV = plateTanH / 1.6;
    (this.material.uniforms.uScale.value as THREE.Vector2).set(liveTanH / plateTanH, liveTanV / plateTanV);
  }

  /**
   * The desk's lights in the hero's units (power scales with 1 / chaos_scale^2): the lamp (a spot, behind and left of
   * the sand), the rim, and the desk itself: the lamp floods the walnut, which bounces warm light up into the sand from
   * just in front of and below it (what keeps the sand evenly warm in the Cycles render; the set's own bounce spot
   * aims elsewhere).
   */
  deskLights(
    wattsToIrradiance: number,
    gains: [number, number, number],
    o: { bouncePos?: number[]; bounceColor?: number[]; radii?: number[]; spotDeg?: number; blend?: number } = {},
  ) {
    const L = this.data.lights;
    const k2 = 1 / (this.k * this.k);
    const deskBounce = { pos: o.bouncePos ?? [0.0, -0.12, 0.0], watts: 20, color: o.bounceColor ?? [1.0, 0.6, 0.34] };
    // light radii in the hero's units: the lamp's soft size 0.2 m, the rim panel 0.24 m, the lit desk ~0.3 m
    const radii = o.radii ?? [2.0, 1.2, 3.0];
    const set = [L.lamp, L.rim, deskBounce].map((l, i) => ({
      pos: this.toHero(l.pos),
      col: new THREE.Vector3(...(l.color as [number, number, number])).multiplyScalar(l.watts * k2 * wattsToIrradiance * gains[i]),
      r: radii[i],
    }));
    const dir = this.toHero(L.lamp.target).sub(set[0].pos).normalize();
    const half = THREE.MathUtils.degToRad((o.spotDeg ?? L.lamp.spot_deg) / 2);
    const outer = Math.cos(half);
    const inner = outer + (o.blend ?? L.lamp.blend) * (1 - outer);
    return { lights: set, spot: { dir, cos: new THREE.Vector2(outer, inner) } };
  }

  dispose(): void {
    this.flat.geometry.dispose();
    this.material.dispose();
    this.frames?.forEach((r) => { r.mesh.geometry.dispose(); r.material.dispose(); r.texture.dispose(); });
    this.texA.dispose();
    this.texB.dispose();
  }
}
