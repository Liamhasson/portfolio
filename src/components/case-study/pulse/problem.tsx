import { useId } from "react";

/** Board frame 03 · Problem: the four milestones as one line (pulse-mockups.html:379-400). Liam's own research (2026-11-19,
 *  from his original case study in Figma): 6 interviews, the Urban Sports Club / ClassPass analysis, and each milestone's
 *  key lever, worded as what the feature is designed to do (the app isn't built). Only sources that came before the
 *  project; the later Fitbod study is out. */
export function PulseProblem({ kind, title }: { kind: "problem"; title: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} data-block={kind} className="f problem">
        <div className="g12">
          <h2 id={id} className="title" style={{ gridColumn: "1/13", marginLeft: "calc(var(--u) * -3)" }}>{title}</h2>
          <p className="display" style={{ gridColumn: "1/12", marginTop: "calc(var(--u) * 48)" }}>Users quit before the habit. <em className="quiet">Fitness apps lose people before a habit forms.</em></p>
        </div>
        <div className="g12 problem-copy" style={{ marginTop: "calc(var(--u) * 56)" }}>
          <p className="body" style={{ gridColumn: "1/7" }}>I interviewed 6 people and analysed Europe&rsquo;s two biggest booking platforms, Urban Sports Club and ClassPass. People wanted to see their progress, and cancelled workouts for small reasons. Both platforms treat every booking as a one-off: neither reacts to a missed session or shows progress over time, and discovery is by category, not by goal. Pulse is built around the habit.</p>
          <p className="body" style={{ gridColumn: "8/13" }}>I designed Pulse around four retention milestones, each with a feature designed to reach it:</p>
        </div>
        <div className="miles problem-copy">
          <div className="mile"><div className="mile-day"><small>Day</small>7</div><p><b>The first habit loop.</b> Onboarding sets a goal and ends in a first booking. People who try more kinds of activity in their first week stay longer (<a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC5959281/">Lin et al., 2018</a>).</p></div>
          <div className="mile"><div className="mile-day"><small>Day</small>30</div><p><b>A routine.</b> Weekly challenges, designed to adapt to how you train.</p></div>
          <div className="mile"><div className="mile-day"><small>Day</small>60</div><p><b>A habit.</b> The Training Log shows progress against yourself. Habits take a median of 66 days to become automatic (<a href="https://doi.org/10.1002/ejsp.674">Lally et al., 2010</a>).</p></div>
          <div className="mile"><div className="mile-day"><small>Day</small>90</div><p><b>Staying power.</b> My Routine, designed to adapt to your preferences and schedule.</p></div>
        </div>
      </section>
  );
}
