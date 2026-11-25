"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cyvoreNew } from "@/content/cyvore-new";

const WIDE = "(min-width: 1100px)";
const CALM = "(prefers-reduced-motion: reduce)";
const watch = (q: string) => (fn: () => void) => { const m = window.matchMedia(q); m.addEventListener("change", fn); return () => m.removeEventListener("change", fn); };
const subWide = watch(WIDE), subCalm = watch(CALM);

/** The site's own sizes the snapshot lays out at: its desktop first screen, and its portrait (phone) layout. */
const SIZES = { wide: { w: 1440, h: 810 }, phone: { w: 390, h: 844 } } as const;

/** The Cyvore new website's first screen, live, held on its hero (the snapshot, scripts/cyvore-new-snapshot.mjs): at
 *  its desktop size on wide screens, at a phone's size below 1100px so its own portrait layout shows, scaled to the
 *  column either way (the Marni Came Website section's pattern, spec 2026-11-25 §2). Its film keeps playing under
 *  reduced motion, so there the still with its text stands in. */
export function SnapshotFrame() {
  const wide = useSyncExternalStore(subWide, () => window.matchMedia(WIDE).matches, () => true);
  const calm = useSyncExternalStore(subCalm, () => window.matchMedia(CALM).matches, () => false);
  const size = wide ? SIZES.wide : SIZES.phone;
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / size.w));
    ro.observe(el);
    return () => ro.disconnect();
  }, [size.w]);
  const { still } = cyvoreNew;
  return (
    // (data-product: the client's own site, a picture of the work: outside the portfolio's type and a11y floors)
    <div data-product="" className={`cn-site ${wide ? "is-wide" : "is-phone"}`}>
      {wide && <div className="bar" aria-hidden="true"><span /><span /><span /></div>}
      <div className="win" ref={box} style={{ aspectRatio: `${size.w} / ${size.h}` }}>
        {calm ? (
          // eslint-disable-next-line @next/next/no-img-element -- a still standing in for the live frame
          <img src={still.src} alt={still.alt} />
        ) : (
          <iframe
            key={wide ? "wide" : "phone"}
            src={cyvoreNew.site}
            title="The first screen of Cyvore's new website, in progress"
            tabIndex={-1}
            style={{ width: size.w, height: size.h, transform: `scale(${scale})`, visibility: scale ? "visible" : "hidden" }}
          />
        )}
      </div>
    </div>
  );
}
