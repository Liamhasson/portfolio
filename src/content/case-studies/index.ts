import { CyvoreChallengeExtras } from "@/components/case-study/cyvore/challenge-extras";
import { CyvoreHeroVisual } from "@/components/case-study/cyvore/hero-visual";
import { EventreadChallengeExtras } from "@/components/case-study/eventread/challenge-extras";
import { EventreadHeroVisual } from "@/components/case-study/eventread/hero-visual";
import { PulseChallengeExtras } from "@/components/case-study/pulse/challenge-extras";
import { PulseHeroVisual } from "@/components/case-study/pulse/hero-visual";
import type { CaseSlug, CaseStudyEntry } from "@/lib/case-studies/types";
import { cyvore } from "./cyvore";
import CyvoreMiddle from "./cyvore.mdx";
import { eventread } from "./eventread";
import EventreadMiddle from "./eventread.mdx";
import { pulse } from "./pulse";
import PulseMiddle from "./pulse.mdx";

export const caseStudies: Record<CaseSlug, CaseStudyEntry> = {
  eventread: { study: eventread, Middle: EventreadMiddle, HeroVisual: EventreadHeroVisual, ChallengeExtras: EventreadChallengeExtras },
  cyvore: { study: cyvore, Middle: CyvoreMiddle, HeroVisual: CyvoreHeroVisual, ChallengeExtras: CyvoreChallengeExtras },
  pulse: { study: pulse, Middle: PulseMiddle, HeroVisual: PulseHeroVisual, ChallengeExtras: PulseChallengeExtras },
};
