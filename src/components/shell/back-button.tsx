"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { STORY_HREF } from "@/lib/story";
import { bindLight } from "./nav-light";
import "./nav.css";

/** Back to the projects index (Liam, 2026-10-11), lit like the nav's pills and coloured with them (nav.css). */
export function BackButton({ slug }: { slug: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => (ref.current ? bindLight(ref.current) : undefined), []);
  return (
    <Link
      ref={ref}
      href={`${STORY_HREF}#projects`}
      data-light=""
      data-nav-chrome=""
      data-from={slug}
      aria-label="Back to projects"
      // level with the pills, mirrored from the left edge (as on the boards)
      className="sh-back sh-enter fixed left-[4.9vw] top-[clamp(12px,3.6vw,48px)] z-50"
      style={{ "--i": 0 } as React.CSSProperties}
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="m15 18-6-6 6-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}
