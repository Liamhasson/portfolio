import { BackButton } from "@/components/shell/back-button";
import type { CaseStudyEntry } from "@/lib/case-studies/types";
import { AtAGlance } from "./at-a-glance";
import { CaseHero } from "./case-hero";
import { ChallengeList } from "./challenge-list";
import { IconSprite } from "./icons";
import { NextProject } from "./next-project";
import { Outcome } from "./outcome";

/** Spec §2: shared top, the project's own middle, shared ending. Part C: each in its board's design. */
export function CaseStudyPage({ study, Middle, HeroVisual, ChallengeExtras, ChallengesAfter, OutcomeVisual, Shell }: CaseStudyEntry) {
  return (
    <article data-world={study.slug} className="cs">
      <IconSprite />
      <BackButton slug={study.slug} />
      {Shell && <Shell />}
      <CaseHero study={study} visual={<HeroVisual />} />
      <AtAGlance data={study.atAGlance} />
      <Middle />
      <ChallengeList challenges={study.challenges} Extras={ChallengeExtras} After={ChallengesAfter} />
      <Outcome outcome={study.outcome} Visual={OutcomeVisual} />
      <NextProject from={study.slug} />
    </article>
  );
}
