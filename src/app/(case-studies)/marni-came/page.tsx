import type { Metadata } from "next";
import { caseStudyMetadata } from "@/lib/site";
import { CaseStudyPage } from "@/components/case-study/case-study-page";
import { marniCameEntry } from "@/content/case-studies/marni-came.entry";

const entry = marniCameEntry;
const { study } = entry;

export const metadata: Metadata = caseStudyMetadata(study);

export default function MarniCamePage() {
  return <CaseStudyPage {...entry} />;
}
