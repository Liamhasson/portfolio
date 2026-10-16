// src/app/about/about-track.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { NextPagePull } from "@/components/shell/next-page-pull";
import { ABOUT, type Line } from "@/content/about";
import { AboutPendant } from "./about-pendant";
import { scrollForSlide, sectionHeight, trackLayout, trackProgress, trackX } from "./track";
import "./about.css";

/** A line in two colours: its highlights in the near-white, the rest in the darker tone (Liam, 2026-10-12). */
function Words({ line }: { line: Line }) {
  // (one run of text: a stacked slide is a flex box, which would make each span its own line)
  return (
    <span>
      {line.map((s, i) => s.href
        ? <Link key={i} href={s.href} className={`ab-inline${s.hi ? " hi" : ""}`}>{s.t}</Link>
        : <span key={i} className={s.hi ? "hi" : undefined}>{s.t}</span>)}
    </span>
  );
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
    let raf = 0, height = 0, photoDist = 0;
    const photo = tr.querySelector<HTMLElement>(".ab-portrait");
    // the track's window: the clip (the screen's width; read from the clip so it stays right if the clip is ever inset)
    const viewW = () => clip.clientWidth || window.innerWidth;
    const frame = () => {
      if (sec.dataset.mode !== "track") return;
      const p = trackProgress(window.scrollY, sec.offsetTop, height, window.innerHeight);
      const x = trackX(p, tr.scrollWidth, viewW());
      tr.style.transform = `translate3d(${x}px, 0, 0)`;
      // the photo stays where it is and is cropped away from its left edge, over the gap to the first line
      if (photo) {
        const k = photoDist > 0 ? Math.min(-x / photoDist, 1) : 0;
        photo.style.transform = `translate3d(${-x}px, 0, 0)`;
        photo.style.clipPath = `inset(0 0 0 ${k * 100}% round 10px)`;
      }
      if (bar.current) bar.current.style.transform = `scaleX(${p})`;
    };
    const layout = () => {
      const mode = trackLayout({ w: window.innerWidth, h: window.innerHeight, reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches });
      sec.dataset.mode = mode;
      if (mode === "stack") {
        sec.style.height = ""; tr.style.transform = ""; tr.style.removeProperty("--ab-photo-h");
        if (photo) { photo.style.transform = ""; photo.style.clipPath = ""; }
        return;
      }
      // the photo stands exactly as tall as the tallest text layer (Liam, 2026-10-15)
      const tallest = Math.max(0, ...[...tr.querySelectorAll<HTMLElement>(".ab-slide:not(.ab-photo)")].map((s) => s.offsetHeight));
      if (tallest) tr.style.setProperty("--ab-photo-h", `${tallest}px`);
      // the crop is done by the time the first line reaches the photo's right edge: the gap between them (rects: transform-proof)
      const fig = photo?.parentElement, next = fig?.nextElementSibling;
      if (fig && next) photoDist = next.getBoundingClientRect().left - fig.getBoundingClientRect().right;
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
      <section ref={section} className="ab" data-mode="track" aria-labelledby="about-h">
        <h1 id="about-h" className="sr-only">About</h1>
        <div className="ab-pin">
          <div className="ab-clip">
            <div ref={track} className="ab-track">
              {/* Liam's photo opens the track, left of the first line: it holds still while the words roll past and is cropped away from the left, gone before the first line reaches it (Liam, 2026-10-15) */}
              {ABOUT.portrait && (
                <figure className="ab-slide ab-photo">
                  <Image className="ab-portrait" src={ABOUT.portrait.src} alt={ABOUT.portrait.alt} width={ABOUT.portrait.width} height={ABOUT.portrait.height} sizes="(max-width: 1023px) 70vw, 30vw" priority />
                </figure>
              )}
              {ABOUT.lines.map((l, i) => <p key={i} className="ab-slide ab-big" data-pendant={["line1", "band", "how"][i]}><Words line={l} /></p>)}
              {/* End to end, straight after "That's still how I work…": the story's conclusion (Liam, 2026-10-12) */}
              <p className="ab-slide ab-big" data-pendant="e2e"><Words line={ABOUT.opening.text} /></p>
              {ABOUT.quotes.map((q, i) => (
                <figure key={q.name} className="ab-slide ab-quote" data-pendant={`quote${i + 1}`}>
                  <blockquote><Words line={q.text} /></blockquote>
                  <figcaption className="ab-mono">{q.name} · {q.role}</figcaption>
                </figure>
              ))}
              {ABOUT.verbs.map((v, i) => (
                <div key={v.title} className="ab-slide ab-verb" data-pendant={["find", "check", "build"][i]}>
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
          <AboutPendant />
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
