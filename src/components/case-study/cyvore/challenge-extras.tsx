import { Icon } from "../icons";

/** Board frame 06: what each challenge turned on. */
export function CyvoreChallengeExtras({ index }: { index: number }) {
  if (index === 0)
    return (
      <div className="ch-chips">
        <span className="mini-yt" data-product><Icon name="play" />WATCH THE FULL VIDEO</span>
        <span className="chip"><b>7s</b> mission animation</span>
      </div>
    );
  return (
    <div className="ch-chips">
      <span className="chip">CTO</span>
      <span className="chip">Developer</span>
      <span className="chip">DevOps</span>
      <span className="chip"><b>4</b> tasks · counterbalanced</span>
    </div>
  );
}
