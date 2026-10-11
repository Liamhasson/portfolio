import { LazyVideo } from "../lazy-video";
import "./cyvore.css";

/** Board frame 01: Cyvore's main screen, looping, in its violet tray. */
export function CyvoreHeroVisual() {
  return (
    <div className="tray" data-product>
      <LazyVideo
        src="/case-studies/cyvore/hero-loop.mp4"
        poster="/case-studies/cyvore/hero-loop-poster.jpg"
        label="Cyvore's main screen moving through Security, Exposure, Coverage and Enables"
      />
    </div>
  );
}
