import { useId } from "react";

/** Board frame 03 · Problem (cyvore-mockups.html:519-540). */
export function CyvoreProblem({ kind, title }: { kind: "problem"; title: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} data-block={kind} className="f problem">
        <div className="g12">
          <h2 id={id} className="title" style={{ gridColumn: "1/13", marginLeft: "calc(var(--u) * -3)" }}>{title}</h2>
          <p className="display" style={{ gridColumn: "1/12", marginTop: "calc(var(--u) * 48)" }}>A linear site vs an investor meeting. Cyvore was raising its first round. <em className="quiet">Its website was linear: about 35 seconds of non-stop scrolling to reach a section, and no story holding it together.</em></p>
        </div>
        <div className="g12" style={{ marginTop: "calc(var(--u) * 88)", alignItems: "end" }}>
          <div style={{ gridColumn: "1/6" }}>
            <div className="fig-num" aria-hidden="true">35<small>s</small></div>
            <div className="fig-sub">of scrolling to reach a section</div>
            <div className="label fig-src">The old linear site</div>
          </div>
          <div style={{ gridColumn: "7/13" }}>
            <p className="body">Fine for a visitor, wrong for a founder presenting live, who needs any answer in one click.</p>
            <p className="pitch" style={{ marginTop: "calc(var(--u) * 36)" }}>Nobody had asked for a redesign. <em>I pitched one.</em></p>
          </div>
        </div>
      </section>
  );
}
