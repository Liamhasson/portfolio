import type { Metadata } from "next";
import { CaseStudyPage } from "@/components/case-study/case-study-page";
import { cyvoreEntry } from "@/content/case-studies/cyvore.entry";

const entry = cyvoreEntry;
const { study } = entry;

export const metadata: Metadata = { title: `${study.title} case study`, description: study.line };

export default function CyvorePage() {
  return <CaseStudyPage {...entry} />;
}
