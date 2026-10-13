import type { Metadata } from "next";
import { caseStudyMetadata } from "@/lib/site";
import { CaseStudyPage } from "@/components/case-study/case-study-page";
import { nordicLogicEntry } from "@/content/case-studies/nordic-logic.entry";

const entry = nordicLogicEntry;
const { study } = entry;

export const metadata: Metadata = caseStudyMetadata(study);

export default function NordicLogicPage() {
  return <CaseStudyPage {...entry} />;
}
