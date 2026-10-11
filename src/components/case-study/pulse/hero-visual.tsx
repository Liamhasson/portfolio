import { LazyVideo } from "../lazy-video";
import "./pulse.css";

/** Board frame 01: the home screen loading in, in the slim phone. */
export function PulseHeroVisual() {
  return (
    <div className="hero-tray">
      <div className="glow" aria-hidden="true" />
      <div className="phone" data-product>
        <div className="phone-screen">
          <LazyVideo
            src="/case-studies/pulse/home.mp4"
            poster="/case-studies/pulse/home-poster.jpg"
            label="Pulse's home screen loading in: Challenges, My Routine, Training Log, your trainers"
          />
        </div>
      </div>
    </div>
  );
}
