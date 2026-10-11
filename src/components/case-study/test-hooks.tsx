"use client";
import { useEffect } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

declare global {
  interface Window { __csScrollTriggers?: () => (string | null)[] }
}

/** For the e2e suite: which page each live ScrollTrigger belongs to (Part C plan, Review Focus 1). */
export function CaseStudyTestHooks() {
  useEffect(() => {
    window.__csScrollTriggers = () =>
      ScrollTrigger.getAll().map((t) => (t.trigger as Element | undefined)?.closest("[data-world]")?.getAttribute("data-world") ?? null);
  }, []);
  return null;
}
