// src/app/about/about-testimonials.tsx
"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { glassOwner, setGlassLight, showGlassSlot, type GlassLight, type GlassOwner } from "@/lib/about-glass";
import type { LightBall, LightFrame, TestimonialsLight } from "@/three/edge-light/testimonials-light";
import { lensBand, lensDepth, lensMap, lensScale, lensStrips, lensSupported, type LensEdge, type LensLayout } from "./edge-lens";
import { pulsePhase, stepArrival, testimonialsQ, type Arrival } from "./testimonials-q";
import { trackProgress, trackX } from "./track";
import { resizeKind } from "./viewport";

/** What the page tells the e2e tests, rewritten (frozen: read-only) every frame the light runs. */
export interface TestimonialsHook {
  /** The scrub, 0..1. */
  q: number;
  /** The arrival wave's phase: −1 none yet, else 0..1 (held at 1 once it has run). */
  pulse: number;
  /** The light is running and its canvas showing. */
  drawing: boolean;
  /** The light draws the glass ball itself (nobody else has claimed it, and the slot is near the screen). */
  ownBall: boolean;
  /** The glass edges (edge-lens.ts): the displacement's scale as set on the filter while the lens shows, 0 while it's hidden
   *  (and always where there's no lens: not Chromium). */
  lens: number;
  /** Diagnostics, only with ?pendant-debug and `window.__pendantPerf` set before load (scripts/about/pendant-perf.cjs): each
   *  drawn frame's GPU time (ms) on the light's own context, with the frame's q, whether it drew its own ball and whether the
   *  lens showed. Absent otherwise, and where the GPU can't time (no EXT_disjoint_timer_query). */
  gpuMs?: { ms: number; q: number; ownBall: boolean; lens: boolean }[];
}

declare global {
  interface Window {
    __testimonials?: Readonly<TestimonialsHook>;
  }
}


/** The lens's feature check never changes in a visit: nothing to subscribe to. */
const noSubscribe = () => () => {};
const lensClient = () => typeof navigator !== "undefined" && lensSupported(navigator);
const lensServer = () => false;

/** The lens's strips, in lensStrips' order: each its own filter, its own slice of the map. */
const LENS_EDGES: readonly LensEdge[] = ["top", "right", "bottom", "left"];

/** The screen as the lens covers it: as wide as the client (fixed strips leave out a classic scrollbar), as tall as the
 *  tallest the fixed strips can ever be. On Android Chrome the client height is the small viewport and stays put while the
 *  fixed layer grows with the URL bar hidden, so it is taken against the large viewport (`lvh`: a hidden fixed 100lvh
 *  probe's height). The map built for that height covers the strips in both bar states, and it doesn't change with the
 *  bar, so the bar never rebuilds it. */
const lensScreen = (lvh: number) => ({
  w: document.documentElement.clientWidth || window.innerWidth,
  h: Math.max(document.documentElement.clientHeight || window.innerHeight, lvh),
});

/** A stacked slide's rise-in (about.css: translateY until it has come into view), px: taken out of its rect, so the stack is
 *  measured where each slide stands once risen, as the pendant measures it. */
function rising(el: Element): number {
  const t = getComputedStyle(el).transform;
  if (!t || t === "none") return 0;
  try { return new DOMMatrixReadOnly(t).m42; } catch { return 0; }
}

/** About's text first: the fonts, then a quiet moment (as the pendant). */
function afterPaint(): Promise<void> {
  const fonts = document.fonts?.ready ?? Promise.resolve();
  return Promise.resolve(fonts).catch(() => undefined).then(() => new Promise<void>((done) => {
    if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(() => done(), { timeout: 2000 });
    else setTimeout(done, 200);
  }));
}

/**
 * The testimonials' light on About (plan 2026-10-17-about-testimonials-light, Task 2): as Yoav's and Andrada's quotes pass
 * on the sideways track, a warm light hugs the screen's edges (one fixed see-through canvas above the pinned frame), the
 * black behind the words warms (`.ab-mood`, about-track.tsx: its `--q` set here), and one wave crosses the screen as the
 * light arrives. While nobody else draws the glass ball between the quotes (glassOwner(): the pendant claims it once its
 * scene is ready), the light draws its own. It loads after the text has painted, runs only while q > 0 or the slot is
 * within one slot width of the screen, and anything wrong (no WebGL, a lost context) leaves the quotes as they were. Every
 * frame it draws with q > 0 it tells the pendant the light's state (about-glass.ts `setGlassLight`), so the pendant's own
 * ball glints in the same edge colours; null whenever the light is off.
 * Stacked (portrait phones, reduced motion: plan Task 5) the same, scrubbed by the page's vertical scroll: q from the quotes'
 * vertical centres and the large viewport's height, the wave from the bottom edge, the canvas fixed at the large viewport's
 * height (the phone's toolbar never resizes it), and the stack's glass slot opened while the light is there to draw the
 * ball (about-glass.ts showGlassSlot: the pendant shows it too, while it draws).
 */
export function AboutTestimonials() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [gone, setGone] = useState(false);
  /** One canvas per light: after dispose's forced loss a canvas can never be given a context again. */
  const [gen, setGen] = useState(0);
  /** The glass edges (edge-lens.ts): Chromium only; elsewhere no lens element at all. */
  const lensOn = useSyncExternalStore(noSubscribe, lensClient, lensServer);
  /** The strips' container (display: contents while shown, so the strips sit straight in the pinned frame) and the filters. */
  const lensRef = useRef<HTMLDivElement>(null);
  const defsRef = useRef<SVGSVGElement>(null);
  /** The lens's map is in place: until it is the lens never shows (an empty feImage is transparent, which would shift the
   *  whole strip by half the scale). */
  const lensReady = useRef(false);

  // The lens's map: built at half the screen's resolution (rounded up), first once About's text has painted (on the track or
  // stacked: a visit that never reaches the testimonials before the page is idle pays nothing during load), then again
  // 150 ms after a resize settles that changed the screen's size (lensScreen: the large viewport's height, so a phone's URL
  // bar rebuilds nothing). Each strip gets its own slice as a PNG (a filter reading only its strip's pixels is far cheaper
  // than four reading the whole map), placed in its strip's own space where the full map would put it, so the strips meet
  // without a seam. Built for the tallest screen, a side slice runs past its strip's foot while the fixed layer is shorter
  // (the URL bar showing): the filter clips it to the strip, and the bottom strip's slice is the map's foot wherever that
  // strip sits. Meanwhile, after a real resize, each old slice is stretched over its strip's new box at once, so no part
  // of a strip is ever left outside its map. Gone with the light (a failure): no more work.
  // On the desktop track only the left and right strips show, each the full height (edge-lens.ts LensLayout "sides": about.css
  // hides the top and bottom ones there); stacked, all four. A change of layout (the section's data-mode) rebuilds the
  // slices at once, before the next frame paints, so a strip is never shown with a slice built for the other layout.
  useEffect(() => {
    if (!lensOn || gone) return;
    const box = lensRef.current, defs = defsRef.current;
    if (!box || !defs) return;
    const imgs = LENS_EDGES.map((e) => defs.querySelector<SVGFEImageElement>(`#ab-edge-lens-${e} feImage`));
    if (imgs.some((i) => !i)) return;
    const imgOf = (e: LensEdge) => imgs[LENS_EDGES.indexOf(e)]!;
    const sec = box.closest<HTMLElement>(".ab");
    const layout = (): LensLayout => (sec?.dataset.mode === "track" ? "sides" : "four");
    const c = document.createElement("canvas");
    /** The large viewport's height, from a hidden fixed 100lvh probe (100vh where lvh isn't known), as the pendant has it. */
    const probe = document.createElement("div");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText = "position:fixed;top:0;left:0;width:0;height:100vh;visibility:hidden;pointer-events:none";
    probe.style.height = "100lvh";
    document.body.appendChild(probe);
    const screenSize = () => lensScreen(probe.offsetHeight);
    let timer = 0, depth = 0, off = false, painted = false;
    /** The screen size and layout the slices were built for, and the ones their placement shows now ("WxH:layout"). */
    let built = "", shown = "";
    /** The exact placements of the last build (by strip), to put back when a resize returns to the built size. */
    let exact: [LensEdge, number, number, number, number][] = [];
    const sizeKey = (W: number, H: number) => `${W}x${H}:${layout()}`;
    const place = (img: SVGFEImageElement, x: number, y: number, w: number, h: number) => {
      img.setAttribute("x", String(x)); img.setAttribute("y", String(y));
      img.setAttribute("width", String(w)); img.setAttribute("height", String(h));
    };
    /** The slices over the strips' boxes at the screen's size now: exact at the built size, stretched at any other. */
    const fit = () => {
      const { w: W, h: H } = screenSize(), key = sizeKey(W, H);
      if (key === shown) return;
      shown = key;
      if (key === built) { exact.forEach(([e, ...at]) => place(imgOf(e), ...at)); return; }
      lensStrips(W, H, depth, layout()).forEach((s) => place(imgOf(s.edge), 0, 0, s.w, s.h));
    };
    const build = () => {
      if (off) return;
      const { w: W, h: H } = screenSize(), key = sizeKey(W, H);
      if (key === built) { fit(); return; } // (a resize that came back to the built size: nothing to rebuild)
      // (exactly half: on an odd screen the map runs a pixel past its edge rather than scale by some 0.5003, which would
      // put the slices at fractional places and sizes that the filter rounds, each strip a little differently)
      const w = Math.max(1, Math.ceil(W / 2)), h = Math.max(1, Math.ceil(H / 2));
      const band = lensBand(W, H), D = lensDepth(band);
      const urls: string[] = [];
      const at: [LensEdge, number, number, number, number][] = [];
      try {
        const x = c.getContext("2d");
        if (!x) return;
        const full = new ImageData(lensMap(w, h, band * 0.5) as Uint8ClampedArray<ArrayBuffer>, w, h);
        for (const s of lensStrips(W, H, D, layout())) {
          // (the slice: the map's pixels under the strip, rounded outward; placed in the strip's own space)
          const sx = Math.floor(s.x / 2), sy = Math.floor(s.y / 2);
          const sw = Math.max(1, Math.min(w, Math.ceil((s.x + s.w) / 2)) - sx), sh = Math.max(1, Math.min(h, Math.ceil((s.y + s.h) / 2)) - sy);
          c.width = sw; c.height = sh;
          x.putImageData(full, -sx, -sy, sx, sy, sw, sh);
          urls.push(c.toDataURL("image/png"));
          at.push([s.edge, 2 * sx - s.x, 2 * sy - s.y, 2 * sw, 2 * sh]);
        }
      } catch {
        return; // (no 2D canvas: no map, so no lens)
      }
      depth = D;
      // (clamped as lensStrips clamps it: on a very short screen the CSS strips and the slices agree)
      box.style.setProperty("--lens-d", `${Math.min(D, W / 2, H / 2)}px`);
      // (the strips of this layout only: the others are hidden, and get theirs when the layout turns to them)
      at.forEach(([e, ...p], i) => { imgOf(e).setAttribute("href", urls[i]); place(imgOf(e), ...p); });
      exact = at;
      built = shown = key;
      lensReady.current = true;
    };
    /** The first build: once painted. */
    const ensure = () => {
      if (!off && painted && !built) build();
    };
    const onResize = () => {
      if (built) fit();
      clearTimeout(timer);
      timer = window.setTimeout(() => (built ? build() : ensure()), 150);
    };
    /** A change of layout: the slices for the new one now (built once already: the first build waits for the paint). */
    let lastLayout = layout();
    const onMode = () => {
      if (layout() === lastLayout) return;
      lastLayout = layout();
      if (built) build();
    };
    const modeObs = sec && typeof MutationObserver === "function" ? new MutationObserver(onMode) : null;
    if (sec) modeObs?.observe(sec, { attributes: true, attributeFilter: ["data-mode"] });
    void afterPaint().then(() => { painted = true; ensure(); });
    window.addEventListener("resize", onResize);
    return () => {
      off = true;
      clearTimeout(timer);
      modeObs?.disconnect();
      window.removeEventListener("resize", onResize);
      probe.remove();
      lensReady.current = false;
    };
  }, [lensOn, gone]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    // (a canvas whose context the light has given up, dispose losing it, carries `data-spent`: on the element itself, so a
    // module reloaded by Fast Refresh still sees it)
    if (canvas.dataset.spent) {
      // (the effect ran again on a canvas whose context it already let go: Fast Refresh. A fresh one, next render.)
      queueMicrotask(() => setGen((n) => n + 1));
      return;
    }
    const sec = canvas.closest<HTMLElement>(".ab");
    const pin = canvas.parentElement;
    const tr = sec?.querySelector<HTMLElement>(".ab-track") ?? null;
    const clip = tr?.parentElement ?? null;
    const mood = pin?.querySelector<HTMLElement>(".ab-mood") ?? null;
    const q1 = tr?.querySelector<HTMLElement>("[data-pendant='quote1']") ?? null;
    const q2 = tr?.querySelector<HTMLElement>("[data-pendant='quote2']") ?? null;
    const slot = tr?.querySelector<HTMLElement>("[data-pendant='glass']") ?? null;
    if (!sec || !tr || !clip || !q1 || !q2 || !slot) return;

    const reducedQ = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = reducedQ.matches;

    let off = false, loading = false, raf = 0;
    /** Diagnostics (TestimonialsHook.gpuMs): read once, only with ?pendant-debug, as the pendant does. */
    const debug = new URLSearchParams(window.location.search).has("pendant-debug");
    let gpuMs: NonNullable<TestimonialsHook["gpuMs"]> | null = null;
    const perfFrames = new Map<number, { q: number; ownBall: boolean; lens: boolean }>();
    let frameNo = 0;
    /** The frame and the ball handed to the light, rewritten each frame (no allocation per frame). */
    const lightBall: LightBall = { x: 0, y: 0, r: 0, a: 1 };
    const frame: LightFrame = { q: 0, t: 0, pulse: -1, pulseFrom: "right", ball: null };
    let light: TestimonialsLight | null = null;
    /** Under reduced motion the light holds still (t 0, no wave): a frame is drawn only when what it shows changed (q, the
     *  ball's place, size and opacity, the canvas's size, the wave's edge), else the last one stays on screen. As numbers,
     *  no object per frame; `drawnStill` false forces the next draw (a fresh canvas, motion turned back on). */
    let drawnStill = false, dQ = 0, dBx = 0, dBy = 0, dBr = 0, dBa = 0, dW = 0, dH = 0, dDpr = 0, dStack = false;
    let arrival: Arrival = { at: null, on: false, armed: true };
    let moodQ = "";
    let shown = false;
    const t0 = performance.now();
    /** What the pendant's ball is told each frame (about-glass.ts setGlassLight). */
    const toPendant: GlassLight = { q: 0, t: 0, pulse: -1 };
    /** The ball's handoff to the pendant. The pendant claims the glass once its scene is ready, but its canvas then fades in
     *  (about.css: `.ab-pendant` opacity, 0.6 s ease). Until that fade is done the light keeps its own ball at 1 − the
     *  canvas's opacity, read each frame, so the two balls, centred on one slot, cross-fade at whatever pace the canvas
     *  shows. `ballA`: the opacity drawn last frame; `handing`: a handoff under way ("on") or finished ("done"). */
    let ballA = 0;
    let handing: "on" | "done" | null = null;
    /** The owner seen last frame: any change (a release, a claim, both while the slot was far and no frame asked) starts the
     *  handoff afresh, so a stale "done" from an earlier claim can't hide the ball the next time. */
    let lastOwner: GlassOwner = glassOwner();
    const ballOpacity = () => {
      if (glassOwner() === "testimonials") { handing = null; return 1; }
      if (handing === null) {
        if (ballA <= 0) { handing = "done"; return 0; } // (the pendant had it before the light drew one: nothing to hand over)
        handing = "on";
      }
      if (handing === "done") return 0;
      const pc = pin?.querySelector<HTMLElement>(".ab-pendant");
      const op = pc && !pc.hidden ? parseFloat(getComputedStyle(pc).opacity) : 1;
      const a = 1 - Math.min(1, Math.max(0, Number.isFinite(op) ? op : 1));
      if (a <= 0) handing = "done";
      return a;
    };

    const setMood = (q: number) => {
      const s = q > 0 ? q.toFixed(3) : "";
      if (s === moodQ || !mood) return;
      moodQ = s;
      if (s) mood.style.setProperty("--q", s); else mood.style.removeProperty("--q");
      // (about.css: its own compositor layer only while it shows)
      if (s) { if (!("lit" in mood.dataset)) mood.dataset.lit = ""; } else delete mood.dataset.lit;
    };
    const show = (on: boolean) => {
      if (on === shown) return;
      shown = on;
      if (on) canvas.dataset.on = ""; else delete canvas.dataset.on;
    };
    const publish = (h: TestimonialsHook) => { window.__testimonials = Object.freeze(gpuMs ? { ...h, gpuMs } : h); };
    /** The stack's glass slot is open while the light is there to draw the ball (its own while nobody claims it). */
    const slotShown = (on: boolean) => showGlassSlot(sec, "testimonials", on);
    /** Stacked, the screen as the light covers it: its canvas's own box (fixed, 100lvh: the large viewport), read once and
     *  again only after a real resize or a change of layout. A phone's toolbar showing or hiding (viewport.ts: a height-only
     *  change under 150 px on a touch screen) keeps it, so neither the drawing buffer nor q jumps with the toolbar. */
    let stackBox: { w: number; h: number } | null = null;
    let lastWin = { w: window.innerWidth, h: window.innerHeight };
    const coarseQ = window.matchMedia("(pointer: coarse)");
    const screenBox = () => (stackBox ??= { w: canvas.clientWidth || window.innerWidth, h: canvas.clientHeight || window.innerHeight });
    /** The glass edges, each frame the light runs: shown only while q > 0.01 (and its map is in place), the filter's scale
     *  touched only when it moves by 0.1 or more. Returns the scale as set while it shows, else 0. */
    let lensShown = false, lensSet = -1, lensEl: HTMLDivElement | null = null;
    let disps: SVGFEDisplacementMapElement[] = [];
    const lensFrame = (q: number, t: number): number => {
      const el = lensRef.current;
      if (el !== lensEl) {
        lensEl = el; lensShown = false; lensSet = -1;
        disps = Array.from(defsRef.current?.querySelectorAll<SVGFEDisplacementMapElement>("feDisplacementMap") ?? []);
      }
      if (!el || disps.length === 0) return 0;
      const on = q > 0.01 && lensReady.current;
      if (on) {
        const s = lensScale(q, t, reduced);
        if (lensSet < 0 || Math.abs(s - lensSet) >= 0.1) {
          const v = s.toFixed(1);
          for (const d of disps) d.setAttribute("scale", v);
          lensSet = Number(v);
        }
      }
      if (on !== lensShown) {
        lensShown = on;
        if (on) el.dataset.on = ""; else delete el.dataset.on;
      }
      return on ? lensSet : 0;
    };

    /** Where the quotes and the slot are this frame (screen px): `size` the axis q is scrubbed along (the screen's width on
     *  the track, the large viewport's height stacked), `c0` Yoav's centre along it. Null in any other layout. */
    /** This frame's places, rewritten in place each frame (no object per frame; read within the frame only). */
    const placed = { size: 0, c0: 0, stack: false, q: 0, slot: { x: 0, y: 0, w: 0 }, near: false };
    const measure = (): typeof placed | null => {
      if (sec.dataset.mode === "stack") return measureStack();
      if (sec.dataset.mode !== "track") return null;
      return measureTrack();
    };
    /** On the track: rects are read relative to the track (its transform cancels out) and placed at the travel the page's
     *  scroll gives (about-track.tsx's own formula), so the light never lags the track by the frame its scroll handler hasn't
     *  run yet. */
    const measureTrack = () => {
      const vw = clip.clientWidth || window.innerWidth;
      const x = trackX(trackProgress(window.scrollY, sec.offsetTop, sec.offsetHeight, window.innerHeight), tr.scrollWidth, vw);
      const trR = tr.getBoundingClientRect(), left = clip.getBoundingClientRect().left + x;
      const centre = (r: DOMRect) => left + (r.left - trR.left) + r.width / 2;
      const s = slot.getBoundingClientRect();
      const c0 = centre(q1.getBoundingClientRect()), c1 = centre(q2.getBoundingClientRect()), sx = centre(s);
      placed.size = vw; placed.c0 = c0; placed.stack = false;
      placed.q = vw > 0 ? testimonialsQ(c0, c1, vw) : 0;
      placed.slot.x = sx; placed.slot.y = s.top + s.height / 2; placed.slot.w = s.width;
      placed.near = s.width > 0 && sx > -s.width && sx < vw + s.width;
      return placed;
    };
    /** Stacked: the page scrolls the column itself, so each rect is where it is on screen (its rise-in taken out); the
     *  canvas is fixed at the screen's top, so screen px are the canvas's. */
    const measureStack = () => {
      const vh = screenBox().h;
      const middle = (el: HTMLElement, r: DOMRect) => r.top - rising(el) + r.height / 2;
      const sr = slot.getBoundingClientRect();
      const a = middle(q1, q1.getBoundingClientRect()), b = middle(q2, q2.getBoundingClientRect()), sy = middle(slot, sr);
      placed.size = vh; placed.c0 = a; placed.stack = true;
      placed.q = vh > 0 ? testimonialsQ(a, b, vh) : 0;
      placed.slot.x = sr.left + sr.width / 2; placed.slot.y = sy; placed.slot.w = sr.width;
      placed.near = sr.width > 0 && sy > -sr.width && sy < vh + sr.width;
      return placed;
    };

    const tick = (now: number) => {
      raf = 0;
      if (off || !light) return;
      const owner = glassOwner();
      if (owner !== lastOwner) { lastOwner = owner; handing = null; }
      const m = measure();
      const q = m ? m.q : 0;
      if (m) arrival = stepArrival(arrival, q, m.c0, m.size, now, reduced);
      setMood(q);
      const drawing = !!m && (q > 0 || m.near);
      const pulse = reduced ? -1 : pulsePhase(arrival, now);
      const a = m && drawing && m.near ? ballOpacity() : 0;
      ballA = a;
      let ball: LightBall | null = null;
      if (m && a > 0) { lightBall.x = m.slot.x; lightBall.y = m.slot.y; lightBall.r = 0.44 * m.slot.w; lightBall.a = a; ball = lightBall; }
      const t = reduced ? 0 : (now - t0) / 1000;
      const lens = lensFrame(drawing ? q : 0, t);
      publish({ q, pulse, drawing, ownBall: ball !== null, lens });
      if (!drawing) { setGlassLight(null); show(false); drawnStill = false; return; } // (shown again: drawn afresh)
      // (the pendant's ball reads this on its own frame: the same q, the same clock, so its rim shows the edges as drawn here;
      // one object, rewritten each frame: the store copies it)
      toPendant.q = q; toPendant.t = t; toPendant.pulse = pulse;
      setGlassLight(q > 0 ? toPendant : null);
      try {
        // (its own box: fixed at inset 0, it leaves out a classic scrollbar, as the quotes' and the pendant's client sizes do;
        // stacked, the box as last measured, the toolbar left out)
        // (as two numbers: no object per frame; the stacked box is made only when it is measured afresh)
        let bw: number, bh: number;
        if (m.stack) { const sb = screenBox(); bw = sb.w; bh = sb.h; } else { bw = canvas.clientWidth || window.innerWidth; bh = canvas.clientHeight || window.innerHeight; }
        const dpr = window.devicePixelRatio || 1;
        if (reduced) {
          const bx = ball ? ball.x : -1, by = ball ? ball.y : -1, br = ball ? ball.r : 0, ba = ball ? a : 0;
          const same = drawnStill && q === dQ && bx === dBx && by === dBy && br === dBr && ba === dBa && bw === dW && bh === dH && dpr === dDpr && m.stack === dStack;
          if (same && handing !== "on") { show(true); raf = requestAnimationFrame(tick); return; } // (nothing new to draw)
          drawnStill = true; dQ = q; dBx = bx; dBy = by; dBr = br; dBa = ba; dW = bw; dH = bh; dDpr = dpr; dStack = m.stack;
        } else drawnStill = false;
        light.resize(bw, bh, dpr);
        frame.q = q; frame.t = t; frame.pulse = pulse; frame.pulseFrom = m.stack ? "bottom" : "right"; frame.ball = ball;
        const tag = ++frameNo;
        if (gpuMs) perfFrames.set(tag, { q, ownBall: ball !== null, lens: lens > 0 });
        if (gpuMs) light.draw(frame, tag); else light.draw(frame);
        if (gpuMs) {
          // (a query reads back a few frames late: each time goes to the frame it timed)
          for (const g of light.takeGpuTimes()) {
            const at = perfFrames.get(g.tag);
            if (at && gpuMs.length < 100_000) gpuMs.push({ ms: g.ms, ...at });
          }
          for (const k of perfFrames.keys()) if (k < tag - 64) perfFrames.delete(k); else break;
        }
      } catch {
        fail();
        return;
      }
      show(true);
      raf = requestAnimationFrame(tick);
    };
    /** One look at the scroll: the loop carries on from there only while there's something to draw. */
    const wake = () => { if (!raf && !off && light) raf = requestAnimationFrame(tick); };

    const onReduced = () => { reduced = reducedQ.matches; wake(); };
    /** A lost context: the light stops and its canvas hides (the quotes read as before), and it waits for the browser to give
     *  the GPU back; restored, a fresh canvas mounts (the `gen` key) and the light loads on it, as the pendant does. */
    const onLost = (e: Event) => {
      e.preventDefault(); // (lets the browser restore it)
      if (off) return;
      teardown(false);
      publish({ q: 0, pulse: -1, drawing: false, ownBall: false, lens: 0 });
      canvas.addEventListener("webglcontextrestored", onRestored);
    };
    const onRestored = () => { canvas.removeEventListener("webglcontextrestored", onRestored); setGen((n) => n + 1); };
    /** A change of layout (about-track.tsx sets data-mode, on every resize: only a new value counts): the stack's box is
     *  measured afresh. */
    let lastMode = sec.dataset.mode;
    const onMode = () => {
      if (sec.dataset.mode === lastMode) return;
      lastMode = sec.dataset.mode;
      stackBox = null;
      wake();
    };
    /** A resize: stacked on a touch screen, the toolbar (viewport.ts) keeps the box; anything else measures it again. */
    const onResize = () => {
      const now = { w: window.innerWidth, h: window.innerHeight };
      if (!(sec.dataset.mode === "stack" && resizeKind(lastWin, now, coarseQ.matches) === "toolbar")) { lastWin = now; stackBox = null; }
      wake();
    };
    const modeObs = typeof MutationObserver === "function" ? new MutationObserver(onMode) : null;
    modeObs?.observe(sec, { attributes: true, attributeFilter: ["data-mode"] });
    reducedQ.addEventListener?.("change", onReduced);
    window.addEventListener("scroll", wake, { passive: true });
    window.addEventListener("resize", onResize);
    canvas.addEventListener("webglcontextlost", onLost);

    let torn = false;
    /** `dispose`: free the light (its forced loss: the canvas can't get a context again). Not after a context the browser
     *  lost: that one may come back (onRestored). */
    const teardown = (dispose = true) => {
      if (torn) return;
      torn = true;
      off = true;
      cancelAnimationFrame(raf);
      raf = 0;
      modeObs?.disconnect();
      reducedQ.removeEventListener?.("change", onReduced);
      window.removeEventListener("scroll", wake);
      window.removeEventListener("resize", onResize);
      // (before the dispose: its forced loss fires a context-lost event this canvas must not answer)
      canvas.removeEventListener("webglcontextlost", onLost);
      setMood(0);
      lensFrame(0, 0);
      setGlassLight(null);
      slotShown(false);
      show(false);
      if (light && dispose) {
        canvas.dataset.spent = "1";
        try { light.dispose(); } catch { /* the GPU is already gone */ }
      }
      light = null;
    };
    /** No WebGL, a shader that won't build, a lost GPU: no canvas, the quotes as they were, nothing in the console. */
    const fail = () => {
      if (off) return;
      teardown();
      publish({ q: 0, pulse: -1, drawing: false, ownBall: false, lens: 0 });
      setGone(true);
    };

    /** Loads the light once About's text has painted (on the track or stacked). */
    const ensure = () => {
      if (light || loading || off) return;
      loading = true;
      void (async () => {
        try {
          await afterPaint();
          if (off) return;
          const { TestimonialsLight: Light } = await import("@/three/edge-light/testimonials-light");
          if (off) return;
          const made = Light.create(canvas);
          if (!made) { fail(); return; }
          if (off) { made.dispose(); return; }
          light = made;
          if (debug && window.__pendantPerf) gpuMs = made.enableGpuTiming() ? [] : null;
          slotShown(true);
          publish({ q: 0, pulse: -1, drawing: false, ownBall: false, lens: 0 });
          wake();
        } catch {
          fail();
        } finally {
          loading = false;
        }
      })();
    };
    ensure();

    return () => {
      canvas.removeEventListener("webglcontextrestored", onRestored);
      teardown();
      if (window.__testimonials) delete window.__testimonials;
    };
  }, [gen]);

  if (gone) return null;
  return (
    <>
      {/* the glass edges (Chromium): four fixed strips at the screen's edges whose backdrop (the track and the pendant under
          them, not the light above, nor the bar and the resume after them) is bent by the SVG filters below; shown while
          q > 0.01 */}
      {lensOn && (
        <>
          <div ref={lensRef} className="ab-lens" aria-hidden>
            {LENS_EDGES.map((e) => <div key={e} className="ab-lens-strip" data-edge={e} />)}
          </div>
          {/* (outside the toggled container: a filter in a display: none subtree stops rendering) */}
          <svg ref={defsRef} className="ab-lens-defs" width="0" height="0" aria-hidden>
            {/* (objectBoundingBox x0 y0 w1 h1: each filter's region is its strip's own box; userSpaceOnUse did nothing) */}
            {LENS_EDGES.map((e) => (
              <filter key={e} id={`ab-edge-lens-${e}`} x="0" y="0" width="1" height="1" filterUnits="objectBoundingBox" colorInterpolationFilters="sRGB">
                <feImage result="map" x="0" y="0" preserveAspectRatio="none" />
                <feDisplacementMap in="SourceGraphic" in2="map" xChannelSelector="R" yChannelSelector="G" />
              </filter>
            ))}
          </svg>
        </>
      )}
      <canvas key={gen} ref={ref} className="ab-light" aria-hidden style={{ pointerEvents: "none" }} />
    </>
  );
}
