/** Board frame 06: each challenge's evidence. 01 what was checked, 02 how the calculator's range was narrowed (the
 *  calculator itself plays in the Solution), 03 the path a file takes. */
export function NordicLogicChallengeExtras({ index }: { index: number }) {
  if (index === 0) {
    return (
      <div className="ch-chips">
        <span className="chip">Their pricing page</span>
        <span className="chip">Their claims pages</span>
        <span className="chip"><b>9</b> G2 reviews</span>
      </div>
    );
  }
  if (index === 1) {
    return (
      <div className="ch-chips">
        <span className="sr-only">Published rates run from 1% to 20%; the lowest range, narrowed to Emil's estimate: 1–3%.</span>
        <span className="chip" aria-hidden="true">Published <b>1–20%</b></span>
        <span className="seq" aria-hidden="true"><span className="arrow">→</span><span className="chip">Lowest range</span></span>
        <span className="seq" aria-hidden="true"><span className="arrow">→</span><span className="chip sig">Emil’s estimate <b>1–3%</b></span></span>
      </div>
    );
  }
  return (
    <div className="ch-chips">
      <span className="sr-only">Upload, then Emil alerted, then the sender confirmed, then deleted at 100 days.</span>
      <span className="chip" aria-hidden="true">Upload</span>
      <span className="seq" aria-hidden="true"><span className="arrow">→</span><span className="chip">Emil alerted</span></span>
      <span className="seq" aria-hidden="true"><span className="arrow">→</span><span className="chip">Sender confirmed</span></span>
      <span className="seq" aria-hidden="true"><span className="arrow">→</span><span className="chip sig">Deleted at <b>100</b> days</span></span>
    </div>
  );
}

/** Board frame 06, under the three: the two Claude Code exchanges (Liam, 2026-09-21: the collaboration is shown). */
export function NordicLogicWithClaude() {
  return (
    <div className="cc">
      <div className="cc-intro">
        <p className="label">With Claude Code</p>
        <p>Claude built the site and drafted the analyses. Every call was mine, and we checked each other.</p>
      </div>
      <figure className="ex">
        <figcaption className="label">I caught it</figcaption>
        <dl>
          <div className="ex-line"><dt>Me</dt><dd>Why 2.12%? Where did you get this number from?</dd></div>
          <div className="ex-line ai"><dt>Claude</dt><dd>I made it up, and I was wrong to.</dd></div>
        </dl>
        <p className="ex-res">Reverted, and the whole field checked for a real source.</p>
      </figure>
      <figure className="ex">
        <figcaption className="label">It pushed back</figcaption>
        <dl>
          <div className="ex-line"><dt>Me</dt><dd>Look at their success stories and make the average of the whole to set a percentage for our calculator.</dd></div>
          <div className="ex-line ai"><dt>Claude</dt><dd>An average of vendor claims from 1% to 20% means nothing, so use the lowest, least biased range.</dd></div>
        </dl>
        <p className="ex-res">I agreed: a range, never a point figure.</p>
      </figure>
    </div>
  );
}
