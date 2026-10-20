import { useId } from "react";

/** A block landing in plan Task 7: its title only, so the frame order holds while it's built. */
export function MarniCamePending({ kind, title }: { kind: "supporting"; title: string }) {
  const id = useId();
  return <section aria-labelledby={id} data-block={kind} className="f mc-sec"><div className="mc-head"><h2 id={id} className="title">{title}</h2></div></section>;
}
