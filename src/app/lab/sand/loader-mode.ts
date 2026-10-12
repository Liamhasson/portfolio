// src/app/lab/sand/loader-mode.ts
/**
 * When the loader plays (spec 2026-10-12-loader-design.md §3; Liam, 2026-10-12: every fresh page load): on every full load
 * of the hero (a client-side navigation into the story, Back or Projects from a case study, doesn't run the boot script
 * and arrives with a fade); deep links past the hero get the fade too; reduced motion: the brief grows, then a crossfade.
 * ?loader plays it even on a deep link.
 */
import { holdScroll } from "@/lib/smooth-scroll";

export type LoaderMode = "play" | "reduced" | "fade";
const DEEP = ["#projects", "#about", "#contact"];

export function loaderMode({ hash, reduced, replay = false }: { hash: string; reduced: boolean; replay?: boolean }): LoaderMode {
  if (!replay && DEEP.includes(hash)) return "fade";
  return reduced ? "reduced" : "play";
}

/** Runs inline before first paint (page.tsx): the nav and copy stay hidden, and scrolling locked, from the first frame. */
export const LOADER_BOOT = `(function(){try{var deep=${JSON.stringify(DEEP)}.indexOf(location.hash)>=0;var replay=new URLSearchParams(location.search).has("loader");var r=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;document.documentElement.dataset.loader=(!replay&&deep)?"fade":(r?"reduced":"play")}catch(e){}})();`;

/** The loader is done (or failed): the nav and copy are shown, and scrolling is free. */
export function releaseHold(): void {
  delete document.documentElement.dataset.loader;
  holdScroll(false);
}

/** The copy and nav arrive (the loader's 2.8 s), scrolling still held until the release. */
export function showCopy(): void {
  if (document.documentElement.dataset.loader) document.documentElement.dataset.loader = "arriving";
}
