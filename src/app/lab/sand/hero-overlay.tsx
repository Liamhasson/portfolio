"use client";

/**
 * The hero's front layer, on Lusion's about-page system (measured 2026-10-09: Aeonik 400 everywhere, display ~4vw at
 * line-height 1.15, the scroll cue ~1.75vw bottom right on desktop and centred ~4vw on phones, 4.9% side margins).
 * Ours in Geist. Lines rise in from a mask, staggered (approved). Copy from the production plan §5.1.
 */
import { useEffect, useRef } from "react";

const RISE = "hero-rise";

/**
 * The copy holds through the hero, then travels out to the left, line by line, as the pull-back begins; the next
 * chapter's line enters from the right (Lusion's horizontal travel; Liam, 2026-10-09).
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

function exitT(e: number, i: number): number {
  const t = Math.min(Math.max((e - i * STAGGER) / (1 - 2 * STAGGER), 0), 1);
  return t * t * (3 - 2 * t);
}

/**
 * `exit`: 0 holding .. 1 gone (staggered per line). `scrolled`: 0 at the top .. (the scroll cue fades once it moves).
 * `enter`: the next chapter's line, 0 off to the right .. 1 in place.
 */
export function HeroOverlay({
  exit, scrolled, enter, leave, enter2,
}: { exit: () => number; scrolled: () => number; enter?: () => number; leave?: () => number; enter2?: () => number }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const e = exit();
      const el = root.current;
      if (el) {
        el.querySelectorAll<HTMLElement>("[data-exit]").forEach((line) => {
          const t = exitT(e, Number(line.dataset.exit));
          line.style.transform = t > 0 ? `translate3d(${-t * 55}vw,0,0)` : "";
          line.style.opacity = String(1 - t);
        });
        const cue = el.querySelector<HTMLElement>("[data-cue]");
        if (cue) cue.style.opacity = String(1 - Math.min(scrolled() / 0.03, 1));   // its job is done once scrolling starts
        // chapter lines: each enters from the right, holds, and travels out left as the next arrives
        const travel = (node: HTMLElement | null, inT: number, outT: number) => {
          if (!node) return;
          const a = Math.min(Math.max(inT, 0), 1), b = Math.min(Math.max(outT, 0), 1);
          const ti = 1 - Math.pow(1 - a, 3), to = b * b * (3 - 2 * b);
          node.style.transform = `translate3d(${(1 - ti) * 55 - to * 55}vw,0,0)`;
          node.style.opacity = String(a * (1 - to));
        };
        if (enter) travel(el.querySelector<HTMLElement>("[data-enter]"), enter(), leave ? leave() : 0);
        if (enter2) travel(el.querySelector<HTMLElement>("[data-enter2]"), enter2(), 0);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [exit, scrolled, enter, leave, enter2]);

  return (
    <div ref={root} className="pointer-events-none fixed inset-0 z-10 text-[#f4efe9]" data-testid="hero-overlay">
      <style>{`
        @keyframes ${RISE} { from { transform: translateY(105%); opacity: 0; } to { transform: none; opacity: 1; } }
        .${RISE} { animation: ${RISE} 1.1s cubic-bezier(0.22, 1, 0.36, 1) both; }
        @media (prefers-reduced-motion: reduce) { .${RISE} { animation: none; } }
      `}</style>
      {/* desktop: top left, as Lusion's logo position (on phones it sits above the name, the menu needs the top) */}
      <div data-exit="0" className="absolute left-[4.9vw] top-[clamp(20px,4.4vw,64px)] hidden font-mono text-[12px] uppercase tracking-[0.08em] text-white/60 md:block">
        <Line delay={200}>Product Designer</Line>
      </div>
      {/* the front name and the line, lower left over the void's edge */}
      <div className="absolute bottom-[96px] left-[4.9vw] max-w-[min(92vw,44rem)] md:bottom-[clamp(96px,11vw,150px)]">
        {/* legibility: the sand thins out behind the copy, a soft falloff, never a box */}
        <div
          aria-hidden
          data-exit="0"
          className="absolute -bottom-[30%] -left-[12vw] -right-[18%] -top-[45%] -z-10"
          style={{ background: "radial-gradient(ellipse 60% 55% at 35% 55%, rgba(0,0,0,0.72), rgba(0,0,0,0.45) 45%, transparent 75%)" }}
        />
        <div data-exit="0" className="mb-4 font-mono text-[11px] uppercase tracking-[0.08em] text-white/60 md:hidden">
          <Line delay={200}>Product Designer</Line>
        </div>
        <h1 data-exit="0" className="text-[clamp(40px,7.2vw,104px)] font-normal leading-[1.02] tracking-[-0.02em]">
          <Line delay={350}>Hi, I&rsquo;m Liam.</Line>
        </h1>
        <p className="mt-[0.9em] text-[clamp(17px,1.75vw,25px)] font-normal leading-[1.3] text-white/80">
          <span data-exit="1" className="block">
            <Line delay={520}>
              I build <em className="italic text-white">ambiguous ideas</em> into products
            </Line>
          </span>
          <span data-exit="2" className="block">
            <Line delay={620}>where design and user needs meet.</Line>
          </span>
        </p>
      </div>
      {/* 2.1: the next chapter's line, entering from the right over the dark room above the desk */}
      {enter && (
        // over the void strip at the top (the three-quarter view leaves only that much empty): one line on desktop,
        // two below the menu on phones. A soft text shadow for legibility, never a shape over the desk.
        <h2
          data-enter
          className="absolute left-[4.9vw] right-[4.9vw] top-[clamp(76px,11vh,120px)] text-[clamp(28px,3.5vw,54px)] font-normal leading-[1.08] tracking-[-0.015em] opacity-0 md:right-auto md:top-[clamp(28px,6vh,64px)]"
          style={{ textShadow: "0 1px 24px rgba(0,0,0,0.55)" }}
        >
          I look for problems <em className="italic">nobody</em> pointed at.
        </h2>
      )}
      {enter2 && (
        <h2
          data-enter2
          className="absolute left-[4.9vw] right-[4.9vw] top-[clamp(76px,11vh,120px)] text-[clamp(28px,3.5vw,54px)] font-normal leading-[1.08] tracking-[-0.015em] opacity-0 md:right-auto md:top-[clamp(28px,6vh,64px)]"
          style={{ textShadow: "0 1px 24px rgba(0,0,0,0.55)" }}
        >
          Then I <em className="italic">test</em> solutions.
        </h2>
      )}
      {/* the scroll cue: bottom right on desktop, centred on phones */}
      <div data-cue className="absolute bottom-[clamp(20px,3vw,44px)] left-0 right-0 text-center text-[clamp(13px,4vw,16px)] uppercase md:left-auto md:right-[4.9vw] md:text-right md:text-[clamp(14px,1.75vw,25px)]">
        <Line delay={800}>Scroll to explore</Line>
      </div>
    </div>
  );
}
