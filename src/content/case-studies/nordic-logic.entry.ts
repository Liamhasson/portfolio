import { NordicLogicChallengeExtras, NordicLogicWithClaude } from "@/components/case-study/nordic-logic/challenge-extras";
import { NordicLogicHeroVisual } from "@/components/case-study/nordic-logic/hero-visual";
import type { CaseStudyEntry } from "@/lib/case-studies/types";
import { nordicLogic } from "./nordic-logic";
import NordicLogicMiddle from "./nordic-logic.mdx";

/** The /nordic-logic page's study: its own content, visuals and middle only, so the page bundles nothing of the other studies. */
export const nordicLogicEntry: CaseStudyEntry = { study: nordicLogic, Middle: NordicLogicMiddle, HeroVisual: NordicLogicHeroVisual, ChallengeExtras: NordicLogicChallengeExtras, ChallengesAfter: NordicLogicWithClaude };
