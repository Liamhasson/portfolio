"use client";
import { useEffect, useRef } from "react";

/** Board videos: muted loops that fetch only when near the screen and play only while on it. Reduced motion: poster. */
/** `ahead`: how far below the screen a video starts loading (a big one right under the first view loads later, so the
 *  first view stays in its budget). */
export function LazyVideo({ src, poster, label, className, loop = true, ahead = "150%" }: { src: string; poster: string; label: string; className?: string; loop?: boolean; ahead?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    // Whichever fires first loads it: near the screen (ahead of time) or on screen (a jump straight to it). Playing
    // always follows loading, so a video is never asked to play before it has a source.
    let visible = false;
    const load = () => {
      if (v.getAttribute("src")) return;
      v.preload = "metadata";
      v.src = src;
    };
    const play = () => { load(); void v.play().catch(() => {}); };
    const near = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      load();
      if (visible) play();
      near.disconnect();
    }, { rootMargin: `${ahead} 0px` });
    // On screen is judged by the box the video sits in: a cropped recording is far bigger than what shows of it.
    const box = v.parentElement ?? v;
    const seen = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) play();
      else v.pause();
    }, { threshold: 0.25 });
    near.observe(v);
    seen.observe(box);
    return () => { near.disconnect(); seen.disconnect(); v.pause(); };
  }, [src, ahead]);
  return <video ref={ref} className={className} poster={poster} muted playsInline loop={loop} preload="none" aria-label={label} data-src={src} />;
}
