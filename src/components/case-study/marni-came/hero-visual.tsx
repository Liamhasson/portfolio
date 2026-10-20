import { LazyVideo } from "@/components/case-study/lazy-video";
import { MC_ASSETS } from "@/lib/marni-came/assets";
import "./marni-came.css";

/** Board CS 01: Drop Dead live at Lido (the solo, then the drummer's view), graded, full-bleed and always muted, the
 *  distressed wordmark over it (Liam, 2026-10-20). */
export function MarniCameHeroVisual() {
  return (
    <div className="mc-hero" aria-hidden="false">
      <LazyVideo className="mc-hero-video" src={MC_ASSETS.heroLoop} poster={MC_ASSETS.heroPoster} label="Marni Came live at Lido, in black and white: the guitar solo, then the crowd from behind the drums, amber light burning in from a different side each time" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="mc-hero-mark" src={MC_ASSETS.wordmarkDistressedBone} alt="The Marni Came wordmark" />
    </div>
  );
}
