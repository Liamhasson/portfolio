import { LazyVideo } from "../lazy-video";
import { cyvoreFontVariables } from "./fonts";
import { useId } from "react";

/** Board frame 05 · How it works: the shipped motion (the main CTA), then the design system as one strip (cyvore-mockups.html:679-734). */
export function CyvoreHowItWorks({ kind, title }: { kind: "supporting"; title: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} data-block={kind} className={`f how ${cyvoreFontVariables}`}>
        <div className="g12" style={{ alignItems: "end" }}>
          <h2 id={id} className="title" style={{ gridColumn: "1/7", marginLeft: "calc(var(--u) * -3)" }}>{title}</h2>
          <p className="body" style={{ gridColumn: "8/13" }}><span className="lead">Motion with a job.</span> Every animation carries the founder from one answer to the next. A 7-second sequence tells the product&apos;s mission: a phishing link lands in a video call, and Cyvore blocks it.</p>
        </div>
        <div className="cta-clip">
          <LazyVideo src="/case-studies/cyvore/cta-hover.mp4" poster="/case-studies/cyvore/cta-hover-poster.jpg" label="The main call to action on the shipped site: it glows after a delay, ripples on hover, fills on press" />
        </div>
        <div className="g12" style={{ marginTop: "calc(var(--u) * 64)" }}>
          <p className="body" style={{ gridColumn: "1/7" }}>The design system behind it: type, colour tokens and component states.</p>
        </div>
        <div className="ds">
          <div>
            <div className="label">Type</div>
            <div className="spec-a">MICHROMA</div>
            <p className="spec-note">Headings, navigation and buttons</p>
            <div className="spec-b">ICELAND</div>
            <p className="spec-note">The chapter bar, set apart</p>
          </div>
          <div>
            <div className="label">Colour tokens</div>
            <div className="swatches">
              <div className="sw"><i style={{ background: "#8a38f5" }}></i><span>8A38F5</span></div>
              <div className="sw"><i style={{ background: "#9c83fb" }}></i><span>9C83FB</span></div>
              <div className="sw"><i style={{ background: "#51218f" }}></i><span>51218F</span></div>
              <div className="sw"><i style={{ background: "#411f6e" }}></i><span>411F6E</span></div>
              <div className="sw"><i style={{ background: "#43246c" }}></i><span>43246C</span></div>
              <div className="sw"><i style={{ background: "#2c1747" }}></i><span>2C1747</span></div>
              <div className="sw"><i style={{ background: "#160b23" }}></i><span>160B23</span></div>
            </div>
            <div className="swatches dark">
              <div className="sw"><i style={{ background: "#0c0e12" }}></i><span>0C0E12</span></div>
              <div className="sw"><i style={{ background: "#161122" }}></i><span>161122</span></div>
              <div className="sw"><i style={{ background: "#d1d5dc" }}></i><span>D1D5DC</span></div>
              <div className="sw"><i style={{ background: "#ffffff" }}></i><span>FFFFFF</span></div>
            </div>
          </div>
          <div>
            <div className="label">States</div>
            <div className="states">
              <div className="state"><span className="cta c-default">REQUEST YOUR DEMO</span><div className="k"><b>Main CTA / Default</b> · resting</div></div>
              <div className="state"><span className="cta c-delay">REQUEST YOUR DEMO</span><div className="k"><b>Main CTA / After delay</b> · glows</div></div>
              <div className="state"><span className="cta c-hover">REQUEST YOUR DEMO</span><div className="k"><b>Main CTA / Hover</b> · ripple starts</div></div>
              <div className="state"><span className="cta c-press">REQUEST YOUR DEMO</span><div className="k"><b>Main CTA / Pressed</b> · full ripple</div></div>
              <div className="state"><span className="tabstate">Text</span><div className="k"><b>Chapter tab / Default</b></div></div>
              <div className="state"><span className="tabstate on">Text</span><div className="k"><b>Chapter tab / Active</b> · purple glow</div></div>
            </div>
          </div>
        </div>
      </section>
  );
}
