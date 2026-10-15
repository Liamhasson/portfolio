"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PIECES, ROWS, ROW_HEIGHT_VW, type Piece } from "./pieces";
import { toTop } from "@/lib/smooth-scroll";
import "./playground.css";

/**
 * The playground (Liam, 2026-10-14/15, layout A approved): every piece on one hand-arranged grid, the strongest largest.
 * A film's silent loop plays on hover (in view, on a phone); a track's waveform comes alive. A click opens it full: the
 * film plays (from YouTube or from here), the track plays with its waveform lighting up as it goes, an image shows whole,
 * with what Liam did. Esc or the close button returns to the grid, the arrows step through. No glow, no italic.
 */
export function Playground() {
  const [open, setOpen] = useState<number | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const show = useCallback((i: number, from?: HTMLElement) => { if (from) opener.current = from; setOpen(i); }, []);
  const close = useCallback(() => { setOpen(null); requestAnimationFrame(() => opener.current?.focus()); }, []);
  // arriving through the drive, the story had the page far down: start at the top
  useEffect(() => { toTop(); }, []);

  return (
    <div className="pg">
      <header className="pg-head">
        <Link href="/#desk" className="pg-back">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden><path d="m15 18-6-6 6-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Back to the desk
        </Link>
        <h1 className="pg-title">Playground</h1>
      </header>
      <div className="pg-grid">
        {ROWS.map((row, r) => (
          <div key={r} className="pg-row" style={{ "--h": `${ROW_HEIGHT_VW[r]}vw` } as React.CSSProperties}>
            {row.map((p) => <Tile key={p.id} piece={p} onOpen={(el) => show(PIECES.indexOf(p), el)} />)}
          </div>
        ))}
      </div>
      {open !== null && (
        <Viewer
          index={open}
          onClose={close}
          onStep={(d) => setOpen((i) => (i === null ? i : (i + d + PIECES.length) % PIECES.length))}
        />
      )}
    </div>
  );
}

function Tile({ piece: p, onOpen }: { piece: Piece; onOpen: (el: HTMLElement) => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [live, setLive] = useState(false);
  // a phone has no hover: the loop plays while the tile is in view
  useEffect(() => {
    const el = ref.current;
    if (!el || !p.loop || !window.matchMedia("(hover: none)").matches) return;
    const io = new IntersectionObserver(([e]) => setLive(e.intersectionRatio > 0.6), { threshold: [0, 0.6, 1] });
    io.observe(el);
    return () => io.disconnect();
  }, [p.loop]);
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (live && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) v.play().catch(() => {});
    else { v.pause(); }
  }, [live]);
  return (
    <button
      ref={ref}
      type="button"
      className="pg-tile"
      data-kind={p.kind}
      data-light={p.light ? "" : undefined}
      data-live={live ? "" : undefined}
      style={{ flexGrow: p.w }}
      onPointerEnter={(e) => { if (e.pointerType === "mouse") setLive(true); }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") setLive(false); }}
      onFocus={() => setLive(true)}
      onBlur={() => setLive(false)}
      onClick={(e) => onOpen(e.currentTarget)}
      aria-label={`${p.title}, ${p.kind.toLowerCase()}. Open`}
    >
      {p.image && (
        // eslint-disable-next-line @next/next/no-img-element -- the grid's stills, sized by their rows
        <img className="pg-img" src={p.image} alt="" loading="lazy" style={p.contain ? { objectFit: "contain" } : undefined} />
      )}
      {p.loop && <video ref={video} className="pg-loop" src={p.loop} muted loop playsInline preload="none" aria-hidden />}
      {p.peaks && <Wave src={p.peaks} live={live} big={!p.image} />}
      {!p.light && <span className="pg-shade" aria-hidden />}
      {(p.loop || p.video || p.youtube) && <span className="pg-play" aria-hidden />}
      <span className="pg-kind">{p.kind}</span>
      <span className="pg-foot">
        <span className="pg-name">{p.title}</span>
        <span className="pg-meta">{p.meta}</span>
      </span>
    </button>
  );
}

/** A track's waveform (its peaks.json): still until hovered, then a slow wave of light runs through it; `played` (0..1)
 *  lights it from the left as the track plays. */
function Wave({ src, live = false, big = false, played }: { src: string; live?: boolean; big?: boolean; played?: number }) {
  const [peaks, setPeaks] = useState<number[] | null>(null);
  useEffect(() => {
    let gone = false;
    fetch(src).then((r) => r.json()).then((d: { peaks: number[] }) => { if (!gone) setPeaks(d.peaks.filter((_, i) => i % 2 === 0)); }).catch(() => {});
    return () => { gone = true; };
  }, [src]);
  if (!peaks) return null;
  return (
    <span className="pg-wave" data-big={big ? "" : undefined} data-live={live ? "" : undefined} aria-hidden>
      {peaks.map((p, i) => (
        <i key={i} style={{ height: `${Math.max(5, p * 100)}%`, "--d": `${(i / peaks.length) * 1.6}s` } as React.CSSProperties} data-on={played !== undefined && i / peaks.length < played ? "" : undefined} />
      ))}
    </span>
  );
}

function Viewer({ index, onClose, onStep }: { index: number; onClose: () => void; onStep: (d: number) => void }) {
  const p = PIECES[index];
  const closeBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeBtn.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") onStep(1);
      else if (e.key === "ArrowLeft") onStep(-1);
    };
    window.addEventListener("keydown", key);
    const html = document.documentElement, was = html.style.overflow;
    html.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", key); html.style.overflow = was; };
  }, [onClose, onStep]);
  return (
    <div className="pg-viewer" role="dialog" aria-modal="true" aria-label={p.title} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pg-stage" key={p.id}>
        {p.youtube ? (
          <iframe
            className="pg-frame"
            src={`https://www.youtube-nocookie.com/embed/${p.youtube}?autoplay=1&rel=0&modestbranding=1`}
            title={p.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : p.video ? (
          <video className="pg-frame" src={p.video} poster={p.image} controls autoPlay playsInline />
        ) : p.audio ? (
          <Track piece={p} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- the piece itself, whole
          <img className="pg-full" src={p.image} alt={p.title} data-contain={p.contain ? "" : undefined} />
        )}
      </div>
      <div className="pg-caption">
        <span className="pg-kind">{p.kind}</span>
        <h2>{p.title}</h2>
        <p>{p.credit}</p>
        {p.listen && <a href={p.listen.href} target="_blank" rel="noopener noreferrer">{p.listen.label}</a>}
      </div>
      <button ref={closeBtn} type="button" className="pg-close" onClick={onClose} aria-label="Close">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      </button>
      <button type="button" className="pg-step" data-dir="prev" onClick={() => onStep(-1)} aria-label="Previous piece">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden><path d="m15 18-6-6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <button type="button" className="pg-step" data-dir="next" onClick={() => onStep(1)} aria-label="Next piece">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden><path d="m9 18 6-6-6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </div>
  );
}

const time = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** A track, playing: its cover (or none), its waveform lighting up as it goes (click it to seek), play and pause. */
function Track({ piece: p }: { piece: Piece }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [t, setT] = useState(0), [d, setD] = useState(0), [playing, setPlaying] = useState(false);
  useEffect(() => { audio.current?.play().catch(() => {}); }, []);
  return (
    <div className="pg-track">
      {p.image && (
        // eslint-disable-next-line @next/next/no-img-element -- the cover
        <img className="pg-cover" src={p.image} alt="" />
      )}
      <div className="pg-player">
        <button type="button" className="pg-toggle" onClick={() => { const a = audio.current; if (!a) return; if (a.paused) a.play().catch(() => {}); else a.pause(); }} aria-label={playing ? "Pause" : "Play"}>
          {playing ? <svg viewBox="0 0 24 24" aria-hidden><path d="M8 5h3v14H8zM13 5h3v14h-3z" fill="currentColor" /></svg> : <svg viewBox="0 0 24 24" aria-hidden><path d="M8 5l11 7-11 7z" fill="currentColor" /></svg>}
        </button>
        <div
          className="pg-seek"
          role="slider"
          tabIndex={0}
          aria-label="Position"
          aria-valuemin={0}
          aria-valuemax={Math.round(d)}
          aria-valuenow={Math.round(t)}
          aria-valuetext={`${time(t)} of ${time(d)}`}
          onClick={(e) => { const a = audio.current, r = e.currentTarget.getBoundingClientRect(); if (a && d) a.currentTime = ((e.clientX - r.left) / r.width) * d; }}
          onKeyDown={(e) => { const a = audio.current; if (!a || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return; e.stopPropagation(); a.currentTime += e.key === "ArrowRight" ? 5 : -5; }}
        >
          {p.peaks && <Wave src={p.peaks} big played={d ? t / d : 0} />}
        </div>
        <span className="pg-time">{time(t)} / {time(d)}</span>
      </div>
      <audio
        ref={audio}
        src={p.audio}
        preload="auto"
        onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setD(e.currentTarget.duration)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
    </div>
  );
}
