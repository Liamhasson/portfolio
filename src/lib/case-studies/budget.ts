import type { BlockId } from "./types";

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
