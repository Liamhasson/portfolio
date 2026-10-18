// src/app/about/about-pendant.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { claimGlass, glassLight, glassOwner, showGlassSlot } from "@/lib/about-glass";
import type { Box, Look } from "@/three/pendant/camera";
import { clipBox, hits, padBox, type TextRect } from "@/three/pendant/layout";
import { REST, stepMotion, type MotionState } from "@/three/pendant/motion";
import { PendantGovernor } from "@/three/pendant/governor";
import { AHEAD_T, behindAhead, lagAhead, stepPresence, type Presence } from "@/three/pendant/presence";
import type { GlassSlot, PendantScene } from "@/three/pendant/scene";
import { heldIndex, SHOTS, SHOTS_STACK, shotAt, solveKeys, type Layer, type Shot } from "@/three/pendant/shots";
import type { Outline } from "@/three/pendant/solve";
import type { Spot } from "@/three/pendant/layout";
import { leanFor } from "./glass-lean";
import { pictureShown } from "./pendant-pictures";
import { trackProgress } from "./track";
import { resizeKind } from "./viewport";

/** What the page tells the e2e tests and the frame script (scripts/about/pendant-frames.cjs), rewritten every frame. */
export interface PendantHook {
  /** True once a frame has been drawn (false again while a lost context reloads). */
  ready: boolean;
  /** Where each shot is fully on, as a page scroll position (px). */
  keys: { id: string; y: number }[];
  /** The smoothed travel (track px) the frame was drawn at. */
  s: number;
  /** The layer drawn (presence.ts: the solve's timeline plus the live guard, swapped only clear of the words or through a
   *  fade dip), its eased brightness (the dim drawn, 0..1), the canvas's own fade (1 except during a dip) and the layer it
   *  is heading for (another than `layer` while a dip is under way). */
  layer: Layer;
  bright: number;
  fade: number;
  goal: Layer;
  /** The pendant's projected bounds on screen (px from the pinned frame's top-left). */
  box: Box;
  /** The glass ball as drawn (centre as a share of the viewport, radius as a share of its height), or null. Drawn full size
   *  whenever the pendant owns it and the slot is within one slot width of the screen; it is not the pendant, so `box`
   *  leaves it out. */
  glass: GlassSlot | null;
  /** This screen's solve (Task 8): the front shots whose rest changed (the alternate used, 0 = as written; the move as shares
   *  of the width / height and the scale) and those resting behind the words. */
  solve: { moved: { id: string; alt: number; dx: number; dy: number; k: number }[]; behind: string[] };
  /** The pendant's turn about its own axis (radians), and whether a hand is on it. */
  yaw: number;
  dragging: boolean;
  /** The motion blur this frame: the longest smear (CSS px, scaled to a 1/60 s shutter), whether the pass drew, and whether
   *  the frame counted as a jump (nothing smeared). */
  blur: { smear: number; on: boolean; jump: boolean };
  /** With `window.__pendantPerf` set before load and ?pendant-debug: each frame's GPU time (ms), with the travel and the nearest shot it was
   *  drawn at (scripts/about/pendant-perf.cjs); null if the GPU can't time (no EXT_disjoint_timer_query_webgl2). */
  gpuMs: { ms: number; s: number; shot: string }[] | null;
  /** The pixel ratio the pendant is drawn at (the governor's, under the screen's own), and whether its depth of field runs at
   *  half resolution (the governor's last step). */
  pixelRatio: number;
  bokehHalf: boolean;
  /** The screen's frame interval the governor reads load against (ms), null until known. */
  baseMs: number | null;
  /** "track": the sideways track (SHOTS); "stack": portrait phones and reduced motion, the page scrolling down (SHOTS_STACK). */
  mode: "track" | "stack";
  /** Reduced motion: the shot held (its index), and the canvas's opacity (a change of shot crossfades it). */
  shot: number;
  opacity: number;
  /** Whether FXAA runs (the pixel ratio drawn is under the screen's own). */
  fxaa: boolean;
  /** Diagnostics, only with ?pendant-debug (the motion meter, scripts/about/pendant-motion.cjs): the frame's number, the
   *  travel and blend it was drawn at, the pendant's middle on screen (shares of the width and height), its height (share
   *  of the screen's) and its roll on screen (degrees clockwise: the camera's roll, the shot's lay and the lean); the layer
   *  drawn and the brightness, whether the solve has it behind and over a line at that travel (`back`, `over`), and whether
   *  the brightness look ahead is dimming it for a pass behind the words to come (`ahead`). */
  pose?: {
    n: number; s: number; index: number; t: number; cx: number; cy: number; h: number; roll: number;
    layer: Layer; bright: number; back: boolean; over: boolean; ahead: boolean;
    /** Whether the look ahead would dim with the words where they are at rest (no lag): Task 1's own rule. */
    aheadBase: boolean;
  };
}

declare global {
  interface Window {
    __pendant?: PendantHook;
    /** Diagnostics: time the GPU (set before the page loads; read only with ?pendant-debug). */
    __pendantPerf?: boolean;
    /** Diagnostics: a fixed frame step (ms) in place of the real one (the frame script's STEP; read only with ?pendant-debug). */
    __pendantStep?: number;
    /** Diagnostics: the layer asked for, in place of the solve's and the guard's (the e2e's forced swap; read only with
     *  ?pendant-debug). */
    __pendantLayer?: Layer;
  }
}

/** The scroll follow: what is left of the gap after one second. 0.018 is a time constant of about 0.25 s (-1 / ln 0.018), so a
 *  flick glides rather than whips (Liam, 2026-10-18; pendant-film-v3 had 0.0008, about 0.14 s). Jumps keep their reset. */
const FOLLOW = 0.018;
/** Its time constant (s): a page scrolling steadily at v keeps the pendant about v x FOLLOW_TAU behind it. */
const FOLLOW_TAU = -1 / Math.log(FOLLOW);
/** The frames the page's pace is held over (the look ahead's guess at whether the page is still scrolling). */
const PAGE_HOLD = 6;
/** A frame never steps more than this (s): a tab coming back doesn't jump the motion. */
const DT_MAX = 0.05;
/** The cursor's lean (radians at the screen's edge) and its ease per frame (Lusion's values). */
const LOOK = 0.035;
const LOOK_EASE = 0.1;
/** The glass between the quotes: the pictures' empty 17vw slot (about-track.tsx `.ab-glass`, data-pendant="glass"), the
 *  ball's radius this share of the slot's width (spec §3: 0.44 x slot, so it never reaches either quote); drawn full size
 *  whenever the slot is within one slot width of the screen, so it travels with the track as clear glass and catches the
 *  testimonials' light; the pendant shows through it as far as the shot is through the glass (GLASS_MIN: the shot counts
 *  as through the glass, for the lean and the stacked guard). (The slot is rendered whenever there are two quotes, the only
 *  case the old quote-gap sizing covered, so that fallback is gone.) */
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
 *  exit cut at the margin has started no longer counts at all, caption included (Liam's ruling, 2026-10-16: the pendant may
 *  pass over a picture as it leaves). */
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
/** Stacked, the canvas fades in over this long once drawn (s), as the track's CSS fades it in. Under reduced motion a change
 *  of shot crossfades it: out over half of CROSSFADE, the new shot held, back in over the other half. */
const APPEAR = 0.6;
/** Stacked, the opening waits unseen while its outline is on the site's chrome (at the page's top the gap above the first
 *  line is still under the resume pill), then fades in over this long (s) as it rises clear; and back out the same way. */
const CLEAR_FADE = 0.3;
const CROSSFADE = 0.6;
/** Stacked, the pictures that hold still in the column count too: Liam's photo above the first line (on the track it is
 *  cropped away before the pendant reaches it, so only the stack avoids it). */
const STACK_PIC = ".ab-portrait";
/** The pull to Contact under About (about-track.tsx `.ab-end`): stacked, the canvas has faded out before its first line
 *  comes up the screen. */
const PULL = ".ab-end";
const PULL_FADE = 0.85;
/** The pendant's live box is the wire copy's outline (scene.ts `outline`, a decimation of the brass), grown by this share of
 *  its size plus a pixel: the drawn brass bulges past the decimated edges (measured at 1440 x 900: up to 0.5% of the hero's
 *  height, 0.9% of the glide's length past the outline's box), and the edge's antialiasing adds a pixel. */
const DRAWN_SLACK = 0.012;

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
 * Stacked (portrait phones and reduced motion, plan Task 11) the canvas is fixed to the screen and films SHOTS_STACK on the
 * page's own scroll through the section; the cursor's lean rests, and only a mouse grabs it. Under reduced motion each shot
 * is held still (no spin, drift, blur or outro move) and a change of shot crossfades the canvas.
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
    const onReduced = () => { reduced = reducedQ.matches; canvas.dataset.mode = reduced ? "still" : "live"; jumped = true; invalidate(); };
    reducedQ.addEventListener?.("change", onReduced);

    const hook: PendantHook = {
      ready: false, keys: [], s: 0, layer: "front", bright: 1, fade: 1, goal: "front", box: { l: 0, t: 0, r: 0, b: 0 }, glass: null, solve: { moved: [], behind: [] },
      yaw: 0, dragging: false, blur: { smear: 0, on: false, jump: false }, gpuMs: null, pixelRatio: 1,
      bokehHalf: false, baseMs: null, mode: "track", shot: 0, opacity: 0, fxaa: false,
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
    /** The glass slot between the stacked quotes takes its room while the pendant holds the ball and draws (about.css:
     *  `data-glass` on the section), or while the testimonials' light draws its own (about-testimonials.tsx): each side
     *  shows it for itself (about-glass.ts showGlassSlot), so the pendant letting go never collapses the light's. */
    const glassShown = (on: boolean) => { if (sec) showGlassSlot(sec, "pendant", on); };
    const giveGlassBack = () => { releaseGlass?.(); releaseGlass = null; glassShown(false); };

    // ---------- layout: the track measured (on load, resize, fonts, and whenever the track or section changes size) ----------
    /** The quality follows the frame time, both ways: the sharpness down to 1.5x, then the depth of field at half resolution
     *  (governor.ts). Diagnostics: ?governor=0 holds the screen's own ratio and full bokeh (scripts/about/pendant-perf.cjs
     *  measures each level's real cost with it); ?bokehHalf=1 holds the half-resolution bokeh on. */
    const query = new URLSearchParams(window.location.search);
    const forceHalf = query.get("bokehHalf") === "1";
    const govOn = query.get("governor") !== "0" && !forceHalf;
    /** Diagnostics, only with ?pendant-debug (read once, here): `window.__pendantStep` (a fixed frame step) and
     *  `window.__pendantPerf` (the GPU timer) are ignored without it. */
    const debug = query.has("pendant-debug");
    /** Diagnostics: ?fxaa=0 holds FXAA off (its cost is measured against it). */
    const fxaaOk = query.get("fxaa") !== "0";
    const gov = new PendantGovernor(Math.min(window.devicePixelRatio || 1, 2));
    /** The display's own pace, probed while the scene loads (before the pendant costs anything): the governor reads load
     *  against it (never under 60 fps), so a device slow from the first frame isn't taken for a slow screen. */
    let probeRaf = 0;
    const probe: number[] = [];
    const startProbe = () => {
      let at = performance.now();
      const tick = (now: number) => {
        probe.push(now - at);
        at = now;
        probeRaf = probe.length < 90 ? requestAnimationFrame(tick) : 0;
      };
      probeRaf = requestAnimationFrame(tick);
    };
    const endProbe = () => {
      cancelAnimationFrame(probeRaf);
      probeRaf = 0;
      const good = probe.slice(1).filter((ms) => ms > 0 && ms <= 250).sort((a, b) => a - b);
      if (good.length >= 10) gov.setBase(good[good.length >> 1]); // (the median: a long task or two while loading doesn't count)
    };
    const L = {
      vw: 1, vh: 1, dpr: 1, pr: 1, half: false, sized: false, mode: "track" as "track" | "stack", top: 0, H: 0, travel: 0, line1: 0.5,
      /** The track: the glass slot's centre (track px). */
      glassMid: null as number | null,
      /** The stack: the glass point (x a share of the width, y in the section's px) and whether it is the slot (the ball is
       *  drawn only round a slot; without one the glass shot sits between the quotes, their centres' midpoint). */
      glassStack: null as { x: number; y: number; slot: boolean } | null,
      /** Its radius, as a share of the screen's height. */
      glassR: 0,
      /** Stacked: the middle of the free band above the first line (section px; the opening's ay "line1"), and the page y at
       *  which the pull to Contact's first line begins (null without one). */
      lead: null as number | null,
      pullTop: null as number | null,
      /** Stacked: the large viewport's height (100lvh, measured once per real resize: the toolbar never changes it). */
      lvh: 0,
      /** FXAA on (the pixel ratio drawn is under the screen's own). */
      aa: false,
      keys: [] as number[],
      texts: [] as TextRect[],
      /** The site's chrome (viewport px, fixed to the viewport) and About's own (the pinned frame's px; stacked, the
       *  viewport's: the resume is fixed there). */
      site: [] as Box[],
      own: [] as Box[],
      /** This screen's solve: the shots as solved, their rest spots, the layer as a function of travel (null until solved). */
      shots: SHOTS as readonly Shot[],
      spots: [] as Spot[],
      layer: null as ((s: number) => Layer) | null,
      /** ...and where the pendant at rest is over a line (solve.ts `over`: what the brightness looks ahead to). */
      over: null as ((s: number) => boolean) | null,
      /** ...and the same with the words a scroll's lag further along (solve.ts `overLagging`). */
      overLagging: null as ((s: number, lag: number) => boolean) | null,
    };
    /** The shots for the layout: the track's, or the stack's. */
    const baseShots = () => (L.mode === "stack" ? SHOTS_STACK : SHOTS);
    /** The glass point on screen (shares of the viewport) at travel `s`: on the track the slot rides sideways at mid-height;
     *  stacked it rides up with the page. */
    const glassAt = (s: number): { x: number; y: number } => {
      if (L.mode === "stack") return L.glassStack ? { x: L.glassStack.x, y: (L.glassStack.y - s) / L.vh } : { x: 0.5, y: 0.5 };
      return { x: L.glassMid === null ? 0.5 : (L.glassMid - s) / L.vw, y: 0.5 };
    };
    /** The live spots for the shots' screen aims at travel `s`. */
    const atFor = (s: number) => ({
      line1: L.line1, glass: glassAt(s), line1Y: L.mode === "stack" && L.lead !== null ? (L.lead - s) / L.vh : undefined,
    });
    /** FXAA follows the pixel ratio: on while it is under the screen's own (a 3x phone at 2x, the governor's floor). */
    const syncAA = (sc: PendantScene | null) => {
      const aa = fxaaOk && L.pr < (window.devicePixelRatio || 1) - 1e-3;
      if (sc && aa !== L.aa) { sc.setAntialias(aa); L.aa = aa; }
      hook.fxaa = L.aa;
    };
    /** Stacked, the large viewport's height: a hidden 100lvh probe (100vh where lvh isn't known). */
    const lvhProbe = document.createElement("div");
    lvhProbe.setAttribute("aria-hidden", "true");
    lvhProbe.style.cssText = "position:fixed;top:0;left:0;width:0;height:100vh;visibility:hidden;pointer-events:none";
    lvhProbe.style.height = "100lvh";
    /** A height-only resize under viewport.ts TOOLBAR_MAX on a touch screen (the toolbar): measure the boxes, nothing else. */
    const coarseQ = window.matchMedia("(pointer: coarse)");
    let lastWin = { w: window.innerWidth, h: window.innerHeight }, boxesOnly = false;
    /** Whether there is a slot to draw the ball round. */
    const hasSlot = () => L.glassR > 0 && (L.mode === "stack" ? L.glassStack?.slot === true : L.glassMid !== null);
    /** Whether the slot centred at `p` (shares of the viewport) is within one slot width of the screen: along the track
     *  sideways, stacked up and down (as the testimonials' light decides it runs). */
    const slotOnScreen = (p: { x: number; y: number }) => {
      const w = (L.glassR * L.vh) / GLASS_SLOT_R;
      const c = L.mode === "stack" ? p.y * L.vh : p.x * L.vw, size = L.mode === "stack" ? L.vh : L.vw;
      return c > -w && c < size + w;
    };
    let dirty = true;
    const anchor = (name: string) => tr?.querySelector<HTMLElement>(`[data-pendant="${name}"]`) ?? null;
    // a slide's left edge along the track (offsets ignore the track's transform and the arrival animation)
    const left = (el: HTMLElement) => (el.offsetParent === tr ? el.offsetLeft : el.offsetLeft - (tr?.offsetLeft ?? 0));
    const centre = (name: string) => { const el = anchor(name); return el ? left(el) + el.offsetWidth / 2 : null; };
    /** Stacked: how far a slide's rise-in (about.css: translateY while it arrives) has it from its place right now (px). */
    const rising = (el: Element) => {
      const slide = el.closest<HTMLElement>(".ab-slide");
      if (!slide) return 0;
      const t = getComputedStyle(slide).transform;
      if (!t || t === "none") return 0;
      try { return new DOMMatrixReadOnly(t).m42; } catch { return 0; }
    };
    /** Stacked: an element's box in the section's px (y) and the screen's (x), as it stands once its slide has risen in. */
    const inSection = (r: Box, el: Element, secTop: number): Box => {
      const dy = rising(el);
      return { l: r.l, r: r.r, t: r.t - dy - secTop, b: r.b - dy - secTop };
    };
    const rectBox = (r: DOMRect): Box => ({ l: r.left, t: r.top, r: r.right, b: r.bottom });
    const measure = () => {
      dirty = false;
      if (!sec || !tr || !clip || !pin) return;
      const mode = sec.dataset.mode === "stack" ? "stack" : "track";
      if (mode !== L.mode) {
        // another film: its shots, its keys, a fresh solve at once, the follow restarting where the page is
        L.mode = mode;
        L.shots = baseShots();
        L.spots = [];
        L.layer = null;
        L.over = null;
        L.overLagging = null;
        first = true;
        jumped = true;
        held = -1;
        motion = REST;
        appear = 0;
        clearK = 0;
        presence = null;
        cssK = null;
        setOpacity(null);
      }
      hook.mode = mode;
      const stack = mode === "stack";
      // the toolbar (stacked, on a touch screen): the boxes again, no new size and no new solve
      const light = stack && boxesOnly && L.layer !== null && L.sized;
      boxesOnly = false;
      if (stack && !light) {
        if (!lvhProbe.isConnected) document.body.appendChild(lvhProbe);
        L.lvh = lvhProbe.offsetHeight || window.innerHeight;
      }
      // (stacked, the canvas is fixed to the screen at the large viewport's height: the toolbar never resizes it)
      const vw = (stack ? canvas.clientWidth : pin.clientWidth) || window.innerWidth;
      const vh = stack ? L.lvh : pin.clientHeight || window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      gov.setMax(dpr);
      const pr = govOn ? gov.pixelRatio : dpr;
      if (scene && (!L.sized || vw !== L.vw || vh !== L.vh || pr !== L.pr)) { scene.resize(vw, vh, pr); L.sized = true; }
      L.vw = vw; L.vh = vh; L.dpr = dpr; L.pr = pr;
      syncAA(scene);
      const half = forceHalf || (govOn && gov.bokehHalf);
      if (scene && half !== L.half) { scene.setBokehScale(half ? 0.5 : 1); L.half = half; }
      L.top = sec.offsetTop;
      L.H = sec.offsetHeight;
      if (stack) measureStack(vw, vh);
      else measureTrack(vw, vh);
      // (the section is a screen plus the travel, so travel px and scroll px are one to one; stacked, travel is the scroll)
      hook.keys = L.shots.map((s, i) => ({ id: s.id, y: L.top + L.keys[i] }));
      const seen = (el: HTMLElement) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? r : null; };
      // the chrome: stacked, all of it is fixed to the viewport (the canvas's own px)
      const org = (stack ? canvas : pin).getBoundingClientRect();
      const box = (r: DOMRect, top: number): Box => ({ l: r.left - org.left, t: r.top - top, r: r.right - org.left, b: r.bottom - top });
      L.site = [...document.querySelectorAll<HTMLElement>(CHROME_SITE)].map(seen).filter((r) => r !== null).map((r) => box(r, 0));
      L.own = [...pin.querySelectorAll<HTMLElement>(CHROME_PIN)].map(seen).filter((r) => r !== null).map((r) => box(r, org.top));
      // the solve: at once the first time, then after a quiet spell (a window being dragged wider measures every frame)
      if (light) return;
      window.clearTimeout(solveT);
      if (L.layer === null) solveNow();
      else solveT = window.setTimeout(() => { try { solveNow(); } catch { fail(); } }, SOLVE_QUIET);
    };
    /** The sideways track: its travel, the anchors along it, the words and pictures in track px. */
    const measureTrack = (vw: number, vh: number) => {
      if (!sec || !tr || !clip || !pin) return;
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
      L.keys = solveKeys(L.shots, (a) => (typeof a === "object" ? centre(a.pendant) : null), viewW, L.travel);
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
    };
    /** The stack: travel is the page's scroll through the section (to where its last screen shows), the anchors' middles and
     *  the words in the section's px (y) riding up with it, and every picture whole where it stands (nothing is cut there). */
    const measureStack = (vw: number, vh: number) => {
      if (!sec || !tr) return;
      // (the nav's entrance only: a slide's rise-in is taken out of its rects below, so it needs no second measure)
      settle(false);
      const secTop = sec.getBoundingClientRect().top;
      L.travel = Math.max(L.H - vh, 0);
      const mid = (name: string) => {
        const el = anchor(name);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        if (r.width <= 0 && r.height <= 0) return null; // (not laid out: the stack hides the glass slot today)
        const b = inSection(rectBox(r), el, secTop);
        return { x: (b.l + b.r) / 2, y: (b.t + b.b) / 2, w: r.width };
      };
      const l1 = mid("line1");
      L.line1 = l1 === null ? 0.5 : l1.x / vw;
      // the band above the first line: from the photo's foot (when it stands above) to the line's first row of words
      const l1El = anchor("line1"), photo = tr.querySelector<HTMLElement>(STACK_PIC);
      const row = l1El ? lineBoxes(l1El)[0] : undefined;
      const rowTop = row && l1El ? inSection(row, l1El, secTop).t : null;
      const photoR = photo?.getBoundingClientRect();
      const foot = photo && photoR && photoR.height > 0 ? inSection(rectBox(photoR), photo, secTop).b : null;
      L.lead = rowTop === null ? null : foot !== null && foot < rowTop ? (foot + rowTop) / 2 : rowTop - 0.2 * vh;
      const pull = document.querySelector<HTMLElement>(PULL);
      const pullRow = pull ? lineBoxes(pull)[0] : undefined;
      L.pullTop = pullRow ? pullRow.t + window.scrollY : null;
      const slot = mid("glass");
      if (slot) {
        L.glassStack = { x: slot.x / vw, y: slot.y, slot: true };
        L.glassR = (GLASS_SLOT_R * slot.w) / vh;
      } else {
        const q1 = mid("quote1"), q2 = mid("quote2");
        L.glassStack = q1 && q2 ? { x: 0.5, y: (q1.y + q2.y) / 2, slot: false } : null;
        L.glassR = 0;
      }
      L.keys = solveKeys(L.shots, (a) => (typeof a === "object" ? mid(a.pendant)?.y ?? null : null), vh, L.travel);
      const rect = (b: Box): TextRect => ({ l: b.l, t: b.t, w: b.r - b.l, h: b.b - b.t, axis: "y" });
      const of = (el: Element) => (b: Box) => rect(inSection(b, el, secTop));
      const words = [...tr.querySelectorAll<HTMLElement>(TEXT)].flatMap((el) => lineBoxes(el).map(of(el)));
      const frames = [...tr.querySelectorAll<HTMLElement>(`${PIC_FRAME}, ${STACK_PIC}`)].flatMap((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 ? [of(el)(rectBox(r))] : [];
      });
      const caps = [...tr.querySelectorAll<HTMLElement>(PIC_CAP)].flatMap((el) => lineBoxes(el).map(of(el)));
      L.texts = [...words, ...frames, ...caps];
    };
    let solveT = 0;
    /** This screen's spots and layers, from the words and chrome as last measured (the pinned frame at the screen's top;
     *  stacked, the page at each point of its scroll). No cursor on a phone: the stack's lean is off, so it isn't kept clear. */
    const solveNow = () => {
      if (!scene || !sv || !outline) return;
      const solved = sv.solve({
        shots: baseShots(), keys: L.keys, travel: L.travel, vw: L.vw, vh: L.vh, texts: L.texts, fixed: [...L.site, ...L.own], outline,
        lookMax: L.mode === "stack" ? 0 : LOOK,
        at: atFor,
      });
      L.shots = solved.shots;
      L.spots = solved.spots;
      L.layer = solved.layer;
      L.over = solved.over;
      L.overLagging = solved.overLagging;
      jumped = true; // (new rest spots: the pose may step)
      hook.solve = { moved: solved.moved, behind: solved.behind };
    };
    /** Measure and solve again once the arrival animation and the nav's entrance have finished (if either is running). */
    let settling = false;
    const settle = (withTrack = true) => {
      if (settling || !tr) return;
      const els = [...(withTrack ? [tr] : []), ...document.querySelectorAll<HTMLElement>(CHROME_SITE)];
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
    let last = 0, time = 0, sSm = 0, sPrev = 0, first = true;
    /** The brightness, the layer and the canvas's fade (presence.ts), stepped every frame; null until the first frame (and
     *  again for a new film), which starts where it is asked: no fade-in, no ease from full bright. */
    let presence: Presence | null = null;
    /** The track: the canvas's fade-in as about.css runs it, taken over (from its value then) while a dip runs during it, so
     *  the dip starts from what shows; null while about.css has it. */
    let cssK: number | null = null;
    /** The motion blur's reset: the pose jumped since the last frame (the loop resumed, a new solve, reduced motion
     *  toggled, the scroll jumped), so the move between the two frames is not smeared. */
    let jumped = true, sTargetPrev = 0;
    /** The page's pace (travel px per second) over the last few frames (the look ahead's guess at the lag to come). */
    const pageSteps: number[] = [];
    let pageVel = 0;
    /** Stacked: the fade-in once drawn (0..1). Reduced motion: the shot held (-1 before the first frame) and the crossfade
     *  (1 shown, down to 0 and back as the held shot changes). */
    let appear = 0, held = -1, fadeK = 1, clearK = 0;
    /** Stacked, the canvas's opacity is the frame's (the fade-in, the crossfade, the outro: the canvas is fixed to the screen
     *  there, so it can't scroll off with the pinned frame); null hands it back to about.css (the track). */
    let opacityNow: string | null = null;
    const setOpacity = (v: number | null) => {
      const next = v === null ? null : (Math.round(Math.min(Math.max(v, 0), 1) * 1000) / 1000).toString();
      if (next === opacityNow) return;
      opacityNow = next;
      canvas.style.opacity = next ?? "";
      canvas.style.transition = next === null ? "" : "none";
      hook.opacity = next === null ? 1 : Number(next);
    };
    /** Diagnostics (window.__pendantPerf): the frames whose GPU time is still on its way back. */
    let frameNo = 0;
    const perfFrames = new Map<number, { s: number; shot: string }>();
    /** The index of the shot whose key is nearest this travel. */
    const nearestIndex = (s: number) => {
      let best = 0;
      for (let i = 1; i < L.keys.length; i++) if (Math.abs(L.keys[i] - s) < Math.abs(L.keys[best] - s)) best = i;
      return best;
    };
    const nearestShot = (s: number) => L.shots[nearestIndex(s)]?.id ?? "";
    /** The live guard: behind since it last saw the pendant near a line, until it has been clear for GUARD_HOLD. */
    let guardBack = false, clearFor = 0;

    /** A governor level onto the scene: a resize only when the pixel ratio changes, the bokeh's scale only when its step
     *  does (that never resizes). Before the first measure there is nothing to apply: measure reads the governor itself. */
    const applyLevel = (next: { pr: number; bokehHalf: boolean }, sc: PendantScene) => {
      if (!L.sized) return;
      if (next.pr !== L.pr) { L.pr = next.pr; sc.resize(L.vw, L.vh, next.pr); }
      if (next.bokehHalf !== L.half) { L.half = next.bokehHalf; sc.setBokehScale(next.bokehHalf ? 0.5 : 1); }
      syncAA(sc);
    };

    const step = (now: number, sc: PendantScene, cm: NonNullable<typeof cam>) => {
      const fixedStep = debug ? window.__pendantStep : undefined;
      const stepped = typeof fixedStep === "number" && fixedStep > 0;
      // the governor's step first, then the frame: a resize clears the canvas, so one made after the draw would show blank
      const next = govOn && !stepped ? gov.sample(now - last) : null;
      if (next !== null) applyLevel(next, sc);
      const dt = stepped ? fixedStep / 1000 : Math.min(Math.max((now - last) / 1000, 0), DT_MAX);
      last = now;
      time += dt;
      const stack = L.mode === "stack";
      // the travel: the track's progress across its overflow, or (stacked) the page's scroll through the section
      const vh = stack ? L.vh : window.innerHeight, y = window.scrollY;
      const sTarget = stack ? Math.min(Math.max(y - L.top, 0), L.travel) : trackProgress(y, L.top, L.H, vh) * L.travel;
      if (first) { sSm = sPrev = sTargetPrev = sTarget; first = false; } // (a page opened mid-track starts where it is, no fly-in)
      if (Math.abs(sTarget - sTargetPrev) > vh) jumped = true; // (a jump, not a scroll: an anchor, a key, a restore)
      // the page's own pace, for the look ahead below: the fastest step of the last PAGE_HOLD frames (a wheel's notches
      // arrive a frame apart), a step over a sixth of the screen counting as a jump (a key, an anchor), not a pace
      const pageStep = sTarget - sTargetPrev;
      pageSteps.push(Math.abs(pageStep) > vh / 6 ? 0 : pageStep / Math.max(dt, 1e-3));
      if (pageSteps.length > PAGE_HOLD) pageSteps.shift();
      pageVel = pageSteps.reduce((m, v) => (Math.abs(v) > Math.abs(m) ? v : m), 0);
      sTargetPrev = sTarget;
      sSm += (sTarget - sSm) * (1 - FOLLOW ** dt);
      const vel = (sSm - sPrev) / Math.max(dt, 1e-3);
      sPrev = sSm;
      // Reduced motion: no blend and no follow, the shot nearest the page held still; a change of shot crossfades the canvas,
      // out to nothing, the new shot put in place unseen, then back in.
      if (reduced) {
        // (the held shot changes only once the page is well past the middle: viewing near it never flickers)
        const want = heldIndex(held, sTarget, L.keys);
        // (a locked face is put to the camera at once, unseen, rather than turned to it)
        const hold = (i: number) => { held = i; jumped = true; const lock = L.shots[i]?.lock ?? null; motion = { ...REST, yaw: lock === null ? 0 : (lock * Math.PI) / 180 }; };
        if (held < 0) hold(want);
        if (want !== held) {
          fadeK = Math.max(fadeK - dt / (CROSSFADE / 2), 0);
          if (fadeK === 0) hold(want);
        } else fadeK = Math.min(fadeK + dt / (CROSSFADE / 2), 1);
      } else { held = -1; fadeK = 1; }
      const sAt = reduced ? L.keys[held] ?? 0 : sSm;
      // the glass rides with the page as the page shows it (not the smoothed travel): it is a place in the page. Held, it is
      // where the held shot has it.
      const gp = glassAt(reduced ? sAt : sTarget);
      const f = shotAt(sAt, L.keys, L.shots, { ...atFor(sAt), glass: gp });
      sv?.applySpot(f, L.spots); // (this screen's rest spots)
      // the pull to Contact: it falls away into the dark as the section scrolls off (held still: only the fade)
      const o = clamp01((y - (L.top + L.H - vh)) / vh);
      if (!reduced) {
        f.h *= 1 - OUT_SHRINK * o;
        f.ay += OUT_SINK * o;
      }
      motion = stepMotion(motion, {
        dt, spin: f.spin, tumble: f.tumble, lock: f.lock, lockMix: f.lockMix, scrollVel: vel, dragging: drag !== null, dragDX, dragDY, reduced,
      });
      dragDX = dragDY = 0;
      // the cursor's lean (stacked there is no cursor to follow: it rests)
      look.x += ((stack ? 0 : -mouse.y * LOOK) - look.x) * LOOK_EASE;
      look.y += ((stack ? 0 : -mouse.x * LOOK) - look.y) * LOOK_EASE;
      // the glass ball, when the pendant draws it (it owns it, and the slot is within one slot width of the screen), full
      // size. It is a place in the page: it rides with the page as the page shows it. Held still (reduced motion), it is
      // where the held shot has it while that shot is through the glass (the pendant inside must line up), else where the
      // page has it (clear glass, nothing to line up).
      const ours = glassOwner() === "pendant";
      const ballAt = reduced && f.glass <= GLASS_MIN ? glassAt(sTarget) : gp;
      // (held still over the words, stacked under reduced motion while the held shot is through the glass: the quotes scroll
      // over it, so it counts for the guard below and dims with the pendant as it goes behind them)
      const heldBall = stack && reduced && f.glass > GLASS_MIN;
      const glass: GlassSlot | null = ours && hasSlot() && slotOnScreen(ballAt) ? { x: ballAt.x, y: ballAt.y, r: L.glassR, dimmed: heldBall } : null;
      // (through a drawn ball the lean is eased down: the ball magnifies it and turns it over, see PendantScene.glassLook)
      leanFor(look, glass !== null, f.glass, sc.glassLook, leaned);
      cm.poseRig(f, motion, time, leaned, L.vw, L.vh, sc.camera, sc.outer, sc.inner, { still: reduced });
      const mid = debug ? cm.screenCentre(sc.inner, sc.camera) : null; // (diagnostics: the motion meter's, below)
      const wireBox = outline?.hull.length
        ? cm.outlineBox(outline.hull, sc.inner, sc.camera, L.vw, L.vh)
        : cm.screenBox(sc.bounds, sc.inner, sc.camera, L.vw, L.vh);
      // (the outline is the low-poly wire copy's: the brass drawn round it reaches a little further, DRAWN_SLACK of its size)
      const box = padBox(wireBox, DRAWN_SLACK * Math.max(wireBox.r - wireBox.l, wireBox.b - wireBox.t) + 1);
      // The layer: the one solved for this screen at this travel, not the shot's own. Then the live guard: the live outline,
      // grown by half the solve's padding, against the words where the page shows them (they ride the real scroll, the
      // pendant the eased one, so after a jump they part for a moment) and the chrome where it is (the site's chrome holds to
      // the viewport while the pinned frame moves off in the outro). Near a line it goes behind while still clear, and only
      // comes back once it has been clear for GUARD_HOLD: the solve keeps the motion's whole reach clear, so this only steps
      // in when something the solve can't see (a jump, a fast scroll's lean, a hand) carries it close. Held still (reduced
      // motion), the words scroll past the held shot, and the guard is what takes it behind them as they come.
      // (stacked, the canvas and all the chrome are fixed to the viewport: nothing to shift)
      const pinTop = stack ? 0 : y < L.top ? L.top - y : Math.min(0, L.top + L.H - vh - y);
      const fixed = [...L.own, ...L.site.map((b) => ({ l: b.l, r: b.r, t: b.t - pinTop, b: b.b - pinTop }))];
      // (stacked and held still under reduced motion, the ball counts too while the held shot is through it: it stays where
      // the shot has it and the quotes scroll past it. Otherwise it rides its slot in the page, in the gap between the quotes,
      // never over a line, and it is not the pendant: left out, or its full disc joined to the pendant's box (padded) would
      // reach the quotes' lines round the slot and send the pendant behind them all the way through the glass)
      const ball = heldBall && glass ? { r: glass.r * L.vh, x: glass.x * L.vw, y: glass.y * L.vh } : null;
      const guarded = ball
        ? { l: Math.min(box.l, ball.x - ball.r), r: Math.max(box.r, ball.x + ball.r), t: Math.min(box.t, ball.y - ball.r), b: Math.max(box.b, ball.y + ball.r) }
        : box;
      const near = sv !== null && hits(clipBox(padBox(guarded, sv.PAD / 2), L.vw, L.vh), L.texts, sTarget, fixed) > 0;
      if (near) { guardBack = true; clearFor = 0; } else if (guardBack && (clearFor += dt) >= GUARD_HOLD) guardBack = false;
      const forcedLayer = debug ? window.__pendantLayer : undefined;
      const asked: Layer = forcedLayer ?? (L.layer?.(sAt) === "front" && !guardBack ? "front" : "back");
      // Stacked, what the canvas's opacity is made of besides a dip: the fade-in once drawn, the opening's wait off the chrome
      // (as of the last frame: it hangs on the layer, below), the reduced-motion crossfade and the pull to Contact. On the
      // track, about.css fades it in once drawn.
      let away = 0;
      if (stack) {
        // the pull to Contact: gone between the section's foot reaching the screen's (as the page shows it, toolbar and all)
        // and the pull's first line coming up into view
        const shownH = window.innerHeight, foot = L.top + L.H - shownH;
        const gap = L.pullTop === null ? 0.1 * shownH : L.pullTop - (L.top + L.H);
        // (done over the first PULL_FADE of that gap: fully out a little before the line, never a sub-pixel after it)
        away = clamp01((y - foot) / Math.max(gap * PULL_FADE, 1));
        appear = Math.min(appear + dt / APPEAR, 1);
      }
      const shows = stack ? appear * clearK * fadeK * (1 - away) > 0 : hook.ready && fadeK > 0;
      // Whether a layer change now would show: the outline itself (unpadded) over a line or the chrome, while the canvas
      // shows at all (unseen, a swap is instant). (Inside the padded box `near` tested, so only tested when that hit.)
      const overlapping = shows && near && hits(clipBox(guarded, L.vw, L.vh), L.texts, sTarget, fixed) > 0;
      // The brightness wanted: the shot's dim, at most solve.ts FORCED_DIM while it is behind the words or going there (a
      // shot that wanted the front and the tumble alike), and on the track the outro (the pinned frame carries it off;
      // stacked it fades instead, below). presence.ts eases the brightness to it, swaps the layer only clear of the words
      // or through a quick fade dip, and holds a request to come in front for its HOLD.
      // "Going there" looks ahead along the solve's timeline, in the direction the pendant travels, as far as it goes in
      // AHEAD_T at its own speed (plus the follow's lag, which it covers whatever the page does): the brightness takes about
      // that long to ease down, so a quick scroll reaches the words already dimmed. Only a sustained stretch where it will be
      // behind the words and over a line counts (presence.ts MIN_BACK; behind but clear, nothing shows), and at rest it
      // looks no further than the lag: a pendant that stays in front isn't dimmed.
      // "Over a line" there is as the pendant will meet it: the words ride the page while the pendant trails it by the lag,
      // with the lag it will have there (presence.ts lagAhead: it shrinks toward that stretch unless the page keeps
      // scrolling; solve.ts overLagging). At rest (no lag) that is the solve's own spells behind and over a line: its front
      // is clear of every line. During a scroll it is those, plus the places where the lag carries a line onto the pendant
      // in a front stretch: the live guard sends it behind the words there, so it will be behind and over a line all the
      // same, and has to arrive dimmed (a brisk scroll up through the glass's approach meets one: e2e "a brisk scroll").
      // (Held still under reduced motion, nothing travels: no look ahead.)
      const lag = sTarget - sSm, dir = Math.sign(vel) || Math.sign(lag);
      const lead = Math.min(Math.abs(lag) + Math.abs(vel) * AHEAD_T, stack ? L.vh : L.vw);
      const layerAt = L.layer, overAt = L.over, overLag = L.overLagging;
      const ahead = !reduced && forcedLayer === undefined && layerAt !== null && overLag !== null
        && behindAhead((x) => overLag(x, lagAhead(x, sAt, lag, pageVel, FOLLOW_TAU)) && (layerAt(x) === "back" || lag !== 0), sAt, lead, dir);
      // (stacked, the opening coming in is unseen until the layers have it in front, then fades in: it arrives at full
      // brightness, never dimmed for the moment it was behind unseen)
      const opening = stack && (reduced ? held === 0 : f.index === 0 && f.t < 0.5);
      const behind = (asked === "back" || presence?.layer === "back" || ahead) && !(opening && clearK < 1);
      const shotDim = behind ? Math.min(f.dim, sv?.FORCED_DIM ?? f.dim) : f.dim;
      const wantDim = stack ? shotDim : shotDim * (1 - o);
      presence = presence
        ? stepPresence(presence, { layer: asked, dim: wantDim, overlapping }, dt)
        : { layer: asked, bright: wantDim, fade: 1 };
      const { layer, bright: dim, fade } = presence;
      const tag = ++frameNo;
      if (hook.gpuMs) perfFrames.set(tag, { s: sAt, shot: nearestShot(sAt) });
      // (held still, nothing is smeared: every frame starts the blur afresh)
      sc.draw(f, glass, dim, glass ? glassLight() : null, { dt, reset: jumped || reduced, tag });
      jumped = false;
      drawn = true;
      if (stack) {
        // the opening, while its outline is on the chrome (the resume pill at the page's top): unseen, not dimmed behind it
        // (and, while it is still coming in, until the layers have it in front: there it is clear of the chrome by the motion's
        // whole reach, so it arrives at full brightness rather than dimmed behind; once in, behind the words dims as ever)
        const onChrome = opening && hits(clipBox(padBox(box, (sv?.PAD ?? 8) / 2), L.vw, L.vh), [], 0, fixed) > 0;
        const unseen = onChrome || (opening && layer === "back" && clearK < 1);
        clearK = unseen ? Math.max(clearK - dt / CLEAR_FADE, 0) : Math.min(clearK + dt / CLEAR_FADE, 1);
        setOpacity(appear * clearK * fadeK * fade * (1 - away));
      } else {
        // the track: about.css's opacity, but for a dip. A dip during about.css's 0.6 s fade-in takes the fade-in over from
        // the value it has reached and runs the rest of it here; once both are whole: "1", then about.css's own 1.
        if (fade < 1 && cssK === null) cssK = opacityNow === null ? Number(getComputedStyle(canvas).opacity) || 0 : 1;
        if (cssK !== null) cssK = Math.min(cssK + dt / APPEAR, 1);
        const v = (cssK ?? 1) * fade;
        if (v < 1) setOpacity(v);
        else { cssK = null; setOpacity(opacityNow === null || opacityNow === "1" ? null : 1); }
      }
      hook.blur = sc.blurState;
      // (the box the page is told: what is drawn, the motion blur's smear included)
      const drawnBox = hook.blur?.on ? padBox(box, hook.blur.smear) : box;
      hook.pixelRatio = L.pr;
      hook.bokehHalf = L.half;
      hook.baseMs = gov.base;
      if (hook.gpuMs) {
        // (a query reads back a few frames late: each time goes to the frame it timed)
        for (const t of sc.takeGpuTimes()) {
          const at = perfFrames.get(t.tag);
          if (at && hook.gpuMs.length < 100_000) hook.gpuMs.push({ ms: t.ms, ...at });
        }
        for (const k of perfFrames.keys()) if (k < tag - 64) perfFrames.delete(k); else break;
      }
      if (canvas.dataset.layer !== layer) canvas.dataset.layer = layer;
      hook.s = sAt;
      hook.shot = reduced ? held : nearestIndex(sAt);
      hook.layer = layer;
      hook.bright = dim;
      hook.fade = fade;
      hook.goal = presence.goal ?? layer;
      hook.box = drawnBox;
      hook.yaw = motion.yaw;
      if (mid) {
        hook.pose = {
          n: tag, s: sAt, index: f.index, t: f.t, cx: mid.x, cy: mid.y, h: f.h, roll: f.roll + f.rz - motion.tilt / (Math.PI / 180),
          layer, bright: dim, back: L.layer?.(sAt) === "back", over: L.over?.(sAt) ?? false, ahead,
          aheadBase: !reduced && forcedLayer === undefined && layerAt !== null && overAt !== null
            && behindAhead((x) => layerAt(x) === "back" && overAt(x), sAt, lead, dir),
        };
      }
      hook.dragging = drag !== null;
      hook.glass = glass && { x: glass.x, y: glass.y, r: glass.r };
      if (!hook.ready) { hook.ready = true; canvas.dataset.ready = ""; }
      glassShown(releaseGlass !== null);
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
      const now = performance.now(), paused = now - last;
      last = now;
      jumped = true; // (the loop was stopped: the scroll may have moved meanwhile)
      // (a pause isn't a frame: the governor starts its reading afresh, and returns a step it hadn't finished judging; the
      // resize, if any, lands before the next frame is drawn. A short pause keeps its step-down wait.)
      const back = gov.resume(paused);
      if (back !== null && govOn) applyLevel(back, scene);
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
      if (!scene || !drawn || lost || !e.isPrimary || e.button !== 0) return;
      // (stacked on a phone a finger scrolls the page: only a mouse grabs it there, as under reduced motion on a desktop)
      if (L.mode === "stack" && e.pointerType !== "mouse") return;
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
      ? new IntersectionObserver(([e]) => {
        inView = e.isIntersecting;
        // (stacked, the canvas is fixed to the screen: past About it must not hold its last frame there)
        if (!inView && L.mode === "stack") setOpacity(0);
        run();
      })
      : null;
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(invalidate) : null;
    if (sec) { io?.observe(sec); ro?.observe(sec); }
    if (tr) ro?.observe(tr);
    const onResize = () => {
      const now = { w: window.innerWidth, h: window.innerHeight };
      if (L.mode === "stack" && resizeKind(lastWin, now, coarseQ.matches) === "toolbar") boxesOnly = true;
      else { lastWin = now; boxesOnly = false; }
      invalidate();
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("click", onClick, true);
    document.addEventListener("selectstart", onSelect);
    document.addEventListener("visibilitychange", onVisible);
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);

    /** A change of layout (about-track.tsx sets data-mode: the track, or stacked) measures and solves again. */
    const modeObs = typeof MutationObserver === "function" && sec ? new MutationObserver(invalidate) : null;
    if (sec) modeObs?.observe(sec, { attributes: true, attributeFilter: ["data-mode"] });

    let torn = false;
    const teardown = () => {
      if (torn) return;
      torn = true;
      off = true;
      modeObs?.disconnect();
      if (window.__pendant === hook) delete window.__pendant;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(probeRaf);
      window.clearTimeout(swallowT);
      window.clearTimeout(solveT);
      io?.disconnect();
      ro?.disconnect();
      reducedQ.removeEventListener?.("change", onReduced);
      window.removeEventListener("resize", onResize);
      lvhProbe.remove();
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
        // (probed after the paint too: making a GL context costs a few ms the text shouldn't wait for)
        if (!hasWebGL2()) throw new Error("no WebGL2");
        startProbe(); // (the display's pace, while three and the files load)
        const [{ PendantScene: Scene }, camMod, solveMod] = await Promise.all([
          import("@/three/pendant/scene"), import("@/three/pendant/camera"), import("@/three/pendant/solve"),
        ]);
        if (off) return;
        const loaded = await Scene.load(canvas);
        if (off) { loaded.dispose(); return; }
        endProbe();
        scene = loaded;
        if (debug && window.__pendantPerf) hook.gpuMs = loaded.enableGpuTiming() ? [] : null;
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
