"use client";

import { useEffect, type ReactNode } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { registerScroller, shouldUseSmoothScroll } from "@/lib/smooth-scroll";

gsap.registerPlugin(ScrollTrigger);

export function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (!shouldUseSmoothScroll((q) => window.matchMedia(q).matches)) return;
    // (inside an iframe, the band site in the Marni Came study: Lenis would swallow the wheel and the page behind it
    // could not scroll on; the browser's own scroll hands off at the frame's end)
    if (window.parent !== window) return;

    // anchors (the pill nav): a fixed 1.5 s, so Projects from the hero plays the story through in fast-forward (spec 2026-10-11 §6)
    const lenis = new Lenis({ lerp: 0.1, anchors: { duration: 1.5 }, stopInertiaOnNavigate: true });
    lenis.on("scroll", ScrollTrigger.update);
    // (the story's snap into the screen carries the page through it: src/app/lab/sand/sand-lab.tsx)
    const unregister = registerScroller(lenis);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      // Restore GSAP's documented defaults (lagSmoothing is global).
      gsap.ticker.lagSmoothing(500, 33);
      unregister();
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
