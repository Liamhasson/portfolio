import Image from "next/image";
import { useId } from "react";
import { LazyVideo } from "../lazy-video";
import { nordicFonts } from "./fonts";

const CARDS = [
  { n: 1, label: "Three carriers, in depth: FedEx, DHL and UPS vans, each lit in turn" },
  { n: 2, label: "Carrier comparison: three carrier lanes across a dot map of the US, the cheapest drawn in blue" },
  { n: 3, label: "Multiple shops: one hub audits several shops, each disputed separately" },
  { n: 4, label: "No minimum: parcels of every size pass through the same gate" },
] as const;
const SWATCHES = [["Signal", "1B4DFF"], ["Ink", "0C1116"], ["Onyx", "0F151B"], ["Daylight", "F9F9F8"], ["Mist", "EFEDEB"], ["Slate", "5A6672"]] as const;

/** Board frame 05 · How it works: the site's dark chapter. The four 3D cards from its How it works page (recorded from the
 *  live site at 2×, seamless loops), the denial chapter, and the system. */
export function NordicLogicHowItWorks({ kind, title }: { kind: "supporting"; title: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} data-block={kind} className={`f onyx how ${nordicFonts}`}>
      <div className="g12" style={{ alignItems: "start" }}>
        <div className="how-left">
          <h2 id={id} className="title" style={{ marginLeft: "calc(var(--u) * -3)" }}>{title}</h2>
          <p className="body">
            <span className="lead">Four things worth knowing.</span> After the first audit, the service runs month to month: every invoice is checked as it’s issued, and disputes are filed as errors turn up. The site explains it in four cards, each a small 3D scene that never stops moving.
          </p>
        </div>
        <div className="cards">
          {CARDS.map((c) => (
            <LazyVideo key={c.n} src={`/case-studies/nordic-logic/why-${c.n}.mp4`} poster={`/case-studies/nordic-logic/why-${c.n}-poster.jpg`} label={c.label} />
          ))}
        </div>
      </div>

      <div className="g12 denied-row">
        <LazyVideo
          src="/case-studies/nordic-logic/denied.mp4"
          poster="/case-studies/nordic-logic/denied-poster.jpg"
          label="When a carrier says no: the dark panel pins, fills the screen, and brings in rebut, re-file, close and escalate"
        />
        <div className="side">
          <p className="label">Chapter</p>
          <h3 className="w-title">When a carrier says no.</h3>
          <p className="body">A denial rejects one argument, not the money. The panel pins, fills the screen, then brings in the four answers: rebut, re-file, close, escalate.</p>
        </div>
      </div>

      <div className="sys">
        <div>
          <p className="label head">Colour</p>
          <ul className="sys-sw" aria-label="Nordic Logic's colours">
            {SWATCHES.map(([name, hex]) => (
              <li key={name}><i style={{ background: `#${hex}` }} aria-hidden="true" /><span>{name.toUpperCase()}<br />{hex}</span></li>
            ))}
          </ul>
        </div>
        <div>
          <p className="label head">Type</p>
          <div className="sys-type">
            <div><span className="label">Schibsted Grotesk</span><span className="s1">Your carriers owe you.</span></div>
            <div><span className="label">Instrument Sans</span><span className="s2">Every charge on every invoice, against the carrier’s own rules.</span></div>
            <div><span className="label">IBM Plex Mono</span><span className="s3">FEDEX GROUND · 42 LB BILLED · <b>+$25.97</b></span></div>
          </div>
        </div>
        <div className="sys-mark">
          <p className="label">Mark</p>
          <Image src="/case-studies/nordic-logic/mark-knockout.svg" alt="The Nordic Logic mark: N and L sharing one stroke, with a void between them" width={276} height={240} unoptimized />
          <p className="body">Signal is the one accent, never a fill. Weight stops at 500.</p>
        </div>
      </div>
    </section>
  );
}
