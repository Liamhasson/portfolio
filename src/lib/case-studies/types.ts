import type { ComponentType } from "react";

export type CaseSlug = "eventread" | "cyvore" | "pulse" | "nordic-logic";

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

/** An image or video from the board, served from public/case-studies/<slug>/. */
export interface Media {
  src: string;
  alt: string;
  width: number;
  height: number;
  poster?: string;
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
  /** What the previous study shows of this one when it "peeks in" (Part C: next-project block). */
  peek: Media;
  /** A study's own screen cap, when Liam has chosen to let it run longer than SCREEN_CAP. */
  screenCap?: number;
  /** Screens per block at 1440×900 (spec §2). */
  budget: Readonly<Record<BlockId, number>>;
}

export interface CaseStudyEntry {
  study: CaseStudy;
  Middle: ComponentType;
  /** The hero's product visual, from the board. */
  HeroVisual: ComponentType;
  /** Each challenge's chips (and final screen, where the board shows one), from the board. */
  ChallengeExtras: ComponentType<{ index: number }>;
  /** Under the challenges, where a board shows something that belongs to all of them (Nordic Logic: the Claude Code exchanges). */
  ChallengesAfter?: ComponentType;
}
