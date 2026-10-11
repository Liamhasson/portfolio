import { CyvoreChallengeExtras } from "@/components/case-study/cyvore/challenge-extras";
import { CyvoreHeroVisual } from "@/components/case-study/cyvore/hero-visual";
import type { CaseStudyEntry } from "@/lib/case-studies/types";
import { cyvore } from "./cyvore";
import CyvoreMiddle from "./cyvore.mdx";

/** The /cyvore page's study: its own content, visuals and middle only, so the page bundles nothing of the other studies. */
export const cyvoreEntry: CaseStudyEntry = { study: cyvore, Middle: CyvoreMiddle, HeroVisual: CyvoreHeroVisual, ChallengeExtras: CyvoreChallengeExtras };
