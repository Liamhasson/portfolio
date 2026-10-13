import { useId } from "react";

/** Board frame 03 · Problem (nordic-logic-mockups.html): told, not illustrated. */
export function NordicLogicProblem({ kind, title }: { kind: "problem"; title: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} data-block={kind} className="f problem">
      <div className="g12">
        <h2 id={id} className="title" style={{ gridColumn: "1/13", marginLeft: "calc(var(--u) * -3)" }}>{title}</h2>
        <p className="display" style={{ gridColumn: "1/12", marginTop: "calc(var(--u) * 48)" }}>
          A stranger, asked for their invoices. Nordic Logic recovers what parcel carriers overcharge. To do it, a one-person company asks a sceptical finance or operations lead for their carrier invoices, then a power of attorney, <em className="quiet">with no clients, reviews or results to show yet.</em>
        </p>
      </div>
      <div className="g12 problem-cols" style={{ marginTop: "calc(var(--u) * 80)", alignItems: "start" }}>
        <p className="body" style={{ gridColumn: "1/5" }}>The brief I started from, on 28 August, led with price: Nordic Logic’s 35% set against “a 40–50% market standard”.</p>
        <p className="body" style={{ gridColumn: "5/9" }}>LateShipment, the competitor a buyer would check first, publishes 35% on its own pricing page. A claim a prospect can disprove in ten minutes turns every careful line around it into marketing.</p>
        <div className="fig" style={{ gridColumn: "9/13", paddingLeft: "calc(var(--u) * 24)" }}>
          <div className="fig-num" aria-hidden="true">35<small>%</small></div>
          <div className="fig-sub">theirs, and ours</div>
          <div className="label fig-src">LateShipment’s pricing page · audit fee</div>
        </div>
      </div>
    </section>
  );
}
