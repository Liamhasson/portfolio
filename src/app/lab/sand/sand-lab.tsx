"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Stage } from "@/three/stage";
import { loadSand, SAND_BASE } from "@/three/sand/data";
import { CURSOR_WARM, SAND_LOOK, SandField, type SandState } from "@/three/sand/sand-field";
import { PaintField } from "@/three/sand/paint";
import { Wordmark } from "@/three/sand/wordmark";
import { HeroOverlay } from "./hero-overlay";
import { WorkIndex, type WorkIndexHandle } from "./work-index";
import { BakedDesk } from "@/three/sand/baked-desk";
import { revealAt } from "@/three/sand/screen-reveal";
import { DriftGrains } from "@/three/sand/drift-grains";
import { vortexOnBall } from "@/three/sand/hero-layout";
import { stepParallax } from "@/three/sand/parallax";
import { ballKeyPos } from "@/three/sand/ball-light";
import { SAND_ENCODE, SAND_LAYER, SandComposite } from "@/three/sand/sand-composite";
import { Pullback } from "@/three/sand/pullback";
import { BEATS, SCREEN_HOLD, STORY_SCREENS, ease, pAtFrame, reducedStory, shotFrame, snapIn, span, storyProgress, type ShotMeta } from "@/three/sand/story-timeline";
import { glideTo } from "@/lib/smooth-scroll";
import { RisingSand } from "@/three/sand/rising-sand";
import { vortexStreams } from "@/three/sand/vortex-streams";
import { FilmGradePass } from "@/three/sand/film-grade-pass";
import * as THREE from "three";
import { parseTierOverride, pickTier, readSignals, settingsFor } from "@/three/tier";

type CompareTarget = "chaos" | "mid" | "ball";
const COMPACT_FOR: Record<CompareTarget, number> = { chaos: 0, mid: 0.5, ball: 1 };

/** Scroll progress (0..1 over the page) to compaction: hold the chaos, pull it in, hold the ball. */
function compactFor(progress: number): number {
  const t = Math.min(Math.max((progress - 0.12) / 0.7, 0), 1);
  return t * t * (3 - 2 * t);
}

/** The story's length (spec 2026-10-11 §3): the index settles at STORY_SCREENS, holds for SCREEN_HOLD screens (the long
 *  way back out), then the page runs on through it. */
const PAGE_VH = (STORY_SCREENS + SCREEN_HOLD) * 100 + 100;
/** The frame the screen wakes on (0-based; the shot's camera.json). */
let WAKE_FRAME = 136;
const SHOT_BASE = "/lab/shot";
/** The hero's per-grain depth of field (sand-field.ts uDof at SAND_LOOK.dofFstop): gentle, never the screen-door dither. */
const HERO_GRAIN_DOF = 0.5;
/** (the removed cloud passage and front key, held off) */
const NO_AXIS = new THREE.Vector3(0, 0, 1), NO_KEY = new THREE.Vector3();
/** The open laptop's fill (lookdev.py: area light, 0.9 m, 38 W, rising with the lid), lighting the sand too. */
const SIDE_FILL = { pos: [1.35, -0.95, 0.45], watts: 38, color: [1.0, 0.86, 0.72], radius: 4.5 };
/**
 * The scene leans with the cursor (Lusion's camera, read from their code 2026-10-10): the camera turns toward it by up to
 * LEAN radians (their about hero settles at 0.035), closing 10% of the gap each 60 fps frame; the scene moves the way
 * the cursor goes. A finger leans it while it touches. It eases out where precision matters: the passage through
 * the cloud, the index taking over the screen.
 */
const LEAN = 0.035;
const LEAN_DAMP = -Math.log(1 - 0.1) * 60;   // their per-frame 0.1 at 60 fps, as a rate
/** The floating grains' density through the page (Liam: strong in the hero, sparse over the desk, none on the index). */
const DRIFT = { hero: 1, desk: 0.12 } as const;

/** Frame-rate-independent damping toward a target. */
function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

export function SandLab({ hero }: { hero: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [compare] = useState<CompareTarget | null>(() => {
    const v = new URLSearchParams(window.location.search).get("compare");
    return v === "chaos" || v === "mid" || v === "ball" ? v : null;
  });
  const [split, setSplit] = useState(50);
  // ?hero (the story): from the page's request, never window.location (stale during a client-side navigation)
  // the final grade over the scene (film-grade.tsx); ?grade=0: the raw frame
  const [gradeOn] = useState(() => new URLSearchParams(window.location.search).get("grade") !== "0");
  const compactRef = useRef(0);
  const progressRef = useRef(0);   // damped scroll progress 0..1
  // the hero copy: in the lab's compaction mode it leaves as the ball forms; on the hero page, as the pull-back begins
  const readExit = useCallback(
    () => (hero ? span(progressRef.current, BEATS.copyOut) : Math.min(Math.max((compactRef.current - 0.6) / 0.3, 0), 1)),
    [hero],
  );
  const readScrolled = useCallback(() => progressRef.current, []);
  const indexRef = useRef<WorkIndexHandle | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const projectsRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
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
      const hazeOn = new URLSearchParams(window.location.search).get("haze") !== "0";
      const dofOn = new URLSearchParams(window.location.search).get("dof") !== "0";
      const FILTER = { chaos: 0.5, ball: 0.28, desk: 0.525 };
      if (filterParam !== "0") {
        const comp = new SandComposite();
        composite = comp;
        if (filterParam) comp.sigma = Number(filterParam);
        field.points.layers.set(SAND_LAYER);
        field.material.uniforms.uOutScale.value = 1 / SAND_ENCODE;
        stage.camera.layers.enable(SAND_LAYER);
        stage.renderFrame = (r, sc, cam) => comp.render(r, sc, cam);
        // the film grade, in WebGL (film-grade-pass.ts; ?grade=0: the raw frame)
        if (gradeOn) {
          new THREE.TextureLoader().loadAsync("/lab/grain.png").then((t) => {
            if (disposed) return;
            comp.grade = new FilmGradePass(t);
            comp.gradeStill = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          }).catch(() => {});
        }
        (window as unknown as { __sandFilter?: (s: number) => void }).__sandFilter = (s) => { comp.sigma = s; };
        // the hero's haze: its key lighting the air (blender/lookdev/cinematic_variants.py CINE_PLATE=1); ?haze=0: none
        if (hazeOn) {
          Promise.all([
            new THREE.TextureLoader().loadAsync(`${SAND_BASE}/haze-hero.png`),
            fetch(`${SAND_BASE}/haze-hero.json`).then((r) => r.json() as Promise<{ scale: number }>),
          ]).then(([texture, { scale }]) => {
            texture.colorSpace = THREE.NoColorSpace;   // display values, as rendered
            comp.haze = { texture, scale };
          }).catch(() => {});
        }
      }
      // the story's one shot (blender/lookdev/shot_path.py), over the 3D desk
      const shot = hero && !compare ? await Pullback.load(SHOT_BASE, false) : null;
      const shotMeta = shot?.data as unknown as ShotMeta | undefined;
      if (shotMeta) WAKE_FRAME = shotMeta.wake_frame - 1;
      if (disposed) return;
      // the desk and the sand rising off it load behind the hero (it isn't seen until the tilt): loadDesk, below
      let deskLoaded: BakedDesk | null = null;
      let risingLoaded: RisingSand | null = null;
      // the screen's reveal: seconds since it woke; and how far it has gone back to sleep (scrolling back up)
      let revealT = 0, sleep = 1;
      const indexMix = Number(new URLSearchParams(window.location.search).get("indexmix") || NaN);   // calibration: the index's opacity
      const holdFrame = Number(new URLSearchParams(window.location.search).get("shotframe") || NaN);   // calibration: hold a shot frame
      const lidHold = Number(new URLSearchParams(window.location.search).get("lid") || NaN);   // ?lid=deg (calibration)
      const revealHold = Number(new URLSearchParams(window.location.search).get("reveal") || NaN);
      let fillGain = 1;
      (window as unknown as { __fill?: (g: number) => void }).__fill = (g) => { fillGain = g; };
      // grains leaving the sand: the scene's atmosphere (drift-grains.ts)
      const drift = new DriftGrains(field.material, tier === "low" ? 600 : 1600);
      if (new URLSearchParams(window.location.search).get("streams") === "0") drift.streams = 0;   // compare: all loose
      // the streams: in from beyond the frame into the vortex, and flung out of it (vortex-streams.ts; Liam, 2026-10-11);
      // ?curves=0: each stream finds its own way
      if (new URLSearchParams(window.location.search).get("curves") !== "0") drift.curves = vortexStreams();
      if (new URLSearchParams(window.location.search).get("grainshadow") === "0") drift.material.uniforms.uGrainShadow.value = 0;   // compare: unshadowed
      drift.mesh.layers.set(SAND_LAYER);
      stage.scene.add(drift.mesh);
      const lean = new THREE.Vector2();     // the eased lean, -1..1 each way
      let spacerTick = 0;
      let riseClock = 0;
      // the desk's top as a rectangle in the hero's units (x, z) and its height, for keeping the top view inside it
      let deskTop: { min: THREE.Vector2; max: THREE.Vector2; y: number } | null = null;
      // the desk, then the rising sand: textures uploaded and shaders compiled before they join the scene (no hitch as
      // the camera tilts onto them); started once the hero is running
      const loadDesk = async () => {
        if (!shot) return;
        const st = stage!;
        const d = await BakedDesk.load(st.renderer);
        if (disposed) return;
        d.group.traverse((o) => {
          const mats = (o as THREE.Mesh).material;
          for (const m of Array.isArray(mats) ? mats : mats ? [mats] : []) {
            for (const v of Object.values(m as unknown as Record<string, unknown>)) if (v instanceof THREE.Texture) st.renderer.initTexture(v);
          }
        });
        await st.renderer.compileAsync(d.group, st.camera, st.scene).catch(() => {});
        if (disposed) return;
        st.scene.add(d.group);
        d.group.updateMatrixWorld(true);
        const top = d.group.getObjectByName("bake_desk_top");
        if (top) {
          const b = new THREE.Box3().setFromObject(top);
          deskTop = { min: new THREE.Vector2(b.min.x, b.min.z), max: new THREE.Vector2(b.max.x, b.max.z), y: b.max.y };
        }
        deskLoaded = d;
        (window as unknown as { __desk3d?: unknown }).__desk3d = d;
        const spots = await RisingSand.loadSpots(`${SAND_BASE}/desk-spill.bin`, shot.data.chaos_center, shot.data.chaos_scale).catch(() => null);
        if (disposed || !spots) return;
        const r = new RisingSand(field!.material, spots, { high: 900, mid: 700, low: 400 }[tier]);   // a few single grains (Liam: Lusion's floor)
        r.mesh.layers.set(SAND_LAYER);
        await st.renderer.compileAsync(r.mesh, st.camera, st.scene).catch(() => {});
        if (disposed) return;
        st.scene.add(r.mesh);
        risingLoaded = r;
        (window as unknown as { __sand?: { rising?: RisingSand } }).__sand!.rising = r;
      };
      const leanQ = new THREE.Quaternion(), leanE = new THREE.Euler();
      // the shadow: lamp radius (hero units), strength, and the ball's effective solid size (its edge is sparse sand)
      const shadowK = [1.2, 0.9, 0.7];   // chosen by eye against the settle target (2026-10-09)
      (window as unknown as { __pbShadow?: (a: number, b: number, c: number) => void }).__pbShadow = (a, b, c) => { shadowK.splice(0, 3, a, b, c); };
      const heroLights = field.heroLights();
      const g = field.lookGains;
      // the desk set, calibrated 2026-10-09 against the pull-back render with sand at frame 60 (scripts/lab/pb-calib.mjs)
      // the desk set, fitted 2026-10-09 against the Cycles pull-back render at frame 60 (lamp alone, then with the rim;
      // scripts/lab/fit_desk_light.py). The lamp's cone is wider and softer than its Blender settings suggest (116°,
      // blend 1): Cycles lit the whole cloud. The desk bounce adds nothing in Cycles, so it is off.
      let desk = shot?.deskLights(g.wattsToIrradiance, [0.244, 1.0, 0], { radii: [0.573, 1.2, 3.0], spotDeg: 116, blend: 1.0 });
      const DESK_LOOK = { exposure: 0.38, shadowKChaos: 0.602, wrap: 0.375, bounce: 0.12, localOcclusion: 0.016, spec: 0.016, radScaleChaos: 1.44 };
      (window as unknown as { __deskLook?: (l: Partial<typeof DESK_LOOK>) => void }).__deskLook = (l) => Object.assign(DESK_LOOK, l);   // calibration
      // the formed ball on the desk, fitted against the Cycles target at the settle's end (scripts/lab/fit_ball.py):
      // a slightly stronger lamp, and the lamp-lit desk below as a broad light (setGround)
      // the cinematic look on the desk (Liam, 2026-10-11, picked blender/lookdev/renders/cinematic-set-settle-new.png):
      // the lamp's own light and shadow on the formed ball, fitted live to it (ball p50 0.19 vs 0.14, saturation 0.72 vs
      // 0.71; the new palette is lighter, so the desk takes a lower exposure)
      const BALL_LOOK = { shadowK: 0.571, cavity: 0.3, cavityDepth: 0.071, wrap: 0.15, bounce: 0.06, spec: 0.15, radScale: 1.0 };
      (window as unknown as { __ballLook?: (l: Partial<typeof BALL_LOOK>) => void }).__ballLook = (l) => Object.assign(BALL_LOOK, l);   // calibration
      const deskBall = shot?.deskLights(g.wattsToIrradiance, [0.305, 1.0, 0], { radii: [0.573, 1.2, 3.0], spotDeg: 116, blend: 1.0 });
      // lab calibration: __pbGains sets the desk lights' gains
      let lampSat = 0.2;
      const groundCol = new THREE.Vector3(1.0, 0.7, 0.406).multiplyScalar(0.444);
      (window as unknown as { __pbGround?: (g: number, c: number) => void }).__pbGround = (g, c) => { groundCol.set(1.0, c, c * 0.58).multiplyScalar(g); };
      // the cloud's underside and shadowed front over the desk (Liam, 2026-10-10: never in the dark): the desk's bounce
      // reaches the loose sand near it, and a soft warm fill from the viewer's side lifts what the lamp misses
      const LIFT = { fill: 0.06, reach: 1.2, ground: 4.0, groundBall: 0.3 };   // groundBall 2.0 -> 0.3: the formed ball in the lamp's shadows (the cinematic look)
      const fillCol = new THREE.Vector3(1.0, 0.78, 0.6);
      (window as unknown as { __lift?: (l: Partial<typeof LIFT>) => void }).__lift = (l) => Object.assign(LIFT, l);
      (window as unknown as { __pbSat?: (v: number) => void }).__pbSat = (v) => { lampSat = v; };
      const calibrating = Number.isFinite(holdFrame);
      let pbOpts: Parameters<Pullback["deskLights"]>[2] = {};
      (window as unknown as { __pbGains?: (a: number, b: number, c: number, o?: typeof pbOpts) => void }).__pbGains = (a, b, c, o) => {
        if (o) pbOpts = o;
        desk = shot?.deskLights(g.wattsToIrradiance, [a, b, c], pbOpts);
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
      // the vortex's heart on the ball (Liam, 2026-10-12: where the ball will form, so it transforms smoothly)
      if (hero) {
        const c = field.material.uniforms.uChaosC.value as THREE.Vector3, b = field.material.uniforms.uBallC.value as THREE.Vector3;
        (field.material.uniforms.uChaosShift.value as THREE.Vector3).set(...vortexOnBall([c.x, c.y, c.z], [b.x, b.y, b.z]));
      }

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

      // warm-up: every texture uploaded and every shader compiled now, not the first frame each comes into view (Liam,
      // 2026-10-10: the pull-back stuttered as the desk arrived: 25-50 ms frames as its textures and materials loaded)
      {
        const st = stage, hidden: THREE.Object3D[] = [], culled: THREE.Object3D[] = [];
        st.scene.traverse((o) => {
          if (!o.visible) { hidden.push(o); o.visible = true; }
          if (o.frustumCulled) { culled.push(o); o.frustumCulled = false; }   // (drawn below wherever the camera is)
          const mats = (o as THREE.Mesh).material;
          for (const m of Array.isArray(mats) ? mats : mats ? [mats] : []) {
            for (const v of Object.values(m as unknown as Record<string, unknown>)) if (v instanceof THREE.Texture) st.renderer.initTexture(v);
            const u = (m as THREE.ShaderMaterial).uniforms;
            if (u) for (const { value } of Object.values(u)) if (value instanceof THREE.Texture) st.renderer.initTexture(value);
          }
        });
        // each pass sees its own layers (and with them its own lights: a different shader), drawn to the screen or into
        // a target (another variant again): every combination the composite uses, compiled now
        const cam = st.camera.clone();
        const masks = [cam.layers.mask, 1 << SAND_LAYER, cam.layers.mask & ~(1 << SAND_LAYER), 0xffffffff];
        const tmp = new THREE.WebGLRenderTarget(4, 4, { type: THREE.UnsignedByteType });
        tmp.texture.colorSpace = THREE.NoColorSpace;
        for (const target of [null, tmp]) {
          st.renderer.setRenderTarget(target);
          for (const m of masks) {
            cam.layers.mask = m;
            await st.renderer.compileAsync(st.scene, cam).catch(() => {});
          }
        }
        st.renderer.setRenderTarget(null);
        tmp.dispose();
        await composite?.warm(st.renderer, st.scene, st.camera).catch(() => {});
        for (const o of hidden) o.visible = false;
        for (const o of culled) o.frustumCulled = true;
      }
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      // ?still: no ambient motion (drift, spin), so a test isolates what the cursor does
      const still = new URLSearchParams(window.location.search).has("still");
      let lastScroll = window.scrollY;
      // the snap into the screen: carrying the page in (Liam, 2026-10-11), and the progress a frame ago (its direction)
      let snapping = false, lastRawP = 0;
      let cursorLean: [number, number] = [0, 0];   // the vortex's lean toward the cursor (NDC, parallax.ts)
      let spinVel = 0;

      // the cursor: a light (Lusion model) and, unless motion is reduced, a soft drift
      paint = new PaintField();
      const sizePaint = () => {
        paint!.setSize(canvas.clientWidth, canvas.clientHeight);
        field!.setPaint(paint!.texture, canvas.clientWidth, canvas.clientHeight);
      };
      sizePaint();
      stage.onSettings(sizePaint);
      // ?flow=0 / ?mblur=0: compare without the flow between chaos and ball, or without the grains' own blur (a number
      // sets its strength)
      const flowParam = Number(params.get("flow") ?? NaN), blurParam = Number(params.get("mblur") ?? NaN);
      const baseLook: Partial<typeof SAND_LOOK> = {
        ...(reduced ? { paintScale: 0 } : {}),
        ...(Number.isFinite(flowParam) ? { flow: SAND_LOOK.flow * flowParam } : {}),
        ...(Number.isFinite(blurParam) ? { motionBlur: blurParam } : {}),
      };
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
      const chaosC0 = field.material.uniforms.uChaosC.value as THREE.Vector3;
      const chaosShift = field.material.uniforms.uChaosShift.value as THREE.Vector3;
      const chaosC = new THREE.Vector3();   // where the cloud stands (moved right of the copy in the hero)
      const ballC = field.material.uniforms.uBallC.value as THREE.Vector3;

      stage.onFrame((dt) => {
        const desk3d = deskLoaded, rising = risingLoaded;
        chaosC.addVectors(chaosC0, chaosShift);
        // (the story's own length: past it, the page runs on through the index's projects)
        const max = Math.max(1, (pageRef.current?.offsetHeight ?? document.documentElement.scrollHeight) - window.innerHeight);
        const progress = Math.min(window.scrollY / max, 1);
        // the story's end is where the index's anchor is (#projects), measured, not assumed: on phones vh is the large
        // viewport while innerHeight shrinks under the URL bar, so a jump to the anchor must still land on the end
        const storyEnd = hero && projectsRef.current ? Math.max(1, projectsRef.current.getBoundingClientRect().top + window.scrollY) : max;
        const rawP = hero ? storyProgress(window.scrollY, storyEnd) : progress;
        // very close to the screen, scrolling down: the page carries the user in, onto the projects (none of them can be
        // clicked on the laptop's screen); the way back out is long (story-timeline.ts SCREEN_HOLD)
        if (hero && !snapping && snapIn(rawP, lastRawP)) {
          snapping = true;
          const left = Math.max(storyEnd - window.scrollY, 0) / window.innerHeight;
          glideTo(storyEnd, Math.min(Math.max(0.5 + left * 0.45, 0.6), 1.3), () => { snapping = false; }, reduced);
        }
        if (snapping && (rawP >= STORY_SCREENS || window.scrollY >= storyEnd - 2)) snapping = false;   // (no smooth scroller: landed)
        lastRawP = rawP;
        if (hero && reduced) {
          // reduced motion (spec §8): held states joined by crossfades through black, no shot
          const r = reducedStory(rawP);
          progressRef.current = r.p;
          if (veilRef.current) veilRef.current.style.opacity = String(r.veil);
        } else progressRef.current = damp(progressRef.current, rawP, 6, dt);
        if (Number.isFinite(holdFrame) && shotMeta) progressRef.current = pAtFrame(holdFrame - 1, shotMeta.beats);
        const p = progressRef.current;
        state.compact = shot
          ? (() => { const x = span(p, BEATS.compact); return x * x * (3 - 2 * x); })()
          : damp(state.compact, compactFor(progress), 6, dt);
        compactRef.current = state.compact;
        if (shot && shotMeta && desk) {
          const deskNow = desk;
          const f = shotFrame(p, shotMeta.beats);
          // the light moves to the lamp as the camera tilts onto the desk (the ball is leaving the frame: unseen)
          const h = ease(p, BEATS.tilt);
          if (!calibrating) {
            const mixLook: Record<string, number> = {};
            for (const [key, v] of Object.entries(DESK_LOOK)) {
              const from = SAND_LOOK[key as keyof typeof SAND_LOOK] as number;
              mixLook[key] = from + (v - from) * h;
            }
            for (const [key, v] of Object.entries(BALL_LOOK)) {
              const from = mixLook[key] ?? (SAND_LOOK[key as keyof typeof SAND_LOOK] as number);
              mixLook[key] = from + (v - from) * state.compact;
            }
            field!.setLook({ ...baseLook, ...mixLook });
          }
          state.ballRoll = 0;
          // the lid and the screen, from the shot (the tail's own angles and wake)
          let openF = 0;
          if (desk3d) {
            const P = shot.data.path as unknown as { lid_open_deg: number }[];
            const fi = Math.min(Math.floor(f), shotMeta.frames - 2), fr = f - fi;
            const lidDeg = P[fi].lid_open_deg + (P[fi + 1].lid_open_deg - P[fi].lid_open_deg) * fr;
            openF = lidDeg / 108;
            desk3d.setLid(Number.isFinite(lidHold) ? lidHold : lidDeg);
            const awake = f >= WAKE_FRAME;
            if (Number.isFinite(revealHold)) { revealT = revealHold; sleep = 0; }
            else if (awake) { sleep = Math.max(sleep - dt / 0.35, 0); if (sleep === 0 || revealT > 0) revealT += dt; }
            else { sleep = Math.min(sleep + dt / 0.35, 1); if (sleep === 1) revealT = 0; }
            const rf = revealAt(revealT);
            rf.wake = Math.max(rf.wake, sleep);
            rf.light *= 1 - sleep;
            desk3d.setScreen(rf);
            desk3d.setState(openF, rf.light);
          }
          const v = shot.view(f);
          stage!.setView(v.position, v.quaternion, v.lens);
          const cam = stage!.camera;
          const W = canvas.clientWidth || 1, H = canvas.clientHeight || 1;
          // portrait phones see far more height: the tilt goes further there so the ball leaves the frame (spec §10)
          {
            const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2), tanV16 = 18 / v.lens / 1.6;   // (16:10, horizontal fit: the shot's own frame)
            const extra = Math.max(Math.atan(tanV) - Math.atan(tanV16), 0) * ease(p, BEATS.tilt) * (1 - ease(p, BEATS.glide));
            if (extra > 1e-4) { cam.quaternion.multiply(leanQ.setFromEuler(leanE.set(-extra, 0, 0, "YXZ"))); cam.updateMatrixWorld(); }
          }
          // the lean: toward the cursor, eased; out as the index takes over
          {
            const want = pointer.active
              ? new THREE.Vector2(Math.min(Math.max((pointer.x / W) * 2 - 1, -1), 1), Math.min(Math.max(1 - (pointer.y / H) * 2, -1), 1))
              : new THREE.Vector2();
            lean.lerp(reduced || calibrating ? new THREE.Vector2() : want, 1 - Math.exp(-LEAN_DAMP * dt));
            const w = 1 - ease(p, [BEATS.takeover[0] - 0.02, BEATS.takeover[1]]);
            if (w > 0.0001) {
              leanE.set(-lean.y * LEAN * w, lean.x * LEAN * w, 0, "YXZ");
              cam.quaternion.multiply(leanQ.setFromEuler(leanE));
              cam.updateMatrixWorld();
            }
          }
          // 3: the live index over the screen's quad, crossfading in where they coincide, then settling into the view
          const ix = indexRef.current;
          if (ix && desk3d) {
            const pt = Math.min(Math.max((f - shotMeta.screen_from) / (shotMeta.frames - 1 - shotMeta.screen_from), 0), 1);
            const take = ease(span(p, BEATS.takeover), [0, 1]);
            const sett = ease(span(p, BEATS.indexIn), [0, 1]);
            const portrait = W / H < 1;
            const project = () => (desk3d.screenCorners() ?? []).map((q0) => {
              const q = q0.clone().project(cam);
              return [(q.x + 1) / 2 * W, (1 - q.y) / 2 * H] as [number, number];
            });
            if (pt > 0 && portrait) {
              const xs = project().map((q) => q[0]);
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
              const { w, h: ih } = ix.size();
              if (portrait) {
                ix.place(proj as [[number, number], [number, number], [number, number], [number, number]]);
                const xs = proj.map((q) => q[0]), ys = proj.map((q) => q[1]);
                const r0 = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
                const g2 = ease(sett, [0, 0.55]);
                ix.panel(take > 0.999 ? { x: r0.x * (1 - g2), y: r0.y * (1 - g2), w: r0.w + (W - r0.w) * g2, h: r0.h + (H - r0.h) * g2 } : null);
                ix.show((Number.isFinite(indexMix) ? indexMix : take) * (1 - ease(sett, [0.05, 0.35])));
                ix.list(ease(sett, [0.4, 1]));
                ix.interactive(sett > 0.999 ? "list" : "none");
              } else {
                const s = Math.min(W / w, H / ih), cw = w * s, ch = ih * s, x0 = (W - cw) / 2, y0 = (H - ch) / 2;
                const rest: [number, number][] = [[x0, y0], [x0 + cw, y0], [x0 + cw, y0 + ch], [x0, y0 + ch]];
                const quad = proj.map((q, i) => [q[0] + (rest[i][0] - q[0]) * sett, q[1] + (rest[i][1] - q[1]) * sett]) as [[number, number], [number, number], [number, number], [number, number]];
                ix.place(quad);
                let area = 0;
                for (let i = 0; i < 4; i++) { const a = proj[i], b2 = proj[(i + 1) % 4]; area += a[0] * b2[1] - b2[0] * a[1]; }
                const fill = Math.abs(area) / 2 / (W * H) / (Math.min(W / H, 1.6) / Math.max(W / H, 1.6));
                const byFill = THREE.MathUtils.smoothstep(fill, 0.86, 0.98);
                const shown = Number.isFinite(indexMix) ? indexMix : Math.max(Math.min(take, byFill), sett);
                ix.show(shown);
                ix.panel({ x: 0, y: 0, w: W, h: H }, Math.max(shown, sett));
                ix.list(0);
                ix.interactive(sett > 0.999 ? "wide" : "none");
              }
              ix.scroll(Math.max(window.scrollY - storyEnd, 0));
              if (++spacerTick % 20 === 0 && spacerRef.current) {
                const need = `${Math.round(ix.overflow())}px`;
                if (spacerRef.current.style.height !== need) {
                  spacerRef.current.style.height = need;
                  // (the anchor covers the index and its projects, so the nav's Projects is lit while they're in view)
                  if (projectsRef.current) projectsRef.current.style.height = `calc(100vh + ${need})`;
                }
              }
            } else {
              ix.show(0); ix.panel(null); ix.list(0); ix.interactive("none");
            }
          } else if (ix) {
            // the desk not in yet (a jump straight to the projects): the index on its own, settled
            if (p >= BEATS.takeover[0]) {
              if (W / H < 1) {
                ix.place([[0, 0], [W, 0], [W, H], [0, H]]);
                ix.panel({ x: 0, y: 0, w: W, h: H });
                ix.show(0); ix.list(1); ix.interactive("list");
              } else {
                const { w, h: ih } = ix.size();
                const k = Math.min(W / w, H / ih), cw = w * k, ch = ih * k, x0 = (W - cw) / 2, y0 = (H - ch) / 2;
                ix.place([[x0, y0], [x0 + cw, y0], [x0 + cw, y0 + ch], [x0, y0 + ch]]);
                ix.show(1); ix.panel({ x: 0, y: 0, w: W, h: H }, 1); ix.list(0); ix.interactive("wide");
              }
              ix.scroll(Math.max(window.scrollY - storyEnd, 0));
            } else { ix.show(0); ix.panel(null); ix.list(0); ix.interactive("none"); }
          }
          // no cloud passage any more: the cloud's parting off, no defocus; the desk's dim lifts as the lamp finds it
          field!.setCloud(0, 0, NO_AXIS, 0, 0, 0, 1e9, 1e9, 1, 0, 1);
          field!.setFrontKey(NO_KEY);
          if (composite) { composite.defocus = 0; composite.deskDim = 0.6 * (1 - ease(p, [BEATS.tilt[0] + 0.1, BEATS.tilt[1] + 0.1])); }
          // the ball above, out of frame: its shadow on the desk and the hero light's spill around it (spec §8)
          if (desk3d) {
            const ballR = (field!.material.uniforms.uBallR.value as number) * shadowK[2];
            const k = shadowK[1] * state.compact;
            desk3d.setBallShadow(ballC, ballR, deskNow.lights[0].pos, shadowK[0], k, 0, k, k);
            rising?.setShadow(ballC, ballR, deskNow.lights[0].pos, shadowK[0], k);   // the grains in it too (Liam: they looked pasted)
            const below = new THREE.Vector3(ballC.x, deskTop ? deskTop.y : ballC.y - 4.6, ballC.z);
            desk3d.setSpill(below, 2.5, new THREE.Vector3(0.35, 0.26, 0.2).multiplyScalar(state.compact * h));
          }
          field!.setPointScale(stage!.bufferHeight, THREE.MathUtils.degToRad(stage!.camera.fov));
          field!.setGround(groundCol.clone().multiplyScalar(THREE.MathUtils.lerp(LIFT.ground * h, LIFT.groundBall, state.compact)), stage!.camera, fillCol.clone().multiplyScalar(LIFT.fill * h * (1 - state.compact)),
            deskTop ? deskTop.y : -1e3, LIFT.reach);
          field!.setLights(
            heroLights.map((l, i) => {
              const d0 = deskNow.lights[i];
              const db = deskBall && !calibrating ? deskBall.lights[i] : d0;
              const d = { pos: d0.pos, col: d0.col.clone().lerp(db.col, state.compact), r: d0.r };
              if (i === 2 && openF > 0) {
                d.pos = shot.toHero(SIDE_FILL.pos);
                d.col = new THREE.Vector3(...(SIDE_FILL.color as [number, number, number]))
                  .multiplyScalar((SIDE_FILL.watts / (shot.data.chaos_scale ** 2)) * g.wattsToIrradiance * fillGain * openF);
                d.r = SIDE_FILL.radius;
              }
              // the key swings to the ball's left side as it forms (ball-light.ts: the ball read flat; the vortex keeps its light)
              const lp = i === 0 ? new THREE.Vector3(...ballKeyPos([l.pos.x, l.pos.y, l.pos.z], [ballC.x, ballC.y, ballC.z], state.compact)) : l.pos;
              const pos = lp.clone().lerp(d.pos, h);
              const r2 = (vv: THREE.Vector3) => Math.max(vv.distanceToSquared(chaosC), 1e-3);
              const col = l.col.clone().divideScalar(r2(lp)).lerp(d.col.clone().divideScalar(r2(d.pos)), h).multiplyScalar(r2(pos));
              return { pos, col, r: (d.r ?? 0) * h };
            }),
            { dir: deskNow.spot.dir, cos: new THREE.Vector2(-3, -2).lerp(deskNow.spot.cos, h) },
            (calibrating ? lampSat : lampSat + (0.05 - lampSat) * state.compact) * h,
          );
          // the name leaves the frame with the ball (it is a plane in the world behind it); faded once it has gone
          wordmark?.setFade(1 - ease(p, [BEATS.tilt[0] + 0.3, BEATS.tilt[1]]));
          // the rising sand: on once the desk is coming into view, off inside the screen (its clock: ambient; frozen, so still,
          // under reduced motion)
          const um = field!.material.uniforms;
          const grainR = (um.uRadMax.value as number) * (um.uCountScale.value as number) * 0.7 * (um.uRadScale.value as THREE.Vector2).y;
          // (gone before the screen fills the frame: grains between the lens and the screen read as burrs over the index)
          const riseOn = ease(p, [BEATS.tilt[0], BEATS.tilt[0] + 0.3]) * (1 - ease(p, [BEATS.tail[0] + 0.3, BEATS.tail[0] + 0.6]));
          // its own clock, restarted whenever it's out of sight: a float32 time grows coarse over hours on the page
          riseClock = riseOn > 0.001 ? riseClock + (reduced || still ? 0 : dt) : 0;
          rising?.update(riseClock, riseOn, deskTop ? deskTop.y : -4.6, grainR);
          // the desk hides the sand only where sand can be under or behind it: while the rising sand is drawn
          if (composite) composite.occluder = rising?.mesh.visible ? desk3d!.group : null;
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
        // the vortex leans toward the cursor in depth (parallax.ts): the front follows it, the back a little
        {
          const cs = field!.material.uniforms.uChaosSize.value as THREE.Vector3;
          const on = pointer.active && !reduced && !still;
          cursorLean = stepParallax(cursorLean, on ? [(pointer.x / canvas.clientWidth) * 2 - 1, -((pointer.y / canvas.clientHeight) * 2 - 1)] : null, dt);
          field!.setParallax(cursorLean[0], cursorLean[1], chaosC, 0.5 * Math.max(cs.x, cs.z));
        }
        // the grains leaving the sand: from the chaos's shell, then the ball's; thinning over the desk; none on the index
        {
          const cs = field!.material.uniforms.uChaosSize.value as THREE.Vector3;
          const chaosR = 0.5 * Math.min(cs.x, cs.y, cs.z);
          const ballR = field!.material.uniforms.uBallR.value as number;
          const pg = progressRef.current;
          // the hero's haze goes with the hero's light: gone as the camera tilts onto the lamp-lit desk
          if (composite) composite.hazeAmount = hazeOn ? (hero ? 1 - ease(pg, BEATS.tilt) : 1) : 0;
          // and its lens: the lit front in focus, the rest softening (?dof=0: sharp throughout)
          {
            // focus as clarity (Liam, 2026-10-11): dreamy in the chaos (f/0.35 on the lit front), stopping down to ~f/2 as
            // the ball forms (the idea becomes clear); the shot's own focus over the desk; off for the push into the screen
            const clear = hero ? ease(state.compact, [0.0, 0.6]) : 0;
            const fstop = Math.exp(THREE.MathUtils.lerp(Math.log(SAND_LOOK.dofFstop), Math.log(2.0), clear));
            const lensK = dofOn ? (hero ? 1 - ease(pg, [BEATS.tail[0] + 0.2, BEATS.tail[0] + 0.6]) : 1) : 0;
            // the focus follows the subject: the cloud's lit front (its centre less a third of its radius), then the ball
            const cs0 = field!.material.uniforms.uChaosSize.value as THREE.Vector3;
            const r0 = THREE.MathUtils.lerp(0.5 * Math.min(cs0.x, cs0.y, cs0.z), (field!.material.uniforms.uBallR.value as number) * 1.05, state.compact);
            const toFocus = stage!.camera.position.distanceTo(focus) - 0.35 * r0;
            const shotF = shot && shotMeta ? (shot.data.path as unknown as { focus_m: number }[])[Math.min(Math.round(shotFrame(pg, shotMeta.beats)), shotMeta.frames - 1)].focus_m / shot.data.chaos_scale : toFocus;
            const focusD = THREE.MathUtils.lerp(toFocus, shotF, hero ? ease(pg, BEATS.tilt) : 0);
            if (composite) {
              // (Liam, 2026-10-11: the hero crisp, with a gentle depth: each grain its own small softness, f/2; the gathered
              // lens left the cloud looking like an unfinished render. The gather comes in over the desk, as approved there)
              const overDesk = hero ? ease(pg, BEATS.tilt) : 1;
              // (the gathered lens is off everywhere: in the hero it read as an unfinished render, over the desk it cut a dark
              // band near the camera; Liam, 2026-10-11. The sand's depth is per grain)
              composite.lens.amount = 0; composite.lens.focus = Math.max(focusD, 0.5);
              composite.lens.fstop = fstop; composite.lens.lensMm = SAND_LOOK.dofLensMm;
              composite.lens.desk = 0;
              field!.setDof(dofOn ? HERO_GRAIN_DOF * (1 - overDesk) : 0);
            } else field!.setDof(lensK);
          }
          const formed = ease(state.compact, [0.5, 0.92]);   // none around the formed ball (Liam, 2026-10-10)
          const density = (!hero ? DRIFT.hero : DRIFT.hero * (1 - ease(pg, BEATS.tilt))) * (1 - formed);
          const r = THREE.MathUtils.lerp(chaosR, ballR * 1.05, state.compact);
          const um = field!.material.uniforms;
          // the sand's own grain size (its largest grain x its look's scale x the tier's count scale), typical grain
          const grainR = (um.uRadMax.value as number) * (um.uCountScale.value as number) * 0.7
            * THREE.MathUtils.lerp((um.uRadScale.value as THREE.Vector2).x, (um.uRadScale.value as THREE.Vector2).y, state.compact);
          // the cursor at full strength on these (Lusion's and Oryzo's loose particles): a warm light, and a push
          drift.update(state.time, reduced || still ? 0 : dt, focus, r, reduced ? density * 0.5 : density, r * 3.5, grainR,
            pointer.active && !reduced ? cursorWorld : null, dir, 0.45,
            new THREE.Vector3(...CURSOR_WARM).multiplyScalar(5.0 * cursorI), cam);
          // (the formed ball no longer sprays its grains under the cursor: Liam, 2026-10-11, "the normal hover reaction is
          // enough"; its light and drift stay)
        }
        if (!reduced) {
          paint!.update(stage!.renderer, dt);
          field!.setPaint(paint!.texture, canvas.clientWidth, canvas.clientHeight);
        }
        wordmark?.setPaint(reduced ? null : paint!.texture, canvas.width, canvas.height);
        wordmark?.update(dt, reduced || still);
        if (composite && !filterParam && !calibrating) {
          const toDesk = shot ? ease(progressRef.current, BEATS.tilt) : 0;
          const chaos = FILTER.chaos + (FILTER.desk - FILTER.chaos) * toDesk;
          composite.sigma = chaos + (FILTER.ball - chaos) * state.compact;
        }
        field!.update(state);
      });
      stage.start();
      (window as unknown as { __sand?: unknown }).__sand = { stage, field, state, drift, rising: null, composite };   // lab debugging
      loadDesk().catch(() => {});
      // arriving with a section's hash (the nav from a case study, a shared link): the anchor didn't exist when the browser
      // looked for it (the story is client-only), so go there now
      const hash = window.location.hash.slice(1);
      if (hero && ["projects", "about", "contact"].includes(hash)) {
        requestAnimationFrame(() => {
          const el = document.getElementById(hash);
          if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY);
        });
      }
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
  }, [compare, hero, gradeOn]);

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
    <>
    <div ref={pageRef} className="relative bg-black" style={{ height: hero ? `${PAGE_VH}vh` : "400vh" }}>
      <canvas ref={canvasRef} className="fixed inset-0 h-screen w-screen" data-testid="sand-canvas" />
      {hero && <div ref={veilRef} aria-hidden className="pointer-events-none fixed inset-0 bg-black opacity-0" style={{ zIndex: 30 }} />}
      {/* the nav's Projects (/#projects) lands where the index has settled (once this page is the home) */}
      {hero && <div ref={projectsRef} id="projects" aria-hidden className="pointer-events-none absolute left-0 w-px" style={{ top: `${PAGE_VH - 100}vh`, height: "100vh" }} />}
      {hero && <WorkIndex bind={bindIndex} />}
      {hero ? (
        <HeroOverlay exit={readExit} scrolled={readScrolled} />
      ) : (
        <div className="pointer-events-none fixed left-3 top-3 font-mono text-[11px] uppercase tracking-wider text-white/60">
          sand lab · {status}
        </div>
      )}
    </div>
    {hero && <div ref={spacerRef} className="bg-black" style={{ height: 0 }} aria-hidden />}
    {hero && <div id="about" aria-hidden className="h-px" />}
    {hero && <div id="contact" aria-hidden className="h-px" />}
    </>
  );
}
