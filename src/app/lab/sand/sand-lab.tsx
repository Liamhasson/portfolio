"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Stage } from "@/three/stage";
import { loadSand, SAND_BASE } from "@/three/sand/data";
import { SAND_LOOK, SandField, type SandState } from "@/three/sand/sand-field";
import { PaintField } from "@/three/sand/paint";
import { Wordmark } from "@/three/sand/wordmark";
import { HeroOverlay } from "./hero-overlay";
import { BallShadow } from "@/three/sand/ball-shadow";
import { FrostSkin } from "@/three/sand/frost-skin";
import { attemptAt } from "@/three/sand/attempts";
import { BakedDesk } from "@/three/sand/baked-desk";
import { revealAt } from "@/three/sand/screen-reveal";
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
} as const;
/**
 * The page's length. Progress is measured in units of the first 1600vh of scroll (the timeline above was laid out on
 * a 1700vh page), so each chapter added after it keeps the earlier ones' pace.
 */
const PAGE_VH = 2000;
const PROGRESS_SCALE = (PAGE_VH - 100) / 1600;
/**
 * The descend (lookdev.py deskmove --move descend, 100 frames): the scroll carries the camera to its arrival (frame 66,
 * where the view settles); the lid opens on the way (frames 27-60), the low view's fill rises (31-66), and the screen
 * wakes at frame 50 and plays the index's reveal in time, as a real screen would (scroll back up and it sleeps).
 */
const DESCEND = { arrive: 65, wake: 49, lid: [0.26, 0.6], open: [0.3, 0.66], openDeg: 108 } as const;
/** The low view's fill (lookdev.py: area light, 0.9 m, 38 W), lighting the sand from the camera's side. */
const SIDE_FILL = { pos: [1.35, -0.95, 0.45], watts: 38, color: [1.0, 0.86, 0.72], radius: 4.5 };
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
      if (disposed) return;
      // the screen's reveal: seconds since it woke; and how far it has gone back to sleep (scrolling back up)
      let revealT = 0, sleep = 1;
      // ?dsframe=N holds the camera on a descend frame; ?reveal=S holds the screen's reveal at S seconds (calibration)
      const dsFrame = Number(new URLSearchParams(window.location.search).get("dsframe") || NaN);
      const holdDescend = Number.isFinite(dsFrame);
      const lidHold = Number(new URLSearchParams(window.location.search).get("lid") || NaN);   // ?lid=deg (calibration)
      const revealHold = Number(new URLSearchParams(window.location.search).get("reveal") || NaN);
      let fillGain = 1;
      (window as unknown as { __fill?: (g: number) => void }).__fill = (g) => { fillGain = g; };
      (window as unknown as { __desk3d?: unknown }).__desk3d = desk3d;
      // 2.2: the frost skin that grows out of the sand inside each attempt
      const frost = hero && !compare ? new FrostSkin(field.material) : null;
      if (frost) {
        frost.mesh.layers.set(SAND_LAYER);
        stage.scene.add(frost.mesh);
        (window as unknown as { __frost?: (l: Parameters<FrostSkin["setLook"]>[0]) => void }).__frost = (l) => frost.setLook(l);
      }
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
          const move = descend && ds > 0 ? descend : rise && rt > 0 ? rise : settle && st > 0 ? settle : pullback;
          const f = move === descend ? (Number.isFinite(dsFrame) ? dsFrame - 1 : ds * DESCEND.arrive)
            : move === rise ? rt * (rise.data.frames - 1) : move === settle ? st * (settle!.data.frames - 1) : t * (pullback.data.frames - 1);
          if (rise) {
            rise.plate.visible = move === rise;
            // the ball rides the rise: up off the desk, rolling forward 45 degrees (scroll turns the ball); then the
            // descend carries it beside the laptop, still turned
            const fi = Math.min(Math.max(Math.round(f), 0), rise.data.frames - 1);
            const fr = rise.data.path[move === rise ? fi : 0] as unknown as { ball: number[]; ball_roll: number };
            const end = rise.data.path[rise.data.frames - 1] as unknown as { ball_roll: number };
            if (move === descend && descend) {
              const a = descend.data.path[Math.min(Math.floor(f), descend.data.frames - 2)] as unknown as { ball: number[] };
              const b = descend.data.path[Math.min(Math.floor(f) + 1, descend.data.frames - 1)] as unknown as { ball: number[] };
              field!.setBallTarget(descend.toHero(a.ball).lerp(descend.toHero(b.ball), f - Math.floor(f)), 0.07 / descend.data.chaos_scale);
              state.ballRoll = end.ball_roll;
            } else {
              field!.setBallTarget(rise.toHero(fr.ball), 0.07 / rise.data.chaos_scale);
              state.ballRoll = move === rise ? fr.ball_roll : 0;
            }
          }
          // 2.3's arrival: the lid opens, the low view's fill rises, the screen wakes and plays the index's reveal
          let openF = 0;
          if (desk3d) {
            const tb = move === descend ? f / (descend!.data.frames - 1) : 0;
            openF = ease(tb, DESCEND.open);
            desk3d.setLid(Number.isFinite(lidHold) ? lidHold : DESCEND.openDeg * ease(tb, DESCEND.lid));
            const awake = move === descend && f >= DESCEND.wake;
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
          const [lo, brk, dep] = attemptAt(span(progressRef.current, TL.attempts));
          field!.setAttempt(span(progressRef.current, TL.attempts) > 0 ? lo : 1, brk, dep);
          const v = move.view(f);
          stage!.setView(v.position, v.quaternion, v.lens);
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
          if (shadow && deskNow) {
            // the lamp's real size (0.2 m soft radius, 2 hero units) sets the softness; ~85% of the desk's light is the lamp
            const ballC = field!.material.uniforms.uBallC.value as THREE.Vector3;
            const k = move !== pullback ? shadowK[1] * state.compact : 0;
            const ballR = field!.material.uniforms.uBallR.value * shadowK[2];
            // on the 3D desk the shadow falls on whatever the lamp lights (the laptop too); on the plates, a plane
            if (desk3d) { desk3d.setBallShadow(ballC, ballR, deskNow.lights[0].pos, shadowK[0], k); shadow.update(ballC, ballR, deskNow.lights[0].pos, shadowK[0], 0); }
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
      {hero ? (
        <HeroOverlay
          exit={readExit} scrolled={readScrolled}
          enter={readEnter} leave={readLeave21} enter2={readEnter22} leave2={readLeave22} enter3={readEnter23}
        />
      ) : (
        <div className="pointer-events-none fixed left-3 top-3 font-mono text-[11px] uppercase tracking-wider text-white/60">
          sand lab · {status}
        </div>
      )}
    </div>
  );
}
