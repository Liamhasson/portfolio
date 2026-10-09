import Link from "next/link";
import { nextProject } from "@/lib/projects";
import type { CaseSlug } from "@/lib/case-studies/types";

export function NextProject({ from }: { from: CaseSlug }) {
  const next = nextProject(from);
  return (
    <nav aria-label="Next case study" className="px-[5vw] py-[14vh]">
      <Link href={`/${next.slug}`} aria-label={`Next project: ${next.name}`} className="block">
        <span className="font-mono text-xs uppercase tracking-[0.08em] text-ink-3">Next project</span>
        <span className="mt-2 block text-[clamp(3rem,7vw,7rem)] leading-none">{next.name}</span>
      </Link>
    </nav>
  );
}
