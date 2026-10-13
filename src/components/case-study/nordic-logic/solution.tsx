import { useId } from "react";
import { FirstAudit } from "./first-audit";
import { nordicFonts } from "./fonts";

/** Re-checked on LateShipment's own pages (/pricing, /solutions/dhl-lost-and-damaged-claims) on 2026-10-13. */
const LEVEL = [
  ["Fee on billing errors", <><span className="num">35%</span>, or <span className="num">25%</span> inside a bundle</>, <span key="n" className="num">35%</span>],
  ["Fee on lost and damaged claims", <span key="t" className="num">50%</span>, <span key="n" className="num">50%</span>],
  ["Contract", "None", "Cancel any month"],
  ["Minimum", "None", "None"],
] as const;
const DIFFERENT = [
  ["The first step", "A 30-day trial on their platform, or a demo", "One CSV, then a free full breakdown. Nothing to connect, nothing signed"],
  ["What you buy", "One of four products in a post-purchase platform", "Only the audit"],
  ["Who files", "Automated refund claims", "One named person reviews every dispute"],
] as const;

function Row({ k, them, us, diff }: { k: string; them: React.ReactNode; us: React.ReactNode; diff?: boolean }) {
  return (
    <div role="row" className={diff ? "cmp-row diff" : "cmp-row"}>
      <span role="rowheader" className="k">{k}</span>
      <span role="cell" className="v"><span className="cmp-who" aria-hidden="true">LateShipment</span>{them}</span>
      <span role="cell" className={diff ? "v us" : "v"}><span className="cmp-who" aria-hidden="true">Nordic Logic</span>{us}</span>
    </div>
  );
}

/** Board frame 04 · Solution: the comparison (Level on price. Different on the first step.), then the site's first
 *  audit, working. */
export function NordicLogicSolution({ kind, title }: { kind: "signature"; title: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} data-block={kind} className={`f solution ${nordicFonts}`}>
      <div className="g12" style={{ alignItems: "end" }}>
        <h2 id={id} className="title" style={{ gridColumn: "1/7", marginLeft: "calc(var(--u) * -3)" }}>{title}</h2>
        <p className="body" style={{ gridColumn: "8/13" }}>
          <span className="lead">Built for the sceptic.</span> Nordic Logic’s buyer expects to be sold to. So the site shows the work before it asks for anything, and it claims nothing it can’t prove.
        </p>
      </div>

      <div className="g12 cmp-head">
        <p className="display">Level on price. <em className="quiet">Different on the first step.</em></p>
      </div>
      <div className="cmp" role="table" aria-label="Nordic Logic compared with LateShipment">
        <div role="rowgroup">
          <div role="row" className="cmp-row th">
            <span role="columnheader"><span className="sr-only">Compared</span></span>
            <span role="columnheader">LateShipment</span>
            <span role="columnheader">Nordic Logic</span>
          </div>
        </div>
        <div role="rowgroup" aria-label="Level">
          <div className="cmp-group" aria-hidden="true">Level</div>
          {LEVEL.map(([k, them, us]) => <Row key={k} k={k} them={them} us={us} />)}
        </div>
        <div role="rowgroup" aria-label="Different">
          <div className="cmp-group" aria-hidden="true">Different</div>
          {DIFFERENT.map(([k, them, us]) => <Row key={k} k={k} them={them} us={us} diff />)}
        </div>
      </div>
      <p className="label cmp-src">Source: LateShipment’s pricing and DHL claims pages, checked 13 Oct 2026 · nine G2 reviews collected 6 Sep</p>

      <div className="g12 fa-head">
        <h3 className="w-title">The first step, working</h3>
        <p className="body">The site’s first audit has a real decision in it. After the breakdown, you go ahead or you don’t. Pick a branch.</p>
      </div>
      <div className="fa-tray">
        <p className="fa-q" aria-hidden="true">Your first audit.<span>Free, with nothing to connect.</span></p>
        <FirstAudit />
      </div>

      <div className="g12 sol-foot">
        <p className="display">Walking away is drawn with the same weight as signing. <em>Knowing they can decide is what makes a stranger trust it.</em></p>
      </div>
    </section>
  );
}
