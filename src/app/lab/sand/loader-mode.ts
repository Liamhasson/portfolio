// src/app/lab/sand/loader-mode.ts
/**
 * When the loader plays (spec 2026-10-12-loader-design.md §3): once per session, on arrival at the hero; later arrivals
 * and deep links past the hero get a short fade from black; reduced motion: the brief grows, then a crossfade.
 */
import { holdScroll } from "@/lib/smooth-scroll";

export type LoaderMode = "play" | "reduced" | "fade";
export const SEEN_KEY = "liam.loader.seen";
const DEEP = ["#projects", "#about", "#contact"];

export function loaderMode({ seen, hash, reduced }: { seen: boolean; hash: string; reduced: boolean }): LoaderMode {
  if (seen || DEEP.includes(hash)) return "fade";
  return reduced ? "reduced" : "play";
}

export function readSeen(s: Pick<Storage, "getItem"> | null): boolean {
  try { return s?.getItem(SEEN_KEY) === "1"; } catch { return false; }
}

export function markSeen(s: Pick<Storage, "setItem"> | null): void {
  try { s?.setItem(SEEN_KEY, "1"); } catch { /* storage unavailable: it plays again next time */ }
}

/** Runs inline before first paint (page.tsx): the nav and copy stay hidden, and scrolling locked, from the first frame. */
export const LOADER_BOOT = `(function(){try{var s=null;try{s=window.sessionStorage}catch(e){}var seen=false;try{seen=!!s&&s.getItem(${JSON.stringify(SEEN_KEY)})==="1"}catch(e){}var h=location.hash;var deep=${JSON.stringify(DEEP)}.indexOf(h)>=0;var r=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;document.documentElement.dataset.loader=(seen||deep)?"fade":(r?"reduced":"play")}catch(e){}})();`;

/** The loader is done (or failed): the nav and copy are shown, and scrolling is free. */
export function releaseHold(): void {
  delete document.documentElement.dataset.loader;
  holdScroll(false);
}

/** The copy and nav arrive (the loader's 2.8 s), scrolling still held until the release. */
export function showCopy(): void {
  if (document.documentElement.dataset.loader) document.documentElement.dataset.loader = "arriving";
}
