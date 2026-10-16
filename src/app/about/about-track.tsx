// src/app/about/about-track.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment, useEffect, useRef, type ReactNode } from "react";
import { NextPagePull } from "@/components/shell/next-page-pull";
import { ABOUT, type Line, type Picture } from "@/content/about";
import { pictureState } from "./picture-motion";
import { scrollForSlide, sectionHeight, trackLayout, trackProgress, trackX } from "./track";
import "./about.css";

/** A line in two colours: its highlights in the near-white, the rest in the darker tone (Liam, 2026-10-12). `inLink`: set inside the line's link, right after its words (the band loops). */
function Words({ line, inLink }: { line: Line; inLink?: ReactNode }) {
  // (one run of text: a stacked slide is a flex box, which would make each span its own line)
  return (
    <span>
      {line.map((s, i) => s.href
        ? <Link key={i} href={s.href} className={`ab-inline${s.hi ? " hi" : ""}`}>{s.t}{inLink}</Link>
        : <span key={i} className={s.hi ? "hi" : undefined}>{s.t}</span>)}
    </span>
  );
}

/**
 * A picture along the track (spec 2026-10-16-about-pictures-design.md §2): a frame, optionally a caption under it. A loop is
 * a silent video (it plays only while on screen: the script, not here), a still goes through next/image. `decor`: the
 * words next to it already say what it shows (a link's name stays its words), so the frame is hidden from assistive tech.
 * `.ab-pic` / `.ab-pic-f` / `.ab-pic-cap` are the hooks the pictures' motion takes hold of.
 */
function Pic({ p, className = "", sizes, width, height, decor, anchor }: { p: Picture; className?: string; sizes?: string; width?: number; height?: number; decor?: boolean; anchor?: string }) {
  return (
    <span className={`ab-pic ${className}`.trim()} data-pic={p.id} data-pendant={anchor} title={p.title}>
      <span className="ab-pic-f" aria-hidden={decor ? true : undefined}>
        {p.loop
          ? <video muted loop playsInline preload="none" poster={p.poster} src={p.src} aria-label={decor ? undefined : p.alt} />
          : <Image src={p.src} alt={p.alt} width={width ?? 1200} height={height ?? 1600} sizes={sizes} />}
      </span>
      {p.caption && <span className="ab-pic-cap ab-mono">{p.caption}</span>}
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
    // the pictures along the track: each one's left on the track, its width (picture + caption), its corner radius (measured in layout)
    type Pic = { el: HTMLElement; left: number; width: number; radius: string; link: boolean };
    let pics: Pic[] = [];
    const allPics = [...tr.querySelectorAll<HTMLElement>(".ab-pic")];
    const clearPics = () => allPics.forEach((el) => { el.style.clipPath = ""; el.style.visibility = ""; });
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
      // each picture rises out of its line as it arrives and is cut at the margin line as it leaves (picture-motion.ts)
      const vw = viewW();
      for (const pic of pics) {
        const { top, left, hidden } = pictureState(pic.left + x, pic.width, vw);
        pic.el.style.clipPath = `inset(${top}% -100vw 0 ${(left / 100) * pic.width}px round ${pic.radius})`;
        // (fully gone: hidden, not a hairline. A picture inside a link is only clipped away: visibility:hidden would take the link out of the tab order, and the focus handler below brings it into view)
        pic.el.style.visibility = hidden && !pic.link ? "hidden" : "";
      }
      if (bar.current) bar.current.style.transform = `scaleX(${p})`;
    };
    const layout = () => {
      const mode = trackLayout({ w: window.innerWidth, h: window.innerHeight, reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches });
      sec.dataset.mode = mode;
      if (mode === "stack") {
        sec.style.height = ""; tr.style.transform = ""; tr.style.removeProperty("--ab-photo-h");
        if (photo) { photo.style.transform = ""; photo.style.clipPath = ""; }
        pics = []; clearPics();
        return;
      }
      // the photo stands exactly as tall as the tallest text layer (Liam, 2026-10-15)
      const tallest = Math.max(0, ...[...tr.querySelectorAll<HTMLElement>(".ab-slide:not(.ab-photo)")].map((s) => s.offsetHeight));
      if (tallest) tr.style.setProperty("--ab-photo-h", `${tallest}px`);
      // the crop is done by the time the first line reaches the photo's right edge: the gap between them (rects: transform-proof)
      const fig = photo?.parentElement, next = fig?.nextElementSibling;
      if (fig && next) photoDist = next.getBoundingClientRect().left - fig.getBoundingClientRect().right;
      // the pictures: left edge relative to the track and width including the caption, from rects (the track's own travel cancels out)
      const t0 = tr.getBoundingClientRect().left;
      pics = allPics.map((el) => {
        const r = el.getBoundingClientRect();
        const right = Math.max(r.right, ...[...el.children].map((c) => c.getBoundingClientRect().right));
        return { el, left: r.left - t0, width: right - r.left, radius: getComputedStyle(el.querySelector(".ab-pic-f") ?? el).borderTopLeftRadius || "10px", link: !!el.closest("a") };
      });
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
              {ABOUT.lines.map((l, i) => i === 1
                /* the second paragraph: the two band loops inside its link, and the studio beside it, bottom-aligned (Liam, 2026-10-16) */
                ? (
                  <div key={i} className="ab-slide ab-row">
                    <p className="ab-big"><Words line={l} inLink={ABOUT.pictures.bands.map((b) => <Pic key={b.id} p={b} className="ab-chip" decor />)} /></p>
                    <Pic p={ABOUT.pictures.studio} className="ab-studio" width={1200} height={1600} sizes="(max-width: 1023px) 40vw, 12vw" />
                  </div>
                )
                : <p key={i} className="ab-slide ab-big"><Words line={l} /></p>)}
              {/* End to end, straight after "That's still how I work…": the story's conclusion (Liam, 2026-10-12), the three case studies' loops under it */}
              <div className="ab-slide ab-lead">
                <p className="ab-big"><Words line={ABOUT.opening.text} /></p>
                <div className="ab-strip" data-pendant="strip">
                  {ABOUT.pictures.strip.map((s) => {
                    // (every strip picture leads to its case study: a missing link is a content mistake, not a link to "/")
                    if (!s.href) throw new Error(`about strip picture "${s.id}" has no href`);
                    return <Link key={s.id} href={s.href} className="ab-strip-link"><Pic p={s} decor /></Link>;
                  })}
                </div>
              </div>
              {ABOUT.quotes.map((q, i) => (
                <Fragment key={q.name}>
                  {/* between the two quotes, an empty slot the glass pendant passes through (the shader's, not a picture) */}
                  {i === 1 && <div className="ab-slide ab-glass" data-pendant="glass" aria-hidden="true" />}
                  <figure className="ab-slide ab-quote">
                    <blockquote><Words line={q.text} /></blockquote>
                    <figcaption className="ab-mono">{q.name} · {q.role}</figcaption>
                  </figure>
                </Fragment>
              ))}
              {ABOUT.verbs.map((v, i) => (
                <div key={v.title} className={`ab-slide ab-verb${i === ABOUT.verbs.length - 1 ? " ab-verbrow" : ""}`}>
                  <div className="ab-verb-body">
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
                  {/* "Build it.": the desk film, wire to final, right of its skills */}
                  {i === ABOUT.verbs.length - 1 && <Pic p={ABOUT.pictures.desk} className="ab-deskvid" anchor="deskfilm" />}
                </div>
              ))}
              <p className="ab-slide ab-big"><Words line={ABOUT.closing} /></p>
            </div>
          </div>
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
