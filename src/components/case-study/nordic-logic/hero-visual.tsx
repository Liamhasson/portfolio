import { LazyVideo } from "../lazy-video";
import "./nordic-logic.css";

/** Board frame 01: the live home page's whole arrival in its tray (recorded 2026-10-26 at 2×, in a 1440×1300 window so
 *  the portal it lands on shows whole; scripts/capture/nordic-logic-site.mjs). The headline builds, the 3D invoice gives
 *  up its errors and they become the portal; it holds there, then crossfades back to the start (0.6 s). Reduced motion:
 *  the poster, the landed portal. */
export function NordicLogicHeroVisual() {
  return (
    <div className="tray">
      <LazyVideo
        src="/case-studies/nordic-logic/hero-film.mp4"
        poster="/case-studies/nordic-logic/hero-film.jpg"
        label="Nordic Logic's home page arriving: Your carriers owe you builds letter by letter, a FedEx invoice turns in 3D and its errors light up, they split into findings and a chart, and land as the client portal's overview"
      />
    </div>
  );
}
