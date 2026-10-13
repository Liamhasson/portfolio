import { useId, type ComponentType } from "react";
import type { Challenge } from "@/lib/case-studies/types";

/** Board frame 06 · Challenges: numbered, each with its chips (and final screen) from the study, then what happened,
    what I did and what it changed. */
export function ChallengeList({ challenges, Extras, After }: { challenges: readonly Challenge[]; Extras?: ComponentType<{ index: number }>; After?: ComponentType }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="f chal">
      <div className="g12">
        <h2 id={headingId} className="title" style={{ gridColumn: "1 / 10", marginLeft: "calc(var(--u) * -3)" }}>
          Challenges
        </h2>
      </div>
      <ol role="list" className={challenges.length === 2 ? "chs two" : "chs"}>
        {challenges.map((c, i) => (
          <li key={c.title} className="ch">
            <div className="ch-head">
              <span className="ch-num">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="ch-title">{c.title}</h3>
            </div>
            {Extras && <Extras index={i} />}
            <div className="step">
              <div className="k">What happened</div>
              <p>{c.happened}</p>
            </div>
            <div className="step">
              <div className="k">What I did</div>
              <p>{c.did}</p>
            </div>
            <div className="step res">
              <div className="k">What it changed</div>
              <p>{c.changed}</p>
            </div>
          </li>
        ))}
      </ol>
      {After && <After />}
    </section>
  );
}
