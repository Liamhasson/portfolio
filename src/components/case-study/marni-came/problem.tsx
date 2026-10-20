import { useId } from "react";
import { marniFonts } from "@/components/marni-came/fonts";
import { MC_ASSETS } from "@/lib/marni-came/assets";

/** Board CS 03 · Problem. */
export function MarniCameProblem({ kind, title }: { kind: "problem"; title: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} data-block={kind} className={`f mc-sec problem ${marniFonts}`}>
      <div className="mc-head"><h2 id={id} className="title">{title}</h2></div>
      <div className="mc-two">
        <div>
          <p className="mc-open">Loud is easy. Being remembered isn&rsquo;t.</p>
          <p className="body">Marni Came was a new band in a crowded Berlin scene: no label, no budget, and a lot of polished competition. My BA research looked at how four artists built a persona (Bowie, Cobain, Grohl and Måneskin) and asked what a band our size could bring that others didn&rsquo;t.</p>
        </div>
        <figure className="mc-ph">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MC_ASSETS.problem} alt="Marni Came on stage at Badehaus, the crowd in front" loading="lazy" />
          <figcaption className="label">Badehaus · video still</figcaption>
        </figure>
      </div>
    </section>
  );
}
