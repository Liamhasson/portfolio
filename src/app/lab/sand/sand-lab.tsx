"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Stage } from "@/three/stage";
import { loadSandMeta, loadSandParts, SAND_BASE } from "@/three/sand/data";
import { CURSOR_WARM, SAND_LOOK, SandField, type SandState } from "@/three/sand/sand-field";
import { PaintField } from "@/three/sand/paint";
import { HeroOverlay } from "./hero-overlay";
import { DeskInvite, INVITE, deskWindow, inWindow } from "./desk-invite";
import { DESK_IN_VIEW, DeskLaptop, goToWork, laptopLive } from "./desk-laptop";
import { WorkIndex, WorkList, type WorkIndexHandle } from "./work-index";
import { BakedDesk, releaseDesk, type DeskDownload } from "@/three/sand/baked-desk";
import { revealAt } from "@/three/sand/screen-reveal";
import { DriftGrains } from "@/three/sand/drift-grains";
import { vortexOnBall } from "@/three/sand/hero-layout";
import { stepParallax } from "@/three/sand/parallax";
import { Brief, type BriefHandle, BriefGrowth, briefReturn } from "./brief";
import { LOADER, loaderAt, loaderRunning } from "./loader-timeline";
import { readLoaderMode, releaseHold, showCopy, storyStarted } from "./loader-mode";
import { LoadProgress } from "@/three/sand/load-progress";
import { anchorsWorld } from "@/three/sand/cascade";
import { holdScroll, wallAt } from "@/lib/smooth-scroll";
import { sectionRedirect } from "@/lib/story";
import { useRouter } from "next/navigation";
import { DeskSketches } from "@/three/sand/desk-sketches";
import { sketchFont, storyFont } from "./sketch-font";
import { DeskNotes } from "@/three/sand/note-story/desk-notes";
import { DeskDrive } from "@/three/sand/note-story/desk-drive";
import { NoteStoryPlayer } from "@/three/sand/note-story/story-player";
import { STORIES, storyFor } from "@/three/sand/note-story/stories";
import { ballKeyPos } from "@/three/sand/ball-light";
import { SAND_ENCODE, SAND_LAYER, SandComposite } from "@/three/sand/sand-composite";
import { Pullback } from "@/three/sand/pullback";
import { BEATS, DESK_WAIT, SCREEN_HOLD, STORY_SCREENS, deskWait, ease, pAtFrame, reducedStory, shotFrame, snapIn, span, storyProgress, type ShotMeta } from "@/three/sand/story-timeline";
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
/**
 * The notes on the desk (Liam, 2026-10-13/14): touchable while the desk is in view; the one under the cursor lifts and
 * the lens racks focus onto it (the desk through the lens at RACK.fstop); a click brings it to the camera with its story
 * (note-story/), the desk behind it softening (STORY.blur device px) and dimming.
 */
const [NOTES_FROM, NOTES_TO] = DESK_IN_VIEW;
const RACK = { fstop: 1.4, rate: 7 } as const;
const STORY = { blur: 14, dim: 0.45, rate: 5 } as const;
/** The drive's way in (seconds): the glide into the laptop, whose screen shows the playground itself (Liam, 2026-10-15:
 *  no in-between window); arriving, the page takes over in place, the same picture. */
const DRIVE_FLOW = { glide: 2.8 } as const;
/** The floating grains' density through the page (Liam: strong in the hero, sparse over the desk, none on the index). */
const DRIFT = { hero: 1, desk: 0.12 } as const;

/** Frame-rate-independent damping toward a target. */
function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

/** The fallback's hero (no WebGL): its copy leaves over the first 0.6 screen of scroll, the cue as soon as it moves. */
const fallbackExit = () => Math.min(window.scrollY / (window.innerHeight * 0.6), 1);
const fallbackScrolled = () => window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight);

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
  // the desk's "Keep scrolling" (desk-invite.ts), set by the scene each frame
  const keepRef = useRef(false);
  const readKeep = useCallback(() => keepRef.current, []);
  const indexRef = useRef<WorkIndexHandle | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const projectsRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const briefRef = useRef<BriefHandle>(null);
  // the loader's mode, read once per instance (a StrictMode remount keeps it; the boot script's value is used up)
  const [loaderMode] = useState(() => (hero ? readLoaderMode() : "none"));
  const bindIndex = useCallback((h: WorkIndexHandle) => { indexRef.current = h; }, []);
  const [status, setStatus] = useState("loading sand");
  // no WebGL2 (or the sand failed to load): the approved renders as stills, chaos then ball with scroll
  const [fallback, setFallback] = useState(false);
  const [stillBall, setStillBall] = useState(false);
  // old links to the story's About and Contact anchors: their pages now (spec 2026-10-12-about-contact-design.md §5)
  const router = useRouter();
  const routerRef = useRef(router);   // (the scene's effect reads it: the playground's hand-over)
  useEffect(() => { routerRef.current = router; }, [router]);
  useEffect(() => {
    const to = sectionRedirect(window.location.hash);
    if (to) router.replace(to);
  }, [router]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    storyStarted();   // (the boot script's safety net stands down)
    let disposed = false;
    let stage: Stage | null = null;
    let disposeNotes: (() => void) | null = null;   // (the notes' story, if it was made: its overlay and any hold it has)
    let field: SandField | null = null;
    let paint: PaintField | null = null;
    // the desk's download, and whether the build took it (else unmounting gives its files back)
    let deskFiles: Promise<DeskDownload> | null = null, deskTaken = false;
    const listeners: [string, EventListener][] = [];
    // the loader (spec 2026-10-12-loader-design.md): its mode from the boot script (page.tsx); the brief grows from first
    // paint with the hero's files, on its own frames (the stage isn't there yet)
    const mode = loaderMode;
    if (mode === "play" || mode === "reduced") document.documentElement.dataset.loader = mode;   // (re-applied: a remount)
    // a later arrival: black from the first frame, then a fade (the copy never shows over the black first)
    if (hero && mode !== "play" && mode !== "reduced" && veilRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) veilRef.current.style.opacity = "1";
    let playing = hero && (mode === "play" || mode === "reduced");
    const progress = new LoadProgress();
    // the hero's other files, declared at about their sizes so none of them reads as a jump
    for (const [id, size] of [["/lab/grain.png", 60e3], ["haze", 90e3], ["/lab/shot/camera.json", 60e3]] as const) progress.expect(id, size);
    const growth = new BriefGrowth();
    let size = 0, sinceMount = 0, briefLast = performance.now(), briefOn = playing, briefRaf = 0;
    let onFullSize: (() => void) | null = null;
    let ballScreen = { cx: window.innerWidth / 2, cy: window.innerHeight / 2, r: 0 };
    const briefLoop = (now: number) => {
      const dt = Math.min((now - briefLast) / 1000, 0.1);
      briefLast = now; sinceMount += dt;
      holdScroll(true);   // (each frame: the smooth scroller registers after this component mounts)
      if (progress.value !== lastProgress) { lastProgress = progress.value; stalledFor = 0; } else stalledFor += dt;
      if (stalledFor > 15 && progress.value < 1) { giveUp(); return; }
      size = growth.step(progress.value, sinceMount, dt);
      briefRef.current?.update({ ...ballScreen, r: ballScreen.r * size, alpha: 1, dash: 0, squares: Array(9).fill(1), round: 0 });   // (the square grows)
      briefRef.current?.announce(progress.value);
      if (size >= 0.999 && onFullSize) { const f = onFullSize; onFullSize = null; f(); }
      if (briefOn) briefRaf = requestAnimationFrame(briefLoop);
    };
    if (briefOn) briefRaf = requestAnimationFrame(briefLoop);
    // done or failed: the brief stops, the nav and copy show, scrolling is free (never left locked)
    const stopBrief = () => { briefOn = false; cancelAnimationFrame(briefRaf); };
    const fail = () => { stopBrief(); briefRef.current?.update({ ...ballScreen, alpha: 0, dash: 0, squares: Array(9).fill(1) }); releaseHold(); };
    let loaderClock: number | null = null, waitingForBrief = false, cascadeOn = false, released = false, loaderLight = 1, fadeClock: number | null = null;
    let lastProgress = -1, stalledFor = 0, cascadeFinished = false;
    // the loader gives up (a load stalled, not failed): the page is freed now, and when the hero does arrive it simply shows
    const giveUp = () => {
      playing = false; waitingForBrief = false; loaderClock = null; loaderLight = 1;
      fail();
      field?.setCascade(null); field?.setLightK(1); canvas.style.opacity = "1";
    };

    (async () => {
      // the tier first: it decides how much sand to download
      const probe = document.createElement("canvas").getContext("webgl2");
      if (!probe || new URLSearchParams(window.location.search).has("nogl")) {
        setFallback(true);
        fail();
        return;
      }
      const tier = pickTier(readSignals(probe), parseTierOverride(window.location.search));
      const meta = await loadSandMeta(SAND_BASE);   // (not counted: small, and alone it would read as most of the load)
      if (disposed) return;
      const { camera } = meta;
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
      // the brief on the ball: its projected centre and radius (the ball forms in the centre, unshifted), on every resize
      const ballAt = new THREE.Vector3(...meta.ball.center);
      const camRight = new THREE.Vector3(), camUp = new THREE.Vector3();
      const placeBrief = () => {
        const cam = stage!.camera;
        cam.updateMatrixWorld();
        camRight.setFromMatrixColumn(cam.matrixWorld, 0).normalize();
        camUp.setFromMatrixColumn(cam.matrixWorld, 1).normalize();
        const p0 = ballAt.clone().project(cam), p1 = ballAt.clone().addScaledVector(camRight, meta.ball.radius).project(cam);
        // (the canvas's box, 100vh: on phones the visible viewport is shorter while the URL bar shows)
        const W = canvas.clientWidth || window.innerWidth, H = canvas.clientHeight || window.innerHeight;
        ballScreen = { cx: ((p0.x + 1) / 2) * W, cy: ((1 - p0.y) / 2) * H, r: (Math.abs(p1.x - p0.x) / 2) * W };
      };
      stage.onSettings(placeBrief);
      // a frame threw (its loop has stopped): the stills and the plain projects, the page unlocked (final review #3)
      stage.onCrash((err) => {
        if (disposed) return;
        setStatus(String(err));
        setFallback(true);
        fail();
      });
      const data = await loadSandParts(meta, settingsFor(tier, window.devicePixelRatio || 1).grains, SAND_BASE, progress);
      if (disposed) return;
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
          new THREE.TextureLoader().loadAsync("/lab/grain.png").finally(() => progress.done("/lab/grain.png")).then((t) => {
            if (disposed) return;
            comp.grade = new FilmGradePass(t);
            comp.gradeStill = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          }).catch(() => {});
        }
        (window as unknown as { __sandFilter?: (s: number) => void }).__sandFilter = (s) => { comp.sigma = s; };
        // the hero's haze: its key lighting the air (blender/lookdev/cinematic_variants.py CINE_PLATE=1); ?haze=0: none
        if (hazeOn) {
          Promise.all([
            new THREE.TextureLoader().loadAsync(`${SAND_BASE}/haze-hero.png`).finally(() => progress.done("haze")),
            fetch(`${SAND_BASE}/haze-hero.json`).then((r) => r.json() as Promise<{ scale: number }>),
          ]).then(([texture, { scale }]) => {
            texture.colorSpace = THREE.NoColorSpace;   // display values, as rendered
            comp.haze = { texture, scale };
          }).catch(() => {});
        }
      }
      // the story's one shot (blender/lookdev/shot_path.py), over the 3D desk
      const shot = hero && !compare ? await Pullback.load(SHOT_BASE, false) : null;
      progress.done(`${SHOT_BASE}/camera.json`);
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
      let sketchClock = 0;   // the sketches' float (desk-sketches.ts): runs while they are on screen, restarts after
      // the desk's top as a rectangle in the hero's units (x, z) and its height, for keeping the top view inside it
      let deskTop: { min: THREE.Vector2; max: THREE.Vector2; y: number } | null = null;
      // the notes: touchable, and their stories
      let notes: DeskNotes | null = null;
      let player: NoteStoryPlayer | null = null;
      let hovered: string | null = null;
      let storyOpen = false;
      // the playground drive: touchable like the notes; a click mounts it and the story glides into its screen
      let drive: DeskDrive | null = null;
      let driveOver = false, driveMounted = false, driveLeft = false;
      let driveArrived = 0;   // (performance.now() when the glide reached the screen)
      let driveScreen: THREE.Texture | null = null;
      // the laptop: under the pointer while the desk is in view, a click goes to the work as the nav's Projects does
      // (desk-laptop.ts; Liam, 2026-10-18)
      let laptop: DeskLaptop | null = null;
      let laptopOver = false;
      let lastStoryEnd = 0;
      const noteFx = { rack: 0, focus: 1, blur: 0 };
      // the sketches of the work behind the desk, seen through the tilt (desk-sketches.ts; Liam, 2026-10-12)
      let sketches: DeskSketches | null = null;
      const placeSketches = () => {
        if (!sketches || !shot || !shotMeta || !deskTop) return;
        // from the tilt's last frame, behind the desk's far edge
        const v = shot.view(shotMeta.beats.tilt[1]);
        const cam = stage!.camera.clone();
        cam.position.copy(v.position); cam.quaternion.copy(v.quaternion);
        cam.fov = THREE.MathUtils.radToDeg(stage!.vfovFor(cam.aspect, v.lens));
        cam.updateProjectionMatrix(); cam.updateMatrixWorld();
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
        const far = new THREE.Vector3((deskTop.min.x + deskTop.max.x) / 2, deskTop.y, deskTop.min.y);
        sketches.place(cam, far.sub(cam.position).dot(fwd) + 1.2, stage!.bufferHeight);
      };
      // the desk's files download from the moment the hero's are in (during the loader: the network is free, the GPU
      // untouched); its loading line counts them (pre-launch audit, 2026-10-12)
      const deskProgress = new LoadProgress();
      let deskDownload: Promise<DeskDownload> | null = null;
      let deskDone = false;   // (downloaded: what's left is local work)
      // (phones and the lowest tier: the data maps and the screen's still at half size, for GPU memory)
      const deskHalf = window.matchMedia("(pointer: coarse)").matches || tier === "low";
      const startDesk = () => (deskDownload ??= deskFiles = BakedDesk.fetch("/lab/desk3d", deskProgress, { half: deskHalf }).then((d) => { deskDone = true; return d; }));
      // the desk failed or stalled: the story stops waiting for it (the index shows on its own)
      let deskGaveUp = false;
      // the desk, then the rising sand: textures uploaded and shaders compiled before they join the scene (no hitch as
      // the camera tilts onto them); built once the loader is done. Every texture, the lighting states the shaders hold
      // in their own uniforms too, uploaded one per frame (each upload decodes an image: together they stalled a frame)
      const loadDesk = async () => {
        if (!shot) return;
        const st = stage!;
        const files = await startDesk();
        if (disposed) return;
        deskTaken = true;
        const d = await BakedDesk.build(st.renderer, files);
        if (disposed) return;
        // the notes bend in their own shaders: set up before the desk's shaders compile (none compiles mid-shot)
        const deskNotes = new DeskNotes(d.group, STORIES.map((x) => ({ name: x.mesh, size: x.size, rotZ: x.rotZ })), { shadows: true, pinnedBy: "bake_Cylinder.001", lamp: d.lights.find((l) => l.name === "lamp")?.light.position });
        const queue = [...d.textures];
        await new Promise<void>((res) => {
          const step = () => {
            const t = queue.shift();
            if (disposed || !t) { res(); return; }
            st.renderer.initTexture(t);
            deskProgress.compile(1 - queue.length / d.textures.length);
            requestAnimationFrame(step);
          };
          step();
        });
        if (disposed) return;
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
        notes = deskNotes;
        drive = new DeskDrive(d.group);
        (window as unknown as { __drive?: unknown }).__drive = drive;   // lab debugging
        laptop = new DeskLaptop(d.group);
        new THREE.TextureLoader().loadAsync("/playground/playground-screen.jpg").then((t) => {
          // (the desk's convention: the screen's uv from the glTF, no flip)
          t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 8; driveScreen = t; st.renderer.initTexture(t);
        }).catch(() => {});
        (window as unknown as { __notes?: unknown }).__notes = notes;   // lab debugging
        player = new NoteStoryPlayer(storyFont.style.fontFamily);
        player.el.addEventListener("click", () => player?.close());
        player.onStudy = (href) => routerRef.current.push(href);
        (window as unknown as { __noteStory?: unknown }).__noteStory = player;   // lab debugging (and recording)
        player.preload(STORIES).catch(() => {});
        disposeNotes = () => {
          player?.dispose();
          if (storyOpen) { document.documentElement.style.overflow = ""; holdScroll(false); }
          document.documentElement.style.cursor = "";
        };
        await document.fonts.load(`500 40px ${sketchFont.style.fontFamily}`).catch(() => {});
        if (disposed) return;
        const sk = new DeskSketches(sketchFont.style.fontFamily);
        await sk.precompile(st.renderer, st.camera, st.scene).catch(() => {});   // (none compiles mid-tilt)
        if (disposed) return;
        sketches = sk;
        st.scene.add(sketches.group);
        placeSketches();
        st.onSettings(placeSketches);
        const spots = await RisingSand.loadSpots(`${SAND_BASE}/desk-spill.bin`, shot.data.chaos_center, shot.data.chaos_scale).catch(() => null);
        if (disposed || !spots) return;
        const r = new RisingSand(field!.material, spots, { high: 900, mid: 700, low: 400 }[tier]);   // a few single grains (Liam: Lusion's floor)
        r.mesh.layers.set(SAND_LAYER);
        await st.renderer.compileAsync(r.mesh, st.camera, st.scene).catch(() => {});
        if (disposed) return;
        st.scene.add(r.mesh);
        risingLoaded = r;
        // last, everything again for the targets the compositor draws into from the tilt on (the scene into the desk's
        // linear target, the desk into its depth pass): none of it compiles mid-shot (Liam, 2026-10-13: hitches)
        if (composite) {
          await composite.precompile(st.renderer).catch(() => {});
          await composite.precompileScene(st.renderer, st.scene, st.camera).catch(() => {});
        }
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
      const params = new URLSearchParams(window.location.search);
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
        progress.compile(0.5);
        await composite?.warm(st.renderer, st.scene, st.camera).catch(() => {});
        for (const o of hidden) o.visible = false;
        for (const o of culled) o.frustumCulled = true;
      }
      progress.compile(1);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      // ?still: no ambient motion (drift, spin), so a test isolates what the cursor does
      const still = new URLSearchParams(window.location.search).has("still");
      let lastScroll = window.scrollY;
      // the snap into the screen: carrying the page in (Liam, 2026-10-11), and the progress a frame ago (its direction)
      let snapping = false, lastRawP = 0;
      // the wait for the desk (story-timeline.ts deskWait): whether it's holding; a jump to the projects (the nav's
      // Projects, Lenis's 1.5 s anchor glide) isn't held; the desk's loading, to notice a stall
      let deskWaiting = false, jumpingSince = -1, deskSeen = -1, deskStill = 0;
      // the page runs on past the story by the 16:10 index's own overflow (measured every 20 frames); the phone list
      // lays its length out in the page itself (work-index.tsx), so there it needs none
      const fitIndex = (ix: WorkIndexHandle) => {
        if (++spacerTick % 20 !== 0 || !spacerRef.current) return;
        const flow = ix.flow();
        const need = `${flow === null ? Math.round(ix.overflow()) : 0}px`;
        // (the anchor covers the index and its projects, so the nav's Projects is lit while they're in view; on phones
        // exactly the list, never past it: anything longer would lengthen the page again)
        const reach = flow === null ? `calc(100vh + ${need})` : `${Math.round(flow)}px`;
        if (spacerRef.current.style.height !== need) spacerRef.current.style.height = need;
        if (projectsRef.current && projectsRef.current.style.height !== reach) projectsRef.current.style.height = reach;
      };
      let briefReturnA = 0;   // the brief's return on scroll, last frame (only redrawn while it shows)
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
      on("click", ((e: MouseEvent) => {
        if ((e.target as Element | null)?.closest?.('a[href$="#projects"]')) jumpingSince = performance.now();
      }) as EventListener);
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
      // the notes: a click on one (the desk in view, nothing else under the pointer) brings it up with its story; while
      // it's up, scroll stands still, and a scroll, a click or Esc puts the note back
      const notesLive = () => hero && !!notes && !!player && !storyOpen && !snapping && !reduced
        && progressRef.current >= NOTES_FROM && progressRef.current <= NOTES_TO;
      const pickAt = (x: number, y: number) => notes!.pick(new THREE.Vector2((x / (canvas.clientWidth || 1)) * 2 - 1, 1 - (y / (canvas.clientHeight || 1)) * 2), stage!.camera);
      const openStory = (name: string) => {
        const story = storyFor(name), pose = notes?.pose(name);
        if (!story || !pose || !player || !notes) return;
        storyOpen = true; hovered = null;
        document.documentElement.style.cursor = "";
        holdScroll(true);
        document.documentElement.style.overflow = "hidden";
        notes.setVisible(name, false);
        player.liveCamera = stage!.camera;
        player.open(story, pose, stage!.camera, () => notes?.pose(name) ?? null, () => {
          notes?.setVisible(name, true);
          storyOpen = false;
          document.documentElement.style.overflow = "";
          holdScroll(false);
        });
      };
      // the laptop (desk-laptop.ts): the desk in view and nothing else going on; motion reduced too (it only scrolls)
      const laptopOn = () => laptopLive({
        hero, ready: !!laptop?.ready, p: progressRef.current,
        loader: loaderClock !== null || waitingForBrief, brief: deskWaiting || briefReturnA > 0,
        storyOpen, driveMounted, snapping,
        gliding: jumpingSince >= 0 && performance.now() - jumpingSince < 1700,   // (the anchor's 1.5 s glide)
        veiled: veilA > 0.05,
      });
      const laptopAt = (x: number, y: number) => !!laptop && laptop.hit(new THREE.Vector2((x / (canvas.clientWidth || 1)) * 2 - 1, 1 - (y / (canvas.clientHeight || 1)) * 2), stage!.camera);
      (window as unknown as { __laptop?: unknown }).__laptop = { live: laptopOn, at: laptopAt, over: () => laptopOver };   // (the e2e and lab debugging)
      on("click", ((e: MouseEvent) => {
        if ((e.target as Element | null)?.closest?.("a, button, input, textarea, select, [role=dialog]")) return;
        // a note first, then the drive (each in front of the laptop where they overlap), then the laptop
        if (notesLive()) {
          const name = pickAt(e.clientX, e.clientY);
          if (name) { openStory(name); return; }
          if (driveAt(e.clientX, e.clientY)) { mountDrive(); return; }
        }
        if (laptopOn() && laptopAt(e.clientX, e.clientY)) {
          laptopOver = false;
          document.documentElement.style.cursor = "";
          goToWork();   // (the nav's own anchor: its click sets jumpingSince above, Lenis glides)
        }
      }) as EventListener);
      const driveAt = (x: number, y: number) => !!drive?.ready && drive.hit(new THREE.Vector2((x / (canvas.clientWidth || 1)) * 2 - 1, 1 - (y / (canvas.clientHeight || 1)) * 2), stage!.camera) !== null;
      const mountDrive = () => {
        if (driveMounted || !lastStoryEnd) return;
        driveMounted = true; driveOver = false;
        document.documentElement.style.cursor = "";
        // on into the laptop: the story glides to where the screen takes over the view
        const target = ((BEATS.takeover[0] + 0.04) / (STORY_SCREENS + SCREEN_HOLD)) * lastStoryEnd;
        glideTo(target, DRIVE_FLOW.glide, () => { driveArrived ||= performance.now(); }, reduced);
      };
      const putBack = () => { if (storyOpen) player?.close(); };
      on("keydown", ((e: KeyboardEvent) => { if (storyOpen && ["Escape", " ", "ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End"].includes(e.key)) putBack(); }) as EventListener);
      on("wheel", putBack as EventListener);
      on("touchmove", putBack as EventListener);
      // the desk's invitation (desk-invite.ts; Liam, 2026-10-18): any scrolling starts its clock again (the wheel, a finger,
      // the keys; the page moving, below, catches the rest). A mouse moving alone isn't scrolling
      const invite = new DeskInvite();
      const deskSpan = shot && shotMeta ? deskWindow((shot.data.path as unknown as { lid_open_deg: number }[]).map((x) => x.lid_open_deg), shotMeta.beats) : null;
      // the lean, in the scene's units, and where it leans: on along the shot, toward the glide's end over the laptop
      const leanUnits = shot ? shot.toHero([0, 0, 0]).distanceTo(shot.toHero([0, 0, INVITE.leanM])) : 0;
      const leanTo = shot && shotMeta ? shot.view(shotMeta.beats.glide[1]).position : null;
      const leanDir = new THREE.Vector3();
      let inviteY = window.scrollY;
      const nudge = () => invite.poke();
      on("wheel", nudge);
      on("touchstart", nudge);
      on("touchmove", nudge);
      on("keydown", ((e: KeyboardEvent) => { if ([" ", "ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End"].includes(e.key)) invite.poke(); }) as EventListener);
      const leanBase = new THREE.Vector3();   // the shot's camera a frame ago, before the lean (how far the path moved on)
      let leanBaseSet = false;
      let veilA = 0;   // the veil's black this frame (the text stays off under the reduced-motion crossfade)
      const inviteDebug = { window: deskSpan, tease: 0, cue: false, lid: 0, lean: 0, camera: [0, 0, 0], toScreen: 0 };
      (window as unknown as { __deskInvite?: unknown }).__deskInvite = inviteDebug;   // (the e2e and lab debugging)
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
        stage!.covered = false;   // (set below while the phone list covers the screen: nothing of the scene shows)
        chaosC.addVectors(chaosC0, chaosShift);
        // the loader (loader-timeline.ts): seconds since 100% from frame time (a hidden tab pauses it)
        if (loaderClock !== null) {
          loaderClock += dt;
          const L = loaderAt(loaderClock);
          if (cascadeOn) {
            briefRef.current?.update({ ...ballScreen, alpha: L.briefAlpha, dash: L.dash, squares: L.squares, round: L.round });   // (its corners round, then its points become sand)
            field!.setLightK(L.lightK);
            loaderLight = L.light;
            if (L.copy > 0) showCopy();
            if (L.unlocked && !released) { released = true; releaseHold(); briefRef.current?.announce("ready"); loadDesk().catch(() => { deskGaveUp = true; }); }
          } else {
            // reduced motion: a crossfade, no cascade
            const k = Math.min(loaderClock / LOADER.reducedFade, 1);
            briefRef.current?.update({ ...ballScreen, alpha: 1 - k, dash: 0, squares: Array(9).fill(1) });
            canvas.style.opacity = String(k);
            field!.setLightK(1); loaderLight = 1;
            if (k >= 1 && !released) { released = true; releaseHold(); briefRef.current?.announce("ready"); loaderClock = null; loadDesk().catch(() => { deskGaveUp = true; }); }
          }
        }
        // a later arrival: a short fade from black
        if (fadeClock !== null && !reduced) {
          fadeClock += dt;
          const k = Math.min(fadeClock / LOADER.fadeIn, 1);
          veilA = 1 - k * k * (3 - 2 * k);
          if (veilRef.current) veilRef.current.style.opacity = String(veilA);
          if (k >= 1) fadeClock = null;
        }
        // (the story's own length: past it, the page runs on through the index's projects)
        const max = Math.max(1, (pageRef.current?.offsetHeight ?? document.documentElement.scrollHeight) - window.innerHeight);
        const progress = Math.min(window.scrollY / max, 1);
        // the story's end is where the index's anchor is (#projects), measured, not assumed: on phones vh is the large
        // viewport while innerHeight shrinks under the URL bar, so a jump to the anchor must still land on the end
        const storyEnd = hero && projectsRef.current ? Math.max(1, projectsRef.current.getBoundingClientRect().top + window.scrollY) : max;
        lastStoryEnd = storyEnd;
        let rawP = hero ? storyProgress(window.scrollY, storyEnd) : progress;
        // the desk not in yet: scrolling down, the story waits on the formed ball, the brief and its loading line showing
        // (story-timeline.ts deskWait; Liam, 2026-10-12: hold before the tilt)
        if (hero && shot) {
          const jumping = jumpingSince >= 0 && performance.now() - jumpingSince < 2500 && rawP < BEATS.takeover[0];
          // (stalled: no bytes for 15 s while downloading, like the loader, it gives up rather than hold the page; the
          // build and the uploads after it are local work, never a stall)
          const got = deskProgress.received;
          if (got !== deskSeen || deskDone) { deskSeen = got; deskStill = 0; } else if (deskWaiting) deskStill += dt;
          if (deskWaiting && deskStill > 15) deskGaveUp = true;
          const ready = deskLoaded !== null || deskGaveUp;
          const wall = deskWait({ ready, p: rawP, prevP: lastRawP, end: storyEnd, jumping });
          if (wall !== null) { wallAt(wall); rawP = DESK_WAIT; }
          const waiting = wall !== null || (deskWaiting && !ready && !jumping && rawP >= DESK_WAIT - 0.05);
          if (waiting !== deskWaiting) {
            deskWaiting = waiting;
            if (waiting) placeBrief();
            else briefRef.current?.wait(null);
          }
          // (only the way down is walled: scrolling back up stays free, touch and reduced motion too)
          if (deskWaiting) { briefRef.current?.wait(deskProgress.value, ballScreen); briefRef.current?.announce(deskProgress.value); }
        }
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
          veilA = r.veil;
          if (veilRef.current) veilRef.current.style.opacity = String(r.veil);
        } else progressRef.current = damp(progressRef.current, rawP, 6, dt);
        if (Number.isFinite(holdFrame) && shotMeta) progressRef.current = pAtFrame(holdFrame - 1, shotMeta.beats);
        const p = progressRef.current;
        // the desk's invitation: idle on the desk (settled over it, the lid still shut), nothing else going on
        if (Math.abs(window.scrollY - inviteY) > 0.5) invite.poke();
        inviteY = window.scrollY;
        // (a note or the drive under the pointer, last frame: activity, so it doesn't slide under the cursor. The laptop
        // isn't: it fills the middle of the view, where a resting pointer often lies, and counting it would keep the cue
        // from the very visitors it's for; the tease's few degrees and centimetres never take it from under the pointer)
        if (fadeClock === null && !reduced) veilA = 0;
        invite.step(dt,
          hero && !!deskSpan && deskLoaded !== null && inWindow(p, deskSpan) && loaderClock === null && !waitingForBrief
            && !storyOpen && !driveMounted && !snapping && !deskWaiting && !calibrating,
          reduced, !!hovered || driveOver, veilA);
        const inv = invite;
        keepRef.current = inv.cue;
        inviteDebug.tease = inv.tease; inviteDebug.cue = inv.cue;
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
            // (the invitation lifts the same lid a few degrees, on top of the scroll's own angle)
            inviteDebug.lid = inv.tease * INVITE.lidDeg;
            desk3d.setLid(Number.isFinite(lidHold) ? lidHold : lidDeg + inviteDebug.lid);
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
          // the invitation's lean: a small step on along the shot's own way, toward the screen (scrolling on continues it)
          // (scrolling down, the lean gives way only as fast as the path moves past it: never a step back)
          inviteDebug.lean = 0;
          if (leanTo) {
            leanDir.subVectors(leanTo, v.position);
            const room = leanDir.length();
            const onward = leanBaseSet && room > 1e-6 && leanUnits > 0 ? leanDir.dot(leanBase.subVectors(v.position, leanBase)) / room / leanUnits : 0;
            leanBase.copy(v.position); leanBaseSet = true;
            inv.leanStep(dt, onward);
            if (inv.lean > 0 && room > 1e-6) { inviteDebug.lean = Math.min(inv.lean * leanUnits, room); v.position.addScaledVector(leanDir, inviteDebug.lean / room); }
            inviteDebug.toScreen = leanDir.subVectors(leanTo, v.position).length();
          }
          stage!.setView(v.position, v.quaternion, v.lens);
          const cam = stage!.camera;
          inviteDebug.camera[0] = v.position.x; inviteDebug.camera[1] = v.position.y; inviteDebug.camera[2] = v.position.z;
          const W = canvas.clientWidth || 1, H = canvas.clientHeight || 1;
          // portrait phones see far more height: the tilt goes further there so the ball leaves the frame (spec §10)
          {
            const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2), tanV16 = 18 / v.lens / 1.6;   // (16:10, horizontal fit: the shot's own frame)
            const extra = Math.max(Math.atan(tanV) - Math.atan(tanV16), 0) * ease(p, BEATS.tilt) * (1 - ease(p, BEATS.glide));
            if (extra > 1e-4) { cam.quaternion.multiply(leanQ.setFromEuler(leanE.set(-extra, 0, 0, "YXZ"))); cam.updateMatrixWorld(); }
          }
          // the lean: toward the cursor, eased; out as the index takes over
          {
            const want = pointer.active && loaderClock === null && !waitingForBrief && !storyOpen   // (waits for the loader; still while a note is up)
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
          if (driveMounted) {
            if (ix) { ix.show(0); ix.panel(null); ix.list(0); ix.interactive("none"); }
            desk3d?.setScreenAlt(driveScreen, driveScreen ? 1 : 0);
            // the screen (the playground's own picture) fills the view, and the page takes over in place
            if (!driveArrived && rawP >= BEATS.takeover[0] + 0.03) driveArrived = performance.now();   // (no smooth scroller: landed)
            if (!driveLeft && driveArrived) { driveLeft = true; routerRef.current.push("/playground"); }
          } else if (ix && desk3d) {
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
                stage!.covered = take > 0.999 && g2 >= 1;
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
              fitIndex(ix);
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
                stage!.covered = true;
              } else {
                const { w, h: ih } = ix.size();
                const k = Math.min(W / w, H / ih), cw = w * k, ch = ih * k, x0 = (W - cw) / 2, y0 = (H - ch) / 2;
                ix.place([[x0, y0], [x0 + cw, y0], [x0 + cw, y0 + ch], [x0, y0 + ch]]);
                ix.show(1); ix.panel({ x: 0, y: 0, w: W, h: H }, 1); ix.list(0); ix.interactive("wide");
              }
              ix.scroll(Math.max(window.scrollY - storyEnd, 0));
              fitIndex(ix);   // (the page's length is the index's own, desk or not: its last projects stay reachable)
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
          sketchClock = sketches?.showing ? sketchClock + (reduced || still ? 0 : dt) : 0;
          // (the hover lights the part of a sketch under a mouse: Liam, 2026-10-12)
          sketches?.update(p, reduced, sketchClock, { x: (pointer.x / canvas.clientWidth) * 2 - 1, y: 1 - (pointer.y / canvas.clientHeight) * 2, on: pointer.active && !pointer.touch });
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
          const on = pointer.active && !reduced && !still && loaderClock === null && !waitingForBrief;   // (waits for the loader)
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
          if (composite) composite.hazeAmount = (hazeOn ? (hero ? 1 - ease(pg, BEATS.tilt) : 1) : 0) * loaderLight;   // (the loader: it comes up with the light)
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
          drift.update(state.time, reduced || still ? 0 : dt, focus, r, (reduced ? density * 0.5 : density) * loaderLight, r * 3.5, grainR,
            pointer.active && !reduced ? cursorWorld : null, dir, 0.45,
            new THREE.Vector3(...CURSOR_WARM).multiplyScalar(5.0 * cursorI), cam);
          // (the formed ball no longer sprays its grains under the cursor: Liam, 2026-10-11, "the normal hover reaction is
          // enough"; its light and drift stay)
        }
        if (!reduced) {
          paint!.update(stage!.renderer, dt);
          field!.setPaint(paint!.texture, canvas.clientWidth, canvas.clientHeight);
        }
        if (composite && !filterParam && !calibrating) {
          const toDesk = shot ? ease(progressRef.current, BEATS.tilt) : 0;
          const chaos = FILTER.chaos + (FILTER.desk - FILTER.chaos) * toDesk;
          composite.sigma = chaos + (FILTER.ball - chaos) * state.compact;
        }
        field!.update(state);
        if (waitingForBrief) field!.setCascade(-1);   // (nothing born yet: the brief is still growing)
        else if (loaderClock !== null && cascadeOn) {
          // (the cascade's clock starts as the circle closes: nothing is born while the square rounds)
          if (!cascadeFinished) field!.setCascade(loaderClock - LOADER.round);
          if (!cascadeFinished && field!.cascadeDone(loaderClock - LOADER.round)) { field!.setCascade(null); cascadeFinished = true; }
          // (the clock runs on until the release too: the cascade now ends before it)
          if (!loaderRunning({ cascadeDone: cascadeFinished, released })) loaderClock = null;
        }
        // the brief returns as the ball locks in and stays until the camera tilts down (spec §2.4; Liam, 2026-10-12)
        if (hero && !reduced && loaderClock === null && !waitingForBrief) {
          const a = briefReturn(state.compact, p);
          if (a > 0 || briefReturnA > 0) {
            if (a > 0) placeBrief();
            briefRef.current?.update({ ...ballScreen, alpha: a * 0.9, dash: 0, squares: Array(9).fill(1) });
          }
          briefReturnA = a;
        }
        // the notes: the one under the cursor lifts and the lens racks onto it; a story up, the desk softens behind it
        if (notes) {
          const live = notesLive() && pointer.active && !pointer.touch;
          const over = live ? pickAt(pointer.x, pointer.y) : null;
          const overDrive = !over && live && !driveMounted && driveAt(pointer.x, pointer.y);
          // the laptop: a hand over it, nothing more (no lift, no rack: the click is the nav's)
          const overLaptop = !over && !overDrive && pointer.active && !pointer.touch && laptopOn() && laptopAt(pointer.x, pointer.y);
          if (over !== hovered || overDrive !== driveOver || overLaptop !== laptopOver) {
            hovered = over; driveOver = overDrive; laptopOver = overLaptop;
            document.documentElement.style.cursor = over || overDrive || overLaptop ? "pointer" : "";
          }
          notes.update(storyOpen ? null : hovered, dt);
          if (hovered) noteFx.focus = notes.depth(hovered, stage!.camera) ?? noteFx.focus;
          else if (driveOver && drive) noteFx.focus = drive.depth(stage!.camera);
          noteFx.rack = damp(noteFx.rack, hovered || driveOver ? 1 : 0, RACK.rate, dt);
          drive?.update(driveOver || driveMounted ? 1 : 0, dt);
          noteFx.blur = damp(noteFx.blur, storyOpen ? 1 : 0, STORY.rate, dt);
          if (composite) {
            if (noteFx.rack > 0.002) { composite.lens.desk = noteFx.rack; composite.lens.focus = noteFx.focus; composite.lens.fstop = RACK.fstop; }
            if (noteFx.blur > 0.01) {
              composite.defocus = 0.5 + noteFx.blur * STORY.blur * Math.min(window.devicePixelRatio || 1, 2);
              composite.deskDim = Math.max(composite.deskDim, noteFx.blur * STORY.dim);
            }
          }
        }
      });
      // the loader: nothing of the hero shows until the brief is whole; then its points become the sand
      if (playing) {
        waitingForBrief = true;
        placeBrief();
        field.setCascade(-1, anchorsWorld([ballAt.x, ballAt.y, ballAt.z], meta.ball.radius, [camRight.x, camRight.y, camRight.z], [camUp.x, camUp.y, camUp.z]).map((a) => new THREE.Vector3(...a)));
        field.setLightK(LOADER.lightFloor);
        loaderLight = 0;
        if (mode === "reduced") canvas.style.opacity = "0";
      } else if (hero) {
        fadeClock = 0;
        if (veilRef.current && !reduced) veilRef.current.style.opacity = "1";
        releaseHold();
      }
      stage.start();
      (window as unknown as { __sand?: unknown }).__sand = { stage, field, state, drift, rising: null, composite };   // lab debugging
      // the desk's files start downloading now; its GPU work waits for the loader (loaded mid-cascade it hitched frames
      // up to 0.8 s)
      if (shot) startDesk().catch(() => { deskGaveUp = true; });
      if (!playing) loadDesk().catch(() => { deskGaveUp = true; });
      if (playing) {
        await new Promise<void>((res) => { if (size >= 0.999) res(); else onFullSize = res; });
        if (disposed || !playing) return;
        stopBrief();
        placeBrief();
        waitingForBrief = false;
        cascadeOn = mode === "play";
        // (reduced motion: no cascade; every grain is home at once, the hero crossfades in)
        if (!cascadeOn) field.setCascade(null);
        loaderClock = 0;
      }
      // arriving with a section's hash (the nav from a case study, a shared link): the anchor didn't exist when the browser
      // looked for it (the story is client-only), so go there now
      const hash = window.location.hash.slice(1);
      // back from the playground: the desk in full view (its drive is there)
      if (hero && hash === "desk") {
        requestAnimationFrame(() => {
          const end = projectsRef.current ? projectsRef.current.getBoundingClientRect().top + window.scrollY : 0;
          if (end > 0) window.scrollTo(0, ((BEATS.deskView[0] + BEATS.deskView[1]) / 2) * end / (STORY_SCREENS + SCREEN_HOLD));
        });
      }
      if (hero && ["projects", "about", "contact"].includes(hash)) {
        requestAnimationFrame(() => {
          const el = document.getElementById(hash);
          if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY);
        });
      }
    })().catch((err) => {
      if (disposed) return;   // (a disposed instance, e.g. StrictMode's first mount: the live one owns the hold)
      setStatus(String(err));
      setFallback(true);
      fail();
    });

    return () => {
      disposed = true;
      stopBrief();
      if (playing && !released) releaseHold();   // (never leave the next page locked)
      for (const [type, fn] of listeners) {
        if (type === "__leave") document.documentElement.removeEventListener("mouseleave", fn);
        else window.removeEventListener(type, fn);
      }
      if (deskFiles && !deskTaken) deskFiles.then(releaseDesk).catch(() => {});
      disposeNotes?.();
      paint?.dispose();
      field?.dispose();
      stage?.dispose();
    };
  }, [compare, hero, gradeOn, loaderMode]);

  // the fallback, arriving at #projects (Back from a case study): on the projects
  useEffect(() => {
    if (fallback && hero && window.location.hash === "#projects") document.getElementById("projects")?.scrollIntoView();
  }, [fallback, hero]);

  useEffect(() => {
    if (!fallback) return;
    const onScroll = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      // the story: the ball once the hero's copy has left; the lab: halfway down
      setStillBall(hero ? window.scrollY > window.innerHeight * 0.5 : window.scrollY / max > 0.5);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [fallback, hero]);

  if (fallback && !compare && hero) {
    // no WebGL or a scene error (pre-launch audit, 2026-10-12): the same story told in stills, chaos then the ball, under
    // the hero's copy, then the work as a plain page: every project and the pull to About still there
    return (
      <div className="relative bg-black" data-testid="sand-fallback">
        {(["chaos", "ball"] as const).map((k) => (
          // eslint-disable-next-line @next/next/no-img-element -- the fallback's stills
          <img
            key={k}
            src={`${SAND_BASE}/targets/${k}.jpg`}
            alt=""
            className="fixed inset-0 h-screen w-screen object-cover transition-opacity duration-700"
            style={{ opacity: (k === "ball") === stillBall ? 1 : 0 }}
          />
        ))}
        <HeroOverlay exit={fallbackExit} scrolled={fallbackScrolled} />
        <div aria-hidden style={{ height: "200vh" }} />
        <div id="projects" className="relative z-20 bg-black">
          <WorkList />
        </div>
      </div>
    );
  }

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
      {hero && <WorkIndex bind={bindIndex} end={PAGE_VH - 100} />}
      {hero && <Brief ref={briefRef} />}
      {/* (the sketches' handwriting, loaded with the story: desk-sketches.ts draws it into the scene) */}
      {hero && <span aria-hidden className={sketchFont.className} style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}>a</span>}
      {hero ? (
        <HeroOverlay exit={readExit} scrolled={readScrolled} keep={readKeep} />
      ) : (
        <div className="pointer-events-none fixed left-3 top-3 font-mono text-[11px] uppercase tracking-wider text-white/60">
          sand lab · {status}
        </div>
      )}
    </div>
    {hero && <div ref={spacerRef} className="bg-black" style={{ height: 0 }} aria-hidden />}
    </>
  );
}
