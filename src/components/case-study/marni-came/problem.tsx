import { useId } from "react";
import { LazyVideo } from "@/components/case-study/lazy-video";
import { marniFonts } from "@/components/marni-came/fonts";
import { MC_ASSETS } from "@/lib/marni-came/assets";

/** Board CS 03 · Problem: the words on one half, the crowd on the other (Liam 10-21: the split of Ariel Khait's Ember
 *  page), the crowd from Dopamine live at Badehaus in a loop, graded like the hero. */
export function MarniCameProblem({ kind, title }: { kind: "problem"; title: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} data-block={kind} className={`f mc-sec problem mc-split ${marniFonts}`}>
      <div className="mc-split-text">
        <h2 id={id} className="title">{title}</h2>
        <p className="mc-headline">Loud is easy. <em className="mc-red">Being remembered isn&rsquo;t.</em></p>
        <p className="body">Marni Came was a new band in a crowded Berlin scene: no label, no budget, and a lot of polished competition. My BA research looked at how four artists built a persona (Bowie, Cobain, Grohl and Måneskin) and asked what a band our size could bring that others didn&rsquo;t.</p>
      </div>
      <figure className="mc-split-media">
        <LazyVideo ahead="40%" className="mc-split-video" src={MC_ASSETS.problemLoop} poster={MC_ASSETS.problemPoster} label="The crowd at Marni Came's Badehaus show, singing, headbanging and throwing their hands up, in black and white" />
        <figcaption className="label">Badehaus · the crowd during Dopamine</figcaption>
      </figure>
    </section>
  );
}
