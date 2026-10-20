import { LazyVideo } from "@/components/case-study/lazy-video";
import { MC_ASSETS } from "@/lib/marni-came/assets";
import "./marni-came.css";

/** Board CS 01: Dopamine live at Badehaus, graded, full-bleed and always muted, the distressed wordmark over it. */
export function MarniCameHeroVisual() {
  return (
    <div className="mc-hero" aria-hidden="false">
      <LazyVideo className="mc-hero-video" src={MC_ASSETS.heroLoop} poster={MC_ASSETS.heroPoster} label="Marni Came live at Badehaus, in black and white, amber light burning in from the left" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="mc-hero-mark" src={MC_ASSETS.wordmarkDistressedBone} alt="The Marni Came wordmark" />
    </div>
  );
}
