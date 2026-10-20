"use client";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { marniFonts } from "@/components/marni-came/fonts";
import { MC_ASSETS } from "@/lib/marni-came/assets";

const WIDE = "(min-width: 1100px)";
const subscribe = (fn: () => void) => { const m = window.matchMedia(WIDE); m.addEventListener("change", fn); return () => m.removeEventListener("change", fn); };

/** Board CS 08 · Website: the release-week site, live in the page at its desktop size (scaled to the column); on phones,
 *  three stills and the link. */
export function MarniCameWebsite({ kind, title }: { kind: "supporting"; title: string }) {
  const id = useId();
  const wide = useSyncExternalStore(subscribe, () => window.matchMedia(WIDE).matches, () => false);
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const frame = useRef<HTMLIFrameElement>(null);
  const [inside, setInside] = useState(false);
  // keyboard focus inside the site: the page sees only its window losing focus, so check where it went
  useEffect(() => {
    const blur = () => setTimeout(() => setInside(document.activeElement === frame.current), 0);
    const focus = () => setInside(false);
    window.addEventListener("blur", blur); window.addEventListener("focus", focus);
    return () => { window.removeEventListener("blur", blur); window.removeEventListener("focus", focus); };
  }, []);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / 1440));
    ro.observe(el);
    return () => ro.disconnect();
  }, [wide]);
  return (
    <section aria-labelledby={id} data-block={kind} className={`f mc-sec website ${marniFonts}`}>
      <div className="mc-head"><h2 id={id} className="title">{title}</h2><p className="mc-open">Release week, as the band&rsquo;s own site.</p></div>
      {wide ? (
        <div className="mc-site">
          <div className="bar" aria-hidden="true"><span /><span /><span /><em>liamhasson.com/marni-came/site</em></div>
          <div className="win" ref={box}>
            <iframe ref={frame} data-focus={inside ? "" : undefined} src="/marni-came/site?embed=1" title="Marni Came's site in the week After Heartbreaks came out" loading="lazy" style={{ transform: `scale(${scale})` }} />
          </div>
        </div>
      ) : (
        <div className="mc-site-stills">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="wide" src={MC_ASSETS.releasePoster} alt="The site's first screen: After Heartbreaks, new single, out now" loading="lazy" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MC_ASSETS.band.liam} alt="The site's band section: Liam, vocals and guitar" loading="lazy" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MC_ASSETS.posters.lido} alt="The site's shows section: the Lido poster" loading="lazy" />
        </div>
      )}
      <a className="label mc-open-site" href="/marni-came/site" target="_blank" rel="noreferrer">Open the site ↗<span className="sr-only"> (opens in a new tab)</span></a>
    </section>
  );
}
