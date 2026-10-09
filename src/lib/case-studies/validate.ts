import type { BlockId, CaseStudy } from "./types";

/** Spec §3.1: about 8 screens at 1440×900. */
export const SCREEN_CAP = 8;

/** Spec §2. */
export const STANDARD_BUDGET: Readonly<Record<BlockId, number>> = {
  hero: 1,
  atAGlance: 0.3,
  problem: 1,
  signature: 2,
  supporting: 1,
  challenges: 1,
  outcome: 0.5,
  next: 0.7,
};

// Spec §3.2: small samples are counts ("5 of 6"), never percentages.
const SAMPLE_PERCENT = /\b\d+(?:\.\d+)?%\s+of\s+(?:the\s+)?(?:testers|participants|users|people|stakeholders|interviewees)\b/i;

/** Returns every way a study breaks the frame; empty when it fits. */
export function validateCaseStudy(study: CaseStudy): string[] {
  const problems: string[] = [];
  const { slug, challenges, outcome, budget } = study;

  if (challenges.length < 2 || challenges.length > 3) {
    problems.push(`${slug}: ${challenges.length} challenges (2–3 allowed)`);
  }
  if (!challenges.some((c) => c.kind !== "engineering")) {
    problems.push(`${slug}: no design, user or stakeholder challenge`);
  }

  const total = Math.round(Object.values(budget).reduce((s, n) => s + n, 0) * 10) / 10;
  if (total > SCREEN_CAP) problems.push(`${slug}: ${total} screens (cap ${SCREEN_CAP})`);

  const texts = [...challenges.flatMap((c) => [c.happened, c.did, c.changed]), ...outcome.lines];
  for (const text of texts) {
    if (SAMPLE_PERCENT.test(text)) problems.push(`${slug}: percentage of a small sample: "${text}"`);
  }

  return problems;
}
