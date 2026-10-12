// src/app/about/about-track.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { NextPagePull } from "@/components/shell/next-page-pull";
import { ABOUT, type Line } from "@/content/about";
import { scrollForSlide, sectionHeight, trackLayout, trackProgress, trackX } from "./track";
import "./about.css";

/** A line in two colours: its highlights in the near-white, the rest in the darker tone (Liam, 2026-10-12). */
function Words({ line }: { line: Line }) {
  // (one run of text: a stacked slide is a flex box, which would make each span its own line)
  return <span>{line.map((s, i) => <span key={i} className={s.hi ? "hi" : undefined}>{s.t}</span>)}</span>;
}

/**
 * About (spec 2026-10-12-about-contact-design.md §3): Liam's text, the quotes as its proof, What I do under his three
 * verbs, the resume, then the pull to Contact. A pinned sideways track scrubbed by scroll (track.ts); stacked on portrait
 * phones and under reduced motion. No WebGL: the quiet reading page.
 */
export function AboutTrack() {
  const section = useRef<HTMLElement>(null), track = useRef<HTMLDivElement>(null), bar = useRef<HTMLSpanElement>(null), resume = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const sec = section.current, tr = track.current, clip = tr?.parentElement;
    if (!sec || !tr || !clip) return;
    let raf = 0, height = 0;
    // the track's window: the clip (narrower than the screen when the portrait stands beside it)
    const viewW = () => clip.clientWidth || window.innerWidth;
    const frame = () => {
      if (sec.dataset.mode !== "track") return;
      const p = trackProgress(window.scrollY, sec.offsetTop, height, window.innerHeight);
      tr.style.transform = `translate3d(${trackX(p, tr.scrollWidth, viewW())}px, 0, 0)`;
      if (bar.current) bar.current.style.transform = `scaleX(${p})`;
    };
    const layout = () => {
      const mode = trackLayout({ w: window.innerWidth, h: window.innerHeight, reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches });
      sec.dataset.mode = mode;
      if (mode === "stack") { sec.style.height = ""; tr.style.transform = ""; return; }
      height = sectionHeight(tr.scrollWidth, viewW(), window.innerHeight);
      sec.style.height = `${height}px`;
      frame();
    };
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); };
    // keyboard focus (and find-in-page) on a slide: scroll the page to where the track shows it
    const onFocus = (e: FocusEvent) => {
      if (sec.dataset.mode !== "track") return;
      const slide = (e.target as HTMLElement).closest<HTMLElement>(".ab-slide");
      if (!slide) return;
      window.scrollTo(0, scrollForSlide(sec.offsetTop, slide.offsetLeft, window.innerWidth * 0.06, Math.max(tr.scrollWidth - viewW(), 0)));
    };
    sec.addEventListener("focusin", onFocus);
    // stacked: each slide rises in as it comes into view (about.css; only the stack shows it)
    const io = typeof IntersectionObserver === "function"
      ? new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) (e.target as HTMLElement).dataset.in = ""; }), { rootMargin: "0px 0px -12% 0px" })
      : null;
    tr.querySelectorAll(".ab-slide").forEach((el) => io?.observe(el));
    // phones (stacked): the fixed resume shows only while About is on screen
    const ioSec = typeof IntersectionObserver === "function"
      ? new IntersectionObserver(([e]) => {
        const el = resume.current;
        if (!el) return;
        if (e.isIntersecting) el.dataset.on = ""; else delete el.dataset.on;
      }, { rootMargin: "-65% 0px 0px 0px" })   // (only while About reaches the bottom third, where it sits: gone before the pull comes up)
      : null;
    ioSec?.observe(sec);
    layout();
    void document.fonts?.ready.then(layout);
    window.addEventListener("resize", layout);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { cancelAnimationFrame(raf); io?.disconnect(); ioSec?.disconnect(); sec.removeEventListener("focusin", onFocus); window.removeEventListener("resize", layout); window.removeEventListener("scroll", onScroll); };
  }, []);
  return (
    <>
      <section ref={section} className="ab" data-mode="track" data-portrait={ABOUT.portrait ? "" : undefined} aria-labelledby="about-h">
        <h1 id="about-h" className="sr-only">About</h1>
        <div className="ab-pin">
          <div className="ab-clip">
            <div ref={track} className="ab-track">
              {ABOUT.lines.map((l, i) => <p key={i} className="ab-slide ab-big"><Words line={l} /></p>)}
              {/* End to end, straight after "That's still how I work…": the story's conclusion (Liam, 2026-10-12) */}
              <p className="ab-slide ab-big"><Words line={ABOUT.opening.text} /></p>
              {ABOUT.quotes.map((q) => (
                <figure key={q.name} className="ab-slide ab-quote">
                  <blockquote><Words line={q.text} /></blockquote>
                  <figcaption className="ab-mono">{q.name} · {q.role}</figcaption>
                </figure>
              ))}
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
                </div>
              ))}
              <p className="ab-slide ab-big"><Words line={ABOUT.closing} /></p>
            </div>
          </div>
          {ABOUT.portrait && (
            <Image className="ab-portrait" src={ABOUT.portrait.src} alt={ABOUT.portrait.alt} width={ABOUT.portrait.width} height={ABOUT.portrait.height} sizes="21vw" priority />
          )}
          <span className="ab-bar" aria-hidden><span ref={bar} /></span>
          {/* the resume holds still in the middle for the whole of About (Liam, 2026-10-12): above the progress line on the
              pinned track, fixed at the bottom on phones while About is on screen */}
          <a ref={resume} href={ABOUT.resume.href} target="_blank" rel="noopener noreferrer" className="ab-pill ab-resume">{ABOUT.resume.label} ↗</a>
        </div>
      </section>
      <div className="ab-end">
        <NextPagePull href="/contact" label="Contact" line="Keep scrolling" />
      </div>
    </>
  );
}
