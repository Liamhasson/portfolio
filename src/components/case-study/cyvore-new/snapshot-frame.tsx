"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cyvoreNew } from "@/content/cyvore-new";

const CALM = "(prefers-reduced-motion: reduce)";
const subCalm = (fn: () => void) => { const m = window.matchMedia(CALM); m.addEventListener("change", fn); return () => m.removeEventListener("change", fn); };

/** The site's own sizes the snapshot lays out at: its desktop first screen, and its portrait (phone) layout. */
const SIZES = { wide: { w: 1440, h: 810 }, phone: { w: 390, h: 844 } } as const;

/** The Cyvore new website's first screen, live, held on its hero (the snapshot, scripts/cyvore-new-snapshot.mjs): at
 *  its desktop size on wide screens, at a phone's size below 1100px so its own portrait layout shows, scaled to the
 *  box either way (the Marni Came Website section's pattern, spec 2026-11-25 §2). The box's shape is the CSS's
 *  (cyvore-new.css: 16:9 wide, a portrait capped to the screen below 1100px); the frame reads it, so the two never
 *  disagree and a resize never paints a frame at the old scale. Nothing loads before the box is measured: the server's
 *  page has no frame, so phones never start on the desktop site. Its film keeps playing under reduced motion, so
 *  there the still of the same screen, with its text, stands in. */
export function SnapshotFrame() {
  const calm = useSyncExternalStore(subCalm, () => window.matchMedia(CALM).matches, () => false);
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const wide = box ? box.w >= box.h : null;
  const size = wide ? SIZES.wide : SIZES.phone;
  const still = wide ? cyvoreNew.still : cyvoreNew.stillPhone;
  return (
    // (data-product: the client's own site, a picture of the work: outside the portfolio's type and a11y floors)
    <div data-product="" className={`cn-site${wide === null ? "" : wide ? " is-wide" : " is-phone"}`}>
      <div className="bar" aria-hidden="true"><span /><span /><span /></div>
      <div className="win" ref={ref}>
        {box && box.w > 0 && (calm ? (
          // eslint-disable-next-line @next/next/no-img-element -- a still standing in for the live frame
          <img src={still.src} alt={still.alt} />
        ) : (
          <iframe
            key={wide ? "wide" : "phone"}
            src={cyvoreNew.site}
            title="The first screen of Cyvore's new website, in progress"
            tabIndex={-1}
            style={{ width: size.w, height: size.h, transform: `scale(${box.w / size.w})` }}
          />
        ))}
      </div>
    </div>
  );
}
