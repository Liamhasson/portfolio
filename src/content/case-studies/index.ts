import type { CaseSlug, CaseStudyEntry } from "@/lib/case-studies/types";
import { cyvore } from "./cyvore";
import CyvoreMiddle from "./cyvore.mdx";
import { eventread } from "./eventread";
import EventreadMiddle from "./eventread.mdx";
import { pulse } from "./pulse";
import PulseMiddle from "./pulse.mdx";

export const caseStudies: Record<CaseSlug, CaseStudyEntry> = {
  eventread: { study: eventread, Middle: EventreadMiddle },
  cyvore: { study: cyvore, Middle: CyvoreMiddle },
  pulse: { study: pulse, Middle: PulseMiddle },
};
