// src/app/about/about-testimonials.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { glassOwner } from "@/lib/about-glass";
import type { TestimonialsLight } from "@/three/edge-light/testimonials-light";
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
}

declare global {
  interface Window {
    __testimonials?: Readonly<TestimonialsHook>;
  }
}

/** Canvases whose context the light has given up (dispose loses it): a re-run of the effect on one (Fast Refresh) mounts a
 *  fresh canvas instead, as the pendant does. */
const spent = new WeakSet<HTMLCanvasElement>();

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
 * within one slot width of the screen, and anything wrong (no WebGL, a lost context) leaves the quotes as they were.
 * Track mode only for now: the stack comes in Task 5.
 */
export function AboutTestimonials() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [gone, setGone] = useState(false);
  /** One canvas per light: after dispose's forced loss a canvas can never be given a context again. */
  const [gen, setGen] = useState(0);

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
    /** The ball's handoff to the pendant. The pendant claims the glass once its scene is ready, but its canvas then fades in
     *  (about.css: `.ab-pendant` opacity, 0.6 s ease). Until that fade is done the light keeps its own ball at 1 − the
     *  canvas's opacity, read each frame, so the two balls, centred on one slot, cross-fade at whatever pace the canvas
     *  shows. `ballA`: the opacity drawn last frame; `handing`: a handoff under way ("on") or finished ("done"). */
    let ballA = 0;
    let handing: "on" | "done" | null = null;
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
      const m = measure();
      const q = m ? m.q : 0;
      if (m) arrival = stepArrival(arrival, q, m.c0, m.vw, now, reduced);
      setMood(q);
      const drawing = !!m && (q > 0 || m.near);
      const pulse = reduced ? -1 : pulsePhase(arrival, now);
      const a = m && drawing && m.near ? ballOpacity() : 0;
      ballA = a;
      const ball = m && a > 0 ? { x: m.slot.x, y: m.slot.y, r: 0.44 * m.slot.w, a } : null;
      publish({ q, pulse, drawing, ownBall: ball !== null });
      if (!drawing) { show(false); return; }
      try {
        // (its own box: fixed at inset 0, it leaves out a classic scrollbar, as the quotes' and the pendant's client sizes do)
        light.resize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight, window.devicePixelRatio || 1);
        light.draw({ q, t: reduced ? 0 : (now - t0) / 1000, pulse, pulseFrom: "right", ball });
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
      if (light) spent.add(canvas);
      try { light?.dispose(); } catch { /* the GPU is already gone */ }
      light = null;
    };
    /** No WebGL, a shader that won't build, a lost GPU: no canvas, the quotes as they were, nothing in the console. */
    const fail = () => {
      if (off) return;
      teardown();
      publish({ q: 0, pulse: -1, drawing: false, ownBall: false });
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
          publish({ q: 0, pulse: -1, drawing: false, ownBall: false });
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
  return <canvas key={gen} ref={ref} className="ab-light" aria-hidden style={{ pointerEvents: "none" }} />;
}
