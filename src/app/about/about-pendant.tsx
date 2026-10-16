// src/app/about/about-pendant.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { claimGlass, glassOwner, glassRim } from "@/lib/about-glass";
import type { Box, Look } from "@/three/pendant/camera";
import { clipBox, hits, padBox, type TextRect } from "@/three/pendant/layout";
import { REST, stepMotion, type MotionState } from "@/three/pendant/motion";
import type { GlassSlot, PendantScene } from "@/three/pendant/scene";
import { SHOTS, shotAt, solveKeys, type Layer, type Shot } from "@/three/pendant/shots";
import type { Outline } from "@/three/pendant/solve";
import type { Spot } from "@/three/pendant/layout";
import { leanFor } from "./glass-lean";
import { pictureShown } from "./pendant-pictures";
import { trackProgress } from "./track";

/** What the page tells the e2e tests and the frame script (scripts/about/pendant-frames.cjs), rewritten every frame. */
export interface PendantHook {
  /** True once a frame has been drawn (false again while a lost context reloads). */
  ready: boolean;
  /** Where each shot is fully on, as a page scroll position (px). */
  keys: { id: string; y: number }[];
  /** The smoothed travel (track px) the frame was drawn at. */
  s: number;
  layer: Layer;
  /** The pendant's projected bounds on screen (px from the pinned frame's top-left). */
  box: Box;
  /** The glass ball as drawn (centre as a share of the viewport, radius as a share of its height), or null. */
  glass: GlassSlot | null;
  /** This screen's solve (Task 8): the front shots whose rest changed (the alternate used, 0 = as written; the move as shares
   *  of the width / height and the scale) and those resting behind the words. */
  solve: { moved: { id: string; alt: number; dx: number; dy: number; k: number }[]; behind: string[] };
  /** The pendant's turn about its own axis (radians), and whether a hand is on it. */
  yaw: number;
  dragging: boolean;
}

declare global {
  interface Window { __pendant?: PendantHook }
}

/** The scroll follow: what is left of the gap after one second (pendant-film-v3: a soft follow, like Lenis). */
const FOLLOW = 0.0008;
/** A frame never steps more than this (s): a tab coming back doesn't jump the motion. */
const DT_MAX = 0.05;
/** The cursor's lean (radians at the screen's edge) and its ease per frame (Lusion's values). */
const LOOK = 0.035;
const LOOK_EASE = 0.1;
/** The glass between the quotes: the pictures' empty 17vw slot (about-track.tsx `.ab-glass`, data-pendant="glass"), the
 *  ball's radius this share of the slot's width (spec §3: 0.44 x slot, so it never reaches either quote); drawn while the
 *  shot is at least GLASS_MIN "through the glass". (The slot is rendered whenever there are two quotes, the only case the
 *  old quote-gap sizing covered, so that fallback is gone.) */
const GLASS_SLOT_R = 0.44;
const GLASS_MIN = 0.02;
/** What is painted above the canvas and must keep its press (links, buttons, fields). */
const CONTROL = "a, button, input, select, textarea, [role=button]";
/** The outro, as the pull to Contact rises: it shrinks by this share, sinks this share of the screen, and fades out. */
const OUT_SHRINK = 0.6;
const OUT_SINK = 0.5;
/** The words the pendant must never cover while in front of them (Task 8 solves the layers from their lines' boxes). */
const TEXT = ".ab-big, .ab-quote blockquote, .ab-quote figcaption, .ab-verb .ab-mono:not(.ab-pic-cap), .ab-verb-title, .ab-skills li, .cap";
/** The pictures along the track (about-track.tsx `.ab-pic`), content like the words: each frame (a still or a loop) is one
 *  box, the whole frame (a picture has no lines to read between), plus its caption's lines. Each counts only where it is
 *  drawn at that point of the track (pendant-pictures.ts): risen so far as it arrives, nothing before; and a picture whose
 *  exit cut at the margin has started no longer counts at all, caption included (Liam's ruling: the hero may pass over the
 *  desk film as it leaves). */
const PIC = ".ab-pic", PIC_FRAME = ".ab-pic-f", PIC_CAP = ".ab-pic-cap";
/** What holds still on screen over the track, treated exactly as words: the site's wordmark, pill nav and burger (fixed to
 *  the viewport), and About's resume pill (fixed in the pinned frame). The 1 px progress bar is not avoided (Liam's ruling). */
const CHROME_SITE = ".sh-name, .sh-nav, .sh-burger";
const CHROME_PIN = ".ab-resume";
/** The solve waits for this long a quiet spell after a resize (the words are measured again at once; the live guard keeps
 *  them readable meanwhile). */
const SOLVE_QUIET = 150;
/** The live guard hands the front back only after the pendant has been clear for this long (s): no pumping at an edge. */
const GUARD_HOLD = 0.2;
/** How fast a solved-behind shot dims to solve.ts FORCED_DIM and comes back (what is left of the gap after a second): the
 *  layer flips while the pendant is clear of the words, so the dim eases in behind them instead of popping. */
const FORCED_EASE = 0.0001;

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);

/**
 * The lines of text inside an element, one box per line (viewport px): what the reader reads, not the element's block box
 * (a label's block runs the slide's full width while its words take a fifth of it). Each text node's own rects (a range
 * over it: block children's boxes are left out), merged where they share a line.
 */
function lineBoxes(el: Element): Box[] {
  const frags: Box[] = [];
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (!n.textContent?.trim()) continue;
    range.selectNodeContents(n);
    for (const r of range.getClientRects?.() ?? []) if (r.width > 0 && r.height > 0) frags.push({ l: r.left, t: r.top, r: r.right, b: r.bottom });
  }
  frags.sort((a, b) => a.t - b.t || a.l - b.l);
  const lines: Box[] = [];
  for (const f of frags) {
    const cy = (f.t + f.b) / 2;
    const line = lines.find((x) => cy > x.t && cy < x.b);
    if (!line) { lines.push({ ...f }); continue; }
    line.l = Math.min(line.l, f.l); line.r = Math.max(line.r, f.r);
    line.t = Math.min(line.t, f.t); line.b = Math.max(line.b, f.b);
  }
  return lines;
}

/** WebGL2 on a throwaway canvas (freed at once): the real canvas gets its context, with three's settings, from the scene. */
function hasWebGL2(): boolean {
  if (typeof WebGL2RenderingContext === "undefined") return false;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/** About's text first: the fonts, then a quiet moment (the pendant never holds up the words). */
function afterPaint(): Promise<void> {
  const fonts = document.fonts?.ready ?? Promise.resolve();
  return Promise.resolve(fonts).catch(() => undefined).then(() => new Promise<void>((done) => {
    if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(() => done(), { timeout: 2000 });
    else setTimeout(done, 200);
  }));
}

/**
 * The pendant on About (spec 2026-10-16-about-pendant-design.md §4, §6, §8): one see-through canvas inside the pinned frame,
 * in front of the track or behind it. It loads after the text has painted (three.js stays out of About's first bundle),
 * follows the sideways track with a soft lag, never stops moving, and can be grabbed and turned. Anything that goes wrong
 * (no WebGL2, a file that won't load, a shader three changed, a lost GPU) leaves About exactly as it was, with nothing in
 * the console. A lost context hides the canvas; a restored one reloads the scene on a fresh canvas.
 */
export function AboutPendant() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [gone, setGone] = useState(false);
  /** One canvas per load: after the scene's forceContextLoss a canvas can never be given a context again. */
  const [gen, setGen] = useState(0);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const sec = canvas.closest<HTMLElement>(".ab");
    const pin = canvas.parentElement;
    const tr = sec?.querySelector<HTMLElement>(".ab-track") ?? null;
    const clip = tr?.parentElement ?? null;

    const reducedQ = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = reducedQ.matches;
    canvas.dataset.mode = reduced ? "still" : "live";
    const onReduced = () => { reduced = reducedQ.matches; canvas.dataset.mode = reduced ? "still" : "live"; };
    reducedQ.addEventListener?.("change", onReduced);

    const hook: PendantHook = {
      ready: false, keys: [], s: 0, layer: "front", box: { l: 0, t: 0, r: 0, b: 0 }, glass: null, solve: { moved: [], behind: [] },
      yaw: 0, dragging: false,
    };
    window.__pendant = hook;

    let off = false, lost = false, drawn = false, inView = true;
    let scene: PendantScene | null = null;
    let cam: typeof import("@/three/pendant/camera") | null = null;
    let sv: typeof import("@/three/pendant/solve") | null = null;
    /** The pendant's outline (the wire copy's vertices; the bounds' corners if the scene has none). */
    let outline: Outline | null = null;
    let raf = 0;
    /** The glass ball is one ball: the pendant claims it once its scene is ready (the testimonials then don't draw theirs),
     *  and gives it back on unmount or a lost context (about-glass.ts). */
    let releaseGlass: (() => void) | null = null;
    const giveGlassBack = () => { releaseGlass?.(); releaseGlass = null; };

    // ---------- layout: the track measured (on load, resize, fonts, and whenever the track or section changes size) ----------
    const L = {
      vw: 1, vh: 1, dpr: 1, sized: false, mode: "track", top: 0, H: 0, travel: 0, line1: 0.5,
      /** The glass slot's centre (track px). */
      glassMid: null as number | null,
      /** Its radius, as a share of the screen's height. */
      glassR: 0,
      keys: [] as number[],
      texts: [] as TextRect[],
      /** The site's chrome (viewport px, fixed to the viewport) and About's own (the pinned frame's px). */
      site: [] as Box[],
      own: [] as Box[],
      /** This screen's solve: the shots as solved, their rest spots, the layer as a function of travel (null until solved). */
      shots: SHOTS as readonly Shot[],
      spots: [] as Spot[],
      layer: null as ((s: number) => Layer) | null,
    };
    let dirty = true;
    const anchor = (name: string) => tr?.querySelector<HTMLElement>(`[data-pendant="${name}"]`) ?? null;
    // a slide's left edge along the track (offsets ignore the track's transform and the arrival animation)
    const left = (el: HTMLElement) => (el.offsetParent === tr ? el.offsetLeft : el.offsetLeft - (tr?.offsetLeft ?? 0));
    const centre = (name: string) => { const el = anchor(name); return el ? left(el) + el.offsetWidth / 2 : null; };
    const measure = () => {
      dirty = false;
      if (!sec || !tr || !clip || !pin) return;
      L.mode = sec.dataset.mode ?? "track";
      const vw = pin.clientWidth || window.innerWidth, vh = pin.clientHeight || window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (scene && (!L.sized || vw !== L.vw || vh !== L.vh || dpr !== L.dpr)) { scene.resize(vw, vh, dpr); L.sized = true; }
      L.vw = vw; L.vh = vh; L.dpr = dpr;
      L.top = sec.offsetTop;
      L.H = sec.offsetHeight;
      const viewW = clip.clientWidth || vw;
      L.travel = Math.max(tr.scrollWidth - viewW, 0);
      const c1 = centre("line1");
      L.line1 = c1 === null ? 0.5 : c1 / vw;
      const slot = anchor("glass");
      if (slot && slot.offsetWidth > 0) {
        L.glassMid = left(slot) + slot.offsetWidth / 2;
        L.glassR = (GLASS_SLOT_R * slot.offsetWidth) / vh;
      } else {
        L.glassMid = null;
        L.glassR = 0;
      }
      L.keys = solveKeys(SHOTS, (a) => (typeof a === "object" ? centre(a.pendant) : null), viewW, L.travel);
      // (the section is a screen plus the travel, so travel px and scroll px are one to one)
      hook.keys = SHOTS.map((s, i) => ({ id: s.id, y: L.top + L.keys[i] }));
      // The words and the chrome, as boxes. Rects relative to the track are proof against the track's own transform; the
      // arrival animation (the first slides slide in for 1.1 s) and the nav's entrance move them too, so while either runs
      // these boxes are provisional and everything is measured and solved again the moment they have finished.
      settle();
      const trR = tr.getBoundingClientRect(), pinR = pin.getBoundingClientRect();
      const rect = (r: Box, shown?: TextRect["shown"]): TextRect => ({ l: r.l - trR.left, t: r.t - pinR.top, w: r.r - r.l, h: r.b - r.t, shown });
      const words = [...tr.querySelectorAll<HTMLElement>(TEXT)].flatMap(lineBoxes).map((r) => rect(r));
      // a picture's place as the track measures it for its clip (about-track.tsx): its width includes the caption, its rise is a share of its height
      const pics = [...tr.querySelectorAll<HTMLElement>(PIC)].flatMap((el) => {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return [];
        const place = { l: r.left - trR.left, t: r.top - pinR.top, h: r.height, w: Math.max(r.right, ...[...el.children].map((c) => c.getBoundingClientRect().right)) - r.left };
        const frame = [...el.querySelectorAll<HTMLElement>(PIC_FRAME)].map((f) => f.getBoundingClientRect()).filter((f) => f.width > 0 && f.height > 0)
          .map((f) => rect({ l: f.left, t: f.top, r: f.right, b: f.bottom }, pictureShown(place, viewW)));
        const cap = [...el.querySelectorAll<HTMLElement>(PIC_CAP)].flatMap(lineBoxes).map((b) => rect(b, pictureShown(place, viewW)));
        return [...frame, ...cap];
      });
      L.texts = [...words, ...pics];
      const box = (r: DOMRect, top: number): Box => ({ l: r.left - pinR.left, t: r.top - top, r: r.right - pinR.left, b: r.bottom - top });
      const seen = (el: HTMLElement) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? r : null; };
      L.site = [...document.querySelectorAll<HTMLElement>(CHROME_SITE)].map(seen).filter((r) => r !== null).map((r) => box(r, 0));
      L.own = [...pin.querySelectorAll<HTMLElement>(CHROME_PIN)].map(seen).filter((r) => r !== null).map((r) => box(r, pinR.top));
      // the solve: at once the first time, then after a quiet spell (a window being dragged wider measures every frame)
      window.clearTimeout(solveT);
      if (L.layer === null) solveNow();
      else solveT = window.setTimeout(() => { try { solveNow(); } catch { fail(); } }, SOLVE_QUIET);
    };
    let solveT = 0;
    /** This screen's spots and layers, from the words and chrome as last measured (the pinned frame at the screen's top). */
    const solveNow = () => {
      if (!scene || !sv || !outline || L.mode !== "track") return;
      const glassMid = L.glassMid, vw = L.vw;
      const solved = sv.solve({
        shots: SHOTS, keys: L.keys, travel: L.travel, vw, vh: L.vh, texts: L.texts, fixed: [...L.site, ...L.own], outline, lookMax: LOOK,
        at: (s) => ({ line1: L.line1, glass: { x: glassMid === null ? 0.5 : (glassMid - s) / vw, y: 0.5 } }),
      });
      L.shots = solved.shots;
      L.spots = solved.spots;
      L.layer = solved.layer;
      hook.solve = { moved: solved.moved, behind: solved.behind };
    };
    /** Measure and solve again once the arrival animation and the nav's entrance have finished (if either is running). */
    let settling = false;
    const settle = () => {
      if (settling || !tr) return;
      const els = [tr, ...document.querySelectorAll<HTMLElement>(CHROME_SITE)];
      const running = els.flatMap((el) => el.getAnimations?.({ subtree: true }) ?? []).filter((a) => {
        const end = a.effect?.getComputedTiming().endTime;
        return a.playState === "running" && typeof end === "number" && Number.isFinite(end);
      });
      if (running.length === 0) return;
      settling = true;
      void Promise.all(running.map((a) => a.finished.catch(() => undefined))).then(() => { settling = false; invalidate(); });
    };

    // ---------- the frame ----------
    let motion: MotionState = REST;
    const look: Look = { x: 0, y: 0 };
    const leaned: Look = { x: 0, y: 0 };
    const mouse = { x: 0, y: 0 };
    let drag: { x: number; y: number } | null = null, dragDX = 0, dragDY = 0;
    let last = 0, time = 0, sSm = 0, sPrev = 0, first = true, forcedK = 0;
    /** The live guard: behind since it last saw the pendant near a line, until it has been clear for GUARD_HOLD. */
    let guardBack = false, clearFor = 0;

    const step = (now: number, sc: PendantScene, cm: NonNullable<typeof cam>) => {
      const dt = Math.min(Math.max((now - last) / 1000, 0), DT_MAX);
      last = now;
      time += dt;
      const vh = window.innerHeight, y = window.scrollY;
      const sTarget = trackProgress(y, L.top, L.H, vh) * L.travel;
      if (first) { sSm = sPrev = sTarget; first = false; } // (a page opened mid-track starts where it is, no fly-in)
      sSm += (sTarget - sSm) * (1 - FOLLOW ** dt);
      const vel = (sSm - sPrev) / Math.max(dt, 1e-3);
      sPrev = sSm;
      // the glass slot rides with the track as the page shows it (not the smoothed travel): it is a place in the page
      const gx = L.glassMid === null ? 0.5 : (L.glassMid - sTarget) / L.vw;
      const f = shotAt(sSm, L.keys, L.shots, { line1: L.line1, glass: { x: gx, y: 0.5 } });
      sv?.applySpot(f, L.spots); // (this screen's rest spots)
      // the pull to Contact: it falls away into the dark as the section scrolls off
      const o = clamp01((y - (L.top + L.H - vh)) / vh);
      f.h *= 1 - OUT_SHRINK * o;
      f.ay += OUT_SINK * o;
      motion = stepMotion(motion, {
        dt, spin: f.spin, tumble: f.tumble, lock: f.lock, scrollVel: vel, dragging: drag !== null, dragDX, dragDY, reduced,
      });
      dragDX = dragDY = 0;
      look.x += (-mouse.y * LOOK - look.x) * LOOK_EASE;
      look.y += (-mouse.x * LOOK - look.y) * LOOK_EASE;
      // the glass ball, when the pendant draws it (it owns it, and the slot is there)
      const ours = glassOwner() === "pendant";
      const glass: GlassSlot | null = ours && f.glass > GLASS_MIN && L.glassMid !== null && L.glassR > 0 ? { x: gx, y: 0.5, r: L.glassR } : null;
      // (through a drawn ball the lean is eased down: the ball magnifies it and turns it over, see PendantScene.glassLook)
      leanFor(look, glass !== null, f.glass, sc.glassLook, leaned);
      cm.poseRig(f, motion, time, leaned, L.vw, L.vh, sc.camera, sc.outer, sc.inner, { still: reduced });
      const box = outline?.hull.length
        ? cm.outlineBox(outline.hull, sc.inner, sc.camera, L.vw, L.vh)
        : cm.screenBox(sc.bounds, sc.inner, sc.camera, L.vw, L.vh);
      // The layer: the one solved for this screen at this travel, not the shot's own. Then the live guard: the live outline,
      // grown by half the solve's padding, against the words where the page shows them (they ride the real scroll, the
      // pendant the eased one, so after a jump they part for a moment) and the chrome where it is (the site's chrome holds to
      // the viewport while the pinned frame moves off in the outro). Near a line it goes behind while still clear, and only
      // comes back once it has been clear for GUARD_HOLD: the solve keeps the motion's whole reach clear, so this only steps
      // in when something the solve can't see (a jump, a fast scroll's lean, a hand) carries it close.
      const pinTop = y < L.top ? L.top - y : Math.min(0, L.top + L.H - vh - y);
      const fixed = [...L.own, ...L.site.map((b) => ({ l: b.l, r: b.r, t: b.t - pinTop, b: b.b - pinTop }))];
      const near = sv !== null && hits(clipBox(padBox(box, sv.PAD / 2), L.vw, L.vh), L.texts, sTarget, fixed) > 0;
      if (near) { guardBack = true; clearFor = 0; } else if (guardBack && (clearFor += dt) >= GUARD_HOLD) guardBack = false;
      const layer: Layer = (L.layer ? L.layer(sSm) : f.layer) === "front" && !guardBack ? "front" : "back";
      // a shot that wanted the front but is behind the words dims to the tumble's brightness, eased in behind them
      const forced = layer === "back" && f.layer === "front" ? 1 : 0;
      forcedK += (forced - forcedK) * (1 - FORCED_EASE ** dt);
      const shotDim = f.dim + (Math.min(f.dim, sv?.FORCED_DIM ?? f.dim) - f.dim) * forcedK;
      const dim = shotDim * (1 - o);
      sc.draw(f, glass, dim, glass ? glassRim() : null);
      drawn = true;
      if (canvas.dataset.layer !== layer) canvas.dataset.layer = layer;
      hook.s = sSm;
      hook.layer = layer;
      hook.box = box;
      hook.yaw = motion.yaw;
      hook.dragging = drag !== null;
      hook.glass = glass && { x: glass.x, y: glass.y, r: glass.r * f.glass }; // (the scene grows the ball with f.glass)
      if (!hook.ready) { hook.ready = true; canvas.dataset.ready = ""; }
    };

    const frame = (now: number) => {
      raf = 0;
      if (off || lost || !scene || !cam || !inView || document.hidden) return;
      if (dirty) {
        try {
          measure(); // (and this screen's solve)
        } catch {
          fail();
          return;
        }
      }
      if (L.mode !== "track") return; // stacked: about.css hides it; a resize back to the track restarts it
      raf = requestAnimationFrame(frame);
      try {
        step(now, scene, cam);
      } catch {
        fail();
      }
    };
    /** Runs the loop while About is on screen, the tab is showing and the scene is live. */
    const run = () => {
      if (raf || off || lost || !scene || !cam || !inView || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const invalidate = () => { dirty = true; run(); };

    // ---------- your hand: read on the window, so the canvas never takes the links' clicks ----------
    let swallow = false, swallowT = 0;
    const onDown = (e: PointerEvent) => {
      swallow = false;
      // a control painted above the canvas keeps its press: the site nav, the resume pill, and the track's own links while
      // the pendant is behind the words. Only a link under a pendant in front of the track gives way to the grab.
      const ctl = e.target instanceof Element ? e.target.closest(CONTROL) : null;
      if (ctl && (canvas.dataset.layer === "back" || !tr?.contains(ctl))) return;
      if (!scene || !drawn || lost || L.mode !== "track" || !e.isPrimary || e.button !== 0) return;
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (x < 0 || y < 0 || x > r.width || y > r.height) return;
      let hit = false;
      try { hit = scene.hit(x, y); } catch { hit = false; } // (one raycast a press: never per move)
      if (!hit) return;
      drag = { x: e.clientX, y: e.clientY };
      swallow = true; // (the click that ends a grab doesn't follow a link under the pendant)
      e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
      if (!drag) return;
      dragDX += e.clientX - drag.x;
      dragDY += e.clientY - drag.y;
      drag.x = e.clientX;
      drag.y = e.clientY;
    };
    const onUp = () => {
      if (!drag) return;
      drag = null;
      window.clearTimeout(swallowT);
      swallowT = window.setTimeout(() => { swallow = false; }, 0); // (the click comes in the same task as the release)
    };
    const onClick = (e: MouseEvent) => {
      if (!swallow) return;
      swallow = false;
      e.preventDefault();
      e.stopPropagation();
    };
    const onSelect = (e: Event) => { if (drag) e.preventDefault(); };

    // ---------- the GPU going away, and coming back ----------
    const onLost = (e: Event) => {
      e.preventDefault(); // (lets the browser restore it)
      lost = true;
      drag = null;
      giveGlassBack(); // (the testimonials draw the ball until the pendant is back)
      canvas.hidden = true;
      hook.ready = false;
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const onRestored = () => { if (!off) setGen((n) => n + 1); };
    const onVisible = () => { if (!document.hidden) run(); };

    const io = typeof IntersectionObserver === "function" && sec
      ? new IntersectionObserver(([e]) => { inView = e.isIntersecting; run(); })
      : null;
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(invalidate) : null;
    if (sec) { io?.observe(sec); ro?.observe(sec); }
    if (tr) ro?.observe(tr);
    window.addEventListener("resize", invalidate);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("click", onClick, true);
    document.addEventListener("selectstart", onSelect);
    document.addEventListener("visibilitychange", onVisible);
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);

    /** Resolves once the section is a track (at once if it is, or if there is no section to judge by). */
    let modeObs: MutationObserver | null = null;
    const untilTrack = () => new Promise<void>((done) => {
      if (!sec || sec.dataset.mode !== "stack") { done(); return; }
      modeObs = new MutationObserver(() => {
        if (sec.dataset.mode === "stack") return;
        modeObs?.disconnect();
        modeObs = null;
        done();
      });
      modeObs.observe(sec, { attributes: true, attributeFilter: ["data-mode"] });
    });

    let torn = false;
    const teardown = () => {
      if (torn) return;
      torn = true;
      off = true;
      modeObs?.disconnect();
      if (window.__pendant === hook) delete window.__pendant;
      cancelAnimationFrame(raf);
      window.clearTimeout(swallowT);
      window.clearTimeout(solveT);
      io?.disconnect();
      ro?.disconnect();
      reducedQ.removeEventListener?.("change", onReduced);
      window.removeEventListener("resize", invalidate);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("click", onClick, true);
      document.removeEventListener("selectstart", onSelect);
      document.removeEventListener("visibilitychange", onVisible);
      // (before the dispose: its forceContextLoss fires a context-lost event this canvas must not answer)
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      hook.ready = false;
      giveGlassBack();
      try { scene?.dispose(); } catch { /* the GPU is already gone */ }
      scene = null;
    };
    /** Anything wrong: no pendant, About as it was, nothing in the console. */
    const fail = () => {
      if (off) return;
      teardown();
      setGone(true);
    };

    void (async () => {
      try {
        await afterPaint();
        if (off) return;
        await untilTrack(); // (stacked, the canvas is hidden until Task 11: three and the files wait for the track)
        if (off) return;
        // (probed after the paint too: making a GL context costs a few ms the text shouldn't wait for)
        if (!hasWebGL2()) throw new Error("no WebGL2");
        const [{ PendantScene: Scene }, camMod, solveMod] = await Promise.all([
          import("@/three/pendant/scene"), import("@/three/pendant/camera"), import("@/three/pendant/solve"),
        ]);
        if (off) return;
        const loaded = await Scene.load(canvas);
        if (off) { loaded.dispose(); return; }
        scene = loaded;
        cam = camMod;
        sv = solveMod;
        const b = loaded.bounds;
        const corners = new Float32Array([b.min.x, b.max.x].flatMap((x) => [b.min.y, b.max.y].flatMap((y) => [b.min.z, b.max.z].flatMap((z) => [x, y, z]))));
        outline = solveMod.outlineOf(loaded.outline?.length ? loaded.outline : corners);
        releaseGlass = claimGlass("pendant");
        dirty = true; // (sizes the drawing buffer before the first draw or hit: the scene's warm-up left it at 16 x 16)
        run();
      } catch {
        fail();
      }
    })();

    return teardown;
  }, [gen]);

  if (gone) return null;
  return <canvas key={gen} ref={ref} className="ab-pendant" aria-hidden />;
}
