import Image from "next/image";
import { useId } from "react";
import { Icon } from "../icons";

/** Board frame 05b · Design system (Liam, 2026-10-11: its own section, replacing challenge 03): the three references
    and what each gave, then the product's core components. */
export function EventreadDesignSystem({ kind, title }: { kind: "supporting"; title: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} data-block={kind} className="f dsys">
        <div className="g12" style={{ alignItems: "end" }}>
          <h2 id={id} className="title" style={{ gridColumn: "1/7", marginLeft: "calc(var(--u) * -3)" }}>{title}</h2>
          <p className="body" style={{ gridColumn: "8/13" }}><span className="lead">One product, one language.</span> The interface had grown by feature: pill-shaped navigation next to square buttons, colour used for decoration as much as for risk. I surveyed product design systems and built one from three references.</p>
        </div>
        <div className="ds-refs">
          <div className="ds-ref">
            <div className="label">From Vercel</div>
            <h3>Type</h3>
            <div className="ds-spec app" data-product="">
              <div className="ds-sans">The check every booker skips.</div>
              <div className="ds-mono">1,000 CAP · 20:00 · 2,495 KM</div>
            </div>
            <p className="ds-note">Geist Sans for words, Geist Mono for numbers and labels.</p>
          </div>
          <div className="ds-ref">
            <div className="label">From Ramp</div>
            <h3>Colour</h3>
            <div className="ds-spec app" data-product="">
              <div className="ds-badges"><span className="badge lg safe">Safe</span><span className="badge lg threat">Threat</span><span className="badge lg crit">Critical</span></div>
              <div className="ds-swatches">
                <div><i style={{ background: "#23784d" }}></i><span>SAFE · 23784D</span></div>
                <div><i style={{ background: "#f0a020" }}></i><span>THREAT · F0A020</span></div>
                <div><i style={{ background: "#c8333a" }}></i><span>CRITICAL · C8333A</span></div>
              </div>
            </div>
            <p className="ds-note">Risk is the only colour, shown as a dot and a word.</p>
          </div>
          <div className="ds-ref">
            <div className="label">From Cal.com</div>
            <h3>Month view</h3>
            <div className="ds-month"><Image src="/case-studies/eventread/calendar-berlin-2026-11.jpg" alt="Eventread's month view: each day tile carries its risk" width={2400} height={1500} sizes="(min-width: 1100px) 1100px, 700px" /></div>
            <p className="ds-note">A month at a glance, each day carrying its risk.</p>
          </div>
        </div>
        <div className="ds-comps">
          <div className="label">Core components</div>
          <div className="row-c app" data-product="">
            <span className="btn btn-ink">Save tour</span>
            <span className="btn btn-ghost">Edit inputs</span>
            <span className="mini-btn"><Icon name="plus" />Follow this date</span>
            <span className="counter crit">Conflicts<b>9</b></span>
            <div className="seg"><span className="on">Rock</span><span>Alternative</span><span>Pop</span></div>
            <div className="time"><b><Icon name="minus" /></b><span>20:00</span><b><Icon name="plus" /></b></div>
          </div>
        </div>
        <div className="g12 ds-foot">
          <p className="display">One type family, one set of shapes, three colours that always mean risk, <em className="quiet">and a CI test that fails if an old style comes back.</em></p>
        </div>
      </section>
  );
}
