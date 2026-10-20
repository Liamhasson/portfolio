"use client";

import Link from "next/link";
import { isBandSite } from "@/lib/site";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { NAME, letterRoll, nameRoll } from "@/lib/name-roll";
import { glideTo } from "@/lib/smooth-scroll";
import { STORY_HREF, STORY_PATH } from "@/lib/story";
import "./nav.css";

/**
 * The name, top left on every page, part of the nav (Liam, 2026-10-12): on the story "PRODUCT DESIGNER" until the hero's
 * line leaves, rolling over letter by letter into "LIAM HASSON" (src/lib/name-roll.ts); everywhere else already rolled.
 * It leads to the hero: on the story a glide back to the top, elsewhere the story page.
 */
export function NavName() {
  const pathname = usePathname();
  const isStory = pathname === STORY_PATH;
  const ref = useRef<HTMLAnchorElement>(null);
  const n = Math.max(NAME.from.length, NAME.to.length);
  useEffect(() => {
    const apply = (k: number) => ref.current?.querySelectorAll<HTMLElement>("[data-roll]").forEach((el, i) => {
      const r = letterRoll(k, i, n);
      el.style.transform = `translateY(${r === 0 ? 0 : -50 * r}%)`;
    });
    if (!isStory) { apply(1); return; }
    apply(nameRoll.get());
    return nameRoll.subscribe(apply);
  }, [isStory, n]);
  const slots = Array.from({ length: n }, (_, i) => [NAME.from[i] ?? " ", NAME.to[i] ?? " "]);
  const nb = (c: string) => (c === " " ? " " : c);
  const inner = (
    <>
      <span className="sr-only">Liam Hasson</span>
      <span aria-hidden className="nm-letters">
        {slots.map(([a, b], i) => (
          <span key={i} className="nm-slot"><span data-roll="" className="nm-pair"><span>{nb(a)}</span><span>{nb(b)}</span></span></span>
        ))}
      </span>
    </>
  );
  const props = {
    ref, "aria-label": "Liam Hasson, back to the start", "data-nav-chrome": "",
    // level with the pills (pill-nav.tsx), mirrored from the left edge
    className: "sh-name sh-enter fixed left-[4.9vw] top-[clamp(12px,3.6vw,48px)] z-50",
    style: { "--i": 0 } as React.CSSProperties,
  };
  if (isBandSite(pathname)) return null;
  return isStory ? (
    <a href={STORY_HREF} {...props} onClick={(e) => {
      e.preventDefault();
      glideTo(0, 1.4, () => {}, window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    }}>{inner}</a>
  ) : (
    <Link href={STORY_HREF} {...props}>{inner}</Link>
  );
}
