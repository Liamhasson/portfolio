import type { ReactNode } from "react";
import "@/components/case-study/frame.css";
import "@/components/case-study/worlds.css";
import { CaseStudyTestHooks } from "@/components/case-study/test-hooks";

/** Case-study pages only: the boards' units and worlds. Fonts load per study (Part C plan, Global Constraints). */
export default function CaseStudiesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <CaseStudyTestHooks />
    </>
  );
}
