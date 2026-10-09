"use client";

/**
 * The project index as a live page section: the same layout as the laptop screen (docs/prototypes/work-index.html,
 * captured into the screen's texture by blender/lookdev/capture_index.mjs), sized in container units so it lays out
 * exactly like the screen at any size. As the camera pushes into the screen it is laid over the screen's quad (a
 * perspective transform), crossfades in where the two coincide, then settles into the view and takes the pointer.
 */
import { useEffect, useRef, useState } from "react";
import { matrix3d, type Pt } from "@/three/sand/homography";

const ROWS = [
  { n: "01", name: "Eventread", kind: "SaaS web app", line: "The check every booker skips." },
  { n: "02", name: "Cyvore", kind: "B2B website", line: "A cybersecurity startup needed a site investors would believe in." },
  { n: "03", name: "Pulse", kind: "Fitness app", line: "A goal-focused fitness app designed around four retention milestones." },
  { n: "04", name: "Nordic Logic", kind: "B2B website", line: "A carrier invoice audit startup that needed to build trust without any social proof or clients." },
  { n: "05", name: "Stub", kind: "", line: "Coming soon", soon: true },
];

export interface WorkIndexHandle {
  /** Lay the index over a quad on the screen (CSS px: top-left, top-right, bottom-right, bottom-left). */
  place(quad: [Pt, Pt, Pt, Pt]): void;
  /** How present it is (0..1), and the backdrop behind it (0..1: the bars around a 16:10 index on other screens). */
  show(opacity: number, backdrop: number): void;
  /** Whether it takes the pointer (only once it has taken over). */
  interactive(on: boolean): void;
  /** The box it lays out in (CSS px, 16:10). */
  size(): { w: number; h: number };
}

const CSS = `
.wi { --bg:#0a0a0b; --ink:#f4f1ee; --dim:rgba(244,241,238,.38); --rule:rgba(244,241,238,.14);
  position:fixed; left:0; top:0; transform-origin:0 0; background:var(--bg); color:var(--ink); font-family:var(--font-sans);
  overflow:hidden; container-type:inline-size; will-change:transform,opacity; line-height:normal; }
.wi .top { position:absolute; left:3.6cqw; right:3.6cqw; top:3.4cqw; display:flex; justify-content:space-between; align-items:flex-end; }
.wi .title { font-size:4.8cqw; font-weight:400; line-height:.98; letter-spacing:-.02em; margin:0; }
.wi .count { font:400 1.15cqw/1 var(--font-mono); letter-spacing:.06em; color:var(--dim); }
.wi .rows { position:absolute; left:3.6cqw; right:3.6cqw; top:15.5cqw; border-top:1px solid var(--rule); margin:0; padding:0; list-style:none; }
.wi .row { display:grid; grid-template-columns:7cqw 1fr 38cqw; align-items:baseline; padding:1.75cqw 0 1.95cqw; border-bottom:1px solid var(--rule); color:var(--dim); transition:color .35s cubic-bezier(.22,1,.36,1); }
.wi .row .n { font:400 1.15cqw/1 var(--font-mono); letter-spacing:.04em; }
.wi .row .name { font-size:2.15cqw; font-weight:400; }
.wi .row .name small { font-size:1.2cqw; margin-left:1.2cqw; letter-spacing:.02em; opacity:.8; }
.wi .row .line { font-size:1.55cqw; line-height:1.35; }
.wi .row.on { color:var(--ink); }
.wi .row.soon .line { font:400 1.15cqw/1.4 var(--font-mono); letter-spacing:.08em; text-transform:uppercase; }
.wi-backdrop { position:fixed; inset:0; background:#0a0a0b; pointer-events:none; }
`;

export function WorkIndex({ bind }: { bind: (h: WorkIndexHandle) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
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
        const el = box.current;
        if (el) el.style.transform = matrix3d(sz().w, sz().h, quad);
      },
      show(opacity, backdrop) {
        if (box.current) box.current.style.opacity = String(opacity);
        if (back.current) back.current.style.opacity = String(backdrop);
        if (box.current) box.current.style.visibility = opacity > 0.001 ? "visible" : "hidden";
      },
      interactive(on) {
        if (box.current) box.current.style.pointerEvents = on ? "auto" : "none";
      },
      size: sz,
    });
    return () => window.removeEventListener("resize", apply);
  }, [bind]);

  return (
    <>
      <style>{CSS}</style>
      <div ref={back} className="wi-backdrop z-[5]" style={{ opacity: 0 }} aria-hidden />
      <section ref={box} className="wi z-[6]" style={{ opacity: 0, visibility: "hidden", pointerEvents: "none" }} aria-label="Selected work">
        <div className="top">
          <h2 className="title">Selected work</h2>
          <span className="count">05 PROJECTS</span>
        </div>
        <ol className="rows">
          {ROWS.map((r, i) => (
            <li
              key={r.n}
              className={`row${i === active ? " on" : ""}${r.soon ? " soon" : ""}`}
              onPointerEnter={() => setActive(i)}
            >
              <span className="n">{r.n}</span>
              <span className="name">{r.name}{r.kind && <small>{r.kind}</small>}</span>
              <span className="line">{r.line}</span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
