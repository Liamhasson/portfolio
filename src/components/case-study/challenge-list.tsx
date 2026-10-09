import { useId } from "react";
import type { Challenge } from "@/lib/case-studies/types";

export function ChallengeList({ challenges }: { challenges: readonly Challenge[] }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="px-[5vw] py-[12vh]">
      <p className="font-mono text-xs uppercase tracking-[0.08em] text-ink-3">Challenges</p>
      <h2 id={headingId} className="mt-2 text-[clamp(2rem,4vw,3.6rem)] font-normal leading-[1.15]">
        What got in the way
      </h2>
      <ol className="mt-10 grid gap-10 md:grid-cols-3">
        {challenges.map((c) => (
          <li key={c.title}>
            <h3 className="text-xl">{c.title}</h3>
            <p className="mt-3 text-ink-3">{c.happened}</p>
            <p className="mt-3">{c.did}</p>
            <p className="mt-3 italic">{c.changed}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
