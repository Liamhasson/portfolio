"use client";

/**
 * The hero's front layer, on Lusion's about-page system (measured 2026-10-09: Aeonik 400 everywhere, display ~4vw at
 * line-height 1.15, the scroll cue ~1.75vw bottom right on desktop and centred ~4vw on phones, 4.9% side margins).
 * Ours in Geist. Lines rise in from a mask, staggered (approved). Copy from the production plan §5.1.
 */
const RISE = "hero-rise";

function Line({ children, delay, className = "" }: { children: React.ReactNode; delay: number; className?: string }) {
  return (
    <span className="block overflow-hidden pb-[0.12em]">
      <span className={`${RISE} block ${className}`} style={{ animationDelay: `${delay}ms` }}>
        {children}
      </span>
    </span>
  );
}

export function HeroOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-10 text-[#f4efe9]" data-testid="hero-overlay">
      <style>{`
        @keyframes ${RISE} { from { transform: translateY(105%); opacity: 0; } to { transform: none; opacity: 1; } }
        .${RISE} { animation: ${RISE} 1.1s cubic-bezier(0.22, 1, 0.36, 1) both; }
        @media (prefers-reduced-motion: reduce) { .${RISE} { animation: none; } }
      `}</style>
      {/* top left: who, as Lusion's logo position */}
      <div className="absolute left-[4.9vw] top-[clamp(20px,4.4vw,64px)] font-mono text-[11px] uppercase tracking-[0.08em] text-white/60 md:text-[12px]">
        <Line delay={200}>Product Designer</Line>
      </div>
      {/* the front name and the line, lower left over the void's edge */}
      <div className="absolute bottom-[150px] left-[4.9vw] max-w-[min(92vw,44rem)] md:bottom-[clamp(96px,11vw,150px)]">
        {/* legibility: the sand thins out behind the copy, a soft falloff, never a box */}
        <div
          aria-hidden
          className="absolute -bottom-[30%] -left-[12vw] -right-[18%] -top-[45%] -z-10"
          style={{ background: "radial-gradient(ellipse 60% 55% at 35% 55%, rgba(0,0,0,0.72), rgba(0,0,0,0.45) 45%, transparent 75%)" }}
        />
        <h1 className="text-[clamp(40px,7.2vw,104px)] font-normal leading-[1.02] tracking-[-0.02em]">
          <Line delay={350}>Hi, I&rsquo;m Liam.</Line>
        </h1>
        <p className="mt-[0.9em] text-[clamp(17px,1.75vw,25px)] font-normal leading-[1.3] text-white/80">
          <Line delay={520}>
            I build <em className="italic text-white">ambiguous ideas</em> into products
          </Line>
          <Line delay={620}>where design and user needs meet.</Line>
        </p>
      </div>
      {/* the scroll cue: bottom right on desktop, centred on phones */}
      {/* phones: above the pill nav */}
      <div className="absolute bottom-[92px] left-0 right-0 text-center md:bottom-[clamp(20px,3vw,44px)] text-[clamp(13px,4vw,16px)] uppercase md:left-auto md:right-[4.9vw] md:text-right md:text-[clamp(14px,1.75vw,25px)]">
        <Line delay={800}>Scroll to explore</Line>
      </div>
    </div>
  );
}
