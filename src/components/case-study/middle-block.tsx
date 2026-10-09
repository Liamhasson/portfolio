import { useId, type ReactNode } from "react";
import type { BlockId } from "@/lib/case-studies/types";

type Kind = Extract<BlockId, "problem" | "signature" | "supporting">;

export function MiddleBlock({ kind, title, children }: { kind: Kind; title: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} data-block={kind} className="px-[5vw] py-[12vh]">
      <h2 id={headingId} className="text-[clamp(2rem,4vw,3.6rem)] font-normal leading-[1.15]">
        {title}
      </h2>
      <div className="mt-8 max-w-[60ch] space-y-5 text-lg leading-relaxed">{children}</div>
    </section>
  );
}
