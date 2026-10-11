import Image from "next/image";
import { useId, type CSSProperties } from "react";
import { LazyVideo } from "../lazy-video";

/** A recording cropped to the part of the product it shows (the board's .crop: frame size and offset in the
    recording's 1728-wide pixels). */
const crop = (w: number, h: number, x: number, y: number) => ({ "--w": w, "--h": h, "--x": x, "--y": y }) as CSSProperties;

/** Board frame 05 · How it works: the product, walked through (eventread-mockups.html:578-630). */
export function EventreadHowItWorks({ kind, title }: { kind: "supporting"; title: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} data-block={kind} className="f walk">
      <div className="g12" style={{ alignItems: "end" }}>
        <h2 id={id} className="title" style={{ gridColumn: "1/7", marginLeft: "calc(var(--u) * -3)" }}>{title}</h2>
        <p className="body" style={{ gridColumn: "8/13" }}>
          <span className="lead">One search, then it remembers.</span> Pick a city, a month, your genre and your room size, and the month comes back laid out by risk. Around that search sit three things bookers do every week: book for several acts, watch a date after it&apos;s booked, and route a tour.
        </p>
      </div>

      <div className="w-step">
        <div className="g12 w-head">
          <div className="w-num">01</div>
          <h3 className="w-title">Search, then save it as an act</h3>
          <p className="body w-body">A manager or an agent books for several acts, and every search asked for the same genre and room size again. Signed in, a search offers to save itself as an act. After that the act is one click on the search page, and its genre and room size fill in.</p>
        </div>
        <div className="w-tray w-pair">
          <figure className="w-shot">
            <div className="crop" style={crop(940, 370, 620, 150)} data-product>
              <LazyVideo
                src="/case-studies/eventread/flow-save-act.mp4"
                poster="/case-studies/eventread/flow-save-act-poster.jpg"
                label="Results for Berlin, November 2026: the Save Rock · 500–1,500 as an act offer is named The Quiet Hours and becomes a chip"
              />
            </div>
            <figcaption className="app-label">After a search · the offer</figcaption>
          </figure>
          <figure className="w-shot">
            <div className="crop" style={crop(470, 440, 1040, 390)} data-product>
              <LazyVideo
                src="/case-studies/eventread/flow-pick-act.mp4"
                poster="/case-studies/eventread/flow-pick-act-poster.jpg"
                label="The search form: picking Mira Solenne fills Electronic and 1,500–5,000"
              />
            </div>
            <figcaption className="app-label">Next search · one click</figcaption>
          </figure>
        </div>
      </div>

      <div className="g12 w-duo">
        <div className="w-col">
          <div className="w-num">02</div>
          <h3 className="w-title">Follow the date you booked</h3>
          <p className="body w-body">Shows keep getting announced after a date is booked. A followed date is re-checked every day, and an email goes out when a competing show lands on that night.</p>
          <div className="w-tray">
            <Image src="/case-studies/eventread/followed-dates.jpg" alt="Followed dates: two dates followed, both at risk, three new conflicts since the last visit" width={1800} height={1180} sizes="(min-width: 1100px) 45vw, 92vw" />
          </div>
        </div>
        <div className="w-col">
          <div className="w-num">03</div>
          <h3 className="w-title">Plan a tour as one run</h3>
          <p className="body w-body">Eight cities typed in any order, one date already booked in Paris. The planner routes Berlin to Paris in 12 days and 2,495 km, keeps every drive possible, picks the quietest nights the run can reach, then checks the 20 shortest alternatives: none beats it.</p>
          <div className="w-tray">
            <Image src="/case-studies/eventread/tour-route.jpg" alt="Tour planner result: Berlin to Paris, 8 stops, 2,495 km, 12 days; the 20 shortest alternative routes checked, none better" width={2256} height={1480} sizes="(min-width: 1100px) 45vw, 92vw" />
          </div>
        </div>
      </div>

      <div className="g12">
        <div className="hood" style={{ gridColumn: "1/13" }}>
          <p>
            <span className="label" style={{ marginRight: "calc(var(--u) * 16)" }}>Under the hood</span>Ticketmaster covers the big ticketed shows and JamBase the local ones it doesn&apos;t list: for Berlin in November 2026, 487 shows against 93, 436 of them not on Ticketmaster at all. &quot;Cambridge&quot; returned 124 events across the UK and the US until places carried their country (21 after the fix), and tour shows wanting the same night are assigned in two passes.
          </p>
        </div>
      </div>
    </section>
  );
}
