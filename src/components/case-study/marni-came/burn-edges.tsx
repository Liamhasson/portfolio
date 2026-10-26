"use client";
import { useEffect, useRef } from "react";
import { TRACKS, type AudioController, type TrackId } from "@/lib/marni-came/audio";
import { MC_ASSETS } from "@/lib/marni-came/assets";
import { brightness, decodeEnergy, edgeTransform, envelope, follow, reach, sample, step, type Burn, type Energy } from "@/lib/marni-came/burn-edges";

/** The burn along the screen's edges while the music plays (Liam, 2026-10-26; the rules are in lib/marni-came/burn-edges.ts).
 *  A canvas fixed behind the whole page (z-index -1: the study's sections have no background of their own, so it shows
 *  only where nothing sits on it). Nothing loads until the sound is first turned on; off, it fades out and stops. */
const SW = 512, SH = 160, COLS = 2;
const SCALE = 0.5;   // (the burn is soft: half resolution is enough and costs a quarter)
const FADE = 0.6;    // seconds for the whole burn to come in when the sound starts, and to go when it stops

export function BurnEdges({ ctrl }: { ctrl: AudioController }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let sheet: HTMLImageElement | null = null, sheetAsked = false;
    const energy = new Map<TrackId, Energy | null>();   // (null while loading)
    let raf = 0, last = 0, lastNew = -1, level = 0, master = 0;
    let burns: Burn[] = [];

    const size = () => { cv.width = Math.max(1, Math.round(window.innerWidth * SCALE)); cv.height = Math.max(1, Math.round(window.innerHeight * SCALE)); };
    size();
    window.addEventListener("resize", size);

    const load = (id: TrackId) => {
      if (energy.has(id)) return;
      energy.set(id, null);
      fetch(TRACKS[id].energy).then((r) => r.json()).then((d) => energy.set(id, decodeEnergy(d))).catch(() => energy.delete(id));
    };
    const loadSheet = () => {
      if (sheetAsked) return;
      sheetAsked = true;
      const img = new Image();
      img.onload = () => { sheet = img; };
      img.onerror = () => { sheetAsked = false; };
      img.src = MC_ASSETS.burnEdges;
    };

    const draw = (now: number) => {
      const W = cv.width, H = cv.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (!sheet || master <= 0) return;
      ctx.globalCompositeOperation = "lighter";
      for (const b of burns) {
        const alpha = envelope(b, now) * brightness(level) * master;
        if (alpha <= 0) continue;
        const depth = reach(b.edge, level) * Math.min(W, H);
        const w = b.width * (b.edge === "b" || b.edge === "t" ? W : H);
        const m = edgeTransform(b.edge, b.at, depth, W, H);
        if (b.flip) { m[0] = -m[0]; m[1] = -m[1]; }
        ctx.setTransform(...m);
        // (two shapes per burn, one fading into the other over its life: it changes shape as it burns)
        const k = Math.min(1, Math.max(0, (now - b.born) / b.life));
        for (const [i, a] of [[b.a, alpha * (1 - k)], [b.b, alpha * k]] as const) {
          if (a <= 0.004) continue;
          ctx.globalAlpha = a;
          ctx.drawImage(sheet, (i % COLS) * SW + 2, Math.floor(i / COLS) * SH + 2, SW - 4, SH - 4, -w / 2, 0, w, depth);
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    const frame = (ms: number) => {
      const now = ms / 1000;
      const dt = last ? Math.min(0.1, now - last) : 0;
      last = now;
      const st = ctrl.state(), el = ctrl.element(), e = energy.get(st.track);
      const playing = st.on && !!sheet && !!e && !!el;
      master = playing ? Math.min(1, master + dt / FADE) : Math.max(0, master - dt / FADE);
      const s = playing ? sample(e!, el!.currentTime) : { level: 0, hit: 0 };
      level = follow(level, s.level, dt);
      if (playing) ({ burns, lastNew } = step(burns, now, level, s.hit, lastNew, Math.random));
      draw(now);
      if (st.on || master > 0) raf = window.requestAnimationFrame(frame);
      else { raf = 0; burns = []; lastNew = -1; }
    };

    const wake = () => {
      const st = ctrl.state();
      if (!st.on) return;
      load(st.track);
      loadSheet();
      if (!raf) { last = 0; raf = window.requestAnimationFrame(frame); }
    };
    const off = ctrl.subscribe(wake);
    wake();
    return () => { off(); window.cancelAnimationFrame(raf); window.removeEventListener("resize", size); };
  }, [ctrl]);
  return <canvas ref={ref} className="mc-burn" aria-hidden="true" data-burn-edges="" />;
}
