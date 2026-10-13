import * as THREE from "three";
import { Pencil } from "./pencil";
import type { NotePose } from "./desk-notes";
import type { Story } from "./stories";

/**
 * A note's story (Liam, 2026-10-13/14, approved as mockups): the clicked note comes off the desk to the camera (never
 * the camera to the note: the shot only moves forward), squares up in a crisp selection frame (the design motif) with
 * straight guides, glued along its top and loose below. The insight is written first, above it; then four pencil
 * sketches join a tilted circle around it one by one, each drawn as its place passes the front (sharp, largest), at
 * one even, slow pace throughout. The circle's near half passes in front of the note, its far half behind it (hidden by
 * the paper, softened by the lens, passing behind the insight). Scroll, a click or Esc puts the note back.
 *
 * Layout in the mockups' frame (1600 x 1000), scaled to the window.
 */
const ORBIT = { speed: 11 * Math.PI / 180, ry: 290 };
const START = 1.5, DRAW = 2.2, GAP = Math.PI / 2 / ORBIT.speed, INSIGHT = { at: 0.3, draw: 1.1 };
const FLY = { in: 0.95, out: 0.8, fade: 0.35 };
const SHAPE = { sticky: { hw: 150, hh: 150, rx: 600, noteDy: -20, orbitDy: 35 }, card: { hw: 200, hh: 120, rx: 575, noteDy: -30, orbitDy: 45 } } as const;
const LINE = "rgb(230,191,174)";
const SHEET = 1400;   // a sketch's canvas (px), its units at Pencil.S px each, centred

const smooth = (x: number) => { const t = Math.min(Math.max(x, 0), 1); return t * t * (3 - 2 * t); };
const easeInOut = (x: number) => { const t = Math.min(Math.max(x, 0), 1); return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2; };

interface Sheet { canvas: HTMLCanvasElement; pencil: Pencil; seed: number; total: number; drawn: number; draw(p: Pencil): void }

type Phase = "idle" | "in" | "story" | "fade" | "out";

export class NoteStoryPlayer {
  readonly el: HTMLDivElement;
  private readonly guides: SVGSVGElement;
  private readonly sel: SVGSVGElement;
  private readonly back: HTMLCanvasElement;
  private readonly front: HTMLCanvasElement;
  private readonly noteCanvas: HTMLCanvasElement;
  private readonly shadow: HTMLDivElement;
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly scene = new THREE.Scene();
  private readonly cam = new THREE.PerspectiveCamera();
  private mesh: THREE.Mesh | null = null;
  private base: Float32Array | null = null;
  private readonly tooth: HTMLCanvasElement;
  private readonly inks = new Map<string, HTMLImageElement>();
  private story: Story | null = null;
  private sheets: Sheet[] = [];
  private insight: Sheet | null = null;
  private phase: Phase = "idle";
  private clock = 0;   // seconds in the phase
  private storyT = 0;  // seconds since the note arrived
  private raf = 0;
  private last = 0;
  private from = { pos: new THREE.Vector3(), q: new THREE.Quaternion() };
  private to = { pos: new THREE.Vector3(), q: new THREE.Quaternion() };
  private noteH = 1;
  private onDone: (() => void) | null = null;
  private backTo: (() => NotePose | null) | null = null;
  private readonly reduced: boolean;
  private L = { W: 1, H: 1, k: 1, dpr: 1, nx: 0, ny: 0, hw: 0, hh: 0, ox: 0, oy: 0, rx: 0, ry: 0, iy: 0 };

  constructor(private readonly font: string, parent: HTMLElement = document.body) {
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = document.createElement("div");
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.style.cssText = "position:fixed;inset:0;z-index:40;display:none;cursor:pointer;";
    const layer = (tag: string, css = "") => { const e = document.createElement(tag); e.setAttribute("aria-hidden", "true"); (e as HTMLElement).style.cssText = `position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;${css}`; el.appendChild(e); return e; };
    this.guides = document.createElementNS("http://www.w3.org/2000/svg", "svg"); this.guides.setAttribute("aria-hidden", "true"); this.guides.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:0;transition:opacity .4s"; el.appendChild(this.guides);
    this.back = layer("canvas", "transition:opacity .35s") as HTMLCanvasElement;
    this.shadow = layer("div", "width:auto;height:auto;border-radius:30%;background:rgba(0,0,0,.55);filter:blur(28px);opacity:0;transition:opacity .4s") as HTMLDivElement;
    this.noteCanvas = layer("canvas") as HTMLCanvasElement;
    this.sel = document.createElementNS("http://www.w3.org/2000/svg", "svg"); this.sel.setAttribute("aria-hidden", "true"); this.sel.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:0;transition:opacity .4s"; el.appendChild(this.sel);
    this.front = layer("canvas", "transition:opacity .35s") as HTMLCanvasElement;
    parent.appendChild(el);
    this.el = el;
    // graphite's tooth: lines catch the paper's grain and break up a little along their length
    this.tooth = document.createElement("canvas"); this.tooth.width = this.tooth.height = 512;
    const tx = this.tooth.getContext("2d")!, id = tx.createImageData(512, 512);
    let s = 99;
    for (let i = 0; i < id.data.length; i += 4) { s = (s * 16807) % 2147483647; const v = s / 2147483647; id.data[i] = id.data[i + 1] = id.data[i + 2] = 255; id.data[i + 3] = 255 * (v < 0.18 ? 0.15 : 0.55 + 0.45 * v); }
    tx.putImageData(id, 0, 0);
  }

  get isOpen(): boolean { return this.phase !== "idle"; }

  /** Loads the notes' handwriting and the hand's font ahead of the first click. */
  async preload(stories: Story[]): Promise<void> {
    await Promise.all([
      document.fonts.load(`40px ${this.font}`).catch(() => {}),
      ...stories.map(async (s) => { if (this.inks.has(s.ink)) return; const img = new Image(); img.src = s.ink; await img.decode().catch(() => {}); this.inks.set(s.ink, img); }),
    ]);
  }

  /**
   * Opens a story: the note starts where it lies (its pose in the world, seen by `camera`) and comes to the frame.
   * `backTo` gives its pose again for the way back; `onDone` runs once it lies on the desk again.
   */
  open(story: Story, pose: NotePose, camera: THREE.PerspectiveCamera, backTo: () => NotePose | null, onDone: () => void): void {
    if (this.phase !== "idle") return;
    this.story = story; this.onDone = onDone; this.backTo = backTo;
    this.el.style.display = "block";
    this.el.setAttribute("aria-label", "A note from the desk, and the story behind it. Click or press Escape to put it back.");
    this.layout();
    this.cam.fov = camera.fov; this.cam.aspect = this.L.W / this.L.H; this.cam.near = camera.near; this.cam.far = camera.far; this.cam.updateProjectionMatrix();
    this.buildNote(story, pose);
    this.poseFrom(pose, camera, this.from);
    this.mesh!.position.copy(this.from.pos); this.mesh!.quaternion.copy(this.from.q);
    this.endPose();
    this.buildSheets(story);
    this.drawFrame();
    this.phase = this.reduced ? "story" : "in";
    this.clock = 0; this.storyT = this.reduced ? START + 3 * GAP + DRAW + 1 : 0;
    if (this.reduced) { this.mesh!.position.copy(this.to.pos); this.mesh!.quaternion.copy(this.to.q); this.showChrome(true); }
    this.back.style.opacity = this.front.style.opacity = "1";
    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.tick);
  }

  /** Puts the note back: the story fades, then the note returns to the desk. */
  close(): void {
    if (this.phase !== "in" && this.phase !== "story") return;
    this.phase = "fade"; this.clock = 0;
    this.showChrome(false);
    this.back.style.opacity = this.front.style.opacity = "0";
  }

  private showChrome(on: boolean): void {
    for (const e of [this.guides, this.sel, this.shadow] as (HTMLElement | SVGSVGElement)[]) e.style.opacity = on ? "1" : "0";
  }

  private layout(): void {
    const W = window.innerWidth, H = window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
    const shape = SHAPE[this.story!.shape];
    // the mockups' frame fitted to the window
    const k = Math.min(W / 1600, H / 1000);
    const nx = W / 2, ny = H / 2 + shape.noteDy * k;
    this.L = { W, H, k, dpr, nx, ny, hw: shape.hw * k, hh: shape.hh * k, ox: nx, oy: ny + shape.orbitDy * k, rx: Math.min(shape.rx * k, W / 2 - 200 * k), ry: ORBIT.ry * k, iy: ny - shape.hh * k - 112 * k };
    for (const c of [this.back, this.front]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    this.shadow.style.left = `${nx - this.L.hw * 0.9}px`; this.shadow.style.top = `${ny - this.L.hh * 0.55}px`;
    this.shadow.style.width = `${this.L.hw * 1.8}px`; this.shadow.style.height = `${this.L.hh * 1.8}px`;
    if (!this.renderer) {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.noteCanvas, alpha: true, antialias: true });
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
      const key = new THREE.DirectionalLight(0xffe6cc, 2.9); key.position.set(-0.42, 0.62, 0.26); this.scene.add(key);
    }
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(W, H, false);
  }

  /** The note as a sheet of paper: its colour, its handwriting, its real size. */
  private buildNote(story: Story, pose: NotePose): void {
    if (this.mesh) { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); ((this.mesh.material as THREE.MeshStandardMaterial).map)?.dispose(); (this.mesh.material as THREE.Material).dispose(); }
    const card = story.shape === "card", tw = card ? 1700 : 1024, th = card ? 1020 : 1024;
    const tc = document.createElement("canvas"); tc.width = tw; tc.height = th;
    const x = tc.getContext("2d")!, gr = x.createLinearGradient(0, 0, tw, th);
    gr.addColorStop(0, story.paper[0]); gr.addColorStop(1, story.paper[1]); x.fillStyle = gr; x.fillRect(0, 0, tw, th);
    const ink = this.inks.get(story.ink);
    if (ink?.complete && ink.naturalWidth) x.drawImage(ink, 0, 0, tw, th);
    const tex = new THREE.CanvasTexture(tc); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const geo = new THREE.PlaneGeometry(pose.w, pose.h, card ? 60 : 48, card ? 36 : 48);
    this.base = Float32Array.from(geo.attributes.position.array as Float32Array);
    this.noteH = pose.h;
    this.mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, side: THREE.DoubleSide }));
    this.scene.add(this.mesh);
  }

  /** A world pose as seen from `camera`, into this view (the camera at the origin, looking down -z). */
  private poseFrom(pose: NotePose, camera: THREE.Camera, out: { pos: THREE.Vector3; q: THREE.Quaternion }): void {
    camera.updateMatrixWorld();
    const inv = camera.matrixWorldInverse;
    out.pos.copy(pose.centre).applyMatrix4(inv);
    const r = pose.right.clone().transformDirection(inv), u = pose.up.clone().transformDirection(inv), n = pose.normal.clone().transformDirection(inv);
    out.q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, u, n));
  }

  /** Where it comes to: squared to the screen, filling the frame. */
  private endPose(): void {
    const { H, ny, hh } = this.L, t = Math.tan(THREE.MathUtils.degToRad(this.cam.fov) / 2);
    const D = (this.noteH * H) / (2 * t * (2 * hh));
    this.to.pos.set(0, (1 - (2 * ny) / H) * D * t, -D);
    this.to.q.identity();
  }

  /** Glued along the top, loose below: the lower part lifts toward the lens, ripples and sways (the mockup's, scaled). */
  private bend(t: number, amount: number): void {
    if (!this.mesh || !this.base) return;
    const pos = this.mesh.geometry.attributes.position as THREE.BufferAttribute, b = this.base, h = this.noteH, u = h / 300;
    for (let i = 0; i < pos.count; i++) {
      const px = b[i * 3], py = b[i * 3 + 1], s = Math.max(0, h / 2 - 0.1 * h - py) / (0.9 * h);
      const lift = 44 + 16 * Math.sin(t * 1.25);
      const z = (lift * s * s + 9 * s * Math.sin((px / u) * 0.016 - t * 1.9) + 4 * s * Math.sin((py / u) * 0.02 + t * 1.1)) * u * amount;
      pos.setXYZ(i, px + 7 * s * s * Math.sin(t * 0.9 + 0.4) * u * amount, py, z);
    }
    pos.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }

  private makeSheet(seed: number, draw: (p: Pencil) => void): Sheet {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = SHEET;
    const ctx = canvas.getContext("2d")!;
    const pencil = new Pencil(ctx);
    pencil.font = this.font;
    ctx.translate(SHEET / 2, SHEET / 2); ctx.strokeStyle = ctx.fillStyle = LINE; ctx.lineCap = "round";
    // count its marks without drawing them (the draw-on's length)
    pencil.reset(seed, 0); draw(pencil);
    return { canvas, pencil, seed, total: pencil.used, drawn: 0, draw };
  }

  private buildSheets(story: Story): void {
    this.insight = this.makeSheet(story.insight.seed, story.insight.draw);
    this.sheets = story.steps.map((st) => this.makeSheet(st.seed, (p) => { if (st.dy) p.ctx.translate(0, st.dy * p.S); st.draw(p); if (st.dy) p.ctx.translate(0, -st.dy * p.S); }));
  }

  /** Draws a sheet on to `share` of its marks: only the new ones (what's there stays). */
  private grow(sh: Sheet, share: number): void {
    const to = Math.round(Math.min(Math.max(share, 0), 1) * sh.total);
    if (to <= sh.drawn) return;
    sh.pencil.reset(sh.seed, to, sh.drawn);
    sh.draw(sh.pencil);
    sh.drawn = to;
  }

  /** The frame and the guides: crisp, straight, square to the screen. */
  private drawFrame(): void {
    const { W, H, nx, ny, hw, hh, k } = this.L, m = 10 * k;
    const e0 = nx - hw - m, e1 = nx + hw + m, f0 = ny - hh - m, f1 = ny + hh + m;
    const ns = "http://www.w3.org/2000/svg";
    const at = (el: Element, o: Record<string, string | number>) => { for (const key in o) el.setAttribute(key, String(o[key])); return el; };
    this.guides.innerHTML = ""; this.sel.innerHTML = "";
    for (const y of [f0, f1]) this.guides.appendChild(at(document.createElementNS(ns, "line"), { x1: 0, x2: W, y1: y, y2: y, stroke: LINE, "stroke-opacity": 0.2, "stroke-dasharray": "3 7" }));
    for (const x of [e0, e1]) this.guides.appendChild(at(document.createElementNS(ns, "line"), { x1: x, x2: x, y1: 0, y2: H, stroke: LINE, "stroke-opacity": 0.2, "stroke-dasharray": "3 7" }));
    this.sel.appendChild(at(document.createElementNS(ns, "rect"), { x: e0, y: f0, width: e1 - e0, height: f1 - f0, fill: "none", stroke: LINE, "stroke-opacity": 0.75, "stroke-width": 1 }));
    for (const [x, y] of [[e0, f0], [nx, f0], [e1, f0], [e1, ny], [e1, f1], [nx, f1], [e0, f1], [e0, ny]])
      this.sel.appendChild(at(document.createElementNS(ns, "rect"), { x: x - 4, y: y - 4, width: 8, height: 8, fill: "#120b0c", stroke: LINE, "stroke-width": 1.2 }));
  }

  private tick = (now: number): void => {
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    this.clock += dt;
    if (this.phase === "in") {
      const e = easeInOut(this.clock / FLY.in);
      this.mesh!.position.lerpVectors(this.from.pos, this.to.pos, e);
      this.mesh!.quaternion.slerpQuaternions(this.from.q, this.to.q, e);
      if (this.clock >= FLY.in) { this.phase = "story"; this.clock = 0; this.showChrome(true); }
    } else if (this.phase === "story") {
      this.storyT += dt;
    } else if (this.phase === "fade") {
      if (this.clock >= FLY.fade) {
        this.phase = "out"; this.clock = 0;
        const back = this.backTo?.();
        if (back) { this.from.pos.copy(this.mesh!.position); this.from.q.copy(this.mesh!.quaternion); this.poseFrom(back, this.liveCamera ?? this.cam, this.to); }
      }
    } else if (this.phase === "out") {
      const e = easeInOut(this.clock / FLY.out);
      this.mesh!.position.lerpVectors(this.from.pos, this.to.pos, e);
      this.mesh!.quaternion.slerpQuaternions(this.from.q, this.to.q, e);
      if (this.clock >= FLY.out) { this.finish(); return; }
    }
    // the paper: still while it travels, loose once it's up
    const settled = this.phase === "story" ? smooth(this.storyT / 0.8) : this.phase === "fade" ? 1 - smooth(this.clock / FLY.fade) : 0;
    this.bend(this.reduced ? 0 : this.storyT + 0.6, settled);
    this.renderer!.render(this.scene, this.cam);
    this.drawSketches();
    this.raf = requestAnimationFrame(this.tick);
  };

  /** The camera the scene is seen through now (for the way back: the scene may have settled since the click). */
  liveCamera: THREE.Camera | null = null;

  private drawSketches(): void {
    const { dpr, k, ox, oy, rx, ry, nx, iy } = this.L, S = 2;
    const back = this.back.getContext("2d")!, front = this.front.getContext("2d")!;
    for (const c of [back, front]) { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.back.width, this.back.height); c.globalAlpha = 1; c.filter = "none"; }
    const t = this.storyT;
    const spin = ORBIT.speed * t;
    this.sheets.forEach((sh, i) => {
      const t0 = START + i * GAP, p = (t - t0) / DRAW;
      if (p <= 0) return;
      this.grow(sh, p);
      const home = Math.PI / 2 - ORBIT.speed * (t0 + DRAW / 2);   // at the front at the middle of its drawing
      const th = this.reduced ? Math.PI / 2 - (i * Math.PI) / 2 : home + spin, z = Math.sin(th);
      const x = ox + rx * Math.cos(th), y = oy + ry * z;
      const base = this.story!.steps[i].base, sc = base * (1 + 0.16 * z) * k;
      // farther than the note's focus (behind the paper), the lens softens it and it thins; the near half is the read
      const far = Math.max(0, (-z - 0.15) / 0.85);
      const ctx = z < 0 ? back : front;
      ctx.globalAlpha = smooth(p * 4) * (0.75 + 0.25 * (z + 1) / 2) * (1 - 0.3 * far);
      ctx.filter = far > 0.01 ? `blur(${(far * 4 * k * dpr).toFixed(1)}px)` : "none";
      const f = (sc * dpr) / S;
      ctx.setTransform(f, 0, 0, f, x * dpr, y * dpr);
      ctx.drawImage(sh.canvas, -SHEET / 2, -SHEET / 2);
      ctx.filter = "none";
    });
    if (this.insight) {
      const q = (t - INSIGHT.at) / INSIGHT.draw;
      if (q > 0) {
        this.grow(this.insight, q);
        const f = (k * dpr) / S;
        front.globalAlpha = 1; front.setTransform(f, 0, 0, f, nx * dpr, iy * dpr);
        front.drawImage(this.insight.canvas, -SHEET / 2, -SHEET / 2);
      }
    }
    // the tooth over everything drawn this frame
    for (const c of [back, front]) {
      c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1;
      c.globalCompositeOperation = "destination-in";
      c.fillStyle = c.createPattern(this.tooth, "repeat")!;
      c.fillRect(0, 0, this.back.width, this.back.height);
      c.globalCompositeOperation = "source-over";
    }
  }

  private finish(): void {
    cancelAnimationFrame(this.raf);
    this.phase = "idle";
    this.el.style.display = "none";
    this.sheets = []; this.insight = null;
    const done = this.onDone; this.onDone = null;
    done?.();
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.renderer?.dispose();
    this.el.remove();
  }
}
