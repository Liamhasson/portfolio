import Image from "next/image";
import { useId } from "react";
import { LazyVideo } from "../lazy-video";
import { nordicFonts } from "./fonts";

/** The mark alone (brand/svg/nordic-logic-mark-ink.svg, 276 × 240): five bars, N and L sharing one stem. */
const MARK = "M49.0908 240.002H0V204.546H49.0908V240.002ZM275.457 240.002H139.092L118.543 204.546H275.457V240.002ZM49.0908 188.864H0V153.411H49.0908V188.864ZM139.092 155.183V153.411H188.184V188.864H109.454L88.9072 153.411H138.064L139.092 155.183ZM128.969 137.729H79.8184L59.2715 102.275H108.407L128.969 137.729ZM188.184 137.729H139.092V102.275H188.184V137.729ZM99.3115 86.5928H50.1816L49.0908 84.71V86.5928H0V50.9893H78.6631L99.3115 86.5928ZM188.184 86.5928H139.092V50.9893H188.184V86.5928ZM69.5674 35.3066H0V0H49.0908L69.5674 35.3066ZM188.184 35.3066H139.092V0H188.184V35.3066Z";
/** Each bar's top and foot. */
const ROWS = [0, 35.31, 50.99, 86.59, 102.28, 137.73, 153.41, 188.86, 204.55, 240];
const WORDS = ["Efficient", "Automated", "Precise", "Personal", "Safe", "Modern", "Alive"];
const NEVER = ["Industrial", "Boring", "Generic fintech", "Playful", "Startup-cute"];
/** What three of the words became, and what three of the nevers ruled out. */
const DECIDED: [string, string][] = [
  ["Precise", "Plex Mono for every figure, and no number on the site without a source."],
  ["Personal", "Light weights that stop at 500, and the voice of one founder."],
  ["Safe", "No cookie banner, and every uploaded file deleted after 100 days."],
];
const RULED_OUT: [string, string][] = [
  ["Generic fintech", "Not Inter: the default of every competitor."],
  ["Startup-cute", "Corners capped at 8px, where competitors round everything."],
  ["Industrial", "No terminal look, no 700 weights, no green status lights."],
];
/** The live home page's colours by area (measured on nordic-logic.vercel.app, 2026-10-19), the rest folded into the nearest surface. */
const USE: [string, number, string][] = [
  ["Daylight", 49.4, "#f9f9f8"], ["Paper", 23, "#ffffff"], ["Onyx", 19.3, "#0f151b"], ["Mist", 5.1, "#efedeb"],
  ["Haze", 1.1, "#edf2fa"], ["Frost", 0.9, "#ebe9e6"], ["Signal", 0.6, "#1b4dff"], ["Ink", 0.6, "#0c1116"],
];
const INKS: [string, string][] = [["Ink", "0C1116"], ["Slate", "5A6672"], ["Onyx", "0F151B"], ["Signal", "1B4DFF"]];
const SHIFT: [string, string][] = [["F7F9FB", "F9F9F8"], ["E8EEF7", "EFEDEB"]];

/** Board frame 05b · Brand, option A "Show the working" (Liam, 2026-10-20): the idea, where it came from (the brief's words and
 *  nevers, each turned into a decision), the mark under its construction with the logo suite under it, then one bento of
 *  the brand at work. Card colours keep one rule: white is the system, Mist the brand at work, Onyx the product. */
export function NordicLogicBrand({ kind, title }: { kind: "supporting"; title: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} data-block={kind} className={`f brand ${nordicFonts}`}>
      <div className="g12" style={{ alignItems: "end" }}>
        <h2 id={id} className="title" style={{ gridColumn: "1 / 6", marginLeft: "calc(var(--u) * -3)" }}>{title}</h2>
        <div style={{ gridColumn: "6 / 13" }}>
          <p className="b3-idea">Show the working.</p>
          <p className="body b3-support">Nordic Logic’s buyer expects to be sold to, so the brand never asks for trust. It shows its working: every number sourced, every finding left on the page where you can check it.</p>
        </div>
      </div>

      <div className="b3-origin">
        <div>
          <p className="label">Seven words, from the brief</p>
          <p className="b3-src">{WORDS.join(" · ")}</p>
          <dl>{DECIDED.map(([w, d]) => <div key={w} className="b3-row"><dt>{w}</dt><dd>{d}</dd></div>)}</dl>
        </div>
        <div>
          <p className="label">Five nevers, checked against the market</p>
          <p className="b3-src no">{NEVER.join(" · ")}</p>
          <dl>{RULED_OUT.map(([w, d]) => <div key={w} className="b3-row"><dt>{w}</dt><dd>{d}</dd></div>)}</dl>
        </div>
      </div>

      <div className="b3-hero">
        <div className="b3-top">
          <div className="b3-cons">
            <svg viewBox="-80 -70 456 380" role="img" aria-label="The mark under its construction: five bars, a 30° diagonal taken from Schibsted Grotesk's N, its clear space of one bar and one gap, and the one bar that never reaches the margin">
              <rect className="cs" x={-51.4} y={-51.4} width={378.8} height={342.8} />
              <g className="rw">{ROWS.map((y) => <line key={y} x1={-51.4} x2={327.4} y1={y} y2={y} />)}</g>
              <line className="dg" x1={-28.9} y1={-50} x2={167} y2={289} /><line className="dg" x1={20.2} y1={-50} x2={216} y2={289} />
              <line className="dg" x1={0} y1={-50} x2={0} y2={0} />
              <path className="arc" d="M0 -48 A48 48 0 0 0 -24 -41.6" />
              <line className="lead" x1={-58} x2={0} y1={120} y2={120} />
              <path d={MARK} fill="#0C1116" />
              <rect className="err" x={0} y={102.28} width={49.09} height={35.45} />
            </svg>
            {/* (the notes as text over the drawing, not in it: an SVG's text scales with the drawing, under the floors) */}
            <span className="an only-d" aria-hidden="true" style={{ left: "19%", top: "8.5%" }}>30°</span>
            <span className="an sig only-d" aria-hidden="true" style={{ right: "95.4%", top: "50.6%" }}>The error</span>
            <span className="an c only-d" aria-hidden="true" style={{ left: "56%", top: "97%" }}>Clear space · one bar and one gap</span>
          </div>
          <div className="b3-cap">
            <p className="label">Mark · designed by me</p>
            <p className="t">The error is in the mark.</p>
            <p className="d">One bar never reaches the margin: the billing error Nordic Logic exists to find, shown rather than hidden. Drawn in geometry, so it still works printed in one colour.</p>
          </div>
        </div>
        <ul className="b3-suite" aria-label="The logo suite">
          <li className="h"><div className="lk"><Image src="/case-studies/nordic-logic/lockup-horizontal.svg" alt="The horizontal lockup" width={665} height={119} /></div><p className="lb">Horizontal · min 14px wordmark</p></li>
          <li className="s"><div className="lk"><Image src="/case-studies/nordic-logic/lockup-stacked.svg" alt="The stacked lockup" width={455} height={199} /></div><p className="lb">Stacked</p></li>
          <li className="m"><div className="lk"><Image src="/case-studies/nordic-logic/mark-ink.svg" alt="The mark alone" width={276} height={240} /></div><p className="lb">Mark · min 16px</p></li>
          <li className="k"><div className="lk ko"><Image src="/case-studies/nordic-logic/lockup-knockout.svg" alt="The knockout lockup on Onyx" width={665} height={119} /></div><p className="lb">Knockout · on Onyx</p></li>
          <li className="i">
            <div className="lk b3-fav">
              <Image src="/case-studies/nordic-logic/app-icon.png" alt="The app icon at 32px" width={32} height={32} />
              <Image src="/case-studies/nordic-logic/app-icon.png" alt="The favicon at 16px" width={16} height={16} />
            </div>
            <p className="lb">32 · 16px</p>
          </li>
        </ul>
      </div>

      <div className="b3-bento">
        <div className="b3-card c-work b3-inv lead">
          <div className="doc"><Image src="/case-studies/nordic-logic/invoice.png" alt="A FedEx Ground invoice from the site, marked sample data, with two findings called out: the billable weight is 25 lb, not 42, and $25.97 was overcharged" width={840} height={740} sizes="(min-width: 1100px) 32vw, 100vw" /></div>
          <div className="foot"><p className="label">Documents, not drawings</p><p className="t">The finding is shown on the document.</p></div>
        </div>
        <div className="b3-card c-sys b3-colour">
          <p className="label">By area, on the live home page</p>
          <div className="b3-strip" role="img" aria-label="The home page by area: Daylight 49%, Paper 23%, Onyx 19%, Mist 5%, Signal blue 0.6%">
            {USE.map(([n, w, c]) => <i key={n} style={{ width: `${w}%`, background: c }} />)}
          </div>
          <p className="b3-legend"><span>Daylight 49%</span><span>Paper 23%</span><span>Onyx 19%</span><span>Mist 5%</span><span className="sig">Signal 0.6%</span></p>
          <ul className="b3-inks" aria-label="Type and accent colours">
            {INKS.map(([n, h]) => <li key={n}><i style={{ background: `#${h}` }} />{n} {h}</li>)}
          </ul>
          <p className="label">The warm shift · same lightness</p>
          <div className="b3-shift">
            {SHIFT.map(([was, now]) => (
              <div key={was}><span style={{ background: `#${was}` }}>Before {was}</span><span style={{ background: `#${now}` }}>After {now}</span></div>
            ))}
          </div>
          <div className="foot"><p className="t">Only the surfaces turned warm.</p></div>
        </div>
        <div className="b3-card c-sys b3-type">
          <div className="b3-names">
            <div><span className="n1">Schibsted Grotesk</span><span className="label">Display</span></div>
            <div><span className="n2">Instrument Sans</span><span className="label">Body</span></div>
            <div><span className="n3">IBM Plex Mono</span><span className="label">Figures</span></div>
          </div>
          <p className="b3-track">Display −2.5% · body +1% · nothing heavier than 500</p>
          <div className="foot"><p className="t">Each typeface has one job.</p></div>
        </div>
        <div className="b3-card c-work b3-voice">
          <p className="label">The brief</p>
          <blockquote className="b3-q">“35%, the market standard is <span className="nw">40–50%</span>.”</blockquote>
          <p className="label">What shipped</p>
          <blockquote className="b3-two">What this costs. <span>One invoice, and only if we recover.</span></blockquote>
          <div className="foot"><p className="t">Every claim survives a check.</p></div>
        </div>
        <div className="b3-card b3-tex">
          <LazyVideo className="b3-dots" src="/case-studies/nordic-logic/dot-grid.mp4" poster="/case-studies/nordic-logic/dot-grid-poster.jpg" label="The site's dot grid: the dots part around the cursor and ease back into place" />
          <div className="foot"><p className="label">Texture · live on the site</p><p className="t">Every page is working paper.</p></div>
        </div>
        <div className="b3-card c-prod b3-prod">
          <Image src="/case-studies/nordic-logic/in-use-portal.jpg" alt="The client portal: the mark on its tile at the top of the dark sidebar" width={940} height={480} sizes="(min-width: 1100px) 22vw, 100vw" />
          <div className="foot"><p className="label">The client portal</p><p className="t">The mark carries into the product.</p></div>
        </div>
      </div>
    </section>
  );
}
