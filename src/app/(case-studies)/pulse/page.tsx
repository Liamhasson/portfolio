import type { Metadata } from "next";
import { CaseStudyPage } from "@/components/case-study/case-study-page";
import { caseStudies } from "@/content/case-studies";

const entry = caseStudies.pulse;
const { study } = entry;

export const metadata: Metadata = { title: `${study.title} case study`, description: study.line };

export default function PulsePage() {
  return <CaseStudyPage {...entry} />;
}
