import type { ReactNode } from "react";
import type { CaseStudy } from "@/lib/case-studies/types";
import { Icon } from "./icons";

/** Board frame 01 · Hero: descriptor, title and line beside the study's product visual. */
export function CaseHero({ study, visual }: { study: CaseStudy; visual?: ReactNode }) {
  return (
    <header className="f hero">
      <div className="hero-head">
        <div>
          <p className="label">{study.descriptor}</p>
          <h1 id="case-title" tabIndex={-1} className="title" style={{ marginTop: "calc(var(--u) * 20)", marginLeft: "calc(var(--u) * -3)" }}>
            {study.title}
          </h1>
        </div>
        <div className="hero-right">
          <p className="hero-line">{study.line}</p>
          {study.liveUrl && (
            <a href={study.liveUrl} target="_blank" rel="noreferrer" className="btn btn-ghost">
              Visit site<span className="sr-only"> (opens in a new tab)</span>
              <Icon name="arrow-up-right" />
            </a>
          )}
        </div>
      </div>
      {visual}
    </header>
  );
}
