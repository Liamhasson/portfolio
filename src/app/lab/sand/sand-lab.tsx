"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Stage } from "@/three/stage";
import { loadSand, SAND_BASE } from "@/three/sand/data";
import { SAND_LOOK, SandField, type SandState } from "@/three/sand/sand-field";
import { PaintField } from "@/three/sand/paint";
import { Wordmark } from "@/three/sand/wordmark";
import { HeroOverlay } from "./hero-overlay";
import { WorkIndex, type WorkIndexHandle } from "./work-index";
import { BallShadow } from "@/three/sand/ball-shadow";
import { FrostSkin } from "@/three/sand/frost-skin";
import { attemptAt } from "@/three/sand/attempts";
import { BakedDesk } from "@/three/sand/baked-desk";
import { revealAt } from "@/three/sand/screen-reveal";
import { GlassBall } from "@/three/sand/glass-ball";
import { DriftGrains } from "@/three/sand/drift-grains";
import { EXRLoader } from "three/addons/loaders/EXRLoader.js";
import { SAND_ENCODE, SAND_LAYER, SandComposite } from "@/three/sand/sand-composite";
import { Pullback } from "@/three/sand/pullback";
import * as THREE from "three";
import { parseTierOverride, pickTier, readSignals, settingsFor } from "@/three/tier";

type CompareTarget = "chaos" | "mid" | "ball";
const COMPACT_FOR: Record<CompareTarget, number> = { chaos: 0, mid: 0.5, ball: 1 };

/** Scroll progress (0..1 over the page) to compaction: hold the chaos, pull it in, hold the ball. */
function compactFor(progress: number): number {
  const t = Math.min(Math.max((progress - 0.12) / 0.7, 0), 1);
  return t * t * (3 - 2 * t);
}

/**
 * The hero page's scroll timeline (?hero): the hero holds, its copy leaves as the pull-back begins, the camera pulls
 * back and down to the desk, the 2.1 line enters as the desk arrives. The ball forms on the desk in 2.1 (next step),
 * so here the sand stays chaos (Liam, 2026-10-09: "on the desk, as planned").
 */
const TL = {
  exit: [0.035, 0.1], pullback: [0.06, 0.31], enter: [0.22, 0.31],              // hero -> 2.1
  settle: [0.33, 0.52], compact: [0.35, 0.5],                                  // 2.1: the ball forms on the desk
  leave21: [0.54, 0.6], rise: [0.56, 0.68], enter22: [0.64, 0.7],               // 2.1 -> 2.2
  attempts: [0.71, 0.97],                                                      // 2.2: three attempts
  leave22: [0.975, 1.03], descend: [0.99, 1.122], enter23: [1.09, 1.135],      // 2.2 -> 2.3: down to the side view
  build: [1.15, 1.4], ship: [1.42, 1.48],                                      // 2.3: it turns to glass (slowly), then lands
  leave23: [1.52, 1.56], push: [1.53, 1.7],                                     // 2.3 -> 3: into the screen
  takeover: [1.665, 1.7], indexIn: [1.7, 1.74],                                 // the live index takes over, settles
} as const;
/**
 * The page's length. Progress is measured in units of the first 1600vh of scroll (the timeline above was laid out on
 * a 1700vh page), so each chapter added after it keeps the earlier ones' pace.
 */
const PAGE_VH = 3000;
const PROGRESS_SCALE = (PAGE_VH - 100) / 1600;
/**
 * The descend (lookdev.py deskmove --move descend, 100 frames): the scroll carries the camera to its arrival (frame 66,
 * where the view settles); the lid opens on the way (frames 27-60), the low view's fill rises (31-66), and the screen
 * wakes at frame 50 and plays the index's reveal in time, as a real screen would (scroll back up and it sleeps).
 */
const DESCEND = { arrive: 65, wake: 49, lid: [0.26, 0.6], open: [0.3, 0.66], openDeg: 108 } as const;
/** The low view's fill (lookdev.py: area light, 0.9 m, 38 W), lighting the sand from the camera's side. */
const SIDE_FILL = { pos: [1.35, -0.95, 0.45], watts: 38, color: [1.0, 0.86, 0.72], radius: 4.5 };
/**
 * 2.3 (production plan §2): build, then ship. Build: the held attempt's clearing sweeps on over the whole ball, the
 * grains drain into the skin, the frost melts into glass, all while it hovers. Ship: only then it falls, like a real fall
 * (height goes with the square of the scroll: constant scrolling is constant time), and the last millimetre is absorbed
 * in a quick soft stop: glass on wood, no bounce. Scroll back and it lifts, loses its weight and turns back to sand.
 */
// the frost covers the ball, then a wave of clarity runs over it from where the attempt began; the grains sink into the
// frost just ahead of the wave (drain: a floor that takes the last ones under)
const BUILD = { sweep: [0, 0.3], drain: [0.6, 0.97], melt: [0.2, 1] } as const;
const SHIP = { hover: 0.15, rest: 0.0705, contact: 0.9, settleM: 0.0012 } as const;   // metres (lookdev.py: the side view)
/** Ship progress 0..1 -> how far down it has come, 0..1. */
function fall(s: number): number {
  const eps = SHIP.settleM / (SHIP.hover - SHIP.rest);
  if (s <= SHIP.contact) { const u = s / SHIP.contact; return u * u * (1 - eps); }
  const x = (s - SHIP.contact) / (1 - SHIP.contact) * 6;   // critically damped: the wood takes the last millimetre
  return Math.min(1 - eps * (1 + x) * Math.exp(-x), 1);
}
/**
 * The scene leans with the cursor (Lusion's camera, read from their code 2026-10-10): the camera turns toward it by up to
 * LEAN radians (their about hero settles at 0.035), closing 10% of the gap each 60 fps frame; the scene moves the way
 * the cursor goes. A finger leans it while it touches. It eases out where precision matters: the glass landing, the
 * index taking over the screen.
 */
const LEAN = 0.035;
const LEAN_DAMP = -Math.log(1 - 0.1) * 60;   // their per-frame 0.1 at 60 fps, as a rate
/** The floating grains' density through the page (Liam: strong in the hero, sparse over the desk, none on the index). */
const DRIFT = { hero: 1, desk: 0.12 } as const;
/** smootherstep of t over [a, b] (Blender's ease in lookdev.py). */
function ease(t: number, [a, b]: readonly [number, number]): number {
  const x = Math.min(Math.max((t - a) / (b - a), 0), 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}
const span = (p: number, [a, b]: readonly [number, number]) => Math.min(Math.max((p - a) / (b - a), 0), 1);

/** Frame-rate-independent damping toward a target. */
function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

export function SandLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [compare] = useState<CompareTarget | null>(() => {
    const v = new URLSearchParams(window.location.search).get("compare");
    return v === "chaos" || v === "mid" || v === "ball" ? v : null;
  });
  const [split, setSplit] = useState(50);
  // ?hero: the hero's front layer over the sand (the lab's status line hidden)
  const [hero] = useState(() => new URLSearchParams(window.location.search).has("hero"));
  const compactRef = useRef(0);
  const progressRef = useRef(0);   // damped scroll progress 0..1
  // the hero copy: in the lab's compaction mode it leaves as the ball forms; on the hero page, as the pull-back begins
  const readExit = useCallback(
    () => (hero ? span(progressRef.current, TL.exit) : Math.min(Math.max((compactRef.current - 0.6) / 0.3, 0), 1)),
    [hero],
  );
  const readScrolled = useCallback(() => progressRef.current, []);
  const readEnter = useCallback(() => span(progressRef.current, TL.enter), []);
  const readLeave21 = useCallback(() => span(progressRef.current, TL.leave21), []);
  const readEnter22 = useCallback(() => span(progressRef.current, TL.enter22), []);
  const readLeave22 = useCallback(() => span(progressRef.current, TL.leave22), []);
  const readEnter23 = useCallback(() => span(progressRef.current, TL.enter23), []);
  const readLeave23 = useCallback(() => span(progressRef.current, TL.leave23), []);
  const indexRef = useRef<WorkIndexHandle | null>(null);
  const bindIndex = useCallback((h: WorkIndexHandle) => { indexRef.current = h; }, []);
  const [status, setStatus] = useState("loading sand");
  // no WebGL2 (or the sand failed to load): the approved renders as stills, chaos then ball with scroll
  const [fallback, setFallback] = useState(false);
  const [stillBall, setStillBall] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let stage: Stage | null = null;
    let field: SandField | null = null;
    let paint: PaintField | null = null;
    let wordmark: Wordmark | null = null;
    const listeners: [string, EventListener][] = [];

    (async () => {
      // the tier first: it decides how much sand to download
      const probe = document.createElement("canvas").getContext("webgl2");
      if (!probe || new URLSearchParams(window.location.search).has("nogl")) {
        setFallback(true);
        return;
      }
      const tier = pickTier(readSignals(probe), parseTierOverride(window.location.search));
      const data = await loadSand(settingsFor(tier, window.devicePixelRatio || 1).grains, SAND_BASE);
      if (disposed) return;
      const { camera } = data.meta;
      stage = new Stage(
        canvas,
        {
          position: camera.position,
          target: camera.target,
          lensMm: camera.lens_mm,
          sensorMm: camera.sensor_mm,
          renderAspect: camera.render[0] / camera.render[1],
        },
        tier,
        compare !== null,
      );
      field = new SandField(data);
      stage.scene.add(field.points);
      // the sand through a pixel filter like Cycles' (?filter=0 draws it plain, for comparison)
      const filterParam = new URLSearchParams(window.location.search).get("filter");
      // the filter's width follows the grains' size on screen (fitted against the renders): chaos 0.5, ball 0.28,
      // the far desk view 0.525
      let composite: SandComposite | null = null;
      const FILTER = { chaos: 0.5, ball: 0.28, desk: 0.525 };
      if (filterParam !== "0") {
        const comp = new SandComposite();
        composite = comp;
        if (filterParam) comp.sigma = Number(filterParam);
        field.points.layers.set(SAND_LAYER);
        field.material.uniforms.uOutScale.value = 1 / SAND_ENCODE;
        stage.camera.layers.enable(SAND_LAYER);
        stage.renderFrame = (r, sc, cam) => comp.render(r, sc, cam);
        (window as unknown as { __sandFilter?: (s: number) => void }).__sandFilter = (s) => { comp.sigma = s; };
      }
      // the desk: a real 3D object by default; ?plates draws the rendered frames instead (for comparison)
      const usePlates = new URLSearchParams(window.location.search).has("plates");
      const pullback = hero && !compare ? await Pullback.load(undefined, usePlates) : null;
      // 2.1: the settle into the three-quarter view, the chaos packing into the ball on the desk
      const settle = hero && !compare ? await Pullback.load("/lab/settle", usePlates) : null;
      // 2.1 -> 2.2: the rise to the top-down view (the ball rises and rolls with it)
      const rise = hero && !compare ? await Pullback.load("/lab/rise", usePlates).catch(() => null) : null;
      if (disposed) return;
      if (rise) stage.scene.add(rise.plate);
      const desk3d = hero && !compare && !usePlates ? await BakedDesk.load(stage.renderer) : null;
      if (disposed) return;
      if (desk3d) stage.scene.add(desk3d.group);
      // 2.2 -> 2.3: the descend to the low side view (the 3D desk only: no plates were rendered for it)
      const descend = desk3d ? await Pullback.load("/lab/descend", false).catch(() => null) : null;
      // 2.3 -> 3: the push into the screen (lookdev.py deskmove --move push, approved)
      const push = desk3d ? await Pullback.load("/lab/push", false).catch(() => null) : null;
      if (disposed) return;
      // the screen's reveal: seconds since it woke; and how far it has gone back to sleep (scrolling back up)
      let revealT = 0, sleep = 1;
      // ?dsframe=N holds the camera on a descend frame; ?reveal=S holds the screen's reveal at S seconds (calibration)
      const dsFrame = Number(new URLSearchParams(window.location.search).get("dsframe") || NaN);
      const pushFrame = Number(new URLSearchParams(window.location.search).get("pushframe") || NaN);   // calibration
      const indexMix = Number(new URLSearchParams(window.location.search).get("indexmix") || NaN);   // calibration: the index's opacity
      const holdDescend = Number.isFinite(dsFrame) || Number.isFinite(pushFrame);
      const lidHold = Number(new URLSearchParams(window.location.search).get("lid") || NaN);   // ?lid=deg (calibration)
      const revealHold = Number(new URLSearchParams(window.location.search).get("reveal") || NaN);
      let fillGain = 1;
      // 2.2-2.3: the frost and the glass it clears into (one surface), between the desk and the sand
      const glass = desk3d && composite && desk3d.env && desk3d.lut && desk3d.invLut
        ? new GlassBall(desk3d.env, desk3d.lut, desk3d.invLut, desk3d.glassLights(), desk3d.heroPerMetre, field.material) : null;
      // where the current attempt was born, in the ball's frame (the side that faced the viewer then); it rides the ball
      const attUp = new THREE.Vector3(0, 1, 0);
      let attBorn = false, meltBorn = false;
      let probes: { top: THREE.Texture; hover: THREE.Texture; land: THREE.Texture } | null = null;
      if (glass && composite) {
        stage.scene.add(glass.mesh);
        composite.glass = glass;
        // what the glass sees from its own place, hovering and landed (lookdev.py PROBE_AT; the lights in them)
        // and where it hangs in 2.2, over the shut laptop
        Promise.all(["top", "hover", "land"].map((n) => new EXRLoader().loadAsync(`/lab/glass/probe-${n}.exr`)))
          .then(([t, h, l]) => { probes = { top: t, hover: h, land: l }; glass.setProbes(t, h); })
          .catch(() => {});   // without them it reads the desk's probe and draws the lights itself
      }
      // ?build=B / ?ship=S hold 2.3's beats (calibration)
      const buildHold = Number(new URLSearchParams(window.location.search).get("build") || NaN);
      const shipHold = Number(new URLSearchParams(window.location.search).get("ship") || NaN);
      const glassLook = { shadow: 0.88, ao: 0.6, lampR: 2.0, reflect: 0.3, lights: 0.3, radius: 1.0 };
      (window as unknown as { __glass?: (l: Partial<typeof glassLook>) => void }).__glass = (l) => Object.assign(glassLook, l);
      (window as unknown as { __fill?: (g: number) => void }).__fill = (g) => { fillGain = g; };
      (window as unknown as { __desk3d?: unknown }).__desk3d = desk3d;
      // 2.2: the frost's shell in the sand layer (depth only: it hides the grains behind the frost; the glass draws it)
      const frost = hero && !compare ? new FrostSkin(field.material) : null;
      if (frost) {
        frost.mesh.layers.set(SAND_LAYER);
        stage.scene.add(frost.mesh);
      }
      if (glass) (window as unknown as { __frost?: (l: Parameters<GlassBall["setLook"]>[0]) => void }).__frost = (l) => glass.setLook(l);
      // grains leaving the sand: the scene's atmosphere (drift-grains.ts)
      const drift = new DriftGrains(field.material, tier === "low" ? 600 : 1600);
      drift.points.layers.set(SAND_LAYER);
      stage.scene.add(drift.points);
      const lean = new THREE.Vector2();     // the eased lean, -1..1 each way
      const leanQ = new THREE.Quaternion(), leanE = new THREE.Euler();
      if (pullback) stage.scene.add(pullback.plate);
      let shadow: BallShadow | null = null;
      // the shadow: lamp radius (hero units), strength, and the ball's effective solid size (its edge is sparse sand)
      const shadowK = [1.2, 0.9, 0.7];   // chosen by eye against the settle target (2026-10-09)
      (window as unknown as { __pbShadow?: (a: number, b: number, c: number) => void }).__pbShadow = (a, b, c) => { shadowK.splice(0, 3, a, b, c); };
      if (settle) {
        stage.scene.add(settle.plate);
        shadow = new BallShadow(settle.toHero([0, 0, 0]).y);
        stage.scene.add(shadow.mesh);
        const sb = (settle.data as unknown as { ball: { center: number[]; radius: number } }).ball;
        field.setBallTarget(settle.toHero(sb.center), sb.radius / settle.data.chaos_scale);
      }
      const heroLights = field.heroLights();
      const g = field.lookGains;
      // the desk set, calibrated 2026-10-09 against the pull-back render with sand at frame 60 (scripts/lab/pb-calib.mjs)
      // the desk set, fitted 2026-10-09 against the Cycles pull-back render at frame 60 (lamp alone, then with the rim;
      // scripts/lab/fit_desk_light.py). The lamp's cone is wider and softer than its Blender settings suggest (116°,
      // blend 1): Cycles lit the whole cloud. The desk bounce adds nothing in Cycles, so it is off.
      let desk = pullback?.deskLights(g.wattsToIrradiance, [0.244, 1.0, 0], { radii: [0.573, 1.2, 3.0], spotDeg: 116, blend: 1.0 });
      const DESK_LOOK = { shadowKChaos: 0.602, wrap: 0.375, bounce: 0.12, localOcclusion: 0.016, spec: 0.016, radScaleChaos: 1.44 };
      // the formed ball on the desk, fitted against the Cycles target at the settle's end (scripts/lab/fit_ball.py):
      // a slightly stronger lamp, and the lamp-lit desk below as a broad light (setGround)
      const BALL_LOOK = { shadowK: 0.571, cavity: 0.3, cavityDepth: 0.071, wrap: 0.375, bounce: 0.12, spec: 0.064, radScale: 1.0 };
      const deskBall = pullback?.deskLights(g.wattsToIrradiance, [0.305, 1.0, 0], { radii: [0.573, 1.2, 3.0], spotDeg: 116, blend: 1.0 });
      // lab calibration: ?pbframe=N holds the camera on a path frame; __pbGains sets the desk lights' gains
      let lampSat = 0.2;
      const groundCol = new THREE.Vector3(1.0, 0.7, 0.406).multiplyScalar(0.444);
      (window as unknown as { __pbGround?: (g: number, c: number) => void }).__pbGround = (g, c) => { groundCol.set(1.0, c, c * 0.58).multiplyScalar(g); };
      (window as unknown as { __pbSat?: (v: number) => void }).__pbSat = (v) => { lampSat = v; };
      const calibrating = new URLSearchParams(window.location.search).has("pbframe") || new URLSearchParams(window.location.search).has("stframe");
      const pbFrame = Number(new URLSearchParams(window.location.search).get("pbframe") || NaN);
      let pbOpts: Parameters<Pullback["deskLights"]>[2] = {};
      (window as unknown as { __pbGains?: (a: number, b: number, c: number, o?: typeof pbOpts) => void }).__pbGains = (a, b, c, o) => {
        if (o) pbOpts = o;
        desk = pullback?.deskLights(g.wattsToIrradiance, [a, b, c], pbOpts);
      };
      // ?weight=bold|black|ultrablack: compare the wordmark's weight (default black); ?wordmark=0 hides it
      const params = new URLSearchParams(window.location.search);
      if (params.get("wordmark") !== "0" && !compare) {
        const weight = { bold: "Bold", black: "Black", ultrablack: "UltraBlack" }[params.get("weight") ?? "black"] ?? "Black";
        wordmark = await Wordmark.create(data.meta, `/lab/fonts/Geist-${weight}.ttf`);
        if (disposed) return;
        stage.scene.add(wordmark.mesh);
        // ?wm=bottom: Lusion's placement, the name across the full width at the bottom (behind the sand)
        if (params.get("wm") === "bottom") {
          const mesh = wordmark.mesh;
          const geoW = (mesh.geometry as THREE.PlaneGeometry).parameters.width;
          const place = () => {
            const cam = stage!.camera;
            cam.updateMatrixWorld();
            const at = (nx: number, ny: number) => {
              const v = new THREE.Vector3(nx, ny, 0.5).unproject(cam).sub(cam.position).normalize();
              const s = (mesh.position.z - cam.position.z) / v.z;
              return cam.position.clone().addScaledVector(v, s);
            };
            mesh.position.z = -4.5;
            const left = at(-0.902, -0.62), right = at(0.902, -0.62);
            mesh.scale.setScalar(right.distanceTo(left) / (geoW * 0.95));
            mesh.position.set((left.x + right.x) / 2, left.y, -4.5);
          };
          place();
          stage.onSettings(place);
        } else {
          // the approved placement; on portrait screens it shrinks to fit the width (it overflowed both sides)
          const mesh = wordmark.mesh;
          const geoW = (mesh.geometry as THREE.PlaneGeometry).parameters.width;
          const fit = () => {
            const cam = stage!.camera;
            const dist = cam.position.z - mesh.position.z;
            const viewW = 2 * dist * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * cam.aspect;
            mesh.scale.setScalar(Math.min(1, (viewW * 0.9) / (geoW * 0.95)));
          };
          fit();
          stage.onSettings(fit);
        }
      }
      stage.onSettings((s) => {
        field!.setGrains(s.grains);
        field!.setShadowSteps(s.shadowSteps);
        field!.setPointScale(stage!.bufferHeight, (stage!.camera.fov * Math.PI) / 180);
        setStatus(`${s.tier} · ${s.grains.toLocaleString()} grains · ${s.shadowSteps} shadow steps · dpr ${s.pixelRatio}`);
      });

      const state: SandState = { compact: 0, time: 0, ballSpin: 0, chaosSpin: 0 };
      if (compare) {
        // frozen, at the exact Blender camera: comparable pixel for pixel with the render
        state.compact = COMPACT_FOR[compare];
        if (composite && !filterParam) composite.sigma = FILTER.chaos + (FILTER.ball - FILTER.chaos) * state.compact;
        field.update(state);
        stage.renderOnce();
        const w = window as unknown as { __sandReady?: boolean; __sandLook?: (l: Record<string, number>) => void };
        w.__sandLook = (look) => {
          const { filter, ...rest } = look;
          if (filter !== undefined) (window as unknown as { __sandFilter?: (s: number) => void }).__sandFilter?.(filter);
          field!.setLook(rest);
          stage!.renderOnce();
        };
        w.__sandReady = true;
        return;
      }

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      // ?still: no ambient motion (drift, spin), so a test isolates what the cursor does
      const still = new URLSearchParams(window.location.search).has("still");
      let lastScroll = window.scrollY;
      let spinVel = 0;

      // the cursor: a light (Lusion model) and, unless motion is reduced, a soft drift
      paint = new PaintField();
      const sizePaint = () => {
        paint!.setSize(canvas.clientWidth, canvas.clientHeight);
        field!.setPaint(paint!.texture, canvas.clientWidth, canvas.clientHeight);
      };
      sizePaint();
      stage.onSettings(sizePaint);
      const baseLook = reduced ? { paintScale: 0 } : {};
      field.setLook(baseLook);
      const pointer = { x: 0, y: 0, active: false, touch: false };
      let cursorI = 0;
      const on = (type: string, fn: EventListener) => {
        window.addEventListener(type, fn, { passive: true });
        listeners.push([type, fn]);
      };
      on("pointermove", ((e: PointerEvent) => {
        pointer.x = e.clientX; pointer.y = e.clientY;
        pointer.touch = e.pointerType === "touch";
        // a mouse lights the sand wherever it is; a finger only while it touches
        if (!pointer.touch || e.buttons) { pointer.active = true; paint!.move(e.clientX, e.clientY); }
      }) as EventListener);
      on("pointerdown", ((e: PointerEvent) => {
        pointer.x = e.clientX; pointer.y = e.clientY; pointer.touch = e.pointerType === "touch";
        pointer.active = true; paint!.move(e.clientX, e.clientY);
      }) as EventListener);
      const lift = ((e: PointerEvent) => {
        if (e.pointerType === "touch") { pointer.active = false; paint!.release(); }
      }) as EventListener;
      on("pointerup", lift);
      on("pointercancel", lift);
      const leave = () => { pointer.active = false; paint!.release(); };
      document.documentElement.addEventListener("mouseleave", leave);
      listeners.push(["__leave", leave]);
      const ndc = new THREE.Vector3();
      const cursorWorld = new THREE.Vector3();
      const focus = new THREE.Vector3();
      const forward = new THREE.Vector3();
      const chaosC = field.material.uniforms.uChaosC.value as THREE.Vector3;
      const ballC = field.material.uniforms.uBallC.value as THREE.Vector3;

      stage.onFrame((dt) => {
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const progress = window.scrollY / max;
        progressRef.current = damp(progressRef.current, hero ? progress * PROGRESS_SCALE : progress, 6, dt);
        // ?dsframe holds a descend frame: everything before it (the ball, the third attempt) as the page has it there
        if (holdDescend) progressRef.current = TL.descend[0] + 0.01;
        if (Number.isFinite(pushFrame)) progressRef.current = TL.push[0] + (TL.push[1] - TL.push[0]) * Math.max((pushFrame - 1) / 71, 1e-4);
        if (Number.isFinite(buildHold) && !Number.isFinite(dsFrame)) progressRef.current = TL.build[0] + (TL.build[1] - TL.build[0]) * buildHold;
        state.compact = pullback
          ? (() => { const x = span(progressRef.current, TL.compact); return x * x * (3 - 2 * x); })()
          : damp(state.compact, compactFor(progress), 6, dt);
        compactRef.current = state.compact;
        if (pullback && desk) {
          const deskNow = desk;
          const hl = THREE.MathUtils.smoothstep(span(progressRef.current, TL.pullback), 0.15, 0.85);
          // the desk lamp is close and soft: the sand's own shading softens with it (shadow strength, wrap)
          if (!calibrating) {
            const mixLook: Record<string, number> = {};
            for (const [key, v] of Object.entries(DESK_LOOK)) {
              const from = SAND_LOOK[key as keyof typeof SAND_LOOK] as number;
              mixLook[key] = from + (v - from) * hl;
            }
            for (const [key, v] of Object.entries(BALL_LOOK)) {
              const from = mixLook[key] ?? (SAND_LOOK[key as keyof typeof SAND_LOOK] as number);
              mixLook[key] = from + (v - from) * state.compact;
            }
            field!.setLook({ ...baseLook, ...mixLook });
          }
          // the camera on the exported path; the plate cropped to its view; the lights handed to the desk lamp
          const t = Number.isFinite(pbFrame) ? (pbFrame - 1) / (pullback.data.frames - 1) : span(progressRef.current, TL.pullback);
          // ?stframe=N holds the camera on a settle frame (calibration)
          const stFrame = Number(new URLSearchParams(window.location.search).get("stframe") || NaN);
          const st = settle ? (Number.isFinite(stFrame) ? (stFrame - 1) / (settle.data.frames - 1) : span(progressRef.current, TL.settle)) : 0;
          // ?rtframe=N holds the camera on a rise frame (calibration)
          const rtFrame = Number(new URLSearchParams(window.location.search).get("rtframe") || NaN);
          const rt = rise ? (Number.isFinite(rtFrame) ? Math.max((rtFrame - 1) / (rise.data.frames - 1), 1e-4) : span(progressRef.current, TL.rise)) : 0;
          const ds = descend ? (Number.isFinite(dsFrame) ? Math.max((dsFrame - 1) / DESCEND.arrive, 1e-4) : span(progressRef.current, TL.descend)) : 0;
          const pt = push ? (Number.isFinite(pushFrame) ? Math.max((pushFrame - 1) / (push.data.frames - 1), 1e-4) : span(progressRef.current, TL.push)) : 0;
          const move = push && pt > 0 ? push : descend && ds > 0 ? descend : rise && rt > 0 ? rise : settle && st > 0 ? settle : pullback;
          const f = move === push ? pt * (push!.data.frames - 1)
            : move === descend ? (Number.isFinite(dsFrame) ? dsFrame - 1 : ds * DESCEND.arrive)
            : move === rise ? rt * (rise.data.frames - 1) : move === settle ? st * (settle!.data.frames - 1) : t * (pullback.data.frames - 1);
          if (rise) {
            rise.plate.visible = move === rise;
            // the ball rides the rise: up off the desk, rolling forward 45 degrees (scroll turns the ball); then the
            // descend carries it beside the laptop, still turned
            const fi = Math.min(Math.max(Math.round(f), 0), rise.data.frames - 1);
            const fr = rise.data.path[move === rise ? fi : 0] as unknown as { ball: number[]; ball_roll: number };
            const end = rise.data.path[rise.data.frames - 1] as unknown as { ball_roll: number };
            if ((move === descend || move === push) && descend) {
              const fd = move === push ? descend.data.frames - 1 : f;
              const a = descend.data.path[Math.min(Math.floor(fd), descend.data.frames - 2)] as unknown as { ball: number[] };
              const b = descend.data.path[Math.min(Math.floor(fd) + 1, descend.data.frames - 1)] as unknown as { ball: number[] };
              field!.setBallTarget(descend.toHero(a.ball).lerp(descend.toHero(b.ball), Math.min(fd - Math.floor(fd), 1)), 0.07 / descend.data.chaos_scale);
              state.ballRoll = end.ball_roll;
            } else {
              field!.setBallTarget(rise.toHero(fr.ball), 0.07 / rise.data.chaos_scale);
              state.ballRoll = move === rise ? fr.ball_roll : 0;
            }
          }
          // 2.3's arrival: the lid opens, the low view's fill rises, the screen wakes and plays the index's reveal
          let openF = 0;
          if (desk3d) {
            const tb = move === push ? 1 : move === descend ? f / (descend!.data.frames - 1) : 0;
            openF = ease(tb, DESCEND.open);
            desk3d.setLid(Number.isFinite(lidHold) ? lidHold : DESCEND.openDeg * ease(tb, DESCEND.lid));
            const awake = move === push || (move === descend && f >= DESCEND.wake);
            if (Number.isFinite(revealHold)) { revealT = revealHold; sleep = 0; }
            else if (awake) { sleep = Math.max(sleep - dt / 0.35, 0); if (sleep === 0 || revealT > 0) revealT += dt; }
            else { sleep = Math.min(sleep + dt / 0.35, 1); if (sleep === 1) revealT = 0; }
            const rf = revealAt(revealT);
            rf.wake = Math.max(rf.wake, sleep);
            rf.light *= 1 - sleep;
            desk3d.setScreen(rf);
            desk3d.setState(openF, rf.light);
          }
          // 2.2: the attempts, scrubbed by scroll, facing the camera above (world up)
          const ax = span(progressRef.current, TL.attempts);
          const [lo, brk, dep] = attemptAt(ax);
          const live = ax > 0 && lo < 0.999;
          if (live && !attBorn) {
            // born on the side facing the viewer, then it rides the ball (its spin, the scroll's turn, the roll)
            const toCam = stage!.camera.position.clone().sub(ballC).normalize();
            attUp.copy(toCam.applyMatrix3(field!.ballRotation.clone().transpose())).normalize();
            attBorn = true;
          }
          if (!live && ax < 1) attBorn = false;   // between attempts: the next is born anew
          field!.setAttempt(ax > 0 ? lo : 1, brk, dep, attUp);
          const v = move.view(f);
          stage!.setView(v.position, v.quaternion, v.lens);
          // the lean: toward the cursor (or a touching finger), eased; out over the landing and the index takeover
          {
            const W = canvas.clientWidth || 1, H = canvas.clientHeight || 1;
            const want = pointer.active
              ? new THREE.Vector2(Math.min(Math.max((pointer.x / W) * 2 - 1, -1), 1), Math.min(Math.max(1 - (pointer.y / H) * 2, -1), 1))
              : new THREE.Vector2();
            const k = 1 - Math.exp(-LEAN_DAMP * dt);
            lean.lerp(reduced || calibrating || holdDescend ? new THREE.Vector2() : want, k);
            const pg = progressRef.current;
            const landing = ease(pg, [TL.ship[0] + 0.5 * (TL.ship[1] - TL.ship[0]), TL.ship[1]]) * (1 - ease(pg, [TL.ship[1] + 0.01, TL.ship[1] + 0.035]));
            const w = (1 - landing) * (1 - ease(pg, [TL.takeover[0] - 0.02, TL.takeover[1]]));
            if (w > 0.0001) {
              leanE.set(-lean.y * LEAN * w, lean.x * LEAN * w, 0, "YXZ");
              stage!.camera.quaternion.multiply(leanQ.setFromEuler(leanE));
              stage!.camera.updateMatrixWorld();
            }
          }
          // 3: the live index over the screen's quad, crossfading in where they coincide, then settling into the view
          const ix = indexRef.current;
          if (ix && desk3d && push) {
            const take = ease(span(progressRef.current, TL.takeover), [0, 1]);
            const sett = ease(span(progressRef.current, TL.indexIn), [0, 1]);
            const W = canvas.clientWidth, H = canvas.clientHeight;
            const portrait = W / H < 1;
            const cam = stage!.camera;
            const project = () => (desk3d.screenCorners() ?? []).map((p) => {
              const q = p.clone().project(cam);
              return [(q.x + 1) / 2 * W, (1 - q.y) / 2 * H] as [number, number];
            });
            if (move === push && portrait) {
              // phones: the 16:10 screen is far wider than the view; toward the push's end the lens widens just enough
              // to keep the whole screen in (with the site's side margins), so the takeover happens on the whole screen
              const xs = project().map((p) => p[0]);
              if (xs.length === 4) {
                const need = (Math.max(...xs) - Math.min(...xs)) / (W * 0.902);
                const wgt = ease(pt, [0.3, 1]);
                if (need > 1 && wgt > 0) {
                  const k = 1 + (need - 1) * wgt;
                  cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * k));
                  cam.updateProjectionMatrix();
                }
              }
            }
            const proj = pt > 0 ? project() : [];
            if (proj.length === 4) {
              const { w, h } = ix.size();
              if (portrait) {
                ix.place(proj as [[number, number], [number, number], [number, number], [number, number]]);
                // the screen's black panel grows from the screen to the whole phone; the 16:10 layout gives way and
                // the phone list surfaces
                const xs = proj.map((p) => p[0]), ys = proj.map((p) => p[1]);
                const r0 = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
                const g = ease(sett, [0, 0.55]);
                ix.panel(take > 0.999 ? { x: r0.x * (1 - g), y: r0.y * (1 - g), w: r0.w + (W - r0.w) * g, h: r0.h + (H - r0.h) * g } : null);
                ix.show((Number.isFinite(indexMix) ? indexMix : take) * (1 - ease(sett, [0.05, 0.35])));
                ix.list(ease(sett, [0.4, 1]));
                ix.interactive(sett > 0.999 ? "list" : "none");
              } else {
                // where it settles: the 16:10 index contained in the view, centred, the bars in its black
                const s = Math.min(W / w, H / h), cw = w * s, ch = h * s, x0 = (W - cw) / 2, y0 = (H - ch) / 2;
                const rest: [number, number][] = [[x0, y0], [x0 + cw, y0], [x0 + cw, y0 + ch], [x0, y0 + ch]];
                const quad = proj.map((p, i) => [p[0] + (rest[i][0] - p[0]) * sett, p[1] + (rest[i][1] - p[1]) * sett]) as [[number, number], [number, number], [number, number], [number, number]];
                ix.place(quad);
                ix.panel(sett > 0 ? { x: 0, y: 0, w: W, h: H } : null);
                ix.show(Number.isFinite(indexMix) ? indexMix : take);
                ix.list(0);
                ix.interactive(sett > 0.999 ? "wide" : "none");
              }
            } else {
              ix.show(0); ix.panel(null); ix.list(0); ix.interactive("none");
            }
          }
          const tanV = Math.tan(THREE.MathUtils.degToRad(stage!.camera.fov) / 2);
          move.show(f, tanV * stage!.camera.aspect, tanV, v.lens);
          pullback.plate.visible = move === pullback;
          field!.setGround(groundCol, stage!.camera);
          if (settle) settle.plate.visible = move === settle;
          if (desk3d) {
            pullback.plate.visible = false;
            if (settle) settle.plate.visible = false;
            if (rise) rise.plate.visible = false;
          }
          // 2.3: build, then ship
          const b = Number.isFinite(buildHold) ? buildHold : Number.isFinite(shipHold) ? 1 : span(progressRef.current, TL.build);
          const sp = Number.isFinite(shipHold) ? shipHold : span(progressRef.current, TL.ship);
          const glassF = Math.min(Math.max((b - BUILD.melt[0]) / (BUILD.melt[1] - BUILD.melt[0]), 0), 1);   // how much is glass (its shadow)
          if (glassF > 0 && !meltBorn) {
            // the clearing starts on the side facing the viewer the moment it starts (the scroll turns the ball before
            // then), then rides the ball
            const toCam = stage!.camera.position.clone().sub(ballC).normalize();
            (field!.material.uniforms.uMeltUp.value as THREE.Vector3).copy(toCam.applyMatrix3(field!.ballRotation.clone().transpose())).normalize();
            meltBorn = true;
          }
          if (glassF <= 0) meltBorn = false;
          // the clearing advances evenly with the scroll (an eased curve rushed its middle)
          const meltT = Math.min(Math.max((b - BUILD.melt[0]) / (BUILD.melt[1] - BUILD.melt[0]), 0), 1);
          field!.setBuild(ease(b, BUILD.sweep), ease(b, BUILD.drain), meltT);
          if (glass) {
            // the frost exists from the first attempt on; the glass surface is the frost, clearing; it lands in the ship
            const on = span(progressRef.current, TL.attempts) > 0 || b > 0;
            let c = ballC;
            if (descend && sp > 0) {
              const end = descend.data.path[descend.data.frames - 1] as unknown as { ball: number[] };
              c = descend.toHero([end.ball[0], end.ball[1], SHIP.hover - (SHIP.hover - SHIP.rest) * fall(sp)]);
            }
            glass.update(c, field!.material.uniforms.uBallR.value, on ? 1 : 0);
            // the room it sees: from over the shut laptop (2.2), then from its hover beside the open one, then landed
            if (probes) {
              if (sp > 0) { glass.setProbes(probes.hover, probes.land); glass.probeMix = fall(sp); }
              else { glass.setProbes(probes.top, probes.hover); glass.probeMix = move === descend || move === push ? ease(f / (descend!.data.frames - 1), [0.2, 0.66]) : 0; }
            }
            if (on) desk3d!.glassLights().rects.forEach((r, i) => glass.setRectRadiance(i, r.radiance));
          }
          if (shadow && deskNow) {
            // the lamp's real size (0.2 m soft radius, 2 hero units) sets the softness; ~85% of the desk's light is the lamp
            const ballC = field!.material.uniforms.uBallC.value as THREE.Vector3;
            let k = move !== pullback ? shadowK[1] * state.compact : 0;
            let ballR = field!.material.uniforms.uBallR.value * shadowK[2];
            let at = ballC, ao = 0, lampR = shadowK[0], refl = k, lit = k;
            if (glass && glassF > 0) {
              // the glass: a whole sphere (no sparse edge) that lets some of the lamp through, and its contact shadow
              const gu = glass.material.uniforms;
              at = gu.uC.value as THREE.Vector3;
              ballR = THREE.MathUtils.lerp(ballR, gu.uR.value * glassLook.radius, glassF);
              k = THREE.MathUtils.lerp(k, glassLook.shadow, glassF);
              ao = glassLook.ao * glassF;
              lampR = THREE.MathUtils.lerp(lampR, glassLook.lampR, glassF);
              refl = THREE.MathUtils.lerp(refl, glassLook.reflect, glassF);
              lit = THREE.MathUtils.lerp(lit, glassLook.lights, glassF);
            }
            // on the 3D desk the shadow falls on whatever the lamp lights (the laptop too); on the plates, a plane
            if (desk3d) { desk3d.setBallShadow(at, ballR, deskNow.lights[0].pos, lampR, k, ao, refl, lit); shadow.update(at, ballR, deskNow.lights[0].pos, lampR, 0); }
            else shadow.update(ballC, ballR, deskNow.lights[0].pos, shadowK[0], k);
          }
          field!.setPointScale(stage!.bufferHeight, THREE.MathUtils.degToRad(stage!.camera.fov));
          const h = THREE.MathUtils.smoothstep(t, 0.15, 0.85);
          field!.setLights(
            heroLights.map((l, i) => {
              // blend what reaches the sand (irradiance at its centre), not the raw power: a light swinging past the
              // sand mid-move would otherwise flare
              const d0 = deskNow.lights[i];
              const db = deskBall && !calibrating ? deskBall.lights[i] : d0;
              const d = { pos: d0.pos, col: d0.col.clone().lerp(db.col, state.compact), r: d0.r };
              // the third light (the desk bounce, off on the desk) becomes the low view's fill as it rises
              if (i === 2 && descend && openF > 0) {
                d.pos = descend.toHero(SIDE_FILL.pos);
                d.col = new THREE.Vector3(...(SIDE_FILL.color as [number, number, number]))
                  .multiplyScalar((SIDE_FILL.watts / (descend.data.chaos_scale ** 2)) * g.wattsToIrradiance * fillGain * openF);
                d.r = SIDE_FILL.radius;
              }
              const pos = l.pos.clone().lerp(d.pos, h);
              const r2 = (v: THREE.Vector3) => Math.max(v.distanceToSquared(chaosC), 1e-3);
              const col = l.col.clone().divideScalar(r2(l.pos)).lerp(d.col.clone().divideScalar(r2(d.pos)), h).multiplyScalar(r2(pos));
              return { pos, col, r: (d.r ?? 0) * h };
            }),
            { dir: deskNow.spot.dir, cos: new THREE.Vector2(-3, -2).lerp(deskNow.spot.cos, h) },
            (calibrating ? lampSat : lampSat + (0.05 - lampSat) * state.compact) * h,
          );
          // the name dims as the camera pulls away (the approved clip's glow keys: 0.55 -> 0.25 at 40% -> 0)
          wordmark?.setFade(t < 0.4 ? 1 - (0.3 / 0.55) * (t / 0.4) : (0.25 / 0.55) * (1 - (t - 0.4) / 0.6));
        }
        // scroll turns the ball; when scrolling stops it keeps a slow idle spin
        const scrolled = window.scrollY - lastScroll;
        lastScroll = window.scrollY;
        spinVel = damp(spinVel, scrolled * 0.004 / Math.max(dt, 1e-3), 4, dt);
        if (!reduced && !still) {
          state.time += dt;
          state.ballSpin += dt * 0.12 + spinVel * dt;
          state.chaosSpin += dt * 0.015;
        }
        // the cursor light: on a camera-facing plane through the sand, a little in front of it
        const cam = stage!.camera;
        focus.lerpVectors(chaosC, ballC, state.compact);
        cam.getWorldDirection(forward);
        ndc.set((pointer.x / canvas.clientWidth) * 2 - 1, -(pointer.y / canvas.clientHeight) * 2 + 1, 0.5).unproject(cam);
        const dir = ndc.sub(cam.position).normalize();
        const dist = focus.clone().sub(cam.position).dot(forward) / Math.max(dir.dot(forward), 1e-4);
        cursorWorld.copy(cam.position).addScaledVector(dir, dist - 0.45);
        cursorI = damp(cursorI, pointer.active ? 1 : 0, pointer.active ? 5 : 2.5, dt);
        field!.setCursor(cursorWorld, cursorI);
        // the grains leaving the sand: from the chaos's shell, then the ball's; thinning over the desk; none on the index
        {
          const cs = field!.material.uniforms.uChaosSize.value as THREE.Vector3;
          const chaosR = 0.5 * Math.min(cs.x, cs.y, cs.z);
          const ballR = field!.material.uniforms.uBallR.value as number;
          const pg = progressRef.current;
          const density = !hero ? DRIFT.hero
            : THREE.MathUtils.lerp(DRIFT.hero, DRIFT.desk, ease(pg, TL.pullback)) * (1 - ease(pg, [TL.push[0], TL.push[0] + 0.06]));
          const r = THREE.MathUtils.lerp(chaosR, ballR * 1.05, state.compact);
          const um = field!.material.uniforms;
          // the sand's own grain size (its largest grain x its look's scale x the tier's count scale), typical grain
          const grainR = (um.uRadMax.value as number) * (um.uCountScale.value as number) * 0.7
            * THREE.MathUtils.lerp((um.uRadScale.value as THREE.Vector2).x, (um.uRadScale.value as THREE.Vector2).y, state.compact);
          drift.update(state.time, focus, r, reduced ? density * 0.5 : density, r * 3.5, grainR,
            new THREE.Vector3(1.0, 0.9, 0.82).multiplyScalar(5.0 * cursorI));
        }
        if (!reduced) {
          paint!.update(stage!.renderer, dt);
          field!.setPaint(paint!.texture, canvas.clientWidth, canvas.clientHeight);
        }
        wordmark?.setPaint(reduced ? null : paint!.texture, canvas.width, canvas.height);
        wordmark?.update(dt, reduced || still);
        if (composite && !filterParam && !calibrating) {
          const toDesk = pullback ? THREE.MathUtils.smoothstep(span(progressRef.current, TL.pullback), 0.15, 0.85) : 0;
          const chaos = FILTER.chaos + (FILTER.desk - FILTER.chaos) * toDesk;
          composite.sigma = chaos + (FILTER.ball - chaos) * state.compact;
        }
        field!.update(state);
      });
      stage.start();
      (window as unknown as { __sand?: unknown }).__sand = { stage, field, state };   // lab debugging
    })().catch((err) => {
      setStatus(String(err));
      setFallback(true);
    });

    return () => {
      disposed = true;
      for (const [type, fn] of listeners) {
        if (type === "__leave") document.documentElement.removeEventListener("mouseleave", fn);
        else window.removeEventListener(type, fn);
      }
      paint?.dispose();
      wordmark?.dispose();
      field?.dispose();
      stage?.dispose();
    };
  }, [compare, hero]);

  useEffect(() => {
    if (!fallback) return;
    const onScroll = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      setStillBall(window.scrollY / max > 0.5);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [fallback]);

  if (fallback && !compare) {
    return (
      <div className="bg-black" style={{ height: "400vh" }} data-testid="sand-fallback">
        {(["chaos", "ball"] as const).map((k) => (
          // eslint-disable-next-line @next/next/no-img-element -- lab fallback stills
          <img
            key={k}
            src={`${SAND_BASE}/targets/${k}.jpg`}
            alt=""
            className="fixed inset-0 h-screen w-screen object-cover transition-opacity duration-700"
            style={{ opacity: (k === "ball") === stillBall ? 1 : 0 }}
          />
        ))}
      </div>
    );
  }

  if (compare) {
    return (
      <div className="fixed inset-0 grid place-items-center bg-black">
        <div className="relative" style={{ width: "min(100vw, 160vh)", aspectRatio: "16 / 10" }}>
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" data-testid="sand-canvas" />
          {/* eslint-disable-next-line @next/next/no-img-element -- a lab overlay, compared pixel for pixel */}
          <img
            src={`${SAND_BASE}/targets/${compare}.jpg`}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full"
            style={{ clipPath: `inset(0 0 0 ${split}%)` }}
            data-testid="sand-target"
          />
          <div className="pointer-events-none absolute inset-y-0 w-px bg-white/60" style={{ left: `${split}%` }} data-testid="sand-split" />
          <div className="absolute left-3 top-3 font-mono text-[11px] uppercase tracking-wider text-white/70">
            live ← | → render · {compare} · {status}
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={split}
            onChange={(e) => setSplit(Number(e.target.value))}
            aria-label="Split between the live sand and the render"
            className="absolute bottom-4 left-1/2 w-1/2 -translate-x-1/2"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black" style={{ height: hero ? `${PAGE_VH}vh` : "400vh" }}>
      <canvas ref={canvasRef} className="fixed inset-0 h-screen w-screen" data-testid="sand-canvas" />
      {hero && <WorkIndex bind={bindIndex} />}
      {hero ? (
        <HeroOverlay
          exit={readExit} scrolled={readScrolled}
          enter={readEnter} leave={readLeave21} enter2={readEnter22} leave2={readLeave22} enter3={readEnter23} leave3={readLeave23}
        />
      ) : (
        <div className="pointer-events-none fixed left-3 top-3 font-mono text-[11px] uppercase tracking-wider text-white/60">
          sand lab · {status}
        </div>
      )}
    </div>
  );
}
