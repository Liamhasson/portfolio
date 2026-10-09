"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useScroll } from "motion/react";
import { useActiveSection } from "@/hooks/use-active-section";
import { dur, ease } from "@/lib/motion";

const ITEMS = [
  { id: "projects", label: "Projects" },
  { id: "about", label: "About" },
  { id: "contact", label: "Contact" },
] as const;

const SECTION_IDS = ITEMS.map((i) => i.id);

const PILL =
  "relative flex min-h-11 items-center rounded-full border border-rose bg-surface-2/80 px-5 text-xs text-ink backdrop-blur-sm transition-colors duration-(--duration-micro) hover:bg-rose/30";

function ReadingProgress() {
  const { scrollYProgress } = useScroll();
  return (
    <motion.span
      data-testid="reading-progress"
      aria-hidden
      className="absolute inset-x-4 -bottom-2 h-0.5 origin-left rounded-full bg-rose"
      style={{ scaleX: scrollYProgress }}
    />
  );
}

export function PillNav() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const activeSection = useActiveSection(SECTION_IDS, pathname);
  const active = isHome ? activeSection : null;

  return (
    <motion.nav
      aria-label="Primary"
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: dur.ui, ease: ease.settle }}
      // top right, as on lusion.co (Liam, 2026-10-09); aligned with the hero's top-left label
      className="fixed right-[4.9vw] top-[clamp(12px,3.6vw,48px)] z-50"
    >
      <div className="relative flex gap-2 rounded-full p-1">
        {!isHome && <ReadingProgress />}
        {ITEMS.map((item) => {
          const isActive = active === item.id;
          const href = `/#${item.id}`;
          const content = (
            <>
              {isActive && (
                <motion.span
                  layoutId="pill-active"
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-rose/45"
                  transition={{ duration: dur.ui, ease: ease.settle }}
                />
              )}
              <span className="relative">{item.label}</span>
            </>
          );
          // On home, a plain anchor lets Lenis own the smooth scroll (no router scrollIntoView fight).
          // Different element types per branch, so links remount when crossing home ↔ case study; Next restores focus on navigation.
          return isHome ? (
            <a key={item.id} href={href} aria-current={isActive ? "location" : undefined} className={PILL}>
              {content}
            </a>
          ) : (
            <Link key={item.id} href={href} className={PILL}>
              {content}
            </Link>
          );
        })}
      </div>
    </motion.nav>
  );
}
