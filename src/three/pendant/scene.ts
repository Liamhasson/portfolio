// src/three/pendant/scene.ts
/**
 * The pendant's scene (spec 2026-10-16-about-pendant-design.md §3, §6): Liam's worn-brass Brahma pendant on a see-through
 * canvas over (or under) the About page. Plain three.js: no React, no DOM beyond the canvas.
 *   - lights ride with the camera (a warm key, a rose rim, a dim cool fill) over a PMREM'd RoomEnvironment;
 *   - the build passes (brass | clay | wire) are clipping planes along the camera's right vector;
 *   - depth of field is three's BokehPass with its "alpha = 1" line removed, so the page shows through the blur (bokeh.ts:
 *     it can run at half resolution, the governor's last step, setBokehScale);
 *   - the dimming (behind the words) is a ShaderPass, never a CSS filter: a CSS filter on a canvas costs a compositor
 *     layer every frame;
 *   - motion blur (motion-blur.ts) right after the depth of field, on the fast moves only: the pass is off while the
 *     longest smear is under a pixel;
 *   - the testimonials' glass ball is a pass after the motion blur (glass.ts): a true sphere, ray-traced per pixel, that
 *     looks up the pendant behind it in a zoomed render of it, so the pendant reads sharp, magnified and upside down in it
 *     (after the blur, so neither the ball nor its lens view is ever smeared).
 * The mount (Task 7) poses the rig itself, `poseRig(f, motion, t, look, vw, vh, scene.camera, scene.outer, scene.inner)`,
 * then calls `draw`. `draw` never moves the camera: it draws from the camera as posed.
 */
import {
  AgXToneMapping, Box3, DirectionalLight, HalfFloatType, Mesh, MeshBasicMaterial, MeshStandardMaterial, NoColorSpace, Object3D,
  Matrix4, PMREMGenerator, PerspectiveCamera, Plane, Raycaster, Scene, ShaderChunk, SRGBColorSpace, DoubleSide, TextureLoader, Vector2,
  Vector3, WebGLRenderer, WebGLRenderTarget,
} from "three";
import type { BufferGeometry, Material, Texture } from "three";
import type { Rgb } from "@/lib/about-glass";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { distanceFor } from "./camera";
import { GLASS_MAG, glassAt, glassMaterial, LENS_DENSITY, LENS_SPAN } from "./glass";
import { ScaledBokehPass } from "./bokeh";
import { MotionBlurPass, SHUTTER } from "./motion-blur";
import { buildEdges, patchBokeh, patchOutput, patchShadingR170 } from "./passes";
import type { Frame } from "./shots";

/** Cache-busting token for the pendant's files (Liam's browser keeps old ones: bump it whenever a file in
 *  public/about/pendant changes). */
export const PENDANT_VERSION = "2026-10-16.4";

const BASE = "/about/pendant/";
const D = Math.PI / 180;
/** The depth-of-field blur's ceiling (a share of the screen). */
const MAX_BLUR = 0.012;
/** Below this the glass is faded out: not drawn at all. */
const GLASS_MIN = 0.02;
/** The rim light (brief: a DirectionalLight behind the ball, intensity 1.2), tinted by the testimonials' edge colour. */
const RIM_INTENSITY = 1.2;
/** Where it stands, as seen from the ball: behind it, a little to the right and up (toward Andrada's quote), so the colour
 *  catches the rim as an arc, heavier on one side, not a ring. Camera space. */
const RIM_FROM = new Vector3(0.38, 0.18, -1).normalize();
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

/** One frame's step, for the motion blur: `dt` (s) scales the smear to a 1/60 s shutter; `reset` after a jump the mount
 *  knows of (a scroll jump, a new solve, the loop resuming), so the move from the last frame isn't smeared; `tag` labels
 *  the frame's GPU time when timing is on (enableGpuTiming). */
export interface DrawStep {
  dt: number;
  reset?: boolean;
  tag?: number;
}

/** The GPU timer (EXT_disjoint_timer_query_webgl2): a query per frame round the frame's draws, read back a few frames on. */
interface GpuTimer {
  gl: WebGL2RenderingContext;
  ext: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number };
  pending: { q: WebGLQuery; tag: number }[];
  done: { ms: number; tag: number }[];
}

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
  /** The pendant's outline: every vertex of the low-poly wire copy (about 5k), xyz in `inner`'s space. The readability
   *  solve (solve.ts) projects these instead of the bounds' eight corners, which in strong perspective cover far more of the
   *  screen than the pendant does. */
  readonly outline: Float32Array;
  /** How much of the cursor's lean to keep while filmed through the glass: the ball turns the pendant's every move upside
   *  down and GLASS_MAG times larger, so at 1 / GLASS_MAG its image swings as far as the pendant leans anywhere else (the
   *  full lean would swing it into the ball's rim). The mount blends to this by the shot's `glass`. */
  readonly glassLook = 1 / GLASS_MAG;

  private readonly renderer: WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly bokeh: ScaledBokehPass;
  private readonly dimPass: ShaderPass;
  private readonly outputPass: OutputPass;
  private readonly renderPass: RenderPass;
  private readonly glassPass: ShaderPass;
  private readonly blur: MotionBlurPass;
  /** The motion blur's view-projection for this frame. */
  private readonly viewProj = new Matrix4();
  private timer: GpuTimer | null = null;
  private readonly glass: ReturnType<typeof glassMaterial>;
  /** Behind the ball, lighting only its rim (it is never added to the scene: the brass's lights and look stay as approved). */
  readonly rimLight = new DirectionalLight(0xffffff, 0);
  /** The lens view (glass.ts): the pendant drawn again, zoomed onto the ball, for the magnified image inside it. */
  private readonly lensTarget: WebGLRenderTarget;
  private readonly lensCam = new PerspectiveCamera();
  private readonly scene: Scene;
  private dpr = 1;
  private readonly brass: Mesh;
  private readonly clay: Mesh;
  private readonly wire: Object3D;
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
  private readonly fwd = new Vector3();
  private readonly centre = new Vector3();
  private readonly zoom = new Matrix4();

  private constructor(
    renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera, outer: Object3D, inner: Object3D, bounds: Box3,
    brass: Mesh, clay: Mesh, wire: Object3D, disposables: { dispose(): void }[], hiDpi: boolean,
    outline: Float32Array,
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.outline = outline;
    this.camera = camera;
    this.outer = outer;
    this.inner = inner;
    this.bounds = bounds;
    this.brass = brass;
    this.clay = clay;
    this.wire = wire;
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
    // (bokeh.ts: three's BokehPass, with a half-resolution step for the governor that never resizes the canvas)
    this.bokeh = new ScaledBokehPass(scene, camera, { focus: 3, aperture: 0.001, maxblur: MAX_BLUR });
    // (see passes.ts: alpha left alone, and no blur where nothing is drawn, so the see-through canvas gets no halo)
    this.bokeh.materialBokeh.fragmentShader = patchBokeh(this.bokeh.materialBokeh.fragmentShader);
    this.bokeh.materialBokeh.needsUpdate = true;
    this.composer.addPass(this.bokeh);
    // motion blur after the depth of field and before the glass, so the ball and its lens view stay crisp; it honours the
    // build's clipping planes (the same Plane objects), and is off until a frame moves enough to smear
    const wireMeshes: Mesh[] = [];
    wire.traverse((o) => { if ((o as Mesh).isMesh) wireMeshes.push(o as Mesh); });
    this.blur = new MotionBlurPass(scene, camera, inner, [
      { mesh: brass, clippingPlanes: [this.brassClip] },
      { mesh: clay, clippingPlanes: [this.clayClipLeft, this.clayClipRight] },
      ...wireMeshes.map((mesh) => ({ mesh, clippingPlanes: [this.wireClip], wireframe: true })),
    ], outline);
    this.blur.enabled = false;
    this.composer.addPass(this.blur);
    // the glass after the depth of field, so the bokeh's depth pass never sees it (the focus stays on the pendant behind it)
    // and its blur never softens the pendant inside it; off while no ball is on screen
    this.lensTarget = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: hiDpi ? 0 : 4 });
    this.glass = glassMaterial();
    this.glass.uniforms.tLens.value = this.lensTarget.texture;
    this.glassPass = new ShaderPass(this.glass);
    this.glassPass.enabled = false;
    this.composer.addPass(this.glassPass);
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
      // (r186 moved the whole room 3.5 down, so its lights sit lower round the capture point and stripe the flutes; Liam
      // approved the brass lit by r170's room: put it back. See passes.ts, patchShadingR170, for the rest of the r170 look.)
      room.position.y = 0;
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
      // (shaded as three r170 shaded it, the look Liam approved: see passes.ts)
      (brass.material as Material).onBeforeCompile = (shader) => {
        shader.fragmentShader = patchShadingR170(shader.fragmentShader, ShaderChunk);
      };
      // (its own program: three must never share a compiled program between the patched brass and a plain standard material)
      (brass.material as Material).customProgramCacheKey = () => "pendant-brass-r170";
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
      // (outer and inner are still at rest here, so world space is inner's space)
      const pts: number[] = [];
      const v = new Vector3();
      for (const m of wireMeshes) {
        const pos = m.geometry.getAttribute("position");
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
          pts.push(v.x, v.y, v.z);
        }
      }
      const outline = new Float32Array(pts);

      for (const t of [color, normal, rough]) renderer.initTexture(t);
      const hiDpi = (typeof window !== "undefined" ? window.devicePixelRatio : 1) > 1.25;
      const built = new PendantScene(renderer, scene, camera, outer, inner, bounds, brass, clay, wireModel.scene, owned, hiDpi, outline);
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
   * frame with everything showing (the clay, the wire and the glass pass are off at the opening, so their programs would
   * otherwise compile mid-scroll) and the dim pass on, then one with the dim pass off (the output pass then draws to the
   * screen, a different program from drawing to a target). Run after the clip planes are on the materials: three keys a
   * program on how many planes it has. Draws at 16 x 16, then leaves the rig as it found it.
   */
  private warm(): void {
    const cam = this.camera;
    this.resize(16, 16, 1);
    cam.position.set(0, 0, 3); // (in front of the pendant: an object outside the view is never compiled)
    cam.updateMatrixWorld(true);
    this.clay.visible = true;
    this.wire.visible = true;
    this.glassPass.enabled = true;
    this.scene.updateMatrixWorld();
    this.viewProj.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    this.blur.track(this.viewProj, this.inner.matrixWorld, SHUTTER, true);
    this.blur.enabled = true;
    for (const dimOn of [true, false]) {
      this.dimPass.enabled = dimOn;
      this.composer.render();
    }
    this.bokeh.setScale(0.5); // (the governor's half-resolution bokeh: its program too)
    this.composer.render();
    this.bokeh.setScale(1);
    this.glassPass.enabled = false;
    this.blur.enabled = false;
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
    this.dpr = d;
    this.blur.pixelRatio = d; // (before the composer sizes its passes: the blur's cap and tiles are in CSS px)
    this.renderer.setPixelRatio(d);
    this.renderer.setSize(this.vw, this.vh, false);
    this.composer.setPixelRatio(d);
    this.composer.setSize(this.vw, this.vh);
    this.camera.aspect = this.vw / this.vh;
    this.camera.updateProjectionMatrix();
  }

  /** The depth of field's resolution, as a share of the frame's: 1, or 0.5 (the governor's last step, governor.ts). Never
   *  resizes the canvas or the composer. */
  setBokehScale(scale: 0.5 | 1): void {
    if (this.gone) return;
    this.bokeh.setScale(scale);
  }

  /**
   * Draws one frame from the camera as `poseRig` posed it. `glass`: the testimonials' ball (centre as a share of the
   * viewport, radius as a share of its height), or null when it isn't on screen (or the testimonials draw it). `dim`: 0..1
   * brightness. `rim`: the testimonials' edge colour at the ball (about-glass.ts `glassRim()`), or null for no rim light.
   * `step`: the frame's dt and whether the pose jumped (the motion blur).
   */
  draw(f: Frame, glass: GlassSlot | null, dim: number, rim: Rgb | null = null, step: DrawStep = { dt: SHUTTER }): void {
    if (this.gone) return;
    this.scene.updateMatrixWorld(); // (fresh matrices for the blur's estimate; the camera's inverse too)
    this.beginTimer(step.tag ?? 0);
    try {
      this.drawFrame(f, glass, dim, rim, step);
    } finally {
      this.endTimer(); // (a draw that throws must not leave the GPU query open: the next beginQuery would fail)
    }
  }

  private drawFrame(f: Frame, glass: GlassSlot | null, dim: number, rim: Rgb | null, step: DrawStep): void {
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

    // the glass: a sphere between the camera and the pendant, exactly over the slot, as far out as makes the pendant
    // behind it look GLASS_MAG times its size (upside down); it grows in with f.glass where it stands
    const showGlass = glass !== null && f.glass > GLASS_MIN;
    this.glassPass.enabled = showGlass;
    if (showGlass) this.placeGlass(glass, f, dist, rim);

    // depth of field, focused on the aim point
    this.bokeh.materialBokeh.uniforms.focus.value = dist;
    this.bokeh.materialBokeh.uniforms.aperture.value = f.aperture;
    this.bokeh.materialBokeh.uniforms.maxblur.value = MAX_BLUR;

    // behind the words it dims, so they stay easy to read
    const d = Math.min(1, Math.max(0, dim));
    this.dimPass.uniforms.dim.value = d;
    this.dimPass.enabled = d < 0.999;

    // motion blur: the move since the last frame, camera and pendant together (off while it smears under a pixel)
    this.viewProj.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    this.blur.enabled = this.blur.track(this.viewProj, this.inner.matrixWorld, step.dt, step.reset ?? false);

    this.composer.render();
    this.blur.setPrevious(this.viewProj, this.inner.matrixWorld);
  }

  /** The motion blur's last estimate: the longest smear (CSS px), whether it is drawn, and whether the frame jumped. */
  get blurState(): { smear: number; on: boolean; jump: boolean } {
    return { smear: this.blur.lastSmear, on: this.blur.enabled, jump: this.blur.lastJump };
  }

  /** Times each frame's GPU work (the lens view and the composer) from now on. False if the GPU can't (no extension). */
  enableGpuTiming(): boolean {
    if (this.gone) return false;
    if (this.timer) return true;
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const ext = gl.getExtension("EXT_disjoint_timer_query_webgl2") as GpuTimer["ext"] | null;
    if (!ext) return false;
    this.timer = { gl, ext, pending: [], done: [] };
    return true;
  }

  /** The GPU times (ms) read back since the last call, each with its frame's tag. */
  takeGpuTimes(): { ms: number; tag: number }[] {
    if (!this.timer) return [];
    const out = this.timer.done;
    this.timer.done = [];
    return out;
  }

  /** Reads back the finished queries and starts this frame's (called at the top of a frame's draws). */
  private beginTimer(tag: number): void {
    const t = this.timer;
    if (!t) return;
    const { gl, ext } = t;
    const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT) as boolean;
    while (t.pending.length) {
      const { q, tag: qt } = t.pending[0];
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      const ns = gl.getQueryParameter(q, gl.QUERY_RESULT) as number;
      if (!disjoint) t.done.push({ ms: ns / 1e6, tag: qt });
      gl.deleteQuery(q);
      t.pending.shift();
    }
    if (t.pending.length > 8) return; // (the GPU is far behind: skip timing this frame)
    const q = gl.createQuery();
    if (!q) return;
    gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
    t.pending.push({ q, tag });
    this.timing = true;
  }

  private timing = false;

  private endTimer(): void {
    if (!this.timer || !this.timing) return;
    this.timing = false;
    this.timer.gl.endQuery(this.timer.ext.TIME_ELAPSED_EXT);
  }

  /** The glass pass's uniforms for this frame: the ball, the camera it is seen from, the plane through the pendant, the rim. */
  private placeGlass(glass: GlassSlot, f: Frame, dist: number, rim: Rgb | null): void {
    const cam = this.camera;
    const u = this.glass.uniforms;
    const gd = dist * glassAt(glass.r, f.fov);
    this.tmp.set(glass.x * 2 - 1, 1 - glass.y * 2, 0.5).unproject(cam).sub(cam.position).normalize();
    this.centre.copy(cam.position).addScaledVector(this.tmp, gd);
    u.centre.value.copy(this.centre);
    u.radius.value = glass.r * 2 * gd * Math.tan((f.fov * D) / 2) * f.glass;
    u.camPos.value.copy(cam.position);
    u.camWorld.value.copy(cam.matrixWorld);
    u.projInv.value.copy(cam.projectionMatrixInverse);
    u.view.value.copy(cam.matrixWorldInverse);
    u.viewProj.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    // the plane through the pendant (it stands at the origin), square to the camera
    cam.getWorldDirection(this.fwd);
    u.planeNormal.value.copy(this.fwd);
    u.planePoint.value.set(0, 0, 0);
    this.drawLens(glass);
    // the rim light: behind the ball, its colour the testimonials' edge (none when they give none)
    const light = this.rimLight;
    light.intensity = rim ? RIM_INTENSITY : 0;
    if (rim) light.color.setRGB(rim[0], rim[1], rim[2], SRGBColorSpace);
    light.target.position.copy(this.centre);
    light.position.copy(RIM_FROM).transformDirection(cam.matrixWorld).multiplyScalar(gd).add(this.centre);
    u.rimDir.value.copy(light.position).sub(light.target.position).transformDirection(cam.matrixWorldInverse);
    u.rimColor.value.copy(light.color).multiplyScalar(light.intensity);
  }

  /**
   * The lens view: the scene drawn from the camera as posed, its projection zoomed onto a square LENS_SPAN x the ball's
   * full radius round the ball's centre on screen, at LENS_DENSITY pixels per screen pixel. The same view as the frame,
   * only sharper where the ball magnifies it, so the glass pass looks the pendant up here and falls back to the frame.
   */
  private drawLens(glass: GlassSlot): void {
    const cam = this.camera, lens = this.lensCam, r = this.renderer;
    const halfPx = LENS_SPAN * glass.r * this.vh; // (CSS px; the full radius, so the view holds still as the ball grows in)
    const size = Math.min(2048, Math.max(256, Math.ceil((2 * halfPx * this.dpr * LENS_DENSITY) / 64) * 64));
    if (this.lensTarget.width !== size) this.lensTarget.setSize(size, size);
    cam.matrixWorld.decompose(lens.position, lens.quaternion, lens.scale);
    // NDC zoom: x' = (x - cx) / sx, applied to clip space (before the divide) as rows 0 and 1 minus cx, cy times row 3
    const cx = glass.x * 2 - 1, cy = 1 - glass.y * 2, sx = halfPx / (this.vw / 2), sy = halfPx / (this.vh / 2);
    this.zoom.set(1 / sx, 0, 0, -cx / sx, 0, 1 / sy, 0, -cy / sy, 0, 0, 1, 0, 0, 0, 0, 1);
    lens.projectionMatrix.multiplyMatrices(this.zoom, cam.projectionMatrix);
    lens.projectionMatrixInverse.copy(lens.projectionMatrix).invert();
    lens.updateMatrixWorld(true);
    this.glass.uniforms.lensViewProj.value.multiplyMatrices(lens.projectionMatrix, lens.matrixWorldInverse);
    const was = r.getRenderTarget();
    r.setRenderTarget(this.lensTarget);
    r.clear();
    r.render(this.scene, lens);
    r.setRenderTarget(was);
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
    if (this.timer) for (const { q } of this.timer.pending) this.timer.gl.deleteQuery(q);
    this.timer = null;
    for (const p of [this.renderPass, this.bokeh, this.blur, this.glassPass, this.outputPass, this.dimPass]) p.dispose(); // (a shader pass frees its material)
    this.composer.dispose();
    this.lensTarget.dispose();
    for (const o of this.disposables) o.dispose();
    // (the clay's material and the loader's own are in `disposables`; the brass's geometry is shared with the clay's)
    (this.brass.geometry as BufferGeometry).dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss(); // (the canvas can't be given a new context: the mount makes a fresh canvas)
  }
}
