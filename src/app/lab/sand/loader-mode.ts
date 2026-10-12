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

/** Runs inline before first paint (page.tsx): the nav and copy stay hidden, and scrolling locked, from the first frame.
 *  Its safety net: if the story never starts (its code failed to load), the page is released after 20 s. */
export const LOADER_BOOT = `(function(){try{var deep=${JSON.stringify(DEEP)}.indexOf(location.hash)>=0;var replay=new URLSearchParams(location.search).has("loader");var r=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;var m=(!replay&&deep)?"fade":(r?"reduced":"play");window.__loaderMode=m;document.documentElement.dataset.loader=m;setTimeout(function(){if(!window.__storyMounted)delete document.documentElement.dataset.loader},20000)}catch(e){}})();`;

/**
 * The mode the boot script chose, read once by the story. Kept in a value React can't touch: a browser extension that
 * edits the page (Liam's QuillBot, 2026-10-12) makes hydration fail, and React's re-render resets <html>'s attributes,
 * wiping data-loader before the story mounts. Re-applies the hold if it was wiped; used up, so a later client-side arrival
 * (no boot script) reads none.
 */
export function readLoaderMode(): LoaderMode | "none" {
  const w = window as unknown as { __loaderMode?: LoaderMode };
  const mode = w.__loaderMode ?? (document.documentElement.dataset.loader as LoaderMode | undefined) ?? "none";
  delete w.__loaderMode;
  if (mode === "play" || mode === "reduced") document.documentElement.dataset.loader = mode;
  return mode;
}

/** The loader is done (or failed): the nav and copy are shown, and scrolling is free. */
export function releaseHold(): void {
  delete document.documentElement.dataset.loader;
  holdScroll(false);
}

/** The copy and nav arrive (the loader's 2.8 s), scrolling still held until the release. */
export function showCopy(): void {
  if (document.documentElement.dataset.loader) document.documentElement.dataset.loader = "arriving";
}
