// src/app/about/about-track.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { NextPagePull } from "@/components/shell/next-page-pull";
import { ABOUT, type Line } from "@/content/about";
import { sectionHeight, trackLayout, trackProgress, trackX } from "./track";
import "./about.css";

/** A line in two colours: its highlights in the near-white, the rest in the darker tone (Liam, 2026-10-12). */
function Words({ line }: { line: Line }) {
  return <>{line.map((s, i) => <span key={i} className={s.hi ? "hi" : undefined}>{s.t}</span>)}</>;
}

/**
 * About (spec 2026-10-12-about-contact-design.md §3): Liam's text, the quotes as its proof, What I do under his three
 * verbs, the resume, then the pull to Contact. A pinned sideways track scrubbed by scroll (track.ts); stacked on portrait
 * phones and under reduced motion. No WebGL: the quiet reading page.
 */
export function AboutTrack() {
  const section = useRef<HTMLElement>(null), track = useRef<HTMLDivElement>(null), bar = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const sec = section.current, tr = track.current;
    if (!sec || !tr) return;
    let raf = 0, height = 0;
    const frame = () => {
      if (sec.dataset.mode !== "track") return;
      const p = trackProgress(window.scrollY, sec.offsetTop, height, window.innerHeight);
      tr.style.transform = `translate3d(${trackX(p, tr.scrollWidth, window.innerWidth)}px, 0, 0)`;
      if (bar.current) bar.current.style.transform = `scaleX(${p})`;
    };
    const layout = () => {
      const mode = trackLayout({ w: window.innerWidth, h: window.innerHeight, reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches });
      sec.dataset.mode = mode;
      if (mode === "stack") { sec.style.height = ""; tr.style.transform = ""; return; }
      height = sectionHeight(tr.scrollWidth, window.innerWidth, window.innerHeight);
      sec.style.height = `${height}px`;
      frame();
    };
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); };
    layout();
    void document.fonts?.ready.then(layout);
    window.addEventListener("resize", layout);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", layout); window.removeEventListener("scroll", onScroll); };
  }, []);
  const last = ABOUT.verbs.length - 1;
  return (
    <>
      <section ref={section} className="ab" data-mode="track" data-portrait={ABOUT.portrait ? "" : undefined} aria-labelledby="about-h">
        <h1 id="about-h" className="sr-only">About</h1>
        <div className="ab-pin">
          <div className="ab-clip">
            <div ref={track} className="ab-track">
              {ABOUT.lines.map((l, i) => <p key={i} className="ab-slide ab-big"><Words line={l} /></p>)}
              {ABOUT.quotes.map((q) => (
                <figure key={q.name} className="ab-slide ab-quote">
                  <blockquote><Words line={q.text} /></blockquote>
                  <figcaption className="ab-mono">{q.name} · {q.role}</figcaption>
                </figure>
              ))}
              <p className="ab-slide ab-big"><Link href={ABOUT.opening.href} className="ab-open"><Words line={ABOUT.opening.text} /></Link></p>
              {ABOUT.verbs.map((v, i) => (
                <div key={v.title} className="ab-slide ab-verb">
                  <div className="ab-mono">What I do · {i + 1} of {ABOUT.verbs.length}</div>
                  <h2 className="ab-verb-title">{v.title}</h2>
                  <ul className="ab-skills">
                    {v.skills.map((s) => (
                      <li key={s.name}>
                        <span className="ab-skill">{s.name}</span>
                        {s.href ? <Link href={s.href} className="ab-proof">{s.proof} ↗</Link> : <span className="ab-proof">{s.proof}</span>}
                      </li>
                    ))}
                  </ul>
                  {i === last && <a href={ABOUT.resume.href} target="_blank" rel="noopener noreferrer" className="ab-pill">{ABOUT.resume.label} ↗</a>}
                </div>
              ))}
              <p className="ab-slide ab-big"><Words line={ABOUT.closing} /></p>
            </div>
          </div>
          {ABOUT.portrait && (
            <Image className="ab-portrait" src={ABOUT.portrait.src} alt={ABOUT.portrait.alt} width={ABOUT.portrait.width} height={ABOUT.portrait.height} sizes="21vw" priority />
          )}
          <span className="ab-bar" aria-hidden><span ref={bar} /></span>
        </div>
      </section>
      <div className="ab-end">
        <NextPagePull href="/contact" label="Contact" line="Keep scrolling" />
      </div>
    </>
  );
}
