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

export function PillNav() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const activeSection = useActiveSection(SECTION_IDS, pathname);
  const active = isHome ? activeSection : null;
  const { scrollYProgress } = useScroll();

  return (
    <motion.nav
      aria-label="Primary"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: dur.ui, ease: ease.settle }}
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
    >
      <div className="relative flex gap-2 rounded-full p-1">
        {!isHome && (
          <motion.span
            data-testid="reading-progress"
            aria-hidden
            className="absolute inset-x-4 -top-2 h-0.5 origin-left rounded-full bg-rose"
            style={{ scaleX: scrollYProgress }}
          />
        )}
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
