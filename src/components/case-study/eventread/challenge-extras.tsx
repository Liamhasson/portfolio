/** Board frame 06: each challenge's state, in the product's own badges. */
export function EventreadChallengeExtras({ index }: { index: number }) {
  if (index === 0)
    return (
      <div className="ch-chips app" data-product>
        <span className="badge plain">Not checked</span>
        <span className="badge plain">No coverage here</span>
        <span className="holiday">All Saints&apos; Day</span>
      </div>
    );
  return (
    <div className="ch-chips app" data-product>
      <span className="badge safe">Safe</span>
      <span className="badge threat">Threat</span>
      <span className="badge crit">Critical</span>
    </div>
  );
}
