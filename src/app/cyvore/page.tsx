import type { Metadata } from "next";
import { CaseStudyPage } from "@/components/case-study/case-study-page";
import { caseStudies } from "@/content/case-studies";

const { study, Middle } = caseStudies.cyvore;

export const metadata: Metadata = { title: `${study.title} case study`, description: study.line };

export default function CyvorePage() {
  return <CaseStudyPage study={study} Middle={Middle} />;
}
