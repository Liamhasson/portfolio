"use client";

/**
 * The project index as a live page section: the same layout as the laptop screen (docs/prototypes/work-index.html,
 * captured into the screen's texture by blender/lookdev/capture_index.mjs), sized in container units so it lays out
 * exactly like the screen at any size. As the camera pushes into the screen it is laid over the screen's quad (a
 * perspective transform), crossfades in where the two coincide, then:
 *   - landscape: settles into the view (16:10, contained) and takes the pointer;
 *   - portrait (phones): the screen's black panel grows to fill the phone, the 16:10 layout gives way, and the phone
 *     list surfaces row by row (the same rise as the screen's wake reveal), so the screen becomes the section.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { matrix3d, type Pt } from "@/three/sand/homography";

/** The projects (copy and tags from the approved plan and the current portfolio). The three finished ones open their
 *  case studies; Nordic Logic is in progress (a still, not a link). */
const CARDS: { n: string; name: string; tags: string[]; line: string; href?: string; video?: string; poster: string; progress?: boolean }[] = [
  { n: "01", name: "Eventread", tags: ["SaaS web app", "Designer-builder"], line: "The check every booker skips.", href: "/eventread", video: "/work/eventread", poster: "/work/eventread.jpg" },
  { n: "02", name: "Cyvore", tags: ["B2B website", "Information architecture"], line: "A cybersecurity startup needed a site investors would believe in.", href: "/cyvore", video: "/work/cyvore", poster: "/work/cyvore.jpg" },
  { n: "03", name: "Pulse", tags: ["Fitness app", "User research"], line: "A goal-focused fitness app designed around four retention milestones.", href: "/pulse", video: "/work/pulse", poster: "/work/pulse.jpg" },
  { n: "04", name: "Nordic Logic", tags: ["B2B website", "Design system"], line: "A carrier invoice audit startup that needed to build trust without any social proof or clients.", poster: "/work/nordic-logic.jpg", progress: true },
];

export interface WorkIndexHandle {
  /** Lay the 16:10 index over a quad on the screen (CSS px: top-left, top-right, bottom-right, bottom-left). */
  place(quad: [Pt, Pt, Pt, Pt]): void;
  /** How present the 16:10 index is (0..1). */
  show(opacity: number): void;
  /** The black panel behind it, as a rect (CSS px), or null for none. */
  panel(rect: { x: number; y: number; w: number; h: number } | null): void;
  /** Phones: how far the list has surfaced (0..1, rows in turn). */
  list(progress: number): void;
  /** Which layer takes the pointer: none, the 16:10 index, or the phone list. */
  interactive(which: "none" | "wide" | "list"): void;
  /** The box the 16:10 index lays out in (CSS px). */
  size(): { w: number; h: number };
}

const CSS = `
.wi { --bg:#0a0a0b; --ink:#f4f1ee; --dim:rgba(244,241,238,.42); --rule:rgba(244,241,238,.14);
  position:fixed; left:0; top:0; transform-origin:0 0; background:var(--bg); color:var(--ink); font-family:var(--font-sans);
  overflow:hidden; container-type:inline-size; will-change:transform,opacity; line-height:normal; }
.wi .page { position:absolute; inset:0; overflow-y:auto; scrollbar-width:none; overscroll-behavior:contain; }
.wi .page::-webkit-scrollbar { display:none; }
.wi .top { padding:3.4cqw 3.6cqw 0; }
.wi .title { font-size:4.8cqw; font-weight:400; line-height:.98; letter-spacing:-.02em; margin:0; }
.wi .grid { display:grid; grid-template-columns:1fr 1fr; gap:3.2cqw 2.4cqw; padding:3.4cqw 3.6cqw 0; margin:0; list-style:none; }
.wi .card, .wl .card { display:block; color:inherit; text-decoration:none; }
.wi .media, .wl .media { position:relative; aspect-ratio:16/10; overflow:hidden; background:#151517; }
.wi .media { border-radius:.8cqw; }
.wl .media { border-radius:10px; }
.wi .media video, .wi .media img, .wl .media video, .wl .media img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; transition:transform .9s cubic-bezier(.22,1,.36,1); }
.wi .card:hover .media video, .wi .card:hover .media img, .wi .card:focus-visible .media video { transform:scale(1.035); }
.wi .card:focus-visible, .wl .card:focus-visible { outline:1px solid var(--ink); outline-offset:6px; border-radius:4px; }
.wi .tag, .wl .tag { position:absolute; left:1.2cqw; top:1.2cqw; font:500 .85cqw/1 var(--font-mono); letter-spacing:.08em; text-transform:uppercase; color:var(--ink); background:rgba(10,10,11,.72); border-radius:999px; padding:.55cqw .9cqw; }
.wi .meta { display:flex; gap:.9cqw; margin-top:1.3cqw; font:400 .85cqw/1.2 var(--font-mono); letter-spacing:.08em; text-transform:uppercase; color:var(--dim); }
.wi .meta .n, .wl .meta .n { color:var(--ink); }
.wi .name { font-size:2.15cqw; font-weight:400; letter-spacing:-.01em; margin:.7cqw 0 0; }
.wi .line { font-size:1.3cqw; line-height:1.35; color:var(--dim); margin:.5cqw 0 0; max-width:36cqw; }
.wi .more { margin:3.6cqw 3.6cqw 3.4cqw; padding-top:1.6cqw; border-top:1px solid var(--rule); display:flex; gap:.9cqw; font:400 .85cqw/1 var(--font-mono); letter-spacing:.08em; text-transform:uppercase; color:var(--dim); }
.wi .more .n, .wl .more .n { color:var(--ink); }
.wi-panel { position:fixed; left:0; top:0; background:#0a0a0b; pointer-events:none; transform-origin:0 0; }
.wl { --ink:#f4f1ee; --dim:rgba(244,241,238,.42); --rule:rgba(244,241,238,.14);
  position:fixed; inset:0; color:var(--ink); font-family:var(--font-sans); line-height:normal;
  padding:clamp(88px,22vw,120px) 4.9vw 32px; overflow-y:auto; overscroll-behavior:contain; }
.wl .title { font-size:clamp(34px,10vw,44px); font-weight:400; line-height:1; letter-spacing:-.02em; margin:0 0 24px; }
.wl .grid { display:grid; gap:32px; margin:0; padding:0; list-style:none; }
.wl .tag { left:10px; top:10px; font-size:10px; padding:6px 9px; }
.wl .meta { display:flex; gap:8px; margin-top:12px; font:400 10px/1.2 var(--font-mono); letter-spacing:.08em; text-transform:uppercase; color:var(--dim); }
.wl .name { font-size:22px; font-weight:400; margin:6px 0 0; }
.wl .line { font-size:15px; line-height:1.35; color:var(--dim); margin:4px 0 0; }
.wl .more { margin-top:32px; padding-top:14px; border-top:1px solid var(--rule); display:flex; gap:8px; font:400 10px/1 var(--font-mono); letter-spacing:.08em; text-transform:uppercase; color:var(--dim); }
`;

function Media({ c, playing }: { c: (typeof CARDS)[number]; playing: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (playing) {
      // in step with the same loop on the laptop screen, so the handover shows one picture
      const twin = (window as unknown as { __screenMedia?: Record<string, HTMLVideoElement> }).__screenMedia?.[`${c.video}.mp4`];
      if (twin && twin.readyState > 0) v.currentTime = twin.currentTime;
      v.play().catch(() => {});
    } else v.pause();
  }, [playing, c.video]);
  return (
    <div className="media">
      {c.video ? (
        <video ref={ref} poster={c.poster} muted loop playsInline preload="metadata" aria-hidden>
          <source src={`${c.video}.webm`} type="video/webm; codecs=av01.0.05M.08" />
          <source src={`${c.video}.mp4`} type="video/mp4" />
        </video>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- a still inside a transformed layer (no layout shift)
        <img src={c.poster} alt="" />
      )}
      {c.progress && <span className="tag">In progress</span>}
    </div>
  );
}

function Cards({ playing, itemRef }: { playing: boolean; itemRef?: (el: HTMLElement | null, i: number) => void }) {
  return (
    <>
      <ol className="grid">
        {CARDS.map((c, i) => {
          const inner = (
            <>
              <Media c={c} playing={playing} />
              <div className="meta"><span className="n">{c.n}</span>{c.tags.flatMap((t, k) => (k ? [<span key={`d${k}`}>·</span>, <span key={t}>{t}</span>] : [<span key={t}>{t}</span>]))}</div>
              <h3 className="name">{c.name}</h3>
              <p className="line">{c.line}</p>
            </>
          );
          return (
            <li key={c.n} ref={itemRef ? (el) => itemRef(el, i) : undefined}>
              {c.href ? <Link href={c.href} className="card">{inner}</Link> : <div className="card" aria-label={`${c.name}, in progress`}>{inner}</div>}
            </li>
          );
        })}
      </ol>
      <div className="more" ref={itemRef ? (el) => itemRef(el, CARDS.length) : undefined}><span className="n">05</span><span>More coming soon</span></div>
    </>
  );
}

export function WorkIndex({ bind }: { bind: (h: WorkIndexHandle) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const panelEl = useRef<HTMLDivElement>(null);
  const listEl = useRef<HTMLDivElement>(null);
  const listItems = useRef<(HTMLElement | null)[]>([]);
  const [playing, setPlaying] = useState({ wide: false, list: false });
  useEffect(() => {
    const sz = () => ({ w: window.innerWidth, h: window.innerWidth / 1.6 });
    const apply = () => {
      const el = box.current;
      if (!el) return;
      el.style.width = `${sz().w}px`;
      el.style.height = `${sz().h}px`;
    };
    apply();
    window.addEventListener("resize", apply);
    bind({
      place(quad) {
        if (box.current) box.current.style.transform = matrix3d(sz().w, sz().h, quad);
      },
      show(opacity) {
        const el = box.current;
        if (!el) return;
        el.style.opacity = String(opacity);
        el.style.visibility = opacity > 0.001 ? "visible" : "hidden";
        const on = opacity > 0.001;
        setPlaying((p) => (p.wide === on ? p : { ...p, wide: on }));
      },
      panel(rect) {
        const el = panelEl.current;
        if (!el) return;
        el.style.visibility = rect ? "visible" : "hidden";
        if (rect) el.style.transform = `translate(${rect.x}px,${rect.y}px) scale(${rect.w / window.innerWidth},${rect.h / window.innerHeight})`;
      },
      list(progress) {
        const el = listEl.current;
        if (!el) return;
        el.style.visibility = progress > 0.001 ? "visible" : "hidden";
        const on = progress > 0.001;
        setPlaying((p) => (p.list === on ? p : { ...p, list: on }));
        // the title, then each card, rising from 16px below, unblurring (the screen's wake reveal, on scroll)
        const items = [el.querySelector<HTMLElement>(".title"), ...listItems.current];
        items.forEach((it, i) => {
          if (!it) return;
          const k0 = Math.min(Math.max((progress * 1.6 - i * 0.12) / 0.6, 0), 1);
          const k = 1 - Math.pow(1 - k0, 3);
          it.style.opacity = String(k);
          it.style.transform = k < 1 ? `translateY(${(1 - k) * 16}px)` : "";
          it.style.filter = k < 1 ? `blur(${(1 - k) * 6}px)` : "";
        });
      },
      interactive(which) {
        if (box.current) box.current.style.pointerEvents = which === "wide" ? "auto" : "none";
        if (listEl.current) listEl.current.style.pointerEvents = which === "list" ? "auto" : "none";
      },
      size: sz,
    });
    return () => window.removeEventListener("resize", apply);
  }, [bind]);

  return (
    <>
      <style>{CSS}</style>
      <div ref={panelEl} className="wi-panel z-[5] h-screen w-screen" style={{ visibility: "hidden" }} aria-hidden />
      <section ref={box} className="wi z-[6]" style={{ opacity: 0, visibility: "hidden", pointerEvents: "none" }} aria-label="Selected work">
        <div className="page">
          <div className="top">
            <h2 className="title">Selected work</h2>
          </div>
          <Cards playing={playing.wide} />
        </div>
      </section>
      <section ref={listEl} className="wl z-[7]" style={{ visibility: "hidden", pointerEvents: "none" }} aria-label="Selected work">
        <h2 className="title" style={{ opacity: 0 }}>Selected work</h2>
        <Cards playing={playing.list} itemRef={(el, i) => { listItems.current[i] = el; if (el && !el.style.opacity) el.style.opacity = "0"; }} />
      </section>
    </>
  );
}
