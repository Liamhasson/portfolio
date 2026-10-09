import * as THREE from "three";
import { QualityGovernor } from "./quality";
import { settingsFor, type QualityTier, type TierSettings } from "./tier";

export interface StageCamera {
  position: [number, number, number];
  target: [number, number, number];
  lensMm: number;
  sensorMm: number;
  /** The aspect the Blender render was framed at (horizontal sensor fit). */
  renderAspect: number;
}

export type FrameCallback = (dt: number, now: number) => void;

/**
 * One fixed WebGL canvas: renderer, camera, loop, resize, visibility pause and the frame-time governor.
 * Plain TypeScript on three.js (no React Three Fiber), as planned in phase 2a.
 */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  settings: TierSettings;
  private readonly frames = new Set<FrameCallback>();
  private readonly tierChanges = new Set<(s: TierSettings) => void>();
  private readonly governor: QualityGovernor;
  private raf = 0;
  private last = 0;
  private running = false;
  private readonly resizeObserver: ResizeObserver;
  private hfov: number;
  private readonly sensorMm: number;
  private readonly renderAspect: number;

  constructor(
    readonly canvas: HTMLCanvasElement,
    cam: StageCamera,
    tier: QualityTier,
    private readonly exactFraming = false,
  ) {
    this.settings = settingsFor(tier, window.devicePixelRatio || 1);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.settings.antialias,
      powerPreference: "high-performance",
      alpha: false,
    });
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.toneMapping = THREE.AgXToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(this.settings.pixelRatio);
    this.camera.position.set(...cam.position);
    this.camera.lookAt(new THREE.Vector3(...cam.target));
    this.sensorMm = cam.sensorMm;
    this.hfov = 2 * Math.atan(cam.sensorMm / 2 / cam.lensMm);
    this.renderAspect = cam.renderAspect;
    this.governor = new QualityGovernor(tier);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.resize();
  }

  /** Vertical field of view for the current aspect. Exact framing reproduces Blender's horizontal fit. */
  vfovFor(aspect: number): number {
    let tanH = Math.tan(this.hfov / 2);
    // Portrait (phones): narrow the view so the ball keeps ~65% of the width; the chaos overflows the edges.
    // A lab stand-in: the real responsive framing comes with the hero layout.
    if (!this.exactFraming && aspect < 1) tanH *= 1 - 0.58 * Math.min((1 - aspect) / 0.55, 1);
    // Blender: horizontal fit. Wider screens keep the render's vertical framing (more void at the sides).
    const fitAspect = this.exactFraming ? aspect : Math.min(aspect, this.renderAspect);
    return 2 * Math.atan(tanH / fitAspect);
  }

  resize(): void {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = THREE.MathUtils.radToDeg(this.vfovFor(w / h));
    this.camera.updateProjectionMatrix();
    this.tierChanges.forEach((cb) => cb(this.settings));
  }

  /** Put the camera on a path frame (camera moves): position, orientation and lens. */
  setView(position: THREE.Vector3, quaternion: THREE.Quaternion, lensMm: number): void {
    this.camera.position.copy(position);
    this.camera.quaternion.copy(quaternion);
    this.hfov = 2 * Math.atan(this.sensorMm / 2 / lensMm);
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    this.camera.fov = THREE.MathUtils.radToDeg(this.vfovFor(w / h));
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }

  /** Device pixels of the drawing buffer's height (for point sizes). */
  get bufferHeight(): number {
    return this.renderer.domElement.height;
  }

  onFrame(cb: FrameCallback): () => void {
    this.frames.add(cb);
    return () => this.frames.delete(cb);
  }

  /** Called on start, on resize and whenever the governor steps the tier down. */
  onSettings(cb: (s: TierSettings) => void): () => void {
    this.tierChanges.add(cb);
    cb(this.settings);
    return () => this.tierChanges.delete(cb);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min((now - this.last) / 1000, 0.1);
      const frameMs = now - this.last;
      this.last = now;
      this.frames.forEach((cb) => cb(dt, now / 1000));
      this.renderer.render(this.scene, this.camera);
      const next = this.governor.sample(frameMs);
      if (next) {
        this.settings = settingsFor(next, window.devicePixelRatio || 1);
        this.renderer.setPixelRatio(this.settings.pixelRatio);
        this.resize();
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Render once now (compare captures). */
  renderOnce(): void {
    this.frames.forEach((cb) => cb(0, performance.now() / 1000));
    this.renderer.render(this.scene, this.camera);
  }

  private onVisibility = () => {
    if (document.hidden) this.stop();
    else this.start();
  };

  dispose(): void {
    this.stop();
    this.resizeObserver.disconnect();
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.renderer.dispose();
  }
}
