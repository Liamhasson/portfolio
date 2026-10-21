import type { AtAGlance as Data } from "@/lib/case-studies/types";

/** Board frame 02 · At a glance: one ruled strip; the tools as a dotted run; the type under the tools. */
export function AtAGlance({ data }: { data: Data }) {
  return (
    <div className="f glance">
      <dl aria-label="At a glance" className={data.impact ? "strip has-impact" : "strip"}>
        <div>
          <dt className="label">Role</dt>
          <dd><p>{data.role}</p></dd>
        </div>
        <div>
          <dt className="label">Timeline</dt>
          <dd><p>{data.timeline}</p></dd>
        </div>
        <div>
          <dt className="label">Team</dt>
          <dd><p>{data.team}</p></dd>
        </div>
        <div>
          <dt className="label">Tools</dt>
          <dd>
            <ul className="tools">
              {data.tools.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </dd>
          {data.type && (
            <>
              <dt className="label" style={{ margin: "calc(var(--u) * 22) 0 calc(var(--u) * 10)" }}>Type</dt>
              <dd><p>{data.type}</p></dd>
            </>
          )}
        </div>
        {data.impact && (
          <div>
            <dt className="label">Impact</dt>
            <dd><p>{data.impact}</p></dd>
          </div>
        )}
      </dl>
    </div>
  );
}
