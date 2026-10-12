import type { Metadata } from "next";
import { caseStudyMetadata } from "@/lib/site";
import { CaseStudyPage } from "@/components/case-study/case-study-page";
import { cyvoreEntry } from "@/content/case-studies/cyvore.entry";

const entry = cyvoreEntry;
const { study } = entry;

export const metadata: Metadata = caseStudyMetadata(study);

export default function CyvorePage() {
  return <CaseStudyPage {...entry} />;
}
