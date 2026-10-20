import { MarniCameChallengeExtras, MarniCameCrowd } from "@/components/case-study/marni-came/challenge-extras";
import { MarniCameHeroVisual } from "@/components/case-study/marni-came/hero-visual";
import { MarniCameShell } from "@/components/case-study/marni-came/shell";
import type { CaseStudyEntry } from "@/lib/case-studies/types";
import { marniCame } from "./marni-came";
import MarniCameMiddle from "./marni-came.mdx";

/** The /marni-came page's study: its own content, visuals and middle only. */
export const marniCameEntry: CaseStudyEntry = { study: marniCame, Middle: MarniCameMiddle, HeroVisual: MarniCameHeroVisual, ChallengeExtras: MarniCameChallengeExtras, ChallengesAfter: MarniCameCrowd, Shell: MarniCameShell };
