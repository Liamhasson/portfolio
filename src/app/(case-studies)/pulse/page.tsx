import type { Metadata } from "next";
import { caseStudyMetadata } from "@/lib/site";
import { CaseStudyPage } from "@/components/case-study/case-study-page";
import { pulseEntry } from "@/content/case-studies/pulse.entry";

const entry = pulseEntry;
const { study } = entry;

export const metadata: Metadata = caseStudyMetadata(study);

export default function PulsePage() {
  return <CaseStudyPage {...entry} />;
}
