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
.wi { --bg:#0a0a0b; --ink:#f4f1ee; --dim:rgba(244,241,238,.38); --rule:rgba(244,241,238,.14);
  position:fixed; left:0; top:0; transform-origin:0 0; background:var(--bg); color:var(--ink); font-family:var(--font-sans);
  overflow:hidden; container-type:inline-size; will-change:transform,opacity; line-height:normal; }
.wi .top { position:absolute; left:3.6cqw; right:3.6cqw; top:3.4cqw; display:flex; justify-content:space-between; align-items:flex-end; }
.wi .title { font-size:4.8cqw; font-weight:400; line-height:.98; letter-spacing:-.02em; margin:0; }
.wi .rows { position:absolute; left:3.6cqw; right:3.6cqw; top:15.5cqw; border-top:1px solid var(--rule); margin:0; padding:0; list-style:none; }
.wi .row { display:grid; grid-template-columns:7cqw 1fr 38cqw; align-items:baseline; padding:1.75cqw 0 1.95cqw; border-bottom:1px solid var(--rule); color:var(--dim); transition:color .35s cubic-bezier(.22,1,.36,1); }
.wi .row .n { font:400 1.15cqw/1 var(--font-mono); letter-spacing:.04em; }
.wi .row .name { font-size:2.15cqw; font-weight:400; }
.wi .row .name small { font-size:1.2cqw; margin-left:1.2cqw; letter-spacing:.02em; opacity:.8; }
.wi .row .line { font-size:1.55cqw; line-height:1.35; }
.wi .row.on, .wl .row.on { color:var(--ink); }
.wi .row.soon .line { font:400 1.15cqw/1.4 var(--font-mono); letter-spacing:.08em; text-transform:uppercase; }
.wi-panel { position:fixed; left:0; top:0; background:#0a0a0b; pointer-events:none; transform-origin:0 0; }
.wl { --ink:#f4f1ee; --dim:rgba(244,241,238,.38); --rule:rgba(244,241,238,.14);
  position:fixed; inset:0; color:var(--ink); font-family:var(--font-sans); line-height:normal;
  padding:clamp(88px,22vw,120px) 4.9vw 32px; overflow-y:auto; }
.wl .title { font-size:clamp(34px,10vw,44px); font-weight:400; line-height:1; letter-spacing:-.02em; margin:0 0 28px; }
.wl .rows { margin:0; padding:0; list-style:none; border-top:1px solid var(--rule); }
.wl .row { display:grid; grid-template-columns:44px 1fr; row-gap:6px; padding:16px 0 18px; border-bottom:1px solid var(--rule);
  color:var(--dim); transition:color .35s cubic-bezier(.22,1,.36,1); }
.wl .row .n { font:400 11px/1 var(--font-mono); letter-spacing:.04em; padding-top:6px; }
.wl .row .name { font-size:20px; font-weight:400; }
.wl .row .name small { font-size:12px; margin-left:10px; letter-spacing:.02em; opacity:.8; }
.wl .row .line { grid-column:2; font-size:15px; line-height:1.35; }
.wl .row.soon .line { font:400 11px/1.4 var(--font-mono); letter-spacing:.08em; text-transform:uppercase; }
`;

function Rows({ active, onActive, rowRef }: { active: number; onActive: (i: number) => void; rowRef?: (el: HTMLElement | null, i: number) => void }) {
  return (
    <ol className="rows">
      {ROWS.map((r, i) => (
        <li
          key={r.n}
          ref={rowRef ? (el) => rowRef(el, i) : undefined}
          className={`row${i === active ? " on" : ""}${r.soon ? " soon" : ""}`}
          onPointerEnter={() => onActive(i)}
          onPointerDown={() => onActive(i)}
        >
          <span className="n">{r.n}</span>
          <span className="name">{r.name}{r.kind && <small>{r.kind}</small>}</span>
          <span className="line">{r.line}</span>
        </li>
      ))}
    </ol>
  );
}

export function WorkIndex({ bind }: { bind: (h: WorkIndexHandle) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const panelEl = useRef<HTMLDivElement>(null);
  const listEl = useRef<HTMLDivElement>(null);
  const listItems = useRef<(HTMLElement | null)[]>([]);
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
        if (box.current) box.current.style.transform = matrix3d(sz().w, sz().h, quad);
      },
      show(opacity) {
        const el = box.current;
        if (!el) return;
        el.style.opacity = String(opacity);
        el.style.visibility = opacity > 0.001 ? "visible" : "hidden";
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
        // the title, then each row, rising from 16px below, unblurring (the screen's wake reveal, on scroll)
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
        <div className="top">
          <h2 className="title">Selected work</h2>
        </div>
        <Rows active={active} onActive={setActive} />
      </section>
      <section ref={listEl} className="wl z-[7]" style={{ visibility: "hidden", pointerEvents: "none" }} aria-label="Selected work">
        <h2 className="title" style={{ opacity: 0 }}>Selected work</h2>
        <Rows active={active} onActive={setActive} rowRef={(el, i) => { listItems.current[i] = el; if (el && !el.style.opacity) el.style.opacity = "0"; }} />
      </section>
    </>
  );
}
