import type { CaseStudy } from "@/lib/case-studies/types";

export function CaseHero({ study }: { study: CaseStudy }) {
  return (
    <header className="flex min-h-dvh flex-col justify-end gap-4 px-[5vw] pb-[8vh]">
      <p className="font-mono text-xs uppercase tracking-[0.08em] text-ink-3">{study.descriptor}</p>
      <h1 id="case-title" tabIndex={-1} className="text-[clamp(3rem,7vw,7rem)] font-normal leading-none">{study.title}</h1>
      <p className="max-w-[40ch] text-[clamp(1.25rem,2.6vw,2.4rem)] leading-tight">{study.line}</p>
      {study.liveUrl && (
        <a href={study.liveUrl} target="_blank" rel="noreferrer" className="w-fit font-mono text-xs uppercase tracking-[0.08em] underline">
          Visit site<span className="sr-only"> (opens in a new tab)</span>
        </a>
      )}
    </header>
  );
}
