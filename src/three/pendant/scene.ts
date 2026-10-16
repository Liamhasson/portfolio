// src/three/pendant/scene.ts
/**
 * The pendant's scene (spec 2026-10-16-about-pendant-design.md §3, §6): Liam's worn-brass Brahma pendant on a see-through
 * canvas over (or under) the About page. Plain three.js: no React, no DOM beyond the canvas.
 *   - lights ride with the camera (a warm key, a rose rim, a dim cool fill) over a PMREM'd RoomEnvironment;
 *   - the build passes (brass | clay | wire) are clipping planes along the camera's right vector;
 *   - depth of field is three's BokehPass with its "alpha = 1" line removed, so the page shows through the blur;
 *   - the dimming (behind the words) is a ShaderPass, never a CSS filter: a CSS filter on a canvas costs a compositor
 *     layer every frame;
 *   - the testimonials' glass ball is a placeholder refracting sphere here (Task 9 finishes it).
 * The mount (Task 7) poses the rig itself, `poseRig(f, motion, t, look, vw, vh, scene.camera, scene.outer, scene.inner)`,
 * then calls `draw`. `draw` never moves the camera: it draws from the camera as posed.
 */
import {
  AgXToneMapping, Box3, Color, DirectionalLight, HalfFloatType, Mesh, MeshBasicMaterial, MeshPhysicalMaterial,
  MeshStandardMaterial, NoColorSpace, Object3D, PMREMGenerator, PerspectiveCamera, Plane, Raycaster, Scene,
  SphereGeometry, SRGBColorSpace, DoubleSide, TextureLoader, Vector2, Vector3, WebGLRenderer, WebGLRenderTarget,
} from "three";
import type { BufferGeometry, Material, Texture } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { distanceFor } from "./camera";
import { buildEdges, patchBokeh, patchOutput } from "./passes";
import type { Frame } from "./shots";

/** Cache-busting token for the pendant's files (Liam's browser keeps old ones: bump it whenever a file in
 *  public/about/pendant changes). */
export const PENDANT_VERSION = "2026-10-16.2";

const BASE = "/about/pendant/";
const D = Math.PI / 180;
/** The depth-of-field blur's ceiling (a share of the screen). */
const MAX_BLUR = 0.012;
/** The glass sphere sits this share of the camera's distance in front of the camera. */
const GLASS_AT = 0.42;
/** Below this the glass is faded out: not drawn at all. */
const GLASS_MIN = 0.02;
/** Where a clip plane parks to clip nothing (keeps the program the same, so nothing recompiles mid-scroll). */
const CLIP_OFF = 1e6;

const url = (file: string) => `${BASE}${file}?v=${PENDANT_VERSION}`;

/** The dim pass: rgb times `dim`, alpha untouched (the canvas is premultiplied, so this darkens without turning it opaque). */
const DimShader = {
  uniforms: { tDiffuse: { value: null as Texture | null }, dim: { value: 1 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float dim;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D( tDiffuse, vUv );
      gl_FragColor = vec4( c.rgb * dim, c.a );
    }`,
};

export interface GlassSlot {
  /** The slot's centre as a share of the viewport's width / height, and its radius as a share of the height. */
  x: number;
  y: number;
  r: number;
}

export class PendantScene {
  readonly camera: PerspectiveCamera;
  /** Carries the screen-relative lay / tumble / lean (see camera.ts). */
  readonly outer: Object3D;
  /** Carries the spin about the pendant's own axis; the model hangs under it with its origin at mid-height. */
  readonly inner: Object3D;
  /** The model's bounds, in `inner`'s space. */
  readonly bounds: Box3;

  private readonly renderer: WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly bokeh: BokehPass;
  private readonly dimPass: ShaderPass;
  private readonly outputPass: OutputPass;
  private readonly renderPass: RenderPass;
  private readonly brass: Mesh;
  private readonly clay: Mesh;
  private readonly wire: Object3D;
  private readonly glassBall: Mesh;
  /** brass | clay | wire, in world space (the pendant stands at the origin). */
  private readonly brassClip = new Plane(new Vector3(-1, 0, 0), CLIP_OFF);
  private readonly clayClipLeft = new Plane(new Vector3(1, 0, 0), CLIP_OFF);
  private readonly clayClipRight = new Plane(new Vector3(-1, 0, 0), CLIP_OFF);
  private readonly wireClip = new Plane(new Vector3(1, 0, 0), CLIP_OFF);
  private readonly disposables: { dispose(): void }[];
  private vw = 1;
  private vh = 1;
  private gone = false;
  private readonly ray = new Raycaster();
  private readonly right = new Vector3();
  private readonly tmp = new Vector3();
  private readonly ndc = new Vector2();

  private constructor(
    renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera, outer: Object3D, inner: Object3D, bounds: Box3,
    brass: Mesh, clay: Mesh, wire: Object3D, glassBall: Mesh, disposables: { dispose(): void }[], hiDpi: boolean,
  ) {
    this.renderer = renderer;
    this.camera = camera;
    this.outer = outer;
    this.inner = inner;
    this.bounds = bounds;
    this.brass = brass;
    this.clay = clay;
    this.wire = wire;
    this.glassBall = glassBall;
    this.disposables = disposables;

    // the clip planes are on the three materials for good (a plane parked far away clips nothing), so the programs never
    // change when the build ends or starts
    (brass.material as Material).clippingPlanes = [this.brassClip];
    (clay.material as Material).clippingPlanes = [this.clayClipLeft, this.clayClipRight];
    wire.traverse((o) => { if ((o as Mesh).isMesh) ((o as Mesh).material as Material).clippingPlanes = [this.wireClip]; });

    // the composer draws into a multisampled half-float target (the renderer's own antialias doesn't reach a render
    // target); phones and retina screens (dpr > 1.25) are sharp enough without it, and four samples at 2x would be
    // hundreds of MB
    const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: hiDpi ? 0 : 4 });
    this.composer = new EffectComposer(renderer, target);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);
    this.bokeh = new BokehPass(scene, camera, { focus: 3, aperture: 0.001, maxblur: MAX_BLUR });
    // (see passes.ts: alpha left alone, and no blur where nothing is drawn, so the see-through canvas gets no halo)
    this.bokeh.materialBokeh.fragmentShader = patchBokeh(this.bokeh.materialBokeh.fragmentShader);
    this.bokeh.materialBokeh.needsUpdate = true;
    this.composer.addPass(this.bokeh);
    // (see passes.ts: the tone mapping and the sRGB curve see the plain colour, not the premultiplied one)
    this.outputPass = new OutputPass();
    const out = this.outputPass.material;
    out.fragmentShader = patchOutput(out.fragmentShader);
    out.needsUpdate = true;
    this.composer.addPass(this.outputPass);
    // the dim goes after the tone mapping, on what the screen will show, so `dim` means what a CSS brightness() meant
    // in the prototype (Liam's approved look); the pass is off while the pendant is at full brightness
    this.dimPass = new ShaderPass(DimShader);
    this.dimPass.enabled = false;
    this.composer.addPass(this.dimPass);
  }

  /** Loads the model, its maps and the wire copy, and builds the scene. Rejects if anything fails to load (and frees
   *  what it had made), so the mount can fall back to no pendant. */
  static async load(canvas: HTMLCanvasElement): Promise<PendantScene> {
    const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = AgXToneMapping;
    renderer.localClippingEnabled = true;
    const owned: { dispose(): void }[] = [];
    // `failed`: once a load has rejected, a file still on its way (Promise.all doesn't wait for the others) is freed as it arrives
    let failed = false;
    const keep = <T extends { dispose(): void }>(o: T): T => {
      if (failed) o.dispose();
      else owned.push(o);
      return o;
    };
    const ktx = new KTX2Loader().setTranscoderPath("/lab/basis/").detectSupport(renderer);
    try {
      const scene = new Scene();
      const pmrem = new PMREMGenerator(renderer);
      const room = new RoomEnvironment();
      const env = pmrem.fromScene(room, 0.04);
      room.dispose();
      pmrem.dispose();
      keep(env);
      scene.environment = env.texture;
      scene.environmentIntensity = 0.55;

      const camera = new PerspectiveCamera(30, 1, 0.01, 60);
      scene.add(camera);
      // the light rides with the camera: a warm key high left, a rose rim behind right, a dim low fill
      const light = (color: number, intensity: number, x: number, y: number, z: number) => {
        const l = new DirectionalLight(color, intensity);
        l.position.set(x, y, z);
        l.target.position.set(0, 0, -3);
        camera.add(l, l.target);
      };
      light(0xffd9b0, 3.2, -1.2, 1.4, 1.0);
      light(0xff9f86, 2.6, 1.4, 0.6, -1.6);
      light(0x9fb2ff, 0.35, 0.4, -1, 0.8);

      const gl = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
      const tl = new TextureLoader();
      const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      const tune = (t: Texture, srgb: boolean) => {
        keep(t);
        t.flipY = false; // glTF's UV convention (a KTX2 is stored top row first, as the JPEGs)
        t.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
        t.anisotropy = anisotropy;
        return t;
      };
      const [model, wireModel, color, normal, rough] = await Promise.all([
        gl.loadAsync(url("pendant.glb")),
        gl.loadAsync(url("pendant-wire.glb")),
        ktx.loadAsync(url("color.ktx2")).then((t) => tune(t, true)),
        tl.loadAsync(url("normal.jpg")).then((t) => tune(t, false)),
        tl.loadAsync(url("rough.jpg")).then((t) => tune(t, false)),
      ]);

      // (keep the file's node transforms: the compressed mesh's scale lives on its node, so the scene goes in whole)
      const holder = new Object3D();
      holder.add(model.scene);
      let brass: Mesh | undefined;
      model.scene.traverse((o) => { if (!brass && (o as Mesh).isMesh) brass = o as Mesh; });
      if (!brass) throw new Error("pendant.glb has no mesh");
      keep(brass.geometry);
      const wireMeshes: Mesh[] = [];
      wireModel.scene.traverse((o) => { if ((o as Mesh).isMesh) wireMeshes.push(o as Mesh); });
      if (!wireMeshes.length) throw new Error("pendant-wire.glb has no mesh");
      for (const m of wireMeshes) keep(m.geometry);

      // feet at -0.5 (the pivot at mid-height), the axis through x = z = 0
      holder.updateMatrixWorld(true);
      const box = new Box3().setFromObject(model.scene);
      const mid = box.getCenter(new Vector3());
      holder.position.set(-mid.x, -box.min.y - 0.5, -mid.z);

      // brass
      (brass.material as Material).dispose(); // (the loader's default: the file has no materials)
      // (normalScale y -1: the file has no tangents, so the shader derives them, and glTF's tangent-space normals then need
      // their green flipped, as GLTFLoader itself does for a mesh without tangents; the prototype got this from the loader)
      brass.material = keep(new MeshStandardMaterial({
        map: color, normalMap: normal, normalScale: new Vector2(1, -1), roughnessMap: rough, metalness: 1,
        side: DoubleSide, // (thin, open shell edges at the hood: single-sided, their backs vanish and read as notches)
      }));
      // the clay copy shares the geometry and the node's transform
      const clay = new Mesh(brass.geometry, keep(new MeshStandardMaterial({ color: 0xb9ada3, roughness: 0.78, metalness: 0, side: DoubleSide })));
      clay.position.copy(brass.position);
      clay.quaternion.copy(brass.quaternion);
      clay.scale.copy(brass.scale);
      brass.parent!.add(clay);
      // the wire copy: a low-poly stand-in (about 5k triangles), so the wire reads as wire
      const wireMat = keep(new MeshBasicMaterial({ color: 0xf1e2d2, wireframe: true, transparent: true, opacity: 0.55 }));
      for (const m of wireMeshes) m.material = wireMat;
      holder.add(wireModel.scene);

      const outer = new Object3D();
      const inner = new Object3D();
      inner.add(holder);
      outer.add(inner);
      scene.add(outer);
      outer.updateMatrixWorld(true);
      const bounds = new Box3().setFromObject(holder);

      // the placeholder glass (Task 9 finishes it): a real refracting sphere, only placed while the shot looks through it
      const glassBall = new Mesh(
        keep(new SphereGeometry(1, 96, 64)),
        keep(new MeshPhysicalMaterial({
          transmission: 1, roughness: 0.03, ior: 1.5, thickness: 2.2, color: 0xfff3ea,
          attenuationColor: new Color(0xffdcc8), attenuationDistance: 4, envMapIntensity: 1.1, specularIntensity: 1,
        })),
      );
      glassBall.visible = false;
      scene.add(glassBall);

      for (const t of [color, normal, rough]) renderer.initTexture(t);
      const hiDpi = (typeof window !== "undefined" ? window.devicePixelRatio : 1) > 1.25;
      const built = new PendantScene(renderer, scene, camera, outer, inner, bounds, brass, clay, wireModel.scene, glassBall, owned, hiDpi);
      built.warm();
      return built;
    } catch (e) {
      failed = true;
      for (const o of owned) o.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      // (a texture's load error is a bare Event)
      throw e instanceof Error ? e : new Error("the pendant's files did not load");
    } finally {
      ktx.dispose(); // (its transcoding workers)
    }
  }

  /**
   * Compiles every program the scene will ever draw with, and uploads the maps, while the page is still loading: one
   * frame with everything showing (the clay, the wire and the glass are hidden at the opening, so their programs would
   * otherwise compile mid-scroll) and the dim pass on, then one with the dim pass off (the output pass then draws to the
   * screen, a different program from drawing to a target). Run after the clip planes are on the materials: three keys a
   * program on how many planes it has. Draws at 16 x 16, then leaves the rig as it found it.
   */
  private warm(): void {
    const cam = this.camera;
    const glassWas = this.glassBall.visible;
    this.resize(16, 16, 1);
    cam.position.set(0, 0, 3); // (in front of the pendant: an object outside the view is never compiled)
    cam.updateMatrixWorld(true);
    this.clay.visible = true;
    this.wire.visible = true;
    this.glassBall.visible = true;
    this.glassBall.position.set(0, 0, 0);
    this.glassBall.scale.setScalar(0.2);
    for (const dimOn of [true, false]) {
      this.dimPass.enabled = dimOn;
      this.composer.render();
    }
    this.glassBall.visible = glassWas;
    this.dimPass.enabled = false;
    cam.position.set(0, 0, 0);
    cam.updateMatrixWorld(true);
  }

  /** Sizes the canvas's drawing buffer to `vw` x `vh` CSS px at `dpr` (clamped to 2). The canvas's CSS size is the mount's. */
  resize(vw: number, vh: number, dpr: number): void {
    if (this.gone) return;
    const d = Math.min(2, Math.max(0.5, dpr));
    this.vw = Math.max(1, vw);
    this.vh = Math.max(1, vh);
    this.renderer.setPixelRatio(d);
    this.renderer.setSize(this.vw, this.vh, false);
    this.composer.setPixelRatio(d);
    this.composer.setSize(this.vw, this.vh);
    this.camera.aspect = this.vw / this.vh;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Draws one frame from the camera as `poseRig` posed it. `glass`: the testimonials' ball (centre as a share of the
   * viewport, radius as a share of its height), or null when it isn't on screen. `dim`: 0..1 brightness.
   */
  draw(f: Frame, glass: GlassSlot | null, dim: number): void {
    if (this.gone) return;
    const cam = this.camera;
    const dist = distanceFor(f.h, f.fov);

    // the build passes: a sweep left to right across the pendant on screen
    const { eA, eB, building } = buildEdges(f.wire);
    this.clay.visible = building;
    this.wire.visible = building;
    if (building) {
      const right = this.right.set(1, 0, 0).applyQuaternion(cam.quaternion);
      this.wireClip.set(right, -eA);
      this.clayClipLeft.set(right, -eB);
      this.clayClipRight.set(this.tmp.copy(right).negate(), eA);
      this.brassClip.set(this.tmp.copy(right).negate(), eB);
    } else {
      this.brassClip.constant = CLIP_OFF; // (parked: clips nothing)
    }

    // the glass: a sphere between the camera and the pendant, exactly over the slot
    const showGlass = glass !== null && f.glass > GLASS_MIN;
    this.glassBall.visible = showGlass;
    if (showGlass) {
      const gd = dist * GLASS_AT;
      this.tmp.set(glass.x * 2 - 1, 1 - glass.y * 2, 0.5).unproject(cam).sub(cam.position).normalize();
      this.glassBall.position.copy(cam.position).addScaledVector(this.tmp, gd);
      this.glassBall.scale.setScalar(glass.r * 2 * gd * Math.tan(f.fov * D / 2) * f.glass);
      this.glassBall.updateMatrixWorld();
    }

    // depth of field, focused on the aim point
    this.bokeh.materialBokeh.uniforms.focus.value = dist;
    this.bokeh.materialBokeh.uniforms.aperture.value = f.aperture;
    this.bokeh.materialBokeh.uniforms.maxblur.value = MAX_BLUR;

    // behind the words it dims, so they stay easy to read
    const d = Math.min(1, Math.max(0, dim));
    this.dimPass.uniforms.dim.value = d;
    this.dimPass.enabled = d < 0.999;

    this.composer.render();
  }

  /** Does the pendant (the full mesh) lie under this point? `x`, `y`: CSS px from the canvas's top-left. Uses the pose of
   *  the last `draw`. */
  hit(x: number, y: number): boolean {
    if (this.gone) return false;
    this.ndc.set((x / this.vw) * 2 - 1, 1 - (y / this.vh) * 2);
    this.ray.setFromCamera(this.ndc, this.camera);
    return this.ray.intersectObject(this.brass, false).length > 0;
  }

  /** Frees the GPU: geometries, materials, textures, render targets, the composer and the renderer. */
  dispose(): void {
    if (this.gone) return;
    this.gone = true;
    for (const p of [this.renderPass, this.bokeh, this.outputPass, this.dimPass]) p.dispose();
    this.composer.dispose();
    for (const o of this.disposables) o.dispose();
    // (the clay's material and the loader's own are in `disposables`; the brass's geometry is shared with the clay's)
    (this.brass.geometry as BufferGeometry).dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss(); // (the canvas can't be given a new context: the mount makes a fresh canvas)
  }
}
