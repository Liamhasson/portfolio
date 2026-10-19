import Image from "next/image";
import { useId } from "react";
import { LazyVideo } from "../lazy-video";
import { nordicFonts } from "./fonts";

/** The horizontal lockup's own geometry (brand/svg/nordic-logic-horizontal-ink.svg, 665 × 119): the mark (five bars, N and L
 *  sharing one stem) and the wordmark, outlined. */
const MARK = "M17.1816 102H0V89.5908H17.1816V102ZM96.4102 102H48.6826L41.4902 89.5908H96.4102V102ZM17.1816 84.1025H0V71.6934H17.1816V84.1025ZM48.6826 72.3135V71.6934H65.8643V84.1025H38.3096L31.1172 71.6934H48.3232L48.6826 72.3135ZM45.1396 66.2051H27.9365L20.7441 53.7959H37.9434L45.1396 66.2051ZM65.8643 66.2051H48.6826V53.7959H65.8643V66.2051ZM34.7598 48.3076H17.5635L17.1816 47.6484V48.3076H0V35.8457H27.5322L34.7598 48.3076ZM65.8643 48.3076H48.6826V35.8457H65.8643V48.3076ZM24.3486 30.3574H0V18H17.1816L24.3486 30.3574ZM65.8643 30.3574H48.6826V18H65.8643V30.3574Z";
const WORD = "M139.816 94V26.5H153.973L188.52 86.8281L186.27 87.1094V26.5H195.973V94H182.613L147.176 33.3438L149.52 33.0156V94H139.816ZM229.046 95.1719C224.202 95.1719 219.921 94.0469 216.202 91.7969C212.515 89.5469 209.64 86.4375 207.577 82.4688C205.515 78.5 204.483 73.9062 204.483 68.6875C204.483 63.4688 205.515 58.875 207.577 54.9062C209.64 50.9375 212.515 47.8281 216.202 45.5781C219.921 43.3281 224.202 42.2031 229.046 42.2031C233.89 42.2031 238.155 43.3281 241.843 45.5781C245.561 47.8281 248.452 50.9375 250.515 54.9062C252.577 58.875 253.608 63.4688 253.608 68.6875C253.608 73.9062 252.577 78.5 250.515 82.4688C248.452 86.4375 245.561 89.5469 241.843 91.7969C238.155 94.0469 233.89 95.1719 229.046 95.1719ZM229.046 87.5781C233.483 87.5781 236.983 85.8906 239.546 82.5156C242.108 79.1094 243.39 74.5 243.39 68.6875C243.39 62.8438 242.108 58.2344 239.546 54.8594C236.983 51.4844 233.483 49.7969 229.046 49.7969C224.608 49.7969 221.108 51.4844 218.546 54.8594C215.983 58.2344 214.702 62.8438 214.702 68.6875C214.702 74.5 215.983 79.1094 218.546 82.5156C221.108 85.8906 224.608 87.5781 229.046 87.5781ZM261.978 94V43.375H271.025V54.2969L270.697 52.9844C272.228 49.4219 274.478 46.7344 277.447 44.9219C280.447 43.1094 283.541 42.2031 286.728 42.2031C287.635 42.2031 288.541 42.2812 289.447 42.4375C290.353 42.5938 291.213 42.8594 292.025 43.2344L290.947 51.9062C289.166 51.3438 287.4 51.0625 285.65 51.0625C284.463 51.0625 283.056 51.2969 281.431 51.7656C279.838 52.2031 278.291 53.0625 276.791 54.3438C275.291 55.625 274.025 57.5156 272.994 60.0156C271.994 62.4844 271.494 65.7344 271.494 69.7656V94H261.978ZM314.176 95.1719C310.051 95.1719 306.411 94.0938 303.255 91.9375C300.13 89.7812 297.708 86.7188 295.989 82.75C294.27 78.7812 293.411 74.0781 293.411 68.6406C293.411 63.1719 294.27 58.4688 295.989 54.5312C297.739 50.5625 300.176 47.5156 303.301 45.3906C306.458 43.2656 310.114 42.2031 314.27 42.2031C317.676 42.2031 320.958 43.0469 324.114 44.7344C327.301 46.4219 329.739 49.2188 331.426 53.125L330.395 53.4531V23.6875H339.911V94H330.911V83.5469L331.145 84.2969C329.676 87.9844 327.38 90.7188 324.255 92.5C321.161 94.2812 317.801 95.1719 314.176 95.1719ZM317.083 87.4844C319.614 87.4844 321.911 86.8281 323.973 85.5156C326.036 84.2031 327.676 82.1719 328.895 79.4219C330.145 76.6406 330.77 73.1094 330.77 68.8281C330.77 62.3906 329.442 57.625 326.786 54.5312C324.13 51.4062 320.926 49.8438 317.176 49.8438C313.208 49.8438 309.958 51.5 307.426 54.8125C304.926 58.0938 303.676 62.7656 303.676 68.8281C303.676 74.7344 304.88 79.3281 307.286 82.6094C309.723 85.8594 312.989 87.4844 317.083 87.4844ZM351.796 94V43.375H361.312V94H351.796ZM356.578 35.5469C354.484 35.5469 352.734 34.8594 351.328 33.4844C349.953 32.0781 349.265 30.3438 349.265 28.2812C349.265 26.1563 349.953 24.4062 351.328 23.0312C352.734 21.6563 354.484 20.9688 356.578 20.9688C358.671 20.9688 360.406 21.6563 361.781 23.0312C363.187 24.4062 363.89 26.1563 363.89 28.2812C363.89 30.3438 363.187 32.0781 361.781 33.4844C360.406 34.8594 358.671 35.5469 356.578 35.5469ZM393.916 95.1719C389.01 95.1719 384.76 94.0938 381.166 91.9375C377.573 89.7812 374.807 86.7188 372.87 82.75C370.932 78.7812 369.963 74.0938 369.963 68.6875C369.963 63.25 370.932 58.5625 372.87 54.625C374.807 50.6562 377.557 47.5938 381.12 45.4375C384.713 43.2812 388.963 42.2031 393.87 42.2031C397.557 42.2031 400.885 42.875 403.854 44.2188C406.823 45.5625 409.338 47.5156 411.401 50.0781C413.495 52.6094 414.995 55.6875 415.901 59.3125L406.479 61.6094C405.635 57.7656 404.135 54.8438 401.979 52.8438C399.854 50.8125 397.151 49.7969 393.87 49.7969C389.432 49.7969 386.041 51.4688 383.698 54.8125C381.385 58.125 380.229 62.7656 380.229 68.7344C380.229 74.7031 381.385 79.3438 383.698 82.6562C386.041 85.9375 389.432 87.5781 393.87 87.5781C397.12 87.5781 399.807 86.625 401.932 84.7188C404.088 82.7812 405.604 79.9531 406.479 76.2344L415.76 78.4844C415.041 81.2031 413.995 83.5938 412.62 85.6562C411.245 87.7188 409.604 89.4531 407.698 90.8594C405.823 92.2656 403.713 93.3281 401.37 94.0469C399.057 94.7969 396.573 95.1719 393.916 95.1719ZM444.219 94V26.5H454.297V85.6094H487.719V94H444.219ZM512.167 95.1719C507.323 95.1719 503.042 94.0469 499.323 91.7969C495.636 89.5469 492.761 86.4375 490.698 82.4688C488.636 78.5 487.605 73.9062 487.605 68.6875C487.605 63.4688 488.636 58.875 490.698 54.9062C492.761 50.9375 495.636 47.8281 499.323 45.5781C503.042 43.3281 507.323 42.2031 512.167 42.2031C517.011 42.2031 521.276 43.3281 524.964 45.5781C528.683 47.8281 531.573 50.9375 533.636 54.9062C535.698 58.875 536.73 63.4688 536.73 68.6875C536.73 73.9062 535.698 78.5 533.636 82.4688C531.573 86.4375 528.683 89.5469 524.964 91.7969C521.276 94.0469 517.011 95.1719 512.167 95.1719ZM512.167 87.5781C516.605 87.5781 520.105 85.8906 522.667 82.5156C525.23 79.1094 526.511 74.5 526.511 68.6875C526.511 62.8438 525.23 58.2344 522.667 54.8594C520.105 51.4844 516.605 49.7969 512.167 49.7969C507.73 49.7969 504.23 51.4844 501.667 54.8594C499.105 58.2344 497.823 62.8438 497.823 68.6875C497.823 74.5 499.105 79.1094 501.667 82.5156C504.23 85.8906 507.73 87.5781 512.167 87.5781ZM563.85 113.453C556.131 113.453 550.443 112.391 546.787 110.266C543.131 108.141 541.303 104.859 541.303 100.422C541.303 97.8594 541.959 95.625 543.271 93.7188C544.584 91.8125 546.725 90.3594 549.693 89.3594C548.506 88.6094 547.537 87.6406 546.787 86.4531C546.068 85.2656 545.709 83.9375 545.709 82.4688C545.709 80.6562 546.271 79.0625 547.396 77.6875C548.521 76.2812 550.131 75.2656 552.225 74.6406C549.725 73.1406 547.771 71.1406 546.365 68.6406C544.99 66.1406 544.303 63.25 544.303 59.9688C544.303 56.3438 545.131 53.2031 546.787 50.5469C548.443 47.8906 550.803 45.8438 553.865 44.4062C556.928 42.9375 560.553 42.2031 564.74 42.2031C568.928 42.2031 572.553 42.9375 575.615 44.4062C578.709 45.8438 581.1 47.9062 582.787 50.5938C584.475 53.25 585.318 56.4062 585.318 60.0625C585.318 63.6562 584.475 66.7656 582.787 69.3906C581.1 72.0156 578.709 74.0469 575.615 75.4844C572.521 76.9219 568.85 77.6406 564.6 77.6406H560.521C556.803 77.6406 554.943 78.7188 554.943 80.875C554.943 82.9375 556.756 83.9688 560.381 83.9688H570.553C574.396 83.9688 577.537 84.4219 579.975 85.3281C582.412 86.2031 584.303 87.375 585.646 88.8438C587.021 90.2812 587.975 91.8594 588.506 93.5781C589.037 95.2969 589.303 97 589.303 98.6875C589.303 103.688 587.443 107.391 583.725 109.797C580.006 112.234 574.256 113.453 566.475 113.453H563.85ZM563.943 106.422H566.521C575.178 106.422 579.506 103.828 579.506 98.6406C579.506 96.5156 578.725 94.7812 577.162 93.4375C575.631 92.0625 572.959 91.375 569.146 91.375H560.99C558.209 91.375 555.834 91.9688 553.865 93.1562C551.928 94.3125 550.959 96.2344 550.959 98.9219C550.959 101.453 552.006 103.328 554.1 104.547C556.225 105.797 559.506 106.422 563.943 106.422ZM564.74 71.2188C568.365 71.2188 571.146 70.2656 573.084 68.3594C575.053 66.4219 576.037 63.6562 576.037 60.0625C576.037 56.4688 575.053 53.6875 573.084 51.7188C571.146 49.7188 568.365 48.7188 564.74 48.7188C561.146 48.7188 558.381 49.7031 556.443 51.6719C554.506 53.6406 553.537 56.4375 553.537 60.0625C553.537 63.6562 554.506 66.4219 556.443 68.3594C558.381 70.2656 561.146 71.2188 564.74 71.2188ZM572.85 48.0625V43C572.85 40.5938 573.662 38.6719 575.287 37.2344C576.943 35.7656 579.006 35.0312 581.475 35.0312H587.24V42.5781H582.084C581.115 42.5781 580.475 42.75 580.162 43.0938C579.881 43.4375 579.74 44.125 579.74 45.1562V48.0625H572.85ZM596.079 94V43.375H605.595V94H596.079ZM600.86 35.5469C598.766 35.5469 597.016 34.8594 595.61 33.4844C594.235 32.0781 593.548 30.3438 593.548 28.2812C593.548 26.1563 594.235 24.4062 595.61 23.0312C597.016 21.6563 598.766 20.9688 600.86 20.9688C602.954 20.9688 604.688 21.6563 606.063 23.0312C607.47 24.4062 608.173 26.1563 608.173 28.2812C608.173 30.3438 607.47 32.0781 606.063 33.4844C604.688 34.8594 602.954 35.5469 600.86 35.5469ZM638.199 95.1719C633.293 95.1719 629.043 94.0938 625.449 91.9375C621.855 89.7812 619.09 86.7188 617.152 82.75C615.215 78.7812 614.246 74.0938 614.246 68.6875C614.246 63.25 615.215 58.5625 617.152 54.625C619.09 50.6562 621.84 47.5938 625.402 45.4375C628.996 43.2812 633.246 42.2031 638.152 42.2031C641.84 42.2031 645.168 42.875 648.136 44.2188C651.105 45.5625 653.621 47.5156 655.683 50.0781C657.777 52.6094 659.277 55.6875 660.183 59.3125L650.761 61.6094C649.918 57.7656 648.418 54.8438 646.261 52.8438C644.136 50.8125 641.433 49.7969 638.152 49.7969C633.715 49.7969 630.324 51.4688 627.98 54.8125C625.668 58.125 624.511 62.7656 624.511 68.7344C624.511 74.7031 625.668 79.3438 627.98 82.6562C630.324 85.9375 633.715 87.5781 638.152 87.5781C641.402 87.5781 644.09 86.625 646.215 84.7188C648.371 82.7812 649.886 79.9531 650.761 76.2344L660.043 78.4844C659.324 81.2031 658.277 83.5938 656.902 85.6562C655.527 87.7188 653.886 89.4531 651.98 90.8594C650.105 92.2656 647.996 93.3281 645.652 94.0469C643.34 94.7969 640.855 95.1719 638.199 95.1719Z";
/** Each bar's top and foot. */
const ROWS = [18, 30.36, 35.85, 48.31, 53.8, 66.21, 71.69, 84.1, 89.59, 102];
const WORDS = ["Efficient", "Automated", "Precise", "Personal", "Safe", "Modern", "Alive"];
const NEVER = ["Industrial", "Boring", "Generic fintech", "Playful", "Startup-cute"];
const SWATCHES: [string, string, string][] = [["Daylight", "F9F9F8", "#5a6672"], ["Mist", "EFEDEB", "#5a6672"], ["Ink", "0C1116", "#c9d1d9"], ["Slate", "5A6672", "#f9f9f8"]];

/** Board frame 05b · Brand, image first (Liam, 2026-10-19: no more than two screens, warm, in the brand's own language): the
 *  lockup under its construction on the brand's dot-grid paper, the strategy in one row, then one bento of the brand at
 *  work. The brand words, the "never" list and both voice lines are the brief's and the site's own. */
export function NordicLogicBrand({ kind, title }: { kind: "supporting"; title: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} data-block={kind} className={`f brand ${nordicFonts}`}>
      <div className="g12" style={{ alignItems: "end" }}>
        <h2 id={id} className="title" style={{ gridColumn: "1 / 7", marginLeft: "calc(var(--u) * -3)" }}>{title}</h2>
        <p className="body" style={{ gridColumn: "8 / 13" }}>
          <span className="lead">Trust without proof.</span> A one-person company with no clients to point to can’t borrow anyone’s credibility, so the brand earns it the way the site does: precise where the evidence is, warm where it asks for trust.
        </p>
      </div>

      <div className="b2-hero">
        <div className="b2-stage">
          <svg viewBox="-182 -131 1029 381" role="img" aria-label="The Nordic Logic lockup under its construction on the brand's dot-grid paper: the mark's five bars and its 30° diagonal, the wordmark's cap height and baseline, and the one bar that never reaches the margin">
            <g className="gl">
              <line x1={-182} x2={847} y1={18} y2={18} /><line x1={-182} x2={847} y1={102} y2={102} />
              <line x1={-182} x2={847} y1={26.5} y2={26.5} /><line x1={-182} x2={847} y1={94} y2={94} />
              <line x1={0} x2={0} y1={-131} y2={250} /><line x1={96.41} x2={96.41} y1={-131} y2={250} />
              <line x1={139.8} x2={139.8} y1={-131} y2={250} /><line x1={665} x2={665} y1={-131} y2={250} />
              <line x1={-6} y1={7.6} x2={62} y2={125.4} /><line x1={11.2} y1={7.6} x2={79.2} y2={125.4} />
            </g>
            <g className="gr">{ROWS.map((y) => <line key={y} x1={-14} x2={110} y1={y} y2={y} />)}</g>
            <path d={MARK} fill="#0C1116" />
            <path d={WORD} fill="#0C1116" />
            <rect className="err" x={0} y={53.8} width={17.18} height={12.41} />
          </svg>
          {/* (the notes as text over the drawing, not in it: an SVG's text scales with the drawing, under the floors) */}
          <span className="an sig only-d" aria-hidden="true" style={{ right: "82.8%", top: "51.6%" }}>The error</span>
          <span className="an up only-d" aria-hidden="true" style={{ left: "18%", top: "32.8%" }}>30°</span>
          <span className="an up only-d" aria-hidden="true" style={{ left: "27.6%", top: "32.8%" }}>0.52 × cap</span>
          <span className="an only-d" aria-hidden="true" style={{ left: "82.9%", top: "41.3%" }}>Cap height</span>
          <span className="an only-d" aria-hidden="true" style={{ left: "82.9%", top: "59.1%" }}>Baseline</span>
        </div>
        <p className="label b2-tag">Mark and lockup · designed by me</p>
        <p className="b2-cap"><b>The error is in the mark.</b> One bar never reaches the margin: the billing error Nordic Logic exists to find, drawn in geometry so it survives a single ink.</p>
      </div>

      <div className="b2-strat">
        <div><p className="label">Audience</p><p className="say">The person who signs off the freight bill: a finance or operations lead who expects to be sold to, and checks.</p></div>
        <div><p className="label">The unspoken truth</p><p className="say">A buyer who’s being sold to stops listening. One who’s shown the work starts to trust.</p></div>
        <div>
          <p className="label">Brand words · from the brief</p>
          <ul className="b2-words" aria-label="Brand words">{WORDS.map((w) => <li key={w}>{w}</li>)}</ul>
          <ul className="b2-words no" aria-label="Never">{NEVER.map((w) => <li key={w}>{w}</li>)}</ul>
        </div>
      </div>

      <div className="b2-bento">
        <div className="b2-card onyx b2-portal">
          <Image src="/case-studies/nordic-logic/in-use-portal.jpg" alt="The client portal: the mark on a Signal tile at the top of the dark sidebar" width={940} height={480} sizes="(min-width: 1100px) 44vw, 100vw" />
          <div className="foot"><p className="label">The client portal</p><p className="t">The mark leads the product.</p></div>
        </div>
        <div className="b2-card b2-colour">
          <p className="label">Warm surfaces · cool type</p>
          <ul className="b2-sw" aria-label="Nordic Logic's colours">
            {SWATCHES.map(([name, hex, ink]) => (
              <li key={name} style={{ background: `#${hex}` }}><span style={{ color: ink }}>{name.toUpperCase()}<br />{hex}</span></li>
            ))}
          </ul>
          <div className="b2-sig" aria-hidden="true" />
          <div className="b2-sigrow"><span className="label">Signal · one per screen</span><span className="label">1B4DFF</span></div>
          <p className="t">Only the surfaces turned warm.</p>
        </div>
        <div className="b2-card b2-voice">
          <p className="label">The brief</p>
          <blockquote className="b2-q was">“35%, the market standard is <span className="nw">40–50%</span>.”</blockquote>
          <p className="label">The site</p>
          <blockquote className="b2-q">What this costs. <span className="soft">One invoice, and only if we recover.</span></blockquote>
          <div className="foot"><p className="t">Every claim survives a check.</p></div>
        </div>
        <div className="b2-card b2-type">
          <div className="b2-names">
            <div><span className="n1">Schibsted Grotesk</span><span className="label">Display</span></div>
            <div><span className="n2">Instrument Sans</span><span className="label">Body</span></div>
            <div><span className="n3">IBM Plex Mono</span><span className="label">Figures</span></div>
          </div>
          <div className="foot"><p className="t">Each typeface has one job.</p><p className="note">Schibsted Grotesk is Norwegian: the Nordic is real, not costume. Headlines tight, body loose, nothing heavier than 500.</p></div>
        </div>
        <div className="b2-card b2-tex">
          <LazyVideo className="b2-dots" src="/case-studies/nordic-logic/dot-grid.mp4" poster="/case-studies/nordic-logic/dot-grid-poster.jpg" label="The site's dot grid: the dots part around the cursor and ease back into place" />
          <div className="foot"><p className="label">Texture · live on the site</p><p className="t">Every page sits on paper.</p></div>
        </div>
        <div className="b2-card b2-site">
          <Image src="/case-studies/nordic-logic/in-use-site-tall.jpg" alt="The site's home page: the lockup in the header, the headline in Schibsted Grotesk and the one Signal button" width={1200} height={797} sizes="(min-width: 1100px) 28vw, 100vw" />
          <div className="foot"><p className="label">The site</p><p className="t">One blue button per screen.</p></div>
        </div>
      </div>
    </section>
  );
}
