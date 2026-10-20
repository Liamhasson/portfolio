import { useId } from "react";
import { marniFonts } from "@/components/marni-came/fonts";
import { POSTERS, Poster } from "@/components/marni-came/poster";
import { MC_ASSETS } from "@/lib/marni-came/assets";

/** Board CS 07 · Applications: the single (route A), the four show posters, and the pieces made for the stage and the
 *  crowd. Until Liam's photographs of them exist, their flat artwork stands in, labelled as artwork (spec §6). */
export function MarniCameApplications({ kind, title }: { kind: "supporting"; title: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} data-block={kind} className={`f mc-sec applications ${marniFonts}`}>
      <div className="mc-head"><h2 id={id} className="title">{title}</h2><p className="mc-open">The same rules, from a single to a stage.</p></div>
      <div className="mc-apps">
        <figure className="mc-cover">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MC_ASSETS.cover} alt="The After Heartbreaks single cover: four halves of Liam's face, cut and shifted, titled After Heartbreaks, mixed by Fabio Buemi, mastered by Nadim Khoury" loading="lazy" />
          <span className="by" aria-hidden="true" data-product="">Marni Came</span>
          <span className="t" aria-hidden="true" data-product="">After Heartbreaks</span>
          <span className="cr" aria-hidden="true" data-product="">Mixed by Fabio Buemi · Mastered by Nadim Khoury</span>
        </figure>
        <div className="mc-app-posters">{POSTERS.map((p) => <Poster key={p.photo} {...p} />)}</div>
      </div>
      <div className="mc-collage">
        <figure className="a1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MC_ASSETS.logoBurned} alt="The stage flag: the wordmark on black cloth, light burning in from the left" loading="lazy" />
          <figcaption className="label">Stage flag · artwork</figcaption>
        </figure>
        <figure className="a2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MC_ASSETS.wordmarkDistressedBone} alt="The crowd shirt's front: the wordmark in bone on black" loading="lazy" />
          <figcaption className="label">Crowd shirt · front · artwork</figcaption>
        </figure>
        <figure className="a3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MC_ASSETS.posters.lido} alt="The Lido poster as a print" loading="lazy" />
          <figcaption className="label">Wheatpaste · artwork</figcaption>
        </figure>
      </div>
    </section>
  );
}
