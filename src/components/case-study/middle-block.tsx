import { useId, type ReactNode } from "react";
import type { BlockId } from "@/lib/case-studies/types";

type Kind = Extract<BlockId, "problem" | "signature" | "supporting">;

/** A middle section in the boards' grid and type. Each study's own sections replace it as they are built (Part C). */
export function MiddleBlock({ kind, title, children }: { kind: Kind; title: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} data-block={kind} className="f mid">
      <div className="g12">
        <h2 id={headingId} className="title" style={{ gridColumn: "1 / 7", marginLeft: "calc(var(--u) * -3)" }}>
          {title}
        </h2>
        <div className="body mid-body">{children}</div>
      </div>
    </section>
  );
}
