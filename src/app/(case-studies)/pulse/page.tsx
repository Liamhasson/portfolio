import type { Metadata } from "next";
import { CaseStudyPage } from "@/components/case-study/case-study-page";
import { pulseEntry } from "@/content/case-studies/pulse.entry";

const entry = pulseEntry;
const { study } = entry;

export const metadata: Metadata = { title: `${study.title} case study`, description: study.line };

export default function PulsePage() {
  return <CaseStudyPage {...entry} />;
}
