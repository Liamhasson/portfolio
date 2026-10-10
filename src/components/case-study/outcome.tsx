import { useId } from "react";
import type { Outcome as Data } from "@/lib/case-studies/types";

export function Outcome({ outcome }: { outcome: Data }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="px-[5vw] py-[10vh]">
      <h2 id={headingId} className="text-[clamp(2rem,4vw,3.6rem)] font-normal leading-[1.15]">
        Impact
      </h2>
      {outcome.lines.map((line) => (
        <p key={line} className="mt-4 max-w-[48ch] text-[clamp(1.25rem,2.6vw,2.4rem)] leading-tight">
          {line}
        </p>
      ))}
      {outcome.quote && (
        <figure className="mt-10 max-w-[56ch]">
          <blockquote className="text-xl italic">{outcome.quote.text}</blockquote>
          <figcaption className="mt-3 font-mono text-xs uppercase tracking-[0.08em] text-ink-3">
            <span>{outcome.quote.name}</span> · {outcome.quote.title}
          </figcaption>
        </figure>
      )}
      {outcome.link && (
        <a href={outcome.link.href} target="_blank" rel="noreferrer" className="mt-8 inline-block underline">
          {outcome.link.label}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      )}
    </section>
  );
}
