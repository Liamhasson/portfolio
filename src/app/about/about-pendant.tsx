// src/app/about/about-pendant.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { Box, Look } from "@/three/pendant/camera";
import type { TextRect } from "@/three/pendant/layout";
import { REST, stepMotion, type MotionState } from "@/three/pendant/motion";
import type { GlassSlot, PendantScene } from "@/three/pendant/scene";
import { SHOTS, shotAt, solveKeys, type Layer } from "@/three/pendant/shots";
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
/** The glass between the quotes (a basic slot until the testimonials thread tags it, Task 9): it fills the real gap between
 *  the two quotes, less quote 2's hanging open-quote (0.6em left of its text) and this margin (px) on each side, so it never
 *  touches either quote; drawn while the shot is at least GLASS_MIN "through the glass". */
const GLASS_HANG = 0.6;
const GLASS_MARGIN = 12;
const GLASS_MIN = 0.02;
/** What is painted above the canvas and must keep its press (links, buttons, fields). */
const CONTROL = "a, button, input, select, textarea, [role=button]";
/** The outro, as the pull to Contact rises: it shrinks by this share, sinks this share of the screen, and fades out. */
const OUT_SHRINK = 0.6;
const OUT_SINK = 0.5;
/** The words the pendant must never cover while in front of them (Task 8 solves the layers from these boxes). */
const TEXT = ".ab-big, .ab-quote blockquote, .ab-quote figcaption, .ab-verb .ab-mono, .ab-verb-title, .ab-skills li, .cap";

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);

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

    const hook: PendantHook = { ready: false, keys: [], s: 0, layer: "front", box: { l: 0, t: 0, r: 0, b: 0 }, glass: null };
    window.__pendant = hook;

    let off = false, lost = false, drawn = false, inView = true;
    let scene: PendantScene | null = null;
    let cam: typeof import("@/three/pendant/camera") | null = null;
    let raf = 0;

    // ---------- layout: the track measured (on load, resize, fonts, and whenever the track or section changes size) ----------
    const L = {
      vw: 1, vh: 1, dpr: 1, sized: false, mode: "track", top: 0, H: 0, travel: 0, line1: 0.5,
      /** The gap between the two quotes (track px): the glass slot's centre. */
      glassMid: null as number | null,
      /** Its radius, as a share of the screen's height. */
      glassR: 0,
      keys: [] as number[],
      texts: [] as TextRect[],
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
      const q1 = anchor("quote1"), q2 = anchor("quote2");
      if (q1 && q2) {
        const bq = q2.querySelector("blockquote");
        const hang = bq ? GLASS_HANG * (parseFloat(getComputedStyle(bq).fontSize) || 0) : 0;
        const from = left(q1) + q1.offsetWidth, to = left(q2) - hang;
        L.glassMid = (from + to) / 2;
        L.glassR = Math.max(to - from - 2 * GLASS_MARGIN, 0) / 2 / vh;
      } else {
        L.glassMid = null;
        L.glassR = 0;
      }
      L.keys = solveKeys(SHOTS, (a) => (typeof a === "object" ? centre(a.pendant) : null), viewW, L.travel);
      // (the section is a screen plus the travel, so travel px and scroll px are one to one)
      hook.keys = SHOTS.map((s, i) => ({ id: s.id, y: L.top + L.keys[i] }));
      const trR = tr.getBoundingClientRect(), pinR = pin.getBoundingClientRect();
      L.texts = [...tr.querySelectorAll<HTMLElement>(TEXT)].map((el) => {
        const r = el.getBoundingClientRect();
        return { l: r.left - trR.left, t: r.top - pinR.top, w: r.width, h: r.height };
      });
    };

    // ---------- the frame ----------
    let motion: MotionState = REST;
    const look: Look = { x: 0, y: 0 };
    const mouse = { x: 0, y: 0 };
    let drag: { x: number; y: number } | null = null, dragDX = 0, dragDY = 0;
    let last = 0, time = 0, sSm = 0, sPrev = 0, first = true;

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
      const f = shotAt(sSm, L.keys, SHOTS, { line1: L.line1, glass: { x: gx, y: 0.5 } });
      // the pull to Contact: it falls away into the dark as the section scrolls off
      const o = clamp01((y - (L.top + L.H - vh)) / vh);
      f.h *= 1 - OUT_SHRINK * o;
      f.ay += OUT_SINK * o;
      const dim = f.dim * (1 - o);
      motion = stepMotion(motion, {
        dt, spin: f.spin, tumble: f.tumble, lock: f.lock, scrollVel: vel, dragging: drag !== null, dragDX, dragDY, reduced,
      });
      dragDX = dragDY = 0;
      look.x += (-mouse.y * LOOK - look.x) * LOOK_EASE;
      look.y += (-mouse.x * LOOK - look.y) * LOOK_EASE;
      cm.poseRig(f, motion, time, look, L.vw, L.vh, sc.camera, sc.outer, sc.inner, { still: reduced });
      const glass: GlassSlot | null = f.glass > GLASS_MIN && L.glassMid !== null && L.glassR > 0 ? { x: gx, y: 0.5, r: L.glassR } : null;
      sc.draw(f, glass, dim);
      drawn = true;
      // (Task 8 replaces the shot's own layer with the one solved from the text boxes)
      if (canvas.dataset.layer !== f.layer) canvas.dataset.layer = f.layer;
      hook.s = sSm;
      hook.layer = f.layer;
      hook.box = cm.screenBox(sc.bounds, sc.inner, sc.camera, L.vw, L.vh);
      hook.glass = glass && { x: glass.x, y: glass.y, r: glass.r * f.glass }; // (the scene grows the ball with f.glass)
      if (!hook.ready) { hook.ready = true; canvas.dataset.ready = ""; }
    };

    const frame = (now: number) => {
      raf = 0;
      if (off || lost || !scene || !cam || !inView || document.hidden) return;
      if (dirty) measure();
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
        const [{ PendantScene: Scene }, camMod] = await Promise.all([import("@/three/pendant/scene"), import("@/three/pendant/camera")]);
        if (off) return;
        const loaded = await Scene.load(canvas);
        if (off) { loaded.dispose(); return; }
        scene = loaded;
        cam = camMod;
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
