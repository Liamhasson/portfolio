import type { ComponentType } from "react";

export type CaseSlug = "eventread" | "cyvore" | "pulse";

/** Spec §2: the eight blocks of the frame, in page order. */
export type BlockId =
  | "hero"
  | "atAGlance"
  | "problem"
  | "signature"
  | "supporting"
  | "challenges"
  | "outcome"
  | "next";

/** Engineering-only challenges are allowed, but never alone (spec §3.3). */
export type ChallengeKind = "design" | "user" | "stakeholder" | "engineering";

export interface Challenge {
  kind: ChallengeKind;
  title: string;
  /** What happened. */
  happened: string;
  /** What I did. */
  did: string;
  /** What it changed: a number or a concrete fact. */
  changed: string;
}

export interface AtAGlance {
  role: string;
  timeline: string;
  team: string;
  tools: readonly string[];
  /** Only where it explains the context (contract, course project). */
  type?: string;
}

export interface Quote {
  text: string;
  name: string;
  title: string;
}

export interface Outcome {
  lines: readonly string[];
  quote?: Quote;
  link?: { href: string; label: string };
}

export interface CaseStudy {
  slug: CaseSlug;
  title: string;
  descriptor: string;
  /** The one line approved for the home page. */
  line: string;
  liveUrl?: string;
  atAGlance: AtAGlance;
  challenges: readonly Challenge[];
  outcome: Outcome;
  /** Screens per block at 1440×900 (spec §2). */
  budget: Readonly<Record<BlockId, number>>;
}

export interface CaseStudyEntry {
  study: CaseStudy;
  Middle: ComponentType;
}
