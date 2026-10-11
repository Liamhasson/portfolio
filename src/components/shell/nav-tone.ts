"use client";
import { useEffect } from "react";

/* The nav matches what's behind it (Liam, 2026-10-11): it reads the background right under itself as the page scrolls,
   and sets html[data-nav-tone] ("light" over a light ground, "dark" over a dark one) and the two colours it draws with:
   --nav-ink (the dark one) and --nav-canvas (the light one). Inside a case study they are that study's own
   (--nav-ink / --nav-canvas on its [data-world]); elsewhere the site's (nav.css :root). Checked at most once a frame. */

const parse = (c: string) => {
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const [r, g, b, a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  return { r, g, b, a };
};
const luminance = ({ r, g, b }: { r: number; g: number; b: number }) => {
  const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

/** The first painted background under a point, skipping the nav itself. */
function groundAt(x: number, y: number): { color: { r: number; g: number; b: number }; el: Element } | null {
  for (const el of document.elementsFromPoint(x, y)) {
    if (el.closest("[data-nav-chrome]")) continue;
    const c = parse(getComputedStyle(el).backgroundColor);
    if (c && c.a > 0.5) return { color: c, el };
  }
  const body = parse(getComputedStyle(document.body).backgroundColor);
  return body ? { color: body, el: document.body } : null;
}

export function useNavTone(nav: React.RefObject<HTMLElement | null>, resetKey: string) {
  useEffect(() => {
    const root = document.documentElement;
    let raf = 0;
    const check = () => {
      raf = 0;
      const el = nav.current;
      if (!el || typeof document.elementsFromPoint !== "function") return;
      const r = el.getBoundingClientRect();
      // just left of the pills, at their middle: what the nav sits on
      const ground = groundAt(Math.max(0, r.left - 6), r.top + r.height / 2);
      if (!ground) return;
      const tone = luminance(ground.color) > 0.4 ? "light" : "dark";
      if (root.dataset.navTone !== tone) root.dataset.navTone = tone;
      const world = ground.el.closest<HTMLElement>("[data-world]");
      const css = world ? getComputedStyle(world) : null;
      const ink = css?.getPropertyValue("--nav-ink").trim(), canvas = css?.getPropertyValue("--nav-canvas").trim();
      if (ink && canvas) { root.style.setProperty("--nav-ink", ink); root.style.setProperty("--nav-canvas", canvas); }
      else { root.style.removeProperty("--nav-ink"); root.style.removeProperty("--nav-canvas"); }
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(check); };
    schedule();
    // and again once the page has painted its worlds and fonts
    const late = setTimeout(schedule, 120);
    void document.fonts?.ready.then(schedule);
    addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(late);
      removeEventListener("scroll", schedule);
      removeEventListener("resize", schedule);
    };
  }, [nav, resetKey]);
}
