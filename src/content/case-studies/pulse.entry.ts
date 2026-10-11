import { PulseChallengeExtras } from "@/components/case-study/pulse/challenge-extras";
import { PulseHeroVisual } from "@/components/case-study/pulse/hero-visual";
import type { CaseStudyEntry } from "@/lib/case-studies/types";
import { pulse } from "./pulse";
import PulseMiddle from "./pulse.mdx";

/** The /pulse page's study: its own content, visuals and middle only, so the page bundles nothing of the other studies. */
export const pulseEntry: CaseStudyEntry = { study: pulse, Middle: PulseMiddle, HeroVisual: PulseHeroVisual, ChallengeExtras: PulseChallengeExtras };
