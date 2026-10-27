"use client";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { TRACKS, type AudioController, type TrackId } from "@/lib/marni-came/audio";
import { burnFill, decodeTrack, flatPath, follow, levelAt, wavePath, wavePoints, type TrackData } from "@/lib/marni-came/audio-viz";

/** The study's one sound control (spec §4.5; Liam, 2026-10-26: a round button like lusion.co's, the rules in
 *  lib/marni-came/audio-viz.ts). Off: a flat line and the word Audio, in one dark pill. On: just the circle, its fill in
 *  the burn colours following the loudness, its line drawing the track's waveform as it plays. The frame loop writes
 *  straight to the circle and the line, so React only renders on a click. Nothing loads until the first click. */
const FLAT = flatPath(17, 14, 24);
const FADE = 0.4;   // seconds for the colour to come in when the music starts, and to go when it stops
// (with reduced motion the line doesn't scroll: a still wave whose height is the loudness)
const STILL = [0, 0.5, -0.9, 0.7, -1, 0.6, -0.8, 0.4, 0].map((y, i, a) => ({ x: i / (a.length - 1), y }));

export function AudioButton({ ctrl }: { ctrl: AudioController }) {
  const on = useSyncExternalStore(ctrl.subscribe, () => ctrl.state().on, () => false);
  const circle = useRef<HTMLSpanElement>(null);
  const line = useRef<SVGPathElement>(null);

  useEffect(() => {
    const c = circle.current, l = line.current;
    if (!c || !l) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const data = new Map<TrackId, TrackData | null>();   // (null while loading)
    let raf = 0, last = 0, level = 0, master = 0;

    const load = (id: TrackId) => {
      if (data.has(id)) return;
      data.set(id, null);
      fetch(TRACKS[id].energy).then((r) => r.json()).then((d) => data.set(id, decodeTrack(d))).catch(() => data.delete(id));
    };

    const frame = (ms: number) => {
      const now = ms / 1000, dt = last ? Math.min(0.1, now - last) : 0;
      last = now;
      const st = ctrl.state(), el = ctrl.element(), d = data.get(st.track);
      const playing = st.on && !!d && !!el;
      master = playing ? Math.min(1, master + dt / FADE) : Math.max(0, master - dt / FADE);
      const t = el?.currentTime ?? 0;
      level = follow(level, playing ? levelAt(d!, t) : 0, dt);
      const [r, g, b] = burnFill(level);
      c.style.backgroundColor = master > 0 ? `rgba(${r},${g},${b},${master.toFixed(3)})` : "";
      if (d && master > 0) {
        const pts = still ? STILL.map((p) => ({ x: p.x, y: p.y * level })) : wavePoints(d, t);
        l.setAttribute("d", wavePath(pts.map((p) => ({ x: p.x, y: p.y * master })), 11, 26, 24, 10));
      } else l.setAttribute("d", FLAT);
      if (st.on || master > 0) raf = window.requestAnimationFrame(frame);
      else raf = 0;
    };

    const wake = () => {
      const st = ctrl.state();
      if (!st.on) return;
      load(st.track);
      if (!raf) { last = 0; raf = window.requestAnimationFrame(frame); }
    };
    const off = ctrl.subscribe(wake);
    wake();
    return () => { off(); window.cancelAnimationFrame(raf); };
  }, [ctrl]);

  return (
    <button type="button" className="mc-audio" aria-label="Audio" aria-pressed={on} data-on={on ? "" : undefined} onClick={() => ctrl.toggle()} data-sound-toggle="">
      <span className="mc-audio-c" ref={circle}>
        <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true"><path ref={line} d={FLAT} /></svg>
      </span>
      <span className="mc-audio-w" aria-hidden="true">Audio</span>
    </button>
  );
}
