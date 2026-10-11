import { useId } from "react";

/** Board frame 03 · Problem (eventread-mockups.html:469-489). */
export function EventreadProblem({ kind, title }: { kind: "problem"; title: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} data-block={kind} className="f problem">
      <div className="g12">
        <h2 id={id} className="title" style={{ gridColumn: "1/13", marginLeft: "calc(var(--u) * -3)" }}>{title}</h2>
        <p className="display" style={{ gridColumn: "1/12", marginTop: "calc(var(--u) * 48)" }}>
          Two bands, one lost night. My band&apos;s release show lost its audience to a Måneskin arena show on the same night. A friend&apos;s band lost theirs to the Champions League final. <em className="quiet">Nobody had checked, because there was nothing to check with.</em>
        </p>
      </div>
      <div className="g12 problem-cols" style={{ marginTop: "calc(var(--u) * 80)", alignItems: "start" }}>
        <p className="body" style={{ gridColumn: "1/5" }}>Eventread is built for the two people I worked with for ten years: artists and managers picking a date, and promoters and agents filling a room. Both pick a date and hope: ticketing platforms show their own events, and nobody shows the whole night.</p>
        <p className="body" style={{ gridColumn: "5/9" }}>Live Nation alone puts on 54,000 shows a year, about 150 every night. Every independent show gets booked around that calendar, usually without seeing it. Prism.fm, TourSmart and ChatGPT each answer part of the question; none checks a date against everything happening that night.</p>
        <div className="fig" style={{ gridColumn: "9/13", paddingLeft: "calc(var(--u) * 24)" }}>
          <div className="fig-num" aria-hidden="true">150</div>
          <div className="fig-sub">shows every night</div>
          <div className="label fig-src">Live Nation alone · 54,000 a year</div>
        </div>
      </div>
    </section>
  );
}
