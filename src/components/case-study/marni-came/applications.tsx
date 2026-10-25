import { useId } from "react";
import { marniFonts } from "@/components/marni-came/fonts";
import { MC_ASSETS } from "@/lib/marni-came/assets";

/** Board CS 07 · Applications: the single (route A), the stage flag and the shirts (Liam 10-21: the wheatpaste repeated a
 *  poster, so it went; 10-25: the show posters are out until Liam's own designs are ready, and the cover floats with the flag and the shirts; its own title names it, so no label). Until Liam's photographs of them exist, their flat artwork stands in, labelled as artwork (spec §6). */
export function MarniCameApplications({ kind, title }: { kind: "supporting"; title: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} data-block={kind} className={`f mc-sec applications ${marniFonts}`}>
      <div className="mc-head"><h2 id={id} className="title">{title}</h2></div>
      <p className="mc-headline">The same rules everywhere. <em className="mc-red">From a single to a stage.</em></p>
      <div className="mc-collage">
        <figure className="mc-cover a0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MC_ASSETS.cover} alt="The After Heartbreaks single cover: four halves of Liam's face, cut and shifted, titled After Heartbreaks, mixed by Fabio Buemi, mastered by Nadim Khoury" loading="lazy" />
          <span className="by" aria-hidden="true" data-product="">Marni Came</span>
          <span className="t" aria-hidden="true" data-product="">After Heartbreaks</span>
          <span className="cr" aria-hidden="true" data-product="">Mixed by Fabio Buemi · Mastered by Nadim Khoury</span>
        </figure>
        <figure className="a1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MC_ASSETS.flag} alt="The stage flag: the distressed wordmark in bone on cloth that burns from amber at the left to black at the right, hung by brass grommets" loading="lazy" />
          <figcaption className="label">Stage flag</figcaption>
        </figure>
        <figure className="a2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MC_ASSETS.shirtFaces} alt="The shirt with the single's cut faces printed large, worn with a white long-sleeve underneath" loading="lazy" />
          <figcaption className="label">Shirt · After Heartbreaks release</figcaption>
        </figure>
        <figure className="a3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MC_ASSETS.shirtWordmark} alt="The shirt with the small Marni Came wordmark on the chest" loading="lazy" />
          <figcaption className="label">Shirt · Wordmark</figcaption>
        </figure>
      </div>
    </section>
  );
}
