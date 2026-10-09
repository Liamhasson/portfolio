import type { ComponentType } from "react";
import { BackButton } from "@/components/shell/back-button";
import type { CaseStudy } from "@/lib/case-studies/types";
import { AtAGlance } from "./at-a-glance";
import { CaseHero } from "./case-hero";
import { ChallengeList } from "./challenge-list";
import { NextProject } from "./next-project";
import { Outcome } from "./outcome";

/** Spec §2: shared top, the project's own middle, shared ending. */
export function CaseStudyPage({ study, Middle }: { study: CaseStudy; Middle: ComponentType }) {
  return (
    <article data-world={study.slug}>
      <BackButton slug={study.slug} />
      <CaseHero study={study} />
      <AtAGlance data={study.atAGlance} />
      <Middle />
      <ChallengeList challenges={study.challenges} />
      <Outcome outcome={study.outcome} />
      <NextProject from={study.slug} />
    </article>
  );
}
