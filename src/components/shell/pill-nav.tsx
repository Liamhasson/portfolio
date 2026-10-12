"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useActiveSection } from "@/hooks/use-active-section";
import { STORY_HREF, STORY_PATH } from "@/lib/story";
import { bindLight } from "./nav-light";
import { useNavTone } from "./nav-tone";
import "./nav.css";

const ITEMS = [
  { id: "projects", label: "Projects" },
  { id: "about", label: "About" },
  { id: "contact", label: "Contact" },
] as const;

const SECTION_IDS = ["projects"] as const;   // (the story's one in-page section)

/** The site nav, as on the case-study boards: light under the pointer, one filled pill that slides to the active page,
    colours matched to what it sits on (nav-tone.ts). */
export function PillNav() {
  const pathname = usePathname();
  // the story is home (spec 2026-10-11 §6): its sections are in-page anchors there; elsewhere the pills lead into it
  const isHome = pathname === STORY_PATH;
  const activeSection = useActiveSection(SECTION_IDS, pathname);
  // About and Contact are pages (spec 2026-10-12-about-contact-design.md §5); a case study sits under Projects; on the
  // story, the index lights Projects
  const page = pathname === "/about" ? "about" : pathname === "/contact" ? "contact" : null;
  const active = page ?? (isHome ? activeSection : "projects");
  const navRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useNavTone(navRef, pathname);

  // the light on every pill
  useEffect(() => {
    const pills = [...(listRef.current?.querySelectorAll<HTMLElement>("[data-light]") ?? [])];
    const offs = pills.map(bindLight);
    return () => offs.forEach((off) => off());
  }, []);

  // the filled pill slides to the active one (snaps into place on first show, on resize and under reduced motion)
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const hl = list.querySelector<HTMLElement>(".hl")!;
    const [l, m, r] = [...hl.children] as HTMLElement[];
    const reduce = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const place = (snap: boolean) => {
      const pill = list.querySelector<HTMLElement>(".sh-pill.is-active");
      if (!pill) { hl.classList.remove("on"); return; }
      const x = pill.offsetLeft, w = pill.offsetWidth, rad = pill.offsetHeight / 2;
      if (snap || reduce || !hl.classList.contains("on")) hl.classList.add("snap");
      l.style.transform = `translateX(${x}px)`;
      m.style.transform = `translateX(${x + rad - 0.5}px) scaleX(${w - 2 * rad + 1})`;
      r.style.transform = `translateX(${x + w - rad}px)`;
      hl.classList.add("on");
      if (hl.classList.contains("snap")) requestAnimationFrame(() => requestAnimationFrame(() => hl.classList.remove("snap")));
    };
    place(false);
    let raf = 0;
    const onResize = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => place(true)); };
    void document.fonts?.ready.then(() => place(true));
    addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", onResize); };
  }, [active]);

  return (
    <nav
      ref={navRef}
      aria-label="Primary"
      data-nav-chrome=""
      // top right, as on lusion.co (Liam, 2026-10-09); aligned with the hero's top-left label
      className="fixed right-[4.9vw] top-[clamp(12px,3.6vw,48px)] z-50"
    >
      <div ref={listRef} className="sh-nav">
        <span className="hl" aria-hidden="true"><i /><i /><i /></span>
        {ITEMS.map((item, k) => {
          const isActive = active === item.id;
          const cls = `sh-pill sh-enter${isActive ? " is-active" : ""}`;
          const style = { "--i": k + 1 } as React.CSSProperties;
          const isPage = item.id !== "projects";
          const href = isPage ? `/${item.id}` : isHome ? "#projects" : `${STORY_HREF}#projects`;
          const current = isActive ? (isHome && !isPage ? "location" : "page") : undefined;
          // On home, Projects is a plain anchor so Lenis owns the smooth scroll (no router scrollIntoView fight).
          return isHome && !isPage ? (
            <a key={item.id} href={href} data-light="" aria-current={current} className={cls} style={style}>{item.label}</a>
          ) : (
            <Link key={item.id} href={href} data-light="" aria-current={current} className={cls} style={style}>{item.label}</Link>
          );
        })}
      </div>
    </nav>
  );
}
