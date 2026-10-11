import type { Metadata } from "next";
import { CaseStudyPage } from "@/components/case-study/case-study-page";
import { eventreadEntry } from "@/content/case-studies/eventread.entry";

const entry = eventreadEntry;
const { study } = entry;

export const metadata: Metadata = { title: `${study.title} case study`, description: study.line };

export default function EventreadPage() {
  return <CaseStudyPage {...entry} />;
}
