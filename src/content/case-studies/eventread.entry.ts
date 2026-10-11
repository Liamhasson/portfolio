import { EventreadChallengeExtras } from "@/components/case-study/eventread/challenge-extras";
import { EventreadHeroVisual } from "@/components/case-study/eventread/hero-visual";
import type { CaseStudyEntry } from "@/lib/case-studies/types";
import { eventread } from "./eventread";
import EventreadMiddle from "./eventread.mdx";

/** The /eventread page's study: its own content, visuals and middle only, so the page bundles nothing of the other studies. */
export const eventreadEntry: CaseStudyEntry = { study: eventread, Middle: EventreadMiddle, HeroVisual: EventreadHeroVisual, ChallengeExtras: EventreadChallengeExtras };
