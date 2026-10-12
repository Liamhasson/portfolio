import type { Metadata } from "next";
import { caseStudyMetadata } from "@/lib/site";
import { CaseStudyPage } from "@/components/case-study/case-study-page";
import { eventreadEntry } from "@/content/case-studies/eventread.entry";

const entry = eventreadEntry;
const { study } = entry;

export const metadata: Metadata = caseStudyMetadata(study);

export default function EventreadPage() {
  return <CaseStudyPage {...entry} />;
}
