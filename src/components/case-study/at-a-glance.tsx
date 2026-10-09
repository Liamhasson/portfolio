import type { AtAGlance as Data } from "@/lib/case-studies/types";

export function AtAGlance({ data }: { data: Data }) {
  const rows: [string, string][] = [
    ["Role", data.role],
    ["Timeline", data.timeline],
    ["Team", data.team],
    ["Tools", data.tools.join(" · ")],
  ];
  if (data.type) rows.push(["Type", data.type]);

  return (
    <dl aria-label="At a glance" className="grid gap-x-8 gap-y-2 px-[5vw] py-8 md:grid-cols-5">
      {rows.map(([term, value]) => (
        <div key={term}>
          <dt className="font-mono text-xs uppercase tracking-[0.08em] text-ink-3">{term}</dt>
          <dd className="mt-1">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
