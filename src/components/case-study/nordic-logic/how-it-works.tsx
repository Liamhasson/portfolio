import { useId } from "react";
import { LazyVideo } from "../lazy-video";
import { nordicFonts } from "./fonts";

const CARDS = [
  { n: 1, label: "Three carriers, in depth: FedEx, DHL and UPS vans, each lit in turn" },
  { n: 2, label: "Carrier comparison: three carrier lanes across a dot map of the US, the cheapest drawn in blue" },
  { n: 3, label: "Multiple shops: one hub audits several shops, each disputed separately" },
  { n: 4, label: "No minimum: parcels of every size pass through the same gate" },
] as const;

/** Board frame 05 · How it works: the site's dark chapter. The four 3D cards from its How it works page (recorded from the
 *  live site at 2×, seamless loops) and the denial chapter. The system strip moved to 05b · Brand (brand.tsx). */
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

    </section>
  );
}
