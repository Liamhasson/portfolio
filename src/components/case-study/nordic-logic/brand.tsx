import Image from "next/image";
import { useId } from "react";
import { LazyVideo } from "../lazy-video";
import { nordicFonts } from "./fonts";

/** The mark's own geometry (brand/svg/nordic-logic-mark-ink.svg, 276 × 240): N and L sharing one stem, five bars. */
const MARK = "M49.0908 240.002H0V204.546H49.0908V240.002ZM275.457 240.002H139.092L118.543 204.546H275.457V240.002ZM49.0908 188.864H0V153.411H49.0908V188.864ZM139.092 155.183V153.411H188.184V188.864H109.454L88.9072 153.411H138.064L139.092 155.183ZM128.969 137.729H79.8184L59.2715 102.275H108.407L128.969 137.729ZM188.184 137.729H139.092V102.275H188.184V137.729ZM99.3115 86.5928H50.1816L49.0908 84.71V86.5928H0V50.9893H78.6631L99.3115 86.5928ZM188.184 86.5928H139.092V50.9893H188.184V86.5928ZM69.5674 35.3066H0V0H49.0908L69.5674 35.3066ZM188.184 35.3066H139.092V0H188.184V35.3066Z";
/** Each bar's top and foot: the construction's guides. */
const ROWS = [0, 35.31, 50.99, 86.59, 102.28, 137.73, 153.41, 188.86, 204.55, 240];
const WORDS = ["Efficient", "Automated", "Precise", "Personal", "Safe", "Modern", "Alive"];
const NEVER = ["Industrial", "Boring", "Generic fintech", "Playful", "Startup-cute"];
const SWATCHES: { group: string; items: [string, string][] }[] = [
  { group: "Surfaces · warm", items: [["Daylight", "F9F9F8"], ["Mist", "EFEDEB"], ["Frost", "EBE9E6"]] },
  { group: "Type · cool", items: [["Ink", "0C1116"], ["Slate", "5A6672"], ["Onyx", "0F151B"]] },
  { group: "Brand", items: [["Signal", "1B4DFF"], ["Haze", "EDF2FA"]] },
];

/** Board frame 05b · Brand (Liam, 2026-10-19): the strategy and the voice, then the mark under its construction, the
 *  colour, the type, the dot grid, and the brand on the site and in the portal. Copy as approved on the board; the brand
 *  words, the "never" list and both voice lines are the brief's and the site's own. */
export function NordicLogicBrand({ kind, title }: { kind: "supporting"; title: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} data-block={kind} className={`f brand ${nordicFonts}`}>
      <div className="g12" style={{ alignItems: "end" }}>
        <h2 id={id} className="title" style={{ gridColumn: "1 / 7", marginLeft: "calc(var(--u) * -3)" }}>{title}</h2>
        <p className="body" style={{ gridColumn: "8 / 13" }}>
          <span className="lead">Trust without proof.</span> A one-person company with no clients to point to can’t borrow anyone’s credibility. So the brand earns it the way the site does: precise where the evidence is, warm where it asks for trust, and nothing on it that isn’t doing a job.
        </p>
      </div>

      <div className="br-strat">
        <div><p className="label">Audience</p><p className="say">The person who signs off the freight bill: a finance or operations lead who expects to be sold to, and checks.</p></div>
        <div><p className="label">The unspoken truth</p><p className="say">A buyer who’s being sold to stops listening. One who’s shown the work starts to trust.</p></div>
        <div>
          <p className="label">Brand words · from the brief</p>
          <ul className="br-words" aria-label="Brand words">{WORDS.map((w) => <li key={w}>{w}</li>)}</ul>
          <p className="label br-never-head">And never</p>
          <ul className="br-words no" aria-label="Never">{NEVER.map((w) => <li key={w}>{w}</li>)}</ul>
        </div>
      </div>

      <div className="br-voice">
        <div className="br-col">
          <p className="label">Voice</p>
          <h3 className="w-title">Every claim survives a check.</h3>
          <p className="body">Plain, specific and checkable. The brief sold on price with a comparison a buyer could disprove on a competitor’s own pricing page. The site states the fee as fact and puts the promise in the heading, so there is nothing to argue with.</p>
        </div>
        <div className="br-pair">
          <figure className="was"><figcaption className="label">The brief</figcaption><blockquote className="q">35%, the market standard is 40–50%.</blockquote><p className="note">A comparison the competitor’s own pricing page disproves in ten minutes.</p></figure>
          <figure className="now"><figcaption className="label">The site</figcaption><blockquote className="q">What this costs. <span className="soft">One invoice, and only if we recover.</span></blockquote><p className="note">The fee as plain fact, and the risk taken off the buyer in the heading itself.</p></figure>
        </div>
      </div>

      <div className="br-mark">
        <div className="br-plate">
          <div className="br-cons">
            <svg viewBox="-34 -30 344 300" role="img" aria-label="The Nordic Logic mark under its construction: five bars, the 30° diagonal, and the one bar that never reaches the margin">
              <g className="gd">{ROWS.map((y) => <line key={y} x1={-30} x2={306} y1={y} y2={y} />)}</g>
              <g className="gd dash"><line x1={-15.6} y1={-27} x2={155.9} y2={270} /><line x1={33.5} y1={-27} x2={205} y2={270} /><line x1={0} y1={-27} x2={0} y2={270} /></g>
              <path d={MARK} fill="#0C1116" />
              <rect className="err" x={0} y={102.28} width={49.09} height={35.45} />
              <path className="gd" d="M0 -14 A14 14 0 0 1 8 -11.5" />
            </svg>
            {/* (the notes as text over the drawing, not in it: an SVG's text scales with the drawing, under the floors) */}
            <span className="ann" aria-hidden="true" style={{ left: "12.2%", top: "1.6%" }}>30°</span>
            <span className="ann end" aria-hidden="true" style={{ right: "91.6%", top: "50.8%" }}>The error</span>
          </div>
        </div>
        <div className="br-col br-side">
          <p className="label">Mark</p>
          <h3 className="w-title">The error is in the mark.</h3>
          <p className="body">N and L share one stem, sliced into five bars. The diagonal runs at 30°, taken from Schibsted Grotesk’s own N, so the mark and the wordmark cut on one angle. One bar never reaches the margin: the billing error Nordic Logic exists to find. It’s drawn in geometry, not colour, so it survives a single ink.</p>
          <p className="label">Designed by me, after three rounds of directions</p>
        </div>
      </div>

      <div className="br-two">
        <div className="br-col br-colour">
          <p className="label">Colour</p>
          <h3 className="w-title">Only the surfaces turned warm.</h3>
          <p className="body">The first palette was blue all the way through: precise, and clinical. Wrong for a page that asks a stranger for a power of attorney. Only the surfaces moved, to a warm hue at the same lightness, so every contrast ratio held. The type stays cool, where the forensic tone belongs, and Signal is the one accent: one per screen, never a fill.</p>
          {SWATCHES.map((g) => (
            <div key={g.group} className="br-sw-group">
              <p className="label">{g.group}</p>
              <ul className="br-sw" aria-label={g.group}>
                {g.items.map(([name, hex]) => (
                  <li key={name}><i style={{ background: `#${hex}` }} aria-hidden="true" /><span>{name.toUpperCase()}<br />{hex}</span></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="br-col br-typecol">
          <p className="label">Type</p>
          <h3 className="w-title">Each typeface has one job.</h3>
          <p className="body">Schibsted Grotesk is Norwegian: the Nordic is real, not costume. Headlines are tracked tight and body copy loose, and nothing is heavier than 500. Authority comes from size and space, not weight.</p>
          <div className="br-type">
            <div><span className="label">Schibsted Grotesk · display</span><span className="t1">Your carriers owe you.</span></div>
            <div><span className="label">Instrument Sans · body</span><span className="t2">Every charge on every invoice, against the carrier’s own rules.</span></div>
            <div><span className="label">IBM Plex Mono · labels and figures</span><span className="t3">FEDEX GROUND · 42 LB BILLED · <b>+$25.97</b></span></div>
          </div>
        </div>
      </div>

      <div className="br-tex">
        <div className="br-col">
          <p className="label">Texture</p>
          <h3 className="w-title">Every page sits on paper.</h3>
          <p className="body">Every page is set on a fine dot grid, the pattern of a notebook page, so the site reads as a working document rather than a sales page. The grid answers the cursor: the dots part around it, hold for a moment, then ease back into place. Only their position changes, never their colour or size, so the texture stays beneath the content.</p>
          <p className="label">Live on the site · an 11px grid, drawn in code</p>
        </div>
        <LazyVideo className="br-dots" src="/case-studies/nordic-logic/dot-grid.mp4" poster="/case-studies/nordic-logic/dot-grid-poster.jpg" label="The site's dot grid: the dots part around the cursor and ease back into place" />
      </div>

      <div className="br-use">
        <p className="label">In use</p>
        <div className="br-shots">
          <figure><Image src="/case-studies/nordic-logic/in-use-site.jpg" alt="The site's home page: the lockup in the header, the headline in Schibsted Grotesk and the one Signal button" width={1600} height={467} sizes="(min-width: 1100px) 56vw, 100vw" /><figcaption className="label">The site · nordic-logic.vercel.app</figcaption></figure>
          <figure><Image src="/case-studies/nordic-logic/in-use-portal.jpg" alt="The client portal: the mark on a Signal tile at the top of the dark sidebar" width={940} height={480} sizes="(min-width: 1100px) 34vw, 100vw" /><figcaption className="label">The client portal</figcaption></figure>
        </div>
      </div>
    </section>
  );
}
