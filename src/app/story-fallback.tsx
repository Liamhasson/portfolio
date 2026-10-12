import { WorkList } from "./lab/sand/work-index";
import "./story-fallback.css";

/**
 * The home page in plain HTML (Liam, 2026-10-13): the hero's copy over the sand's still, then every project. Hidden
 * while the story runs; shown by the loader's boot net if the story never starts (its script failed or took over 20 s:
 * loader-mode.ts), and without JavaScript (page.tsx). Server-rendered, so it needs no script at all.
 */
export function StoryFallback() {
  return (
    <div data-story-fallback="" className="story-fallback">
      <section className="sf-hero">
        <h1 className="sf-title">Hi, I&rsquo;m Liam.</h1>
        <p className="sf-line">I build ambiguous ideas into products where design and user needs meet.</p>
      </section>
      <div data-projects="">
        <WorkList />
      </div>
    </div>
  );
}
