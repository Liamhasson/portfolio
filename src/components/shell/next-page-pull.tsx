// src/components/shell/next-page-pull.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { PULL, pullDone, pullStart, pullStep } from "@/lib/pull";
import "./next-page-pull.css";

/** After the pull opens the next page, the rest of that gesture is kept off it, so the new page opens at its top instead
 *  of already scrolled into. Lives on the window: it outlasts this component, which the next page replaces.
 *  - a wheel (the trackpad's momentum): swallowed until it ends (a pause longer than PULL.gap). Capturing, so it runs
 *    before the smooth scroller.
 *  - a finger: a touch scroll under way can't be cancelled (the browser ignores it), and its fling would carry the new
 *    page ~250px down (Liam, 2026-10-13). So scrolling itself stops (the root's overflow hidden: no fling starts or
 *    carries on) until the finger lifts and a moment after, then the new page is set at its top. The lift is heard on
 *    the element the finger came down on (`from`): its touches stay with it after the next page has replaced it, and
 *    no longer reach the window. */
let holding = false;
function holdRestOfGesture(from: EventTarget | null): void {
  if (from) {
    if (holding) return;
    holding = true;
    const root = document.documentElement;
    const was = root.style.overflow;
    root.style.overflow = "hidden";
    let held = true, settle = 0;
    const release = () => {
      if (!held) return;
      held = false;
      holding = false;
      clearTimeout(settle);
      clearTimeout(cap);
      for (const t of [window, from]) {
        t.removeEventListener("touchend", lifted as EventListener, true);
        t.removeEventListener("touchcancel", lifted as EventListener, true);
      }
      root.style.overflow = was;
      if (window.scrollY > 0) window.scrollTo(0, 0);
    };
    const lifted = (e: TouchEvent) => {
      if (e.touches.length) return;
      clearTimeout(settle);
      settle = window.setTimeout(release, 150);
    };
    for (const t of [window, from]) {
      t.addEventListener("touchend", lifted as EventListener, true);
      t.addEventListener("touchcancel", lifted as EventListener, true);
    }
    const cap = window.setTimeout(release, 2000);   // (a finger held down: never locked longer)
    return;
  }
  let last = performance.now() / 1000;
  const off = () => window.removeEventListener("wheel", stop, true);
  const stop = (e: Event) => {
    const t = performance.now() / 1000;
    if (t - last > PULL.gap || t < last) { off(); return; }
    last = t;
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  window.addEventListener("wheel", stop, { capture: true, passive: false });
  setTimeout(off, 2000);   // (never longer than any momentum)
}

/**
 * The end of a page (spec 2026-10-12-about-contact-design.md §2): the next page peeks in as an ordinary link, and
 * scrolling on past the end fills a thin line across it; when it is full the next page opens (src/lib/pull.ts: only a
 * gesture that starts at the end counts). Arriving back at the end (history) lands just above it, so nothing fires by
 * itself. Reduced motion: the link only.
 */
export function NextPagePull({ href, label, line, className, active = true }: { href: string; label: string; line: string; className?: string; active?: boolean }) {
  const router = useRouter();
  const fillRef = useRef<HTMLSpanElement>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    const atEnd = () => window.scrollY + window.innerHeight >= root.scrollHeight - 2;
    // arriving at the end means a restored position (a fresh page starts at the top): step back above the pull. Now,
    // and again once the router has restored the old position (it does so after the page mounts), unless the reader
    // has already started scrolling
    let touched = false;
    const nudge = () => { if (!touched && window.scrollY > 0 && atEnd()) window.scrollTo(0, window.scrollY - window.innerHeight * 0.25); };
    nudge();
    const later = [setTimeout(nudge, 120), setTimeout(nudge, 400)];
    const stopLater = () => later.forEach(clearTimeout);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return stopLater;
    router.prefetch(href);
    let s = pullStart(), gone = false, touchY: number | null = null, touchFrom: EventTarget | null = null;
    // (not rendered, e.g. the home page's plain-HTML copy while the story runs: it would open the page a second time)
    const shown = () => (linkRef.current?.getClientRects().length ?? 0) > 0;
    const feed = (dy: number, from: EventTarget | null = null) => {
      if (!shown()) return;
      s = pullStep(s, { dy, t: performance.now() / 1000, atEnd: atEnd(), vh: window.innerHeight });
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${s.fill})`;
      if (!gone && pullDone(s)) { gone = true; holdRestOfGesture(from); router.push(href); }
    };
    const onWheel = (e: WheelEvent) => {
      touched = true;
      feed(e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1));
    };
    const onTouchStart = (e: TouchEvent) => { touched = true; touchY = e.touches[0]?.clientY ?? null; touchFrom = e.target; s = { ...s, lastT: -Infinity }; };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      if (touchY === null || y === undefined) return;
      feed(touchY - y, touchFrom ?? window);
      touchY = y;
    };
    // At the end the page holds still while the line fills (Liam, 2026-10-19): no elastic overscroll (iOS Safari drags
    // the whole page up under the finger and springs it back, a trackpad's bounce on a Mac the same). Only at the end, so
    // the top keeps its own behaviour (pull to refresh).
    let still = false;
    const hold = () => {
      const want = atEnd();
      if (want === still) return;
      still = want;
      root.style.overscrollBehaviorY = want ? "none" : "";
      document.body.style.overscrollBehaviorY = want ? "none" : "";
    };
    hold();
    window.addEventListener("scroll", hold, { passive: true });
    window.addEventListener("resize", hold, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      stopLater();
      window.removeEventListener("scroll", hold);
      window.removeEventListener("resize", hold);
      if (still) { root.style.overscrollBehaviorY = ""; document.body.style.overscrollBehaviorY = ""; }
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [active, href, router]);
  return (
    <Link ref={linkRef} href={href} aria-label={`Next: ${label}`} className={`np ${className ?? ""}`}>
      <span className="np-label">{label} →</span>
      <span className="np-line">{line}</span>
      <span className="np-track" aria-hidden><span ref={fillRef} className="np-fill" /></span>
    </Link>
  );
}
