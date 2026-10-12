"use client";

/**
 * The hero's front layer, on Lusion's about-page system (measured 2026-10-09: Aeonik 400 everywhere, display ~4vw at
 * line-height 1.15, the scroll cue ~1.75vw bottom right on desktop and centred ~4vw on phones, 4.9% side margins).
 * Ours in Geist. Lines rise in from a mask, staggered (approved). Copy from the production plan §5.1.
 */
import { useEffect, useRef } from "react";
import { nameRoll } from "@/lib/name-roll";

const RISE = "hero-rise";

/**
 * The copy is on screen from the first frame and drifts up and out, line by line, as the cloud becomes the ball. No text
 * over the desk (Liam, 2026-10-11: the headline there is gone).
 */
const STAGGER = 0.15;

function Line({ children, delay, className = "" }: { children: React.ReactNode; delay: number; className?: string }) {
  return (
    <span className="block overflow-hidden pb-[0.12em]">
      <span className={`${RISE} block ${className}`} style={{ animationDelay: `${delay}ms` }}>
        {children}
      </span>
    </span>
  );
}

/** The hero copy leaving as the cloud becomes the ball (Liam, 2026-10-11): line by line, a slow upward drift and fade. */
export function driftOut(e: number, i: number): { y: number; opacity: number } {
  const t0 = Math.min(Math.max((e - i * STAGGER) / (1 - 2 * STAGGER), 0), 1);
  const t = t0 * t0 * (3 - 2 * t0);
  return { y: t === 0 ? 0 : -t * 9, opacity: 1 - t };
}

/** A line of the hero copy: on screen from the first frame (no rise; Liam, 2026-10-11). */
function Still({ children }: { children: React.ReactNode }) {
  return <span className="block pb-[0.12em]">{children}</span>;
}

/**
 * `exit`: 0 holding .. 1 gone (staggered per line). `scrolled`: 0 at the top .. (the scroll cue fades once it moves).
 */
export function HeroOverlay({ exit, scrolled }: { exit: () => number; scrolled: () => number }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const e = exit();
      // the name in the nav rolls over into LIAM HASSON as "Hi, I'm Liam." leaves (nav-name.tsx; Liam, 2026-10-12)
      nameRoll.set(1 - driftOut(e, 0).opacity);
      const el = root.current;
      if (el) {
        el.querySelectorAll<HTMLElement>("[data-exit]").forEach((line) => {
          const { y, opacity } = driftOut(e, Number(line.dataset.exit));
          line.style.transform = y !== 0 ? `translate3d(0,${y}vh,0)` : "";
          line.style.opacity = String(opacity);
        });
        const cue = el.querySelector<HTMLElement>("[data-cue]");
        if (cue) cue.style.opacity = String(1 - Math.min(scrolled() / 0.03, 1));   // its job is done once scrolling starts
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [exit, scrolled]);

  return (
    <div ref={root} className="pointer-events-none fixed inset-0 z-10 text-[#f4efe9]" data-testid="hero-overlay">
      <style>{`
        @keyframes ${RISE} { from { transform: translateY(105%); opacity: 0; } to { transform: none; opacity: 1; } }
        .${RISE} { animation: ${RISE} 1.1s cubic-bezier(0.22, 1, 0.36, 1) both; }
        @media (prefers-reduced-motion: reduce) { .${RISE} { animation: none; } }
      `}</style>
      {/* the front name and the line, lower left over the void's edge */}
      <div className="absolute bottom-[96px] left-[4.9vw] max-w-[min(92vw,44rem)] md:bottom-[clamp(96px,11vw,150px)]">
        {/* legibility: the sand thins out behind the copy, a soft falloff, never a box; in the graded black (#0b0908),
            never darker than the background (it sits above the grade) */}
        <div
          aria-hidden
          data-exit="0"
          className="absolute -bottom-[30%] -left-[12vw] -right-[18%] -top-[45%] -z-10"
          style={{ background: "radial-gradient(ellipse 60% 55% at 35% 55%, rgba(11,9,8,0.72), rgba(11,9,8,0.45) 45%, transparent 75%)" }}
        />
        <h1 data-exit="0" className="text-[clamp(40px,7.2vw,104px)] font-normal leading-[1.02] tracking-[-0.02em]">
          <Still>Hi, I&rsquo;m Liam.</Still>
        </h1>
        <p className="mt-[0.9em] text-[clamp(17px,1.75vw,25px)] font-normal leading-[1.3] text-white/80">
          <span data-exit="1" className="block">
            <Still>I build ambiguous ideas into products</Still>
          </span>
          <span data-exit="2" className="block">
            <Still>where design and user needs meet.</Still>
          </span>
        </p>
      </div>
      {/* the scroll cue: bottom right on desktop, centred on phones */}
      <div data-cue className="absolute bottom-[clamp(20px,3vw,44px)] left-0 right-0 text-center text-[clamp(13px,4vw,16px)] uppercase md:left-auto md:right-[4.9vw] md:text-right md:text-[clamp(14px,1.75vw,25px)]">
        <Line delay={800}>Scroll to explore</Line>
      </div>
    </div>
  );
}
