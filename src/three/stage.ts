import * as THREE from "three";
import { stepFrame } from "./stage-frame";
import { GrainGovernor } from "./quality";
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
  /** Replaces the plain render (layered compositing, e.g. the sand's pixel filter). */
  renderFrame: ((renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) => void) | null = null;
  private readonly tierChanges = new Set<(s: TierSettings) => void>();
  /** The grains, then the sharpness, follow the frame time, both ways (quality.ts GrainGovernor). */
  private readonly grainGov: GrainGovernor;
  /** ?governor=0 holds the starting grains and sharpness (diagnostics: measure their real cost). */
  private readonly governorOn = typeof window === "undefined" || new URLSearchParams(window.location.search).get("governor") !== "0";
  /** Something opaque covers the whole canvas (the phones' project list): the frame callbacks run, nothing is drawn, and
   *  the governor doesn't read the frame times (an undrawn frame says nothing about the sand's cost). */
  covered = false;
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
    const base = settingsFor(tier, window.devicePixelRatio || 1);
    this.grainGov = new GrainGovernor(
      // (the count held: changing it resizes every grain (its look follows the count), a visible jump mid-scroll)
      { min: base.grainsStart, max: base.grainsStart, start: base.grainsStart },
      { min: base.pixelRatioMin, max: base.pixelRatio, start: base.pixelRatio },
    );
    this.settings = { ...base, grains: this.grainGov.grains };
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
    // (a resize clears the canvas after the frame was drawn: draw again, so it never shows a black frame)
    this.resizeObserver = new ResizeObserver(() => { this.resize(); if (this.running) this.draw(); });
    this.resizeObserver.observe(canvas);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.resize();
  }

  /** Vertical field of view for the current aspect (at the current lens, or `lensMm`). Exact framing reproduces Blender's
   *  horizontal fit. */
  vfovFor(aspect: number, lensMm?: number): number {
    let tanH = lensMm ? this.sensorMm / 2 / lensMm : Math.tan(this.hfov / 2);
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

  private readonly crashes = new Set<(err: unknown) => void>();
  /** A frame threw: the loop has stopped (stage-frame.ts). */
  onCrash(cb: (err: unknown) => void): () => void {
    this.crashes.add(cb);
    return () => this.crashes.delete(cb);
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
      // the governor's step first, then the frame: a resize clears the canvas, so one made after the draw showed a black
      // frame (Liam, 2026-10-11: "random blackout frames" over the desk, where the governor steps)
      const next = this.governorOn && !this.covered ? this.grainGov.sample(frameMs) : null;
      if (next) {
        const sharper = next.pixelRatio !== this.settings.pixelRatio;
        this.settings = { ...this.settings, grains: next.grains, pixelRatio: next.pixelRatio };
        if (sharper) {
          this.renderer.setPixelRatio(next.pixelRatio);
          this.resize();
        } else this.tierChanges.forEach((cb) => cb(this.settings));
      }
      const err = stepFrame(this.frames, dt, now / 1000, () => { if (!this.covered) this.draw(); });
      if (err) {
        this.stop();
        console.error("stage: a frame failed", err);
        this.crashes.forEach((cb) => cb(err));
        return;
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
    this.draw();
  }

  private draw(): void {
    if (this.renderFrame) this.renderFrame(this.renderer, this.scene, this.camera);
    else this.renderer.render(this.scene, this.camera);
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
