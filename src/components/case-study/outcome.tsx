import { useId, type ComponentType } from "react";
import type { Outcome as Data } from "@/lib/case-studies/types";
import { Icon } from "./icons";

/** The first line with the live site's address underlined as a link (Eventread's board: "Live at eventread.vercel.app"). */
function LinkedLine({ line, href }: { line: string; href: string }) {
  const host = new URL(href).host;
  const at = line.indexOf(host);
  if (at < 0) return <>{line}</>;
  return (
    <>
      {line.slice(0, at)}
      <a href={href} target="_blank" rel="noreferrer">
        {host}<span className="sr-only"> (opens in a new tab)</span>
      </a>
      {line.slice(at + host.length)}
    </>
  );
}

/** Board frame 07 · Impact: the lines large (the second quieter); Cyvore adds the quote, Eventread the way in, Nordic
 *  Logic its phone screens above the link. */
export function Outcome({ outcome, Visual }: { outcome: Data; Visual?: ComponentType }) {
  const headingId = useId();
  const [first, ...rest] = outcome.lines;
  return (
    <section aria-labelledby={headingId} className="f outcome">
      <div className="g12">
        <div style={{ gridColumn: "1 / 12" }}>
          <h2 id={headingId} className="title" style={{ marginLeft: "calc(var(--u) * -3)" }}>
            Impact
          </h2>
          {outcome.link ? (
            <>
              <p className="display">
                <LinkedLine line={first} href={outcome.link.href} />
                {rest.map((line) => (
                  <span key={line} className="quiet"><br />{line}</span>
                ))}
              </p>
              {Visual && <Visual />}
              <div className="row-cta">
                <a href={outcome.link.href} target="_blank" rel="noreferrer" className="btn btn-ink">
                  {outcome.link.label}<span className="sr-only"> (opens in a new tab)</span>
                  <Icon name="arrow-up-right" />
                </a>
              </div>
            </>
          ) : (
            <p className="out-lines">
              {outcome.lines.map((line) => <span key={line}>{line}</span>)}
            </p>
          )}
          {outcome.quote && (
            <figure className="quote">
              <blockquote>
                <p>{`“${outcome.quote.text}”`}</p>
              </blockquote>
              <figcaption>
                <b>{outcome.quote.name}</b>
                <span className="label">{outcome.quote.title}</span>
              </figcaption>
            </figure>
          )}
        </div>
      </div>
    </section>
  );
}
