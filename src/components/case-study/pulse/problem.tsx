import { useId } from "react";

/** Board frame 03 · Problem: the four milestones as one line (pulse-mockups.html:379-400). */
export function PulseProblem({ kind, title }: { kind: "problem"; title: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} data-block={kind} className="f problem">
        <div className="g12">
          <h2 id={id} className="title" style={{ gridColumn: "1/13", marginLeft: "calc(var(--u) * -3)" }}>{title}</h2>
          <p className="display" style={{ gridColumn: "1/12", marginTop: "calc(var(--u) * 48)" }}>Users quit before the habit. <em className="quiet">Fitness apps lose people before a habit forms.</em></p>
        </div>
        <div className="g12 problem-copy" style={{ marginTop: "calc(var(--u) * 56)" }}>
          <p className="body" style={{ gridColumn: "1/7" }}>In a study of 389,481 Fitbod users, training consistently in the first 28 days was the strongest predictor of sticking with it (<a href="https://doi.org/10.3389/fspor.2026.1855668">Conti et al., 2026</a>). BEAT81 and Urban Sports Club sell access to classes. Pulse is built around the habit.</p>
          <p className="body" style={{ gridColumn: "8/13" }}>I designed Pulse around four milestones, each with its own job:</p>
        </div>
        <div className="miles problem-copy">
          <div className="mile"><div className="mile-day"><small>Day</small>7</div><p><b>The first habit loop.</b></p></div>
          <div className="mile"><div className="mile-day"><small>Day</small>30</div><p><b>A routine.</b> The first month predicts who stays.</p></div>
          <div className="mile"><div className="mile-day"><small>Day</small>60</div><p><b>A habit.</b> Habits take a median of 66 days to become automatic (<a href="https://doi.org/10.1002/ejsp.674">Lally et al., 2010</a>).</p></div>
          <div className="mile"><div className="mile-day"><small>Day</small>90</div><p><b>Staying power.</b></p></div>
        </div>
      </section>
  );
}
