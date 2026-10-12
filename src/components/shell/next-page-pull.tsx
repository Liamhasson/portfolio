// src/components/shell/next-page-pull.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { pullDone, pullStart, pullStep } from "@/lib/pull";
import "./next-page-pull.css";

/**
 * The end of a page (spec 2026-10-12-about-contact-design.md §2): the next page peeks in as an ordinary link, and
 * scrolling on past the end fills a thin line across it; when it is full the next page opens (src/lib/pull.ts: only a
 * gesture that starts at the end counts). Arriving back at the end (history) lands just above it, so nothing fires by
 * itself. Reduced motion: the link only.
 */
export function NextPagePull({ href, label, line, className, active = true }: { href: string; label: string; line: string; className?: string; active?: boolean }) {
  const router = useRouter();
  const fillRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    const atEnd = () => window.scrollY + window.innerHeight >= root.scrollHeight - 2;
    // arriving at the end means a restored position (a fresh page starts at the top): step back above the pull
    if (window.scrollY > 0 && atEnd()) window.scrollTo(0, window.scrollY - window.innerHeight * 0.25);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    router.prefetch(href);
    let s = pullStart(), gone = false, touchY: number | null = null;
    const feed = (dy: number) => {
      s = pullStep(s, { dy, t: performance.now() / 1000, atEnd: atEnd(), vh: window.innerHeight });
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${s.fill})`;
      if (!gone && pullDone(s)) { gone = true; router.push(href); }
    };
    const onWheel = (e: WheelEvent) => feed(e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1));
    const onTouchStart = (e: TouchEvent) => { touchY = e.touches[0]?.clientY ?? null; s = { ...s, lastT: -Infinity }; };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      if (touchY === null || y === undefined) return;
      feed(touchY - y);
      touchY = y;
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [active, href, router]);
  return (
    <Link href={href} aria-label={`Next: ${label}`} className={`np ${className ?? ""}`}>
      <span className="np-label">{label} →</span>
      <span className="np-line">{line}</span>
      <span className="np-track" aria-hidden><span ref={fillRef} className="np-fill" /></span>
    </Link>
  );
}
