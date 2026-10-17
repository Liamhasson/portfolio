// src/app/about/about-testimonials.tsx
"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { glassOwner, setGlassLight, type GlassLight, type GlassOwner } from "@/lib/about-glass";
import type { TestimonialsLight } from "@/three/edge-light/testimonials-light";
import { lensBand, lensMap, lensScale, lensSupported } from "./edge-lens";
import { pulsePhase, stepArrival, testimonialsQ, type Arrival } from "./testimonials-q";
import { trackProgress, trackX } from "./track";

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
}

declare global {
  interface Window {
    __testimonials?: Readonly<TestimonialsHook>;
  }
}

/** Canvases whose context the light has given up (dispose loses it): a re-run of the effect on one (Fast Refresh) mounts a
 *  fresh canvas instead, as the pendant does. */
const spent = new WeakSet<HTMLCanvasElement>();

/** The lens's feature check never changes in a visit: nothing to subscribe to. */
const noSubscribe = () => () => {};
const lensClient = () => typeof navigator !== "undefined" && lensSupported(navigator);
const lensServer = () => false;

/** The screen as the lens covers it (fixed at inset 0: a classic scrollbar left out). */
const screenSize = () => ({
  w: document.documentElement.clientWidth || window.innerWidth,
  h: document.documentElement.clientHeight || window.innerHeight,
});

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
 * Track mode only for now: the stack comes in Task 5.
 */
export function AboutTestimonials() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [gone, setGone] = useState(false);
  /** One canvas per light: after dispose's forced loss a canvas can never be given a context again. */
  const [gen, setGen] = useState(0);
  /** The glass edges (edge-lens.ts): Chromium only; elsewhere no lens element at all. */
  const lensOn = useSyncExternalStore(noSubscribe, lensClient, lensServer);
  const lensRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<SVGFEImageElement>(null);
  const dispRef = useRef<SVGFEDisplacementMapElement>(null);
  /** The lens's map is in place: until it is the lens never shows (an empty feImage is transparent, which would shift the
   *  whole screen by half the scale). */
  const lensReady = useRef(false);

  // The lens's map: built at half the screen's resolution as a PNG once the lens is there, and again 150 ms after a resize
  // settles. Meanwhile the old map is stretched over the new screen at once (the feImage sized to it), so no part of the
  // screen is ever left outside the map.
  useEffect(() => {
    if (!lensOn) return;
    const img = mapRef.current;
    if (!img) return;
    const c = document.createElement("canvas");
    let timer = 0;
    const fit = () => {
      const { w, h } = screenSize();
      img.setAttribute("width", String(w));
      img.setAttribute("height", String(h));
      return { w, h };
    };
    const build = () => {
      const { w: W, h: H } = screenSize();
      const w = Math.max(1, Math.round(W * 0.5)), h = Math.max(1, Math.round(H * 0.5));
      try {
        c.width = w; c.height = h;
        const x = c.getContext("2d");
        if (!x) return;
        x.putImageData(new ImageData(lensMap(w, h, lensBand(W, H) * 0.5) as Uint8ClampedArray<ArrayBuffer>, w, h), 0, 0);
        img.setAttribute("href", c.toDataURL("image/png"));
      } catch {
        return; // (no 2D canvas: no map, so no lens)
      }
      fit();
      lensReady.current = true;
    };
    const onResize = () => {
      if (lensReady.current) fit();
      clearTimeout(timer);
      timer = window.setTimeout(build, 150);
    };
    build();
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", onResize);
      lensReady.current = false;
    };
  }, [lensOn]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (spent.has(canvas)) {
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
    let light: TestimonialsLight | null = null;
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
    };
    const show = (on: boolean) => {
      if (on === shown) return;
      shown = on;
      if (on) canvas.dataset.on = ""; else delete canvas.dataset.on;
    };
    const publish = (h: TestimonialsHook) => { window.__testimonials = Object.freeze(h); };
    /** The glass edges, each frame the light runs: shown only while q > 0.01 (and its map is in place), the filter's scale
     *  touched only when it moves by 0.1 or more. Returns the scale as set while it shows, else 0. */
    let lensShown = false, lensSet = -1, lensEl: HTMLDivElement | null = null;
    const lensFrame = (q: number, t: number): number => {
      const el = lensRef.current, disp = dispRef.current;
      if (el !== lensEl) { lensEl = el; lensShown = false; lensSet = -1; }
      if (!el || !disp) return 0;
      const on = q > 0.01 && lensReady.current;
      if (on) {
        const s = lensScale(q, t, reduced);
        if (lensSet < 0 || Math.abs(s - lensSet) >= 0.1) {
          const v = s.toFixed(1);
          disp.setAttribute("scale", v);
          lensSet = Number(v);
        }
      }
      if (on !== lensShown) {
        lensShown = on;
        if (on) el.dataset.on = ""; else delete el.dataset.on;
      }
      return on ? lensSet : 0;
    };

    /** Where the quotes and the slot are this frame (screen px), or null off the track. Rects are read relative to the
     *  track (its transform cancels out) and placed at the travel the page's scroll gives (about-track.tsx's own formula),
     *  so the light never lags the track by the frame its scroll handler hasn't run yet. */
    const measure = () => {
      if (sec.dataset.mode !== "track") return null;
      const vw = clip.clientWidth || window.innerWidth;
      const x = trackX(trackProgress(window.scrollY, sec.offsetTop, sec.offsetHeight, window.innerHeight), tr.scrollWidth, vw);
      const trR = tr.getBoundingClientRect(), left = clip.getBoundingClientRect().left + x;
      const centre = (r: DOMRect) => left + (r.left - trR.left) + r.width / 2;
      const s = slot.getBoundingClientRect();
      const c0 = centre(q1.getBoundingClientRect()), c1 = centre(q2.getBoundingClientRect()), sx = centre(s);
      return {
        vw, c0,
        q: vw > 0 ? testimonialsQ(c0, c1, vw) : 0,
        slot: { x: sx, y: s.top + s.height / 2, w: s.width },
        near: s.width > 0 && sx > -s.width && sx < vw + s.width,
      };
    };

    const tick = (now: number) => {
      raf = 0;
      if (off || !light) return;
      const owner = glassOwner();
      if (owner !== lastOwner) { lastOwner = owner; handing = null; }
      const m = measure();
      const q = m ? m.q : 0;
      if (m) arrival = stepArrival(arrival, q, m.c0, m.vw, now, reduced);
      setMood(q);
      const drawing = !!m && (q > 0 || m.near);
      const pulse = reduced ? -1 : pulsePhase(arrival, now);
      const a = m && drawing && m.near ? ballOpacity() : 0;
      ballA = a;
      const ball = m && a > 0 ? { x: m.slot.x, y: m.slot.y, r: 0.44 * m.slot.w, a } : null;
      const t = reduced ? 0 : (now - t0) / 1000;
      const lens = lensFrame(drawing ? q : 0, t);
      publish({ q, pulse, drawing, ownBall: ball !== null, lens });
      if (!drawing) { setGlassLight(null); show(false); return; }
      // (the pendant's ball reads this on its own frame: the same q, the same clock, so its rim shows the edges as drawn here;
      // one object, rewritten each frame: the store copies it)
      toPendant.q = q; toPendant.t = t; toPendant.pulse = pulse;
      setGlassLight(q > 0 ? toPendant : null);
      try {
        // (its own box: fixed at inset 0, it leaves out a classic scrollbar, as the quotes' and the pendant's client sizes do)
        light.resize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight, window.devicePixelRatio || 1);
        light.draw({ q, t, pulse, pulseFrom: "right", ball });
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
    const onLost = (e: Event) => { e.preventDefault(); fail(); };
    /** A change of layout (about-track.tsx sets data-mode): the light loads on the track, and stops in the stack. */
    const onMode = () => { ensure(); wake(); };
    const modeObs = typeof MutationObserver === "function" ? new MutationObserver(onMode) : null;
    modeObs?.observe(sec, { attributes: true, attributeFilter: ["data-mode"] });
    reducedQ.addEventListener?.("change", onReduced);
    window.addEventListener("scroll", wake, { passive: true });
    window.addEventListener("resize", wake);
    canvas.addEventListener("webglcontextlost", onLost);

    let torn = false;
    const teardown = () => {
      if (torn) return;
      torn = true;
      off = true;
      cancelAnimationFrame(raf);
      raf = 0;
      modeObs?.disconnect();
      reducedQ.removeEventListener?.("change", onReduced);
      window.removeEventListener("scroll", wake);
      window.removeEventListener("resize", wake);
      // (before the dispose: its forced loss fires a context-lost event this canvas must not answer)
      canvas.removeEventListener("webglcontextlost", onLost);
      setMood(0);
      lensFrame(0, 0);
      setGlassLight(null);
      if (light) spent.add(canvas);
      try { light?.dispose(); } catch { /* the GPU is already gone */ }
      light = null;
    };
    /** No WebGL, a shader that won't build, a lost GPU: no canvas, the quotes as they were, nothing in the console. */
    const fail = () => {
      if (off) return;
      teardown();
      publish({ q: 0, pulse: -1, drawing: false, ownBall: false, lens: 0 });
      setGone(true);
    };

    /** Loads the light once About's text has painted, on the track (the stack's light is Task 5). */
    const ensure = () => {
      if (light || loading || off || sec.dataset.mode !== "track") return;
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
      teardown();
      if (window.__testimonials) delete window.__testimonials;
    };
  }, [gen]);

  if (gone) return null;
  return (
    <>
      {/* the glass edges (Chromium): a fixed layer whose backdrop (the track and the pendant under it, not the light above,
          nor the bar and the resume after it) is bent by the SVG filter below; shown while q > 0.01 */}
      {lensOn && (
        <>
          <div ref={lensRef} className="ab-lens" aria-hidden />
          <svg className="ab-lens-defs" width="0" height="0" aria-hidden>
            {/* (objectBoundingBox x0 y0 w1 h1: the region is the lens's own box; userSpaceOnUse did nothing) */}
            <filter id="ab-edge-lens" x="0" y="0" width="1" height="1" filterUnits="objectBoundingBox" colorInterpolationFilters="sRGB">
              <feImage ref={mapRef} result="map" x="0" y="0" preserveAspectRatio="none" />
              <feDisplacementMap ref={dispRef} in="SourceGraphic" in2="map" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </svg>
        </>
      )}
      <canvas key={gen} ref={ref} className="ab-light" aria-hidden style={{ pointerEvents: "none" }} />
    </>
  );
}
