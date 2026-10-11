"use client";
import { useEffect, useRef } from "react";

/** Board videos: muted loops that fetch only when near the screen and play only while on it. Reduced motion: poster. */
export function LazyVideo({ src, poster, label, className, loop = true }: { src: string; poster: string; label: string; className?: string; loop?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const near = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      v.preload = "metadata";
      if (!v.getAttribute("src")) v.src = src;
      near.disconnect();
    }, { rootMargin: "150% 0px" });
    const seen = new IntersectionObserver(([e]) => { if (e.isIntersecting) void v.play().catch(() => {}); else v.pause(); }, { threshold: 0.25 });
    near.observe(v);
    seen.observe(v);
    return () => { near.disconnect(); seen.disconnect(); v.pause(); };
  }, [src]);
  return <video ref={ref} className={className} poster={poster} muted playsInline loop={loop} preload="none" aria-label={label} />;
}
